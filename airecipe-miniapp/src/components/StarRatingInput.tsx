/**
 * StarRatingInput — 별점 입력(요리 기록 폼). TDS EditableRating 합성 (ADR-021).
 *
 * SSOT: 06-UI-MAPPING(StarRatingInput), 설계 스펙 §3 D5(별 5점)·§7.6(TDS 별점 실재성).
 *
 * 실재 확인(rating/index.d.ts): 패키지 루트 public export는 `Rating`(단일)뿐 —
 *   `EditableRating`/`ReadOnlyRating`는 `.d.ts` barrel에 미노출(내부 타입). 따라서 편집형은
 *   `Rating readonly={false}`(= EditableRatingProps: value/onValueChange?/size:'medium'|'large'|'big'/max?).
 *   계획 초안의 `EditableRating` named import는 실 export와 불일치 → `Rating` 판별 유니온으로 정정.
 *
 * 정책:
 * - 부모는 1..5 정수 별점만 다룬다 — onValueChange 결과를 round.
 * - presentational only(상태는 부모 보유).
 */

import React, { useCallback } from 'react';
import { Rating } from '@toss/tds-react-native';

export interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const handle = useCallback(
    (v: number) => {
      onChange(Math.round(v));
    },
    [onChange],
  );

  return (
    <Rating
      readonly={false}
      value={value}
      onValueChange={handle}
      size="large"
      max={5}
      accessibilityLabel="별점 입력"
      accessibilityValueText={(max, v) => `${max}점 만점 중 ${v}점`}
    />
  );
}
