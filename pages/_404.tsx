/**
 * Granite 폴백 _404 페이지 — 라우트 미매칭 진입 시 표시.
 *
 * SSOT: 10-SPRINT-PLAN §10.6, ADR-005, ADR-012 D16, ADR-015 D40.
 *
 * 정책:
 * - 비게임 미니앱 검수 의무로 TDS 컴포넌트 사용. raw `<Text/>` 금지.
 * - 404 단일 컴포넌트 정책(D16) — `NotFoundScreen`을 재사용해 단건 404와 동일 UI.
 * - navigation.canGoBack() 가능 시 뒤로, 아니면 `/`로 폴백.
 */

import React, { useCallback } from 'react';
import { useNavigation } from '@granite-js/react-native';

import { NotFoundScreen } from '../src/components/NotFoundScreen';

export default function NotFoundPage() {
  const navigation = useNavigation();
  const handleBack = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate('/', {});
    }
  }, [navigation]);

  return <NotFoundScreen onBack={handleBack} />;
}
