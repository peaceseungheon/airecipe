/**
 * My Recipes — `/my-recipes`. 마이 레시피 목록 화면.
 *
 * SSOT: 07-ROUTING §7.3.3, Phase 3 baseline §A.3·§C.1·§C.4·§C.5·§A.5.
 *
 * 책임:
 * - 식별자 가드 → `useMyRecipes` 결합 → 로딩/에러/EmptyState/RecipeCard 목록 4-way 분기.
 * - 단순 페이지네이션 — page useState + 이전/다음 Button. lastPage는 `meta.total`/`meta.pageSize`로 계산 (ADR-006 — meta.pageSize 신뢰).
 * - 카드 탭 → `/recipe/[id]`. EmptyState 액션 → `/recipe/generate`.
 *
 * 불변식:
 * - 보호 화면 — `useTossUserId` 필수 (Phase 3 baseline §C.4).
 * - 데이터 호출은 `useMyRecipes` 훅만. `recipes.ts`/`api-client` 직접 호출 금지 (baseline §H.2 #12).
 * - href/useRouter/Link 0건 — useNavigation/Route.useParams.
 * - 즐겨찾기 필터 토글은 Phase 4 — 본 Phase는 query.favorite 미사용(전체 목록만).
 * - `meta.pageSize` 신뢰 — query.pageSize로 페이지 계산 금지 (baseline §H.2 #18).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { Button, PageNavbar, Txt } from '@toss/tds-react-native';

import { EmptyState } from '../components/EmptyState';
import { RecipeCard } from '../components/RecipeCard';
import { useMyRecipes } from '../hooks/useMyRecipes';
import { useTossUserId } from '../hooks/useTossUserId';

const PAGE_SIZE = 20;

export const Route = createRoute('/my-recipes', {
  component: MyRecipesPage,
});

function MyRecipesPage() {
  const navigation = useNavigation();
  const { tossUserId } = useTossUserId();
  const [page, setPage] = useState(1);

  const query = useMemo(() => ({ page, pageSize: PAGE_SIZE }), [page]);
  const { data, meta, isLoading, error, refetch } = useMyRecipes(query);

  const handleOpenDetail = useCallback(
    (id: string) => {
      navigation.navigate('/recipe/[id]', { id });
    },
    [navigation],
  );

  const handleGoGenerate = useCallback(() => {
    navigation.navigate('/recipe/generate', {});
  }, [navigation]);

  const handleNextPage = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  const handlePrevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  // 식별자 가드 (Phase 3 baseline §C.4 + 07 §7.5.2).
  if (tossUserId === undefined) {
    return (
      <View style={styles.root}>
        <PageNavbar>
          <PageNavbar.Title>마이 레시피</PageNavbar.Title>
        </PageNavbar>
        <View style={styles.center}>
          <Txt typography="st9" color="#4E5968">
            식별자를 확인하는 중이에요…
          </Txt>
        </View>
      </View>
    );
  }

  // lastPage 계산은 meta.pageSize 신뢰 (ADR-006 — 백엔드 clamp 적용값 그대로).
  // meta가 아직 없으면(첫 로딩) 1 페이지로 본다.
  const effectivePageSize = meta?.pageSize ?? PAGE_SIZE;
  const total = meta?.total ?? 0;
  const lastPage = effectivePageSize > 0
    ? Math.max(1, Math.ceil(total / effectivePageSize))
    : 1;
  const hasPrev = page > 1;
  const hasNext = page < lastPage;

  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>마이 레시피</PageNavbar.Title>
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
        ) : data.length === 0 ? (
          <EmptyState
            title="아직 저장된 레시피가 없어요"
            description="AI에게 첫 레시피를 추천받아 보세요."
            actionLabel="첫 레시피 만들기"
            onAction={handleGoGenerate}
          />
        ) : (
          <View style={styles.list}>
            {data.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() => handleOpenDetail(recipe.id)}
              />
            ))}

            <View style={styles.pagination}>
              <Button
                type="light"
                style="weak"
                display="block"
                size="medium"
                disabled={!hasPrev}
                onPress={handlePrevPage}
              >
                이전
              </Button>
              <Button
                type="light"
                style="weak"
                display="block"
                size="medium"
                disabled={!hasNext}
                onPress={handleNextPage}
              >
                다음
              </Button>
            </View>
            <Txt typography="st9" color="#8B95A1" style={styles.pageInfo}>
              {`${page} / ${lastPage} 페이지 · 총 ${total}개`}
            </Txt>
          </View>
        )}
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
    gap: 16,
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
  list: {
    gap: 12,
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  pageInfo: {
    textAlign: 'center',
    marginTop: 4,
  },
});
