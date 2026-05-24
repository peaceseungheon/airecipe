/**
 * SearchForm — 요리명·인분 입력 + 제출 버튼.
 *
 * SSOT: 06-UI-MAPPING §6.4.1, baseline §A.6 + §B.1·§B.3·§B.4.
 *
 * - presentational + onSubmit 콜백. 데이터 페칭·라우팅은 부모 책임 (SRP).
 * - 클라이언트 측 zod 검증(dishName trim min(1) max(100), servings 1..20)으로 AC2.3 충족.
 * - TDS: TextField(variant='line') + NumericSpinner(disable prop) + Button(type='primary').
 */

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, NumericSpinner, TextField, Txt } from '@toss/tds-react-native';
import { z } from 'zod';

const DISH_NAME_MAX = 100;
const SERVINGS_MIN = 1;
const SERVINGS_MAX = 20;

const dishNameSchema = z
  .string()
  .trim()
  .min(1, '요리 이름을 입력해 주세요.')
  .max(DISH_NAME_MAX, `요리 이름은 ${DISH_NAME_MAX}자 이내로 입력해 주세요.`);

export interface SearchFormProps {
  /** 제출 시 정규화된 dishName(trim)·servings을 전달한다. */
  onSubmit: (dishName: string, servings: number) => void;
  /** 외부에서 제어할 초기 값. URL params 등에서 주입. */
  initialDishName?: string;
  initialServings?: number;
  /** 외부 액션(스트리밍 중 등) 비활성화. */
  disabled?: boolean;
  /** 버튼 로딩 인디케이터(스트리밍 중). */
  pending?: boolean;
  submitLabel?: string;
}

export function SearchForm({
  onSubmit,
  initialDishName = '',
  initialServings = 2,
  disabled = false,
  pending = false,
  submitLabel = '레시피 만들기',
}: SearchFormProps) {
  const [dishName, setDishName] = useState(initialDishName);
  const [servings, setServings] = useState(clampServings(initialServings));
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (disabled || pending) return false;
    return dishName.trim().length > 0;
  }, [dishName, disabled, pending]);

  const handleChangeText = useCallback((next: string | number) => {
    setDishName(typeof next === 'string' ? next : String(next));
    if (error !== null) setError(null);
  }, [error]);

  const handleNumberChange = useCallback((next: number) => {
    setServings(clampServings(next));
  }, []);

  const handleSubmit = useCallback(() => {
    const parsed = dishNameSchema.safeParse(dishName);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? '요리 이름을 확인해 주세요.';
      setError(issue);
      return;
    }
    onSubmit(parsed.data, servings);
  }, [dishName, servings, onSubmit]);

  return (
    <View style={styles.container} accessibilityLabel="레시피 생성 폼">
      <View style={styles.field}>
        <Txt typography="st10" color="#4E5968">
          요리 이름
        </Txt>
        <TextField
          variant="line"
          value={dishName}
          onChangeText={handleChangeText}
          placeholder="예: 김치찌개"
          maxLength={DISH_NAME_MAX}
          autoCorrect={false}
          editable={!disabled && !pending}
          hasError={error !== null}
          help={error ?? undefined}
          accessibilityLabel="요리 이름"
        />
      </View>

      <View style={styles.field}>
        <Txt typography="st10" color="#4E5968">
          인분
        </Txt>
        <NumericSpinner
          size="medium"
          number={servings}
          minNumber={SERVINGS_MIN}
          maxNumber={SERVINGS_MAX}
          disable={disabled || pending}
          onNumberChange={handleNumberChange}
          accessibilityLabel="인분 수"
        />
      </View>

      <Button
        type="primary"
        style="fill"
        display="block"
        size="large"
        loading={pending}
        disabled={!canSubmit}
        onPress={handleSubmit}
      >
        {submitLabel}
      </Button>
    </View>
  );
}

function clampServings(value: number): number {
  if (!Number.isFinite(value)) return SERVINGS_MIN;
  return Math.max(SERVINGS_MIN, Math.min(SERVINGS_MAX, Math.floor(value)));
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
});
