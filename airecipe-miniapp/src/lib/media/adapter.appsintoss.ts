/**
 * 앱인토스 이미지 피커 어댑터 — SDK 직접 import 단일 위치(ADR-014 광고 어댑터 규약 동일).
 *
 * `fetchAlbumPhotos`/`openCamera`는 `@apps-in-toss/framework`의 **최상위 named export**다
 * (framework가 `@apps-in-toss/native-modules`를 `export *` 재노출 — index.d.ts:14, 런타임 실재).
 * ⚠ `AppsInToss` 객체에는 없다(`{ registerApp }`만) — 객체 경유 접근은 항상 undefined라
 *    isSupported가 false로 떨어져 noop 폴백 → "클릭해도 무반응" 버그가 됐었다.
 *
 * 반환형(실증): `ImageResponse = { id: string; dataUri: string }`.
 * `base64: true`로 호출 → `dataUri`는 prefix 없는 raw base64. normalizePicked가 data URI로 래핑한다.
 *   (base64:false면 file URI라 미리보기·백엔드 base64-in-JSON 업로드(ADR-021 D77) 모두 불가.)
 * 권한 거부 시 `*PermissionError` throw → null로 정규화(호출 측은 미선택과 동일 처리).
 *
 * 환경 분기는 index.ts에서 — 본 파일은 어댑터 구현만.
 */

import { fetchAlbumPhotos, openCamera } from '@apps-in-toss/framework';

import { normalizePicked } from './normalize';
import type { MediaAdapter, PickedImage } from './types';

export function createAppsInTossMediaAdapter(): MediaAdapter {
  return {
    isSupported: () => typeof fetchAlbumPhotos === 'function',
    pickFromAlbum: async (): Promise<PickedImage | null> => {
      try {
        const res = await fetchAlbumPhotos({
          maxCount: 1,
          maxWidth: 1024,
          base64: true,
        });
        return normalizePicked(res[0]?.dataUri);
      } catch {
        return null;
      }
    },
    pickFromCamera: async (): Promise<PickedImage | null> => {
      try {
        const res = await openCamera({ maxWidth: 1024, base64: true });
        return normalizePicked(res?.dataUri);
      } catch {
        return null;
      }
    },
  };
}
