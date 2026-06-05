/**
 * Cooking Log Detail — `/cooking-log/:id`. 기록 상세(사진 + 레시피 스냅샷 + 별점 + 소감) + 삭제 (ADR-021).
 *
 * SSOT: 07-ROUTING(라우트 표), 설계 스펙 §2·§6.3·§6.4·AC5·AC6, ADR-005(404 통일).
 *
 * 책임:
 * - 식별자/파라미터 가드 → useCookingLogDetail(id) → 로딩/404/에러/정상 4-way 분기.
 * - 404는 단일 NotFoundScreen(ADR-005 통일). RecipeDisplay로 레시피 스냅샷 전체 표시(AC5).
 * - 삭제: useDeleteCookingLog(id).remove() → 성공·404 정규화 true → 피드(`/`)로 복귀(AC6).
 *
 * 불변식:
 * - 직접 fetch/api-client 호출 0건 — 훅만.
 * - useDeleteCookingLog는 id를 훅 인자로 받고 remove()는 무인자(플러밍 실제 시그니처).
 * - href/useRouter/Link 0건 — useNavigation/Route.useParams.
 */

import React, { useCallback } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import {
  Button,
  PageNavbar,
  Rating,
  Txt,
  colors,
} from '@toss/tds-react-native';

import { BottomTabBar } from '../../src/components/BottomTabBar';
import { TopAdBanner } from '../../src/components/TopAdBanner';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { RecipeDisplay } from '../../src/components/RecipeDisplay';
import { useCookingLogDetail } from '../../src/hooks/useCookingLogDetail';
import { useDeleteCookingLog } from '../../src/hooks/useDeleteCookingLog';

interface DetailParams {
  id?: string;
}

export const Route = createRoute('/cooking-log/:id', {
  validateParams: (params: unknown): DetailParams => {
    const o = (params ?? {}) as Record<string, unknown>;
    return { id: typeof o.id === 'string' ? o.id : undefined };
  },
  component: CookingLogDetailPage,
});

function CookingLogDetailPage() {
  const params = Route.useParams();
  const navigation = useNavigation();
  const { data, isLoading, notFound, error } = useCookingLogDetail(params.id);
  const { remove, isPending: deletePending, error: deleteError } =
    useDeleteCookingLog(params.id ?? '');

  const handleBack = useCallback(() => {
    navigation.navigate('/', {});
  }, [navigation]);

  const handleDelete = useCallback(async () => {
    const ok = await remove();
    if (ok) handleBack();
  }, [remove, handleBack]);

  if (params.id === undefined || notFound) {
    return (
      <View style={styles.root}>
        <NotFoundScreen
          title="기록을 찾을 수 없어요"
          subtitle="삭제되었거나 다른 사용자의 기록일 수 있어요."
          onBack={handleBack}
        />
        <BottomTabBar active="none" />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.root}>
        <PageNavbar>
          <PageNavbar.Title>요리 기록</PageNavbar.Title>
        </PageNavbar>
        <View style={styles.center}>
          <Txt typography="st9" color={colors.grey700}>
            불러오는 중이에요…
          </Txt>
        </View>
        <BottomTabBar active="none" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.root}>
        <PageNavbar>
          <PageNavbar.Title>요리 기록</PageNavbar.Title>
        </PageNavbar>
        <View style={styles.center}>
          <Txt typography="st9" color={colors.grey700}>
            {error ?? '기록을 찾을 수 없어요.'}
          </Txt>
        </View>
        <BottomTabBar active="none" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>{data.recipe.dishName}</PageNavbar.Title>
      </PageNavbar>

      <TopAdBanner slot="cooking-detail-top" />

      <ScrollView contentContainerStyle={styles.content}>
        <Image
          source={{ uri: data.photoUrl }}
          style={styles.photo}
          accessibilityLabel={`${data.recipe.dishName} 사진`}
        />
        <Rating readonly value={data.rating} variant="full" size="medium" max={5} />
        <Txt typography="st9" color={colors.grey800}>
          {data.review}
        </Txt>

        <RecipeDisplay recipe={data.recipe} />

        {deleteError ? (
          <Txt typography="st11" color={colors.red700}>
            {deleteError}
          </Txt>
        ) : null}

        <Button
          type="danger"
          style="fill"
          display="block"
          size="medium"
          loading={deletePending}
          disabled={deletePending}
          onPress={handleDelete}
        >
          기록 삭제
        </Button>
      </ScrollView>

      <BottomTabBar active="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 96,
  },
  photo: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    backgroundColor: colors.grey100,
  },
});
