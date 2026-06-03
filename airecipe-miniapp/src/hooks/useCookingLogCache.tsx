/**
 * useCookingLogCache — 요리 피드 목록 캐시 무효화 트리거 (useRecipeCache 미러).
 *
 * 책임:
 * 1. `trigger: number` 단조 증가 카운터를 Context로 노출.
 * 2. `invalidate()` 호출 → setState(n => n + 1) → 구독 훅(useCookingFeed)의 useEffect dep 변동 → refetch.
 * 3. 생성/삭제 성공 시 1회 호출.
 *
 * 마이 레시피 캐시(useRecipeCache)와 별 Context — 피드와 레시피 목록은 독립 무효화.
 *
 * 사용 예 — useCookingFeed:
 *   const { trigger } = useCookingLogCacheTrigger();
 *   useEffect(() => { fetch... }, [..., trigger]);
 *
 * 사용 예 — useCreateCookingLog / useDeleteCookingLog:
 *   const { invalidate } = useCookingLogCacheTrigger();
 *   await createCookingLog(...);
 *   invalidate();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export interface CookingLogCacheContextValue {
  /** 단조 증가 카운터. 구독 훅의 useEffect dep에 포함하여 invalidate 시 refetch 강제. */
  trigger: number;
  /** 호출 시 trigger를 +1. 생성/삭제 성공 시 1회 호출. */
  invalidate: () => void;
}

const CookingLogCacheContext =
  createContext<CookingLogCacheContextValue | null>(null);

export function CookingLogCacheProvider({ children }: PropsWithChildren) {
  const [trigger, setTrigger] = useState(0);
  const invalidate = useCallback(() => {
    setTrigger((n) => n + 1);
  }, []);

  const value = useMemo<CookingLogCacheContextValue>(
    () => ({ trigger, invalidate }),
    [trigger, invalidate],
  );

  return (
    <CookingLogCacheContext.Provider value={value}>
      {children}
    </CookingLogCacheContext.Provider>
  );
}

/**
 * Provider 하위에서만 호출 가능. Provider 누락 시 throw (useRecipeCacheTrigger 동일 패턴).
 */
export function useCookingLogCacheTrigger(): CookingLogCacheContextValue {
  const ctx = useContext(CookingLogCacheContext);
  if (ctx === null) {
    throw new Error(
      'useCookingLogCacheTrigger must be used within <CookingLogCacheProvider>',
    );
  }
  return ctx;
}
