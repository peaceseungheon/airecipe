import { describe, expect, it } from '@jest/globals';

import { normalizePicked } from './normalize';

describe('normalizePicked', () => {
  it('data URI는 그대로 + mime 파싱', () => {
    expect(normalizePicked('data:image/png;base64,QQ==')).toEqual({
      dataUri: 'data:image/png;base64,QQ==',
      mimeType: 'image/png',
    });
  });

  it('raw base64는 jpeg로 prefix', () => {
    expect(normalizePicked('QUJD')).toEqual({
      dataUri: 'data:image/jpeg;base64,QUJD',
      mimeType: 'image/jpeg',
    });
  });

  it('빈 값은 null', () => {
    expect(normalizePicked(null)).toBeNull();
    expect(normalizePicked(undefined)).toBeNull();
    expect(normalizePicked('')).toBeNull();
  });
});
