/**
 * ThemePicker — 추천용 테마(상황·날씨) 선택 UI (Phase 6 / ADR-016 D44).
 *
 * SSOT: 06-UI-MAPPING §6.10, 03-API-CONTRACT §3.8.2.
 *
 * 책임:
 * - SegmentedControl 2축: 상황(6 Item) + 날씨(5 Item).
 * - presentational only — `value`/`onChange`만 props. 부모(`pages/recipe/recommend.tsx`)가 호출·검증.
 * - 한 번 더 같은 값 탭 시 해제(null) — SegmentedControl 자체는 토글 미지원이라 본 컴포넌트가 직접 비교.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedControl, Txt, colors } from '@toss/tds-react-native';

import {
  SITUATION_KEYS,
  WEATHER_KEYS,
  type RecommendationTheme,
  type SituationKey,
  type WeatherKey,
} from '../lib/zod/recommendations';

export interface ThemePickerProps {
  value: RecommendationTheme;
  onChange: (next: RecommendationTheme) => void;
}

const SITUATION_LABELS: Record<SituationKey, string> = {
  lunch: '점심',
  dinner: '저녁',
  midnight: '야식',
  gathering: '모임',
  solo: '혼밥',
  special: '특별한 날',
};

const WEATHER_LABELS: Record<WeatherKey, string> = {
  hot: '더운 날',
  cold: '추운 날',
  rainy: '비 오는 날',
  sunny: '화창한 날',
  chilly: '쌀쌀한 날',
};

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const handleSituation = (next: string) => {
    const picked = next as SituationKey;
    onChange({
      ...value,
      situation: value.situation === picked ? undefined : picked,
    });
  };

  const handleWeather = (next: string) => {
    const picked = next as WeatherKey;
    onChange({
      ...value,
      weather: value.weather === picked ? undefined : picked,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Txt typography="st9" color={colors.grey700} style={styles.label}>
          상황
        </Txt>
        <SegmentedControl.Root
          name="recommend-situation"
          value={value.situation ?? ''}
          size="small"
          onChange={handleSituation}
        >
          {SITUATION_KEYS.map((key) => (
            <SegmentedControl.Item key={key} value={key}>
              {SITUATION_LABELS[key]}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </View>

      <View style={styles.section}>
        <Txt typography="st9" color={colors.grey700} style={styles.label}>
          날씨
        </Txt>
        <SegmentedControl.Root
          name="recommend-weather"
          value={value.weather ?? ''}
          size="small"
          onChange={handleWeather}
        >
          {WEATHER_KEYS.map((key) => (
            <SegmentedControl.Item key={key} value={key}>
              {WEATHER_LABELS[key]}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  section: {
    gap: 8,
  },
  label: {
    paddingHorizontal: 4,
  },
});
