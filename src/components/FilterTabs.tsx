/**
 * FilterTabs — 마이 레시피 "전체/즐겨찾기" 필터 (Phase 4)
 *
 * SSOT: 06 §6.5, baseline §A.3·§B D2·D11.
 *
 * 책임:
 * - TDS `SegmentedControl.Root` + `.Item` 2-state(전체/즐겨찾기) 라디오.
 * - presentational only — `value`/`onChange`만 props. 부모(`pages/my-recipes.tsx`)가 query 변환·page 리셋.
 */

import React from 'react';
import { SegmentedControl } from '@toss/tds-react-native';

export type FilterValue = 'all' | 'favorite';

export interface FilterTabsProps {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}

export function FilterTabs({ value, onChange }: FilterTabsProps) {
  return (
    <SegmentedControl.Root
      name="my-recipes-filter"
      value={value}
      size="small"
      onChange={(v) => onChange(v as FilterValue)}
    >
      <SegmentedControl.Item value="all">전체</SegmentedControl.Item>
      <SegmentedControl.Item value="favorite">즐겨찾기</SegmentedControl.Item>
    </SegmentedControl.Root>
  );
}
