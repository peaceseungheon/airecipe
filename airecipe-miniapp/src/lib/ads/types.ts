/**
 * 광고 어댑터 인터페이스 (의존성 역전 — Phase 4.5 baseline D26)
 *
 * SSOT: `_workspace/01_architect_phase45_baseline.md` §B D26.
 *
 * 책임:
 * - 토스 SDK(`@apps-in-toss/framework`) 또는 dev noop 구현이 본 인터페이스를 만족.
 * - SDK 직접 import는 `src/lib/ads/adapter.toss.ts` 1곳만 허용 — 다른 모든 파일은 본 모듈만 import.
 *
 * 이벤트 정규화 매핑(D32)은 어댑터 구현 측 책임.
 */

import type { ReactNode } from 'react';

/** 인라인 배너 컴포넌트의 외부 노출 props — SDK BannerSlotCallbacks 캡슐화(D33). */
export interface InlineAdSlotProps {
  /** 자체 식별자 — 로깅 구분용 (현재 단일 group ID지만 미래 다중 group 대비). */
  slot: string;
  theme?: 'auto' | 'light' | 'dark';
  tone?: 'blackAndWhite' | 'grey';
  variant?: 'expanded' | 'card';
}

/** 전면 광고 호출 결과(이벤트 정규화 매핑 — D32 §D). */
export type AdResult = 'shown' | 'dismissed' | 'failedToShow' | 'no_fill' | 'cancelled';

/** 어댑터 인터페이스 — toss/noop 두 구현이 만족. */
export interface AdsAdapter {
  /** 활성화 여부 — `import.meta.env.ADS_ENABLED === 'true'` && APP_ENV !== 'local' (D27). */
  isEnabled(): boolean;
  /** 인라인 배너 컴포넌트(또는 placeholder). 호출 측은 React JSX로 사용. */
  InlineAdSlot(props: InlineAdSlotProps): ReactNode;
  /** 전면 광고 — load → show를 1회 호출로 묶음. AbortSignal로 취소. */
  showFullScreen(options: { signal?: AbortSignal }): Promise<AdResult>;
}
