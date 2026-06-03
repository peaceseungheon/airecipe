/**
 * useCookingLogDetail — 요리 기록 단건 조회 훅 (useRecipeDetail 미러).
 *
 * SSOT: 03 §3.8b.4 (GET /api/cooking-logs/[id] — 200 + `{ data: CookingLog }` / 404 통일).
 *       ADR-005(소유권 위반 404 수렴 — 없음·잘못된 id·타인 소유 모두 404).
 *
 * 책임:
 * 1. `getCookingLog(id, auth)` 호출 → 성공 시 `CookingLog` 1건 노출.
 * 2. **404 정규화**: `ApiClientError.error.code === 'NOT_FOUND'` → `notFound: true` (error는 null).
 * 3. id 변경 또는 명시적 `refetch()` 호출로 재조회.
 * 4. 401 자동 재시도는 apiFetch 단일 위치 — `refreshTossUserId: refresh` 주입만.
 * 5. unmount/id 변경 시 AbortController.abort + cancelled 플래그로 stale setState 차단.
 *
 * 사용 예 (frontend 상세 화면):
 *   const { data, isLoading, notFound, error, refetch } = useCookingLogDetail(id);
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, getCookingLog } from '../services';
import type { ApiErrorCode } from '../types/api';
import type { CookingLog } from '../types/cooking-log';

import { useTossUserId } from './useTossUserId';

export interface UseCookingLogDetailResult {
  /** 성공 시 CookingLog(id 포함). 초기/로딩/404/에러 시 null. */
  data: CookingLog | null;
  isLoading: boolean;
  /** ADR-005 통일: 없음·잘못된 id·타인 소유 모두 true. */
  notFound: boolean;
  /** 그 외 에러의 한국어 사용자 메시지. notFound와 동시 true 불가. */
  error: string | null;
  /** 명시적 재조회. id 변경 없이도 다시 fetch. */
  refetch: () => void;
}

interface State {
  data: CookingLog | null;
  isLoading: boolean;
  notFound: boolean;
  error: string | null;
}

const INITIAL_STATE: State = {
  data: null,
  isLoading: true,
  notFound: false,
  error: null,
};

export function useCookingLogDetail(
  id: string | undefined,
): UseCookingLogDetailResult {
  const { tossUserId, refresh } = useTossUserId();

  const [state, setState] = useState<State>(INITIAL_STATE);
  const [refetchTick, setRefetchTick] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTick((n) => n + 1);
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (id === undefined || tossUserId === undefined) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;
    setState({ ...INITIAL_STATE });

    (async () => {
      try {
        const data = await getCookingLog(id, {
          tossUserId,
          refreshTossUserId: refresh,
        });
        if (cancelled || controller.signal.aborted) return;
        setState({
          data,
          isLoading: false,
          notFound: false,
          error: null,
        });
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        if (err instanceof ApiClientError && err.error.code === 'NOT_FOUND') {
          setState({
            data: null,
            isLoading: false,
            notFound: true,
            error: null,
          });
        } else {
          setState({
            data: null,
            isLoading: false,
            notFound: false,
            error: toUserMessage(err),
          });
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, tossUserId, refresh, refetchTick]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    notFound: state.notFound,
    error: state.error,
    refetch,
  };
}

// ─── 사용자 친화 한국어 에러 메시지 매핑 (useRecipeDetail와 동일 정책) ─────────

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
