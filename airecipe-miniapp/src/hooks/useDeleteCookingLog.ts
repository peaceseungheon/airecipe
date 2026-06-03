/**
 * useDeleteCookingLog — 요리 기록 삭제 DELETE 훅 (useDeleteRecipe 미러).
 *
 * SSOT: 03 §3.8b.5 (DELETE /api/cooking-logs/[id] — 200 + `{ data: { id } }` / 404 "이미 삭제됨").
 *
 * 책임:
 * 1. `deleteCookingLog(id, auth)` 호출 (cooking-logs.ts 단일 경로).
 * 2. **404 성공 정규화**: `ApiClientError.error.code === 'NOT_FOUND'` → 성공으로 변환(멱등).
 * 3. 성공·404 정규화 모두 `useCookingLogCacheTrigger.invalidate()` 1회.
 * 4. 401 자동 재시도는 apiFetch 단일 위치 — `refresh` 주입만.
 * 5. 직전 in-flight abort + cancelled 플래그.
 *
 * 반환:
 *   { remove: () => Promise<boolean>, isPending, error, reset }
 *   - true: 성공·404 정규화 (호출 측이 navigate)
 *   - false: 실패 (호출 측이 error state 노출)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, deleteCookingLog } from '../services';
import type { ApiErrorCode } from '../types/api';

import { useCookingLogCacheTrigger } from './useCookingLogCache';
import { useTossUserId } from './useTossUserId';

export interface UseDeleteCookingLogResult {
  remove: () => Promise<boolean>;
  isPending: boolean;
  error: string | null;
  reset: () => void;
}

export function useDeleteCookingLog(id: string): UseDeleteCookingLogResult {
  const { tossUserId, refresh } = useTossUserId();
  const { invalidate } = useCookingLogCacheTrigger();

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
      await deleteCookingLog(id, { tossUserId, refreshTossUserId: refresh });
      if (controller.signal.aborted) return false;
      invalidate();
      return true;
    } catch (err) {
      if (controller.signal.aborted) return false;
      // 404 성공 정규화 — "이미 삭제됨"으로 처리. 메시지 0건.
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
  NOT_FOUND: '기록을 찾을 수 없어요.',
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
