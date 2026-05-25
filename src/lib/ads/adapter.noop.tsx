/**
 * Dev/disabled 환경 placeholder 어댑터 (Phase 4.5 baseline D27·D29)
 *
 * 책임:
 * - SDK 호출 0건. 인라인은 회색 placeholder(TDS View+Txt만), 전면은 즉시 `'dismissed'` resolve.
 * - placeholder UI도 TDS 위에 — 검수 정책 §9.6 준수.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt, colors } from '@toss/tds-react-native';

import type { AdsAdapter, InlineAdSlotProps } from './types';

function NoopInlineAdSlot({ slot, variant = 'expanded' }: InlineAdSlotProps) {
  return (
    <View style={[styles.placeholder, variant === 'card' && styles.placeholderCard]}>
      <Txt typography="st9" color={colors.grey500}>
        광고 영역 (dev · {slot})
      </Txt>
    </View>
  );
}

export const noopAdsAdapter: AdsAdapter = {
  isEnabled() {
    return false;
  },
  InlineAdSlot: NoopInlineAdSlot,
  async showFullScreen({ signal } = {}) {
    if (signal?.aborted) return 'cancelled';
    if (typeof console !== 'undefined') {
      console.debug('[ads:noop] showFullScreen() — noop, resolving as dismissed');
    }
    return 'dismissed';
  },
};

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    minHeight: 80,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderStyle: 'dashed',
    backgroundColor: colors.grey50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderCard: {
    minHeight: 120,
  },
});
