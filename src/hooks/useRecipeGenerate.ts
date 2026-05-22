/**
 * useRecipeGenerate — 레시피 생성(POST /api/recipes/generate) 호출 + SSE 스트리밍 처리.
 *
 * 계약(1.3): stream:true면 Content-Type text/event-stream. 청크는 StreamChunk discriminated union.
 *  - meta:   생성 시작 (dishName)
 *  - text:   점진 텍스트 델타(선택 UI) → progressText로 누적
 *  - recipe: 최종 GeneratedRecipe (.recipe) → 결과
 *  - error:  HTTP 200 안에서 오류 전달 → 청크로 분기
 *  - done:   스트림 종료
 *
 * 주의:
 * - 결과는 GeneratedRecipe(미저장, id 없음). 저장은 useMyRecipes.save로 별도.
 * - 스트리밍은 SWR 아님 — fetch + ReadableStream(ADR-003). 폼/진행 상태는 React 로컬 상태.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ApiError,
  GenerateRecipeRequest,
  GeneratedRecipe,
  StreamChunk,
} from "@/types";
import { ApiClientError, requestData, toErrorMessage } from "./api-client";

export type GenerateStatus = "idle" | "streaming" | "done" | "error";

export interface UseRecipeGenerateResult {
  status: GenerateStatus;
  /** 점진 텍스트(text 청크 누적). 스트리밍 UX용 — 없어도 동작. */
  progressText: string;
  /** 최종 결과(미저장). */
  recipe: GeneratedRecipe | null;
  /** 사람이 읽는 오류 메시지. */
  error: string | null;
  /** 생성 시작. stream 미지정 시 기본 true(스트리밍). */
  generate: (req: GenerateRecipeRequest) => Promise<void>;
  /** 진행 중 스트림 취소. */
  cancel: () => void;
  /** 상태 초기화(새 생성 준비). */
  reset: () => void;
}

/** SSE 텍스트 버퍼에서 완성된 이벤트 블록(빈 줄 구분)을 파싱해 data JSON을 추출 */
function parseSseEvents(buffer: string): {
  events: string[];
  rest: string;
} {
  const events: string[] = [];
  let rest = buffer;
  let sep = rest.indexOf("\n\n");
  while (sep !== -1) {
    events.push(rest.slice(0, sep));
    rest = rest.slice(sep + 2);
    sep = rest.indexOf("\n\n");
  }
  return { events, rest };
}

/** 이벤트 블록에서 `data:` 라인들을 모아 JSON.parse 후 StreamChunk로 해석 */
function extractChunk(eventBlock: string): StreamChunk | null {
  const dataLines = eventBlock
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  if (dataLines.length === 0) return null;
  const json = dataLines.join("\n");
  try {
    return JSON.parse(json) as StreamChunk;
  } catch {
    return null;
  }
}

export function useRecipeGenerate(): UseRecipeGenerateResult {
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [progressText, setProgressText] = useState("");
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgressText("");
    setRecipe(null);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleChunk = useCallback((chunk: StreamChunk) => {
    switch (chunk.type) {
      case "meta":
        // 생성 시작 신호 — 진행 상태 유지.
        break;
      case "text":
        setProgressText((prev) => prev + chunk.delta);
        break;
      case "recipe":
        setRecipe(chunk.recipe);
        break;
      case "error":
        // HTTP 200 내부 오류 — 청크로 전달됨(계약 1.3).
        setError(chunk.error.message);
        setStatus("error");
        break;
      case "done":
        // 종료는 generate()에서 status 확정.
        break;
    }
  }, []);

  /** 비스트리밍 경로: { data: GeneratedRecipe } unwrap */
  const generateNonStreaming = useCallback(
    async (body: GenerateRecipeRequest, signal: AbortSignal) => {
      const result = await requestData<GeneratedRecipe>(
        "/api/recipes/generate",
        { method: "POST", body: JSON.stringify(body), signal },
      );
      setRecipe(result);
      setStatus("done");
    },
    [],
  );

  /** 스트리밍 경로: SSE StreamChunk 소비 */
  const generateStreaming = useCallback(
    async (body: GenerateRecipeRequest, signal: AbortSignal) => {
      const res = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      // 스트림 시작 전 HTTP 에러(예: 검증 실패)는 JSON ApiError로 올 수 있음.
      if (!res.ok) {
        let message = `요청이 실패했습니다 (HTTP ${res.status}).`;
        try {
          const errBody = (await res.json()) as ApiError;
          if (errBody?.error?.message) message = errBody.error.message;
        } catch {
          /* JSON 아님 — 기본 메시지 유지 */
        }
        throw new ApiClientError("AI_PROVIDER_ERROR", message, res.status);
      }

      if (!res.body) {
        throw new ApiClientError(
          "AI_PROVIDER_ERROR",
          "스트림 응답 본문이 없습니다.",
          res.status,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawError = false;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseEvents(buffer);
        buffer = rest;
        for (const block of events) {
          const chunk = extractChunk(block);
          if (!chunk) continue;
          if (chunk.type === "error") sawError = true;
          handleChunk(chunk);
        }
      }
      // 남은 버퍼 처리(종료 직전 잔여 이벤트).
      const tail = extractChunk(buffer);
      if (tail) {
        if (tail.type === "error") sawError = true;
        handleChunk(tail);
      }

      if (!sawError) setStatus("done");
    },
    [handleChunk],
  );

  const generate = useCallback(
    async (req: GenerateRecipeRequest) => {
      // 이전 진행 중인 스트림 정리.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("streaming");
      setProgressText("");
      setRecipe(null);
      setError(null);

      const useStream = req.stream ?? true;
      const body: GenerateRecipeRequest = { ...req, stream: useStream };

      try {
        if (useStream) {
          await generateStreaming(body, controller.signal);
        } else {
          await generateNonStreaming(body, controller.signal);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          // 사용자 취소 — idle로 복귀.
          setStatus("idle");
          return;
        }
        setError(toErrorMessage(err));
        setStatus("error");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [generateStreaming, generateNonStreaming],
  );

  return { status, progressText, recipe, error, generate, cancel, reset };
}
