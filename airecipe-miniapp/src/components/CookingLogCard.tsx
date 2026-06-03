/**
 * CookingLogCard — 피드 카드(사진 + 요리명 + 별점 + 소감 스니펫) (ADR-021).
 *
 * SSOT: 06-UI-MAPPING(CookingLogCard), 설계 스펙 §7.5(FeedCard)·AC1.
 *
 * 실재 확인(rating barrel): public export는 `Rating`(단일)만 — `ReadOnlyRating` named export
 *   부재(.d.ts barrel 미노출). 표시형은 `Rating readonly`(= ReadOnlyRatingProps:
 *   value/variant:'full'|'compact'|'iconOnly'/size:'tiny'..'big'/max?). 계획 초안 정정.
 *
 * 책임:
 * - 단일 기록 요약 표시 + 탭 시 상세(`onPress`).
 * - presentational only(데이터/라우팅은 부모).
 *
 * 정책: 색은 TDS colors 토큰만(ADR-015 D39). photoUrl은 백엔드 presigned GET URL.
 */

import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Rating, Txt, colors } from '@toss/tds-react-native';

import type { CookingLog } from '../types/cooking-log';

export interface CookingLogCardProps {
  log: CookingLog;
  onPress: () => void;
}

export function CookingLogCard({ log, onPress }: CookingLogCardProps) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${log.recipe.dishName} 기록 보기`}
    >
      <Image source={{ uri: log.photoUrl }} style={styles.photo} />
      <View style={styles.body}>
        <Txt typography="t5" color={colors.grey900}>
          {log.recipe.dishName}
        </Txt>
        <Rating readonly value={log.rating} variant="compact" size="small" max={5} />
        <Txt typography="st9" color={colors.grey700} numberOfLines={2}>
          {log.review}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: colors.white,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.grey200,
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: colors.grey100,
  },
  body: {
    padding: 12,
    gap: 6,
  },
});
