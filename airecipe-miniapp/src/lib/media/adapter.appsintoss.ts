/**
 * 앱인토스 이미지 피커 어댑터 — SDK 직접 import 단일 위치(ADR-014 광고 어댑터 규약 동일).
 *
 * 브리지(`AppsInToss.fetchAlbumPhotos`/`openCamera`)는 `.d.ts`에 타입 선언이 없어
 * 로컬 타입으로 선언한다(런타임 실재 — dist/index.js 2700·2703행 확인).
 * 디바이스 반환형(`{ id, dataUri }` 가정)은 실증 PENDING — normalizePicked가 dataUri/raw 모두 흡수.
 *
 * 환경 분기는 index.ts에서 — 본 파일은 어댑터 구현만.
 */

import { AppsInToss } from '@apps-in-toss/framework';

import { normalizePicked } from './normalize';
import type { MediaAdapter, PickedImage } from './types';

interface ImageBridgeResult {
  id?: string;
  dataUri?: string;
}

interface MediaBridges {
  fetchAlbumPhotos?: (opts: {
    maxCount?: number;
    maxWidth?: number;
    base64?: boolean;
  }) => Promise<ImageBridgeResult[] | ImageBridgeResult>;
  openCamera?: (opts: {
    maxWidth?: number;
    base64?: boolean;
  }) => Promise<ImageBridgeResult>;
}

const bridges = AppsInToss as unknown as MediaBridges;

function firstResult(
  r: ImageBridgeResult[] | ImageBridgeResult,
): ImageBridgeResult | null {
  if (Array.isArray(r)) return r[0] ?? null;
  return r ?? null;
}

export function createAppsInTossMediaAdapter(): MediaAdapter {
  return {
    isSupported: () => typeof bridges.fetchAlbumPhotos === 'function',
    pickFromAlbum: async (): Promise<PickedImage | null> => {
      if (typeof bridges.fetchAlbumPhotos !== 'function') return null;
      const res = await bridges.fetchAlbumPhotos({
        maxCount: 1,
        maxWidth: 1024,
        base64: false,
      });
      return normalizePicked(firstResult(res)?.dataUri);
    },
    pickFromCamera: async (): Promise<PickedImage | null> => {
      if (typeof bridges.openCamera !== 'function') return null;
      const res = await bridges.openCamera({ maxWidth: 1024, base64: false });
      return normalizePicked(res?.dataUri);
    },
  };
}
