/**
 * 레시피 표시용 포맷 헬퍼 (presentational 보조).
 * 도메인 값(difficulty 등)을 사람이 읽는 한국어 라벨로 변환한다.
 */
import type { Difficulty } from "@/types";

export const difficultyLabel: Record<Difficulty, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

/** Badge variant와 일치하는 difficulty 키(타입 안전). */
export function difficultyVariant(d: Difficulty): Difficulty {
  return d;
}

/** 조리 시간(분)을 "1시간 20분"/"45분" 형태로 */
export function formatCookTime(minutes: number): string {
  if (minutes <= 0) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
