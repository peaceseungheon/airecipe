/**
 * Home — `/`. 진입 시 요리명·인분 입력 후 생성 화면으로 진입.
 *
 * SSOT: 07-ROUTING §7.3.1, 06-UI-MAPPING §6.4.6 (PageNavbar 채택은 Phase 2 baseline §B.2),
 *       Phase 2 baseline §A.5 + §E.fe, Phase 3 baseline §A.3·§C.5.
 *
 * 정책:
 * - 공개 generate 엔드포인트라 본 화면에서 useTossUserId 사용하지 않는다 (Phase 2 baseline §F.1).
 * - SearchForm 제출 시 navigation.navigate('/recipe/generate', { dishName, servings }).
 * - ADR-017 D58: 마이 레시피 진입은 하단 탭바(BottomTabBar)가 전담 — PageNavbar 우측
 *   "마이 레시피" 액세서리 버튼은 중복이라 제거. PageNavbar는 Title만 유지.
 * - ADR-017 D57: 화면 최하단에 `<BottomTabBar active="home" />` 1줄 마운트.
 *   "오늘의 추천 받기" CTA(ADR-016 D50)는 유지.
 */

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { Button, PageNavbar, Txt, colors } from '@toss/tds-react-native';

import { BottomTabBar } from '../src/components/BottomTabBar';
import { SearchForm } from '../src/components/SearchForm';

export const Route = createRoute('/', {
  component: HomePage,
});

function HomePage() {
  const navigation = useNavigation();

  const handleSubmit = useCallback(
    (dishName: string, servings: number) => {
      navigation.navigate('/recipe/generate', { dishName, servings });
    },
    [navigation],
  );

  const handleOpenRecommend = useCallback(() => {
    navigation.navigate('/recipe/recommend', {});
  }, [navigation]);

  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>AI 레시피</PageNavbar.Title>
      </PageNavbar>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Txt typography="t1" color={colors.grey900}>
            오늘 무엇을 만들어 볼까요?
          </Txt>
          <Txt typography="st9" color={colors.grey700}>
            요리 이름과 인분을 입력하면 AI가 재료·조리법·영양 정보를 한 번에 알려드려요.
          </Txt>
        </View>

        <SearchForm onSubmit={handleSubmit} />

        <View style={styles.recommendCta}>
          <Button
            type="light"
            style="weak"
            display="block"
            size="medium"
            onPress={handleOpenRecommend}
          >
            오늘의 추천 받기
          </Button>
        </View>
      </ScrollView>

      <BottomTabBar active="home" />
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
    paddingBottom: 24, // 하단 탭바 가림 방지 (ADR-017 D61)
  },
  intro: {
    gap: 8,
  },
  recommendCta: {
    marginTop: 8,
  },
});
