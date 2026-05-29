# 세션 로그 — 하단 탭바([홈 / 마이 레시피]) 도입

> 날짜: 2026-05-29 · 기준 디렉토리 `airecipe-miniapp/` · monorepo 루트 `airecipe-router` → `miniapp-orchestrator` 위임.

## 요청
"내 레시피 저장 목록을 조회할 수 있는 탭을 만들어줘."

라우터 코드 확인 결과: 저장 목록 화면(`/my-recipes`)·백엔드 `GET /api/recipes`는 이미 완성. 빠진 것은 "탭 접근 방식". 사용자 확정 → **하단 탭바(bottom tab) [홈/마이 레시피] 2탭 상시 노출**. 미니앱 단독 작업(백엔드 무변경).

## 워크플로우 (오케스트레이터)
- Phase 3 (architect 단독 선행): Granite/TDS 하단 탭 실증 검증 → 방식 결정 + ADR-017 발행.
- Phase 4 (frontend): BottomTabBar 구현 + 두 화면 통합 + appName 회귀 수정.
- Phase 5 (qa + architect): 경계면 검증 + 색 결정 회부 + 문서 정합.

## 핵심 결정 (ADR-017 D53~D62)
- **방식 (C) 커스텀 고정 하단 탭바** — Granite는 탭 네비게이터 1급 미지원(`@granite-js/react-native@1.0.28` export 부재, Router는 NativeStack만 마운트), TDS에 하단 탭 전용 컴포넌트 없음(`Tab`=상단 세그먼트, `tab-view`=스와이프). (A)Granite 1급·(B)`@react-navigation/bottom-tabs` 모두 기각(미설치·루트 주입 슬롯 없음·deep link 파손 리스크).
- **단일 SSOT 컴포넌트** `BottomTabBar` props `{ active: 'home'|'my' }` — 탭 노출 화면(`/`·`/my-recipes`)이 직접 마운트. 탭 누름 → `navigation.navigate(path, {})`. **새 라우트·router.gen.ts 변경 0.**
- **노출 범위 (D56)**: `/`·`/my-recipes`만. generate/[id]/recommend/_404 미렌더.
- **홈 중복 제거 (D58)**: 홈 `PageNavbar.AccessoryTextButton "마이 레시피"` 제거(탭바가 전담). "오늘의 추천" CTA 유지.
- **활성 탭 색 (D59)**: `colors.orange500`(`#FF6B00`) — brand `primaryColor #FF6B35` 최근접 실재 토큰. `colors.primary` 부재(TS2339)·`colors.blue500` 브랜드 이질 기각. hex 직접 사용 금지(ADR-015 D39 정신 부합).
- **appName 회귀 동시 수정 (D62)**: `granite.config.ts` `appName: 'airecipe' → 'airecipe-miniapp'`. monorepo 병합(`05ef27c`)이 직전 hotfix의 원복값을 되돌린 **실재 회귀** — 미수정 시 진입이 `/_404`로 폴백. 콘솔 deep link prefix ↔ appName 1:1 동기는 출시 전 검증 의무.

## 산출 파일
- **신규**: `src/components/BottomTabBar.tsx` (단일 SSOT), `docs/adr/ADR-017-bottom-tab-navigation.md`.
- **수정**: `src/pages/index.tsx`(AccessoryTextButton 제거 + BottomTabBar + paddingBottom), `src/pages/my-recipes.tsx`(BottomTabBar 항상 노출 + paddingBottom, 목록 로직 무변경), `granite.config.ts`(appName 원복), `src/components/AGENTS.md`(BottomTabBar 행), `docs/appsintoss-port/07-ROUTING.md`(§7.8.1 신설), `docs/appsintoss-port/06-UI-MAPPING.md`(§6.1 색 규약 정합).
- **변경 0**: `src/router.gen.ts`, `src/_app.tsx`, api-client/hooks/zod/types, 스택 화면(`recipe/*`), `pages/_404.tsx`, `pages/*.tsx` shim.

## QA 결과 (`03_qa_report.md`)
- Q1~Q12 **12/12 PASS, FAIL 0**. typecheck PASS, lint 0 errors/1 warning(router.gen.ts 누적, 허용).
- 경계면: navigate ↔ router.gen.ts 라우트 키 일치, TDS 실재성 표본 10개 PASS(orange500 실재 포함), 데이터 경로 무영향(git diff empty).
- Q10 appName: 코드 측 문자열 1:1 PASS. **디바이스/샌드박스 dev 진입 실증(홈 정상·`/_404` 미표시)은 외부 단계 PENDING.**

## 외부 작업 PENDING
- 디바이스/샌드박스 dev 진입 실증(appName 회귀 수정 후 홈 정상 진입 + 하단 탭 동작 + iOS SafeArea 하단 겹침 확인).
- (후속 진화) 하단 탭 아이콘 추가(D60 — `Icon name` 실재 검증 후), SafeArea `insets.bottom` 훅 도입(현재 `paddingBottom: 12` 상수 폴백, D61).
