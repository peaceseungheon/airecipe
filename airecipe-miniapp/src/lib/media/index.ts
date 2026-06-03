/**
 * 이미지 피커 어댑터 환경 분기 (ADR-014 광고 어댑터 규약 동일).
 *
 * - APP_ENV === 'local' → noop (dev 브리지 호출 차단).
 * - 그 외 → 앱인토스 어댑터. 브리지 미지원이면 noop 폴백.
 *
 * 호출 측은 본 모듈의 `media` 객체만 사용 — 다른 파일은 어댑터 구현을 직접 import 금지.
 */

import { createAppsInTossMediaAdapter } from './adapter.appsintoss';
import { noopMediaAdapter } from './adapter.noop';
import type { MediaAdapter } from './types';

function selectAdapter(): MediaAdapter {
  if (import.meta.env.APP_ENV === 'local') return noopMediaAdapter;
  const adapter = createAppsInTossMediaAdapter();
  return adapter.isSupported() ? adapter : noopMediaAdapter;
}

export const media: MediaAdapter = selectAdapter();

export type { MediaAdapter, PickedImage } from './types';
