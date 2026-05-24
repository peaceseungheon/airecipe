/**
 * useRecipeCache — 마이 레시피 목록 캐시 무효화 트리거 (Phase 3)
 *
 * Baseline §D.1·D.2 채택안 (대안 (a) Context + bump key).
 *
 * 책임:
 * 1. `trigger: number` 단조 증가 카운터를 Context로 노출.
 * 2. `invalidate()` 호출 → setState(n => n + 1) → 모든 구독 훅의 useEffect dep 변동 → refetch.
 * 3. SWR/RQ 미도입 정합 (ADR-010·011 의존성 표 그대로). 번들 영향 0.
 *
 * 비범위 (다음 Phase 트리거):
 * - 키별(id별) 부분 무효화 — 본 Phase는 단일 trigger로 충분. 키별 필요 시 별 ADR.
 * - focus 기반 자동 refetch — baseline §D.1 (c) 기각.
 *
 * 사용 예 — useMyRecipes:
 *   const { trigger } = useRecipeCacheTrigger();
 *   useEffect(() => { fetch... }, [..., trigger]);  // ← dep에 포함
 *
 * 사용 예 — useSaveRecipe:
 *   const { invalidate } = useRecipeCacheTrigger();
 *   await saveRecipe(...);
 *   invalidate();  // 성공 시 1회
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export interface RecipeCacheContextValue {
  /** 단조 증가 카운터. 구독 훅의 useEffect dep에 포함하여 invalidate 시 refetch 강제. */
  trigger: number;
  /** 호출 시 trigger를 +1. 저장/즐겨찾기/삭제 성공 시 1회 호출. */
  invalidate: () => void;
}

const RecipeCacheContext = createContext<RecipeCacheContextValue | null>(null);

export function RecipeCacheProvider({ children }: PropsWithChildren) {
  const [trigger, setTrigger] = useState(0);
  const invalidate = useCallback(() => {
    setTrigger((n) => n + 1);
  }, []);

  const value = useMemo<RecipeCacheContextValue>(
    () => ({ trigger, invalidate }),
    [trigger, invalidate],
  );

  return (
    <RecipeCacheContext.Provider value={value}>{children}</RecipeCacheContext.Provider>
  );
}

/**
 * Provider 하위에서만 호출 가능. Provider 누락 시 throw (useTossUserId 동일 패턴).
 */
export function useRecipeCacheTrigger(): RecipeCacheContextValue {
  const ctx = useContext(RecipeCacheContext);
  if (ctx === null) {
    throw new Error(
      'useRecipeCacheTrigger must be used within <RecipeCacheProvider>',
    );
  }
  return ctx;
}
