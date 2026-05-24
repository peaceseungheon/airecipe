# src/pages — Granite 파일 기반 라우팅 + 화면별 PageNavbar

## 책임

`pages/<path>.tsx` 위치가 곧 라우트 경로(Granite 파일 라우팅, 07-ROUTING §7.2). 각 화면은 (1) `createRoute` export, (2) `Route.useParams()`로 params 수신, (3) `useNavigation()`로 화면 이동, (4) `<PageNavbar>` 직접 렌더, (5) 상태·호출 결합을 담당한다. presentational 컴포넌트는 `src/components/`로 위임.

## 파일

| 파일 | 라우트 | 책임 | SSOT |
|------|--------|------|------|
| `index.tsx` | `/` (홈) | PageNavbar + SearchForm. 제출 → `/recipe/generate` 진입 (params) | 07 §7.3.1, baseline §A.5 |
| `recipe/generate.tsx` | `/recipe/generate` | PageNavbar + SearchForm + 진행 인디케이터 + 에러 박스 + RecipeDisplay/NutritionPanel. `useRecipeGenerate` 훅 결합 | 07 §7.3.2, 08 §8.3~8.5, baseline §A.5 |
| `about.tsx` | `/about` | Phase 0 부트스트랩 잔여 — Phase 2 비기능 화면 | (정리 트리거: qa report §13.2·§13.5) |
| `recipe/` | (디렉터리) | Phase 3 진입 시 `[id].tsx` 추가 (07 §7.3.4) | — |

## 규약 (강제)

- **라우트 경로 = 파일 경로** — `pages/recipe/generate.tsx` ↔ `/recipe/generate`. 변경 금지 (07 §7.4 매핑 요약표).
- **`router.gen.ts` 수동 수정 금지** — Granite 자동 생성. 무해 lint warning 1건은 자동 생성 한계 (ADR-010 §6.4 인용 그대로).
- **`createRoute` export 패턴** — 각 화면은 `export const Route = createRoute('/path', { component, validateParams? })`. component는 화면 함수 컴포넌트.
- **`href`/`useRouter`/`<Link>` 사용 금지** — Granite는 `useNavigation().navigate(path, params)` + `Route.useParams()` 사용 (07 §7.2 #3·#4, baseline §D.2 #3).
- **`useAuth` 사용 금지** — Toss 식별이 자동 (ADR-009 D2). 로그인/로그아웃 분기 없음 (baseline §D.2 #4).
- **공개 endpoint 화면(`/`, `/recipe/generate`)에서 `useTossUserId` 미사용** — 헤더 미부착(05 §5.3, 03 §3.2.1, AC2.6). 보호 화면(Phase 3 `/my-recipes`, `/recipe/[id]`)은 `useTossUserId` 필수.
- **`PageNavbar`는 화면 본문에서 직접 렌더** — 글로벌 layout 없음 (07 §7.8). compound API(`PageNavbar.Title` 등)만 사용. 공통 래퍼 `AppNavbar.tsx` 만들지 않음 (ADR-011 D12).
- **fetch 직접 호출 0건** — `src/services/`(`apiFetch`/`streamRecipe`) 통한다 (baseline §D.2 #1).
- **`recipe.id` 참조 0건** — 생성 결과는 `GeneratedRecipe`(id 없음). 저장 후 진입(`/recipe/[id]`) 시에만 `Recipe.id` 사용 (Phase 3). (03 §3.10 #5, 불변식 2).

## SSE 상태 결합 패턴 (`recipe/generate.tsx` 인용)

- `useRecipeGenerate()`의 외부 인터페이스(`{ status, recipe, error, generate, cancel, reset }`)만 의존 (08 §8.3.2).
- **`progressText` 미참조** — 인디케이터만 렌더. text 청크 사용자 표시 금지 (ADR-011 D11, baseline §D.2 #6).
- **취소 버튼은 `reset()`** 사용 (cancel이 아님). `cancel()`은 abort 발사 후 status 전이가 비동기지만 `reset()`은 동기 setState(`status='idle'`)까지 보장 — 인디케이터가 즉시 사라져 UX 일관(AC2.2). qa report §13.4 PASS.
- **초기 진입 자동 1회 생성** — `useRef` 가드로 `params.dishName`이 있으면 1회만 generate. params 변경에 의한 재실행 차단.
- **다시 시도** — `reset()` 후 동일 params로 `generate()` 재호출. 새로운 AbortController가 자동 생성됨.

## 라우트 등록 정책 (출시 점검 영향)

- **`about.tsx` 정리 권장** (qa report §13.2·§13.5) — Granite 자동 라우팅이 `pages/` 디렉터리의 `.tsx`를 라우트로 등록할 수 있어, about 페이지가 사용자에게 노출되면 검수 영향 가능. Phase 3 또는 출시 직전 점검 (`appsintoss-publish-checklist` 스킬).
- 새 화면 추가 시 출시 검수 도메인 화이트리스트·딥링크(`intoss://<appName>/...`) 영향 점검 (07 §7.6, 09-ENV-CONFIG).

## 진입점

- Granite 진입점(`src/_app.tsx`)이 `TossUserIdProvider`를 마운트. `pages/*.tsx`는 자동 등록되어 진입 가능.
- 외부 화면 이동: `useNavigation().navigate('/recipe/generate', { dishName, servings })`.

## 변경 트리거

- 새 화면 필요 → `pages/<path>.tsx` 신규 + `createRoute` + 07 §7.3·§7.4 갱신 + (필요 시) AGENTS.md 표 갱신.
- 보호 화면(Phase 3 `/my-recipes`, `/recipe/[id]`) → `useTossUserId` 가드 + ErrorPage(503/404) 분기 (07 §7.5).
- 하드웨어 백 가드(`useBackEvent`) — Phase 3 진입 게이트 (07 §7.7.2, qa report §13.3).

## 비범위 (Phase 2)

- 마이 레시피 목록(`/my-recipes`) — Phase 3.
- 레시피 상세(`/recipe/[id]`) — Phase 3.
- 하드웨어 백 + AbortController 연계 — Phase 3 선택 (08 §8.4.2).
- 딥링크 진입 분석(`getSchemeUri`) — v1 비범위.
- 단위 테스트(jest) — Phase 2 비범위.

## 관련 ADR / 챕터

- [ADR-009](../../docs/adr/ADR-009-appsintoss-port-architecture.md) D2 — auth/* 제외, useAuth 미사용.
- [ADR-010](../../docs/adr/ADR-010-miniapp-phase1-conventions.md) D4 — Toss SDK 단일 격리 (useTossUserId 외 import 금지).
- [ADR-011](../../docs/adr/ADR-011-miniapp-phase2-streaming-ui.md) D11/D12 — text 청크 미표시(progressText 미참조), PageNavbar 채택.
- [07-ROUTING.md](../../docs/appsintoss-port/07-ROUTING.md) §7.2·§7.3·§7.5·§7.7·§7.8 — Granite 라우팅·proxy 대체·하드웨어 백·Navbar 분산.
- [08-STREAMING.md](../../docs/appsintoss-port/08-STREAMING.md) §8.3.2·§8.4 — useRecipeGenerate 외부 인터페이스·AbortController.
