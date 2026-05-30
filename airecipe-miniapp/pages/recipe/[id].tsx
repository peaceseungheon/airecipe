/**
 * Recipe Detail — `/recipe/[id]`. 단건 레시피 상세 화면.
 *
 * SSOT: 07-ROUTING §7.3.4, Phase 3 baseline §A.3·§C.2·§C.4·§B.3, ADR-004, ADR-005.
 *
 * 책임:
 * - 식별자 가드 → `useRecipeDetail(id)` 결합 → 로딩/404/에러/정상 4-way 분기.
 * - 404 시 단일 `<NotFoundScreen />` 컴포넌트 — `<ErrorPage>` 직접 렌더·인라인 "찾을 수 없" 금지 (baseline §H.2 #13).
 * - **Phase 4 (ADR-013 D5·D7·D8)**: PageNavbar accessory에 FavoriteButton + 본문 하단에 삭제 Button + DeleteConfirmDialog.
 *   낙관적 mutate(D4) + 삭제 성공·404 정규화(D6) 후 handleBack(D8).
 * - 새로고침·딥링크 정상(ADR-004) — `useRecipeDetail`이 단건 fetch.
 *
 * 불변식:
 * - 보호 화면 — `useTossUserId` 필수 (Phase 3 baseline §C.4).
 * - 데이터 호출은 `useRecipeDetail` 훅만. `recipes.ts`/`api-client` 직접 호출 금지 (baseline §H.2 #12).
 * - href/useRouter/Link 0건 — useNavigation/Route.useParams.
 * - validateParams 패턴은 Phase 2 `generate.tsx:39-50` 답습 (baseline §C.2).
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { Button, PageNavbar, Txt, colors } from '@toss/tds-react-native';

import { BottomTabBar } from '../../src/components/BottomTabBar';
import { DeleteConfirmDialog } from '../../src/components/DeleteConfirmDialog';
import { FavoriteButton } from '../../src/components/FavoriteButton';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { NutritionPanel } from '../../src/components/NutritionPanel';
import { RecipeDisplay } from '../../src/components/RecipeDisplay';
import { useDeleteRecipe } from '../../src/hooks/useDeleteRecipe';
import { useRecipeDetail } from '../../src/hooks/useRecipeDetail';
import { useToggleFavorite } from '../../src/hooks/useToggleFavorite';
import { useTossUserId } from '../../src/hooks/useTossUserId';

interface DetailParams {
  id: string;
}

export const Route = createRoute('/recipe/:id', {
  // Phase 2 generate.tsx:39-50 패턴 답습 (baseline §C.2).
  validateParams: (params: unknown): DetailParams => {
    const obj = (params ?? {}) as Record<string, unknown>;
    return { id: typeof obj.id === 'string' ? obj.id : '' };
  },
  component: RecipeDetailPage,
});

function RecipeDetailPage() {
  const { id } = Route.useParams();
  const navigation = useNavigation();
  const { tossUserId } = useTossUserId();
  const {
    data: recipe,
    isLoading,
    notFound,
    error,
    refetch,
    mutate,
  } = useRecipeDetail(id);
  const { toggle, pendingId, error: favoriteError } = useToggleFavorite();
  const { remove, isPending: deletePending, error: deleteError } = useDeleteRecipe(id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate('/my-recipes', {});
    }
  }, [navigation]);

  /**
   * 즐겨찾기 토글 — baseline D4·D5·D9.
   * 1) 낙관적: mutate({ ...recipe, isFavorite: target }) — 별 즉시.
   * 2) toggle 호출 → 성공 시 응답 Recipe로 재 mutate (서버 truth 확정, refetch GET 회피 — D5).
   * 3) 실패 null 반환 → rollback (prev로 mutate). 토스트는 favoriteError로 노출.
   * 4) 404는 mutate가 실패해도 useRecipeDetail 자체는 그대로 — 사용자가 다시 진입하면 notFound 분기. 본 사이클에서는 별 UI 강요 없음.
   */
  const handleToggleFavorite = useCallback(
    async (target: boolean) => {
      if (!recipe) return;
      const prev = recipe;
      mutate({ ...prev, isFavorite: target });
      const updated = await toggle(prev.id, target);
      if (updated) {
        mutate(updated);
      } else {
        mutate(prev);
      }
    },
    [recipe, mutate, toggle],
  );

  const handleOpenDeleteConfirm = useCallback(() => setConfirmOpen(true), []);
  const handleCancelDelete = useCallback(() => {
    if (!deletePending) setConfirmOpen(false);
  }, [deletePending]);

  /**
   * 삭제 확정 — baseline D6·D8.
   * - useDeleteRecipe.remove(): 성공·404 정규화 모두 true → invalidate + handleBack.
   * - false 반환 시 deleteError로 사용자에게 노출 후 다이얼로그 유지.
   */
  const handleConfirmDelete = useCallback(async () => {
    const ok = await remove();
    if (ok) {
      setConfirmOpen(false);
      handleBack();
    }
  }, [remove, handleBack]);

  // 식별자 가드 (Phase 3 baseline §C.4 + 07 §7.5.2).
  if (tossUserId === undefined) {
    return (
      <View style={styles.root}>
        <PageNavbar>
          <PageNavbar.Title>레시피</PageNavbar.Title>
        </PageNavbar>
        <View style={styles.center}>
          <Txt typography="st9" color={colors.grey700}>
            식별자를 확인하는 중이에요…
          </Txt>
        </View>
        <BottomTabBar active="none" />
      </View>
    );
  }

  // 404 단일 컴포넌트 정책 (baseline §H.2 #13).
  if (notFound) {
    return (
      <View style={styles.root}>
        <NotFoundScreen onBack={handleBack} />
        <BottomTabBar active="none" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>{recipe?.dishName ?? '레시피'}</PageNavbar.Title>
        {recipe ? (
          <PageNavbar.AccessoryButtons>
            <FavoriteButton
              isFavorite={recipe.isFavorite}
              onToggle={handleToggleFavorite}
              pending={pendingId === recipe.id}
            />
          </PageNavbar.AccessoryButtons>
        ) : null}
      </PageNavbar>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <View style={styles.center}>
            <Txt typography="st9" color={colors.grey700}>
              레시피를 불러오고 있어요…
            </Txt>
          </View>
        ) : error ? (
          <View style={styles.errorBox} accessibilityLabel="레시피 조회 실패">
            <Txt typography="t5" color={colors.red700}>
              레시피를 불러오지 못했어요
            </Txt>
            <Txt typography="st9" color={colors.grey700}>
              {error}
            </Txt>
            <View style={styles.errorActions}>
              <Button
                type="primary"
                style="fill"
                display="block"
                size="medium"
                onPress={refetch}
              >
                다시 시도
              </Button>
            </View>
          </View>
        ) : recipe ? (
          <View style={styles.result}>
            <RecipeDisplay recipe={recipe} />
            <NutritionPanel nutrition={recipe.nutrition} />

            {favoriteError ? (
              <View style={styles.toastBox} accessibilityLabel="즐겨찾기 변경 실패">
                <Txt typography="st9" color={colors.red700}>
                  {favoriteError}
                </Txt>
              </View>
            ) : null}

            {deleteError ? (
              <View style={styles.toastBox} accessibilityLabel="삭제 실패">
                <Txt typography="st9" color={colors.red700}>
                  {deleteError}
                </Txt>
              </View>
            ) : null}

            <View style={styles.deleteActions}>
              <Button
                type="danger"
                style="weak"
                display="block"
                size="medium"
                onPress={handleOpenDeleteConfirm}
                disabled={deletePending}
              >
                레시피 삭제
              </Button>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <BottomTabBar active="none" />

      {recipe ? (
        <DeleteConfirmDialog
          open={confirmOpen}
          recipeName={recipe.dishName}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          pending={deletePending}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
    paddingBottom: 24,
  },
  center: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  errorBox: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.red50,
    gap: 8,
  },
  errorActions: {
    marginTop: 8,
  },
  result: {
    gap: 24,
  },
  toastBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.red50,
  },
  deleteActions: {
    marginTop: 8,
  },
});
