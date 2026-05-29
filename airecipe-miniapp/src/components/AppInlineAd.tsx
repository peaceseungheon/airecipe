/**
 * AppInlineAd — 인라인 광고 합성 컴포넌트 (Phase 4.5 baseline D31)
 *
 * 책임:
 * - `ads.InlineAdSlot`을 위임 호출 — SDK 직접 import 0건.
 * - 외부에는 단일 `slot` prop만 노출(D33 — BannerSlotCallbacks 캡슐화).
 * - noop 환경에서는 placeholder, toss 환경에서는 실 InlineAd.
 *
 * 사용:
 *   <AppInlineAd slot="my-recipes-bottom" />
 *   <AppInlineAd slot="recipe-detail-bottom" variant="card" />
 */

import React from 'react';

import { ads, type InlineAdSlotProps } from '../lib/ads';

export type AppInlineAdProps = InlineAdSlotProps;

export function AppInlineAd(props: AppInlineAdProps) {
  return <>{ads.InlineAdSlot(props)}</>;
}
