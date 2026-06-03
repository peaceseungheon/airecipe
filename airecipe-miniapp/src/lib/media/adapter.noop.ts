/**
 * 로컬/미지원 환경 placeholder 어댑터 — 실제 선택 불가, null 반환(ADR-014 noop 규약 동일).
 */

import type { MediaAdapter } from './types';

export const noopMediaAdapter: MediaAdapter = {
  isSupported: () => false,
  pickFromAlbum: async () => null,
  pickFromCamera: async () => null,
};
