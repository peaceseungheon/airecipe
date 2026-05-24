/**
 * NotFoundScreen — 단일 404 UI (ADR-005 통일).
 *
 * SSOT: 06-UI-MAPPING §6.5(추가 컴포넌트), baseline §A.2·§B.3·§H.2 #13, ADR-005.
 *
 * 책임:
 * - 보호 단건 endpoint(GET /api/recipes/[id]·Phase 4 PATCH·DELETE) 404 응답 시 단일 화면.
 * - 없음·잘못된 id·타인 소유 모두 동일 UI(ADR-005 수렴 — IDOR 정보 누설 방지).
 *
 * 불변식 (baseline §H.2 #13):
 * - 화면별 분기 0건 — `pages/*`에서 "찾을 수 없어요" 텍스트·`<ErrorPage statusCode={404}>` 직접 렌더 금지.
 * - 항상 본 컴포넌트 1개만 사용. Phase 4 PATCH/DELETE 404 시점에서도 동일 재사용.
 *
 * TDS ErrorPage 시그니처 (`node_modules/.../ErrorPage.d.ts`):
 *   { statusCode?, title?, subtitle?, onPressLeftButton?, onPressRightButton?, children? }
 */

import React from 'react';
import { ErrorPage } from '@toss/tds-react-native';

export interface NotFoundScreenProps {
  /** 좌측 버튼(뒤로) 핸들러. 일반적으로 navigation.goBack(). */
  onBack: () => void;
}

export function NotFoundScreen({ onBack }: NotFoundScreenProps) {
  return (
    <ErrorPage
      statusCode={404}
      title="레시피를 찾을 수 없어요"
      subtitle="삭제되었거나 다른 사용자의 레시피일 수 있어요."
      onPressLeftButton={onBack}
    />
  );
}
