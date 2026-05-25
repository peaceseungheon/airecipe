/**
 * 광고 어댑터 환경 분기 (Phase 4.5 baseline D27·E)
 *
 * 분기 정책:
 * - APP_ENV === 'local' → 항상 noop (dev 광고 호출 차단).
 * - ADS_ENABLED !== 'true' → noop (광고 비활성).
 * - 그 외 → toss 어댑터(빌드 시점 주입된 group ID 포함).
 *
 * 호출 측은 본 모듈의 `ads` 객체만 사용 — 다른 어떤 파일도 어댑터 구현을 직접 import 금지.
 */

import { noopAdsAdapter } from './adapter.noop';
import { createTossAdsAdapter } from './adapter.toss';
import type { AdsAdapter } from './types';

function selectAdapter(): AdsAdapter {
  const env = import.meta.env;
  if (env.APP_ENV === 'local') return noopAdsAdapter;
  if (env.ADS_ENABLED !== 'true') return noopAdsAdapter;
  return createTossAdsAdapter({
    inlineGroupId: env.ADS_INLINE_GROUP_ID ?? '',
    fullScreenGroupId: env.ADS_FULLSCREEN_GROUP_ID ?? '',
  });
}

export const ads: AdsAdapter = selectAdapter();

export type { AdResult, AdsAdapter, InlineAdSlotProps } from './types';
