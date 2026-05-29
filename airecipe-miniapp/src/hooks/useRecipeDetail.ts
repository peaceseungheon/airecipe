/**
 * useRecipeDetail — 레시피 단건 조회 훅 (Phase 3)
 *
 * Baseline §A.1, §D.5.
 * SSOT: 03 §3.4 (GET /api/recipes/[id] — 200 + `{ data: Recipe }` / 404 통일).
 *       ADR-004(딥링크·새로고침 지원 — 목록 캐시 의존 제거).
 *       ADR-005(소유권 위반 404 수렴 — 없음·잘못된 id·타인 소유 모두 404).
 *
 * 책임:
 * 1. `getRecipe(id, auth)` 호출 → 성공 시 `Recipe` 1건 노출.
 * 2. **404 정규화**: `ApiClientError.error.code === 'NOT_FOUND'` → `notFound: true` state (error는 null).
 *    그 외 에러는 `error` state에 한국어 메시지 노출. 화면 측은 `notFound`로 `<NotFoundScreen />` 분기.
 * 3. id 변경 또는 명시적 `refetch()` 호출로 재조회. 캐시 trigger는 dep에 포함하지 않음 (§D.5).
 * 4. 401 자동 재시도는 apiFetch 단일 위치 (ADR-010 D3) — `refreshTossUserId: refresh` 주입만.
 * 5. unmount/id 변경 시 AbortController.abort + cancelled 플래그로 stale setState 차단 (§H.2 #17).
 *
 * 사용 예 (frontend `/recipe/[id]`):
 *   const { data, isLoading, notFound, error, refetch } = useRecipeDetail(id);
 *   if (isLoading) return <Loading />;
 *   if (notFound) return <NotFoundScreen onBack={() => navigation.goBack()} />;
 *   if (error) return <ErrorBox message={error} onRetry={refetch} />;
 *   return <RecipeDisplay recipe={data!} />;
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, getRecipe } from '../services';
import type { ApiErrorCode } from '../types/api';
import type { Recipe } from '../types/recipe';

import { useTossUserId } from './useTossUserId';

export interface UseRecipeDetailResult {
  /** 성공 시 저장된 Recipe(id 포함). 초기/로딩/404/에러 시 null. */
  data: Recipe | null;
  isLoading: boolean;
  /** ADR-005 통일: 없음·잘못된 id·타인 소유 모두 true. 화면이 NotFoundScreen 렌더. */
  notFound: boolean;
  /** 그 외 에러의 한국어 사용자 메시지. notFound와 동시 true 불가. */
  error: string | null;
  /** 명시적 재조회. id 변경 없이도 다시 fetch. */
  refetch: () => void;
  /**
   * Phase 4 추가 (baseline §B D5·ADR-013 D20):
   * PATCH favorite 성공 응답을 호출 측이 받아 직접 state 갱신 — refetch GET 1회 회피.
   * 동기·즉시성(낙관적 UI 확정), 트래픽 절약 모두 우월.
   */
  mutate: (next: Recipe) => void;
}

interface State {
  data: Recipe | null;
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

export function useRecipeDetail(id: string): UseRecipeDetailResult {
  const { tossUserId, refresh } = useTossUserId();

  const [state, setState] = useState<State>(INITIAL_STATE);
  const [refetchTick, setRefetchTick] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTick((n) => n + 1);
  }, []);

  const mutate = useCallback((next: Recipe) => {
    // Phase 4 D5/D20: PATCH 응답 Recipe로 직접 state 갱신. notFound/error 초기화.
    setState({
      data: next,
      isLoading: false,
      notFound: false,
      error: null,
    });
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
    setState({ ...INITIAL_STATE });

    (async () => {
      try {
        const recipe = await getRecipe(id, {
          tossUserId,
          refreshTossUserId: refresh,
        });
        if (cancelled || controller.signal.aborted) return;
        setState({
          data: recipe,
          isLoading: false,
          notFound: false,
          error: null,
        });
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        // 404 정규화 — ADR-005 통일. 다른 에러는 error state.
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
    // §D.5: trigger를 dep에 포함하지 않음 — 상세는 id 단건이라 마이 목록 invalidate와 의미 다름.
  }, [id, tossUserId, refresh, refetchTick]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    notFound: state.notFound,
    error: state.error,
    refetch,
    mutate,
  };
}

// ─── 사용자 친화 한국어 에러 메시지 매핑 (useRecipeGenerate와 동일 정책) ────
// NOT_FOUND는 notFound state로 분기되므로 매핑 표에는 남기되 통상 사용되지 않음.

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
