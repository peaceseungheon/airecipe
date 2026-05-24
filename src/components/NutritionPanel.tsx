/**
 * NutritionPanel — 1인분 영양 정보 카드.
 *
 * SSOT: 06-UI-MAPPING §6.4.3.
 *
 * - 칼로리 강조 + 4 매크로(탄수/단백/지방/식이섬유) + healthNote(있을 때만).
 * - TDS primitive(Txt) + RN View로 합성. 컬러는 직접 hex 대신 TDS 토큰 사용을 원칙으로 하되,
 *   Phase 2 baseline §B.1은 adaptive 토큰을 별 import로 강제하지 않으므로
 *   기본 grey 값은 보수적 hex(#191F28/#4E5968)를 사용. 추후 디자인 토큰 결정 시 일괄 교체.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from '@toss/tds-react-native';

import type { Nutrition } from '../types/recipe';

export interface NutritionPanelProps {
  nutrition: Nutrition;
}

export function NutritionPanel({ nutrition }: NutritionPanelProps) {
  return (
    <View style={styles.card} accessibilityLabel="영양 정보">
      <Txt typography="st9" color="#4E5968">
        1인분 영양 정보
      </Txt>

      <View style={styles.calorieRow}>
        <Txt typography="t1" color="#191F28">
          {Math.round(nutrition.calories)}
        </Txt>
        <Txt typography="st10" color="#4E5968">
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
          <Txt typography="st9" color="#1B6E3F">
            {nutrition.healthNote}
          </Txt>
        </View>
      ) : null}
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
      <Txt typography="st10" color="#4E5968">
        {label}
      </Txt>
      <Txt typography="t5" color="#191F28">
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
    backgroundColor: '#F2F4F6',
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
    backgroundColor: '#E7F4EC',
  },
});
