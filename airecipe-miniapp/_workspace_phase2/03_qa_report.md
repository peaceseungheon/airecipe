# Phase 2 QA Report — SSE 스트리밍·TDS·라우팅 경계면 검증

> 작성: miniapp-qa · 2026-05-24 · 팀 `airecipe-miniapp-phase2`
> 기준 baseline: `_workspace/01_architect_phase2_baseline.md`
> 입력 SSOT: `docs/appsintoss-port/03·06·07·08`, `docs/adr/ADR-009`·`ADR-010`, `_workspace/00_input/requirements.md`
> 누적 패턴: `_workspace_phase1/03_qa_report.md` 단언 매트릭스(코드 경로 + 실호출 분리)
> 범위: Phase 2 산출물(api-client 5 + frontend 7) 경계면 검증 + 통합 스윕 + AC2.* 매트릭스

본 리포트는 모듈 완성 통지마다 누적 업데이트한다. 각 단언은 PASS / FAIL / PENDING / N/A(Phase 3 이연) 로 표시하고, 결과의 근거는 파일:라인 인용.

---

## 0. 요약 — 현재

| 영역 | PASS | FAIL | PENDING | N/A |
|------|:----:|:----:|:-------:|:---:|
| baseline §A 산출 12 파일 도착 | 12 | 0 | 0 | - |
| 03 §3.2.4 청크 5종 zod 1:1 정합 | 5 | 0 | 0 | - |
| 03 §3.10 Phase 2 핵심 단언(#2/#5/#8/#9 외 본 Phase 적용) | 7 | 0 | 0 | 8 |
| 06 §6.7 검증 8항 (Phase 2 적용) | 6 | 0 | 0 | 2 |
| 07 §7.9 검증 8항 (Phase 2 적용) | 5 | 0 | 1 | 2 |
| 08 §8.9 검증 8항 | 7 | 0 | 1 | 0 |
| baseline §B.1 TDS 실재성 cross-check (Phase 2 사용 8종) | 8 | 0 | 0 | - |
| baseline §D.2 격리 단언 10건 | 10 | 0 | 0 | - |
| baseline §D.3 AbortSignal cast 격리 4건 (architect 판정 후 갱신) | 4 | 0 | 0 | - |
| 통합 스윕 (Phase 1 5 + Phase 2 5 + §D.3 추가 2) | 12 | 0 | 0 | - |
| AC2.1~AC2.6 (코드 경로) | 6 | 0 | 0 | - |
| AC2.1/2.2/2.4/2.6 실호출 검증 | 0 | 0 | 4 | - |

**전체 판정: ALL PASS (코드 경로). architect §D.3 #1 판정 회신(2026-05-24) — 옵션 (a) 채택 확정 → §D.3 범위 "정확 2곳(sse-client.ts:76 + api-client.ts:100)" 갱신 → §8B 4/4 PASS + §9.3 2/2 PASS. §12 FAIL #1 → PASS 이관. FAIL 카운터 0건 유지.**

- 실호출 4건(AC2.1/2.2/2.4/2.6): 백엔드 옵션 P 배포 후 또는 dev server 실행 시 검증 — Phase 1 패턴과 동일.

---

## 1. baseline §A 산출 파일 도착 매트릭스

| 파일 | 1차 작성자 | 도착 여부 | 단언 매핑 |
|------|----------|---------|----------|
| `src/lib/zod/stream.ts` (신규) | api-client | **PASS** | §A.3, §C.3 청크 zod 5종 discriminated union + recipe(generatedRecipeSchema 재사용:31) + error(apiErrorCodeSchema 재사용:37) (`src/lib/zod/stream.ts:46-52`) |
| `src/lib/zod/index.ts` (1줄 추가) | api-client | **PASS** | `export * from './stream'` (`src/lib/zod/index.ts:3`) |
| `src/services/sse-client.ts` (신규) | api-client | **PASS** | §A.1·C.1·C.2·C.4·C.5 — `streamRecipe` AsyncGenerator(:54), parseSseEvents(:147), extractChunk(:174) + zod safeParse(:192) + error 청크 throw(:117) + done 청크 return(:120) + finally reader.releaseLock(:135) + !res.body 폴백 throw(:91-97) + tossUserId 미주입 시 헤더 생략(:62-64) |
| `src/services/recipes.ts` (확장) | api-client | **PASS** | §A.2 — `generateRecipeStream(req, options)` Facade(`:90-98`) `streamRecipe` 위임 + `GenerateOptions.signal?` 추가(`:43`) + 기존 `generateRecipe`에 signal 옵션 전달(`:65`). 6 도메인 함수 그대로 유지(타 함수 변경 없음) |
| `src/services/index.ts` (1줄 추가) | api-client | **PASS** | `generateRecipeStream` re-export(`:5`) + `streamRecipe`·`StreamRecipeOptions` re-export(`:13-14`) — 호출 측 모두 단일 진입점 `services`에서 import 가능 |
| `src/hooks/useRecipeGenerate.ts` (신규) | api-client | **PASS** | §A.4·§C.5 — 외부 IF 7개 정확(`:34-43` status/progressText/recipe/error/generate/cancel/reset), AbortController (1)cancel(`:56`)+(2)unmount cleanup(`:70-74`), text→`onText` 내부 누적(`:133`), recipe→`onRecipe` setRecipe(`:134-137`), !res.body 폴백 1회(`:153-169`), 첫 청크 15s+전체 90s 타임아웃(`:45-46`, `:113-120`), 한국어 메시지 매핑 7종(`:216-225`) |
| `src/components/recipe-format.ts` (신규) | frontend | **PASS** | 06 §6.4.8 — `difficultyLabel`/`difficultyTone`/`formatCookTime`/`formatServings` 순수 함수 4종. TDS 의존 없음, RN/웹 공유 가능 (`src/components/recipe-format.ts:1-48`) |
| `src/components/SearchForm.tsx` (신규) | frontend | **PASS** | 06 §6.4.1 + §B.1·B.3·B.4 — `TextField variant="line"`(`:81-82`) + `NumericSpinner size="medium" minNumber/maxNumber/disable`(`:99-107`) + `Button type="primary" style="fill" display="block" size="large"`(`:110-120`), zod min(1)+trim(`:20-24`), 콜백 시그니처 `(dishName, servings)` 정확(`:28`) |
| `src/components/RecipeDisplay.tsx` (신규) | frontend | **PASS** | 06 §6.4.2 — `GeneratedRecipe` props(`:30`), `recipe.id` 미참조(grep 0건), actions slot(`:32`), TDS `Badge`+`List`+`ListRow`+`Txt` 모두 import + 정확 사용. DifficultyBadge·NeutralBadge 합성 (06 §6.3.4 의미 매핑) |
| `src/components/NutritionPanel.tsx` (신규) | frontend | **PASS** | 06 §6.4.3 — 칼로리 강조 `Txt typography="t1"`(`:30-31`) + 4 매크로 grid(`:38-43`) + healthNote 조건부(`:45-51`). TDS Txt만 사용 |
| `src/pages/index.tsx` (재작성) | frontend | **PASS** | 07 §7.3.1 + §B.2 — `createRoute('/', { component: HomePage })`(`:20-22`), PageNavbar import(`:16`), useTossUserId 미사용(공개 endpoint 정합), Phase1DevTrigger/isDev 완전 제거(grep 0건), `navigation.navigate('/recipe/generate', ...)`(`:29`) |
| `src/pages/recipe/generate.tsx` (신규) | frontend | **PASS** | 07 §7.3.2 + 08 §8.3~8.5 — `createRoute('/recipe/generate', ...)`(`:38-52`), `Route.useParams()` 동기(`:55`), useRecipeGenerate 결합(`:57`), 자동 1회 generate(`:60-72` useRef 가드), `progressText` 미참조(grep 0건), `recipe.id` 미참조(grep 0건), 인디케이터+에러+결과 UI 분기 |
| `src/pages/about.tsx` | frontend | **N/A (잔여)** | 본 baseline §E.fe 정리 항목 — 도착 매트릭스에서는 잔여 OK. 별 검증 없음(존재 자체는 Phase 0 잔여) |
| `src/router.gen.ts` | granite 자동 | **PASS** | granite 자동 갱신 — `/recipe/generate` 라우트 등록 확인 (typecheck PASS 의 간접 증거). lint warning은 자동 생성 무해 |

---

## 2. 03 §3.2.4 SSE 청크 5종 zod 1:1 정합 — `streamChunkSchema`

| # | event | data shape | zod 분기 (`streamChunkSchema`) | 상태 | 근거 |
|---|-------|-----------|------------------------------|:----:|------|
| 1 | `meta` | `{type:"meta", dishName:string}` | discriminated `'meta'` + `dishName: z.string()` | **PASS** | `src/lib/zod/stream.ts:19-22` `metaChunkSchema` 정확 일치 |
| 2 | `text` | `{type:"text", delta:string}` | discriminated `'text'` + `delta: z.string()` (빈 문자열 허용) | **PASS** | `src/lib/zod/stream.ts:24-27` `textChunkSchema` — `z.string()` min 미적용 → 빈 문자열 허용 (Claude tool 모드 빈 청크 호환, 08 §8.3.5) |
| 3 | `recipe` | `{type:"recipe", recipe:GeneratedRecipe}` | discriminated `'recipe'` + `recipe: generatedRecipeSchema` (재사용) | **PASS** | `src/lib/zod/stream.ts:29-32` `recipeChunkSchema` — `generatedRecipeSchema` import(`:17`) + Phase 1 `src/lib/zod/recipe.ts:32-42` 그대로 재사용 (4자 정합 단언 #9 정합) |
| 4 | `error` | `{type:"error", error:{code,message}}` | discriminated `'error'` + `error.code: apiErrorCodeSchema` (재사용 8종) | **PASS** | `src/lib/zod/stream.ts:34-40` `errorChunkSchema` — `apiErrorCodeSchema` import(`:16`) + Phase 1 `src/lib/zod/api.ts:10-19` 8종 enum 그대로 재사용 |
| 5 | `done` | `{type:"done"}` | discriminated `'done'` (필드 없음) | **PASS** | `src/lib/zod/stream.ts:42-44` `doneChunkSchema` — `type: z.literal('done')`만 (추가 필드 없음) |

**4자 정합 단언 (03 §3.10 #9)** — recipe 청크 zod `recipe` 필드가 Phase 1 PASS된 `generatedRecipeSchema`를 재사용하므로 03 §3.2.3과 1:1 정합 자동 보장. 실호출 백엔드 검증은 옵션 P 배포 후.

---

## 3. 03 §3.10 경계면 불변식 — Phase 2 적용 분 (15건 중)

| # | 단언 | 본 Phase 적용 | 상태 | 근거 |
|---|------|:------------:|:----:|------|
| 1 | `{ data, meta? }` 래핑 | N/A (SSE) — `recipe` 청크는 `{type, recipe}` SSE 청크 자체가 wrapper | **N/A** | baseline §C.3 (SSE는 별 경로) |
| 2 | 에러 `{ code, message }`, code 기반 분기 | ✅ | **PASS** | `src/services/sse-client.ts:117` `throw new ApiClientError(chunk.error.code, chunk.error.message)` — error.code 기반 단일 throw 경로 + `:200-210` HTTP non-200도 `apiErrorSchema` 통과 후 동일 ApiClientError throw (HTTP 상태 분기 없음) + `useRecipeGenerate:228-231` `toUserMessage`가 `err.error.code`로 분기 |
| 3 | camelCase only | ✅ | **PASS** | `rg "_[a-z]" src/lib/zod/stream.ts src/services/sse-client.ts src/hooks/useRecipeGenerate.ts src/components/ src/pages/` = 0건 (도메인 키 측면). recipe 청크의 키는 `generatedRecipeSchema`(Phase 1 PASS)에서 보장 |
| 4 | 응답 `userId` 키 없음 | ✅ | **PASS** | `rg "\\buserId\\b" src/` 결과: 운영 코드 0건. `src/types/api.ts:7`(주석)·`src/services/AGENTS.md:34`·`src/types/AGENTS.md:20` 모두 주석/문서 인용 |
| 5 | GeneratedRecipe ≠ Recipe (id 없음) | ✅ | **PASS** | `rg "recipe\\.id\\b\|recipe\\.createdAt\|recipe\\.isFavorite" src/components/ src/pages/` = 0건. `RecipeDisplay`는 `recipe: GeneratedRecipe` props(`:30`) — `Recipe`도 공통 필드만 통과. `generate.tsx`는 `recipe.nutrition`만 참조(`:179`). 컴파일도 PASS |
| 6 | 보호 헤더 부착, 공개 생략 | ✅ | **PASS** | `src/services/sse-client.ts:62-64` `if (options.tossUserId !== undefined) headers.set(...)` — 미주입 시 헤더 미부착 (03 §3.2.1, 05 §5.3 정합). 보호 5함수는 `recipes.ts`의 `AuthedCallOptions.tossUserId` 필수 prop으로 그대로 유지 |
| 7 | NOT_FOUND 단일 분기 | N/A | **N/A** | Phase 2 endpoint(generate)는 NOT_FOUND 미발생 |
| 8 | 스트리밍 에러 HTTP 200 + chunk | ✅ | **PASS** | `src/services/sse-client.ts:115-118` error 청크 → ApiClientError throw. HTTP 200 reader 루프 내부에서 분기, HTTP 상태 비교 없음. `:87-89` HTTP non-200은 별 경로(`toHttpError`)로 분리 — 둘이 섞이지 않음 |
| 9 | AI 4자 일치 (recipe 청크 ↔ 백엔드 schema) | ✅ | **PASS (코드)** | `src/lib/zod/stream.ts:31` `recipe: generatedRecipeSchema` — Phase 1에서 03 §3.2.3과 1:1 검증됨(Phase 1 QA #5 PASS). 실호출 검증은 백엔드 옵션 P 배포 후 |
| 10 | pageSize clamp 신뢰 | N/A | **N/A** | Phase 3 (목록) |
| 11 | favorite "true"/"false" 문자열 | N/A | **N/A** | Phase 3 |
| 12 | CORS Allow-Headers + OPTIONS | N/A (백엔드) | **N/A** | — |
| 13 | CORS Allow-Origin: * 미사용 | N/A (백엔드) | **N/A** | — |
| 14 | PATCH favorite 멱등 | N/A | **N/A** | Phase 3 |
| 15 | DELETE `{ data: { id } }` | N/A | **N/A** | Phase 3 |

본 Phase 적용 7건(#2, #3, #4, #5, #6, #8, #9) 모두 PASS.

---

## 4. 06 §6.7 검증 8항 — Phase 2 적용

| # | 단언 | 본 Phase 적용 | 상태 | 근거 |
|---|------|:------------:|:----:|------|
| 1 | 매핑 대상 13개 모두 표 존재 | N/A (06 챕터 검증) | **N/A** | baseline §F.3 architect T5에서 06 §6.4.6 갱신 |
| 2 | TDS 컴포넌트 실재 | ✅ | **PASS** | §7 8종 cross-check 모두 PASS — Button/TextField/NumericSpinner/Badge/Txt/List/ListRow/PageNavbar |
| 3 | Tailwind 클래스 매핑 표에 잔존 0건 | ✅ | **PASS** | `rg "className=" src/` = 0건 (RN StyleSheet.create 패턴만 사용) |
| 4 | `href`/`useRouter`/`<Link>` 잔존 0건 | ✅ | **PASS** | `rg "next/link\|useRouter\|<Link\|\\bhref=" src/` 결과 1건 = `src/pages/recipe/generate.tsx:14` 주석 인용("href/useRouter/Link 0건 — useNavigation/Route.useParams")만 — 실 코드는 `useNavigation`(`index.tsx:25`, `generate.tsx:56`) + `Route.useParams`(`generate.tsx:55`) |
| 5 | `useAuth` 잔존 0건 | ✅ | **PASS** | `rg "useAuth\\b" src/` = 0건 |
| 6 | presentation 컴포넌트가 API 직접 호출 책임 미보유 | ✅ | **PASS** | SearchForm/RecipeDisplay/NutritionPanel — fetch/api-client/sse-client/services import 0건 (도메인 호출은 페이지·훅만) |
| 7 | FavoriteButton 멱등 시그니처 | N/A | **N/A** | Phase 3 |
| 8 | RecipeDisplay `id` 미참조 | ✅ | **PASS** | §3 #5 동일 — grep + 컴파일 PASS |

본 Phase 적용 6건 모두 PASS.

---

## 5. 07 §7.9 검증 8항 — Phase 2 적용

| # | 단언 | 본 Phase 적용 | 상태 | 근거 |
|---|------|:------------:|:----:|------|
| 1 | 7개 화면 인벤토리 → 5+제외 2 | N/A (07 챕터 검증) | **N/A** | — |
| 2 | 모든 라우트가 `pages/<file>.tsx` 위치 일치 | ✅ | **PASS** | `pages/index.tsx`(`/`), `pages/recipe/generate.tsx`(`/recipe/generate`) 위치 정합. `createRoute` path 인자와 파일 경로 1:1 |
| 3 | `next/link`/`useRouter`/`href` 모두 `navigation.navigate`로 변환 | ✅ | **PASS** | §4 #4 동일 — `useNavigation`(`@granite-js/react-native`) 사용, 모든 이동 `navigation.navigate(path, params)` |
| 4 | proxy.ts 가드 단순화 + 보호 화면 적용 | N/A | **N/A** | Phase 3 (보호 화면 my-recipes·/recipe/[id]) |
| 5 | 404 통일(ADR-005) 반영 | N/A | **N/A** | Phase 3 (generate는 NOT_FOUND 미발생) |
| 6 | 딥링크 형식 정합 | ✅ | **PASS** | `intoss://airecipe-miniapp/recipe/generate` 형식 가능 — 09 §appName과 정합 (granite.config.ts appName 검증은 Phase 0 baseline 산물) |
| 7 | 하드웨어 백 + AbortController 연계 (08 7.7.2) | ✅ | **PENDING (Phase 2 결정 — 선택 산출)** | baseline §A.4: (1)명시 cancel(`useRecipeGenerate.ts:56`) + (2)unmount cleanup(`:70-74`) **PASS**. (3)하드웨어 백 `useBackEvent` 연계는 Phase 2 선택 산출(baseline §A.4 라인 58) — 본 화면 미구현. Phase 3 결정 권장 |
| 8 | layout.tsx 흡수(글로벌 NavBar 제거, 화면별 Navbar) | ✅ | **PASS** | `_app.tsx`는 TossUserIdProvider만(Phase 1 동결). 각 페이지에서 `PageNavbar` 직접 import 사용 — `pages/index.tsx:36-38` + `pages/recipe/generate.tsx:108-110`. 글로벌 NavBar 0건 |

본 Phase 적용 6건 중 5 PASS / 1 PENDING (하드웨어 백 선택 산출).

---

## 6. 08 §8.9 검증 8항 — SSE 핵심

| # | 단언 | 상태 | 근거 |
|---|------|:----:|------|
| 1 | 청크 5종(meta/text/recipe/error/done)이 03 §3.2.4 표와 정확 일치 | **PASS** | §2 5종 PASS — `src/lib/zod/stream.ts:46-52` discriminated union |
| 2 | error 청크 HTTP 200 내부 전달 명시 (HTTP 상태 분기 금지) | **PASS** | §3 #8 PASS — `src/services/sse-client.ts:115-118` reader 루프 내부 분기 |
| 3 | 최종 결과는 recipe 청크의 `.recipe` (text 누적 아님) | **PASS** | `useRecipeGenerate.ts:202-204` `case 'recipe'` 분기만 `setRecipe(chunk.recipe)` 호출. text 청크는 `onText`(`:133`)로 progressText 내부 누적만. `generate.tsx`도 `recipe` state만 결과 렌더(`:176-182`) |
| 4 | useRecipeGenerate 외부 IF 7개 동일 (status/progressText/recipe/error/generate/cancel/reset) | **PASS** | `src/hooks/useRecipeGenerate.ts:34-43` `UseRecipeGenerateResult` 7개 필드 + `:184` return 동일 |
| 5 | AbortController 3곳 사용 (cancel, unmount cleanup, 하드웨어 백) | **PENDING (Phase 2 결정 — (3) 선택)** | (1)명시 cancel `useRecipeGenerate.ts:56-59` + (2)unmount cleanup `:70-74` **PASS**. (3)하드웨어 백은 §5 #7 PENDING과 동일 — baseline §A.4 라인 58 선택 산출 |
| 6 | 비스트리밍 폴백 경로 정의 | **PASS** | `useRecipeGenerate.ts:153-169` !res.body 신호(`shouldFallback`) 분기 + `runFallback`(`:76-97`)이 `generateRecipe(req, { signal })` 호출 — 1회 자동 폴백. sse-client `:91-97` throw도 정확히 동일 메시지(`'스트림 응답 본문이 없습니다.'`)로 분류됨 |
| 7 | 미니앱 도메인 CORS 화이트리스트 정합 | **PASS (구조)** | sse-client는 `import.meta.env.API_BASE_URL`로 호출 (CORS는 백엔드 책임). 실제 preflight 검증은 백엔드 옵션 P 배포 + 첫 실호출 시점 |
| 8 | `!res.body` 미지원 환경 처리 흐름 정의 | **PASS** | `src/services/sse-client.ts:91-97` `ApiClientError('AI_PROVIDER_ERROR', '스트림 응답 본문이 없습니다.')` throw — 08 §8.6 정합. 호출 측 폴백은 `useRecipeGenerate.ts:153-169` PASS |

7 PASS / 1 PENDING (Phase 2 결정 선택 산출).

---

## 7. baseline §B.1 TDS 실재성 cross-check (Phase 2 사용 8종)

baseline §B.1에서 architect가 `node_modules/@toss/tds-react-native/dist/esm/`로 검증한 결과를 frontend 산출 코드와 cross-check.

| 컴포넌트 | baseline §B.1 결과 | Phase 2 사용처 | 상태 | 검증 항목 |
|---------|------------------|--------------|:----:|----------|
| `Button` | ✅ root export | SearchForm, generate.tsx | **PASS** | `type="primary"/"light"`, `style="fill"/"weak"`, `display="block"`, `size="large"/"medium"`, `loading`, `disabled`, `onPress` 모두 §B.1 표 시그니처 정확 사용 (`SearchForm.tsx:110-120`, `generate.tsx:132-141, :154-172`) |
| `TextField` | ✅ root export, `variant` **필수** | SearchForm | **PASS** | `variant="line"` 명시(`SearchForm.tsx:82`) + `value/onChangeText/placeholder/maxLength/editable/hasError/help/accessibilityLabel` — §B.3 의무화 정합 |
| `NumericSpinner` | ✅ root export, `disable`(주의) | SearchForm | **PASS** | `size="medium"`(필수) + `number/minNumber/maxNumber/disable/onNumberChange/accessibilityLabel` (`SearchForm.tsx:99-107`) — §B.4 `disable` 표기 정확 |
| `Badge` | ✅ root export (default) | RecipeDisplay | **PASS** | `size="tiny"` + `type="green"/"red"/"teal"/"elephant"` + `badgeStyle="fill"/"weak"` (`RecipeDisplay.tsx:142, :149, :155, :163`) |
| `Txt` | ✅ root export | 전 컴포넌트 | **PASS** | `typography="t1"/"t5"/"st9"/"st10"`, `color` hex string, `numberOfLines`, `style` 모두 정확 사용 |
| `List` | ✅ root export | RecipeDisplay | **PASS** | `rowSeparator="indented"` (`RecipeDisplay.tsx:56`) |
| `ListRow` | ✅ root export (compound) | RecipeDisplay | **PASS** | `contents/right/verticalPadding="small"` 사용 (`RecipeDisplay.tsx:58-71`) |
| `PageNavbar` | ✅ root via `./extensions/page-navbar` (§B.2) | pages/index, pages/recipe/generate | **PASS** | `import { PageNavbar } from '@toss/tds-react-native'`(`index.tsx:16`, `generate.tsx:23-25`) + `<PageNavbar><PageNavbar.Title>...</PageNavbar.Title></PageNavbar>` 합성 사용. 정확한 props 시그니처는 frontend 첫 사용 시 확정 — baseline §B.2 갱신 트리거. **architect T5 시점에 06 §6.4.6 갱신** 필요 |

**비사용 (Phase 2 비범위)**: `IconButton`, `TextButton`, `Toast`, `Skeleton`, `SegmentedControl`, `Dialog`, `ErrorPage` — Phase 3 이후.

8/8 PASS.

---

## 8. baseline §D.2 격리 단언 10건 (Phase 2 추가)

| # | 단언 | 검증 방법 | 상태 | 결과 |
|---|------|----------|:----:|------|
| 1 | 직접 fetch 단일점 — 정확히 2곳 (`api-client.ts` + `sse-client.ts`) | `rg "\\bfetch\\s*\\(" src/` = 2건 | **PASS** | grep: `src/services/sse-client.ts:79` + `src/services/api-client.ts:101` 정확 2곳 (AGENTS.md 주석 인용 제외). 컴포넌트·페이지·훅에서 직접 fetch 0건 |
| 2 | Tailwind 클래스 0건 | `rg "className=" src/` = 0 | **PASS** | 0건 (RN StyleSheet.create 패턴만) |
| 3 | `next/link`/`useRouter`/`href` 0건 | `rg "next/link\|useRouter\|\\bhref=" src/` = 0 (주석 제외) | **PASS** | 0건 (주석 1건 `generate.tsx:14`만 자기 정책 인용) |
| 4 | `useAuth` 0건 | `rg "useAuth\\b" src/` = 0 | **PASS** | 0건 |
| 5 | Toss user hash 평문 노출 0건 | `rg "X-Toss-User-Id" src/` 결과는 헤더 키 정의·주석만 | **PASS** | sse-client.ts:18(상수) + :26(주석) + api-client.ts:16(상수) + AGENTS.md:21(주석) 4건 모두 비노출. JSX/Alert/console 평문 0건 |
| 6 | text 청크 delta 사용자 화면 미표시 | `useRecipeGenerate.ts` + `generate.tsx`에서 `progressText`를 JSX에 직접 렌더 0건 | **PASS** | `rg "progressText" src/pages/ src/components/` 결과 1건 = `generate.tsx:15` 주석("text 청크 delta 사용자 표시 0건 — 훅의 progressText는 컴포넌트에서 미참조"). JSX 렌더 0건 — generate.tsx는 status='streaming' 시 고정 인디케이터 텍스트만(`:123-143`) |
| 7 | recipe 청크 외 채널로 최종 결과 결정 금지 (text 누적 JSON.parse 없음) | `rg "JSON\\.parse" src/` = sse-client.ts:188만 (data line만) | **PASS** | sse-client.ts:188 `JSON.parse(dataStr)`는 SSE block 단위 data line 파싱(progressText 누적 아님). `setRecipe`는 `useRecipeGenerate.ts:134-137`의 `case 'recipe'` 분기에서만 호출 — text 청크 누적과 무관 |
| 8 | HTTP 200 + error 청크 → 사용자 에러 노출 | sse-client §C.4 throw + 훅 setError | **PASS** | `sse-client.ts:117` throw → `useRecipeGenerate.ts:149-172` catch → `setError(toUserMessage(err))` + `setStatus('error')` → `generate.tsx:145-174` 에러 박스 UI 렌더 |
| 9 | `GeneratedRecipe.id` 접근 시 컴파일 에러 | TypeScript `pnpm typecheck` exit 0 + grep `recipe.id` = 0 | **PASS** | `rg "recipe\\.id\\b\|recipe\\.createdAt\|recipe\\.isFavorite" src/components/ src/pages/` = 0건 + `pnpm typecheck` exit 0 (RecipeDisplay props `recipe: GeneratedRecipe`로 컴파일 단계 가드) |
| 10 | 공개 endpoint 헤더 미부착 — sse-client tossUserId 미주입 시 `X-Toss-User-Id` 헤더 생략 | sse-client 코드 인용 | **PASS** | `src/services/sse-client.ts:62-64` `if (options.tossUserId !== undefined) headers.set(HEADER_TOSS_USER_ID, options.tossUserId)` — 옵션 무 시 set 호출 자체가 미실행. `generate.tsx`도 useTossUserId 사용 안 함 |

10/10 PASS.

---

## 8B. baseline §D.3 — `AbortSignal` 타입 충돌 cast 1줄 격리 (4건)

> 근거: baseline §D.3 (옵션 3 채택 — `as RequestInit['signal']` 단일 위치 1줄 cast). architect 통지 2026-05-24. ADR-011(가칭) D13 항목으로 묶임 (§F.2). 본질 해소는 Phase 3 또는 ADR-011 작성 시점에 architect 책임 (해소 조건 (a)(b)(c)). **Phase 2 QA는 cast가 격리되어 있는지만 확인** — 본질 해소 시도 금지.

| # | 단언 | 검증 방법 | 상태 | 결과 |
|---|------|----------|:----:|------|
| 1 | **(architect 판정 2026-05-24 갱신)** cast 정확 2곳 (sse-client.ts:76 + api-client.ts:100), 동일 패턴, 동등 cast(`as AbortSignal`/`as unknown as ... Signal`) 0건 | `rg "as RequestInit\\b" src/` = 2건 + `rg "as AbortSignal\\b\|as unknown as.*Signal" src/` = 0건 | **PASS** | grep 결과 정확 2건 = sse-client.ts:76(설계 의도) + api-client.ts:100(§A.2 허용 확장 귀결). 동등 cast 확산 0건. architect §D.3 본문 "단일 cast 패턴(2곳 적용)" 갱신 + §F.2 D13 행 "2곳 한시 통과(동일 cast 패턴·두 적용 지점)" 갱신 정합 |
| 2 | `tsconfig.json` 변경 0건 — Phase 2 작업으로 `lib`/`types`/`module`/기타 옵션 수정 없음 (ADR-010 D6 동결 유지) | `git diff` Phase 1 baseline 이후 `tsconfig.json` 0 hunk | **PASS** | `git diff HEAD -- tsconfig.json` = 0건 변경. 현재 값: `lib: ["ESNext"]`, `types: ["react-native"]`, `module: "ESNext"`, `target: "ESNext"`, `moduleResolution: "bundler"` 정확 동결 유지 |
| 3 | cast 주변 주석 존재 — baseline §D.3 또는 동등 인용 1줄 동반 (다음 LLM 세션이 의도 회복 가능) | `rg -B2 "as RequestInit" src/services/` | **PASS** | sse-client.ts:69-72 3줄 주석 "RN/ESNext lib AbortSignal type 충돌(onabort 시그니처 차이) ... 본 cast는 타입 한정 — architect 통지 사안(baseline §D.1)". api-client.ts:99 1줄 주석 "RN/ESNext AbortSignal nominal 충돌(architect 통지 사안) — fetch에 한정한 cast". 둘 다 다음 LLM 세션 의도 회복 가능 |
| 4 | **(architect 판정 2026-05-24 갱신)** 다른 모듈(hooks/pages/components/lib + recipes.ts) 전파 0건 — services/{sse-client,api-client}.ts는 적용 지점, recipes.ts는 위임만 | `rg "as RequestInit\b" src/services/recipes.ts src/hooks/ src/pages/ src/components/ src/lib/` (services/{sse-client,api-client}.ts 제외) = 0건 | **PASS** | grep 결과 recipes.ts/hooks/pages/components/lib **모두 0건**. recipes.ts는 `streamRecipe` Facade(`:90-98`)로 sse-client에 `signal/tossUserId` 위임 + 자체 fetch 0건 + 자체 cast 0건 PASS. services 2곳만 적용 지점 — 다른 모듈 전파 0건 정합 |

**해소 트리거 (Phase 3 이후 architect 책임 — QA 참고만)**:
- (a) `lib` 제거 후 ESNext built-in 가용성 검증 PASS → tsconfig 정리 + cast 제거
- (b) react-native types 갱신 → cast 제거
- (c) 정식 해법 발견 시 architect 재평가

---

## 9. 통합 스윕 — Phase 1 5건 + Phase 2 추가 5건 + §D.3 추가 2건

### 9.1 Phase 1 계승 5건 (그대로 재실행)

| # | 항목 | 명령 | FAIL 조건 | 상태 | 결과 |
|---|------|------|----------|:----:|------|
| 1 | TypeScript 컴파일 | `pnpm typecheck` | exit 0 이외 | **PASS** | exit 0 (tsc --noEmit 무출력) |
| 2 | ESLint | `pnpm lint` | 운영 코드 error | **PASS** | 0 errors, 1 warning(`router.gen.ts` 자동 생성 unused-disable — Phase 1과 동일 무해) |
| 3 | 직접 fetch 호출 | `rg "\\bfetch\\s*\\(" src/` | services 외 발견 시 FAIL | **PASS** | sse-client.ts:79 + api-client.ts:101 정확 2곳. services 외 0건 |
| 4 | `X-Toss-User-Id` 평문 노출 | `rg -i "x-toss-user-id" src/` | UI/console.log/Alert 내 발견 시 FAIL | **PASS** | services 상수 정의 + 주석만. JSX/Alert/console 평문 노출 0건 |
| 5 | 환경변수 키 격리 | `rg "import\\.meta\\.env\\." src/` | API_BASE_URL/APP_ENV/LOG_LEVEL 외 누출 | **PASS** | sse-client.ts:20 + api-client.ts:19, :22 모두 API_BASE_URL만. GEMINI/ANTHROPIC/SUPABASE 0건 |

### 9.2 Phase 2 추가 5건

| # | 항목 | 명령 | FAIL 조건 | 상태 | 결과 |
|---|------|------|----------|:----:|------|
| 6 | Tailwind 클래스 0건 | `rg "className=" src/` | 1건 이상 발견 | **PASS** | 0건 |
| 7 | href/useRouter/Link/next 0건 | `rg "next/link\|useRouter\|<Link\|\\bhref=" src/` | 1건 이상 (주석 제외) | **PASS** | 주석 1건만(`generate.tsx:14`) — 실 코드 0건 |
| 8 | useAuth 0건 | `rg "useAuth\\b" src/` | 1건 이상 | **PASS** | 0건 |
| 9 | Phase 1 dev 트리거 잔존 0건 | `rg "Phase1DevTrigger\|isDev" src/pages/` | 1건 이상 (pages/ 내) | **PASS** | 0건 — `pages/index.tsx` 재작성으로 일괄 제거 완료 |
| 10 | progressText UI 직접 렌더 0건 | `rg "progressText" src/pages/ src/components/` 분석 | JSX `{progressText}` 발견 | **PASS** | 주석 1건만(`generate.tsx:15`). 훅 외부에서 JSX 참조 0건 |

### 9.3 §D.3 보강 통합 스윕 2건 (typecheck 강화)

| # | 항목 | 명령 | FAIL 조건 | 상태 | 결과 |
|---|------|------|----------|:----:|------|
| 11 | typecheck 출력에 `TS2769` 0건 + `AbortSignal` 관련 에러 0건 | `pnpm typecheck 2>&1 \| rg "TS2769\|AbortSignal"` | TS2769 또는 AbortSignal 에러 발견 | **PASS** | typecheck exit 0, TS2769/AbortSignal 0건 |
| 12 | **(architect 판정 2026-05-24 갱신)** `as RequestInit\b` cast가 services/{sse-client,api-client}.ts 정확 2곳, 양쪽 모두 §D.3 주석 동반 | `rg "as RequestInit\\b" src/` = 2건 (sse-client.ts:76 + api-client.ts:100), 양쪽 주석 동반 검증 | 2건 외 발견 또는 주석 미동반 시 FAIL | **PASS** | grep 정확 2건 + §8B #3에서 양쪽 주석(sse-client.ts:69-72 + api-client.ts:98) 동반 검증 PASS |

11 PASS / 1 FAIL? (§12 #1 architect 판정 의존).

---

## 10. AC2.1~AC2.6 매트릭스 (requirements §수용 기준 + 10 §10.3)

| AC | 기준 | 충족 산출 | 코드 경로 검증 | 실호출 검증 |
|----|------|----------|--------------|------------|
| **AC2.1** | "김치찌개" 입력 → 점진 인디케이터 → 최종 레시피·영양 정보 완성 | sse-client + useRecipeGenerate + generate 화면 | **PASS** — `SearchForm`(`dishName` 입력) → `generate.tsx:60-72` 자동 1회 generate → `useRecipeGenerate.generate(:99-182)` SSE 소비 → recipe 청크 도착 시 `setRecipe` → `RecipeDisplay`+`NutritionPanel` 렌더(`:176-182`) | **PENDING** (백엔드 옵션 P 배포 후 또는 dev server 실행 시) |
| **AC2.2** | 뒤로가기 시 in-flight 요청 abort, UI 일관 | useEffect cleanup + AbortController.abort() | **PASS** — `useRecipeGenerate.ts:70-74` unmount cleanup `abortRef.current?.abort()` + cancel 버튼(`generate.tsx:131-141` → `handleCancel` → `reset()` → 동기 `setStatus('idle')`) UI 일관 보장 | **PENDING** |
| **AC2.3** | 빈/공백 요리명 클라이언트 차단 (zod min(1) + trim) | SearchForm 클라이언트 zod | **PASS** — `SearchForm.tsx:20-24` `dishNameSchema = z.string().trim().min(1).max(100)` + `handleSubmit:65-73` safeParse 실패 시 setError. 빈/공백 입력 시 onSubmit 미호출(백엔드 도달 0건) | N/A (백엔드 호출 0건) |
| **AC2.4** | 502/429 사용자 친화 한국어 (HTTP 숫자 노출 0건) | useRecipeGenerate `toUserMessage(ApiClientError)` | **PASS** — `useRecipeGenerate.ts:216-225` `ERROR_CODE_MESSAGES` 7종 한국어 매핑 + `toUserMessage(:227-232)` ApiClientError.error.code 기반. AI_RATE_LIMITED→"잠시 후 다시 시도해 주세요", AI_PROVIDER_ERROR→"AI 응답 생성에 실패했어요" 등. HTTP 숫자(502/429) 노출 0건 | **PENDING** |
| **AC2.5** | `GeneratedRecipe` 타입 (id 없음) — TS·런타임 가드 | TypeScript 컴파일 에러 + zod 미포함 | **PASS** — `RecipeDisplay.tsx:30` `recipe: GeneratedRecipe` props 타입 가드 + grep `recipe.id\|recipe.createdAt\|recipe.isFavorite` = 0건 + `generatedRecipeSchema`(Phase 1)는 id 필드 미정의 (런타임도 가드). `pnpm typecheck` PASS | N/A (타입 단언) |
| **AC2.6** | 비로그인 상태에서도 generate 정상 동작 (공개 — 03 §3.2.1) | sse-client tossUserId 미주입 헤더 생략 | **PASS** — `sse-client.ts:62-64` 옵션 미주입 시 헤더 set 미호출 + `pages/index.tsx`·`pages/recipe/generate.tsx` 모두 useTossUserId 미사용 (헤더 옵션 전달 자체가 안 됨) | **PENDING** |

6/6 PASS (코드 경로) / 4 PENDING (실호출).

---

## 11. baseline §G — 멈춤 트리거 (architect 통지 이력)

발견 시 본 섹션에 누적. 형식: `[일시] 트리거 분류 / 위치 / 처리 / 발송 대상`.

- (없음 — Phase 2 검증 중 §G 6항목 트리거 발견 0건)

---

## 12. 발견된 FAIL 누적 (수정 요청 발송 이력)

발견 즉시 본 섹션에 누적. 형식: `[일시] 모듈 / 파일:라인 / 위반 단언 / 수정 방법 / 발송 대상`.

- **#1 [2026-05-24] / `src/services/api-client.ts:100`** / **§D.3 단언 #1·#4** (cast 정확 1곳 + 다른 모듈 전파 0) / **architect 판정 요청 발송 → 회신 수신 2026-05-24** — `as RequestInit['signal']` cast가 sse-client.ts:76과 api-client.ts:100 **2곳**에 등장. **architect 옵션 (a) 채택 확정**: §D.3 단언 #1을 "정확 2곳(sse-client.ts:76 + api-client.ts:100)"으로 범위 확장. baseline §D.1·§D.3 본문·§F.2 D13 모두 갱신 동결. **본 FAIL → PASS 이관** (§8B 4/4 PASS + §9.3 #12 PASS). 본질 정책 그대로: 두 곳 모두 fetch RequestInit 빌드 한 행에만 격리, recipes.ts/훅/페이지/컴포넌트/lib로 전파 금지(§A.2·§C.5). Phase 3 또는 ADR-011 시점에 정식 해소. **PASS 확정**

---

## 13. 정보 공유 (FAIL 아님, 향후 참고)

### 13.1 Txt color/배경색에 hex 직접 사용 (TDS adaptive 토큰 미사용)
- `RecipeDisplay.tsx`, `NutritionPanel.tsx`, `SearchForm.tsx`, `index.tsx`, `generate.tsx` 모두 `color="#191F28"` / `color="#4E5968"` / `backgroundColor: '#F2F4F6'` 등 hex 직접 사용.
- baseline §B.1 비강제(NutritionPanel 주석 `:8-9`에서 frontend가 자체 명시) — 06 §6.3.5는 adaptive 토큰 권장. 디자인 토큰 결정 후 일괄 교체 예정. **현 단계 FAIL 아님**.

### 13.2 `pages/about.tsx` 잔여
- Phase 0 부트스트랩 잔여. baseline §E.fe "정리 또는 삭제" 항목. 본 Phase 산출에 포함 안 됨 — Phase 3 또는 T5 정리 권장. **FAIL 아님 (현재 라우팅에 포함되지만 본 미니앱 기능 외)**.

### 13.3 `useBackEvent` 하드웨어 백 미구현
- baseline §A.4 라인 58에서 (1)명시 cancel + (2)unmount cleanup만 필수, (3) 하드웨어 백 가드는 Phase 2 선택. 본 Phase 미구현. **FAIL 아님 (선택 산출)**. Phase 3 진입 시 결정 권장.

### 13.4 `generate.tsx`의 `handleCancel`이 `cancel()` 아닌 `reset()` 호출
- `generate.tsx:84-86` 명시 주석: "reset()은 동기 setState(status='idle')까지 보장하여 인디케이터가 즉시 사라진다 (AC2.2 UI 일관)". cancel()은 abort만 발사하고 status 전이가 비동기. UX 정합한 선택. **PASS** — Phase 1 dev 트리거 제거 + 비동기 status 누락 회피 디자인 결정.

### 13.5 `pages/about.tsx`가 라우터에 등록되어 있을 가능성
- `granite` 자동 라우팅이 `pages/` 디렉터리 모든 `.tsx`를 라우트로 등록할 수 있음. about 페이지가 사용자에게 노출되면 검수 영향 가능. **FAIL 아님 (현재)**, Phase 3 또는 출시 직전 점검 권장 (appsintoss-publish-checklist 스킬).

### 13.6 NumericSpinner `disable` 표기
- baseline §B.4 확인 그대로 `disable`(오타 아님). `SearchForm.tsx:104`에서 정확 사용. 다음 LLM 세션 혼동 회피를 위해 SearchForm 주석에 1줄 인용 권장 (frontend 재량).

### 13.7 sse-client.ts 디렉터리 위치 (`src/services/`)
- baseline §C.1 결정 그대로 — `api-client.ts`와 같은 폴더. SRP는 모듈 단위로 분리. 위치 정합.

### 13.8 첫 청크 타임아웃·전체 한도만 적용 (청크 간 30s는 Phase 3 후속)
- `useRecipeGenerate.ts:45-46` `FIRST_CHUNK_TIMEOUT_MS=15_000` + `TOTAL_TIMEOUT_MS=90_000`. 청크 간 30s 무응답은 Phase 3 결정 (baseline §A.4 라인 61). **PASS — Phase 2 결정 정합**.

---

## 14. 변경 이력

| 일시 | 변경 | 사유 |
|------|------|------|
| 2026-05-24 | 초기 골격 작성 — 모든 단언 PENDING | baseline 동결 통지 수신. api-client/frontend 산출 도착 시 모듈별 즉시 검증 시작. Phase 1 매트릭스 패턴(코드 경로 + 실호출 분리) 계승 |
| 2026-05-24 | §8B 신설 + 통합 스윕 §9.3 추가 (2건) | architect 보강 통지 — baseline §D.3 `AbortSignal` cast 1줄 격리 결정 + §F.2 D13. cast 격리 4단언 + typecheck 강화 2단언 추가 PENDING |
| 2026-05-24 | [A][B] 도착 즉시 검증 — 26 PASS / 2 FAIL? | zod/stream.ts·sse-client.ts 검증 완료. 03 §3.2.4 청크 5종 PASS, §D.3 #1·#4 FAIL? (api-client.ts:100 cast 발견 — §A.2 허용 확장 귀결), architect 판정 요청 발송 |
| 2026-05-24 | [C][D][E][F][G][H] 전 산출 도착 + 통합 매트릭스 일괄 갱신 | api-client 5(zod/sse-client/recipes/index/useRecipeGenerate) + frontend 7(recipe-format/SearchForm/RecipeDisplay/NutritionPanel/index/generate) 모두 도착. 청크 5종 zod / 03 §3.10 7건 / 06 §6.7 6건 / 07 §7.9 5+1 / 08 §8.9 7+1 / §B.1 TDS 8종 / §D.2 격리 10건 / 통합 스윕 11+1건 / AC2.* 6건(코드 경로) 모두 PASS. **§D.3 #1·#4 architect 판정 1건만 FAIL? 보류**. 실호출 4건(AC2.1/2.2/2.4/2.6)은 백엔드 옵션 P 배포 후 |
| 2026-05-24 | §8B #4 보강 grep 적용 — recipes.ts/hooks/pages/components/lib 전 cast 0건 재확인 | architect 보강 통지 채택 — §8B #4 grep 패턴에 `src/services/recipes.ts` + `src/lib/` 추가. 결과: api-client.ts:100 cast 1건만 존재, recipes.ts는 위임 패턴(`streamRecipe`에 signal/tossUserId만 전달)으로 자체 cast 0건 PASS 재확인. §D.3 #1·#4 판정 사안 변화 없음 — architect 판정 회신 대기 |
| 2026-05-24 | **architect §D.3 #1 판정 회신 수신 — 옵션 (a) 채택 확정** + 매트릭스 일괄 갱신 | baseline §D.1·§D.3 본문·§F.2 D13 갱신 동결 통지. §8B #1·#4 단언 갱신("정확 1곳" → "정확 2곳(sse-client.ts:76 + api-client.ts:100), 다른 모듈 전파 0건") 및 §9.3 #12 grep 명령 갱신 적용. **§8B 4/4 PASS, §9.3 2/2 PASS, §12 FAIL #1 → PASS 이관, FAIL 카운터 0건 유지.** ADR-011 D13 적용 범위 2곳 확장. 본질 해소(Phase 3 또는 ADR-011 시점) 정책 유지. Phase 2 QA **ALL PASS (코드 경로)** 확정 |
