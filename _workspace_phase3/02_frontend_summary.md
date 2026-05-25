# Phase 3 — frontend 산출 요약

> 작성: miniapp-frontend · 2026-05-24 · 팀 `airecipe-miniapp-phase3`
> 입력: `_workspace/00_input/requirements.md`, `_workspace/01_architect_phase3_baseline.md`,
>       `_workspace_phase1/02_frontend_summary.md`, `_workspace_phase2/02_frontend_summary.md`,
>       `_workspace/02_api_client_summary.md` (구두 통지로 인계 — T2 산출 시그니처)
> 범위: Phase 3 baseline §E.fe 분담 — 컴포넌트 3종 + 라우트 2종 + 생성/홈 화면 확장 + router.gen 갱신

---

## 1. 산출 파일

### 신규 코드

| 파일 | 책임 | baseline 매핑 |
|------|------|--------------|
| `src/components/RecipeCard.tsx` | 저장된 `Recipe` 1건 카드 — RN `Pressable`+`View` + TDS `Txt`(t5/st9) + `Badge`(tiny, green/teal/red/elephant). 즐겨찾기·삭제는 자리표시 prop만(미렌더) | §A.2, 06 §6.4.4, §B.2 |
| `src/components/EmptyState.tsx` | 빈 목록 안내 — TDS `Txt`(t3/st9) + `Button`(primary/fill/block/medium). props 4종(title/description/actionLabel/onAction) | §A.2, 06 §6.5, §B.3 |
| `src/components/NotFoundScreen.tsx` | 단일 404 UI — TDS `ErrorPage`(statusCode=404, title/subtitle/onPressLeftButton) 합성. `<ErrorPage>` 직접 사용 위치는 본 파일 1곳뿐 (§H.2 #13) | §A.2, 06 §6.5, §B.3, ADR-005 |
| `src/pages/my-recipes.tsx` | `/my-recipes` 화면 — 식별자 가드 + `useMyRecipes({ page, pageSize: 20 })` + 4-way 분기(로딩/에러/EmptyState/카드 목록) + 단순 페이지네이션(이전/다음 Button) | §A.3, §C.1, §C.4, §C.5, 07 §7.3.3 |
| `src/pages/recipe/[id].tsx` | `/recipe/[id]` 화면 — `validateParams` Phase 2 generate.tsx:39-50 답습 + 식별자 가드 + `useRecipeDetail(id)` + 로딩/404/에러/정상 4-way + 단일 `NotFoundScreen` | §A.3, §C.2, §C.4, §B.3, 07 §7.3.4, ADR-004·005 |
| `pages/my-recipes.tsx` | Granite barrel — `export { Route } from 'pages/my-recipes'` (`baseUrl: "src"` alias) | §A.3 |
| `pages/recipe/[id].tsx` | Granite barrel | §A.3 |

### 확장

| 파일 | 변경 | 사유 |
|------|------|------|
| `src/pages/index.tsx` | `<PageNavbar.AccessoryButtons>` + `<PageNavbar.AccessoryTextButton onPress={...}>마이 레시피</...>` 추가 — 클릭 시 `navigation.navigate('/my-recipes', {})` | §A.3 #7, §C.5 — Phase 2의 disabled placeholder 자리(미작성)에 본 Phase 액세서리 1개 활성화 |
| `src/pages/recipe/generate.tsx` | `useSaveRecipe` 결합 + `RecipeDisplay`의 `actions` slot에 "저장하기" Button(primary/fill/block/large, `loading={isSaving}`, `disabled={isSaving}`) 주입 + saveError 박스 + handleRetryAll(생성 + 저장 에러 동시 초기화) | §A.3, §A.4 — recipe.id 미참조 유지(불변식 2 누적). 저장 성공 시 `navigation.navigate('/recipe/[id]', { id: saved.id })` 직진 |
| `src/router.gen.ts` | `/my-recipes` + `/recipe/[id]` 등록 추가 (Phase 2 패턴 답습 — granite dev 첫 실행 시 자동 재생성 예상) | §C.3 — 4 라우트 매트릭스 완성 |

### 삭제

본 Phase 삭제 없음.

---

## 2. 노출 인터페이스

### `RecipeCard`

```ts
export interface RecipeCardProps {
  recipe: Recipe;                                  // 저장된 Recipe — id 사용 OK
  onPress: () => void;
  onToggleFavorite?: (target: boolean) => void;    // Phase 4 자리표시 — 본 Phase 미렌더
  onDelete?: () => void;                           // Phase 4 자리표시 — 본 Phase 미렌더
}
```

- 카드 전체가 `Pressable` — `onPress`로 부모(`pages/my-recipes.tsx`)가 상세 진입 결정.
- Badge 매핑은 `RecipeDisplay` 동일 패턴(`difficultyTone` → green/fill·teal/weak·red/fill, 메타 → elephant/weak). `recipe-format` 재사용.
- 06 §6.4.4 표 행 중 Phase 3 사용 범위만 구현 (`FavoriteButton`/삭제 보조 버튼은 Phase 4 트리거).

### `EmptyState`

```ts
export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}
```

- props로 다른 빈 상태에도 재사용 (Phase 4 즐겨찾기 0건 등). 단일 액션만(다중 액션은 별 결정).

### `NotFoundScreen`

```ts
export interface NotFoundScreenProps {
  onBack: () => void;                              // navigation.goBack() 일반.
}
```

- 내부 1줄로 `<ErrorPage statusCode={404} title="레시피를 찾을 수 없어요" subtitle="삭제되었거나 다른 사용자의 레시피일 수 있어요." onPressLeftButton={onBack} />` 합성.
- **단일 컴포넌트 정책 강제** — `<ErrorPage>` 직접 import는 본 파일에만(grep 검증 §6 #5). Phase 4 PATCH/DELETE 404 시점에도 동일 재사용.

### 라우트

| Granite 라우트 | 파일 | 보호 | params 시그니처 | 진입 시 |
|---------------|------|------|-----------------|---------|
| `/` | `src/pages/index.tsx` | 공개 | — | PageNavbar(+AccessoryTextButton "마이 레시피") + 안내 + SearchForm |
| `/recipe/generate` | `src/pages/recipe/generate.tsx` | 공개 | `{ dishName?: string; servings?: number }` | Phase 2 패턴 + 저장 버튼(actions slot) |
| `/my-recipes` | `src/pages/my-recipes.tsx` | 식별자 가드 | — | useMyRecipes 결합 + EmptyState/카드 목록/페이지네이션 |
| `/recipe/[id]` | `src/pages/recipe/[id].tsx` | 식별자 가드 | `{ id: string }` (Phase 2 validateParams 패턴 답습) | useRecipeDetail 결합 + 404→NotFoundScreen 단일 |

---

## 3. 훅 결합 패턴 (api-client 산출 인용)

### `useMyRecipes` (in `pages/my-recipes.tsx`)

```tsx
const { tossUserId } = useTossUserId();
if (tossUserId === undefined) return <식별자 로딩 가드>;

const [page, setPage] = useState(1);
const query = useMemo(() => ({ page, pageSize: PAGE_SIZE }), [page]);
const { data, meta, isLoading, error, refetch } = useMyRecipes(query);
```

- `meta.pageSize` 신뢰(ADR-006) — `lastPage = Math.ceil(meta.total / meta.pageSize)`. `query.pageSize`로 계산 금지 (baseline §H.2 #18).
- `data.length === 0` → `<EmptyState />`. error → 한국어 박스 + "다시 시도"(`onPress={refetch}`).
- 카드 탭 → `navigation.navigate('/recipe/[id]', { id: recipe.id })`.

### `useRecipeDetail` (in `pages/recipe/[id].tsx`)

```tsx
const { tossUserId } = useTossUserId();
if (tossUserId === undefined) return <식별자 로딩 가드>;

const { id } = Route.useParams();
const { data: recipe, isLoading, notFound, error, refetch } = useRecipeDetail(id);
if (notFound) return <NotFoundScreen onBack={handleBack} />;
// 로딩/에러/정상은 ScrollView 내부에서 분기
```

- 404는 훅이 `notFound: true`로 정규화(ADR-005) — 화면은 NotFoundScreen 1개로 통일.
- `recipe.id`는 화면이 직접 참조하지 않음 — RecipeDisplay는 GeneratedRecipe 공통 필드만 사용 (불변식 2 누적).
- 새로고침/라우트 재진입 정상 (ADR-004) — 훅이 단건 fetch.

### `useSaveRecipe` (in `pages/recipe/generate.tsx`)

```tsx
const { save, isSaving, error: saveError, reset: resetSave } = useSaveRecipe();

const handleSave = useCallback(async () => {
  if (!recipe) return;
  const saved = await save(recipe);
  if (saved) navigation.navigate('/recipe/[id]', { id: saved.id });
}, [recipe, save, navigation]);
```

- 캐시 invalidate는 훅 내부에서 자동(baseline §D.3) — 본 화면 호출 책임 없음.
- 실패 시 `saved === null` → 라우팅 보류, `saveError` 박스 노출 (HTTP 상태/원문 노출 0건).
- 새 생성 시도 시 `handleRetryAll`로 `resetSave()` + `handleRetry()` 동시 호출 — stale saveError 잔존 차단.

---

## 4. AC 매핑 (requirements §AC3 / baseline §I)

| AC | 충족 위치 | 비고 |
|----|----------|------|
| **AC3.1** 저장 → 201 + `Recipe`(id) | `useSaveRecipe` (api-client) + `generate.tsx` `handleSave` | 코드 경로 PASS. 실호출은 백엔드 옵션 P 배포 후 |
| **AC3.2** 저장 후 마이 첫 페이지 첫 항목 | invalidate(훅 자동) → `trigger` 증가 → `useMyRecipes` useEffect 재호출 → 최신 정렬(백엔드 `created_at desc`) | 코드 경로 PASS — 화면은 cache trigger 인지 없이 자동 refetch |
| **AC3.3** 카드 → 상세 → 새로고침 정상 | `my-recipes` 카드 탭 `navigate('/recipe/[id]', { id })` + `[id].tsx`의 `useRecipeDetail(id)` 단건 fetch (ADR-004) | 코드 경로 PASS |
| **AC3.4** `pageSize=100` → meta.pageSize=50 신뢰 | `my-recipes.tsx`가 `meta.pageSize`로 lastPage 계산 (query.pageSize 미사용) | 코드 경로 PASS |
| **AC3.5** 두 식별자 → 서로 안 보임 (격리) | 보호 화면 가드 + api-client가 매 요청 헤더 부착 | 코드 경로 PASS / 실호출 PENDING(옵션 P) |
| **AC3.6** `?favorite=true` 필터 | Phase 4 즐겨찾기 토글 진입 후 — 본 Phase는 query.favorite 미사용(전체 목록만) | 본 Phase 비범위 |

---

## 5. 라우트 표 (Phase 3 최종)

| Granite 라우트 | 파일 | 보호 | 진입 |
|---------------|------|------|------|
| `/` | `src/pages/index.tsx` (barrel `pages/index.tsx`) | 공개 | PageNavbar + 안내 + SearchForm + 마이 진입 액세서리 |
| `/recipe/generate` | `src/pages/recipe/generate.tsx` (barrel `pages/recipe/generate.tsx`) | 공개 | SearchForm + 진행 인디케이터 + RecipeDisplay(저장 버튼 actions) + NutritionPanel |
| `/my-recipes` | `src/pages/my-recipes.tsx` (barrel `pages/my-recipes.tsx`) | 식별자 가드 | useMyRecipes + EmptyState/카드 목록/페이지네이션 |
| `/recipe/[id]` | `src/pages/recipe/[id].tsx` (barrel `pages/recipe/[id].tsx`) | 식별자 가드 | useRecipeDetail + 404→NotFoundScreen + RecipeDisplay/NutritionPanel |

---

## 6. 격리 단언 검증 (baseline §D Phase 1/2/3 누적)

| # | 단언 | 결과 |
|---|------|------|
| 1 | 직접 `fetch(` 호출은 api-client.ts + sse-client.ts 2곳뿐 | **PASS** — grep `src/`에서 `api-client.ts:102` + `sse-client.ts:78` 정확 2건 |
| 2 | Tailwind 클래스 0건 (`className=`, `tw\``) | **PASS** — 0건 |
| 3 | `href`/`useRouter`/`<Link>` 코드 0건 | **PASS** — grep 결과 모두 주석·AGENTS.md 인용 |
| 4 | `useAuth` 코드 0건 | **PASS** — 모두 AGENTS.md 인용 |
| 5 | `<ErrorPage>` 직접 import는 NotFoundScreen 1곳만 | **PASS** — `src/pages/`에서 ErrorPage import 0건. `src/components/NotFoundScreen.tsx` 1곳에서만 |
| 6 | `pages/`에서 "찾을 수 없" 텍스트 코드 0건 | **PASS** — grep 결과 [id].tsx의 docstring 1건뿐(코드 0건) |
| 7 | AbortSignal cast 정확 2곳(services) | **PASS** — `api-client.ts:100` + `sse-client.ts:76` 그대로. 다른 위치 추가 0건 |
| 8 | `recipe.id` 사용은 저장된 Recipe 한정 | **PASS** — `my-recipes.tsx:135,137`(map key + onPress) + RecipeCard 주석. RecipeDisplay/generate.tsx의 GeneratedRecipe 사용처에서 `recipe.id` 참조 0건 |
| 9 | 보호 화면(my-recipes, recipe/[id]) `useTossUserId` 사용 | **PASS** — 두 화면 모두 `useTossUserId().tossUserId === undefined` 분기 |
| 10 | 공개 화면(/, /recipe/generate)은 `useTossUserId` 미사용 | **PASS** — index.tsx·generate.tsx import 0건. 저장 흐름의 `useTossUserId`는 useSaveRecipe 훅 내부 격리 |
| 11 | text 청크 delta 사용자 화면 표시 0건 (Phase 2 누적) | **PASS** — generate.tsx `progressText` 미참조(인디케이터만) |
| 12 | 404 단일 컴포넌트 정책 — pages 4-way 분기 시 NotFoundScreen 1개만 | **PASS** — `recipe/[id].tsx`의 `if (notFound) return <NotFoundScreen .../>` 단일 |
| 13 | meta.pageSize 신뢰 — query.pageSize로 lastPage 계산 금지 | **PASS** — `my-recipes.tsx`의 lastPage 계산이 `meta?.pageSize ?? PAGE_SIZE` 사용 |
| 14 | router.gen.ts 라우트 4개 등록 매트릭스 | **PASS** — `/`·`/recipe/generate`·`/my-recipes`·`/recipe/[id]` 4건 |

---

## 7. 검증 — typecheck / lint

```bash
pnpm typecheck   # 0 errors
pnpm lint        # 0 errors, 1 warning (router.gen.ts unused-disable — Phase 1·2 누적, 자동 생성 한계)
```

실호출 검증(AC3.x 통과 매트릭스)은 qa(T4) 책임. `granite dev` 실 가동은 ADR-010 D7(SDK 패키지 경로) 해소가 별 트리거 — 본 Phase에서도 보류(첫 보호 endpoint 마운트 = useMyRecipes/useRecipeDetail = SDK 실호출 트리거. baseline §G #3).

---

## 8. 미해결·후속 작업

| 항목 | 처리 위치 |
|------|----------|
| `@apps-in-toss/web-framework` 패키지 경로 검증 (Phase 1·2 인계 #1) | Phase 3 첫 `granite dev` 실행 시 = 마이/상세 첫 진입 시 useTossUserId의 SDK 실호출. 미해결이면 architect 통지(baseline §G #3 — 추측 변경 금지) |
| `router.gen.ts` 자동 재생성 | granite dev 첫 실행 시 자동. 본 산출의 수동 갱신은 한시 |
| Phase 4 즐겨찾기 토글 / 삭제 / 즐겨찾기 필터 (`useToggleFavorite`/`useDeleteRecipe`/`?favorite=true` 토글 UI) | Phase 4 — `RecipeCard`의 `onToggleFavorite`/`onDelete` prop 자리표시는 그대로, 미렌더 해제만 추가. `NotFoundScreen` 재사용(PATCH/DELETE 404). `RecipeDisplay.actions` slot에 즐겨찾기·삭제 버튼 추가 |
| 하드웨어 백 가드(`useBackEvent`) (Phase 2 인계 #5) | 본 Phase에서도 보류(baseline §C.6). Phase 4 PATCH/DELETE 시 낙관적 업데이트 롤백과 함께 재검토 |
| 디자인 토큰 일괄 교체 (Phase 2 §13.1 인계 — 별 ADR) | Phase 3에서도 hex 직접 사용 유지. ADR 결정 후 일괄 교체 |
| Phase 3 결정 4종 묶음 ADR-012(가칭) | T5 (architect) — baseline §F.2 |
| AGENTS.md 갱신 3종 (hooks/components/pages) | T5 (architect) — baseline §F.4 |
| 06 §6.5 갱신(EmptyState/NotFoundScreen 실 구현 시그니처) | T5 (architect) — baseline §F.3 |

---

## 9. 변경 이력

| 일시 | 변경 | 사유 |
|------|------|------|
| 2026-05-24 Stage A | RecipeCard/EmptyState/NotFoundScreen 작성 + my-recipes/[id] 라우트 골격(mock-only) + barrel 2개 + router.gen.ts 갱신 + index.tsx 마이 진입 활성화 | baseline §E.fe — 단독 가능 [D]+[H]+라우트 골격 [E][F] 선행. ErrorPage 실 시그니처(`node_modules/.../ErrorPage.d.ts`) PASS. typecheck/lint PASS |
| 2026-05-24 Stage B | my-recipes/[id] mock 제거 → 훅 결합(useMyRecipes/useRecipeDetail) + generate.tsx 확장(useSaveRecipe 결합 + 저장 버튼 actions slot + saveError 박스 + handleRetryAll) | api-client T2 시그니처 통지 도착 후 [B][C] 완료에 따라 [E][F][G] 결합. typecheck/lint PASS. 격리 단언 14건 모두 PASS |
