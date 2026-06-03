/**
 * 이미지 피커 어댑터 인터페이스 — 앱인토스 이미지 브리지 격리(ADR-014 광고 어댑터 규약 동일).
 *
 * PickedImage: 정규화된 선택 결과 — base64 data URI + mime.
 * MediaAdapter: 앨범/카메라 선택. local/미지원 환경은 noop.
 */

export interface PickedImage {
  /** "data:image/jpeg;base64,..." */
  dataUri: string;
  /** "image/jpeg" */
  mimeType: string;
}

export interface MediaAdapter {
  isSupported(): boolean;
  pickFromAlbum(): Promise<PickedImage | null>;
  pickFromCamera(): Promise<PickedImage | null>;
}
