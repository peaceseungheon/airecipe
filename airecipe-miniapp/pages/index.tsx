/**
 * Feed (Home) — `/`. 내 요리 기록 피드(역순) + 우하단 FAB "올리기" (ADR-021).
 *
 * SSOT: 07-ROUTING §7.3.1, 설계 스펙 §2(메인=피드)·§7.4·AC1·AC4.
 *
 * 정책:
 * - ADR-021: 기존 홈(생성 폼)을 레시피 탭(`/recipe`)으로 이전하고, 홈(`/`)은 요리 기록 피드로 전환.
 * - 보호 화면 — useCookingFeed가 useTossUserId 헤더 부착. 식별자 미발급 시 로딩 표시.
 * - 직접 fetch/api-client 호출 0건 — useCookingFeed 훅만.
 * - FAB·FlatList 항목 탭 → /cooking-log/new · /cooking-log/:id.
 * - 색은 TDS colors 토큰만 — FAB 포함 hex 0건(ADR-015 D39).
 * - 화면 최하단에 `<BottomTabBar active="feed" />` 1줄 마운트(ADR-021).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { PageNavbar, Txt, colors } from '@toss/tds-react-native';

import { BottomTabBar } from '../src/components/BottomTabBar';
import { CookingLogCard } from '../src/components/CookingLogCard';
import { FeedEmptyState } from '../src/components/FeedEmptyState';
import { useCookingFeed } from '../src/hooks/useCookingFeed';
import { useTossUserId } from '../src/hooks/useTossUserId';

const PAGE_SIZE = 10;

export const Route = createRoute('/', {
  component: FeedPage,
});

function FeedPage() {
  const navigation = useNavigation();
  const { tossUserId } = useTossUserId();
  const [page] = useState(1);
  const query = useMemo(() => ({ page, pageSize: PAGE_SIZE }), [page]);
  const { data, isLoading, error } = useCookingFeed(query);

  const goNew = useCallback(() => {
    navigation.navigate('/cooking-log/new', {});
  }, [navigation]);

  const goDetail = useCallback(
    (id: string) => {
      navigation.navigate('/cooking-log/:id', { id });
    },
    [navigation],
  );

  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>요리 피드</PageNavbar.Title>
      </PageNavbar>

      {tossUserId === undefined || isLoading ? (
        <View style={styles.center}>
          <Txt typography="st9" color={colors.grey600}>
            불러오는 중이에요…
          </Txt>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Txt typography="st9" color={colors.grey600}>
            {error}
          </Txt>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <FeedEmptyState onAction={goNew} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CookingLogCard log={item} onPress={() => goDetail(item.id)} />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={goNew}
        accessibilityRole="button"
        accessibilityLabel="기록 올리기"
      >
        <Txt typography="t5" color={colors.white}>
          ＋ 올리기
        </Txt>
      </Pressable>

      <BottomTabBar active="feed" />
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 96,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 72,
    backgroundColor: colors.orange500,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
});
