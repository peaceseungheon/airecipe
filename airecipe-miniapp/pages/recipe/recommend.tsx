/**
 * Recipe Recommend — `/recipe/recommend`. 테마 선택 → 추천 5개 카드 → 카드 탭 시 generate (Phase 6).
 *
 * SSOT: 07-ROUTING §7.3.6, 06-UI-MAPPING §6.10, 03-API-CONTRACT §3.8, ADR-016 D49.
 *
 * 책임:
 * - 식별자 가드 → ThemePicker → "추천받기" CTA → useRecommendations 결합 → 카드 5개 + AI 면책.
 * - 카드 탭 → `/recipe/generate?dishName=<선택>` (기존 SearchForm initialDishName 재사용).
 * - 테마 미선택 시 CTA disabled (AC6.1). 변경 시 자동 재호출(D51) + refresh()로 동일 테마 재요청.
 *
 * 불변식 (Phase 4·5 누적 + ADR-016):
 * - 보호 화면 — `useTossUserId` 필수(D47).
 * - 직접 fetch/api-client 호출 0건 — `useRecommendations`만.
 * - 추천은 ephemeral — id 없음. 카드 탭 데이터는 `dishName`만 URL 파라미터로 전달(D45).
 * - hex 직접 사용 0건 — `colors.*` 토큰 (ADR-015 D39).
 * - AI 면책 1줄(D52) — `Txt typography="st11" color={colors.grey600}` fixed.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { Button, PageNavbar, Txt, colors } from '@toss/tds-react-native';

import { BottomTabBar } from '../../src/components/BottomTabBar';
import { RecommendationCard } from '../../src/components/RecommendationCard';
import { ThemePicker } from '../../src/components/ThemePicker';
import { useRecommendations } from '../../src/hooks/useRecommendations';
import { useTossUserId } from '../../src/hooks/useTossUserId';
import type { RecommendationTheme } from '../../src/lib/zod/recommendations';

export const Route = createRoute('/recipe/recommend', {
  component: RecommendPage,
});

function RecommendPage() {
  const navigation = useNavigation();
  const { tossUserId } = useTossUserId();
  const [theme, setTheme] = useState<RecommendationTheme>({});
  const { items, isLoading, error, refresh } = useRecommendations(theme);

  const selected = theme.situation !== undefined || theme.weather !== undefined;

  const handleSelectDish = useCallback(
    (dishName: string) => {
      navigation.navigate('/recipe/generate', { dishName });
    },
    [navigation],
  );

  if (tossUserId === undefined) {
    return (
      <View style={styles.root}>
        <PageNavbar>
          <PageNavbar.Title>오늘의 추천</PageNavbar.Title>
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

  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>오늘의 추천</PageNavbar.Title>
      </PageNavbar>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Txt typography="t4" color={colors.grey900}>
            오늘 어떤 상황인가요?
          </Txt>
          <Txt typography="st9" color={colors.grey700}>
            상황과 날씨를 선택하면 5가지 요리를 추천해드릴게요.
          </Txt>
        </View>

        <ThemePicker value={theme} onChange={setTheme} />

        <View style={styles.actionRow}>
          <Button
            type="primary"
            style="fill"
            display="block"
            size="medium"
            disabled={!selected || isLoading}
            onPress={refresh}
          >
            {isLoading ? '추천을 받고 있어요…' : '다시 추천받기'}
          </Button>
        </View>

        {!selected ? (
          <View style={styles.hint}>
            <Txt typography="st9" color={colors.grey500}>
              상황 또는 날씨 중 하나 이상을 선택해주세요.
            </Txt>
          </View>
        ) : isLoading && items.length === 0 ? (
          <View style={styles.center}>
            <Txt typography="st9" color={colors.grey700}>
              추천을 만들고 있어요…
            </Txt>
          </View>
        ) : error ? (
          <View style={styles.errorBox} accessibilityLabel="추천 조회 실패">
            <Txt typography="t5" color={colors.red700}>
              추천을 불러오지 못했어요
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
                onPress={refresh}
              >
                다시 시도
              </Button>
            </View>
          </View>
        ) : items.length > 0 ? (
          <View style={styles.list}>
            {items.map((item, idx) => (
              <RecommendationCard
                key={`${item.dishName}-${idx}`}
                item={item}
                onPress={() => handleSelectDish(item.dishName)}
              />
            ))}
            <Txt
              typography="st11"
              color={colors.grey600}
              style={styles.disclaimer}
            >
              AI가 생성한 참고용 추천이에요. 식당·식자재 등 실제 상황을 고려해 선택해주세요.
            </Txt>
          </View>
        ) : null}
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
  scrollContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 24,
  },
  intro: {
    gap: 6,
  },
  actionRow: {
    marginTop: 4,
  },
  hint: {
    paddingVertical: 24,
    alignItems: 'center',
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
  disclaimer: {
    marginTop: 8,
    textAlign: 'center',
  },
});
