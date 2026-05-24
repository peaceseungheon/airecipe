/**
 * 레시피 표시용 순수 포맷 헬퍼 — 06-UI-MAPPING §6.4.8.
 *
 * RN/웹 공유 가능한 순수 함수만 둔다. 화면별 분기·TDS 의존 금지.
 */

import type { Difficulty } from '../types/recipe';

export const difficultyLabel: Record<Difficulty, string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
};

/**
 * Badge 색상 의미 매핑 — 06 §6.3.4 "의미 매핑"만 정의.
 * 실제 TDS Badge에 props로 어떻게 옮길지는 호출 컴포넌트가 결정한다.
 */
export type DifficultyTone = 'positive' | 'neutral' | 'critical';

export const difficultyTone: Record<Difficulty, DifficultyTone> = {
  easy: 'positive',
  medium: 'neutral',
  hard: 'critical',
};

export function formatCookTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '시간 정보 없음';
  }
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `${hours}시간`;
  }
  return `${hours}시간 ${remainder}분`;
}

export function formatServings(servings: number): string {
  if (!Number.isFinite(servings) || servings <= 0) {
    return '인분 정보 없음';
  }
  return `${servings}인분`;
}
