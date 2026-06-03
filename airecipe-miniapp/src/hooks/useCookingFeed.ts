/**
 * useCookingFeed — 요리 기록 피드 목록 조회 훅 (useMyRecipes 미러).
 *
 * SSOT: 03 §3.8b.3 (GET /api/cooking-logs — raw `{ data: CookingLog[], meta }`).
 *       ADR-006(pageSize clamp 50) — `meta.pageSize` 신뢰.
 *
 * 책임:
 * 1. `listCookingLogs(query, auth)` 호출 → raw `{ data, meta }` 그대로 노출.
 * 2. `useCookingLogCacheTrigger.trigger`를 useEffect dep에 포함 — invalidate 시 자동 refetch.
 * 3. query/auth 변경 시 자동 refetch. 명시적 `refetch()` 함수도 노출.
 * 4. 401 자동 재시도는 apiFetch 단일 위치 — `refreshTossUserId: refresh` 주입만.
 * 5. unmount/query 변경 시 AbortController.abort + cancelled 플래그로 stale setState 차단.
 *
 * 사용 예 (frontend 피드 화면):
 *   const { data, meta, isLoading, error, refetch } = useCookingFeed({ page, pageSize: 10 });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, listCookingLogs } from '../services';
import type { ApiErrorCode, ListMeta } from '../types/api';
import type { CookingLog, CookingLogListQuery } from '../types/cooking-log';

import { useCookingLogCacheTrigger } from './useCookingLogCache';
import { useTossUserId } from './useTossUserId';

export interface UseCookingFeedResult {
  /** 본 페이지의 기록 배열. 초기/로딩 중에는 `[]`. */
  data: CookingLog[];
  /** 백엔드 적용 메타 — `total/page/pageSize`. 초기/로딩 중에는 null. */
  meta: ListMeta | null;
  isLoading: boolean;
  /** 실패 시 한국어 사용자 메시지. 성공 또는 초기 상태에서는 null. */
  error: string | null;
  /** 명시적 재조회. 캐시 trigger와 무관하게 본 훅만 다시 fetch. */
  refetch: () => void;
}

interface State {
  data: CookingLog[];
  meta: ListMeta | null;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_STATE: State = {
  data: [],
  meta: null,
  isLoading: true,
  error: null,
};

export function useCookingFeed(
  query: CookingLogListQuery,
): UseCookingFeedResult {
  const { tossUserId, refresh } = useTossUserId();
  const { trigger } = useCookingLogCacheTrigger();

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
    if (tossUserId === undefined) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    (async () => {
      try {
        const res = await listCookingLogs(query, {
          tossUserId,
          refreshTossUserId: refresh,
        });
        if (cancelled || controller.signal.aborted) return;
        setState({
          data: res.data,
          meta: res.meta,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: toUserMessage(err),
        }));
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
  }, [query.page, query.pageSize, tossUserId, refresh, trigger, refetchTick]);

  return {
    data: state.data,
    meta: state.meta,
    isLoading: state.isLoading,
    error: state.error,
    refetch,
  };
}

// ─── 사용자 친화 한국어 에러 메시지 매핑 (useMyRecipes와 동일 정책) ────────────

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
