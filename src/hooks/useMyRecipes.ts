/**
 * useMyRecipes — 마이 레시피 목록 조회 훅 (Phase 3)
 *
 * Baseline §A.1, §D.2.
 * SSOT: 03 §3.3 (GET /api/recipes — raw `{ data: Recipe[], meta: ListMeta }`).
 *       ADR-006(pageSize clamp 50) — `meta.pageSize` 신뢰.
 *       ADR-010 D5 — listRecipes만 raw 보존(meta.pageSize 신뢰 위해).
 *
 * 책임:
 * 1. `listRecipes(query, auth)` 호출 → raw `{ data, meta }` 그대로 노출 (§H.2 #14).
 * 2. `useRecipeCacheTrigger.trigger`를 useEffect dep에 포함 — invalidate 시 자동 refetch (§D.2).
 * 3. query/auth 변경 시 자동 refetch. 명시적 `refetch()` 함수도 노출.
 * 4. 401 자동 재시도는 apiFetch 단일 위치 (ADR-010 D3) — `refreshTossUserId: refresh` 주입만.
 * 5. unmount/query 변경 시 AbortController.abort + cancelled 플래그로 stale setState 차단 (§H.2 #17).
 *
 * 페이지네이션 정책 (baseline §A.5):
 * - 화면 측이 page state 관리(useState). pageSize 기본 20.
 * - 마지막 페이지 판정은 화면이 `meta.total`/`meta.pageSize`로 직접 계산.
 * - 빈 응답(`data:[]` + `meta.total:0`)은 200 — error 아닌 정상 분기, 화면이 EmptyState 렌더.
 *
 * 사용 예 (frontend `/my-recipes`):
 *   const { data, meta, isLoading, error, refetch } = useMyRecipes({ page, pageSize: 20 });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, listRecipes } from '../services';
import type {
  ApiErrorCode,
  ListMeta,
  RecipeListQuery,
} from '../types/api';
import type { Recipe } from '../types/recipe';

import { useRecipeCacheTrigger } from './useRecipeCache';
import { useTossUserId } from './useTossUserId';

export interface UseMyRecipesResult {
  /** 본 페이지의 레시피 배열. 초기/로딩 중에는 `[]`. */
  data: Recipe[];
  /** 백엔드 적용 메타 — `total/page/pageSize`. clamp 적용된 pageSize는 여기 신뢰. 초기/로딩 중에는 null. */
  meta: ListMeta | null;
  isLoading: boolean;
  /** 실패 시 한국어 사용자 메시지. 성공 또는 초기 상태에서는 null. */
  error: string | null;
  /** 명시적 재조회. 캐시 trigger와 무관하게 본 훅만 다시 fetch. */
  refetch: () => void;
}

interface State {
  data: Recipe[];
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

export function useMyRecipes(query: RecipeListQuery): UseMyRecipesResult {
  const { tossUserId, refresh } = useTossUserId();
  const { trigger } = useRecipeCacheTrigger();

  const [state, setState] = useState<State>(INITIAL_STATE);
  // 명시적 refetch 신호 — 단조 증가. cache trigger와 별개 dep.
  const [refetchTick, setRefetchTick] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTick((n) => n + 1);
  }, []);

  // unmount cleanup + 매 effect 사이클의 in-flight abort.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    // 식별자 미발급이면 호출 보류 — 화면 가드(§C.4)가 일반적으로 막지만 방어선.
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
        const res = await listRecipes(query, {
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
    // listRecipes(query, auth) 호출 dep — query primitive 분해 + tossUserId + trigger + refetchTick.
    // refresh는 useTossUserId가 useCallback으로 안정. trigger는 §D.2 패턴(invalidate 시 refetch).
  }, [
    query.favorite,
    query.page,
    query.pageSize,
    tossUserId,
    refresh,
    trigger,
    refetchTick,
  ]);

  return {
    data: state.data,
    meta: state.meta,
    isLoading: state.isLoading,
    error: state.error,
    refetch,
  };
}

// ─── 사용자 친화 한국어 에러 메시지 매핑 (useRecipeGenerate와 동일 정책) ────

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
