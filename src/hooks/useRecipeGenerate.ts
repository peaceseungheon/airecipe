/**
 * useRecipeGenerate — SSE 소비 + 상태 관리 (Phase 2)
 *
 * Baseline §A.4 / §C.5. SSOT: 08-STREAMING §8.3.1~8.3.5, §8.4, §8.5.
 *
 * 외부 인터페이스(08 §8.3.2 라인 76~88) — 웹/미니앱 동일 시그니처 유지:
 *   { status, progressText, recipe, error, generate, cancel, reset }
 *
 * 책임 경계(baseline §C.5):
 * - HTTP·SSE 파싱·zod 검증·error 청크 throw는 sse-client 책임. 본 훅은 청크 분기와 상태만 담당.
 * - AbortController 생성·전달·cleanup은 본 훅.
 * - text 청크 delta는 progressText에 내부 누적만 — 사용자 화면 표시 금지 (08 §8.3.5).
 * - !res.body 시 비스트리밍 폴백 1회 (generateRecipe(stream:false), 08 §8.6).
 * - 첫 청크 15초 + 전체 90초 타임아웃 (Phase 2 결정 — 청크 간 30초는 Phase 3 후속).
 * - 401은 본 endpoint(공개)에서 미발생 — 처리 로직 없음 (baseline §A.4 라인 60).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiClientError,
  generateRecipe,
  generateRecipeStream,
} from '../services';
import type {
  ApiErrorCode,
  GenerateRecipeRequest,
  StreamChunk,
} from '../types/api';
import type { GeneratedRecipe } from '../types/recipe';

export type GenerateStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface UseRecipeGenerateResult {
  status: GenerateStatus;
  /** text 청크 누적 — 내부 신호용. 사용자 화면 표시 금지 (08 §8.3.5). */
  progressText: string;
  recipe: GeneratedRecipe | null;
  error: string | null;
  generate: (req: GenerateRecipeRequest) => Promise<void>;
  /**
   * in-flight AbortController.abort() 발사만 한다. 상태 전이는 비동기:
   * generate의 catch가 signal.aborted를 감지한 뒤에야 'streaming' → 'idle'로 전이한다.
   * UI에서 즉시 idle이 필요하면(예: 취소 버튼) `reset()`을 사용하라 — setState가 동기 호출되어
   * 한 frame 지연 없이 상태가 정리된다 (AC2.2 UI 일관성).
   */
  cancel: () => void;
  /**
   * cancel() + setState 동기 호출 — status='idle', progressText='', recipe=null, error=null.
   * "취소" 버튼·"다시 시도" 직전·다른 generate 직전에 사용.
   */
  reset: () => void;
}

const FIRST_CHUNK_TIMEOUT_MS = 15_000;
const TOTAL_TIMEOUT_MS = 90_000;

export function useRecipeGenerate(): UseRecipeGenerateResult {
  const [status, setStatus] = useState<GenerateStatus>('idle');
  const [progressText, setProgressText] = useState('');
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    setStatus('idle');
    setProgressText('');
    setRecipe(null);
    setError(null);
  }, [cancel]);

  // unmount cleanup — 08 §8.4.2.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runFallback = useCallback(async (req: GenerateRecipeRequest) => {
    const fallbackController = new AbortController();
    abortRef.current = fallbackController;
    try {
      const r = await generateRecipe(req, {
        signal: fallbackController.signal,
      });
      setRecipe(r);
      setStatus('done');
    } catch (fallbackErr) {
      if (fallbackController.signal.aborted) {
        setStatus('idle');
      } else {
        setError(toUserMessage(fallbackErr));
        setStatus('error');
      }
    } finally {
      if (abortRef.current === fallbackController) {
        abortRef.current = null;
      }
    }
  }, []);

  const generate = useCallback(async (req: GenerateRecipeRequest) => {
    // 이전 호출 abort.
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('streaming');
    setProgressText('');
    setRecipe(null);
    setError(null);

    // 첫 청크 타임아웃 — 도달 후 clear.
    let firstChunkSeen = false;
    const firstChunkTimer = setTimeout(() => {
      if (!firstChunkSeen) controller.abort();
    }, FIRST_CHUNK_TIMEOUT_MS);

    // 전체 한도 — 무조건 abort.
    const totalTimer = setTimeout(() => {
      controller.abort();
    }, TOTAL_TIMEOUT_MS);

    try {
      let finalRecipeSeen = false;

      for await (const chunk of generateRecipeStream(req, {
        signal: controller.signal,
      })) {
        if (!firstChunkSeen) {
          firstChunkSeen = true;
          clearTimeout(firstChunkTimer);
        }
        handleChunk(chunk, {
          onText: (delta) => setProgressText((prev) => prev + delta),
          onRecipe: (r) => {
            setRecipe(r);
            finalRecipeSeen = true;
          },
        });
      }

      // for-await 정상 종료 (done 청크 yield 후 generator return) — 결과 확정.
      if (finalRecipeSeen) {
        setStatus('done');
      } else {
        // 모든 청크 소비했지만 recipe 미수신 → AI 응답 누락 (드물지만 백엔드 회귀 가능).
        setError('AI 응답이 비어 있어요. 잠시 후 다시 시도해 주세요.');
        setStatus('error');
      }
    } catch (err) {
      // 폴백 트리거 분류:
      // (a) 첫 청크 타임아웃에 의한 abort — abort + !firstChunkSeen (08 §8.5.1).
      // (b) !res.body 신호 — sse-client가 'AI_PROVIDER_ERROR' / '스트림 응답 본문이 없습니다.'로 throw (08 §8.6).
      const aborted = controller.signal.aborted;
      const shouldFallback =
        (aborted && !firstChunkSeen) ||
        (err instanceof ApiClientError &&
          err.error.code === 'AI_PROVIDER_ERROR' &&
          err.message === '스트림 응답 본문이 없습니다.');

      if (aborted && !shouldFallback) {
        // 사용자 명시 cancel / unmount / 전체 한도 — 에러 표시 없이 idle.
        setStatus('idle');
      } else if (shouldFallback) {
        // 비스트리밍 폴백 1회 — 08 §8.6.
        // finally가 abortRef를 null로 정리하기 전에 폴백을 마쳐야 하므로 await 후 return.
        clearTimeout(firstChunkTimer);
        clearTimeout(totalTimer);
        await runFallback(req);
        return;
      } else {
        setError(toUserMessage(err));
        setStatus('error');
      }
    } finally {
      clearTimeout(firstChunkTimer);
      clearTimeout(totalTimer);
      // 본 호출의 controller가 여전히 abortRef면 해제.
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [runFallback]);

  return { status, progressText, recipe, error, generate, cancel, reset };
}

// ─── 청크 분기 (08 §8.3.4 / baseline §A.4 청크 분기 행) ─────────────────────

interface ChunkHandlers {
  onText: (delta: string) => void;
  onRecipe: (recipe: GeneratedRecipe) => void;
}

function handleChunk(chunk: StreamChunk, handlers: ChunkHandlers): void {
  switch (chunk.type) {
    case 'meta':
      // status는 이미 'streaming' — no-op.
      break;
    case 'text':
      handlers.onText(chunk.delta);
      break;
    case 'recipe':
      handlers.onRecipe(chunk.recipe);
      break;
    case 'done':
      // 종료는 for-await 정상 break 경로 — no-op.
      break;
    case 'error':
      // sse-client에서 throw 변환되어 본 분기에 도달하지 않음 (baseline §C.4).
      break;
  }
}

// ─── 사용자 친화 한국어 에러 메시지 매핑 (Strategy: error.code 기반) ─────────

const ERROR_CODE_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: '입력을 다시 확인해 주세요.',
  UNAUTHORIZED: '로그인이 필요해요. 잠시 후 다시 시도해 주세요.',
  FORBIDDEN: '접근 권한이 없어요.',
  NOT_FOUND: '레시피를 찾을 수 없어요.',
  AI_RATE_LIMITED: '잠시 후 다시 시도해 주세요.',
  AI_PROVIDER_ERROR: 'AI 응답 생성에 실패했어요. 다시 시도해 주세요.',
  DB_ERROR: '일시적인 오류예요. 잠시 후 다시 시도해 주세요.',
  INTERNAL_ERROR: '오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
};

function toUserMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    return ERROR_CODE_MESSAGES[err.error.code] ?? ERROR_CODE_MESSAGES.INTERNAL_ERROR;
  }
  return ERROR_CODE_MESSAGES.INTERNAL_ERROR;
}
