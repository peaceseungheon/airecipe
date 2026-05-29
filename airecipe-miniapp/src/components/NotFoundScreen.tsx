/**
 * NotFoundScreen — 단일 404 UI (ADR-005 통일).
 *
 * SSOT: 06-UI-MAPPING §6.5(추가 컴포넌트), baseline §A.2·§B.3·§H.2 #13, ADR-005.
 *
 * 책임:
 * - 보호 단건 endpoint(GET /api/recipes/[id]·Phase 4 PATCH·DELETE) 404 응답 시 단일 화면.
 * - 없음·잘못된 id·타인 소유 모두 동일 UI(ADR-005 수렴 — IDOR 정보 누설 방지).
 * - Granite 라우트 미매칭 폴백(`pages/_404.tsx`)에서도 재사용 — title/subtitle prop 분기.
 *
 * 불변식 (baseline §H.2 #13):
 * - 화면별 분기 0건 — `pages/*`에서 "찾을 수 없어요" 텍스트·`<ErrorPage statusCode={404}>` 직접 렌더 금지.
 * - 항상 본 컴포넌트 1개만 사용.
 *
 * TDS ErrorPage 시그니처 (`node_modules/.../ErrorPage.d.ts` + 실 구현 검증):
 *   { statusCode?, title?, subtitle?, onPressLeftButton?, onPressRightButton?, children? }
 *
 * **TDS 카피 매핑 (실 구현 SSOT)**:
 * - 좌측 버튼: 하드코딩 "고객센터 문의" (CS 의도) → `onPressLeftButton` 핸들러.
 * - 우측 버튼: statusCode 404·기본 시 "닫기" / 400 시 "다시 입력하기" → `onPressRightButton` 핸들러.
 * - 사용자가 기대하는 "닫기/뒤로"는 **우측 버튼**이므로 onBack은 `onPressRightButton`에 바인딩한다.
 */

import React from 'react';
import { ErrorPage } from '@toss/tds-react-native';

export interface NotFoundScreenProps {
  /** 우측 "닫기" 버튼 핸들러. 일반적으로 navigation.goBack() 또는 홈으로 이동. */
  onBack: () => void;
  /** 좌측 "고객센터 문의" 핸들러. 미제공 시 좌측 버튼 무동작(향후 CS deeplink 합성 예정). */
  onContactSupport?: () => void;
  /** 카피 override — 단건 404(default: 레시피)·진입 폴백 등에 따라 분기. */
  title?: string;
  subtitle?: string;
}

const DEFAULT_TITLE = '레시피를 찾을 수 없어요';
const DEFAULT_SUBTITLE = '삭제되었거나 다른 사용자의 레시피일 수 있어요.';

export function NotFoundScreen({
  onBack,
  onContactSupport,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
}: NotFoundScreenProps) {
  return (
    <ErrorPage
      statusCode={404}
      title={title}
      subtitle={subtitle}
      onPressLeftButton={onContactSupport}
      onPressRightButton={onBack}
    />
  );
}
