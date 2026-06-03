# pages — Granite 파일 기반 라우팅 + 화면별 PageNavbar

> 라우트 구현의 정본 위치는 **이 디렉터리(라우팅 루트 `pages/`)** 다 (ADR-018). 이전의 `src/pages/`(구현) + `pages/`(shim) 2계층은 제거됐다. `require.context('./pages')` + 자동 생성 `src/router.gen.ts`(`from '../pages/'`)가 이 디렉터리를 스캔한다.

## 책임

`pages/<path>.tsx` 위치가 곧 라우트 경로(Granite 파일 라우팅, 07-ROUTING §7.2). 각 화면은 (1) `createRoute` export, (2) `Route.useParams()`로 params 수신, (3) `useNavigation()`로 화면 이동, (4) `<PageNavbar>` 직접 렌더, (5) 상태·호출 결합을 담당한다. presentational 컴포넌트는 `src/components/`로 위임. `src/` 형제(`components`/`hooks`/`lib`) 참조는 깊이에 따라 `../src/...`(depth1) 또는 `../../src/...`(depth2).

## 파일

| 파일 | 라우트 | 책임 | SSOT |
|------|--------|------|------|
| `index.tsx` | `/` (홈) | PageNavbar + SearchForm + `<BottomTabBar active="home" />`(ADR-017). 제출 → `/recipe/generate` 진입 (params). "오늘의 추천" CTA → `/recipe/recommend`. 공개 endpoint — useTossUserId 미사용 | 07 §7.3.1, ADR-016 D50, ADR-017 D56·D58 |
| `recipe/generate.tsx` | `/recipe/generate` | PageNavbar + SearchForm + 진행 인디케이터 + 에러 박스 + RecipeDisplay/NutritionPanel + **저장 버튼**(`useSaveRecipe` 결합 → `/recipe/[id]` 직진). 공개 endpoint — useTossUserId 미사용 (useSaveRecipe는 훅 내부에서 사용) | 07 §7.3.2, 08 §8.3~8.5 |
| `recipe/recommend.tsx` | `/recipe/recommend` | 보호 화면 — useTossUserId 가드 + useRecommendations 결합. 미선택/로딩/에러/정상 분기 + ThemePicker + RecommendationCard. 카드 탭 → `/recipe/generate` 재사용. AI 면책 1줄 | ADR-016 D44~D52 |
| `my-recipes.tsx` | `/my-recipes` | 보호 화면 — useTossUserId 가드 + useMyRecipes 결합 + `<BottomTabBar active="my" />`(ADR-017). 상단 FilterTabs(전체/즐겨찾기) + RecipeCard.onToggleFavorite(낙관적 mutate). 빈+정상 양쪽 하단 `<AppInlineAd slot="my-recipes-bottom" />`(로딩/에러 미렌더). 단순 페이지네이션(이전/다음 + `meta.pageSize` 신뢰) | 07 §7.3.3, ADR-012 D14·D15·D18, ADR-013 D4·D9·D11, ADR-014 D30, ADR-017 D56 |
| `recipe/[id].tsx` | `/recipe/[id]` | 보호 화면 — useTossUserId 가드 + useRecipeDetail 결합. 로딩/404/에러/정상 4-way 분기. 404 → `<NotFoundScreen onBack={...} />` 단일 컴포넌트. PageNavbar.AccessoryButtons에 FavoriteButton + 본문 하단 삭제 Button + DeleteConfirmDialog. 낙관적 mutate(D4) + 삭제 성공·404 정규화 후 handleBack(D8). handleBack은 `canGoBack?.()` + fallback `/my-recipes` | 07 §7.3.4, ADR-005, ADR-012 D14·D16, ADR-013 D5·D6·D7·D8·D9 |
| `terms.tsx` | `/terms` | **공개 정적 화면** — 서비스 이용약관 본문(제1조~제10조 + 시행일)을 모듈 상수(`ARTICLES`)로 `ScrollView` 렌더. `PageNavbar.Title` + `<BottomTabBar active="none" />`. useTossUserId/fetch/hooks 0건. 진입은 홈 푸터 링크. 사업자 정보 placeholder는 출시 전 확정 | 07 §7.3.7, ADR-020, ADR-017 D63 |
| `privacy.tsx` | `/privacy` | **공개 정적 화면** — 개인정보처리방침 본문(8절 + 시행일)을 모듈 상수(`SECTIONS`)로 `ScrollView` 렌더. 제4절에 AI Provider 제3자 전송 고지. 동일 컨벤션·진입점 | 07 §7.3.8, ADR-020, ADR-017 D63 |
| `_404.tsx` | (Granite 폴백) | 라우트 미매칭 진입 시 표시. `<NotFoundScreen />` 재사용(카피는 진입 폴백용 분기). 우측 "닫기" → `/` 이동 + canGoBack 폴백 | 10 §10.6, ADR-005, ADR-012 D16, ADR-015 D40 |

## 규약 (강제)

- **라우트 경로 = 파일 경로** — `pages/recipe/generate.tsx` ↔ `/recipe/generate`. 변경 금지 (07 §7.4 매핑 요약표).
- **`router.gen.ts` 수동 수정 금지** — Granite 자동 생성. `from '../pages/'`로 이 디렉터리를 가리킴. 무해 lint warning 1건은 자동 생성 한계 (ADR-010 §6.4).
- **`src/pages/` 신규 생성 금지** — 라우트 구현은 이 디렉터리 단일 계층(ADR-018). shim 재export 패턴 부활 금지.
- **`createRoute` export 패턴** — 각 화면은 `export const Route = createRoute('/path', { component, validateParams? })`. component는 화면 함수 컴포넌트.
- **`href`/`useRouter`/`<Link>` 사용 금지** — Granite는 `useNavigation().navigate(path, params)` + `Route.useParams()` 사용 (07 §7.2 #3·#4).
- **`useAuth` 사용 금지** — Toss 식별이 자동 (ADR-009 D2). 로그인/로그아웃 분기 없음.
- **공개 endpoint 화면(`/`, `/recipe/generate`)에서 `useTossUserId` 미사용** — 헤더 미부착(05 §5.3, 03 §3.2.1, AC2.6). 보호 화면(`/my-recipes`, `/recipe/[id]`, `/recipe/recommend`)은 `useTossUserId` 필수.
- **보호 화면 식별자 가드 패턴** — `useTossUserId().tossUserId === undefined` → Loading/Spinner 렌더 + 데이터 훅 호출 차단. 발급 완료 시 데이터 훅 호출.
- **`PageNavbar`는 화면 본문에서 직접 렌더** — 글로벌 layout 없음 (07 §7.8). compound API(`PageNavbar.Title` 등)만 사용. 공통 래퍼 `AppNavbar.tsx` 만들지 않음 (ADR-011 D12).
- **fetch 직접 호출 0건** — 모든 데이터 호출은 hooks/(useRecipeGenerate/useMyRecipes/useRecipeDetail/useSaveRecipe/useRecommendations) 통한다. recipes.ts/api-client 직접 호출도 금지.
- **404 UI는 `<NotFoundScreen onBack={...} />` 단일 컴포넌트만** — `<ErrorPage statusCode={404}>` 직접 렌더 + 인라인 "찾을 수 없어요" 텍스트 0건 (ADR-012 D16).
- **`useMyRecipes`의 `meta.pageSize` 신뢰** — lastPage 계산은 `Math.ceil(meta.total / meta.pageSize)`. `query.pageSize`로 계산 금지 (ADR-006 clamp 적용값과 일관).
- **낙관적 UI는 호출 측 책임** — ADR-013 D19. 페이지가 (a) `mutate(next)` 즉시 적용 → (b) `await toggle(id, target)` → (c) `null` 시 `mutate(prev)` 롤백.
- **`useToggleFavorite`는 단일 hook 인스턴스로 카드 목록 공유** — ADR-013 D24. 카드 map 안에서 hook 호출 금지(rules of hooks). 페이지 상단 1회 호출 후 `toggle(id, target)` + `pendingId === card.id` 패턴.
- **`BottomTabBar`는 노출 화면이 직접 마운트** — ADR-017 D55. `/`·`/my-recipes`만 노출, props `{ active: 'home'|'my' }`. 새 라우트·router.gen.ts 변경 0. `scrollContent`에 `paddingBottom` 확보.

## SSE 상태 결합 패턴 (`recipe/generate.tsx` 인용)

- `useRecipeGenerate()`의 외부 인터페이스(`{ status, recipe, error, generate, cancel, reset }`)만 의존 (08 §8.3.2).
- **`progressText` 미참조** — 인디케이터만 렌더. text 청크 사용자 표시 금지 (ADR-011 D11).
- **취소 버튼은 `reset()`** 사용 (cancel이 아님). `reset()`은 동기 setState(`status='idle'`)까지 보장 — 인디케이터가 즉시 사라져 UX 일관(AC2.2).
- **초기 진입 자동 1회 생성** — `useRef` 가드로 `params.dishName`이 있으면 1회만 generate.
- **다시 시도** — `reset()` 후 동일 params로 `generate()` 재호출. 새 AbortController 자동 생성.

## 네비게이션 흐름 매트릭스

| 진입점 → 도착 | 호출 |
|-------------|------|
| 홈(`/`) → 마이 목록 | 하단 탭바 `navigation.navigate('/my-recipes', {})` (ADR-017) |
| 홈(`/`) → 생성 | `navigation.navigate('/recipe/generate', { dishName, servings })` |
| 홈(`/`) → 추천 | `navigation.navigate('/recipe/recommend', {})` (ADR-016 D50 CTA) |
| 마이 목록 → 상세 | `navigation.navigate('/recipe/[id]', { id: recipe.id })` |
| 마이 목록 → 생성 (EmptyState 액션) | `navigation.navigate('/recipe/generate', {})` |
| 추천 카드 → 생성 | `navigation.navigate('/recipe/generate', { dishName, ... })` (ADR-016 재사용) |
| 생성 저장 성공 → 상세 | `navigation.navigate('/recipe/[id]', { id: saved.id })` — ADR-012 D17 직진 |
| 상세 → 뒤로 | `handleBack`: `canGoBack?.()` 확인 후 `goBack()` 또는 `/my-recipes` fallback |
| 생성 → 뒤로 / 다시 시도 | `reset()` (cancel 미사용) |

## 라우트 등록 정책 (출시 점검 영향)

- **등록 라우트** — `/`, `/recipe/generate`, `/my-recipes`, `/recipe/[id]`, `/recipe/recommend`, `/terms`, `/privacy`. `src/router.gen.ts` 자동 갱신, 수동 수정 금지(단 typecheck를 위해 신규 라우트는 빌드 전 수동 등록 — Phase 6·ADR-020 선례).
- 새 화면 추가 시 출시 검수 도메인 화이트리스트·딥링크(`intoss://airecipe/...`, prefix = `scheme://appName`) 영향 점검 (07 §7.6, 09-ENV-CONFIG).
- 비기능 화면(about 등) 추가 시 노출 영향 별 점검 (`appsintoss-publish-checklist` 스킬).
- **정적 콘텐츠 화면(`/terms`·`/privacy`, ADR-020)** — 외부 호출 0건·본문은 모듈 상수. 공개 화면이라 useTossUserId 미사용. 신규 외부 도메인 0건이라 화이트리스트 영향 없음. 본문 사업자 정보 placeholder는 출시 전 실제 값 확정 의무.

## 진입점

- Granite 진입점(`src/_app.tsx`)이 `TossUserIdProvider` 안쪽에 `RecipeCacheProvider`를 마운트 (ADR-012 D15). `pages/*.tsx`는 `require.context('./pages')`로 자동 등록되어 진입 가능.
- 외부 화면 이동: `useNavigation().navigate('/recipe/generate', { dishName, servings })`.

## 변경 트리거

- 새 화면 필요 → `pages/<path>.tsx` 신규(단일 계층 — shim 짝 만들지 않음) + `createRoute` + 07 §7.3·§7.4 갱신 + (필요 시) 본 AGENTS.md 표 갱신.
- 보호 화면 추가 → `useTossUserId` 가드 + 적용 가능 시 `<NotFoundScreen />` 단일 컴포넌트 분기 (ADR-012 D16).
- 캐시 무효화 트리거 추가(예: 즐겨찾기 PATCH 후) → `useRecipeCacheTrigger.invalidate()` 호출 위치 추가 (ADR-012 D15).

## 관련 ADR / 챕터

- [ADR-005](../docs/adr/ADR-005-ownership-violation-404.md) — 소유권 위반 404 통일 (`<NotFoundScreen />` 단일 컴포넌트 정책 + `/recipe/[id]` handleBack fallback 근거).
- [ADR-009](../docs/adr/ADR-009-appsintoss-port-architecture.md) D2 — auth/* 제외, useAuth 미사용.
- [ADR-010](../docs/adr/ADR-010-miniapp-phase1-conventions.md) §6.4 — `router.gen.ts` 자동 생성·수동 수정 금지.
- [ADR-011](../docs/adr/ADR-011-miniapp-phase2-streaming-ui.md) D11/D12 — text 청크 미표시, PageNavbar 채택.
- [ADR-012](../docs/adr/ADR-012-miniapp-phase3-routing-cache-404.md) D14~D18 — Phase 3 라우트·캐시·404·저장 흐름·페이지네이션.
- [ADR-013](../docs/adr/ADR-013-miniapp-phase4-favorite-delete.md) — 즐겨찾기·삭제 낙관적 UI.
- [ADR-016](../docs/adr/ADR-016-recommendations.md) D44~D52 — 테마 기반 추천 화면.
- [ADR-017](../docs/adr/ADR-017-bottom-tab-navigation.md) D53~D62 — 하단 탭바.
- [ADR-018](../docs/adr/ADR-018-route-pages-consolidation.md) — 라우트 구현을 `pages/`로 통합·shim 제거(본 디렉터리 정본화).
- [07-ROUTING.md](../docs/appsintoss-port/07-ROUTING.md) §7.2·§7.3·§7.5·§7.7·§7.8 — Granite 라우팅·하드웨어 백·Navbar 분산.
- [08-STREAMING.md](../docs/appsintoss-port/08-STREAMING.md) §8.3.2·§8.4 — useRecipeGenerate 외부 인터페이스·AbortController.
