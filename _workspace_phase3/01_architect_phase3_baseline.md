# Phase 3 Baseline — 저장·목록·상세 (기능 c/d)

> 작성: miniapp-architect · 2026-05-24 · 팀 `airecipe-miniapp-phase3`
> 입력 SSOT: `docs/appsintoss-port/03·06·07`, `docs/adr/ADR-004·005·006·009·010·011`, `_workspace_phase1/01_architect_phase1_baseline.md`, `_workspace_phase2/01_architect_phase2_baseline.md`, `_workspace_phase2/04_session_log.md`, `_workspace/00_input/requirements.md`
> 범위: Phase 3(저장 / 목록 / 상세 — 기능 c/d) 진입 전 SSOT 인용 경로를 코드로 옮기는 1:1 매핑 + 라우팅·캐시·404 단일화·산출 분담
> 비범위: Phase 4(즐겨찾기 PATCH / 삭제 DELETE / 즐겨찾기 필터 토글), 백엔드 옵션 P 마이그레이션(별 저장소 AIReceipe ADR)

본 baseline은 api-client·frontend·qa가 **추측 없이** 동일한 SSOT 지점을 참조하도록 인용 경로를 고정한다. Phase 1·2 동결(ADR-010·011)은 그대로 유지하며, 본 Phase의 결정은 **추가만** — Phase 1·2 코드 본질 수정 없음. 미해결 트리거가 새로 발생하면 §G로.

---

## A. 산출물 1:1 매핑 — SSOT 인용 → 미니앱 코드 (Phase 3)

### A.1 데이터 흐름 훅 (api-client 담당)

| 산출 책임 | SSOT 인용 (정확 위치) | 미니앱 동작 |
|----------|---------------------|-----------|
| `useMyRecipes(query, options): { data, meta, isLoading, error, refetch }` | 03 §3.3.1~3.3.5 (라인 270~331) + `recipes.ts:listRecipes(query, auth)` | `listRecipes` 호출 → raw `{ data: Recipe[], meta }` 보존 (ADR-010 D5 — listRecipes만 raw). `meta.pageSize` 신뢰 (ADR-006 + 03 §3.10 #10). 401 자동 재시도 (useTossUserId.refresh 주입). cache trigger를 dependency로 받아 invalidate 시 refetch (§D) |
| `useRecipeDetail(id, options): { data, isLoading, notFound, error, refetch }` | 03 §3.4.1~3.4.5 (라인 336~376) + `recipes.ts:getRecipe(id, auth)` | `getRecipe` 호출. **404는 `notFound: true`로 정규화** — ADR-005 통일(없음·잘못된 id·타인 소유 모두 404). `error.code === 'NOT_FOUND'` 체크 + 그 외 에러는 `error` state 노출. 새로고침/라우트 재진입 정상 (ADR-004) |
| `useSaveRecipe(): { save, isSaving, error }` | 03 §3.5.1~3.5.5 (라인 379~419) + `recipes.ts:saveRecipe(req, auth)` | `saveRecipe({ recipe })` 호출 → 201 + `Recipe`(id 포함) 반환. 성공 시 (1) 캐시 invalidate trigger 호출 (§D.3), (2) 반환된 `saved.id`를 호출 측에 전달 → frontend가 `/recipe/[id]` 진입 |
| `RecipeCacheProvider` + `useRecipeCacheTrigger()` | 본 baseline §D 결정 (SWR/RQ 미도입 정합) | Context — `{ trigger: number, invalidate: () => void }`. `useMyRecipes`/`useRecipeDetail`이 `trigger`를 useEffect dep으로 사용. `useSaveRecipe` 성공 시 `invalidate()` 호출 |
| 401 재시도 + 헤더 부착 | 05 §5.4 (Phase 1 PASS) + ADR-010 D3 | 기존 `apiFetch` 메커니즘 그대로 — refreshTossUserId 주입만 책임 |

> **DIP**: 3 훅 모두 `recipes.ts` 함수 + `useTossUserId`에만 의존. fetch/SSE/SDK 직접 의존 0건. UI는 본 훅의 외부 인터페이스에만 의존.

### A.2 UI 컴포넌트 (frontend 담당)

| 파일 | TDS 매핑 (06 §6.4.4 / §6.5) | 책임 |
|------|---------------------------|------|
| `src/components/RecipeCard.tsx` (신규) | RN `View` + `Pressable` + TDS `Txt`(typography t5/st9) + TDS `Badge`(size="small") | 저장된 `Recipe` 1건 카드. 클릭 → 상세 진입(콜백 props). 즐겨찾기/삭제 액션은 Phase 4(자리표시 prop 받되 본 Phase는 미렌더). `recipe.id` 사용 OK (저장된 Recipe 한정 — §D.2 #11) |
| `src/components/EmptyState.tsx` (신규) | RN `View` + TDS `Txt`(typography t3/st9) + TDS `Button`(display="primary") | 빈 목록 안내. props: `title`, `description`, `actionLabel`, `onAction`. 마이 화면에서 "첫 레시피를 만들어 보세요" + 홈으로 이동 |
| `src/components/NotFoundScreen.tsx` (신규) | TDS `ErrorPage statusCode={404}` 합성 | 단일 404 UI (ADR-005 통일). props: `onBack: () => void`. 상세 화면(`/recipe/[id]`)에서 `notFound: true` 시 렌더. **Phase 4 PATCH/DELETE 후 404 응답에서도 동일 컴포넌트 재사용**(컴포넌트 SRP — 화면별 분기 0건) |

### A.3 라우트 (frontend 담당)

| 파일 | 책임 | SSOT 인용 | Phase 3 작성 범위 |
|------|------|----------|----------------|
| `src/pages/my-recipes/index.tsx` (신규) | 마이 레시피 목록 화면 — PageNavbar + EmptyState 또는 RecipeCard 목록 + 페이지네이션 버튼 | 07 §7.3.3 (라인 131~141) + §7.4 #3 행 (라인 197) | `Route.useParams()` 빈 객체. 식별자 가드(§C.4). `useMyRecipes({ page, pageSize: 20 })`. 카드 탭 → `navigation.navigate('/recipe/[id]', { id })` |
| `src/pages/recipe/[id].tsx` (신규) | 레시피 상세 화면 — PageNavbar + RecipeDisplay + NutritionPanel + 404 분기 | 07 §7.3.4 (라인 143~167) + §7.4 #4 행 (라인 198) | `Route.useParams<{ id: string }>()`. 식별자 가드(§C.4). `useRecipeDetail(id)`. 로딩/404/에러/정상 4-way 분기. 즐겨찾기·삭제 버튼은 Phase 4 |
| `src/pages/recipe/generate.tsx` (확장) | Phase 2 산출 + "저장" 버튼 추가 | 본 baseline §A.4 (저장 흐름) | `useSaveRecipe()` 추가. recipe state truthy + status === 'done' 일 때 "저장" 버튼 노출. 클릭 → `save(recipe)` → 성공 시 `navigation.navigate('/recipe/[id]', { id: saved.id })` |
| `src/pages/index.tsx` (확장) | 홈 화면 — 마이 레시피 진입 활성화 | 07 §7.3.1 (라인 47~91) | Phase 2의 disabled placeholder를 활성화 — PageNavbar 우측 액세서리 또는 본문 버튼으로 `navigation.navigate('/my-recipes', {})` |
| `src/router.gen.ts` | 자동 생성 — 수정 금지 | 07 §7.2 #5 | granite dev 가동 시 자동 갱신. Phase 3 종료 시 라우트 4개(`/`, `/recipe/generate`, `/my-recipes`, `/recipe/[id]`) 등록 |

### A.4 저장 흐름 — 결정 (`/recipe/[id]` 직진)

- 생성 화면(`/recipe/generate`)에서 `recipe` 청크 수신 + `status === 'done'` 후 "저장" 버튼 표시.
- 저장 성공 → `useRecipeCacheTrigger.invalidate()` (마이 목록 무효화) → `navigation.navigate('/recipe/[id]', { id: saved.id })`.
- **이유**: (1) requirements §AC3.2/3.3과 정합 — "저장 후 마이 목록에 보이고, 카드 탭 → 상세 진입 → 새로고침 정상". 직진 상세가 사용자 흐름상 자연. (2) 07 §7.3.2 표(라인 103) — 현재 웹도 `router.push('/recipe/[id]')` 패턴. (3) `CommonActions.reset`은 본 Phase 비범위 — generate 스택을 유지해도 사용자 백 동작은 자연(생성 → 상세 → 백 → 생성).

### A.5 페이지네이션 결정 — 단순 페이지네이션 (Phase 3 MVP)

- `useMyRecipes({ page, pageSize: 20 })` — page state는 화면 측 useState. "다음" 버튼 클릭 시 page+1, `meta.total`/`meta.pageSize`로 마지막 페이지 판정.
- 무한 스크롤(FlatList onEndReached)은 **Phase 5 출시 직전 별 ADR** — 본 Phase MVP는 단순성 우선 + 백엔드 meta 신뢰(ADR-006) + AC3.4(`pageSize=100` clamp 신뢰) 검증 단순화.
- 빈 응답(`data: []` + `meta.total: 0`) → `<EmptyState />` 렌더. 503/401은 별 분기(에러 박스 또는 ErrorPage).

---

## B. TDS 컴포넌트 실재성 cross-check (Phase 3 신규 사용 분)

> Phase 2 baseline §B.1의 검증 결과(15종 PASS)를 그대로 누적. Phase 3에서 새로 사용하는 4종을 추가 검증.

### B.1 신규 사용 컴포넌트

| Phase 3 사용 명칭 | 실제 export | 패키지 경로 | 핵심 props | 검증 |
|------------------|------------|-------------|------------|------|
| `Pressable` | RN 내장 | `react-native` | `onPress`, `accessibilityRole`, `accessibilityLabel`, `disabled`, `style` | RN 표준. RecipeCard 클릭 영역. `TouchableOpacity` 대안 가능 — frontend가 디자인 일관성으로 선택 |
| `ErrorPage` | ✅ `ErrorPage` | `@toss/tds-react-native` (root, via `./components/error-page`) | `statusCode?: number`, `title?: string`, `subtitle?: string`, `onPressLeftButton?`, `onPressRightButton?`, `children?` (`node_modules/@toss/tds-react-native/dist/esm/components/error-page/ErrorPage.d.ts` 인용) | **NotFoundScreen 합성 가능** — `<ErrorPage statusCode={404} title="레시피를 찾을 수 없어요" subtitle="..." onPressLeftButton={onBack} />` 패턴 |
| `IconButton` (즐겨찾기 자리표시 — Phase 4 활용) | Phase 2 §B.1 #8 PASS 인용 | root | `source`/`name` 둘 중 하나 + `variant?: 'fill'\|'clear'\|'border'`, `iconSize?`, `label?`, `onPress?`, `disabled?` | Phase 3에서는 RecipeCard prop으로만 노출(미렌더) — 실 사용은 Phase 4 |
| `Button`(저장 버튼) | Phase 2 §B.1 #1 PASS 인용 | root | `type?`, `style?`, `display?`, `size?`, `loading?`, `disabled?`, `onPress?`, `children` | generate 화면의 저장 버튼에 `loading={isSaving}` + `disabled={!recipe \|\| isSaving}` |

### B.2 06 §6.4.4 `RecipeCard` 매핑 cross-check 확정

06 §6.4.4 표 행 그대로 사용하되 본 Phase 3 작성 범위는 다음으로 한정:

| 06 §6.4.4 표 행 | Phase 3 사용 여부 |
|--------------|----------------|
| `<Card hover:shadow-md>` → `View` + `Pressable` 래퍼 | ✅ |
| `<Link href>` 카드 전체 → `Pressable onPress={navigation.navigate}` | ✅ |
| 제목 → `Txt typography="t5"` | ✅ |
| `<FavoriteButton>` | **Phase 4** — RecipeCard props로 받되 본 Phase 미렌더 |
| 설명 `numberOfLines={2}` | ✅ |
| Badge 묶음 (difficulty·servings·cookTime) | ✅ — Phase 2 RecipeDisplay와 동일 패턴 (recipe-format 재사용) |
| "자세히 보기" 버튼 | ✅ (선택) 또는 카드 전체 Pressable로 갈음 (frontend 결정) |
| 삭제 보조 버튼 | **Phase 4** |

### B.3 06 §6.5 NotFoundScreen·EmptyState 합성 정의

| 신규 컴포넌트 | 06 §6.5 표 행 | 본 Phase 합성 정의 |
|--------------|-------------|------------------|
| `NotFoundScreen` | "TDS `ErrorPage statusCode={404}`" | `<ErrorPage statusCode={404} title="레시피를 찾을 수 없어요" subtitle="삭제되었거나 다른 사용자의 레시피일 수 있어요." onPressLeftButton={onBack} />`. **단일 컴포넌트** — Phase 4의 PATCH 404 / DELETE 404에서도 동일 컴포넌트 재사용 |
| `EmptyState` | "`View` + `Txt` + `Button`(생성하러 가기)" | `View` flex center + `Txt typography="t3"`(title) + `Txt typography="st9" color="#4E5968"`(description) + `Button display="primary" onPress={onAction}>{actionLabel}</Button>`. props로 다른 빈 상태에도 재사용(Phase 4 즐겨찾기 0건 등) |

---

## C. 라우트 구조 결정

### C.1 결정 — 목록 라우트 `/my-recipes` 채택 (07 §7.3.3 SSOT)

- **결정**: `pages/my-recipes/index.tsx` 위치, `createRoute('/my-recipes', ...)`.
- **근거**: 07 §7.3.3(라인 131~141) + §7.4 #3 행(라인 197)이 SSOT로 `/my-recipes` 경로를 명시. requirements §산출물의 "`src/pages/recipes/index.tsx`" 표기는 SSOT 위반 — 07이 우선(ADR-009 D4: 본 미니앱 문서 기준).
- **파일 디렉터리 결정**: `pages/my-recipes/index.tsx`(서브디렉터리 + index) vs `pages/my-recipes.tsx`(단일 파일) 둘 다 Granite 파일 라우팅에서 동일하게 `/my-recipes` 등록 가능. **단일 파일 `pages/my-recipes.tsx` 채택** — Phase 2 패턴(`pages/recipe/generate.tsx` 서브디렉터리 + 단일 파일) 일관성. 향후 `/my-recipes/[hash]` 등 자식 라우트 추가 시점에 서브디렉터리로 승격.

### C.2 결정 — 상세 라우트 `/recipe/[id]` 채택 (07 §7.3.4 SSOT)

- **결정**: `pages/recipe/[id].tsx` 위치, `createRoute('/recipe/[id]', { validateParams: (p) => ({ id: String((p as { id?: unknown }).id ?? '') }), component })`.
- **근거**: 07 §7.3.4(라인 143~167) + §7.4 #4 행(라인 198). Granite 파일 라우팅 검증: `node_modules/@granite-js/react-native/dist/router/utils/path.d.ts`의 `excludeDynamicNamePattern`/`getRoutePath` JSDoc — `"[id]"` 형식이 동적 세그먼트로 등록되며 `getRoutePath('./list/[id].js') // "/list/:id"` 변환. createRoute의 `path` 인자는 `keyof RegisterScreenInput`(router.gen.ts가 자동 등록)이므로 파일명을 `[id]` 그대로 두면 자동 인식.
- **validateParams 패턴 (Phase 2의 `generate.tsx:39-50` 동일 패턴)**:
  ```ts
  validateParams: (params: unknown): { id: string } => {
    const obj = (params ?? {}) as Record<string, unknown>;
    return { id: typeof obj.id === 'string' ? obj.id : '' };
  }
  ```
- **id 유효성 검증**: 빈 문자열(`''`) 또는 비-uuid 형식이면 `useRecipeDetail` 호출이 곧바로 백엔드 404로 수렴(ADR-005 + 03 §3.4.2 라인 350~352 — Postgres 22P02 케이스). zod로 uuid 강제 검증을 본 Phase에서는 추가하지 않음 — 404 통일 정책으로 충분, 화면 분기 단순화.

### C.3 라우트 등록 매트릭스 (Phase 3 종료 시점)

| 경로 | 파일 | 보호 | 작성/확장 | 매트릭스 |
|------|------|------|----------|---------|
| `/` | `src/pages/index.tsx` | 공개 | 확장 (마이 진입 활성화) | Phase 2 산출 위에 액세서리 1개 추가 |
| `/recipe/generate` | `src/pages/recipe/generate.tsx` | 공개 | 확장 (저장 버튼 추가) | Phase 2 산출 위에 저장 UI + useSaveRecipe 결합 |
| `/my-recipes` | `src/pages/my-recipes.tsx` | 식별자 가드 | **신규** | 본 Phase |
| `/recipe/[id]` | `src/pages/recipe/[id].tsx` | 식별자 가드 | **신규** | 본 Phase |

### C.4 보호 화면 가드 패턴 (07 §7.5.2~7.5.3)

본 Phase의 신규 2개 화면 모두 보호 — `useTossUserId()` 훅으로 식별자 보장:

```ts
function MyRecipesPage() {
  const { tossUserId, refresh } = useTossUserId();
  if (tossUserId === undefined) {
    return <Loading />;  // Provider가 마운트 직후 1회 SDK 호출 중
  }
  const { data, meta, isLoading, error } = useMyRecipes({ page }, { tossUserId, refreshTossUserId: refresh });
  // ...
}
```

- **`useTossUserId.tossUserId === undefined`** 상태(SDK 호출 진행 중)는 Spinner/Skeleton. 실패는 ErrorPage(503) — 07 §7.5.3 표 그대로.
- **401 자동 재시도**는 api-client(apiFetch) 단일 위치에서 처리(ADR-010 D3) — 훅은 `refreshTossUserId: refresh`만 전달.

### C.5 네비게이션 흐름 매트릭스

| 진입점 → 도착 | 호출 |
|-------------|------|
| 홈(`/`) → 마이 목록 | `navigation.navigate('/my-recipes', {})` |
| 홈(`/`) → 생성 | `navigation.navigate('/recipe/generate', { dishName, servings })` (Phase 2 그대로) |
| 마이 목록(`/my-recipes`) → 상세 | `navigation.navigate('/recipe/[id]', { id: recipe.id })` |
| 마이 목록(`/my-recipes`) → 생성 (EmptyState 액션) | `navigation.navigate('/recipe/generate', {})` |
| 생성(`/recipe/generate`) 저장 성공 → 상세 | `navigation.navigate('/recipe/[id]', { id: saved.id })` (§A.4) |
| 상세(`/recipe/[id]`) → 마이 (Phase 4 삭제 후) | Phase 4 결정 (`goBack()` 또는 `navigate('/my-recipes', {})`) |
| 모든 보호 화면 → 뒤로 | `navigation.goBack()` (PageNavbar.AccessoryButtons 또는 하드웨어 백) |

### C.6 하드웨어 백 가드 — Phase 3 결정 보류

Phase 2 인계 #5 (`useBackEvent` + AbortController 연계, qa report §13.3) — Phase 3 진입 시 결정 항목이었으나 **본 Phase에서도 보류**. 근거:
- Phase 3 보호 화면(`/my-recipes`, `/recipe/[id]`)은 SSE 같은 long-running 비동기 없음(단발 fetch + abort는 unmount cleanup으로 충분).
- 생성 화면(Phase 2 산출)의 SSE 취소는 `useRecipeGenerate` 내부 unmount cleanup이 처리 — Phase 2 qa PASS.
- Phase 4 PATCH/DELETE 도입 시 낙관적 업데이트 롤백과 함께 재검토.

---

## D. 캐시 무효화 — Context provider + bump trigger 결정

### D.1 결정 — `RecipeCacheProvider` + `useRecipeCacheTrigger()` 채택

- **결정**: 단일 Context에 `{ trigger: number, invalidate: () => void }` 노출. `_app.tsx`에서 `<TossUserIdProvider>` 안쪽에 마운트.
- **근거 (대안 3중 채택)**:
  | 대안 | 채택? | 사유 |
  |------|------|------|
  | (a) Context + bump key | ✅ **채택** | SWR/RQ 의존성 0(번들 영향 0). 단순(int counter 증가). useEffect dep 1개로 refetch 강제. 한 트리거 → 모든 구독 훅이 동기 refetch. |
  | (b) Events emitter | ❌ | RN 표준 EventEmitter 의존 또는 자체 구현 — 메모리 누수 위험(구독 해제 누락). 디버깅 어려움. |
  | (c) refetch on focus | ❌ | Granite/React Navigation의 `useFocusEffect`로 가능하나 화면 진입/탭 전환에 매번 호출 → 트래픽 증가. 저장 직후 상세 진입 시 마이 목록은 백그라운드라 focus 안 됨 → 다음 진입까지 stale. AC3.2 직진 정합성 약화. |
- **번들 영향 0**: SWR/RQ 미도입 정합 (Phase 1·2 의존성 표 그대로).

### D.2 구현 패턴 (api-client 책임)

```ts
// src/hooks/useRecipeCache.tsx (신규)
const RecipeCacheContext = createContext<{ trigger: number; invalidate: () => void } | null>(null);

export function RecipeCacheProvider({ children }) {
  const [trigger, setTrigger] = useState(0);
  const invalidate = useCallback(() => setTrigger(n => n + 1), []);
  const value = useMemo(() => ({ trigger, invalidate }), [trigger]);
  return <RecipeCacheContext.Provider value={value}>{children}</RecipeCacheContext.Provider>;
}

export function useRecipeCacheTrigger() {
  const ctx = useContext(RecipeCacheContext);
  if (ctx === null) throw new Error('useRecipeCacheTrigger must be used within <RecipeCacheProvider>');
  return ctx;
}
```

```ts
// useMyRecipes — trigger를 dep으로 refetch
export function useMyRecipes(query, auth) {
  const { trigger } = useRecipeCacheTrigger();
  const [state, setState] = useState({ data: [], meta: null, isLoading: true, error: null });

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const res = await listRecipes(query, auth);  // 03 §3.3
        if (!cancelled) setState({ data: res.data, meta: res.meta, isLoading: false, error: null });
      } catch (err) {
        if (!cancelled && !ac.signal.aborted) setState(s => ({ ...s, isLoading: false, error: err }));
      }
    })();
    return () => { cancelled = true; ac.abort(); };
  }, [query.page, query.pageSize, query.favorite, auth.tossUserId, trigger]);  // ← trigger 포함

  return state;
}
```

### D.3 invalidate 트리거 위치

| 동작 | invalidate 호출자 |
|------|------------------|
| 저장 성공 (`useSaveRecipe.save`) | ✅ Phase 3 |
| 즐겨찾기 토글 성공 (`useToggleFavorite`) | Phase 4 |
| 삭제 성공 (`useDeleteRecipe`) | Phase 4 |
| 상세 화면 refetch | useRecipeDetail의 `refetch()` (외부 노출) — `notFound` 후 백 동작에서 사용. invalidate와 무관 |

### D.4 `_app.tsx` Provider 구조 (확장)

```tsx
// src/_app.tsx (Phase 1·2 그대로 + RecipeCacheProvider 추가)
<TossUserIdProvider>
  <RecipeCacheProvider>
    <AppContainer>
      {/* Granite Router */}
    </AppContainer>
  </RecipeCacheProvider>
</TossUserIdProvider>
```

- 마운트 위치: TossUserIdProvider 안쪽(식별자가 있어야 캐시도 의미). 외부 의존 0.
- Phase 1·2 동결 코드(useTossUserId·apiFetch·useRecipeGenerate)에 영향 0건.

### D.5 useRecipeDetail의 캐시 정책

- **`useRecipeDetail(id)`는 trigger를 dep에 포함하지 않는다** — 상세는 id 단건이라 마이 목록 invalidate와 의미 다름. id 변경 또는 명시적 `refetch()` 호출로만 재조회.
- 단, **Phase 4 PATCH favorite 성공 후**에는 (1) `useRecipeDetail.refetch()` 직접 호출 (즉시 반영) + (2) `invalidate()` 호출 (마이 목록도 갱신) — Phase 4에서 결정. Phase 3는 단일 trigger 패턴만 동결.

---

## E. 산출 파일 책임 분담

### E.api — `miniapp-api-client` 담당

| 파일 | 작성 종류 | SSOT 인용 |
|------|---------|----------|
| `src/hooks/useRecipeCache.tsx` (신규) | 신규 | §D.1~D.2 |
| `src/hooks/useMyRecipes.ts` (신규) | 신규 | §A.1, 03 §3.3, ADR-006, ADR-010 D5 |
| `src/hooks/useRecipeDetail.ts` (신규) | 신규 | §A.1, 03 §3.4, ADR-004, ADR-005 |
| `src/hooks/useSaveRecipe.ts` (신규) | 신규 | §A.1, §A.4, §D.3, 03 §3.5 |
| `src/_app.tsx` | 확장 (1줄 — RecipeCacheProvider wrap) | §D.4 |
| `src/hooks/index.ts` (있다면) 또는 barrel | barrel 추가 | — |

### E.fe — `miniapp-frontend` 담당

| 파일 | 작성 종류 | SSOT 인용 |
|------|---------|----------|
| `src/components/RecipeCard.tsx` (신규) | 신규 | §A.2, 06 §6.4.4, §B.2 |
| `src/components/EmptyState.tsx` (신규) | 신규 | §A.2, 06 §6.5 추가 컴포넌트, §B.3 |
| `src/components/NotFoundScreen.tsx` (신규) | 신규 | §A.2, 06 §6.5, ADR-005, §B.3 |
| `src/pages/my-recipes.tsx` (신규) | 신규 | §A.3, §C.1, §C.4, 07 §7.3.3 |
| `src/pages/recipe/[id].tsx` (신규) | 신규 | §A.3, §C.2, §C.4, 07 §7.3.4 |
| `src/pages/recipe/generate.tsx` | **확장** (저장 버튼 + useSaveRecipe 결합) | §A.3, §A.4 |
| `src/pages/index.tsx` | **확장** (마이 진입 활성화 1개) | §A.3 |

### E.qa — `miniapp-qa` 담당

| 산출 | SSOT 인용 |
|------|----------|
| 응답 zod 정합 (listRecipes raw `{data, meta}` 보존, getRecipe `.data` unwrap, saveRecipe 201) | 03 §3.3.3 / §3.4.3 / §3.5.3 + §A.1 |
| 404 통일 검증 (`NotFoundScreen` 단일 컴포넌트, 화면 분기 0건) | ADR-005 + §B.3 + §A.2 |
| 페이지네이션 meta 신뢰 검증 (`pageSize=100` clamp = `meta.pageSize=50`) | 03 §3.10 #10 + ADR-006 |
| 캐시 무효화 정합 (저장 성공 → 마이 목록 trigger 증가 → refetch 단언) | §D.2~D.3 |
| 격리 단언 누적 (§D.2 Phase 3 신규) | 본 §D.2 |
| 라우트 등록 매트릭스 (4 라우트 router.gen.ts) | §C.3 |
| 통합 스윕 (Phase 1·2 누적 + Phase 3 추가) | 03 §3.10 + 06 §6.7 + 07 §7.9 |
| AC3.1~AC3.6 통과 매트릭스 | requirements §AC + 10-SPRINT-PLAN §10.4 |

### E.작업 순서 (의존성 그래프)

```
[A] src/hooks/useRecipeCache.tsx          (api-client, 단독)
    │
[B] src/hooks/{useMyRecipes,useRecipeDetail,useSaveRecipe}.ts  (api-client, [A] 필요)
[C] src/_app.tsx 확장                      (api-client, [A] 필요)
    │
[D] src/components/{RecipeCard,EmptyState,NotFoundScreen}.tsx  (frontend, 단독 — 병렬 가능)
    │
[E] src/pages/my-recipes.tsx               (frontend, [B][D] 필요)
[F] src/pages/recipe/[id].tsx              (frontend, [B][D] 필요)
[G] src/pages/recipe/generate.tsx 확장     (frontend, [B] 필요)
[H] src/pages/index.tsx 확장               (frontend, 단독)
```

[A]~[C]는 api-client 순차. [D]는 frontend가 [A]~[C]와 병렬 가능. [E]~[H]는 [B]·[D] 도착 후.

---

## F. ADR 영향 검토

### F.1 Phase 1·2 동결 유지 (ADR-010·011)

- ADR-010 D1~D7 모두 그대로 유지. zod = deps / 메모리 캐싱 / 401 1회 재시도 / SDK 단일 격리 / raw 응답 검증 / tsconfig ESNext / SDK 한시 통과 정책 영향 0건.
- ADR-011 D8~D13 모두 그대로 유지. SSE 어댑터 / AsyncGenerator / error 청크 throw / text 청크 미표시 / PageNavbar / AbortSignal cast — Phase 3 신규 코드는 SSE를 추가하지 않으므로 D8~D11 직접 의존 0건. D12 PageNavbar는 신규 2화면(`my-recipes`, `recipe/[id]`)에서 그대로 사용. D13 cast 2곳은 그대로(추가 cast 발생 시 §G 트리거).

### F.2 신규 ADR 필요성 — T5 결정 보류 (가칭 ADR-012)

본 Phase 3의 결정 중 **새 결정 항목**은 4개. 단일 ADR로 묶을지 또는 ADR-010·011 보강할지는 T5(Phase 3 마무리) 시점에서 결정. **본 baseline에서는 결정 후보만 카탈로그**:

| Phase 3 결정 | 본 baseline 위치 | ADR 후보 항목 |
|--------------|----------------|--------------|
| 라우트 `/my-recipes` + `/recipe/[id]` 채택 (단일 파일 vs 서브디렉터리 결정 포함) | §C.1, §C.2 | D14(가칭) — Granite 파일 라우팅 규약 + 동적 세그먼트 패턴 확정 |
| 캐시 무효화 = Context + bump trigger (SWR/RQ 미도입 정합) | §D.1 | D15(가칭) — 클라이언트 캐시 전략 + invalidate 패턴 |
| 404 단일 컴포넌트 `NotFoundScreen` (ADR-005 미니앱 구현) | §B.3, §A.2 | D16(가칭) — 404 UI 통일 — ADR-005를 미니앱 화면 분기 정책으로 구체화 |
| 저장 후 `/recipe/[id]` 직진 라우팅 | §A.4 | D17(가칭) — 저장 흐름 UX 결정 |

**처리 방식 권장**: T5 시점에서 4개를 단일 ADR-012 ("미니앱 Phase 3 라우팅·캐시·404 규약")으로 묶고, ADR-010·011 §결과 표의 "후속 결정으로 변경 가능" 행에 본 ADR-012 참조 양방향 추가. ADR-005에도 미니앱 구현 후속 참조 추가.

### F.3 06 §6.5 갱신 트리거 (T5 architect 작업)

- 06 §6.5 신규 컴포넌트 표 "EmptyState"/"NotFoundScreen" 행에 실 구현 시그니처(props·import 경로) 추가.
- Phase 4에서 PATCH/DELETE 404가 `NotFoundScreen` 재사용함을 명시 (단일 컴포넌트 정책 강화).

### F.4 AGENTS.md 갱신 트리거 (T5 architect 작업)

- `src/hooks/AGENTS.md` 보강 — Phase 3 신규 4 훅(useRecipeCache·useMyRecipes·useRecipeDetail·useSaveRecipe) 책임·인터페이스 추가. 본 디렉터리의 비범위 절(Phase 2 이후 화면별 사용자 흐름 훅 추가) 명시 그대로 충족.
- `src/components/AGENTS.md` 보강 — RecipeCard·EmptyState·NotFoundScreen 추가.
- `src/pages/AGENTS.md` 보강 — `/my-recipes` + `/recipe/[id]` 라우트 추가, 보호 화면 가드 패턴 명시.

---

## G. 작업 중 멈춤 트리거 (Phase 1·2 §G 패턴 계승)

다음을 발견하면 api-client/frontend는 진행을 멈추고 architect(나)에게 SendMessage. 추측 진행 금지.

1. **백엔드 응답 shape이 03 §3.3.3 / §3.4.3 / §3.5.3과 다름** — `data`/`meta` 키 부재, snake_case 누출(`is_favorite`, `created_at`, `cook_time_minutes`), `userId` 응답 키 노출(03 §3.10 #4).
   - 처리: zod safeParse 실패 시 즉시 `ApiClientError('INTERNAL_ERROR', '서버 응답 형식이 올바르지 않아요.')` throw — api-client 측이 이미 처리(ADR-010 D5). architect가 별 저장소 AIReceipe 후속 ADR 갱신 요청 작성.
2. **`meta.pageSize` ≠ 요청 `pageSize`** (clamp 미적용 또는 다른 값) — 03 §3.10 #10 + ADR-006 위반.
   - 처리: 미니앱은 `meta.pageSize` 신뢰 정책 유지. architect 통지 → 별 저장소 hotfix 요청.
3. **`@apps-in-toss/web-framework` SDK 패키지 모듈 미해결** — Phase 3 첫 보호 endpoint 호출(useMyRecipes 또는 useRecipeDetail의 첫 마운트)이 useTossUserId의 SDK 실호출 트리거.
   - 처리: `granite dev` 첫 실행 시 모듈 미해결 확정되면 즉시 architect SendMessage → ADR-010 §롤백 R1 발동 + baseline §B.2 갱신. **추측 변경 금지** — 다른 패키지 경로(`@apps-in-toss/framework` 등)로 임의 변경 금지.
4. **CORS preflight 실패** — `Access-Control-Allow-Headers`에 `X-Toss-User-Id` 누락, OPTIONS 미응답 등.
   - 처리: 본 Phase는 보호 endpoint 3종(GET 목록 + GET 단건 + POST 저장)이 헤더 부착으로 호출되므로 첫 호출 시 발생 가능. 별 저장소 AIReceipe ADR 갱신 요청.
5. **AbortSignal cast 새로운 발생 위치** — ADR-011 D13 격리 정책(sse-client.ts:76 + api-client.ts:100 정확 2곳) 외 위치에서 동일 cast 필요.
   - 처리: 추가 cast 시도 금지. architect 통지 → D13 격리 범위 검토 또는 ADR-011 보강.
6. **Granite 동적 세그먼트 syntax 차이** — `[id]` 파일명이 `/recipe/[id]` 라우트로 등록되지 않거나 `Route.useParams()`가 `{ id: string }` 반환 안 됨.
   - 처리: `node_modules/@granite-js/react-native/dist/router/utils/path.d.ts`의 `getRoutePath('./list/[id].js') // "/list/:id"` JSDoc + Phase 2의 `pages/recipe/generate.tsx` 검증 PASS 정합. 다르면 architect 통지 → 07 §7.3.4 표기 갱신.
7. **백엔드 옵션 P 미배포로 모든 보호 호출 401** — Phase 1·2 인계 #4 그대로.
   - 처리: 코드 경로 검증은 PASS 가능(zod·헤더·cache·라우팅). 실호출 검증은 별 저장소 옵션 P 배포 후로 이연. qa report에 PENDING 명시.
8. **TDS `ErrorPage` props 시그니처가 §B.1과 다름** — 패키지 minor 업데이트 등.
   - 처리: §B.1 표 갱신 + 06 §6.5 갱신 트리거.

---

## H. Phase 1·2 영향 — 격리 유지 + Phase 3 추가 단언

### H.1 Phase 1·2 동결 코드 영향 (수정 0건)

| 파일 | Phase 3 영향 |
|------|-------------|
| `src/types/{api,recipe,user,env.d,index}.ts` | **수정 0건**. Phase 1에서 `ApiListResponse`/`SaveRecipeRequest`/`SaveRecipeResponse`/`GetRecipeResponse`/`DeleteRecipeResponse`/`ToggleFavoriteRequest`/`RecipeListQuery`/`Recipe` 모두 정의 완료. 본 Phase는 사용만 |
| `src/lib/zod/{api,recipe,stream,index}.ts` | **수정 0건**. `apiResponseSchema`/`apiListResponseSchema`/`recipeSchema` 모두 정의 완료 |
| `src/services/{api-client,recipes,sse-client,index}.ts` | **수정 0건**. `listRecipes`/`getRecipe`/`saveRecipe` 모두 Phase 1에서 정의·zod 검증 완료. 본 Phase는 호출만 |
| `src/hooks/useTossUserId.tsx` | **수정 0건**. `{ tossUserId, refresh }` 인터페이스 그대로 사용 |
| `src/hooks/useRecipeGenerate.ts` | **수정 0건**. Phase 2 SSE 어댑터 정책 유지 |
| `src/components/{SearchForm,RecipeDisplay,NutritionPanel,recipe-format}.{tsx,ts}` | **수정 0건**. RecipeDisplay는 `GeneratedRecipe | Recipe` 공통 필드만 사용(불변식 2) — 상세 화면(`Recipe`)에서도 그대로 재사용 |
| `src/_app.tsx` | **확장만** — RecipeCacheProvider 래핑 1행 추가 (§D.4) |
| `src/pages/index.tsx` | **확장만** — 마이 진입 액세서리 1개 추가 |
| `src/pages/recipe/generate.tsx` | **확장만** — 저장 버튼 + useSaveRecipe 결합 |
| `tsconfig.json` | **수정 0건**. ADR-010 D6 동결 유지 |
| `package.json` | **신규 의존성 0건**. zod·@toss/tds-react-native·@granite-js/react-native·@apps-in-toss/framework·react-native 모두 Phase 1·2에 추가됨 |

### H.2 Phase 3 추가 격리 단언 (qa 검증 기준)

baseline §D(Phase 1)·§D.2(Phase 2)의 누적 단언에 더해 본 Phase 3의 추가 단언:

11. **`recipe.id` 사용 OK 위치 한정**: 저장된 `Recipe`(`useMyRecipes` data, `useRecipeDetail` data, `useSaveRecipe` 반환값) 한정. `GeneratedRecipe` 표시(RecipeDisplay 호출)에서는 여전히 `id` 접근 0건(불변식 2 — Phase 2 격리 #9 누적). `RecipeCard`는 `Recipe` props 받으므로 `recipe.id` 사용 정당.
12. **단일 fetch 점 유지**: `src/`에서 직접 `fetch(` 호출은 `api-client.ts`(JSON 단일 응답) + `sse-client.ts`(SSE) 정확히 2곳. Phase 3 신규 4 훅 모두 `recipes.ts` 함수만 호출.
13. **`NotFoundScreen` 단일 컴포넌트 정책**: `src/pages/`에서 "레시피를 찾을 수 없어요" 또는 404 statusCode를 직접 렌더하는 위치 0건. 모두 `<NotFoundScreen />` 1개 컴포넌트로 통일. Phase 4 PATCH/DELETE 404 시점에도 동일 컴포넌트 재사용 보장(컴포넌트 SRP).
14. **응답 unwrap 정책**: `useMyRecipes`는 `RecipeListResponse`(raw `{ data, meta }`) 그대로 노출 (ADR-010 D5 listRecipes 예외). 나머지 훅(useRecipeDetail·useSaveRecipe)은 `recipes.ts` 함수가 unwrap한 `Recipe`/`{ id }` 그대로 노출.
15. **캐시 trigger 일관성**: `useSaveRecipe.save` 성공 시 `invalidate()` 호출 정확히 1회. 실패 시 invalidate 0건(stale 마이 목록 유지가 안전).
16. **식별자 가드 일관성**: `/my-recipes`·`/recipe/[id]` 두 화면 모두 `useTossUserId().tossUserId === undefined` 분기 처리 — 미정의 시 Loading/Spinner 렌더, 정의 시 데이터 훅 호출.
17. **AbortController unmount 처리**: `useMyRecipes`·`useRecipeDetail`·`useSaveRecipe` 모두 useEffect cleanup에서 AbortController.abort + cancelled 플래그 둘 다 적용 (Phase 2 useRecipeGenerate 패턴 누적).
18. **`pageSize` clamp 신뢰**: `useMyRecipes`가 `meta.pageSize`를 그대로 노출 — 화면이 `query.pageSize`로 페이지 계산 금지(03 §3.10 #10).

### H.3 ADR-011 D13 cast 격리 유지 단언

- Phase 3 신규 4 훅 + 3 컴포넌트 + 2 페이지에서 `as RequestInit['signal']` 또는 `as AbortSignal` cast **0건 발생 예상** — 새 코드는 모두 `recipes.ts` 함수 호출만, 직접 fetch에 signal 전달 없음.
- 발생 시 §G #5 트리거.

---

## I. 수용 기준 매핑 (requirements §AC3 / 10 §10.4)

| AC | 충족 산출 | qa 검증 방법 |
|----|----------|------------|
| **AC3.1** Phase 2 레시피 저장 → 201 + `Recipe`(id) | §A.1 useSaveRecipe + §A.3 generate.tsx 확장 + §A.4 직진 라우팅 + 03 §3.5.3 zod | 코드 경로: saveRecipe 호출 → `recipeSchema` zod 통과 → `wrapped.data.id` 반환 → navigation.navigate. 실호출: 백엔드 옵션 P 배포 후 |
| **AC3.2** 마이 진입 시 방금 저장 레시피가 첫 페이지 첫 항목 | §A.1 useMyRecipes + §D 캐시 invalidate | 코드 경로: save 성공 → invalidate() → trigger++ → useMyRecipes useEffect 재호출 → listRecipes refetch → data[0] = 최신 (백엔드 `created_at desc` 정렬, 03 §3.3.3) |
| **AC3.3** 카드 탭 → 상세 → 새로고침(라우트 재진입) 정상 | §A.1 useRecipeDetail + §A.3 `[id].tsx` + 03 §3.4 + ADR-004 | 코드 경로: navigation.navigate('/recipe/[id]', { id }) → Route.useParams() → useRecipeDetail(id) → getRecipe → recipeSchema 통과 → RecipeDisplay 렌더. 새로고침 = 라우트 재진입 → 동일 경로 1회 더 |
| **AC3.4** `pageSize=100` 요청 → `meta.pageSize=50` 신뢰 | §A.1 useMyRecipes(raw `{data, meta}` 보존) + ADR-006 + §H.2 #18 | 코드 경로: query.pageSize=100 전달 → 백엔드 clamp → meta.pageSize=50 응답 → 미니앱이 화면에서 meta.pageSize 표시·페이지 계산 |
| **AC3.5** 두 식별자 → 서로 안 보임 (소유자 격리) | §C.4 식별자 가드 + 03 §3.3 보호 헤더 + ADR-005 격리 | 코드 경로: tossUserId가 매 요청 헤더 포함. 실호출: 두 토큰으로 curl 시뮬레이션 시 서로 다른 data — 백엔드 옵션 P 배포 후 |
| **AC3.6** `?favorite=true` 필터 동작 | §A.1 useMyRecipes(query.favorite) + 03 §3.10 #11(`"true"`/`"false"` 문자열 강제) | Phase 4 즐겨찾기 토글 후 실증. Phase 3는 코드 경로 — favorite을 boolean으로 받아 query에 그대로 전달, recipes.ts/api-client buildUrl이 String(true) → "true" 자동 변환 |

> **AC3.5/3.6는 백엔드 옵션 P 배포 + Phase 4 즐겨찾기 토글 진입 후 실증** — Phase 1·2와 동일 PENDING 패턴. 코드 경로는 Phase 3에서 PASS 가능.

---

## J. 본 baseline 동결 후 추후 architect 작업 (T5 인계)

1. **ADR-012(가칭) 작성** — §F.2의 4개 결정 묶음(라우팅·캐시·404·저장 흐름). ADR-010·011·005에 양방향 참조 추가.
2. **06 §6.5 갱신** — EmptyState·NotFoundScreen 실 구현 시그니처(props·import) 반영 (§F.3).
3. **AGENTS.md 갱신 3종** — `src/hooks/`·`src/components/`·`src/pages/` 모두 (§F.4).
4. **`src/_app.tsx` Provider 순서 검증** — qa report PASS 후 ADR-010 결과 표에 RecipeCacheProvider 추가 명시.
5. **CLAUDE.md "현재 단계" 절 갱신** — Phase 2 완료 → Phase 3 완료 + Phase 4 진입 인계.
6. **Phase 2 인계 항목 9건 회수 표** — session log §6.x에서 Phase 3에서 해소된 것 / 보류한 것 정리:
   - Phase 2 인계 #1 (SDK 경로) — 본 Phase 첫 보호 endpoint 호출로 검증 트리거 (§G #3)
   - Phase 2 인계 #2 (AbortSignal cast) — 본 Phase 신규 cast 0건 검증 시 ADR-011 D13 해소 조건 (a)/(b)/(c) 재평가
   - Phase 2 인계 #5 (`useBackEvent`) — 본 Phase에서도 보류 (§C.6) — Phase 4 PATCH/DELETE 시 재검토
   - Phase 2 인계 #6 (청크 간 30s) — Phase 3 비범위 (SSE는 generate 화면만)
   - Phase 2 인계 #7 (디자인 토큰) — 별 ADR, 본 Phase 비범위
   - Phase 2 인계 #9 (SSE fragility) — 본 Phase에서 진행 없음

---

## K. 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-24 | 초기 작성 (Phase 3 시작 베이스라인) | api-client/frontend/qa가 Phase 3 산출(저장·목록·상세)의 SSOT 인용 경로를 1:1 코드 매핑으로 고정. 8 결정 동결 — 목록 라우트 `/my-recipes`(07 §7.3.3 SSOT 채택), 상세 라우트 `/recipe/[id]`(07 §7.3.4 + Granite 동적 세그먼트 검증), 캐시 무효화 Context+bump trigger(SWR/RQ 미도입 정합), 저장 후 `/recipe/[id]` 직진, 404 단일 컴포넌트 NotFoundScreen(ADR-005 통일·Phase 4 재사용), EmptyState 정의, 페이지네이션 단순(무한 스크롤 별 ADR), Phase 2 인계 #1 검증 절차. ADR-012(가칭) 4 결정 카탈로그 — T5 시점 작성 |
