/**
 * Recipe Detail — `/recipe/[id]`. 단건 레시피 상세 화면.
 *
 * SSOT: 07-ROUTING §7.3.4, Phase 3 baseline §A.3·§C.2·§C.4·§B.3, ADR-004, ADR-005.
 *
 * 책임:
 * - 식별자 가드 → `useRecipeDetail(id)` 결합 → 로딩/404/에러/정상 4-way 분기.
 * - 404 시 단일 `<NotFoundScreen />` 컴포넌트 — `<ErrorPage>` 직접 렌더·인라인 "찾을 수 없" 금지 (baseline §H.2 #13).
 * - 즐겨찾기 토글·삭제 버튼은 Phase 4 (자리표시 없이 본 Phase 미렌더).
 * - 새로고침·딥링크 정상(ADR-004) — `useRecipeDetail`이 단건 fetch.
 *
 * 불변식:
 * - 보호 화면 — `useTossUserId` 필수 (Phase 3 baseline §C.4).
 * - 데이터 호출은 `useRecipeDetail` 훅만. `recipes.ts`/`api-client` 직접 호출 금지 (baseline §H.2 #12).
 * - href/useRouter/Link 0건 — useNavigation/Route.useParams.
 * - validateParams 패턴은 Phase 2 `generate.tsx:39-50` 답습 (baseline §C.2).
 */

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { Button, PageNavbar, Txt } from '@toss/tds-react-native';

import { NotFoundScreen } from '../../components/NotFoundScreen';
import { NutritionPanel } from '../../components/NutritionPanel';
import { RecipeDisplay } from '../../components/RecipeDisplay';
import { useRecipeDetail } from '../../hooks/useRecipeDetail';
import { useTossUserId } from '../../hooks/useTossUserId';

interface DetailParams {
  id: string;
}

export const Route = createRoute('/recipe/[id]', {
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
  const { data: recipe, isLoading, notFound, error, refetch } = useRecipeDetail(id);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate('/my-recipes', {});
    }
  }, [navigation]);

  // 식별자 가드 (Phase 3 baseline §C.4 + 07 §7.5.2).
  if (tossUserId === undefined) {
    return (
      <View style={styles.root}>
        <PageNavbar>
          <PageNavbar.Title>레시피</PageNavbar.Title>
        </PageNavbar>
        <View style={styles.center}>
          <Txt typography="st9" color="#4E5968">
            식별자를 확인하는 중이에요…
          </Txt>
        </View>
      </View>
    );
  }

  // 404 단일 컴포넌트 정책 (baseline §H.2 #13).
  if (notFound) {
    return <NotFoundScreen onBack={handleBack} />;
  }

  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>{recipe?.dishName ?? '레시피'}</PageNavbar.Title>
      </PageNavbar>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <View style={styles.center}>
            <Txt typography="st9" color="#4E5968">
              레시피를 불러오고 있어요…
            </Txt>
          </View>
        ) : error ? (
          <View style={styles.errorBox} accessibilityLabel="레시피 조회 실패">
            <Txt typography="t5" color="#C0392B">
              레시피를 불러오지 못했어요
            </Txt>
            <Txt typography="st9" color="#4E5968">
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
            {/* Phase 4 진입 시 즐겨찾기·삭제 버튼이 actions slot으로 추가된다. */}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    gap: 24,
  },
  center: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  errorBox: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FBE9E9',
    gap: 8,
  },
  errorActions: {
    marginTop: 8,
  },
  result: {
    gap: 24,
  },
});
