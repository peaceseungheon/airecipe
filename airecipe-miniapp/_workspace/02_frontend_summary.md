# 02 — Frontend Summary: 이용약관 + 개인정보처리방침 정적 페이지 + 홈 푸터 링크

작업: `/terms`·`/privacy` 정적 페이지 2개 신규 + 홈(`/`) 하단 푸터 진입 링크. 공개 화면(useTossUserId 미사용, 외부 호출 0건). pages/AGENTS.md SSOT 규약 준수.

## 생성 파일 (2)

| 파일 | 라우트 | 컴포넌트 | 책임 |
|------|--------|----------|------|
| `pages/terms.tsx` | `/terms` | `TermsPage` | 서비스 이용약관 정적 본문(제1조~제10조 + 시행일) ScrollView 렌더. PageNavbar.Title="서비스 이용약관" + BottomTabBar active="none". |
| `pages/privacy.tsx` | `/privacy` | `PrivacyPage` | 개인정보처리방침 정적 본문(수집 항목~방침 변경 8절 + 시행일) ScrollView 렌더. PageNavbar.Title="개인정보처리방침" + BottomTabBar active="none". |

## 수정 파일 (2)

| 파일 | 변경 |
|------|------|
| `pages/index.tsx` | (1) `Pressable` import 추가 (2) `handleOpenTerms`/`handleOpenPrivacy` useCallback 추가 (3) recommendCta View 다음에 푸터 `View`(약관·점·처리방침 가로 배치) 추가 (4) `footer` style 추가. 기존 SearchForm·recommend CTA·BottomTabBar 로직 무변경. |
| `src/router.gen.ts` | `/terms`·`/privacy` 2개 라우트 수동 등록(import 라인 2 + RegisterScreenInput 2 + RegisterScreen 2). 알파벳 정렬(privacy는 my-recipes/recipe 사이, terms는 말미). Phase 6 `/recipe/recommend` 수동 등록 선례 동일. granite build 시 자동 재생성. |

## 라우트 / navigate 시그니처

- `/terms` ← `navigation.navigate('/terms', {})` (홈 푸터 "서비스 이용약관" Pressable)
- `/privacy` ← `navigation.navigate('/privacy', {})` (홈 푸터 "개인정보처리방침" Pressable)
- 두 페이지 모두 params 없음(빈 객체). typecheck로 navigate 호출 ↔ router.gen.ts RegisterScreenInput 매칭 검증 PASS.

## 사용한 TDS 컴포넌트 (실재 확인)

- `PageNavbar` + `PageNavbar.Title` — @toss/tds-react-native. 기존 전 페이지 동일 사용.
- `Txt` (typography t5/st9/st11, color grey300/grey500/grey700/grey900) — 동일 패키지. grey300·grey500 토큰 `Color.d.ts` 실재 확인 + typecheck 검증.
- `colors` — TDS 토큰. hex 직접 사용 0건(ADR-015 D39).
- `BottomTabBar` (`../src/components/BottomTabBar`, active="none" — ADR-017 D63 비-탭 화면).
- RN 프리미티브: `ScrollView`(contentContainerStyle, paddingBottom 24)·`View`·`Pressable`(홈 푸터 링크, accessibilityRole="link").

## 검증 결과

- `pnpm typecheck` — PASS (tsc --noEmit, 에러 0).
- `pnpm lint` — 0 errors, 1 warning(`src/router.gen.ts` 누적 unused eslint-disable — 자동 생성 한계, 기존 무해 warning. 신규 error 0).

## 본문 `[ ]` placeholder (출시 전 채울 항목)

### terms.tsx
- 제10조 (관할 법원): `[관할 법원 — 출시 전 사업자 소재지 기준 확정]`
- JSDoc 주석: 회사 법인명·대표자·사업자등록번호(제2조 "회사" 식별) — 콘솔 등록값과 동기.

### privacy.tsx
- 제7조 개인정보 보호책임자: `[보호책임자 성명·직책 — 출시 전 확정]`
- 제7조 문의(고객센터): `[고객센터 — 앱인토스 콘솔 고객센터 채널 연동, 출시 전 확정]`
- JSDoc 주석: 사업자 법인명(개인정보처리자 식별) — 콘솔 등록값과 동기.

## architect/qa 인계

- **architect**: 07-ROUTING에 §7.3.7(`/terms`)·§7.3.8(`/privacy`) 절 신설 + 라우트 표/Navbar 분산 표 행 추가 필요. pages/AGENTS.md 파일 표에 2행 추가. 페이지 JSDoc은 "신규(architect 확정 예정)"로 표기해둠 — 절 번호 확정 시 갱신. 06-UI-MAPPING 정적 페이지 패턴 절 검토. 출시 점검: 새 라우트 2개 deep link prefix(`intoss://airecipe/terms`·`/privacy`) 영향. appsintoss-publish-checklist의 약관·처리방침 등록 항목과 본 페이지 연결 검토.
- **qa**: (1) navigate 호출 ↔ router.gen.ts 라우트 매칭 (2) TDS 컴포넌트 실재성 (3) 공개 화면 정책(useTossUserId/fetch/hooks 0건) (4) BottomTabBar active="none" 마운트 (5) hex 0건 (6) 홈 기존 로직 무회귀 교차 검증 요청.
