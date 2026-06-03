# ADR-020 — 서비스 이용약관·개인정보처리방침 인앱 정적 페이지

- **상태:** Accepted
- **날짜:** 2026-06-01
- **맥락 범위:** 미니앱 단독 (백엔드 무변경)
- **관련:** ADR-009(아키텍처), ADR-015 D39(hex→colors 토큰), ADR-017 D63(BottomTabBar active='none'), ADR-018(라우트 `pages/` 단일 계층), 07-ROUTING §7.3.7·§7.3.8

## 배경

앱인토스 검수와 일반적 서비스 신뢰 요건상 **서비스 이용약관**과 **개인정보처리방침**의 접근 경로가 필요했다. 본 미니앱은 회원가입/로그인이 없고(토스 익명 식별자), 입력 내용이 AI Provider(Gemini/Claude)로 전송되며 백엔드가 레시피를 저장하므로, 특히 개인정보처리방침에 **제3자(AI Provider) 전송 고지**가 요구된다.

사용자 결정(본 차):
1. 본문은 AI 요리 레시피 서비스에 맞춘 **표준 한국어 보일러플레이트를 생성**한다.
2. **이용약관 + 개인정보처리방침 두 문서 모두** 제공한다.
3. 진입점은 **홈 화면 하단 푸터 링크**.

## 결정 (D70~D74)

- **D70 — 외부 URL이 아닌 인앱 정적 라우트로 제공.** WebView/외부 링크 대신 `pages/terms.tsx`·`pages/privacy.tsx` 정적 화면. 근거: (a) 검수 시 약관 접근성이 앱 내에서 즉시 보장 (b) 오프라인·네트워크 무관 가용 (c) 외부 도메인 추가 0건 → 도메인 화이트리스트·CORS 영향 없음 (d) 호스팅·URL 관리 비용 제거. 본문은 모듈 상수(`ARTICLES`/`SECTIONS`)로 두어 추후 텍스트만 교체 가능.
- **D71 — 별 라우트 2개로 분리**(`/terms`·`/privacy`) — 단일 페이지+탭 합성 기각. 근거: 두 문서는 성격·길이가 다르고, 딥링크/외부 공유 시 독립 URL이 자연스러우며, Granite 파일 라우팅상 한 파일=한 라우트가 가장 단순(ADR-018 단일 계층 정합). 탭 합성은 불필요한 상태·컴포넌트를 추가.
- **D72 — 진입점은 홈 푸터 링크.** 별도 "설정/더보기" 화면 신설 기각 — 현재 설정 메뉴가 없고 약관 2건만을 위해 화면 계층을 늘리는 것은 과설계(범위 최소화). 홈(`/`) `ScrollView` 하단에 `Pressable`+`Txt`(grey500, `typography="st11"`) 텍스트 링크 2개를 은은한 푸터로 배치 → `navigation.navigate('/terms'|'/privacy', {})`. 기존 홈 로직(SearchForm·추천 CTA·BottomTabBar) 무변경.
- **D73 — 공개 정적 화면 정책.** 두 화면은 `useTossUserId`/api-client/fetch/hooks **호출 0건**(홈·generate와 동일한 공개 endpoint 정책). 식별자 가드 없음. TDS 의무 준수 — `PageNavbar`/`Txt`/`colors`만, hex 0건(ADR-015 D39). `<BottomTabBar active="none" />`로 비-탭 화면 정합(ADR-017 D63).
- **D74 — 사업자 정보는 placeholder + 출시 전 확정 의무.** 법인명·대표자·관할 법원·개인정보 보호책임자·고객센터 채널은 미확정이라 `[ ]` placeholder로 두고, 본문·JSDoc·검수 PENDING에 출시 전 실제 값 확정 의무를 명시. 고객센터는 앱인토스 콘솔 고객센터 채널과 연동.

## 결과

- `pages/terms.tsx` (신규) — `/terms`, `TermsPage`. 이용약관 제1조~제10조 + 시행일. 제6조에 AI 생성 콘텐츠 면책(정확성·안전성 미보장, 알레르기·식이제한·건강은 사용자 책임).
- `pages/privacy.tsx` (신규) — `/privacy`, `PrivacyPage`. 개인정보처리방침 8절 + 시행일. 제1절 비식별 수집 강조, 제4절 AI Provider(Google/Anthropic) 제3자 전송 고지.
- `pages/index.tsx` (수정) — 푸터 링크 2개 + 콜백 2개 + `footer` style. 기존 로직 무변경(surgical).
- `src/router.gen.ts` (수동 갱신) — `/terms`·`/privacy` 등록(알파벳 정렬, Phase 6 선례). `ait build` 시 자동 재생성.
- 문서: 07-ROUTING §7.3.7·§7.3.8 신설 + §7.4 매핑표 행 6·7 + §7.8.1 탭바 표 2행, pages/AGENTS.md 파일 표 2행 + 등록 라우트 목록 + 정적 화면 규약, 06-UI-MAPPING 정적 페이지 패턴.
- 검증: typecheck PASS, lint 0 errors(router.gen.ts 누적 warning 1건). hex 0건·금지 호출 0건 grep 확인.

## 검수 영향 점검 (appsintoss-publish-checklist)

- **딥링크 prefix** — 신규 `intoss://airecipe/terms`·`/privacy`(prefix=`scheme://appName`, appName=`airecipe`). 기존 라우트와 동일 메커니즘 → 콘솔 변경 **불필요**.
- **도메인 화이트리스트** — 정적 인앱 페이지라 신규 외부 도메인 호출 **0건** → 화이트리스트 변경 **불필요**.
- **검수 가산** — 약관·개인정보처리방침 인앱 제공은 검수에 유리.

## 외부 작업 PENDING

- **사업자 정보 확정(D74)** — 법인명·대표자·사업자등록번호·관할 법원(`pages/terms.tsx`), 개인정보 보호책임자 성명·연락처·고객센터 채널(`pages/privacy.tsx`)을 콘솔 등록값과 동기하여 placeholder 교체. 출시 전 필수.
- **법무 검토** — 생성된 표준 보일러플레이트는 일반 템플릿이므로, 실제 서비스 운영 형태에 맞춘 법무 검토 후 확정 권장.

## 보론 — 콘솔 URL 등록용 외부 정적 페이지 (D70 보완, 2026-06-01)

D70(인앱 정적)은 **앱 내 열람**을 위한 결정이다. 그러나 앱인토스 콘솔의 **이용약관 URL / 개인정보처리방침 URL 칸**은 외부에서 접근 가능한 공개 `https` 페이지를 요구하며, 인앱 Granite 라우트(`intoss://airecipe/terms` 딥링크)는 이 칸에 넣을 수 없다. 따라서 둘은 **상호 보완**으로 병행한다:

- **인앱 페이지**(`pages/terms.tsx`·`privacy.tsx`) — 앱 사용 중 홈 푸터에서 열람. UX·검수 가산.
- **외부 정적 페이지**(repo 루트 `legal/terms.html`·`privacy.html`) — 콘솔 URL 칸 등록용. 동일 보일러플레이트 사본. 빌드·의존성 0(HTML/CSS). Vercel 정적/GitHub Pages/Cloudflare Pages 등에 **백엔드(API 전용)와 별개 프로젝트**로 배포.

> ⚠️ **본문 이원화 유지보수**: 약관 텍스트가 인앱(`pages/*.tsx`)과 외부(`legal/*.html`) 두 곳에 존재한다. 수정 시 양쪽 동기 필수. 배포·등록 절차는 `legal/README.md` 참조.

## 보류 / 미채택

- **설정/더보기 화면** — 약관 2건만으로는 불필요(D72). 향후 알림 설정·정보 화면 등이 늘면 별 ADR로 설정 허브 도입 검토.
- **인앱 WebView로 외부 약관 임베드** — 인앱은 정적 네이티브 화면, 콘솔은 외부 URL로 역할 분리(위 보론). 약관이 빈번히 바뀌어 앱 배포 없이 인앱에서도 갱신해야 하는 운영 요건이 생기면 인앱 WebView+단일 출처를 재평가.
- **본문 단일 출처화** — 현재 인앱/외부 텍스트 이원화. 빌드 시 한 출처(예: `legal/*.html` 또는 공용 `.ts` 상수)에서 양쪽 생성하는 파이프라인은 과설계로 보류. 갱신 빈도가 높아지면 재검토.
- **약관 동의 게이트(최초 1회 동의 UX)** — 본 사이클 미도입(열람 제공만). 동의 이력 보관이 필요해지면 백엔드 계약 포함 별 ADR.
