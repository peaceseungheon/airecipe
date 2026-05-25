/**
 * FavoriteButton — 즐겨찾기 별 토글 (Phase 4)
 *
 * SSOT: 06 §6.4.5, baseline §B D1·D10.
 *
 * 책임:
 * - TDS `IconButton`에 별 모양 icon name 주입 (`icon-star-bold-mono`/`icon-star-mono`).
 * - **멱등 목표값 콜백** — `onToggle(target: boolean)` 호출(current의 반대를 전달, 멱등 계약 4.1).
 * - presentational only — 자체 state 없음. pending/isFavorite은 부모가 관리.
 *
 * 접근성:
 * - `accessibilityState={{ selected: isFavorite }}` + 한국어 라벨.
 *
 * 멈춤 트리거 §H.1 (baseline): icon name이 dev server에서 노랑 fallback 노출 시
 * → `icn-` prefix(2순위) 또는 TDS Icon 카탈로그 대안 적용 + 06 §6.4.5 갱신.
 */

import React from 'react';
import { IconButton } from '@toss/tds-react-native';

export interface FavoriteButtonProps {
  isFavorite: boolean;
  /** 목표값(!isFavorite) 전달. 멱등 계약 4.1. */
  onToggle: (target: boolean) => void;
  pending?: boolean;
}

export function FavoriteButton({ isFavorite, onToggle, pending }: FavoriteButtonProps) {
  const iconName = isFavorite ? 'icon-star-bold-mono' : 'icon-star-mono';
  const label = isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가';
  return (
    <IconButton
      name={iconName}
      variant="clear"
      iconSize={24}
      label={label}
      accessibilityLabel={label}
      accessibilityState={{ selected: isFavorite, disabled: pending ?? false }}
      disabled={pending}
      onPress={() => onToggle(!isFavorite)}
    />
  );
}
