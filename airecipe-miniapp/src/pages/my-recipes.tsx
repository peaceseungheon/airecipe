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
 * - 즐겨찾기 필터 토글은 Phase 4 — `?favorite=true` 적용.
 * - `meta.pageSize` 신뢰 — query.pageSize로 페이지 계산 금지 (baseline §H.2 #18).
 *
 * Phase 4 (ADR-013 D4·D9·D11):
 * - 상단 FilterTabs(전체/즐겨찾기). 변경 시 page 1 리셋(D11).
 * - RecipeCard.onToggleFavorite 활성화 — 낙관적 mutate + 호출 측 rollback(D4).
 * - PATCH 404 시 카드는 invalidate로 자동 사라짐(D9). 토스트 노출 없음.
 *
 * Phase 4.5 (ADR-014 D30): 빈 상태와 정상 목록 양쪽 하단에 `<AppInlineAd slot="my-recipes-bottom" />`.
 * 로딩/에러 분기에는 미렌더 — 사용자 컨텍스트 부적합 (G8). 광고 활성/비활성은 환경변수 게이트.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { Button, PageNavbar, Txt, colors } from '@toss/tds-react-native';

import { AppInlineAd } from '../components/AppInlineAd';
import { BottomTabBar } from '../components/BottomTabBar';
import { EmptyState } from '../components/EmptyState';
import { FilterTabs, type FilterValue } from '../components/FilterTabs';
import { RecipeCard } from '../components/RecipeCard';
import { useMyRecipes } from '../hooks/useMyRecipes';
import { useToggleFavorite } from '../hooks/useToggleFavorite';
import { useTossUserId } from '../hooks/useTossUserId';

const PAGE_SIZE = 20;

export const Route = createRoute('/my-recipes', {
  component: MyRecipesPage,
});

function MyRecipesPage() {
  const navigation = useNavigation();
  const { tossUserId } = useTossUserId();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterValue>('all');

  const query = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      favorite: filter === 'favorite' ? true : undefined,
    }),
    [page, filter],
  );
  const { data, meta, isLoading, error, refetch, mutate } = useMyRecipes(query);
  const { toggle, pendingId, error: favoriteError } = useToggleFavorite();

  const handleOpenDetail = useCallback(
    (id: string) => {
      navigation.navigate('/recipe/:id', { id });
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

  const handleFilterChange = useCallback((next: FilterValue) => {
    setFilter(next);
    setPage(1);
  }, []);

  /**
   * 즐겨찾기 토글 — baseline D4·D19 낙관적 UI + 호출 측 rollback.
   * 1) 즉시 mutate(next)로 별 채움/비움
   * 2) toggle(id, target) 호출
   * 3) 성공: 서버 응답 Recipe로 재mutate (정합 확정)
   * 4) 실패(null 반환): mutate(prev)로 rollback. 사용자는 favoriteError 메시지 노출
   */
  const handleToggleFavorite = useCallback(
    async (recipe: { id: string; isFavorite: boolean }, target: boolean) => {
      const prev = data.find((r) => r.id === recipe.id);
      if (!prev) return;
      mutate({ ...prev, isFavorite: target });
      const updated = await toggle(recipe.id, target);
      if (updated) {
        mutate(updated);
      } else {
        mutate(prev);
      }
    },
    [data, mutate, toggle],
  );

  // 식별자 가드 (Phase 3 baseline §C.4 + 07 §7.5.2).
  if (tossUserId === undefined) {
    return (
      <View style={styles.root}>
        <PageNavbar>
          <PageNavbar.Title>마이 레시피</PageNavbar.Title>
        </PageNavbar>
        <View style={styles.center}>
          <Txt typography="st9" color={colors.grey700}>
            식별자를 확인하는 중이에요…
          </Txt>
        </View>
        <BottomTabBar active="my" />
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
        <FilterTabs value={filter} onChange={handleFilterChange} />

        {favoriteError ? (
          <View style={styles.toastBox} accessibilityLabel="즐겨찾기 변경 실패">
            <Txt typography="st9" color={colors.red700}>
              {favoriteError}
            </Txt>
          </View>
        ) : null}

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
        ) : data.length === 0 ? (
          <>
            {filter === 'favorite' ? (
              <EmptyState
                title="즐겨찾기한 레시피가 없어요"
                description="별 아이콘으로 자주 만드는 레시피를 모아두세요."
                actionLabel="전체 보기"
                onAction={() => handleFilterChange('all')}
              />
            ) : (
              <EmptyState
                title="아직 저장된 레시피가 없어요"
                description="AI에게 첫 레시피를 추천받아 보세요."
                actionLabel="첫 레시피 만들기"
                onAction={handleGoGenerate}
              />
            )}
            <View style={styles.adSlot}>
              <AppInlineAd slot="my-recipes-bottom" />
            </View>
          </>
        ) : (
          <View style={styles.list}>
            {data.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() => handleOpenDetail(recipe.id)}
                onToggleFavorite={(target) =>
                  handleToggleFavorite(recipe, target)
                }
                favoritePending={pendingId === recipe.id}
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
            <Txt typography="st9" color={colors.grey500} style={styles.pageInfo}>
              {`${page} / ${lastPage} 페이지 · 총 ${total}개`}
            </Txt>

            <View style={styles.adSlot}>
              <AppInlineAd slot="my-recipes-bottom" />
            </View>
          </View>
        )}
      </ScrollView>

      <BottomTabBar active="my" />
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
    gap: 16,
    paddingBottom: 24, // 하단 탭바 가림 방지 (ADR-017 D61)
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
  adSlot: {
    marginTop: 16,
  },
  toastBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.red50,
  },
});
