/**
 * New Cooking Log — `/cooking-log/new`. 요리 기록 업로드 폼 화면 (ADR-021).
 *
 * SSOT: 07-ROUTING(라우트 표), 설계 스펙 §8(업로드 흐름)·AC2·AC4.
 *
 * 책임:
 * - 진입 경로 2종: (a) 피드 FAB "올리기"(initialRecipe 없음 → 폼 내 RecipeSnapshotPicker로 저장본 선택),
 *   (b) 레시피 생성 결과 "이 레시피로 기록 남기기"(미저장 GeneratedRecipe 전달, sourceRecipeId 없음).
 * - useCreateCookingLog 결합 → 성공 시 피드(`/`)로 복귀(invalidate는 훅 내부 — 상단 노출, AC4).
 *
 * 불변식:
 * - 보호 화면이지만 식별자 가드는 useCreateCookingLog 내부(미발급 시 한국어 에러 + null).
 * - 직접 fetch/api-client 호출 0건 — 훅만.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { PageNavbar } from '@toss/tds-react-native';

import { BottomTabBar } from '../../src/components/BottomTabBar';
import { TopAdBanner } from '../../src/components/TopAdBanner';
import {
  CookingLogForm,
  type CookingLogFormProps,
} from '../../src/components/CookingLogForm';
import { useCreateCookingLog } from '../../src/hooks/useCreateCookingLog';
import type { GeneratedRecipe } from '../../src/types/recipe';

interface NewParams {
  recipe?: GeneratedRecipe;
  sourceRecipeId?: string;
}

export const Route = createRoute('/cooking-log/new', {
  validateParams: (params: unknown): NewParams => {
    const o = (params ?? {}) as Record<string, unknown>;
    return {
      recipe: (o.recipe ?? undefined) as GeneratedRecipe | undefined,
      sourceRecipeId:
        typeof o.sourceRecipeId === 'string' ? o.sourceRecipeId : undefined,
    };
  },
  component: NewCookingLogPage,
});

function NewCookingLogPage() {
  const params = Route.useParams();
  const navigation = useNavigation();
  const { isSaving, error, create } = useCreateCookingLog();

  const initialRecipe: CookingLogFormProps['initialRecipe'] = params.recipe
    ? { recipe: params.recipe, sourceRecipeId: params.sourceRecipeId ?? null }
    : null;

  const handleSubmit = useCallback<CookingLogFormProps['onSubmit']>(
    async (req) => {
      const saved = await create(req);
      if (saved) {
        navigation.navigate('/', {}); // 피드로 복귀(상단 노출, AC4)
      }
    },
    [create, navigation],
  );

  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>요리 기록 올리기</PageNavbar.Title>
      </PageNavbar>
      <TopAdBanner slot="cooking-new-top" />
      <CookingLogForm
        initialRecipe={initialRecipe}
        pending={isSaving}
        error={error}
        onSubmit={handleSubmit}
      />
      <BottomTabBar active="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
