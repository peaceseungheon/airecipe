/**
 * RecipeDisplay — 레시피 전체(타이틀·설명·메타·재료·단계·팁) 표시.
 *
 * SSOT: 06-UI-MAPPING §6.4.2, baseline §A.6.
 *
 * 불변식:
 * - GeneratedRecipe(저장 전) | Recipe(저장 후) 공통 필드만 사용.
 *   id/createdAt/isFavorite은 참조 금지 (03 §3.10 #5, baseline §D.2 #9, 06 §6.7).
 * - 외부 액션(저장·즐겨찾기 등)은 actions 슬롯(ReactNode prop)으로 부모가 주입. SRP.
 * - 스크롤은 부모(페이지)가 ScrollView로 감싼다 — 본 컴포넌트 자체는 스크롤 책임 없음.
 *
 * NutritionPanel은 의미·시각 단위로 분리되어 있어 본 컴포넌트가 nesting하지 않고
 * 페이지에서 RecipeDisplay 다음에 별 섹션으로 렌더링한다.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, List, ListRow, Txt, colors } from '@toss/tds-react-native';

import {
  difficultyLabel,
  difficultyTone,
  formatCookTime,
  formatServings,
} from './recipe-format';
import type { GeneratedRecipe } from '../types/recipe';

export interface RecipeDisplayProps {
  /** GeneratedRecipe(저장 전) 또는 Recipe(저장 후) 모두 수용 — 공통 필드만 읽는다. */
  recipe: GeneratedRecipe;
  /** 우측 또는 하단 액션 슬롯(저장/즐겨찾기/삭제 등). */
  actions?: React.ReactNode;
}

export function RecipeDisplay({ recipe, actions }: RecipeDisplayProps) {
  return (
    <View style={styles.container} accessibilityLabel={`${recipe.dishName} 레시피`}>
      <View style={styles.header}>
        <Txt typography="t1" color={colors.grey900}>
          {recipe.dishName}
        </Txt>
        {recipe.description ? (
          <Txt typography="st9" color={colors.grey700}>
            {recipe.description}
          </Txt>
        ) : null}
      </View>

      <View style={styles.badgeRow}>
        <DifficultyBadge difficulty={recipe.difficulty} />
        <NeutralBadge label={formatServings(recipe.servings)} />
        <NeutralBadge label={formatCookTime(recipe.cookTimeMinutes)} />
      </View>

      <Section title="재료">
        <List rowSeparator="indented">
          {recipe.ingredients.map((ing, index) => (
            <ListRow
              key={`${ing.name}-${index}`}
              contents={
                <Txt typography="t5" color={colors.grey900}>
                  {ing.name}
                </Txt>
              }
              right={
                <Txt typography="st9" color={colors.grey700}>
                  {formatQuantity(ing.quantity, ing.unit)}
                </Txt>
              }
              verticalPadding="small"
            />
          ))}
        </List>
      </Section>

      <Section title="조리 순서">
        <View style={styles.steps}>
          {recipe.steps.map((step) => (
            <View key={step.order} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Txt typography="st9" color={colors.white}>
                  {step.order}
                </Txt>
              </View>
              <Txt typography="st9" color={colors.grey900} style={styles.stepText}>
                {step.instruction}
              </Txt>
            </View>
          ))}
        </View>
      </Section>

      {recipe.tips.length > 0 ? (
        <Section title="요리 팁">
          <View style={styles.tips}>
            {recipe.tips.map((tip, index) => (
              <View key={`tip-${index}`} style={styles.tipRow}>
                <Txt typography="st9" color={colors.grey700} style={styles.tipBullet}>
                  •
                </Txt>
                <Txt typography="st9" color={colors.grey700} style={styles.tipText}>
                  {tip}
                </Txt>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Txt typography="t5" color={colors.grey900}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

/**
 * 06 §6.3.4 의미 매핑 → TDS Badge `type`+`badgeStyle` 채택.
 * - easy/positive  → green / fill
 * - medium/neutral → teal  / weak
 * - hard/critical  → red   / fill
 * - 보조 메타(인분·시간) → elephant / weak
 */
function DifficultyBadge({ difficulty }: { difficulty: GeneratedRecipe['difficulty'] }) {
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

function formatQuantity(quantity: number, unit: string): string {
  if (!Number.isFinite(quantity)) return unit;
  const rounded = Math.round(quantity * 10) / 10;
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${value}${unit}`;
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  header: {
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  section: {
    gap: 12,
  },
  steps: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.blue500,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepText: {
    flex: 1,
    lineHeight: 22,
  },
  tips: {
    gap: 6,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tipBullet: {
    width: 8,
  },
  tipText: {
    flex: 1,
  },
  actions: {
    marginTop: 8,
    gap: 8,
  },
});
