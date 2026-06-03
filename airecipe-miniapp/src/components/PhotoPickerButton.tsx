/**
 * PhotoPickerButton — 요리 사진 선택 버튼 + 미리보기 (ADR-021).
 *
 * SSOT: 06-UI-MAPPING(PhotoPickerButton), 설계 스펙 §7.5·§8.
 *
 * 책임:
 * - `media.pickFromAlbum()`(앱인토스 이미지 브리지 격리 어댑터) 호출 → PickedImage 미리보기.
 * - SDK 직접 import 0건 — `../lib/media`의 `media` 객체만 사용(ADR-014 광고 어댑터 규약 동일).
 * - local/미지원 환경(noop 어댑터)에서는 null 반환 → 안내 문구 유지.
 *
 * presentational + onPick 콜백. 검증/제출은 부모(CookingLogForm) 책임(SRP).
 */

import React, { useCallback } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, Txt, colors } from '@toss/tds-react-native';

import { media, type PickedImage } from '../lib/media';

export interface PhotoPickerButtonProps {
  value: PickedImage | null;
  onPick: (img: PickedImage) => void;
}

export function PhotoPickerButton({ value, onPick }: PhotoPickerButtonProps) {
  const pick = useCallback(async () => {
    const img = await media.pickFromAlbum();
    if (img) onPick(img);
  }, [onPick]);

  return (
    <View style={styles.box}>
      {value ? (
        <Image
          source={{ uri: value.dataUri }}
          style={styles.preview}
          accessibilityLabel="선택한 요리 사진"
        />
      ) : (
        <View style={styles.placeholder}>
          <Txt typography="st9" color={colors.grey500}>
            요리 사진을 추가해 주세요
          </Txt>
        </View>
      )}
      <Button type="light" style="weak" display="block" size="medium" onPress={pick}>
        {value ? '사진 변경' : '사진 선택'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 8,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.grey100,
  },
  placeholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
