/**
 * 브리지 반환값을 표준 PickedImage로 정규화 (순수 함수 — 테스트 대상).
 *
 * - 이미 data URI면 그대로 + mime 파싱.
 * - raw base64로 추정되면 jpeg로 가정해 prefix.
 * - 빈 값은 null.
 */

import type { PickedImage } from './types';

export function normalizePicked(
  raw: string | null | undefined,
): PickedImage | null {
  if (!raw) return null;
  if (raw.startsWith('data:')) {
    const mime = /^data:([^;]+);/.exec(raw)?.[1] ?? 'image/jpeg';
    return { dataUri: raw, mimeType: mime };
  }
  return { dataUri: `data:image/jpeg;base64,${raw}`, mimeType: 'image/jpeg' };
}
