/**
 * TopAdBanner — 화면 상단 고정 배너 광고 (ADR-022 rev.2).
 *
 * SSOT: 11-ADS §11.5.1, ADR-022, ADR-014 D27(환경 게이트)·D31(AppInlineAd).
 *
 * 배경(ADR-022 rev.1 철회): `_app.tsx`에서 네비게이터 위(앱 루트)에 InlineAd를 마운트했더니
 *   TDSProvider·네비게이션 컨텍스트 **바깥**이라 빌드 앱이 검정 화면으로 크래시했다. 토스 `InlineAd`는
 *   반드시 **화면(스크린) 안**에서 렌더해야 한다 → 본 컴포넌트를 각 화면이 직접 마운트한다
 *   (BottomTabBar와 동일한 화면-내 마운트 패턴).
 *
 * 책임:
 * - 각 화면이 `PageNavbar` 바로 아래, 스크롤 영역 밖에 `<TopAdBanner />`를 1줄 마운트 → 상단 고정.
 * - `ads.isEnabled()`(ADR-014 D27: local·`ADS_ENABLED!=='true'`면 false)가 false면 `null` 렌더
 *   → dev/비활성에서 placeholder·공간 0(회귀 0).
 * - SDK 직접 import 0건 — `AppInlineAd`(→ `ads`)만(ADR-014 D26).
 */

import React from 'react';

import { ads } from '../lib/ads';
import { AppInlineAd } from './AppInlineAd';

export interface TopAdBannerProps {
  /** 로깅 구분용 슬롯 식별자 (현재 단일 group ID). 기본 'global-top'. */
  slot?: string;
}

export function TopAdBanner({ slot = 'global-top' }: TopAdBannerProps) {
  // 광고 비활성 시 아무것도 렌더하지 않음(공간 0·회귀 0).
  if (!ads.isEnabled()) {
    return null;
  }
  return <AppInlineAd slot={slot} />;
}
