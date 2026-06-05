/**
 * 로컬 dev 전용 미디어 어댑터 — 디바이스 사진 선택이 불가한 로컬 환경에서
 * 앨범/카메라 선택이 모두 고정 샘플 이미지(dev-fixture)를 반환한다.
 *
 * 목적: `APP_ENV === 'local'`에서 요리 기록 업로드(ADR-021)를 사진 선택 단계에
 * 막히지 않고 끝까지 테스트하기 위함. 운영 동작이 아니다.
 *
 * 환경 분기는 index.ts에서 — 본 파일은 어댑터 구현만(noop/appsintoss와 동일 규약).
 */

import { DEV_FIXTURE_DATA_URI } from './dev-fixture';
import { normalizePicked } from './normalize';
import type { MediaAdapter, PickedImage } from './types';

const fixture = (): Promise<PickedImage | null> =>
  Promise.resolve(normalizePicked(DEV_FIXTURE_DATA_URI));

export const devFixtureMediaAdapter: MediaAdapter = {
  isSupported: () => true,
  pickFromAlbum: fixture,
  pickFromCamera: fixture,
};
