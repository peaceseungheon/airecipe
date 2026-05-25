/**
 * RecipeCard — 마이 레시피 목록 1건 카드.
 *
 * SSOT: 06-UI-MAPPING §6.4.4, baseline §A.2·§B.2.
 *
 * 책임:
 * - 저장된 Recipe(id 포함) 1건을 카드 형태로 표시.
 * - 카드 전체가 Pressable — onPress 콜백으로 상세 진입을 부모(`pages/my-recipes.tsx`)가 결정.
 * - 즐겨찾기·삭제 액션은 Phase 4 — 본 Phase는 자리표시 prop만 받고 미렌더.
 *
 * 불변식:
 * - presentational only — fetch/useState/useEffect 사용 금지(콜백 위임 — components/AGENTS.md).
 * - `recipe.id` 사용 OK (baseline §H.2 #11) — 저장된 Recipe 한정.
 * - Tailwind/`href`/`useRouter`/`<Link>` 0건.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Txt } from '@toss/tds-react-native';

import { FavoriteButton } from './FavoriteButton';
import {
  difficultyLabel,
  difficultyTone,
  formatCookTime,
  formatServings,
} from './recipe-format';
import type { Recipe } from '../types/recipe';

export interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
  /**
   * Phase 4(ADR-013 D7): 카드 측 활성화. 목표값(`!recipe.isFavorite`) 전달 — 멱등 계약 4.1.
   * 부모(`pages/my-recipes.tsx`)가 낙관적 UI + 호출 후 실패 시 rollback 책임 (D4).
   */
  onToggleFavorite?: (target: boolean) => void;
  /** Phase 4(ADR-013 D7): 본 Phase는 자리표시 prop만 유지 — 카드 측 삭제 미활성화(상세 화면만). */
  onDelete?: () => void;
  /** 즐겨찾기 토글 진행 중 — FavoriteButton disabled 처리. */
  favoritePending?: boolean;
}

export function RecipeCard({
  recipe,
  onPress,
  onToggleFavorite,
  favoritePending,
}: RecipeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.dishName} 상세 보기`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <Txt typography="t5" color="#191F28" numberOfLines={1} style={styles.title}>
          {recipe.dishName}
        </Txt>
        {onToggleFavorite ? (
          <FavoriteButton
            isFavorite={recipe.isFavorite}
            onToggle={onToggleFavorite}
            pending={favoritePending}
          />
        ) : null}
      </View>

      {recipe.description ? (
        <Txt typography="st9" color="#4E5968" numberOfLines={2}>
          {recipe.description}
        </Txt>
      ) : null}

      <View style={styles.badgeRow}>
        <DifficultyBadge difficulty={recipe.difficulty} />
        <NeutralBadge label={formatServings(recipe.servings)} />
        <NeutralBadge label={formatCookTime(recipe.cookTimeMinutes)} />
      </View>
    </Pressable>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Recipe['difficulty'] }) {
  const tone = difficultyTone[difficulty];
  if (tone === 'positive') {
    return (
      <Badge size="tiny" type="green" badgeStyle="fill">
        {difficultyLabel[difficulty]}
      </Badge>
    );
  }
  if (tone === 'critical') {
    return (
      <Badge size="tiny" type="red" badgeStyle="fill">
        {difficultyLabel[difficulty]}
      </Badge>
    );
  }
  return (
    <Badge size="tiny" type="teal" badgeStyle="weak">
      {difficultyLabel[difficulty]}
    </Badge>
  );
}

function NeutralBadge({ label }: { label: string }) {
  return (
    <Badge size="tiny" type="elephant" badgeStyle="weak">
      {label}
    </Badge>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E8EB',
    gap: 10,
  },
  cardPressed: {
    backgroundColor: '#F2F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
