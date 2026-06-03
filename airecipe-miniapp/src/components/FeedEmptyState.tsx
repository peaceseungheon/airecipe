/**
 * FeedEmptyState — 피드 기록 0건 빈 상태 (ADR-021). EmptyState 재사용.
 *
 * SSOT: 06-UI-MAPPING(FeedEmptyState), 설계 스펙 §7.5·AC1.
 *
 * 책임: 기록 0건일 때 안내 + "기록 올리기" 액션(→ /cooking-log/new).
 * presentational only — EmptyState(title/description/actionLabel/onAction) 위임.
 */

import React from 'react';

import { EmptyState } from './EmptyState';

export interface FeedEmptyStateProps {
  onAction: () => void;
}

export function FeedEmptyState({ onAction }: FeedEmptyStateProps) {
  return (
    <EmptyState
      title="아직 기록이 없어요"
      description="만든 요리의 사진과 소감을 남겨 보세요."
      actionLabel="기록 올리기"
      onAction={onAction}
    />
  );
}
