/**
 * RecipeSnapshotPicker — 요리 기록에 첨부할 레시피 스냅샷 선택 (ADR-021).
 *
 * SSOT: 06-UI-MAPPING(RecipeSnapshotPicker), 설계 스펙 §3 D8(저장본 + 미저장 둘 다)·§7.5.
 *
 * 책임:
 * - `selected`가 있으면(생성 결과에서 전달된 미저장 레시피 또는 이미 고른 저장본) 선택 요약만 표시.
 * - 없으면 `useMyRecipes`(저장 레시피 목록) 재사용 → 행 탭 시 `onSelect(recipe, sourceRecipeId=r.id)`.
 * - 저장본 출처는 `sourceRecipeId=r.id`, 미저장(생성 결과) 출처는 부모가 null로 전달.
 *
 * 정책:
 * - 직접 fetch/api-client 호출 0건 — `useMyRecipes` 훅만.
 * - Recipe(저장본)에서 GeneratedRecipe 스냅샷 필드 추출은 부모(CookingLogForm)가 수행.
 *   본 컴포넌트는 Recipe를 그대로 onSelect로 넘긴다(상위 호환 — Recipe extends GeneratedRecipe).
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt, colors } from '@toss/tds-react-native';

import { useMyRecipes } from '../hooks/useMyRecipes';
import type { GeneratedRecipe } from '../types/recipe';

export interface RecipeSnapshotSelection {
  recipe: GeneratedRecipe;
  sourceRecipeId: string | null;
}

export interface RecipeSnapshotPickerProps {
  selected: RecipeSnapshotSelection | null;
  onSelect: (recipe: GeneratedRecipe, sourceRecipeId: string | null) => void;
}

export function RecipeSnapshotPicker({ selected, onSelect }: RecipeSnapshotPickerProps) {
  const { data, isLoading } = useMyRecipes({ page: 1, pageSize: 20 });

  if (selected) {
    return (
      <Txt typography="t5" color={colors.grey900}>
        {selected.recipe.dishName}
      </Txt>
    );
  }

  if (isLoading) {
    return (
      <Txt typography="st9" color={colors.grey500}>
        레시피를 불러오는 중이에요…
      </Txt>
    );
  }

  if (data.length === 0) {
    return (
      <Txt typography="st9" color={colors.grey500}>
        저장된 레시피가 없어요. 레시피 탭에서 먼저 만들어 주세요.
      </Txt>
    );
  }

  return (
    <View style={styles.list}>
      {data.map((r) => (
        <Pressable
          key={r.id}
          style={styles.row}
          onPress={() => onSelect(r, r.id)}
          accessibilityRole="button"
          accessibilityLabel={`${r.dishName} 선택`}
        >
          <Txt typography="st9" color={colors.grey900}>
            {r.dishName}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 4,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey200,
  },
});
