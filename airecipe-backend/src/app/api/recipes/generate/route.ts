/**
 * POST /api/recipes/generate — 레시피 생성 + 영양 분석 (계약 1).
 *
 * **공개 엔드포인트(비로그인 허용).** 저장하지 않음(id 없는 GeneratedRecipe 반환).
 * 인증 일관성 정책(ADR-010)은 generate 에는 적용하지 않는다 — 본 엔드포인트가
 * 원래부터 비로그인 흐름을 지원해 왔고(웹앱 회원가입 전 미리보기 가능),
 * `requireUser` 강제 시 기존 웹앱 동작이 깨진다(제약: 웹앱 무영향). 미니앱은
 * 인증 헤더 없이도 그대로 호출 가능.
 *
 * 응답에는 CORS 헤더(미니앱 cross-origin) 부착. 웹앱은 same-origin 이라 무영향.
 * SSE 응답은 `withCors` 적용 불가 → `buildCorsHeaders(req)` 를 init.headers 에 머지.
 *
 * stream=false → JSON { data: GeneratedRecipe }.
 * stream=true  → SSE: meta → (text*) → recipe → done. 에러는 HTTP 200 + error 청크(계약 1.3).
 */
import type { NextRequest } from "next/server";
import { getRecipeGenerationService } from "@/lib/composition";
import { failFromError, ok } from "@/lib/api-response";
import { withCors, corsPreflightResponse, buildCorsHeaders } from "@/lib/cors";
import { generateRequestSchema, parseOrThrow } from "@/lib/validation";
import { encodeSSE } from "@/lib/sse";
import { ServiceError } from "@/services/service-error";
import type { ApiErrorCode, StreamChunk } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(
      failFromError(
        new ServiceError("VALIDATION_ERROR", "JSON 본문이 올바르지 않습니다."),
      ),
      request,
    );
  }

  let input: { dishName: string; servings?: number; stream?: boolean };
  try {
    input = parseOrThrow(generateRequestSchema, body);
  } catch (err) {
    return withCors(failFromError(err), request);
  }

  const service = getRecipeGenerationService();

  // ── 비스트리밍: JSON 응답 ──────────────────────────────
  if (!input.stream) {
    try {
      const recipe = await service.generate({
        dishName: input.dishName,
        servings: input.servings,
      });
      return withCors(ok(recipe), request);
    } catch (err) {
      return withCors(failFromError(err), request);
    }
  }

  // ── 스트리밍: SSE 응답 ─────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: StreamChunk) =>
        controller.enqueue(encoder.encode(encodeSSE(chunk)));

      try {
        send({ type: "meta", dishName: input.dishName });

        const recipe = await service.generateStream(
          { dishName: input.dishName, servings: input.servings },
          { onText: (delta) => send({ type: "text", delta }) },
        );

        send({ type: "recipe", recipe });
      } catch (err) {
        // 스트리밍 에러는 HTTP 200 + error 청크로 전달(계약 1.3).
        const { code, message } = toChunkError(err);
        send({ type: "error", error: { code, message } });
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // SSE 응답은 withCors 적용 불가 → CORS 헤더를 init 에 직접 머지.
      ...buildCorsHeaders(request),
    },
  });
}

/** CORS preflight — ADR-010 D5. */
export const OPTIONS = corsPreflightResponse;

function toChunkError(err: unknown): { code: ApiErrorCode; message: string } {
  if (err instanceof ServiceError) {
    return { code: err.code, message: err.message };
  }
  return { code: "INTERNAL_ERROR", message: "레시피 생성 중 오류가 발생했습니다." };
}
