/**
 * useTossUserId — Toss 익명 식별자(hash) 발급·캐싱·재발급·Context
 *
 * Baseline: §A.7, §B.2, §C.2, §C.3.
 * SSOT: 05-AUTH §5.2.1 (라인 67~84), §5.2.3 (라인 118), §5.4 (라인 287~308), §5.10 (라인 520).
 *       09-ENV-CONFIG §9.5 (라인 221).
 *
 * 책임:
 * 1. `getAnonymousKey()` SDK 호출(미니앱 진입 시 1회 + 401 시 재발급).
 * 2. 메모리 캐싱(모듈 스코프) — SecureStore는 Phase 1 보류(baseline §C.2).
 * 3. 응답 hash zod 검증(`z.string().min(8).max(256)`, 05 §5.2.3).
 * 4. React Context Provider + 훅으로 노출. api-client는 SDK를 직접 import하지 않고,
 *    이 훅이 반환한 hash를 인자로 받는다(DIP — baseline §A.7 끝 단언).
 * 5. hash는 UI/로깅에 평문 노출 금지(09 §9.5 라인 221, 05 §5.10 라인 520).
 */

// ─── SDK import — 단일 줄 격리(baseline §B.2). 패키지 경로 변동 시 1행만 수정. ──
// 사양(05 §5.2.1 라인 73)은 `@apps-in-toss/web-framework`. 현 package.json은
// `@apps-in-toss/framework@^2.6.0`만 보유 — 첫 실 호출 검증 단계에서 미해결 시
// architect에게 SendMessage하고 baseline §B.2 갱신(추측 변경 금지).
// @ts-expect-error — Phase 1 baseline §B.2: 패키지 경로 미확정. 실행 단계에서 검증.
import { getAnonymousKey } from '@apps-in-toss/web-framework';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { z } from 'zod';

import type { TossUserId } from '../types/user';

// ─── hash 검증 — 05 §5.2.3 라인 118 (백엔드 미들웨어와 동일 검증) ────────────

const tossUserIdSchema = z.string().min(8).max(256);

// ─── 모듈 스코프 캐시 (baseline §C.2 — 메모리 채택) ─────────────────────────

let cachedTossUserId: TossUserId | undefined;

/**
 * SDK를 1회 호출하여 hash를 발급받고 캐시에 보관한다.
 *
 * - 부적합 hash(길이 위반 등)는 캐시에 두지 않고 throw → 호출부가 UI 에러로 변환.
 * - SDK 호출 자체는 본 함수 1곳에만 존재(SRP + DIP). 다른 모듈은 본 훅을 통해서만 접근.
 */
async function fetchAndCacheTossUserId(): Promise<TossUserId> {
  const raw: unknown = await getAnonymousKey();
  const parsed = tossUserIdSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('TOSS_USER_ID_INVALID');
  }
  cachedTossUserId = parsed.data;
  return parsed.data;
}

// ─── Context 정의 ───────────────────────────────────────────────────────────

export interface TossUserIdContextValue {
  /** 발급 완료 전(또는 초기 마운트 직후)에는 undefined. */
  tossUserId: TossUserId | undefined;
  /**
   * 401 응답 후 SDK 재호출 → 캐시 교체 후 새 hash 반환. (05 §5.4)
   *
   * 새 hash를 반환하는 이유: api-client의 401 재시도(`refreshTossUserId: () => Promise<string>`)는
   * 동일 tick에서 새 hash를 헤더에 부착해야 하는데 React Context state는 비동기 갱신이라
   * 다음 렌더 전에는 `tossUserId` 값이 stale이다. `refresh()`가 직접 hash를 반환해 갭을 메운다.
   */
  refresh: () => Promise<TossUserId>;
}

const TossUserIdContext = createContext<TossUserIdContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

/**
 * 미니앱 진입 시 1회 `getAnonymousKey()`를 호출하여 hash를 캐시·노출한다.
 *
 * - 마운트 시 캐시 보유 분이 있으면 그대로 사용(콜드 스타트 후에도 동일 hash 가정 — 05 §5.4).
 * - 캐시가 없으면 SDK 호출 1회. 실패 시 `tossUserId`는 undefined 유지 — 호출부는
 *   undefined일 때 보호 호출을 보류해야 한다(baseline §A.4: tossUserId가 주어지면 헤더 부착).
 */
export function TossUserIdProvider({ children }: PropsWithChildren) {
  const [tossUserId, setTossUserId] = useState<TossUserId | undefined>(cachedTossUserId);

  const refresh = useCallback(async () => {
    cachedTossUserId = undefined;
    const fresh = await fetchAndCacheTossUserId();
    setTossUserId(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    if (cachedTossUserId !== undefined) {
      return;
    }
    let cancelled = false;
    fetchAndCacheTossUserId()
      .then((hash) => {
        if (!cancelled) setTossUserId(hash);
      })
      .catch(() => {
        // 실패 로깅에 hash가 포함되지 않으므로 무해(09 §9.5 라인 221).
        // 사용자 토스트는 호출부 책임(05 §5.4 라인 291).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<TossUserIdContextValue>(
    () => ({ tossUserId, refresh }),
    [tossUserId, refresh],
  );

  return <TossUserIdContext.Provider value={value}>{children}</TossUserIdContext.Provider>;
}

// ─── 훅 ─────────────────────────────────────────────────────────────────────

/**
 * Provider 하위에서만 호출 가능. Provider 누락 시 throw.
 */
export function useTossUserId(): TossUserIdContextValue {
  const ctx = useContext(TossUserIdContext);
  if (ctx === null) {
    throw new Error('useTossUserId must be used within <TossUserIdProvider>');
  }
  return ctx;
}

// ─── 디버그 유틸 — hash 평문 노출 금지(09 §9.5 라인 221) ────────────────────

/**
 * hash를 로그·화면에 표시할 때는 본 헬퍼만 사용한다.
 * 길이와 마스킹 prefix만 노출하여 평문이 누출되지 않게 한다.
 */
export function formatTossUserIdMask(hash: TossUserId | undefined): string {
  if (!hash) return '(none)';
  const head = hash.slice(0, 2);
  return `len=${hash.length} head=${head}…`;
}
