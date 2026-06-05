/**
 * AppInlineAd — 인라인 광고 합성 컴포넌트 (Phase 4.5 baseline D31)
 *
 * 책임:
 * - `ads.InlineAdSlot`을 위임 호출 — SDK 직접 import 0건.
 * - 외부에는 단일 `slot` prop만 노출(D33 — BannerSlotCallbacks 캡슐화).
 * - noop 환경에서는 placeholder, toss 환경에서는 실 InlineAd.
 *
 * ADR-022 rev.2: 운영 빌드 실기기에서 toss `InlineAd` 렌더가 앱 전체를 죽이는(검정 화면)
 *   사례가 확인됨 → **에러 바운더리로 감싸 광고 렌더 실패가 앱을 크래시시키지 않게** 한다.
 *   광고 렌더 중 JS 예외가 던져지면 배너만 숨기고(null) 화면은 정상 유지한다.
 *   (네이티브 레벨 크래시는 JS 바운더리로 못 잡으므로, 그 경우는 콘솔 등록·승인·버전 문제로 별도 처리.)
 *
 * 사용:
 *   <AppInlineAd slot="my-recipes-bottom" />
 *   <AppInlineAd slot="recipe-detail-bottom" variant="card" />
 */

import React from 'react';

import { ads, type InlineAdSlotProps } from '../lib/ads';

export type AppInlineAdProps = InlineAdSlotProps;

interface AdErrorBoundaryState {
  failed: boolean;
}

/** 광고 렌더 실패 격리 — InlineAd가 throw해도 앱 전체가 죽지 않도록 배너만 숨긴다(ADR-022 rev.2). */
class AdErrorBoundary extends React.Component<
  React.PropsWithChildren<{ slot: string }>,
  AdErrorBoundaryState
> {
  state: AdErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AdErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (typeof console !== 'undefined') {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[ads] InlineAd 렌더 실패 — 배너 숨김 (slot=${this.props.slot}): ${message}`);
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function AppInlineAd(props: AppInlineAdProps) {
  return <AdErrorBoundary slot={props.slot}>{ads.InlineAdSlot(props)}</AdErrorBoundary>;
}
