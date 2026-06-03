/**
 * useCreateCookingLog — 요리 기록 생성 mutation 훅 (useSaveRecipe 미러).
 *
 * SSOT: 03 §3.8b.2 (POST /api/cooking-logs — 201 + `{ data: CookingLog }`).
 *
 * 책임:
 * 1. `createCookingLog(req, auth)` 호출 → 성공 시 저장된 `CookingLog`(id 포함) 반환.
 * 2. 성공 시 `useCookingLogCacheTrigger.invalidate()` 1회 — 피드 refetch 강제.
 * 3. 401 자동 재시도는 apiFetch 단일 위치 — `refreshTossUserId: refresh` 주입만.
 * 4. unmount 시 AbortController.abort + cancelled 플래그로 stale setState 차단.
 *
 * 사용 예 (frontend 업로드 폼):
 *   const { create, isSaving, error } = useCreateCookingLog();
 *   const saved = await create(req);
 *   if (saved) navigation.navigate('/cooking-log/:id', { id: saved.id });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, createCookingLog } from '../services';
import type { ApiErrorCode } from '../types/api';
import type {
  CookingLog,
  CreateCookingLogRequest,
} from '../types/cooking-log';

import { useCookingLogCacheTrigger } from './useCookingLogCache';
import { useTossUserId } from './useTossUserId';

export interface UseCreateCookingLogResult {
  /** 저장 진행 중 — 버튼 disabled / Spinner 노출. */
  isSaving: boolean;
  /** 실패 시 한국어 사용자 메시지. 성공 또는 초기 상태에서는 null. */
  error: string | null;
  /**
   * 생성 시도. 성공 시 저장된 CookingLog(id 포함) 반환 + invalidate. 실패 시 null + error state.
   * 식별자 미발급 상태에서는 즉시 한국어 에러 + null.
   */
  create: (req: CreateCookingLogRequest) => Promise<CookingLog | null>;
  /** error/isSaving 초기화. "다시 시도" 버튼 직전 호출. */
  reset: () => void;
}

export function useCreateCookingLog(): UseCreateCookingLogResult {
  const { tossUserId, refresh } = useTossUserId();
  const { invalidate } = useCookingLogCacheTrigger();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setIsSaving(false);
    setError(null);
  }, []);

  const create = useCallback(
    async (req: CreateCookingLogRequest): Promise<CookingLog | null> => {
      if (tossUserId === undefined) {
        setError(ERROR_CODE_MESSAGES.UNAUTHORIZED);
        return null;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSaving(true);
      setError(null);

      try {
        const saved = await createCookingLog(req, {
          tossUserId,
          refreshTossUserId: refresh,
        });
        if (cancelledRef.current || controller.signal.aborted) {
          return null;
        }
        invalidate();
        setIsSaving(false);
        return saved;
      } catch (err) {
        if (cancelledRef.current || controller.signal.aborted) {
          return null;
        }
        setError(toUserMessage(err));
        setIsSaving(false);
        return null;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [tossUserId, refresh, invalidate],
  );

  return { isSaving, error, create, reset };
}

// ─── 사용자 친화 한국어 에러 메시지 매핑 (useSaveRecipe와 동일 정책) ──────────

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
