/**
 * CookingLogForm — 요리 기록 업로드 폼 (ADR-021).
 *
 * SSOT: 06-UI-MAPPING(CookingLogForm), 설계 스펙 §2(필수 4입력)·§8(업로드 흐름)·AC2.
 *
 * 책임:
 * - 사진(필수)·레시피 스냅샷(필수)·별점(필수 1..5)·소감(필수)을 모아 CreateCookingLogRequest 조립.
 * - 누락 시 한국어 안내(AC2) — 제출 전 클라이언트 검증.
 * - 저장된 Recipe를 선택해도 백엔드로는 GeneratedRecipe 스냅샷 필드만 전송(toGeneratedRecipe).
 *
 * 정책:
 * - presentational + onSubmit 콜백. 호출/캐시는 부모(페이지 + useCreateCookingLog) 책임(SRP).
 * - 색은 TDS colors 토큰만 — 에러 텍스트는 기존 화면 관례(colors.red700) 미러(ADR-015 D39).
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, TextField, Txt, colors } from '@toss/tds-react-native';

import { PhotoPickerButton } from './PhotoPickerButton';
import {
  RecipeSnapshotPicker,
  type RecipeSnapshotSelection,
} from './RecipeSnapshotPicker';
import { StarRatingInput } from './StarRatingInput';
import type { PickedImage } from '../lib/media';
import type { GeneratedRecipe } from '../types/recipe';
import type { CreateCookingLogRequest } from '../types/cooking-log';

export interface CookingLogFormProps {
  /** 생성 결과에서 전달된 미저장 레시피 등 초기 선택(없으면 null). */
  initialRecipe?: RecipeSnapshotSelection | null;
  /** 저장 진행 중 — 버튼 disabled. */
  pending?: boolean;
  /** 부모(useCreateCookingLog)에서 온 한국어 에러. */
  error?: string | null;
  onSubmit: (req: CreateCookingLogRequest) => void;
}

/** Recipe(저장본)·GeneratedRecipe 공통 스냅샷 필드만 추출(id/isFavorite/createdAt 비전송). */
function toGeneratedRecipe(r: GeneratedRecipe): GeneratedRecipe {
  return {
    dishName: r.dishName,
    description: r.description,
    servings: r.servings,
    cookTimeMinutes: r.cookTimeMinutes,
    difficulty: r.difficulty,
    ingredients: r.ingredients,
    steps: r.steps,
    tips: r.tips,
    nutrition: r.nutrition,
  };
}

export function CookingLogForm({
  initialRecipe = null,
  pending = false,
  error = null,
  onSubmit,
}: CookingLogFormProps) {
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [recipeSel, setRecipeSel] = useState<RecipeSnapshotSelection | null>(
    initialRecipe,
  );
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleReviewChange = (next: string | number) => {
    setReview(typeof next === 'string' ? next : String(next));
    if (localError !== null) setLocalError(null);
  };

  const submit = () => {
    if (!photo) {
      setLocalError('요리 사진을 추가해 주세요.');
      return;
    }
    if (!recipeSel) {
      setLocalError('레시피를 선택해 주세요.');
      return;
    }
    if (rating < 1) {
      setLocalError('별점을 매겨 주세요.');
      return;
    }
    if (review.trim().length === 0) {
      setLocalError('소감을 입력해 주세요.');
      return;
    }
    setLocalError(null);
    onSubmit({
      image: photo.dataUri,
      mimeType: photo.mimeType,
      recipe: toGeneratedRecipe(recipeSel.recipe),
      sourceRecipeId: recipeSel.sourceRecipeId,
      rating,
      review: review.trim(),
    });
  };

  const shownError = localError ?? error;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Txt typography="t5" color={colors.grey900}>
        요리 사진
      </Txt>
      <PhotoPickerButton value={photo} onPick={setPhoto} />

      <Txt typography="t5" color={colors.grey900}>
        레시피
      </Txt>
      <RecipeSnapshotPicker
        selected={recipeSel}
        onSelect={(recipe, sourceRecipeId) =>
          setRecipeSel({ recipe, sourceRecipeId })
        }
      />

      <Txt typography="t5" color={colors.grey900}>
        별점
      </Txt>
      <StarRatingInput value={rating} onChange={setRating} />

      <Txt typography="t5" color={colors.grey900}>
        소감
      </Txt>
      <TextField
        variant="line"
        value={review}
        onChangeText={handleReviewChange}
        placeholder="한 줄 소감을 남겨 주세요"
        maxLength={1000}
        hasError={shownError !== null}
        accessibilityLabel="소감"
      />

      {shownError ? (
        <Txt typography="st11" color={colors.red700}>
          {shownError}
        </Txt>
      ) : null}

      <Button
        type="primary"
        style="fill"
        display="block"
        size="large"
        loading={pending}
        disabled={pending}
        onPress={submit}
      >
        기록 올리기
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 96,
  },
});
