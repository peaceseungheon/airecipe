/**
 * useDeleteRecipe — 삭제 DELETE 훅 (Phase 4)
 *
 * SSOT: 03 §3.7 (DELETE /api/recipes/[id] — 200 + `{ data: { id } }` 또는 404 "이미 삭제됨").
 *       baseline §B D6·D10·D13 + ADR-013 D21.
 *
 * 책임:
 * 1. `deleteRecipe(id, auth)` 호출 (recipes.ts 단일 경로).
 * 2. **404 성공 정규화** (D6): `ApiClientError.error.code === 'NOT_FOUND'` → 성공으로 변환.
 *    UX상 "이미 삭제됨"과 "방금 삭제됨"은 동일 결과 — 사용자에게 별 메시지 없음.
 * 3. 성공·404 정규화 모두 `useRecipeCacheTrigger.invalidate()` 호출 1회 (D13).
 * 4. 401 자동 재시도는 apiFetch 단일 위치 (ADR-010 D3) — `refresh` 주입만.
 * 5. 직전 in-flight abort + cancelled 플래그.
 *
 * 반환 (D10):
 *   { remove: () => Promise<boolean>, isPending, error, reset }
 *   - true: 성공·404 정규화 (호출 측이 navigate)
 *   - false: 실패 (호출 측이 error state 노출)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, deleteRecipe } from '../services';
import type { ApiErrorCode } from '../types/api';

import { useRecipeCacheTrigger } from './useRecipeCache';
import { useTossUserId } from './useTossUserId';

export interface UseDeleteRecipeResult {
  remove: () => Promise<boolean>;
  isPending: boolean;
  error: string | null;
  reset: () => void;
}

export function useDeleteRecipe(id: string): UseDeleteRecipeResult {
  const { tossUserId, refresh } = useTossUserId();
  const { invalidate } = useRecipeCacheTrigger();

  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const remove = useCallback(async (): Promise<boolean> => {
    if (tossUserId === undefined) {
      setError(ERROR_CODE_MESSAGES.UNAUTHORIZED);
      return false;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPending(true);
    setError(null);

    try {
      await deleteRecipe(id, { tossUserId, refreshTossUserId: refresh });
      if (controller.signal.aborted) return false;
      invalidate();
      return true;
    } catch (err) {
      if (controller.signal.aborted) return false;
      // D6: 404 성공 정규화 — "이미 삭제됨"으로 처리. 메시지 0건.
      if (err instanceof ApiClientError && err.error.code === 'NOT_FOUND') {
        invalidate();
        return true;
      }
      setError(toUserMessage(err));
      return false;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setPending(false);
      }
    }
  }, [id, tossUserId, refresh, invalidate]);

  return { remove, isPending, error, reset };
}

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
    return (
      ERROR_CODE_MESSAGES[err.error.code] ?? ERROR_CODE_MESSAGES.INTERNAL_ERROR
    );
  }
  return ERROR_CODE_MESSAGES.INTERNAL_ERROR;
}
