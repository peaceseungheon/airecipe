/**
 * BottomTabBar — 커스텀 고정 하단 탭바 (ADR-017 D53·D57).
 *
 * SSOT: ADR-017 §1(실증)·§2(D53~D62), _workspace/01_architect_baseline.md §B.1,
 *       07-ROUTING §7.8.1.
 *
 * 배경:
 * - Granite Router는 NativeStack을 고정 마운트하고 1급 탭 네비게이터 export가 없으며
 *   TDS에 하단 탭바 전용 컴포넌트도 없다(ADR-017 §1). → 유일하게 계약-정합한 방식은
 *   TDS 프리미티브(Txt/colors) + RN Pressable/View로 합성한 고정 하단 바를
 *   탭 노출 화면(`/`·`/my-recipes`)이 직접 렌더하는 것(D53).
 *
 * 정책:
 * - 단일 SSOT 컴포넌트(D57). 홈/마이가 각각 `<BottomTabBar active="home"|"my" />` 1줄로 마운트.
 * - 탭 전환은 `navigation.navigate(path, {})` (push 아님 — 재포커스, D55). 새 라우트 0개.
 * - 활성 판정은 화면이 명시 전달한 `active` prop(런타임 라우트 상태 의존 제거, §3.4).
 * - 색은 TDS `colors` 토큰만 — 활성 `colors.orange500` / 비활성 `colors.grey500`.
 *   hex 직접 사용 금지(ADR-015 D39 / 06-UI-MAPPING §6.1).
 *   활성 토큰 확정(architect): `colors.orange500`(= 주황, light hex 토큰이 brand primaryColor와 최근접
 *      실재 토큰). D59의 1순위 `colors.primary`는 설치된 `@toss/tds-colors@0.1.0`에 **부재**(키 없음,
 *      TS2339 typecheck 실패로 확인)이고, `colors.blue500`은 brand(주황)와 이질이라 기각.
 * - 라벨 only(D60) — `Icon name`은 자유 문자열이라 실재 미검증 키 렌더 리스크가 있어
 *   본 v1은 라벨로만 출하. SafeArea는 `paddingBottom` 상수 폴백(D61) —
 *   `react-native-safe-area-context`가 선언 의존성이 아니므로 인셋 훅 미사용.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@granite-js/react-native';
import { Txt, colors } from '@toss/tds-react-native';

export type TabKey = 'home' | 'my';

export interface BottomTabBarProps {
  /** 현재 화면이 자신의 활성 탭을 명시 전달 (런타임 상태 의존 제거 — D57/§3.4) */
  active: TabKey;
}

const TABS: { key: TabKey; label: string; path: '/' | '/my-recipes' }[] = [
  { key: 'home', label: '홈', path: '/' },
  { key: 'my', label: '마이 레시피', path: '/my-recipes' },
];

export function BottomTabBar({ active }: BottomTabBarProps) {
  const navigation = useNavigation();

  const handlePress = useCallback(
    (key: TabKey, path: '/' | '/my-recipes') => {
      if (key === active) return; // 동일 탭 재탭 no-op
      navigation.navigate(path, {}); // D55 — navigate(재포커스)
    },
    [navigation, active],
  );

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.item}
            onPress={() => handlePress(tab.key, tab.path)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Txt
              typography="st11"
              color={isActive ? colors.orange500 : colors.grey500}
            >
              {tab.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.grey200,
    backgroundColor: colors.white,
    paddingBottom: 12, // SafeArea 폴백 (D61) — useSafeAreaInsets 실재 확인 시 교체
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
});
