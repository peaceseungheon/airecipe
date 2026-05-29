/**
 * RecommendationCard — 추천 카드 1장 (Phase 6 / ADR-016 D45).
 *
 * SSOT: 06-UI-MAPPING §6.10, 03-API-CONTRACT §3.8.3.
 *
 * 책임:
 * - 추천 아이템 1건(dishName·description·tags)을 카드 형태로 표시.
 * - 카드 전체가 Pressable — onPress 콜백으로 `/recipe/generate?dishName=...` 진입을 부모가 결정.
 * - 추천은 ephemeral(id 없음) — `recipe.id` 접근 금지(RecipeCard와 다름).
 *
 * 불변식:
 * - presentational only — fetch/useState/useEffect 사용 금지.
 * - tags는 최대 5개(zod 강제) — Badge 단순 렌더.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Txt, colors } from '@toss/tds-react-native';

import type { RecommendationItem } from '../types/api';

export interface RecommendationCardProps {
  item: RecommendationItem;
  onPress: () => void;
}

export function RecommendationCard({ item, onPress }: RecommendationCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.dishName} 레시피 생성`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Txt typography="t5" color={colors.grey900} numberOfLines={1}>
        {item.dishName}
      </Txt>
      <Txt typography="st9" color={colors.grey700} numberOfLines={2}>
        {item.description}
      </Txt>
      {item.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {item.tags.map((tag) => (
            <Badge key={tag} size="tiny" type="elephant" badgeStyle="weak">
              {tag}
            </Badge>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    gap: 10,
  },
  cardPressed: {
    backgroundColor: colors.grey100,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
