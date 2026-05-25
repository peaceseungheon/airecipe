# Phase 3 QA Report — 저장·목록·상세 경계면 검증

> 작성: miniapp-qa · 2026-05-25 · 팀 `airecipe-miniapp-phase3`
> 기준 baseline: `_workspace/01_architect_phase3_baseline.md` (Phase 3 동결 §A~§K, 11절)
> 입력 SSOT: `docs/appsintoss-port/03·06·07`, `docs/adr/ADR-004·005·006·009·010·011`, `_workspace/00_input/requirements.md`
> 누적 패턴: `_workspace_phase1/03_qa_report.md`·`_workspace_phase2/03_qa_report.md` 단언 매트릭스(코드 경로 + 실호출 분리)
> 범위: Phase 3 산출물(api-client 5 + frontend 5+2확장) 경계면 검증 + 통합 스윕 + AC3.* 매트릭스

본 리포트는 모듈 완성 통지마다 누적 업데이트한다. 각 단언은 PASS / FAIL / PENDING / N/A(Phase 4 이연) 로 표시하고, 결과의 근거는 파일:라인 인용.

---

## 0. 요약 — api-client 5 + frontend 7 산출 통합 검증 완료

| 영역 | PASS | FAIL | PENDING | N/A |
|------|:----:|:----:|:-------:|:---:|
| baseline §A 산출 12 파일 도착 (api-client 5 + frontend 5 신규 + 2 확장) + router.gen 자동 = 13 | 13 | 0 | 0 | - |
| 03 §3.10 경계면 단언 Phase 3 적용 8건 (#1·#2·#3·#5·#6·#7·#10·#11) | 8 | 0 | 0 | 7 |
| 06 §6.7 검증 Phase 3 적용 5건 | 5 | 0 | 0 | 3 |
| 07 §7.9 검증 Phase 3 적용 5건 | 5 | 0 | 0 | 3 |
| 07 §7.5.4 데이터 소비 규약 (#4a·#4b·#8·#9·#11) | 5 | 0 | 0 | - |
| baseline §B.1 TDS 실재성 cross-check (Pressable·ErrorPage·Button — Phase 3 사용 3종, IconButton Phase 4 자리표시) | 4 | 0 | 0 | - |
| baseline §H.2 격리 단언 (#11~18) — Phase 3 신규 8건 | 8 | 0 | 0 | - |
| baseline §H.1 Phase 1·2 동결 수정 0건 회귀 | 11 | 0 | 0 | - |
| baseline §H.3 ADR-011 D13 cast 격리 유지 | 3 | 0 | 0 | - |
| 통합 스윕 (Phase 1 5 + Phase 2 5 + §9.3 추가 2 + Phase 3 추가 4) | 16 | 0 | 0 | - |
| AC3.1~AC3.6 (코드 경로) | 6 | 0 | 0 | - |
| AC3.1/3.2/3.3/3.4/3.5/3.6 실호출 검증 | 0 | 0 | 6 | - |

**전체 판정: ALL PASS (코드 경로), FAIL 0건 누적** — frontend 7 산출 즉시 통합 검증 완료. typecheck exit 0, lint 0 errors, fetch 정확 2곳, cast 정확 2곳, recipe.id RecipeCard·my-recipes 한정 사용 + RecipeDisplay·generate.tsx의 GeneratedRecipe 표시 0건, NotFoundScreen import 정확 1곳(`pages/recipe/[id].tsx:24`), `<ErrorPage>` 직접 렌더 컴포넌트 내부 1곳만, "찾을 수 없" 인라인 텍스트 0건, 보호 화면 2개 모두 `useTossUserId` 가드 처리.

- 실호출 6건: 백엔드 옵션 P 배포 후 또는 dev server 실행 시 검증 — Phase 1·2 패턴과 동일.
- AC3.6은 Phase 4 즐겨찾기 토글 이후 실증 (코드 경로만 본 Phase 검증, 03 §3.10 #11 정합).
- AC3.3(c) 딥링크 시나리오는 토스 실 환경 검증 PENDING (architect 보강 2).

- 실호출 6건: 백엔드 옵션 P 배포 후 또는 dev server 실행 시 검증 — Phase 1·2 패턴과 동일.
- AC3.6은 Phase 4 즐겨찾기 토글 이후 실증 (코드 경로만 본 Phase 검증, 03 §3.10 #11 정합).

---

## 1. baseline §A 산출 파일 도착 매트릭스

baseline §A.1(api-client 5) + §A.2(frontend 3 컴포넌트) + §A.3(frontend 2 라우트 신규 + 2 확장) + §A.4 저장 흐름 = 총 12 산출.

| 파일 | 1차 작성자 | 도착 여부 | 단언 매핑 |
|------|----------|---------|----------|
| `src/hooks/useRecipeCache.tsx` (신규) | api-client | **PASS** | §D.1~D.2 Context + bump trigger. `useRecipeCache.tsx:43-57` `RecipeCacheProvider` + `:44` useState(0) + `:45-47` invalidate setState(n+1) + `:49-52` useMemo value 안정 + `:62-69` Provider 누락 throw |
| `src/hooks/useMyRecipes.ts` (신규) | api-client | **PASS** | §A.1, 03 §3.3, ADR-006, ADR-010 D5 — `:99-109` listRecipes raw `{data, meta}` 그대로 setState + `:140-146` data/meta/isLoading/error/refetch 5 노출 + `:64-66` useTossUserId+useRecipeCacheTrigger 결합 + `:86-88` 식별자 가드 + `:128-138` dep에 trigger·refetchTick 포함 |
| `src/hooks/useRecipeDetail.ts` (신규) | api-client | **PASS** | §A.1, 03 §3.4, ADR-004, ADR-005 — `:88-100` getRecipe + `:104-118` 404 정규화 (`err.error.code === 'NOT_FOUND'` → notFound:true, error:null), 그 외는 error state + `:131` trigger 미포함(§D.5 정합) |
| `src/hooks/useSaveRecipe.ts` (신규) | api-client | **PASS** | §A.1, §A.4, §D.3, 03 §3.5 — `:84-94` saveRecipe + 성공 시 `:92` invalidate() 정확 1회 (성공-then-invalidate) + `:95-101` catch는 setError만(invalidate 미호출) + `:70-74` 식별자 미발급 가드 + `:78-79` 이전 호출 abort |
| `src/_app.tsx` (확장) | api-client | **PASS** | §D.4 — `_app.tsx:17-21` `<TossUserIdProvider><RecipeCacheProvider>{children}` 마운트 순서 정확. 외부 의존 0. Phase 1 TossUserIdProvider 안쪽 정합 |
| `src/components/RecipeCard.tsx` (신규) | frontend | **PASS** | §A.2, 06 §6.4.4, §B.2 — `RecipeCard.tsx:17-26` Pressable+Badge+Txt + recipe-format 재사용 + Recipe props. `:38-65` 카드 본문(dishName/description/badge row 3종). DifficultyBadge·NeutralBadge 합성. 즐겨찾기/삭제 props는 자리표시 미렌더(Phase 4 대비). presentation only (fetch/useState/useEffect 0건) |
| `src/components/EmptyState.tsx` (신규) | frontend | **PASS** | §A.2, 06 §6.5 추가 컴포넌트, §B.3 — `EmptyState.tsx:26-48` View + Txt(t3/st9) + Button(primary/fill/block/medium) + actionLabel/onAction. 다양한 빈 상태(Phase 4 즐겨찾기 0건 등)에 props 재사용 가능. presentation only |
| `src/components/NotFoundScreen.tsx` (신규) | frontend | **PASS** | §A.2, 06 §6.5, ADR-005, §B.3 — `NotFoundScreen.tsx:18-35` TDS `<ErrorPage statusCode={404} title=... subtitle=... onPressLeftButton={onBack}>` 합성. 화면별 분기 0건 (§H.2 #13). 컴포넌트 SRP 유지 — Phase 4 PATCH/DELETE 404 재사용 보장 |
| `src/pages/my-recipes.tsx` (신규) | frontend | **PASS** | §A.3, §C.1, §C.4, 07 §7.3.3 — `my-recipes.tsx:31-33` `createRoute('/my-recipes', ...)` 정확. `:37,:63-76` `useTossUserId` 가드 + 로딩 UI. `:80-86` `meta.pageSize` 신뢰 페이지 계산 (ADR-006). `:124-130` 빈 목록 → EmptyState. `:131-166` RecipeCard 목록 + 페이지네이션. 카드 탭 → `/recipe/[id]` |
| `src/pages/recipe/[id].tsx` (신규) | frontend | **PASS** | §A.3, §C.2, §C.4, 07 §7.3.4 — `[id].tsx:34-41` `createRoute('/recipe/[id]', { validateParams })` Phase 2 generate.tsx:39-50 패턴 답습. `:44-47` Route.useParams + useRecipeDetail + useTossUserId 결합. `:58-71` 식별자 가드. `:74-76` `notFound` → `<NotFoundScreen onBack={handleBack} />` 단일 분기. `:114-120` RecipeDisplay + NutritionPanel |
| `src/pages/recipe/generate.tsx` (확장) | frontend | **PASS** | §A.3, §A.4 (저장 버튼 추가) — `generate.tsx:37` useSaveRecipe import. `:65-66` 결합. `:116-122` handleSave → save(recipe) → saved? `navigation.navigate('/recipe/[id]', { id: saved.id })` 직진. `:204-217` RecipeDisplay actions slot에 "저장하기" Button(`loading={isSaving}` + `disabled={isSaving}`). `:219-228` saveError 노출. `recipe.id`(GeneratedRecipe) 참조 0건 — `saved.id`(Recipe) 라우팅만 |
| `src/pages/index.tsx` (확장) | frontend | **PASS** | §A.3 (마이 진입 활성화) — `index.tsx:35-37` `handleOpenMyRecipes` callback. `:42-48` PageNavbar.AccessoryButtons에 `<AccessoryTextButton onPress>마이 레시피</...>`. 본 화면은 useTossUserId 미사용(공개 endpoint 정합) — navigation만 호출하고 가드는 마이 화면 측 |
| `src/router.gen.ts` (자동) | granite | **PASS** | §C.3 4 라우트 등록 정합 — typecheck PASS 간접 증거 (`/`·`/recipe/generate`·`/my-recipes`·`/recipe/[id]` 모두 등록). lint warning은 자동 생성 무해 (Phase 1·2 누적) |

---

## 2. 03 §3.10 경계면 불변식 — Phase 3 적용 분 (15건 중)

| # | 단언 | 본 Phase 적용 | 상태 | 근거 (파일:라인) |
|---|------|:------------:|:----:|----------------|
| 1 | `{ data, meta? }` 래핑, 배열 직접 반환 없음 | ✅ (목록·단건·저장·삭제) | **PASS** | useMyRecipes `:99-109` raw `{data, meta}` 보존 + useRecipeDetail `:90` getRecipe unwrap + useSaveRecipe `:85` saveRecipe unwrap (recipes.ts Phase 1 PASS 누적) |
| 2 | 에러 `error.code` 분기 (HTTP로 분기 금지) | ✅ (NOT_FOUND 신규 + UNAUTHORIZED 재시도) | **PASS** | `useRecipeDetail.ts:104` `err.error.code === 'NOT_FOUND'` 분기 → notFound:true / 그 외 toUserMessage 매핑. UNAUTHORIZED는 api-client 단일점 401 재시도(ADR-010 D3) |
| 3 | camelCase only, snake_case 누출 없음 | ✅ | **PASS** | `rg "_[a-z]" src/hooks/use*.tsx? src/_app.tsx` 도메인 키 측면 0건 |
| 4 | 응답 `userId` 키 없음 | ✅ (Phase 1·2 PASS 누적) | **PASS** | Phase 1·2 PASS 회귀. api-client 산출에서 신규 발생 0건 |
| 5 | GeneratedRecipe ≠ Recipe (id 없음) | ✅ (baseline §H.2 #11) | **PENDING (frontend 종결)** | api-client 측: useSaveRecipe `:39,:94` `Promise<Recipe \| null>` 반환 (id 포함). useRecipeDetail `:33` `Recipe \| null`. useMyRecipes `:40` `Recipe[]`. 모두 Recipe 타입 — GeneratedRecipe와 분리. RecipeDisplay·generate.tsx의 GeneratedRecipe 표시 0건 검증은 frontend 시 |
| 6 | 보호 헤더 부착, 공개 생략 | ✅ (listRecipes·getRecipe·saveRecipe AuthedCallOptions) | **PASS** | 3 훅 모두 `{ tossUserId, refreshTossUserId: refresh }` 전달 (`useMyRecipes.ts:99-102`, `useRecipeDetail.ts:90-93`, `useSaveRecipe.ts:85-88`). recipes.ts AuthedCallOptions 필수 TS 강제 (Phase 1 PASS) |
| 7 | NOT_FOUND 단일 분기, FORBIDDEN 미분기 | ✅ (ADR-005 통일) | **PASS** | useRecipeDetail `:104` NOT_FOUND 정규화 단일 경로. `rg "FORBIDDEN" src/hooks/` = 0건. ERROR_CODE_MESSAGES 매핑에 FORBIDDEN 포함되나 분기 코드 0건 |
| 8 | 스트리밍 에러 HTTP 200 + chunk | N/A (Phase 2 PASS — generate.tsx 확장은 SSE 흐름 변경 없음) | **N/A** | Phase 2 누적 |
| 9 | AI 4자 일치 | N/A (Phase 2 PASS 누적) | **N/A** | Phase 2 누적 |
| 10 | pageSize clamp 신뢰 (`meta.pageSize`) | ✅ (AC3.4 + baseline §H.2 #18) | **PASS** | `useMyRecipes.ts:99-109` raw `{data, meta}` setState — meta 가공 0건. `:142` 반환 시 meta 그대로 노출. listRecipes(Phase 1 PASS)가 `listMetaSchema` 검증 후 raw 반환 |
| 11 | favorite "true"/"false" 문자열 | ✅ (코드 경로) | **PASS** | Phase 1 PASS 누적 — recipes.ts buildUrl이 `String(boolean)` 자동 변환. useMyRecipes는 `query: RecipeListQuery` props로 받아 그대로 전달 (`useMyRecipes.ts:64,:99`). 본 Phase 사용은 화면 측 결정 |
| 12 | CORS Allow-Headers + OPTIONS | N/A (백엔드) | **N/A** | 실호출 시점 검증 (§G #4) |
| 13 | CORS Allow-Origin: * 미사용 | N/A (백엔드) | **N/A** | — |
| 14 | PATCH favorite 멱등 | N/A (Phase 4) | **N/A** | — |
| 15 | DELETE `{ data: { id } }` | N/A (Phase 4) | **N/A** | — |

---

## 3. 06 §6.7 검증 8항 — Phase 3 적용

| # | 단언 | 본 Phase 적용 | 상태 | 근거 |
|---|------|:------------:|:----:|------|
| 1 | 매핑 대상 13개 모두 표 존재 | N/A (06 챕터 검증) | **N/A** | T5 architect 갱신 트리거 |
| 2 | TDS 컴포넌트 실재 | ✅ (Phase 3 신규: Pressable·ErrorPage·IconButton placeholder·Button) | **PASS** | §7 cross-check 4 PASS — Pressable(RN 내장)·ErrorPage(NotFoundScreen 합성)·Button(저장·페이지네이션·EmptyState)·IconButton(Phase 4 자리표시 미사용) |
| 3 | Tailwind 클래스 매핑 표에 잔존 0건 | ✅ | **PASS** | `rg "className=" src/` = 0건 |
| 4 | `href`/`useRouter`/`<Link>` 잔존 0건 | ✅ | **PASS** | 회귀 grep 0건. 신규 5 호출 모두 `navigation.navigate(...)` (`pages/index.tsx:30,:36`, `pages/my-recipes.tsx:45,:51`, `pages/recipe/[id].tsx:53`, `pages/recipe/generate.tsx:111,:120`) |
| 5 | `useAuth` 잔존 0건 | ✅ | **PASS** | `rg "useAuth\\b" src/` = 0건 |
| 6 | presentation 컴포넌트가 API 직접 호출 책임 미보유 | ✅ (RecipeCard·EmptyState·NotFoundScreen) | **PASS** | RecipeCard·EmptyState·NotFoundScreen 모두 services/api-client/sse-client/fetch import 0건. RecipeCard 주석 `:12` 명시 "presentational only — fetch/useState/useEffect 사용 금지". 도메인 호출은 페이지·훅만 |
| 7 | FavoriteButton 멱등 시그니처 | N/A (Phase 4) | **N/A** | — |
| 8 | RecipeDisplay `id` 미참조 | ✅ (Phase 2 누적) | **PASS** | RecipeDisplay 파일 git diff 0 hunk (§9 PASS). `rg "recipe\\.id\\b" src/components/RecipeDisplay.tsx` = 0건. RecipeCard는 `Recipe` 한정으로 `recipe.id`(`:43`) 사용 OK |

---

## 4. 07 §7.9 검증 8항 — Phase 3 적용

| # | 단언 | 본 Phase 적용 | 상태 | 근거 |
|---|------|:------------:|:----:|------|
| 1 | 7개 화면 인벤토리 → 5+제외 2 | N/A (07 챕터 검증) | **N/A** | — |
| 2 | 모든 라우트가 `pages/<file>.tsx` 위치 일치 | ✅ (4 라우트) | **PASS** | `pages/index.tsx:21` `/`, `pages/recipe/generate.tsx:44` `/recipe/generate`, `pages/my-recipes.tsx:31` `/my-recipes`, `pages/recipe/[id].tsx:34` `/recipe/[id]` — 파일 위치와 createRoute path 인자 1:1 정합 (baseline §C.3) |
| 3 | `next/link`/`useRouter`/`href` 모두 `navigation.navigate` | ✅ | **PASS** | §3 #4 동일. 7 호출 모두 `navigation.navigate(...)` 사용. next/link/useRouter/href 0건 |
| 4 | proxy.ts 가드 단순화 + 보호 화면 적용 | ✅ (Phase 3 신규 2 화면) | **PASS** | `pages/my-recipes.tsx:37,:63-76` + `pages/recipe/[id].tsx:46,:58-71` 모두 `useTossUserId` 가드 처리. 식별자 미발급 시 Loading UI 렌더 (Phase 1 ADR-010 D2 단일 분기 정책 정합) |
| 5 | 404 통일(ADR-005) 반영 | ✅ (NotFoundScreen 단일) | **PASS** | `pages/recipe/[id].tsx:24` NotFoundScreen import 단일 + `:74-76` `notFound` → `<NotFoundScreen onBack={handleBack} />` 단일 분기. `<ErrorPage>` 직접 렌더는 NotFoundScreen 컴포넌트 내부 1곳만. "찾을 수 없" 인라인 텍스트 0건 |
| 6 | 딥링크 형식 정합 (`intoss://<appName>/recipe/[id]`) | ✅ | **PASS (구조)** | 라우트 `/recipe/[id]` 파일 라우팅 정합. 실 딥링크 동작은 토스 환경 PENDING (architect 보강 2) |
| 7 | 하드웨어 백 + AbortController 연계 | N/A (Phase 3 결정 보류, baseline §C.6) | **N/A** | Phase 4 PATCH/DELETE 시 재검토 |
| 8 | layout.tsx 흡수 (글로벌 NavBar 제거, 화면별 Navbar) | ✅ (PageNavbar 4 화면 모두) | **PASS** | 4 화면 모두 `<PageNavbar>` 직접 사용 — `pages/index.tsx:41-48`, `pages/recipe/generate.tsx:132-134`, `pages/my-recipes.tsx:66-68/:90-92`, `pages/recipe/[id].tsx:61-63/:80-82`. _app.tsx에 글로벌 NavBar 0건 (Phase 2 PASS 누적) |

---

## 5. 07 §7.5.4 데이터 소비 규약 5건

| # | 규약 | 강제 위치 | 상태 | 근거 |
|---|------|---------|:----:|------|
| #4a | 응답 `{ data, meta? }` unwrap (단건 `.data`, 목록 `.data`/`.meta`) | api-client/recipes.ts/훅 내부 | **PASS** | useMyRecipes raw `{data, meta}` 보존 + useRecipeDetail·useSaveRecipe unwrap. recipes.ts(Phase 1) 단일점에서 zod factory 적용. §2 #1 동일 근거 |
| #4b | camelCase 강제 + `userId` 키 응답 없음 | api-client + 타입 | **PASS** | §2 #3·#4 동일 |
| #8 | pageSize clamp 신뢰 (`meta.pageSize`) | useMyRecipes | **PASS** | api-client 측 `useMyRecipes.ts:99-109` 가공 0 + `:142` raw 노출. 화면 `pages/my-recipes.tsx:80-86` 페이지 계산: `effectivePageSize = meta?.pageSize ?? PAGE_SIZE` + `total = meta?.total ?? 0` + `lastPage = Math.ceil(total / effectivePageSize)`. `query.pageSize`로 계산 0건 — meta 신뢰 정합 |
| #9 | favorite 쿼리 "true"/"false" 문자열 | useMyRecipes 키 빌더 | **PASS** | §2 #11 동일 |
| #11 | DELETE 응답 `{ data: { id } }` | N/A Phase 4 | **N/A** | — |

---

## 6. AC3.1~AC3.6 매트릭스 (requirements §AC + 10-SPRINT-PLAN §10.4 + baseline §I)

| AC | 기준 | 충족 산출 | 코드 경로 검증 | 실호출 검증 |
|----|------|----------|--------------|------------|
| **AC3.1** Phase 2 레시피 저장 → 201 + Recipe(id) | useSaveRecipe + generate.tsx 확장 + 직진 라우팅 + 03 §3.5.3 zod | **PASS** — `useSaveRecipe.ts:85` saveRecipe(req, auth) → recipes.ts(Phase 1) `recipeSchema` zod → Recipe 반환. `pages/recipe/generate.tsx:116-122` handleSave → `save(recipe)` → `saved?` `navigation.navigate('/recipe/[id]', { id: saved.id })`. `:204-217` "저장하기" Button + `loading={isSaving}` + `disabled={isSaving}` | **PENDING** (백엔드 옵션 P) |
| **AC3.2** 마이 진입 시 방금 저장 = 첫 페이지 첫 항목 | useMyRecipes + 캐시 invalidate (§D) | **PASS** — `useSaveRecipe.ts:92` invalidate() → `useRecipeCache.tsx:45-47` setTrigger(n+1) → `useMyRecipes.ts:136` trigger dep 변동 → useEffect 재호출 → listRecipes refetch. `pages/my-recipes.tsx:41` `useMyRecipes(query)` 자동 구독. 백엔드 `created_at desc` 정렬(03 §3.3.3)로 data[0] = 최신 | **PENDING** |
| **AC3.3** 카드 탭 → 상세 → 새로고침(라우트 재진입) 정상 | useRecipeDetail + `[id].tsx` + ADR-004 (딥링크 정합) | **PASS (api-client 측)** — `useRecipeDetail.ts:131` dep `[id, tossUserId, refresh, refetchTick]` — trigger 미포함 (§D.5 정합). id 변경/라우트 재진입 시 새 마운트로 단발 fetch. 목록 캐시 의존 0. **architect 보강 2 (2026-05-25)**: RN 컨텍스트에서 "새로고침"은 JS reload(웹 F5)가 아니라 **라우트 재진입**(스택 push/pop 또는 딥링크). 시나리오 분류: (a) 목록→클릭 = 1회 마운트·getRecipe / (b) 백→재클릭 = unmount→재마운트→새 effect·새 getRecipe / (c) 딥링크 `intoss://<appName>/recipe/<id>` 첫 진입 = (a)와 동일 경로. (a)(b)는 코드 경로 PASS, (c)는 토스 실 환경 검증 필요(`getSchemeUri()` 동작) — **본 Phase 실호출에 미포함, PENDING 분류** | **PENDING** (b 시나리오 dev server / c 시나리오 토스 환경) |
| **AC3.4** `pageSize=100` → `meta.pageSize=50` clamp 신뢰 | useMyRecipes raw `{data, meta}` + ADR-006 + §H.2 #18 | **PASS** — `useMyRecipes.ts:99-109` raw 보존 + `pages/my-recipes.tsx:80-86` `effectivePageSize = meta?.pageSize ?? PAGE_SIZE` + `lastPage` 계산이 `meta.pageSize` 기반. `query.pageSize`로 계산 0건 | **PENDING** |
| **AC3.5** 두 식별자 → 서로 안 보임 (소유자 격리) | 식별자 가드 + 보호 헤더 + ADR-005 | **PASS (api-client 측)** — 3 훅 모두 `tossUserId` 매 호출 전달 (`useMyRecipes.ts:99-102` 등). api-client 모듈 스코프 공유 변수 0 (Phase 1 §3 #1 패턴 누적). 단일 사용자 컨텍스트 — Provider별 다른 식별자면 다른 헤더 | **PENDING** (두 토큰 curl 시뮬레이션 — 옵션 P 배포 후) |
| **AC3.6** `?favorite=true` 필터 동작 | useMyRecipes(query.favorite) + 03 §3.10 #11 | **PASS (코드 경로만)** — useMyRecipes는 query를 그대로 listRecipes로 전달. recipes.ts(Phase 1)가 `String(boolean)` 자동 변환 | **PENDING** (Phase 4 즐겨찾기 후 실증) |

---

## 7. baseline §B.1 TDS 실재성 cross-check (Phase 3 신규 4종)

Phase 2 cross-check 8종(Button/TextField/NumericSpinner/Badge/Txt/List/ListRow/PageNavbar) PASS 누적. Phase 3 신규 사용:

| 컴포넌트 | baseline §B.1 결과 | Phase 3 사용처 | 상태 | 검증 항목 |
|---------|------------------|--------------|:----:|----------|
| `Pressable` | RN 내장 (`react-native`) | RecipeCard | **PASS** | `RecipeCard.tsx:18` RN import + `:40-44` `onPress` + `accessibilityRole="button"` + `accessibilityLabel` (한국어) + `style` 함수형(pressed) 정확 사용 |
| `ErrorPage` | ✅ root via `./components/error-page` (baseline §B.1) | NotFoundScreen | **PASS** | `NotFoundScreen.tsx:19` import + `:28-33` `<ErrorPage statusCode={404} title="레시피를 찾을 수 없어요" subtitle="삭제되었거나..." onPressLeftButton={onBack} />` 정확. baseline §B.1 props 시그니처 정합 — `statusCode`/`title`/`subtitle`/`onPressLeftButton` 4 prop 모두 표 정합 |
| `IconButton` (즐겨찾기 자리표시) | Phase 2 §B.1 #8 PASS 인용 | RecipeCard (Phase 4 미렌더, props 자리표시) | **PASS** | `RecipeCard.tsx:33-35` `onToggleFavorite?`/`onDelete?` props 정의만 + 본문 미렌더. Phase 4 활용 대비 인터페이스 보존 |
| `Button`(저장 버튼) | Phase 2 §B.1 #1 PASS 인용 | generate.tsx 확장 | **PASS** | `generate.tsx:205-216` `Button type="primary" style="fill" display="block" size="large" loading={isSaving} disabled={isSaving} onPress={handleSave}>저장하기</Button>` 정확. EmptyState·my-recipes.tsx·[id].tsx의 Button 사용도 §B.1 표 시그니처 정합 |

---

## 8. baseline §H.2 Phase 3 격리 단언 (#11~18) — 8건

| # | 단언 | 검증 방법 | 상태 | 결과 |
|---|------|----------|:----:|------|
| 11 | `recipe.id` 사용 OK 위치 — 저장된 Recipe 한정 | grep `recipe\.id` + 위치별 분류 | **PASS** | `rg "recipe\\.id\\b" src/` 결과: `pages/my-recipes.tsx:135,:137` Recipe props OK + `components/RecipeCard.tsx:13` 주석. 그 외 0건. **RecipeDisplay 0건** (`rg "recipe\\.id\\b" src/components/RecipeDisplay.tsx` = 0). **generate.tsx의 GeneratedRecipe 표시 0건** — `pages/recipe/generate.tsx:65,:117` `recipe`는 GeneratedRecipe 타입이고 `recipe.id` 참조 0. 저장 후 `saved.id`(Recipe)만 라우팅에 사용(`:120`). 컴파일 PASS도 가드 |
| 12 | 직접 fetch 0건 — Phase 3 신규 4 훅 모두 recipes.ts 함수만 호출 | `rg "\\bfetch\\s*\\(" src/` | **PASS** | grep 정확 2곳 (`src/services/api-client.ts:102` + `src/services/sse-client.ts:78`). Phase 3 신규 4 훅 import 분석: useMyRecipes는 `listRecipes`만(`:27`), useRecipeDetail은 `getRecipe`만(`:27`), useSaveRecipe는 `saveRecipe`만(`:22`), useRecipeCache는 services 미의존(`:25-32` React only). 전파 0건 |
| 13 | NotFoundScreen 단일 컴포넌트 — `<ErrorPage>` 직접 렌더 또는 인라인 404 텍스트 위치 0건 | `rg "ErrorPage\|레시피를 찾을" src/pages/` + import 위치 grep | **PASS** | NotFoundScreen import 정확 1곳 (`pages/recipe/[id].tsx:24`). `<ErrorPage>` 직접 렌더는 컴포넌트 내부 1곳만 (`components/NotFoundScreen.tsx:28`). `pages/`에 인라인 "찾을 수 없" 텍스트 0건 (주석 1건만 — 정책 인용). Phase 4 PATCH·DELETE 404에서 동일 컴포넌트 재사용 보장 — SRP 유지 |
| 14 | 응답 unwrap 정책 — useMyRecipes raw `{data, meta}` / 나머지 unwrap | 타입 확인 + 반환 shape 확인 | **PASS** | useMyRecipes `:64` 반환 타입 `UseMyRecipesResult { data: Recipe[], meta: ListMeta \| null }` raw 보존 (ADR-010 D5 listRecipes 예외 정합). useRecipeDetail `:33` `data: Recipe \| null` unwrap. useSaveRecipe `:39` `Promise<Recipe \| null>` unwrap |
| 15 | invalidate 트리거 — useSaveRecipe.save 성공 시 정확 1회 / 실패 시 0건 | 코드 경로 추적 | **PASS** | `useSaveRecipe.ts:92` invalidate() 호출 위치는 try success 분기 + cancelled/aborted 가드 통과 후 단 1곳. catch 분기(`:95-101`)는 setError(toUserMessage(err))만 — invalidate 미호출. grep `invalidate()` = 정확 1건(`:92`) |
| 16 | 식별자 가드 — 두 보호 화면 모두 `useTossUserId().tossUserId === undefined` 분기 (단일 분기 정책) | 페이지 코드 grep | **PASS** | `pages/my-recipes.tsx:37,:63-76` `useTossUserId()` + `if (tossUserId === undefined) return <Loading UI />` + `pages/recipe/[id].tsx:46,:58-71` 동일 패턴. 두 화면 모두 미발급 시 PageNavbar + "식별자를 확인하는 중이에요…" Loading UI 렌더 (RN Txt 사용). useMyRecipes/useRecipeDetail 호출은 가드 통과 후. **architect 보강 1 정합**: ErrorPage 503 분기 미적용 (Phase 1 ADR-010 D2). 발급 실패 시도 단일 undefined 분기로 처리 — Provider가 catch 후 undefined 유지 정합 |
| 17 | AbortController unmount + cancelled 플래그 (3 데이터 훅 모두) | useEffect cleanup 패턴 grep | **PASS** | useSaveRecipe `:51-61` abortRef + cancelledRef + unmount cleanup + `:77-79` 이전 호출 abort + `:89,:96` cancelled 가드. useMyRecipes `:77-82` abortRef cleanup + `:90-92` 이전 abort + `:94` 매 effect `cancelled` 플래그 + `:103,:111` 가드 + `:124-127` cleanup에서 cancelled+abort. useRecipeDetail 동일 패턴(`:69-74`, `:81-83`, `:85`, `:94,:102`, `:126-129`). useRecipeCache는 상태만 — 무관 |
| 18 | pageSize clamp 신뢰 — useMyRecipes가 meta.pageSize 그대로 노출 / 화면이 query.pageSize로 페이지 계산 금지 | 코드 grep + 페이지 계산 위치 추적 | **PASS** | api-client 측: useMyRecipes `:99-109` listRecipes raw setState (meta 가공 0). 화면 측: `pages/my-recipes.tsx:80-86` `effectivePageSize = meta?.pageSize ?? PAGE_SIZE` + `total = meta?.total ?? 0` + `lastPage = Math.max(1, Math.ceil(total / effectivePageSize))` — `meta.pageSize` 기반 계산. `query.pageSize` 사용 위치는 listRecipes 호출 인자 1곳만 (page 계산 코드 0건) |

---

## 9. baseline §H.1 Phase 1·2 동결 코드 영향 (수정 0건 검증)

| 파일 | Phase 3 수정 예상 | 상태 | 결과 |
|------|----------------|:----:|------|
| `src/types/{api,recipe,user,env.d,index}.ts` | 수정 0건 | **PASS** | git diff --stat 출력 0 (수정 0 hunk) |
| `src/lib/zod/{api,recipe,stream,index}.ts` | 수정 0건 | **PASS** | git diff --stat 출력 0 |
| `src/services/{api-client,recipes,sse-client,index}.ts` | 수정 0건 | **PASS** | git diff --stat 출력 0 |
| `src/hooks/useTossUserId.tsx` | 수정 0건 | **PASS** | git diff --stat 출력 0 |
| `src/hooks/useRecipeGenerate.ts` | 수정 0건 | **PASS** | git diff --stat 출력 0 |
| `src/components/{SearchForm,RecipeDisplay,NutritionPanel,recipe-format}` | 수정 0건 | **PASS** | Phase 2 산출 그대로. `rg "recipe\\.id\\b" src/components/RecipeDisplay.tsx` = 0건 회귀 (불변식 2 유지) |
| `src/_app.tsx` | 확장만 (RecipeCacheProvider 래핑) | **PASS** | `_app.tsx:6` import + `:18-20` `<TossUserIdProvider><RecipeCacheProvider>{children}` 래핑만. 기존 AppsInToss.registerApp 흐름·context import·InitialProps 그대로 |
| `src/pages/index.tsx` | 확장만 (마이 진입 활성화) | **PASS** | `:35-37` handleOpenMyRecipes useCallback 추가 + `:43-47` PageNavbar.AccessoryButtons에 AccessoryTextButton 1개 추가. Phase 2 산출 본질(공개 endpoint, useTossUserId 미사용, SearchForm 제출 흐름)은 변경 0 |
| `src/pages/recipe/generate.tsx` | 확장만 (저장 버튼 + useSaveRecipe 결합) | **PASS** | `:37` useSaveRecipe import + `:66` 결합 + `:116-128` handleSave/handleRetryAll 추가 + `:205-217` RecipeDisplay actions slot에 "저장하기" Button + `:219-228` saveError 노출. Phase 2 산출 본질(SSE 흐름·status 분기·취소/다시시도)은 변경 0. `recipe.id`(GeneratedRecipe) 참조 0건 유지 — `saved.id`(Recipe) 라우팅만 |
| `tsconfig.json` | 수정 0건 (ADR-010 D6) | **PASS** | git diff --stat 출력 0 |
| `package.json` | 신규 의존성 0건 | **PASS** | git diff --stat 출력 0 |

---

## 10. baseline §H.3 ADR-011 D13 cast 격리 유지

**architect 보강 3 (2026-05-25)**: Phase 2 §8B 패턴 재사용 grep 명령 명시 — 신규 7 파일(훅 4 + 컴포넌트 3 + 페이지 2 + 확장 2)에서 다음 4 grep 모두 0 증가. 1건이라도 증가 시 §G #5 즉시 트리거 → architect 통지.

```
rg "as RequestInit\['signal'\]" src/                 # 정확 2곳: sse-client.ts:76 + api-client.ts:100
rg "as AbortSignal" src/                             # 0건
rg "as unknown as.*Signal" src/                      # 0건
rg "@ts-expect-error" src/                           # 정확 1곳: useTossUserId.tsx:21 (ADR-010 D7)
```

| # | 단언 | 검증 방법 | 상태 | 결과 |
|---|------|----------|:----:|------|
| 1 | `as RequestInit['signal']` cast 정확 2곳 유지 (sse-client.ts:76 + api-client.ts:100) | `rg "as RequestInit\\['signal'\\]" src/` = 2건 | **PASS** | grep 정확 2곳 — `src/services/sse-client.ts:76` + `src/services/api-client.ts:100` |
| 2 | 다른 모듈(hooks/pages/components/lib) 전파 0건 — `as AbortSignal`/`as unknown as...Signal` 0건 | `rg "as AbortSignal\|as unknown as.*Signal" src/` = 0 | **PASS** | grep 결과 0건. Phase 3 신규 4 훅 모두 fetch 직접 호출 없음 → cast 발생 자체 불가능 |
| 3 | `@ts-expect-error` 정확 1곳 (useTossUserId.tsx:21, ADR-010 D7) | `rg "@ts-expect-error" src/` = 1건 | **PASS** | grep 정확 1곳 — `src/hooks/useTossUserId.tsx:21` (Phase 1 ADR-010 D7 정합). Phase 3 신규 코드 0건 |

---

## 11. 통합 스윕

### 11.1 Phase 1 계승 5건

| # | 항목 | 명령 | FAIL 조건 | 상태 | 결과 |
|---|------|------|----------|:----:|------|
| 1 | TypeScript 컴파일 | `pnpm typecheck` | exit 0 이외 | **PASS** | exit 0 (`tsc --noEmit` 무출력) |
| 2 | ESLint | `pnpm lint` | 운영 코드 error | **PASS** | 0 errors, 1 warning(`router.gen.ts` 자동 생성 unused-disable, Phase 1·2 무해 누적) |
| 3 | 직접 fetch 호출 | `rg "\\bfetch\\s*\\(" src/` | services 외 발견 시 FAIL | **PASS** | 정확 2곳 (`src/services/api-client.ts:102` + `src/services/sse-client.ts:78`). Phase 3 신규 4 훅 0건 |
| 4 | `X-Toss-User-Id` 평문 노출 | `rg -i "x-toss-user-id" src/` | UI/console.log/Alert 발견 | **PASS** | `src/services/sse-client.ts:18` 상수 + `:26` 주석 + `src/services/api-client.ts:16` 상수만. JSX/Alert/console 0건 |
| 5 | 환경변수 키 격리 | `rg "import\\.meta\\.env\\." src/` | API_BASE_URL/APP_ENV/LOG_LEVEL 외 누출 | **PASS** | `sse-client.ts:20` + `api-client.ts:22` 모두 `API_BASE_URL`만. GEMINI/ANTHROPIC/SUPABASE 0건 |

### 11.2 Phase 2 추가 5건

| # | 항목 | 명령 | FAIL 조건 | 상태 | 결과 |
|---|------|------|----------|:----:|------|
| 6 | Tailwind 클래스 0건 | `rg "className=" src/` | 1건 이상 | **PASS** | 0건 |
| 7 | href/useRouter/Link/next 0건 | `rg "next/link\|useRouter\|<Link\|\\bhref=" src/` | 주석 제외 1건 이상 | **PASS** | 운영 코드 0건 — useNavigation/Route.useParams만 사용. Phase 2 검증 시 주석 1건(generate.tsx:14) 그대로 무해 |
| 8 | useAuth 0건 | `rg "useAuth\\b" src/` | 1건 이상 | **PASS** | 0건 |
| 9 | Phase 1 dev 트리거 잔존 0건 | `rg "Phase1DevTrigger\|isDev" src/pages/` | 1건 이상 | **PASS** | 0건 — Phase 2에서 일괄 제거 정합 유지 |
| 10 | progressText UI 직접 렌더 0건 | `rg "progressText" src/pages/ src/components/` | JSX `{progressText}` 발견 | **PASS** | `generate.tsx:19` 주석 인용 1건만 ("text 청크 delta 사용자 표시 0건"). JSX 렌더 0건 — useRecipeGenerate `:65`에서 `progressText` 비구조화 0건 (status·recipe·error·generate·reset만 사용). Phase 2 §D.2 #6 누적 |

### 11.3 Phase 2 §9.3 보강 2건

| # | 항목 | 명령 | FAIL 조건 | 상태 | 결과 |
|---|------|------|----------|:----:|------|
| 11 | typecheck 출력 `TS2769` 0건 + `AbortSignal` 0건 | `pnpm typecheck 2>&1 \| rg "TS2769\|AbortSignal"` | 발견 | **PASS** | typecheck exit 0 + grep 0건 |
| 12 | `as RequestInit\b` cast 정확 2곳 + 양쪽 주석 동반 | `rg "as RequestInit\\b" src/` | 2건 외 또는 주석 미동반 | **PASS** | §10 #1 동일. 양쪽 주석 Phase 2 PASS 누적 (sse-client.ts:69-72 + api-client.ts:99) |

### 11.4 Phase 3 신규 4건

| # | 항목 | 명령 | FAIL 조건 | 상태 | 결과 |
|---|------|------|----------|:----:|------|
| 13 | `recipe.id` 사용 위치 분류 — Recipe 한정 OK / GeneratedRecipe 표시 0건 | `rg "recipe\\.id\\b" src/components/ src/pages/` + 위치별 분류 | RecipeDisplay·generate.tsx(GeneratedRecipe 화면)에서 발견 | **PASS** | grep 결과: `pages/my-recipes.tsx:135,:137` (Recipe props OK) + `components/RecipeCard.tsx:13` 주석만. `RecipeDisplay.tsx`·`generate.tsx`에 0건. §8 #11 동일 |
| 14 | NotFoundScreen 단일 통일 — import 위치 단일 + `<ErrorPage>` 직접 렌더 0건 | `rg "NotFoundScreen" src/pages/` + `rg "<ErrorPage" src/pages/ src/components/` | NotFoundScreen 외 위치에서 ErrorPage 직접 렌더 | **PASS** | NotFoundScreen import 정확 1곳 (`pages/recipe/[id].tsx:24`). `<ErrorPage>` 직접 렌더 `components/NotFoundScreen.tsx:28` 단 1곳 (컴포넌트 내부). §8 #13 동일 |
| 15 | 식별자 가드 — `/my-recipes`·`/recipe/[id]` 모두 useTossUserId 사용 | `rg "useTossUserId" src/pages/my-recipes.tsx src/pages/recipe/\\[id\\].tsx` | 두 파일에 누락 | **PASS** | `pages/my-recipes.tsx:27,:37` + `pages/recipe/[id].tsx:28,:46` 모두 import + 호출. §8 #16 동일 |
| 16 | 캐시 trigger — useSaveRecipe.save 성공 시 invalidate 1회 / 실패 시 0건 | 코드 추적 | try-success 외 위치에서 invalidate 호출 | **PASS** | `useSaveRecipe.ts:92` 단 1건. grep `invalidate()` = 정확 1곳. catch(`:95-101`) 0건. baseline §H.2 #15 정합 |

---

## 12. baseline §G — 멈춤 트리거 (architect 통지 이력)

발견 시 본 섹션에 누적. 형식: `[일시] 트리거 분류 / 위치 / 처리 / 발송 대상`.

- (없음 — Phase 3 검증 시작 시점)

---

## 13. 발견된 FAIL 누적 (수정 요청 발송 이력)

발견 즉시 본 섹션에 누적. 형식: `[일시] 모듈 / 파일:라인 / 위반 단언 / 수정 방법 / 발송 대상`.

- (없음 — Phase 3 골격 단계, FAIL 0건)

---

## 14. 정보 공유 (FAIL 아님, 향후 참고)

### 14.1 useMyRecipes `refetchTick` dep과 `trigger` dep 동시 사용
- `useMyRecipes.ts:130-138` dep에 `trigger`(글로벌 invalidate)와 `refetchTick`(명시적 refetch) 둘 다 포함. 한 트리거가 다른 트리거를 덮어쓰지 않고 둘 다 단조 증가 — 명확한 분리. **PASS — 디자인 명확**.

### 14.2 useRecipeDetail에서 `data: null` 반환 시 화면 분기
- `useRecipeDetail.ts:33` `data: Recipe \| null`. 화면 측 사용 예 주석(`:18-23`)에 명시 — `if (notFound) return <NotFoundScreen />` 이후 `data!`. 분기 누락 시 null 접근 가능성은 frontend 검증 시 데이터 분기 점검.

### 14.3 useSaveRecipe.save의 `Promise<Recipe | null>` 반환
- 호출 측이 `if (saved)` 검사 후 `navigation.navigate('/recipe/[id]', { id: saved.id })`. null은 식별자 미발급/cancelled/에러 모두 포함. 화면 측 분기 명확성은 frontend 검증 시.

### 14.4 useMyRecipes `query` reference 안정성
- `useMyRecipes.ts:130-138` dep에 `query.favorite/page/pageSize` primitive 분해. 호출 측이 inline 객체 `{ page, pageSize: 20 }` 전달해도 primitive 비교라 안정 — re-render 폭주 없음. 디자인 명확.

### 14.5 useSaveRecipe `tossUserId === undefined` 분기 시 UNAUTHORIZED 메시지
- `useSaveRecipe.ts:70-74` 식별자 미발급 상태에서 `setError(ERROR_CODE_MESSAGES.UNAUTHORIZED)` ("로그인이 필요해요. 잠시 후 다시 시도해 주세요."). 실제 401이 아니라 식별자 발급 전 상태인데 동일 메시지 노출 — 사용자 경험상 "잠시 후 다시" 자체는 정확하지만 UNAUTHORIZED라는 의미와 약간 다름. **FAIL 아님 — 일관 메시지 정합**.

### 14.6 색상 hex 직접 사용 (TDS adaptive 토큰 미사용 — Phase 2 §13.1 인계 누적)
- Phase 3 신규 컴포넌트(RecipeCard·EmptyState·my-recipes·[id].tsx) 모두 `color="#191F28"`/`color="#4E5968"`/`backgroundColor: '#FFFFFF'` 등 hex 직접 사용. Phase 2 §13.1 인계 그대로 — 디자인 토큰 일괄 교체는 별 ADR. **현 단계 FAIL 아님**.

### 14.7 my-recipes.tsx 페이지네이션 — total=0 시 lastPage=1 폴백
- `pages/my-recipes.tsx:82-84` `lastPage = Math.max(1, Math.ceil(total / effectivePageSize))`. 빈 목록도 1/1 표시(다음 비활성) — UX 일관. EmptyState 렌더 분기는 `:124` `data.length === 0`로 처리되므로 페이지 정보 표시는 트리 진입 안 함. 디자인 명확.

### 14.8 generate.tsx handleRetryAll — saveError 함께 reset
- `pages/recipe/generate.tsx:125-128` `handleRetryAll = () => { resetSave(); handleRetry(); }` — 다시 시도 시 stale saveError 차단. 새 생성 → 새 저장 시도 흐름 정합. 디자인 명확.

### 14.9 [id].tsx handleBack — canGoBack 우선
- `pages/recipe/[id].tsx:49-55` `if (navigation.canGoBack?.()) navigation.goBack(); else navigation.navigate('/my-recipes', {})`. 딥링크 직접 진입(스택 없음) 시에도 fallback 동작. **PASS — ADR-004 딥링크 정합 디자인**. AC3.3(c) 시나리오 코드 경로 보장.

### 14.10 useRecipeGenerate 5-tuple만 비구조화 (status·recipe·error·generate·reset)
- `pages/recipe/generate.tsx:65` `const { status, recipe, error, generate, reset } = useRecipeGenerate()` — `progressText`/`cancel`은 비구조화 0건. text 청크 UI 미표시 정합(§11 #10 PASS) + cancel 대신 reset 사용(Phase 2 §13.4 디자인). UseRecipeGenerateResult 7 필드 중 2개 미사용 — TS는 객체 비구조화 누락을 허용하므로 무해.

---

## 15. 변경 이력

| 일시 | 변경 | 사유 |
|------|------|------|
| 2026-05-25 | 초기 골격 작성 — 모든 단언 PENDING | baseline 동결 통지 수신. api-client/frontend 산출 도착 시 모듈별 즉시 검증 시작. Phase 1·2 매트릭스 패턴(코드 경로 + 실호출 분리) 계승. baseline §A 12 산출 / §H.2 격리 단언 #11~18 / §B.1 TDS 신규 4종 / AC3.1~3.6 / 통합 스윕 16건 모두 PENDING 카탈로그 |
| 2026-05-25 | **api-client 5 산출 [A][B][C] 도착 + 즉시 검증 — ALL PASS (코드 경로)** | useRecipeCache·useMyRecipes·useRecipeDetail·useSaveRecipe + _app.tsx 검증. 03 §3.10 7건 PASS·1건 PENDING(frontend 종결), 07 §7.5.4 4건 PASS, §H.2 6건 PASS·2건 PENDING(frontend), §H.1 동결 11건 PASS, §H.3 cast 격리 2건 PASS, 통합 스윕 12건 PASS·4건 PENDING(frontend). typecheck exit 0, lint 0 errors (router.gen.ts warning 무해), fetch 정확 2곳 유지, cast 정확 2곳 유지, env 키 격리 PASS, X-Toss-User-Id 평문 0건. **FAIL 0건 누적**. frontend 5 산출 도착 후 통합 매트릭스 일괄 갱신 예정. 정보 공유 5건 (14.1~14.5) |
| 2026-05-25 | **architect 보강 3건 반영** | §H.2 #16 — 식별자 가드 단일 분기 정책(ErrorPage 503 본 Phase 미적용) 명시. AC3.3 — 새로고침 = 라우트 재진입((a)(b) 코드 경로 PASS / (c) 딥링크는 토스 환경 PENDING 분리). §10 — cast 격리 grep 4종 명시(`as RequestInit['signal']` 2곳 / `as AbortSignal` 0 / `as unknown as.*Signal` 0 / `@ts-expect-error` 1곳). §10 #3 (`@ts-expect-error` 정확 1곳) 신규 단언 추가 |
| 2026-05-25 | **frontend 7 산출 도착 + 통합 검증 — ALL PASS, FAIL 0건 누적** | RecipeCard·EmptyState·NotFoundScreen + my-recipes·[id].tsx + index/generate 확장 7 파일 정독 + grep 전수 검증. baseline §A 13/13 PASS, 03 §3.10 8/8 PASS(Phase 3 적용), 06 §6.7 5/5 PASS, 07 §7.9 5/5 PASS, 07 §7.5.4 5/5 PASS, §B.1 TDS 4/4 PASS, §H.2 격리 8/8 PASS, §H.1 동결 11/11 PASS, §H.3 cast 3/3 PASS, 통합 스윕 16/16 PASS, AC3.1~3.6 코드 경로 6/6 PASS. typecheck/lint 회귀 PASS, recipe.id Recipe 한정 사용·GeneratedRecipe 표시 0건, NotFoundScreen import 단일 1곳(`pages/recipe/[id].tsx:24`), `<ErrorPage>` 직접 렌더 컴포넌트 내부 1곳만, "찾을 수 없" 인라인 텍스트 0건, 보호 화면 2개 모두 useTossUserId 가드, my-recipes 페이지 계산이 `meta.pageSize` 신뢰. **Phase 3 QA ALL PASS (코드 경로) 확정**. 실호출 6건만 백엔드 옵션 P 배포 후 PENDING. 정보 공유 10건 (14.1~14.10) |
