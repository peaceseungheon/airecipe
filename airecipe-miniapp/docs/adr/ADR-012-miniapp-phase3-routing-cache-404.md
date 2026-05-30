# 0012. 미니앱 Phase 3 — 저장·목록·상세 규약 (라우팅 ·/my-recipes·/recipe/[id]·캐시 무효화 Context+bump·404 단일 컴포넌트·저장 후 상세 직진)

> 전방 참조(2026-05-30): 본문 D14·D16 등이 명시한 라우트 **구현 위치 `src/pages/...`**는 [ADR-018](./ADR-018-route-pages-consolidation.md)로 라우팅 루트 `pages/`로 통합되며 대체됨. 라우트 경로·`createRoute`·404 단일 컴포넌트 등 그 외 규약은 불변. 아래 시점 기록은 보존한다.

- 상태: 채택됨
- 날짜: 2026-05-24
- 적용 대상: 본 저장소(`airecipe-miniapp`) 클라이언트 한정 결정
- 영향 코드: `src/hooks/{useRecipeCache,useMyRecipes,useRecipeDetail,useSaveRecipe}.{tsx,ts}`, `src/components/{RecipeCard,EmptyState,NotFoundScreen}.tsx`, `src/pages/{my-recipes,recipe/[id]}.tsx`, `src/pages/{index,recipe/generate}.tsx`(확장), `src/_app.tsx`(확장)
- 참조 baseline: `_workspace/01_architect_phase3_baseline.md` (§A·§B·§C·§D·§F·§H)
- 참조 산출: `_workspace/02_api_client_summary.md`, `_workspace/02_frontend_summary.md`, `_workspace/03_qa_report.md`

---

## 맥락

[ADR-010](./ADR-010-miniapp-phase1-conventions.md)으로 Phase 1 공통 인프라(공유 타입·zod·`apiFetch`·`useTossUserId`)가, [ADR-011](./ADR-011-miniapp-phase2-streaming-ui.md)로 Phase 2 스트리밍·UI 규약(SSE 어댑터·PageNavbar 등)이 동결됐다. Phase 3는 그 위에 **저장·목록·상세**(기능 c/d)를 구현한다. baseline §A·§C·§D가 라우팅 경로·캐시 무효화·404 단일화·저장 흐름의 4 결정 + §F.2가 신규 ADR 후보를 동결했고, qa의 격리 단언(§H.2 #11~18, §H.3 cast 격리)이 모두 PASS로 종합되어 본 ADR로 4 결정을 묶어 동결한다.

본 ADR 작성 시점 결정해야 했던 사항:

1. **목록·상세 라우트 경로** — requirements는 `/recipes`를 표기했으나 07 §7.3.3 SSOT는 `/my-recipes`. SSOT 우선 원칙(ADR-009 D4)을 따를지, requirements 표기를 채택할지.
2. **상세 라우트 동적 세그먼트 패턴** — Granite 파일 라우팅에서 `pages/recipe/[id].tsx` 표기가 유효한지, `createRoute('/recipe/[id]', { validateParams })` 패턴이 동작하는지.
3. **클라이언트 캐시 무효화 메커니즘** — SWR/React Query 미도입 가정 하에서 저장 성공 후 마이 목록 refetch를 어떻게 강제할지. Context+bump trigger vs Events emitter vs focus refetch 중 어느 것을 채택할지.
4. **저장 성공 후 라우팅** — 저장된 레시피의 상세(`/recipe/[id]`)로 직진할지, 마이 목록(`/my-recipes`)으로 이동할지, 또는 generate 화면에 머물지.
5. **404 UI 단일 컴포넌트화** — ADR-005가 "없음·잘못된 id·타인 소유 모두 404 수렴" 정책을 채택했고, 06 §6.5가 `NotFoundScreen` 신규 컴포넌트를 명시했다. 본 Phase 3에서 단일 컴포넌트로 통일할지(Phase 4 PATCH/DELETE 재사용 대비), 화면별 인라인 분기로 둘지.
6. **페이지네이션 vs 무한 스크롤** — Phase 3 MVP에서 어떤 페이징 UX를 채택할지.

본 결정의 **수명은 Phase 3 종료(본 ADR 채택 시점)부터 Phase 4 진입 시점까지**다. Phase 4가 도입하는 즐겨찾기(PATCH)·삭제(DELETE) 화면에서 일부 결정(특히 D16 404 단일 컴포넌트, D15 캐시 invalidate)이 확장된다. Phase 5(출시) 직전 무한 스크롤·디자인 토큰 결정이 추가될 수 있다.

---

## 결정

### D14. 목록 라우트 `/my-recipes` + 상세 라우트 `/recipe/[id]` 채택. 파일은 `pages/my-recipes.tsx` + `pages/recipe/[id].tsx`

- **목록**: `createRoute('/my-recipes', { component: MyRecipesPage })`. 파일 위치 `src/pages/my-recipes.tsx` (단일 파일, 서브디렉터리 미사용).
- **상세**: `createRoute('/recipe/[id]', { validateParams, component: RecipeDetailPage })`. 파일 위치 `src/pages/recipe/[id].tsx`.
- **validateParams 패턴**: Phase 2 `pages/recipe/generate.tsx:39-50` 답습 — 인라인 타입 가드 함수로 `{ id: string }` 반환. zod uuid 강제는 본 Phase 비범위(404 통일 정책으로 충분).
- 라우트 등록 최종 매트릭스 (Phase 3 종료): `/`, `/recipe/generate`, `/my-recipes`, `/recipe/[id]` 4개. `src/router.gen.ts` 자동 생성 — 수동 수정 금지.

### D15. 클라이언트 캐시 무효화는 **Context + bump trigger** 패턴

- `src/hooks/useRecipeCache.tsx` 신규 — `RecipeCacheProvider`(단조 증가 trigger state) + `useRecipeCacheTrigger()`(`{ trigger, invalidate }`).
- `useMyRecipes`가 `trigger`를 useEffect dep에 포함 → `invalidate()` 호출 시 자동 refetch.
- `useRecipeDetail`은 trigger를 dep에 포함하지 않음 — 상세는 id 단건 (마이 목록 invalidate와 의미 다름. baseline §D.5).
- `useSaveRecipe.save`는 성공 시 `invalidate()` 정확 1회 호출. 실패 시 0건 (stale 마이 목록 유지가 안전).
- Provider 마운트 위치: `_app.tsx`에서 `TossUserIdProvider` **안쪽**에 `RecipeCacheProvider` 래핑 — 식별자가 있어야 캐시도 의미.

### D16. 404 UI는 **단일 컴포넌트** `NotFoundScreen` (TDS `ErrorPage` 합성)

- `src/components/NotFoundScreen.tsx` (35줄) — `<ErrorPage statusCode={404} title="레시피를 찾을 수 없어요" subtitle="삭제되었거나 다른 사용자의 레시피일 수 있어요." onPressLeftButton={onBack} />` 합성.
- props: `{ onBack: () => void }`. 일반적으로 `navigation.goBack()` 또는 fallback navigate.
- **단일 사용 위치 정책**: `src/pages/`에서 `<ErrorPage statusCode={404}>` 직접 렌더 + 인라인 "찾을 수 없어요" 텍스트 0건. 항상 `<NotFoundScreen onBack={...} />` 1개 컴포넌트만 사용.
- **Phase 4 재사용 보장**: PATCH /api/recipes/[id]/favorite 또는 DELETE /api/recipes/[id]의 404 응답 시점에서도 동일 컴포넌트 재사용. 컴포넌트 SRP 유지.
- 404 정규화는 `useRecipeDetail` 책임 — `ApiClientError.error.code === 'NOT_FOUND'` → `notFound: true` state. 화면이 `notFound` 분기에서 `<NotFoundScreen />` 렌더.

### D17. 저장 성공 후 라우팅은 **상세 직진** `/recipe/[id]`

- `useSaveRecipe.save(recipe)` 성공 → `Recipe`(id 포함) 반환 → 화면이 `navigation.navigate('/recipe/[id]', { id: saved.id })`.
- 마이 목록(`/my-recipes`) 우회 안 함 (사용자 흐름상 자연 — "저장한 레시피를 즉시 본다").
- 캐시 invalidate는 `useSaveRecipe` 내부에서 자동 (D15) — 마이 목록 진입 시 첫 페이지에 방금 저장한 레시피가 보장됨 (AC3.2 + 백엔드 `created_at desc` 정렬).
- 보조 결정: 상세 화면에서 `handleBack`은 `navigation.canGoBack?.()` 확인 후 (a) `goBack()` 또는 (b) `navigate('/my-recipes', {})` 폴백. **딥링크 진입(`intoss://<appName>/recipe/<id>`) 시 스택 비어 있어도 마이로 자연 진입** — ADR-004 딥링크 정합.

### D18. 페이지네이션은 **단순 페이지네이션** (page state + 이전/다음 버튼). 무한 스크롤은 Phase 5 별 ADR

- `useMyRecipes({ page, pageSize: 20 })` — 화면 측 `page` useState. 이전/다음 Button 클릭 시 `setPage(prev ± 1)`.
- 마지막 페이지 판정: `lastPage = Math.ceil(meta.total / meta.pageSize)` — **`meta.pageSize` 신뢰 (ADR-006 clamp 적용값)**. `query.pageSize`로 계산 0건(§H.2 #18).
- 빈 응답(`data: []` + `meta.total: 0`)은 200 정상 분기 → `<EmptyState title="아직 저장된 레시피가 없어요" actionLabel="첫 레시피 만들기" onAction={→ /recipe/generate} />` 렌더.
- 무한 스크롤(`FlatList onEndReached`)은 Phase 5 출시 직전 별 ADR — 단순성 우선 + 백엔드 meta 신뢰(ADR-006) + AC3.4(`pageSize=100` clamp 신뢰) 검증 단순화.

---

## 근거

### D14 라우트 경로 — 07 SSOT 우선

- 07 §7.3.3(라인 131~141) + §7.4 #3 행(라인 197)이 SSOT로 `/my-recipes` 경로를 명시. requirements §산출물의 "`src/pages/recipes/index.tsx`" 표기는 SSOT 위반.
- **ADR-009 D4 정합**: "본 포팅 작업의 산출물은 문서". 문서(07-ROUTING)가 SSOT — requirements가 일시적 입력일 뿐.
- **상세 라우트 `/recipe/[id]` Granite 동적 세그먼트 검증**: `node_modules/@granite-js/react-native/dist/router/utils/path.d.ts` JSDoc 확인 — `getRoutePath('./list/[id].js') // "/list/:id"`로 `[id]` 파일명이 `:id` 라우트 파라미터로 자동 변환. `createRoute('/recipe/[id]', ...)` path 인자가 `keyof RegisterScreenInput` 타입이며 router.gen.ts가 4 라우트 자동 등록(Phase 3 완료 시점에서 PASS 확인).
- **파일 디렉터리 결정 — 단일 파일 채택**: `pages/my-recipes.tsx` vs `pages/my-recipes/index.tsx` 둘 다 동일하게 `/my-recipes` 라우트 등록 가능. 단일 파일이 Phase 2 패턴(`pages/recipe/generate.tsx` 서브디렉터리 + 단일 파일) 일관성. 자식 라우트(`/my-recipes/...`) 도입 시점에 서브디렉터리 승격.

### D15 Context + bump trigger — SWR/RQ 미도입 정합

baseline §D.1의 3 대안 비교 표를 그대로 인용:

| 대안 | 채택? | 사유 |
|------|------|------|
| (a) Context + bump key | ✅ **채택** | SWR/RQ 의존성 0(번들 영향 0). 단순(int counter 증가). useEffect dep 1개로 refetch 강제. 한 트리거 → 모든 구독 훅이 동기 refetch. |
| (b) Events emitter | ❌ | RN 표준 EventEmitter 의존 또는 자체 구현 — 메모리 누수 위험(구독 해제 누락). 디버깅 어려움. |
| (c) refetch on focus | ❌ | Granite/React Navigation의 `useFocusEffect`로 가능하나 화면 진입/탭 전환에 매번 호출 → 트래픽 증가. 저장 직후 상세 진입 시 마이 목록은 백그라운드라 focus 안 됨 → 다음 진입까지 stale. AC3.2 직진 정합성 약화. |

- **번들 영향 0**: SWR/RQ 미도입. Phase 1·2 의존성 표 그대로(`zod` + RN + Granite + TDS + AppsInToss).
- **사용자 격리 정합**: Provider가 TossUserIdProvider 안쪽이라 식별자가 있어야 캐시도 의미. invalidate state는 사용자 단일 세션 한정 — 사용자 전환 시점은 본 미니앱 컨텍스트에 없음(앱 재시작 = 새 콜드 스타트).
- **트레이드오프**: 키별(id별) 부분 무효화 불가 — 단일 trigger가 모든 useMyRecipes 구독을 refetch. Phase 3 MVP는 단일 마이 목록 한 곳뿐이라 영향 0. 키별 필요 시 별 ADR.

### D16 404 단일 컴포넌트 — ADR-005 정책의 UI 구체화

- **ADR-005 정합**: "없음·잘못된 id·타인 소유 모두 404로 수렴". 미니앱 UI도 동일 컴포넌트로 통일하면 사용자에게 정보 누설 0 (IDOR 정보 누설 방지 — ADR-005 §근거).
- **SRP**: 404 분기를 컴포넌트 1개에 격리하면 Phase 4 PATCH 404 / DELETE 404 시점에서도 화면별 인라인 분기 없이 동일 컴포넌트만 재사용. 컴포넌트 수정이 곧 정책 변경.
- **TDS `ErrorPage` 합성**: 06 §6.5 신규 컴포넌트 표가 권장. `node_modules/@toss/tds-react-native/dist/esm/components/error-page/ErrorPage.d.ts` 인용 — `statusCode?/title?/subtitle?/onPressLeftButton?/onPressRightButton?/children?` props 확인. 본 미니앱은 좌측 버튼만(뒤로) 활용.
- **`useRecipeDetail.notFound` 정규화**: 화면 측이 `try/catch + error.code` 분기를 작성하지 않게 — 훅이 catch 첫 분기에서 NOT_FOUND를 `notFound: true` state로 변환. error는 null(이중 표시 방지).

### D17 저장 후 상세 직진

- **사용자 흐름 정합**: AC3.2("마이 진입 시 방금 저장한 레시피가 첫 페이지") + AC3.3("카드 탭 → 상세 → 새로고침 정상")의 자연 흐름은 "저장 → 즉시 상세 확인 → 백 → 마이". 마이 우회 시 추가 탭이 필요.
- **현재 웹 패턴 정합**: 07 §7.3.2 표(라인 103) — 현재 웹도 `router.push('/recipe/[id]')` 패턴. RN/Granite로 1:1 이식.
- **캐시 정합**: `useSaveRecipe.save` 내부에서 `invalidate()` 자동 호출 (D15) — 마이 목록 진입 시 백엔드 `created_at desc` 정렬(03 §3.3.3)로 첫 페이지 첫 항목 보장.
- **스택 보존 vs reset**: `CommonActions.reset` 미사용 — generate 스택 유지가 사용자 백 동작에 자연(상세 → 백 → generate → 백 → 홈). 본 Phase 비범위.

### D18 단순 페이지네이션 우선

- **단순성**: 화면 측 `page` useState + `meta.total/pageSize`로 lastPage 계산. 코드 단순 + qa 검증 단순.
- **백엔드 meta 신뢰 (ADR-006 정합)**: `pageSize=100` 요청 → 백엔드 clamp 50 → `meta.pageSize=50` 응답 → 미니앱이 표시·페이지 계산. AC3.4 단언 그대로 충족.
- **무한 스크롤 지연**: `FlatList onEndReached` + 무한 누적은 page 상태 복잡도 + 메모리 + 위치 복원 등 추가 결정 사항 다수. Phase 5(출시 직전) 별 ADR로 결정 — Phase 3는 MVP 우선.

---

## 대안

### A. 라우트 경로 `/recipes`(requirements 표기) (D14 대안)

- 장점: requirements 표기 일치.
- 단점: 07 §7.3.3 SSOT 위반. ADR-009 D4(문서가 SSOT) 위반. 본 미니앱 문서 체계의 일관성 깨짐. 기각.

### B. SWR 또는 React Query 도입 (D15 대안)

- 장점: 키별 캐시·자동 invalidate·focus refetch 등 기능 풍부.
- 단점: 번들 ~20KB(gzip ~7KB) 추가 + 학습 비용 + Provider 구조 변경 + Phase 3 MVP 범위 외 기능 다수. YAGNI. 기각.

### C. Events emitter (D15 대안 2)

- 장점: 키별 토픽 가능.
- 단점: RN 표준 EventEmitter 의존 또는 자체 구현 — 메모리 누수 위험(구독 해제 누락). 디버깅 어려움. 기각.

### D. focus refetch (D15 대안 3)

- 장점: useEffect 1줄로 화면 진입 시 자동 refetch.
- 단점: 트래픽 증가(매 화면 진입). AC3.2 직진 정합성 약화(상세 진입 시 마이는 백그라운드라 focus 안 됨). 기각.

### E. 저장 후 마이 목록(`/my-recipes`)으로 이동 (D17 대안)

- 장점: AC3.2 직접 확인.
- 단점: 사용자가 방금 저장한 레시피 상세 확인을 위해 추가 탭 필요. UX 흐름 부자연. 기각.

### F. 저장 후 generate 화면에 머묾 (D17 대안 2)

- 장점: 다른 레시피 즉시 생성 가능.
- 단점: 저장 결과 확인 모호. AC3.3 흐름 깨짐. 기각.

### G. 화면별 인라인 404 텍스트 분기 (D16 대안)

- 장점: 화면별 메시지 커스터마이즈.
- 단점: Phase 4 PATCH/DELETE 404 시 코드 중복 + 정책 변경 시 여러 화면 수정. SRP 위반. 기각.

### H. 무한 스크롤 즉시 도입 (D18 대안)

- 장점: 모바일 UX 자연.
- 단점: page 상태 복잡도 + 메모리 + 위치 복원 + AC3.4 검증 복잡화. Phase 3 MVP 범위 외. 기각 (Phase 5에서 재검토).

---

## 결과

### 영향 받는 자산 (본 ADR로 동결)

**신규 4 훅** (api-client):
- `src/hooks/useRecipeCache.tsx` — Context + bump trigger
- `src/hooks/useMyRecipes.ts` — listRecipes raw `{data, meta}` 보존 + trigger dep
- `src/hooks/useRecipeDetail.ts` — getRecipe + 404 정규화
- `src/hooks/useSaveRecipe.ts` — saveRecipe + invalidate 1회

**신규 3 컴포넌트** (frontend):
- `src/components/RecipeCard.tsx` — Pressable + Txt + Badge. `recipe.id` 사용 OK(저장된 Recipe 한정)
- `src/components/EmptyState.tsx` — props 4종 재사용 가능
- `src/components/NotFoundScreen.tsx` — `ErrorPage statusCode={404}` 합성, 단일 컴포넌트 정책

**신규 2 라우트** (frontend):
- `src/pages/my-recipes.tsx` — `createRoute('/my-recipes')` + 식별자 가드 + EmptyState/에러/RecipeCard 4-way 분기 + 단순 페이지네이션
- `src/pages/recipe/[id].tsx` — `createRoute('/recipe/[id]', { validateParams })` + 식별자 가드 + 로딩/404/에러/정상 4-way 분기 + handleBack(canGoBack? + fallback)

**확장 3종**:
- `src/pages/recipe/generate.tsx` — useSaveRecipe 결합 + 저장 버튼 + 상세 직진
- `src/pages/index.tsx` — PageNavbar.AccessoryButtons로 마이 진입 활성화
- `src/_app.tsx` — RecipeCacheProvider 래핑 (TossUserIdProvider 안쪽)

### 미니앱 인터페이스 (Phase 4 이후 의존)

- `useRecipeCacheTrigger(): { trigger, invalidate }` — Phase 4 즐겨찾기/삭제 mutation 훅이 동일 invalidate 호출
- `useMyRecipes(query): { data, meta, isLoading, error, refetch }` — Phase 4 즐겨찾기 필터 토글 도입 시 query.favorite 전달
- `useRecipeDetail(id): { data, isLoading, notFound, error, refetch }` — Phase 4 PATCH/DELETE 후 `refetch()`로 즉시 반영
- `useSaveRecipe(): { save, isSaving, error, reset }` — Phase 4 추가 mutation 훅(useToggleFavorite, useDeleteRecipe)이 동일 패턴 답습
- `<NotFoundScreen onBack={...} />` — Phase 4 PATCH/DELETE 404 응답 시점에서 동일 컴포넌트 재사용
- `<EmptyState ... />` — Phase 4 즐겨찾기 0건 등 다양 빈 상태에서 재사용
- 라우트 4개 (`/`, `/recipe/generate`, `/my-recipes`, `/recipe/[id]`) — Phase 4 추가 라우트 없음 예상

### 후속 결정으로 변경 가능 (다음 Phase 트리거)

| 결정 | 변경 트리거 | 변경 방향 |
|------|-----------|----------|
| D14 라우트 경로 | Phase 4·5에서 자식 라우트(`/my-recipes/...`) 도입 | 서브디렉터리 승격(`pages/my-recipes/index.tsx`). 기존 경로 유지. |
| D15 Context + bump | Phase 4 키별 부분 무효화 필요(예: 단일 레시피 PATCH 후 마이 목록 + 해당 카드만 갱신) | 키별 토픽 또는 SWR/RQ 도입 별 ADR |
| D16 404 단일 컴포넌트 | Phase 4 PATCH/DELETE 404 — **변경 없이** 동일 컴포넌트 재사용 보장 | 변경 트리거 없음 (보존이 목적) |
| D17 상세 직진 | Phase 4 즐겨찾기/삭제 후 마이로 이동 (AC1.6 삭제 후 마이) | 화면별 다른 라우팅 정책 결정 |
| D18 단순 페이지네이션 | Phase 5 출시 직전 모바일 UX 검증 결과 | 무한 스크롤 별 ADR |

### Phase 2 인계 9건 회수 표

| Phase 2 인계 # | Phase 3 상태 | 후속 |
|--------------|------------|------|
| #1 SDK 패키지 경로 (`@apps-in-toss/web-framework` 미해결) | **검증 미달** — 본 Phase 보호 endpoint 첫 호출(useMyRecipes/useRecipeDetail 마운트)이 트리거이나 qa 검증은 코드 경로 PASS에 머묾(dev server 미가동). Phase 4 dev server 진입 시점 또는 옵션 P 배포 후 검증 | ADR-010 D7 한시 통과 유지 |
| #2 AbortSignal cast 2곳 | **0건 추가 발생** — Phase 3 신규 코드는 fetch 직접 호출 0건이라 cast 발생 0. ADR-011 D13 해소 조건 (a)/(b)/(c) 그대로 보류 | ADR-011 D13 유지 |
| #3 RN Response.body / TextDecoder | 본 Phase 비범위 (SSE 0건) | — |
| #4 백엔드 옵션 P 미배포 | 본 Phase 보호 호출 PENDING(코드 경로 PASS) — 옵션 P 배포 후 실호출 검증 | 별 저장소 AIReceipe ADR |
| #5 useBackEvent 하드웨어 백 | 본 Phase **보류** — Phase 3 보호 화면은 single-shot fetch + unmount cleanup 충분 (baseline §C.6). Phase 4 PATCH/DELETE 낙관적 업데이트 도입 시 재검토 | Phase 4 진입 결정 |
| #6 청크 간 30s 타임아웃 | 본 Phase 비범위 (SSE는 generate만) | Phase 4 또는 별 ADR |
| #7 디자인 토큰 hex 직접 사용 | **누적 — Phase 3 신규 컴포넌트도 hex 사용** (RecipeCard `#191F28`/`#4E5968`/`#E5E8EB`/`#F2F4F6` 등, my-recipes/[id].tsx 동일). 별 ADR 권장 — Phase 4 진입 전 결정 | 별 ADR |
| #8 about 페이지 정리 | Phase 2에서 해소 완료 | — |
| #9 SSE fragility 개선 | 본 Phase 진행 없음 (SSE 비범위) | Phase 4 또는 별 ADR |

### 미니앱이 알 필요가 없는 것 (재차 단언, Phase 3 baseline §H.2 누적)

본 ADR D14~D18 어느 결정도 다음을 알지 못한다 — 미니앱 코드·타입·테스트에 등장 금지:

- 옵션 P 매핑(`profiles` 테이블·`internal_user_id`·service role·RLS) — 05 §5.10
- `userId` 응답 키 — 03 §3.10 #4
- AI Provider 선택(Gemini/Claude) — 04-AI-PROVIDER
- 백엔드 인증 미들웨어 구현 — 05 §5.2
- `pageSize` clamp 50 상수 — 미니앱은 `meta.pageSize` 신뢰 (D18 + ADR-006)

---

## 검증

본 ADR이 채택된 시점에서 다음이 확인되어 있다 (`_workspace/03_qa_report.md` 인용):

- **AC3.1~AC3.6** 코드 경로 6/6 PASS (실호출 6건 PENDING — 백엔드 옵션 P 배포 후 또는 dev server / AC3.3(c) 딥링크는 토스 환경)
- **baseline §A** 산출 13/13 PASS
- **03 §3.10** Phase 3 적용 8/8 PASS
- **06 §6.7** 5/5 PASS
- **07 §7.9** 5/5 PASS
- **07 §7.5.4** 데이터 소비 5/5 PASS
- **baseline §B.1** TDS 신규 4종 PASS
- **baseline §H.2** Phase 3 격리 8/8 PASS (#11 recipe.id 위치, #12 fetch 단일점, #13 NotFoundScreen 단일, #14 unwrap 정책, #15 invalidate 트리거, #16 식별자 가드, #17 AbortController cleanup, #18 pageSize clamp 신뢰)
- **baseline §H.1** 동결 회귀 11/11 PASS — Phase 1·2 동결 코드 수정 0건
- **baseline §H.3** cast 격리 — `as RequestInit['signal']` 정확 2곳 + `as AbortSignal` 0 + `as unknown as.*Signal` 0 + `@ts-expect-error` 정확 1곳
- **통합 스윕** 16/16 PASS (Phase 1 5 + Phase 2 5 + §D.3 추가 2 + Phase 3 신규 4)
- **FAIL 누적 0건**
- **멈춤 트리거 §G 8항목** 0건 발생

---

## 롤백

- **R1. 백엔드가 응답 shape을 변경** (`meta.pageSize` 부재, snake_case 누출 등): Phase 1 ADR-010 D1·D5의 zod 안전망 즉시 차단. 별 저장소 AIReceipe ADR로 백엔드 hotfix 요청. 본 ADR D14~D18 정책 자체는 유효 — 응답 형식 갱신만 필요.
- **R2. Granite 동적 세그먼트 syntax 변경** (예: `[id]` → `:id` 표기 변경): D14의 파일명·createRoute path 변경. router.gen.ts 자동 갱신. 본 ADR의 결정 자체는 유효(라우트 의미 보존).
- **R3. SWR/React Query 도입 결정 (별 ADR)** — D15의 Context+bump trigger를 superseded. 호출 측 훅 인터페이스(`useMyRecipes`/`useRecipeDetail`/`useSaveRecipe`)는 유지하되 내부 구현 교체. 본 ADR D15 폐기.
- **R4. 무한 스크롤 도입 (Phase 5 별 ADR)** — D18의 단순 페이지네이션 polciy supersede. my-recipes.tsx의 페이지네이션 UI만 교체. useMyRecipes 외부 인터페이스 유지(query.page 의미 변경: 현재 페이지 → 누적 페이지 끝).
- **R5. ADR-005 정책 변경** (예: 403 분리 도입) — D16의 404 단일 컴포넌트는 NotFoundScreen + 새로 ForbiddenScreen 추가. 별 저장소 AIReceipe + 본 저장소 양측 ADR. 본 ADR D16은 부분 superseded.

---

## 참고 ADR

- [ADR-001 (Supabase + Repository + Mapper + RLS)](./ADR-001-supabase.md) — 백엔드 격리. 본 ADR D15의 응답 unwrap 정책이 ADR-001 Mapper 회귀의 안전망(zod) 위에서 동작.
- [ADR-004 (단건 조회 추가)](./ADR-004-get-recipe-by-id.md) — 본 ADR D14 상세 라우트(`/recipe/[id]`)와 D17 저장 후 직진 정책의 SSOT. 딥링크 정합. (ADR-004 파일 부재 — 별 저장소 AIReceipe에서 미니앱 ADR 디렉터리로 동기화 필요. 본 ADR은 docs/appsintoss-port/03 §3.4 + 07 §7.3.4 인용으로 대체.)
- [ADR-005 (소유권 위반 404 수렴)](./ADR-005-ownership-violation-404.md) — 본 ADR D16 NotFoundScreen 단일 컴포넌트 정책의 SSOT. 양방향 참조 추가 필요(ADR-005 §결과 표에 본 ADR-012의 UI 구체화 항목).
- [ADR-006 (pageSize clamp 50)](./ADR-006-pagesize-clamp.md) — 본 ADR D18 페이지네이션 정책의 SSOT(미니앱이 `meta.pageSize` 신뢰). (ADR-006 파일 부재 — ADR-004와 동일 동기화 필요. 본 ADR은 03 §3.3.2 + §3.10 #10 인용으로 대체.)
- [ADR-009 (앱인토스 미니앱 포팅)](./ADR-009-appsintoss-port-architecture.md) D4 — 문서 SSOT 정책. 본 ADR D14의 `/my-recipes` 채택(07 §7.3.3 SSOT 우선)의 근거.
- [ADR-010 (미니앱 Phase 1 공유 인프라)](./ADR-010-miniapp-phase1-conventions.md) — 본 ADR이 Phase 1 동결(D1~D7) + Phase 2 동결(ADR-011 D8~D13)을 그대로 유지하며 Phase 3 산출을 그 위에 누적. D3(401 1회 재시도) → 본 ADR 4 훅에서 동일 패턴(refresh 주입). D5(raw 응답 정책) → 본 ADR D15에서 listRecipes 예외 그대로 유지. D7(SDK 한시 통과) → Phase 3에서도 검증 미달(인계 #1). **양방향 참조**: ADR-010 §결과 표의 "후속 결정으로 변경 가능" 행에 본 ADR-012 참조 추가 필요.
- [ADR-011 (미니앱 Phase 2 스트리밍·UI 규약)](./ADR-011-miniapp-phase2-streaming-ui.md) — D11(text 청크 미표시), D12(PageNavbar 채택), D13(AbortSignal cast 2곳) 모두 Phase 3에서 유지. **양방향 참조**: ADR-011 §결과 표의 "후속 결정으로 변경 가능" 행에 본 ADR-012 참조 추가 필요.

---

## 참고 SSOT

- `_workspace/01_architect_phase3_baseline.md` — Phase 3 baseline (§A 산출 매핑, §B TDS 실재성, §C 라우트 구조, §D 캐시 무효화, §F.2 결정 카탈로그, §H 격리 단언, §I AC 매핑).
- `_workspace/02_api_client_summary.md` — api-client 산출 요약 (D15 구현 인덱스 + 격리 grep 결과).
- `_workspace/02_frontend_summary.md` — frontend 산출 요약 (D14·D16·D17 구현 인덱스 + 화면 구성).
- `_workspace/03_qa_report.md` — Phase 3 QA 매트릭스 (본 ADR 검증 근거 — 76+ PASS / FAIL 0).
- `docs/appsintoss-port/03-API-CONTRACT.md` §3.3·§3.4·§3.5·§3.10 — 목록·단건·저장 응답 + 경계면 불변식.
- `docs/appsintoss-port/06-UI-MAPPING.md` §6.4.4·§6.5 — RecipeCard 매핑 + EmptyState/NotFoundScreen 신규 컴포넌트.
- `docs/appsintoss-port/07-ROUTING.md` §7.3.3·§7.3.4·§7.5·§7.6 — `/my-recipes`·`/recipe/[id]` 라우트 + 식별자 가드 + 딥링크.
- `node_modules/@granite-js/react-native/dist/router/utils/path.d.ts` — Granite 동적 세그먼트 `[id]` → `:id` 자동 변환 검증.
- `node_modules/@toss/tds-react-native/dist/esm/components/error-page/ErrorPage.d.ts` — TDS ErrorPage props 시그니처.
