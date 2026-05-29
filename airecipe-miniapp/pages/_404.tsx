/**
 * Granite 폴백 _404 페이지 — 라우트 미매칭 진입 시 표시.
 *
 * SSOT: 10-SPRINT-PLAN §10.6, ADR-005, ADR-012 D16, ADR-015 D40.
 *
 * 정책:
 * - 비게임 미니앱 검수 의무로 TDS 컴포넌트 사용. raw `<Text/>` 금지.
 * - 404 단일 컴포넌트 정책(D16) — `NotFoundScreen`을 재사용하되, 카피는 진입 폴백용으로 분기.
 * - 우측 "닫기" 버튼이 항상 동작 — `/`로 이동 시도 + canGoBack 폴백.
 * - 좌측 "고객센터 문의" 버튼은 본 미니앱에 CS deeplink 미연동이라 미바인딩(SSOT 진화 시 추가).
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigation } from '@granite-js/react-native';

import { NotFoundScreen } from '../src/components/NotFoundScreen';

export default function NotFoundPage() {
  const navigation = useNavigation();

  useEffect(() => {
    if (__DEV__) {
      try {
        const state = navigation.getState?.();
        console.warn(
          '[airecipe-miniapp] _404 fallback rendered. navigation.getState:',
          JSON.stringify(state, null, 2),
        );
      } catch (err) {
        console.warn(
          '[airecipe-miniapp] _404 fallback rendered. getState failed:',
          err,
        );
      }
    }
  }, [navigation]);

  const handleBack = useCallback(() => {
    try {
      navigation.navigate('/', {});
    } catch {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
      }
    }
  }, [navigation]);

  return (
    <NotFoundScreen
      title="원하시는 화면을 찾지 못했어요"
      subtitle="홈으로 이동해서 다시 시도해주세요."
      onBack={handleBack}
    />
  );
}
