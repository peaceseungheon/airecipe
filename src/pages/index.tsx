/**
 * Home — `/`. 진입 시 요리명·인분 입력 후 생성 화면으로 진입.
 *
 * SSOT: 07-ROUTING §7.3.1, 06-UI-MAPPING §6.4.6 (PageNavbar 채택은 baseline §B.2),
 *       baseline §A.5 + §E.fe.
 *
 * Phase 2 정책:
 * - 마이 레시피 버튼은 Phase 3 진입(disabled placeholder).
 * - 공개 generate 엔드포인트라 본 화면에서 useTossUserId 사용하지 않는다 (baseline §F.1).
 * - SearchForm 제출 시 navigation.navigate('/recipe/generate', { dishName, servings }).
 */

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { PageNavbar, Txt } from '@toss/tds-react-native';

import { SearchForm } from '../components/SearchForm';

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
          <Txt typography="t1" color="#191F28">
            오늘 무엇을 만들어 볼까요?
          </Txt>
          <Txt typography="st9" color="#4E5968">
            요리 이름과 인분을 입력하면 AI가 재료·조리법·영양 정보를 한 번에 알려드려요.
          </Txt>
        </View>

        <SearchForm onSubmit={handleSubmit} />
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
  intro: {
    gap: 8,
  },
});
