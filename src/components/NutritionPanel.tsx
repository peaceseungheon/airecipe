/**
 * NutritionPanel — 1인분 영양 정보 카드.
 *
 * SSOT: 06-UI-MAPPING §6.4.3, 10-SPRINT-PLAN §10.6 (검수 가이드).
 *
 * - 칼로리 강조 + 4 매크로(탄수/단백/지방/식이섬유) + healthNote(있을 때만).
 * - TDS primitive(Txt) + RN View로 합성. 색상은 TDS `colors` 토큰(ADR-015 D39).
 * - 영양 정보가 의료/건강 자문이 아님을 알리는 면책 문구를 카드 하단에 fixed로 표시 (ADR-015 D40).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt, colors } from '@toss/tds-react-native';

import type { Nutrition } from '../types/recipe';

export interface NutritionPanelProps {
  nutrition: Nutrition;
}

export function NutritionPanel({ nutrition }: NutritionPanelProps) {
  return (
    <View style={styles.card} accessibilityLabel="영양 정보">
      <Txt typography="st9" color={colors.grey700}>
        1인분 영양 정보
      </Txt>

      <View style={styles.calorieRow}>
        <Txt typography="t1" color={colors.grey900}>
          {Math.round(nutrition.calories)}
        </Txt>
        <Txt typography="st10" color={colors.grey700}>
          kcal
        </Txt>
      </View>

      <View style={styles.grid}>
        <MacroCell label="탄수화물" value={nutrition.carbohydrates} unit="g" />
        <MacroCell label="단백질" value={nutrition.protein} unit="g" />
        <MacroCell label="지방" value={nutrition.fat} unit="g" />
        <MacroCell label="식이섬유" value={nutrition.fiber} unit="g" />
      </View>

      {nutrition.healthNote ? (
        <View style={styles.note}>
          <Txt typography="st9" color={colors.green700}>
            {nutrition.healthNote}
          </Txt>
        </View>
      ) : null}

      <Txt typography="st11" color={colors.grey600}>
        AI가 생성한 참고용 정보예요. 의료·영양 자문이 아닙니다.
      </Txt>
    </View>
  );
}

interface MacroCellProps {
  label: string;
  value: number;
  unit: string;
}

function MacroCell({ label, value, unit }: MacroCellProps) {
  return (
    <View style={styles.cell}>
      <Txt typography="st10" color={colors.grey700}>
        {label}
      </Txt>
      <Txt typography="t5" color={colors.grey900}>
        {formatMacro(value)}
        {unit}
      </Txt>
    </View>
  );
}

function formatMacro(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.grey100,
    gap: 12,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    paddingVertical: 8,
    gap: 2,
  },
  note: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.green50,
  },
});
