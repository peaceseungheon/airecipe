/**
 * Recipe Tab Landing — `/recipe`. 레시피 생성 진입(요리명·인분 입력) + 오늘의 추천 CTA + 약관 푸터.
 *
 * SSOT: 07-ROUTING §7.3.x(레시피 탭), ADR-021(3탭 재편 — 기존 홈 콘텐츠 이전).
 *
 * 정책:
 * - ADR-021: 기존 `pages/index.tsx`(홈) 콘텐츠(SearchForm + "오늘의 추천" CTA + 약관/개인정보 푸터)를
 *   레시피 탭(`/recipe`)으로 이전. 홈(`/`)은 요리 기록 피드로 전환.
 * - 공개 generate 엔드포인트라 본 화면에서 useTossUserId 사용하지 않는다(Phase 2 baseline §F.1).
 * - SearchForm 제출 시 navigation.navigate('/recipe/generate', { dishName, servings }).
 * - 화면 최하단에 `<BottomTabBar active="recipe" />` 1줄 마운트(ADR-021).
 */

import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { Button, PageNavbar, Txt, colors } from '@toss/tds-react-native';

import { BottomTabBar } from '../../src/components/BottomTabBar';
import { SearchForm } from '../../src/components/SearchForm';

export const Route = createRoute('/recipe', {
  component: RecipeHomePage,
});

function RecipeHomePage() {
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

  const handleOpenTerms = useCallback(() => {
    navigation.navigate('/terms', {});
  }, [navigation]);

  const handleOpenPrivacy = useCallback(() => {
    navigation.navigate('/privacy', {});
  }, [navigation]);

  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>레시피</PageNavbar.Title>
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

        <View style={styles.footer}>
          <Pressable
            onPress={handleOpenTerms}
            accessibilityRole="link"
            accessibilityLabel="서비스 이용약관"
          >
            <Txt typography="st11" color={colors.grey500}>
              서비스 이용약관
            </Txt>
          </Pressable>
          <Txt typography="st11" color={colors.grey300}>
            ·
          </Txt>
          <Pressable
            onPress={handleOpenPrivacy}
            accessibilityRole="link"
            accessibilityLabel="개인정보처리방침"
          >
            <Txt typography="st11" color={colors.grey500}>
              개인정보처리방침
            </Txt>
          </Pressable>
        </View>
      </ScrollView>

      <BottomTabBar active="recipe" />
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
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
