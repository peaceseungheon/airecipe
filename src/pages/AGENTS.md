# src/pages — Granite 파일 기반 라우팅 + 화면별 PageNavbar

## 책임

`pages/<path>.tsx` 위치가 곧 라우트 경로(Granite 파일 라우팅, 07-ROUTING §7.2). 각 화면은 (1) `createRoute` export, (2) `Route.useParams()`로 params 수신, (3) `useNavigation()`로 화면 이동, (4) `<PageNavbar>` 직접 렌더, (5) 상태·호출 결합을 담당한다. presentational 컴포넌트는 `src/components/`로 위임.

## 파일

| 파일 | 라우트 | 책임 | SSOT |
|------|--------|------|------|
| `index.tsx` | `/` (홈) | PageNavbar(+AccessoryButtons 마이 진입) + SearchForm. 제출 → `/recipe/generate` 진입 (params). 공개 endpoint — useTossUserId 미사용 | 07 §7.3.1, Phase 2 baseline §A.5, Phase 3 baseline §A.3 #7 |
| `recipe/generate.tsx` | `/recipe/generate` | PageNavbar + SearchForm + 진행 인디케이터 + 에러 박스 + RecipeDisplay/NutritionPanel + **저장 버튼**(`useSaveRecipe` 결합 → `/recipe/[id]` 직진). 공개 endpoint — useTossUserId 미사용 (useSaveRecipe는 훅 내부에서 사용) | 07 §7.3.2, 08 §8.3~8.5, Phase 2 baseline §A.5, Phase 3 baseline §A.3·§A.4 |
| `my-recipes.tsx` (Phase 3) | `/my-recipes` | 보호 화면 — useTossUserId 가드 + useMyRecipes 결합. 로딩/에러/EmptyState/RecipeCard 목록 4-way 분기 + 단순 페이지네이션(이전/다음 + `meta.pageSize` 신뢰) | 07 §7.3.3, ADR-012 D14·D15·D18, Phase 3 baseline §A.3·§C.1·§C.4·§C.5 |
| `recipe/[id].tsx` (Phase 3) | `/recipe/[id]` | 보호 화면 — useTossUserId 가드 + useRecipeDetail 결합. 로딩/404/에러/정상 4-way 분기. 404 → `<NotFoundScreen onBack={handleBack} />` 단일 컴포넌트. handleBack은 `canGoBack?.()` + fallback `/my-recipes` | 07 §7.3.4, ADR-004·005, ADR-012 D14·D16, Phase 3 baseline §A.3·§C.2·§C.4 |

## 규약 (강제)

- **라우트 경로 = 파일 경로** — `pages/recipe/generate.tsx` ↔ `/recipe/generate`. 변경 금지 (07 §7.4 매핑 요약표).
- **`router.gen.ts` 수동 수정 금지** — Granite 자동 생성. 무해 lint warning 1건은 자동 생성 한계 (ADR-010 §6.4 인용 그대로).
- **`createRoute` export 패턴** — 각 화면은 `export const Route = createRoute('/path', { component, validateParams? })`. component는 화면 함수 컴포넌트.
- **`href`/`useRouter`/`<Link>` 사용 금지** — Granite는 `useNavigation().navigate(path, params)` + `Route.useParams()` 사용 (07 §7.2 #3·#4, baseline §D.2 #3).
- **`useAuth` 사용 금지** — Toss 식별이 자동 (ADR-009 D2). 로그인/로그아웃 분기 없음 (baseline §D.2 #4).
- **공개 endpoint 화면(`/`, `/recipe/generate`)에서 `useTossUserId` 미사용** — 헤더 미부착(05 §5.3, 03 §3.2.1, AC2.6). 보호 화면(`/my-recipes`, `/recipe/[id]`)은 `useTossUserId` 필수.
- **보호 화면 식별자 가드 패턴** — `useTossUserId().tossUserId === undefined` → Loading/Spinner 렌더 + 데이터 훅 호출 차단. 발급 완료 시 데이터 훅 호출. ErrorPage 503 분기 본 Phase 미적용(useTossUserId가 error state 미노출, ADR-010 D2 정책). Phase 3 baseline §C.4·§H.2 #16.
- **`PageNavbar`는 화면 본문에서 직접 렌더** — 글로벌 layout 없음 (07 §7.8). compound API(`PageNavbar.Title` 등)만 사용. 공통 래퍼 `AppNavbar.tsx` 만들지 않음 (ADR-011 D12).
- **fetch 직접 호출 0건** — 모든 데이터 호출은 hooks/(useRecipeGenerate/useMyRecipes/useRecipeDetail/useSaveRecipe) 통한다. recipes.ts/api-client 직접 호출도 금지 (Phase 3 baseline §H.2 #12).
- **`recipe.id` 참조 OK 위치 한정** — 생성 결과는 `GeneratedRecipe`(id 없음, RecipeDisplay 호환). 저장된 Recipe는 `my-recipes.tsx`(목록 map key + onPress 콜백) + `/recipe/[id]`(Route.useParams id) + RecipeCard에서 사용 (Phase 3 baseline §H.2 #11). RecipeDisplay 내부에서는 여전히 0건.
- **404 UI는 `<NotFoundScreen onBack={...} />` 단일 컴포넌트만** — Phase 3 baseline §H.2 #13. `<ErrorPage statusCode={404}>` 직접 렌더 + 인라인 "찾을 수 없어요" 텍스트 0건. Phase 4 PATCH/DELETE 404 시점에서도 동일 컴포넌트 재사용 보장.
- **`useMyRecipes`의 `meta.pageSize` 신뢰** — Phase 3 baseline §H.2 #18. lastPage 계산은 `Math.ceil(meta.total / meta.pageSize)`. `query.pageSize`로 계산 금지 (ADR-006 clamp 적용값과 일관).

## SSE 상태 결합 패턴 (`recipe/generate.tsx` 인용)

- `useRecipeGenerate()`의 외부 인터페이스(`{ status, recipe, error, generate, cancel, reset }`)만 의존 (08 §8.3.2).
- **`progressText` 미참조** — 인디케이터만 렌더. text 청크 사용자 표시 금지 (ADR-011 D11, baseline §D.2 #6).
- **취소 버튼은 `reset()`** 사용 (cancel이 아님). `cancel()`은 abort 발사 후 status 전이가 비동기지만 `reset()`은 동기 setState(`status='idle'`)까지 보장 — 인디케이터가 즉시 사라져 UX 일관(AC2.2). qa report §13.4 PASS.
- **초기 진입 자동 1회 생성** — `useRef` 가드로 `params.dishName`이 있으면 1회만 generate. params 변경에 의한 재실행 차단.
- **다시 시도** — `reset()` 후 동일 params로 `generate()` 재호출. 새로운 AbortController가 자동 생성됨.

## 네비게이션 흐름 매트릭스 (Phase 3 종료 시점)

| 진입점 → 도착 | 호출 |
|-------------|------|
| 홈(`/`) → 마이 목록 | `navigation.navigate('/my-recipes', {})` (index.tsx:36) |
| 홈(`/`) → 생성 | `navigation.navigate('/recipe/generate', { dishName, servings })` (index.tsx:29) |
| 마이 목록 → 상세 | `navigation.navigate('/recipe/[id]', { id: recipe.id })` (my-recipes.tsx:45) |
| 마이 목록 → 생성 (EmptyState 액션) | `navigation.navigate('/recipe/generate', {})` (my-recipes.tsx:51) |
| 생성 저장 성공 → 상세 | `navigation.navigate('/recipe/[id]', { id: saved.id })` (generate.tsx:120) — ADR-012 D17 직진 |
| 상세 → 뒤로 | `handleBack`: `canGoBack?.()` 확인 후 `goBack()` 또는 `/my-recipes` fallback ([id].tsx:49-55) — 딥링크 진입 시 자연 정합 |
| 생성 → 뒤로 / 다시 시도 | `reset()` (cancel 미사용 — Phase 2 §13.4 디자인) |

## 라우트 등록 정책 (출시 점검 영향)

- **Phase 3 종료 시점 등록 라우트 4개** — `/`, `/recipe/generate`, `/my-recipes`, `/recipe/[id]`. `src/router.gen.ts` 자동 갱신, 수동 수정 금지.
- 새 화면 추가 시 출시 검수 도메인 화이트리스트·딥링크(`intoss://<appName>/...`) 영향 점검 (07 §7.6, 09-ENV-CONFIG).
- 비기능 화면(about 등) 추가 시 노출 영향 별 점검 (`appsintoss-publish-checklist` 스킬).

## 진입점

- Granite 진입점(`src/_app.tsx`)이 `TossUserIdProvider` 안쪽에 `RecipeCacheProvider`를 마운트 (ADR-012 D15). `pages/*.tsx`는 자동 등록되어 진입 가능.
- 외부 화면 이동: `useNavigation().navigate('/recipe/generate', { dishName, servings })`.

## 변경 트리거

- 새 화면 필요 → `pages/<path>.tsx` 신규 + `createRoute` + 07 §7.3·§7.4 갱신 + (필요 시) AGENTS.md 표 갱신.
- 보호 화면 추가(예: Phase 4 새 화면) → `useTossUserId` 가드 + 적용 가능 시 `<NotFoundScreen />` 단일 컴포넌트 분기 (ADR-012 D16).
- 하드웨어 백 가드(`useBackEvent`) — Phase 3에서도 보류(baseline §C.6), Phase 4 PATCH/DELETE 낙관적 업데이트 시 재검토.
- 캐시 무효화 트리거 추가(예: 즐겨찾기 PATCH 후) → `useRecipeCacheTrigger.invalidate()` 호출 위치 추가 (ADR-012 D15).

## 비범위 (Phase 3)

- Phase 4 화면 — 즐겨찾기 토글(PATCH)·삭제(DELETE) — `/recipe/[id]` 내부 actions slot 또는 별 컴포넌트 분리 결정은 Phase 4 baseline.
- 하드웨어 백 + AbortController 연계 (`useBackEvent`) — Phase 3 보류 (baseline §C.6).
- 딥링크 진입 분석(`getSchemeUri`) — v1 비범위.
- 무한 스크롤 — Phase 5 출시 직전 별 ADR (ADR-012 D18 §대안 H).
- 단위 테스트(jest) — Phase 1~3 비범위.

## 관련 ADR / 챕터

- [ADR-004](../../docs/adr/ADR-004-get-recipe-by-id.md) — 단건 조회 딥링크 정합 (`/recipe/[id]` handleBack fallback의 근거).
- [ADR-005](../../docs/adr/ADR-005-ownership-violation-404.md) — 404 통일 (`<NotFoundScreen />` 단일 컴포넌트 정책).
- [ADR-009](../../docs/adr/ADR-009-appsintoss-port-architecture.md) D2 — auth/* 제외, useAuth 미사용.
- [ADR-010](../../docs/adr/ADR-010-miniapp-phase1-conventions.md) D4 — Toss SDK 단일 격리 (useTossUserId 외 import 금지).
- [ADR-011](../../docs/adr/ADR-011-miniapp-phase2-streaming-ui.md) D11/D12 — text 청크 미표시(progressText 미참조), PageNavbar 채택.
- [ADR-012](../../docs/adr/ADR-012-miniapp-phase3-routing-cache-404.md) D14/D15/D16/D17/D18 — Phase 3 라우트·캐시·404·저장 흐름·페이지네이션 5 결정.
- [07-ROUTING.md](../../docs/appsintoss-port/07-ROUTING.md) §7.2·§7.3·§7.5·§7.7·§7.8 — Granite 라우팅·proxy 대체·하드웨어 백·Navbar 분산.
- [08-STREAMING.md](../../docs/appsintoss-port/08-STREAMING.md) §8.3.2·§8.4 — useRecipeGenerate 외부 인터페이스·AbortController.
