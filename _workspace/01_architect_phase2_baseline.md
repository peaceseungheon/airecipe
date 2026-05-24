# Phase 2 Baseline — SSOT 인용 매핑·TDS 실재성·라우팅·SSE·ADR 영향

> 작성: miniapp-architect · 2026-05-24 · 팀 `airecipe-miniapp-phase2`
> 입력 SSOT: `docs/appsintoss-port/03·04·05·06·07·08`, `docs/adr/ADR-009`·`ADR-010`, `_workspace_phase1/01_architect_phase1_baseline.md`, `_workspace_phase1/04_session_log.md`, `_workspace/00_input/requirements.md`
> 범위: Phase 2(레시피 생성 화면 + SSE 스트리밍 — 기능 a/b) 진입 전 SSOT 인용 경로를 코드로 옮기는 1:1 매핑 + TDS 실재성 + 라우팅·SSE 구조·ADR 영향
> 비범위: Phase 3 이후 저장(POST)·목록·상세·즐겨찾기·삭제. 백엔드 옵션 P 마이그레이션(별 저장소 AIReceipe ADR).

본 baseline은 api-client·frontend·qa가 **추측 없이** 동일한 SSOT 지점을 참조하도록 인용 경로를 고정한다. Phase 1 산출물(ADR-010 동결)은 그대로 유지하며 비스트리밍 경로(`generateRecipe(stream:false)`)는 ADR-010 D5의 raw 응답 정책 안에 머문다. SSE는 본 baseline §C에 따라 **별 경로**로 도입한다.

---

## A. 산출물 1:1 매핑 — SSOT 인용 → 미니앱 코드 (Phase 2)

### A.1 `src/services/sse-client.ts` (신규) — SSE → fetch+ReadableStream 어댑터

| 산출 책임 | SSOT 인용 (정확 위치) | 미니앱 동작 |
|----------|---------------------|-----------|
| `POST` + `Accept: text/event-stream` 호출 | 03 §3.2.2(라인 142~149) + 08 §8.3.3 의사 코드(라인 99~108) | baseURL = `import.meta.env.API_BASE_URL` (ADR-010 D6). 본문 `{ dishName, servings, stream:true }` (03 §3.2.2) |
| 공개 엔드포인트 — 헤더 생략 가능 | 03 §3.2.1(라인 137~139) + 05 §5.3(라인 277~281) | `tossUserId` 옵션 수용하되 미주입 시 헤더 생략 (Phase 2는 비저장 경로) |
| HTTP non-200 → `ApiClientError` | 08 §8.3.3(라인 111~118) + ADR-010 D1 | `ApiError` zod 적용 후 `error.code`/`error.message`로 throw. **HTTP 상태 분기 금지** (03 §3.10 #2) |
| `Response.body` 미존재 → 폴백 신호 | 08 §8.2(라인 41~49) + §8.2.1(라인 51~65) + §8.6(라인 296~315) | `ApiClientError('AI_PROVIDER_ERROR', '스트림 응답 본문이 없습니다.')` throw — 호출 측 훅이 `generateRecipe(stream:false)`로 자동 폴백 |
| SSE 와이어 파싱 (`\n\n` 빈 줄 분리 + 다중 `data:`) | 03 §3.2.4(라인 200~241) + 08 §8.1(라인 22~39) + §8.3.3 본문(라인 152~158) | `parseSseEvents(buffer): { events, rest }` + `extractChunk(block): StreamChunk | undefined` 보조 함수. SRP로 동일 모듈 또는 `src/lib/sse-parser.ts`로 분리 가능 |
| 청크 zod 검증 | 03 §3.10 #1·#3·#4·#9 + 04 §4.5.3 4자 정합 + A.5 zod 모듈 | `streamChunkSchema.safeParse(json)` 통과 실패 시 무시(`undefined`) 또는 fatal — §C.3 결정 |
| AbortController.signal 전달 | 08 §8.4.1(라인 203~221) + §8.4.2(라인 226~235) | 호출자가 signal을 주입. `AbortError` 발생 시 reader 자연 종료 |
| **AsyncIterable<StreamChunk>** 시그니처 | 본 baseline §C.1 결정 | `async function* streamRecipe(req, options): AsyncGenerator<StreamChunk>` — for-await 소비 가능. 훅은 청크 핸들링만 |
| **에러 청크 → `ApiClientError` throw** (이중 모드 아님) | 본 baseline §C.4 결정 (team-lead 권장 #3) | `error` 청크 수신 시 yield 후 다음 청크에서 fatal throw — 호출 측 훅은 catch 한 곳에서 통합 처리. 무조건 throw로 단일 경로 |

> **SRP**: `sse-client.ts`는 SSE wire 파싱 + StreamChunk yield + 종료 보장의 단일 책임. UI 상태는 훅(A.4)이 책임. `apiFetch`(`api-client.ts`)는 우회 — ADR-010 D5의 비스트리밍 한정 정책에 정합.

### A.2 `src/services/recipes.ts` 확장 — `generateRecipeStream`

| 산출 심볼 | SSOT 인용 | 비고 |
|----------|----------|------|
| `generateRecipeStream(req, options): AsyncGenerator<StreamChunk>` | 03 §3.2 + 08 §8.3 | `sse-client.ts`의 `streamRecipe`를 그대로 위임 (Facade). `recipes.ts`의 6 도메인 함수 묶음에 본 함수 1개 추가. **`generateRecipe`(비스트리밍)는 그대로 유지** — Phase 3 저장 흐름에서 폴백·테스트용으로 보존 |
| `GenerateOptions`에 `signal?: AbortSignal` 추가 | 08 §8.3.3 + §8.4 | 기존 비스트리밍 `generateRecipe`도 동시 수용 — fetch에 그대로 전달 (한 줄 추가) |

> **DIP**: `recipes.ts`의 시그니처는 호출 측(훅/페이지)의 의존 대상. 변경은 옵션 추가뿐(기존 호출 호환).

### A.3 `src/lib/zod/stream.ts` (신규) — `StreamChunk` zod 스키마

| 산출 심볼 | SSOT 인용 | 비고 |
|----------|----------|------|
| `streamChunkSchema = z.discriminatedUnion('type', [...])` | 03 §3.2.4(라인 209~214) + `src/types/api.ts:99~104` (Phase 1) | 5종: `meta`/`text`/`recipe`/`error`/`done`. `recipe` 청크의 `recipe` 필드는 `generatedRecipeSchema`(`src/lib/zod/recipe.ts` 기존) 재사용 |
| `apiErrorCodeSchema` 재사용 (error 청크의 `error.code`) | 03 §3.1.2(라인 50~53) + `src/lib/zod/api.ts:apiErrorCodeSchema` | 동일 enum 8종 |
| **4자 정합 단언** | 03 §3.10 #9 + 04 §4.5.3 표(라인 314~325) | recipe 청크의 zod는 백엔드 `src/lib/ai/recipe-schema.ts`와 동일 필드·동일 required. 어긋나면 backend Mapper/AI 어댑터 회귀 — qa가 zod 통과로 즉시 차단 |

> Phase 1의 `generatedRecipeSchema`는 이미 03 §3.2.3과 1:1이라 본 zod 그대로 재사용. 새 모듈은 `streamChunkSchema` 1개만 추가.

### A.4 `src/hooks/useRecipeGenerate.ts` (신규) — SSE 소비 + 상태 관리

> **이름 결정 (team-lead 권장 #4 채택)**: SSOT(08 §8.3.1, 라인 70~71)가 명명한 `useRecipeGenerate`를 채택. requirements의 `useRecipeGeneration`은 표기 변형으로 폐기. **근거**: 08 챕터는 외부 인터페이스를 웹/미니앱 동일 시그니처로 강제(라인 90)하며, 본 미니앱이 별도 이름을 쓰면 차후 웹/미니앱 코드 공유 옵션이 막힌다.

| 산출 책임 | SSOT 인용 | 미니앱 동작 |
|----------|----------|-----------|
| 외부 인터페이스 | 08 §8.3.2(라인 76~88) | `{ status, progressText, recipe, error, generate, cancel, reset }`. **시그니처 그대로**. `status: 'idle' \| 'streaming' \| 'done' \| 'error'` |
| 청크 분기 (`handleChunk`) | 08 §8.3.4(라인 162~173) | `meta` → no-op (status는 generate 진입 시 streaming), `text` → `setProgressText(p => p + delta)` (내부 신호), `recipe` → `setRecipe(chunk.recipe)`, `error` → §C.4의 throw로 catch에서 처리, `done` → 루프 종료 후 status 확정 |
| **text 청크는 사용자 화면 표시 금지** | 08 §8.3.5(라인 178~199) — backend 결정 #6 | progressText는 디버그/타임아웃 신호로만 누적. 점진 표시는 "AI가 레시피를 생성하고 있어요" 인디케이터만 (Spinner + 메시지) |
| AbortController — 3곳 사용 | 08 §8.9 검증 단언(라인 350) | (1) 명시 `cancel()`, (2) `useEffect` cleanup(unmount 시 abort), (3) 하드웨어 백 가드 — Phase 2는 (1)(2)만 필수. (3)은 라우팅 챕터 §B.2에서 결정 |
| 자동 폴백 — `!res.body` 시 비스트리밍 | 08 §8.6(라인 296~315) | `sse-client`가 `'AI_PROVIDER_ERROR'`로 throw하면 훅이 `generateRecipe(stream:false)`(Phase 1 기존)로 1회 자동 재호출. 사용자에게 UX 차이는 progressText 영역만 숨김 |
| 401 처리 | 08 §8.5.2(라인 261~283) + 05 §5.3 | 본 엔드포인트는 공개 — **401 발생하지 않음**. 401 재시도 로직은 본 훅에 미적용 (보호 5개 엔드포인트의 `apiFetch` 책임) |
| 첫 청크 타임아웃 / 청크 간 무응답 / 전체 한도 | 08 §8.5.1 표(라인 246~252) | **Phase 2 결정**: 첫 청크 15초 + 전체 90초만 적용. 청크 간 30초는 Phase 3 후속 (08 §8.5.1 표 그대로 옮기되 실측 후 조정). 초과 시 abort + 사용자 안내 |

> **DIP**: 본 훅은 `sse-client.ts`의 `streamRecipe`와 `recipes.ts`의 `generateRecipe`(폴백)에만 의존. UI 컴포넌트는 본 훅의 외부 인터페이스(08 §8.3.2)에만 의존.

### A.5 화면 — Granite 파일 라우팅 (07-ROUTING)

> **라우트 경로 결정 (team-lead 권장 #1 채택)**: 07 §7.3.2의 `/recipe/generate` (`pages/recipe/generate.tsx`)를 채택. requirements의 "또는 동등 경로 `pages/generate.tsx`"는 폐기. **근거**: 07 챕터가 SSOT이며 §7.4 매핑 요약표(라인 195~200)·§7.6.2 딥링크 형식(`intoss://<appName>/recipe/[id]`)·§7.8 Navbar 분산표(라인 419~423) 모두 `/recipe/generate` 경로를 전제로 한다. Phase 3 이후 `/my-recipes`·`/recipe/[id]` 추가 시 디렉터리 구조 일관성도 보장.

| 파일 | 책임 | SSOT 인용 | Phase 2 작성 범위 |
|------|------|----------|----------------|
| `src/pages/index.tsx` | 홈 — TDS Navbar + SearchForm + 생성 화면 진입 | 07 §7.3.1(라인 47~91) | **Phase 1 dev 트리거 일괄 제거** + TDS 매핑. RecentRecipes는 Phase 3 이후 (disabled 또는 빈 자리 OK) |
| `src/pages/recipe/generate.tsx` (신규) | 레시피 생성 화면 — SearchForm + 진행 인디케이터 + RecipeDisplay + NutritionPanel | 07 §7.3.2(라인 93~129) + 08 §8.3~8.5 | `Route.useParams()`로 `{ dishName?, servings? }` 수신. 초기값 있으면 자동 1회 생성 (현재 웹 useEffect 패턴) |
| `src/router.gen.ts` | 자동 생성 — 본 baseline에서 수정 금지 | 07 §7.2 #5 (라인 42) | granite dev 가동 시 자동 갱신. 무해 경고는 ADR-010 §6.4 인용 그대로 |

> **결과 표시 화면**은 generate 화면 내 상태 분기 (별 라우트 아님). 근거: 07 §7.3.2 표(라인 95~104) — 생성·진행·결과를 한 화면에서 다룬다. 분리 라우트는 Phase 3 저장 후 `/recipe/[id]`에서 처리.

### A.6 컴포넌트 (06-UI-MAPPING)

| 파일 | TDS 매핑 (06 §6.4.1~3 그대로) | 실재성 검증 결과 (§B 참조) |
|------|------------------------------|---------------------------|
| `src/components/SearchForm.tsx` | TDS `TextField variant="line" placeholder="요리 이름"` + `NumericSpinner size="medium" minNumber={1} maxNumber={20}` + `Button display="primary" loading={pending}` | **모두 존재** (§B.1). 콜백 시그니처 `(dishName: string, servings: number) => void` 유지 |
| `src/components/RecipeDisplay.tsx` | `View` + `Txt typography="t1"` + `Badge size="small"` + `List` + `ListRow` + actions slot (ReactNode prop) | **모두 존재**. `id` 미참조(불변식 2 보호) — `GeneratedRecipe`/`Recipe` 공통 필드만 |
| `src/components/NutritionPanel.tsx` | `View` + `Txt typography="t1"`(칼로리 강조) + 4-grid 매크로(`View flexDirection: row, flexWrap: wrap`) + healthNote 박스 | TDS primitives만 사용 — 100% 존재 |
| `src/components/recipe-format.ts` | 순수 함수 `difficultyLabel`/`difficultyVariant`/`formatCookTime` | 06 §6.4.8 그대로 이식. RN/웹 공유 가능 |
| `src/components/AppNavbar.tsx` (선택) | TDS `Navbar` 대체 — §B.2 결정에 따라 합성 | **`@toss/tds-react-native/extensions/page-navbar`의 `PageNavbar` 사용** — §B.2 |

> **Phase 2 비범위**: `RecipeCard`(목록), `FavoriteButton`(즐겨찾기), `DeleteConfirmDialog`, `EmptyState`, `NotFoundScreen`, `FilterTabs` — Phase 3 이후.

---

## B. TDS 컴포넌트 실재성 검증 (`@toss/tds-react-native@2.0.3`)

> 검증 방법: `node_modules/@toss/tds-react-native/dist/esm/`의 `index.d.ts`와 각 컴포넌트의 `index.d.ts`를 직접 확인. 실제 export 시그니처를 1:1로 인용.

### B.1 06에서 인용된 컴포넌트 — 실재성·import 경로·핵심 props

| 06 인용 명칭 | 실제 export | 패키지 경로 | 핵심 props (실제 시그니처) | Phase 2 사용 여부 |
|--------------|------------|-------------|---------------------------|------------------|
| `Button` | ✅ `Button` | `@toss/tds-react-native` (root) | `type?: 'primary'\|'danger'\|'light'\|'dark'`, `style?: 'fill'\|'weak'`, `display?: 'block'\|'full'\|'inline'`, `size?: 'big'\|'large'\|'medium'\|'tiny'`, `loading?`, `disabled?`, `onPress?`, `children` | ✅ SearchForm |
| `TextField` | ✅ `TextField` | root (re-export from `./components/text-field/TextField`) | **`variant: 'box'\|'line'\|'big'\|'hero'` 필수**, `value: string\|number`, `onChangeText?`, `placeholder?`, `label?`, `hasError?`, `disabled?` + RN `TextInput` props (`keyboardType` 등) | ✅ SearchForm |
| `NumericSpinner` | ✅ `NumericSpinner` | root | `size: 'tiny'\|'small'\|'medium'\|'large'` 필수, `number?: number`, `minNumber?: number`, `maxNumber?: number`, `disable?: boolean`(주의: `disabled` 아님), `onNumberChange?: (n) => void` | ✅ SearchForm 인분 입력 |
| `Badge` | ✅ `Badge` (default export) | root | `size?: 'tiny'\|'small'\|'medium'\|'large'` + 상속받은 ParagraphBadge props (`fontWeight`, color/style 등) | ✅ RecipeDisplay |
| `Txt` | ✅ `Txt` (default + named) — 별칭 `Text`도 export | root | `typography?: TypographyKeys`(t1~t5/st9~st12 등), `fontWeight?`, `color?`, `numberOfLines?`, `textAlign?` + RN `Text` props | ✅ 전 컴포넌트 |
| `List` | ✅ `List` | root | `rowSeparator?: 'full'\|'indented'\|'none'`, `children`, `style?` | ✅ RecipeDisplay (재료/단계) |
| `ListRow` | ✅ `ListRow` (compound: `.Icon`/`.Image`/`.Texts`/`.LeftText`/`.RightTexts`/`.ImageContainer`) | root | `left?`/`contents?`/`right?: ReactNode`, `withArrow?`, `verticalPadding?: 'extraSmall'\|8\|'small'\|16\|'medium'\|24\|'large'\|32`, `onPress?`, `disabled?` | ✅ RecipeDisplay |
| `IconButton` | ✅ `IconButton` | root | `source` 또는 `name` 둘 중 하나 필수, `color?`, `bgColor?`, `variant?: 'fill'\|'clear'\|'border'`, `iconSize?`, `label?`, `onPress?` | (Phase 2 미사용 — Phase 3 FavoriteButton/즐겨찾기에서) |
| `TextButton` | ✅ `TextButton` | root | `typography: TypographyKeys` 필수, `variant?: 'arrow'\|'underline'\|'clear'`, `fontWeight?`, `color?`, `disabled?`, `onPress?`, `children` | (선택 — Navbar 우측 버튼) |
| `Toast` | ✅ `Toast` (compound: `.Icon`/`.LottieIcon`/`.Button`) | root | `position: 'top'\|'bottom'` + 각 position의 props 분기 | (Phase 2 선택 — 에러 알림) |
| `Skeleton` | ✅ `Skeleton` (default export) | root | `width?`, `height?`, `borderRadius?`, `style?` | (선택 — 생성 중 placeholder) |
| `SegmentedControl` | ✅ `SegmentedControl.Root` + `.Item` (object compound) | root | Root: `value`, `name`, `size?`, `onChange?`, `children`. Item: `value`, `size?`, `disabled?`, `children` | (Phase 3) |
| `Dialog` | ✅ `AlertDialog` / `BaseDialog` / `ConfirmDialog` (단일 `Dialog` 아님) | root | ConfirmDialog: `title`, `description?`, `leftButton`/`rightButton: ReactElement`, `open`, `onClose` | (Phase 3 — 삭제 확인) |
| `ErrorPage` | ✅ `ErrorPage` | root | `statusCode?`, `title?`, `subtitle?`, `onPressLeftButton?`, `onPressRightButton?`, `children?` | (Phase 3 — 404) |
| `Navbar` (06 §6.4.6 인용) | ❌ **루트에 `Navbar` 없음** | — (§B.2 결정) | — | §B.2 결정에 따름 |

> 그 외 root에서 추가 export됨: `Loader`, `Tab`, `TableRow`, `Tooltip`, `Top`(`TopCTA`/`TopButton` 등), `Carousel`, `Highlight`, `Gradient`, `Result`, `Slider`, `Switch`, `Radio`, `Checkbox`, `Keypad`, `SearchField`, `Stepper`, `ProgressBar`, `Rating`, `BottomSheet`, `BottomCTA`, `FixedBottomCTA`, `Agreement`, `Asset`, `Post`, `BoardRow`, `Border`, `BottomInfo`, `Chart`, `Dropdown`, `GridList`, `Icon`, `ListHeader`/`ListFooter`, `StepperRow`. `Navbar`는 export 목록에 없음.

### B.2 결정 — Navbar 대체 (team-lead 권장 #2 채택)

**결정**: 06 §6.4.6의 `Navbar` 명칭을 **`PageNavbar`로 교체**한다. 본 baseline이 06의 표기 차이를 흡수하고, 06 §6.4.6은 §I에서 따로 갱신 요청한다.

**실제 export 매트릭스**:

| 후보 | 패키지 경로 | 정체 | 본 미니앱 적합성 |
|------|------------|------|----------------|
| `PageNavbar` | `@toss/tds-react-native` (root, via `./extensions/page-navbar`) | 미니앱용 페이지 상단 헤더 컴포넌트 | ✅ **채택** — 미니앱 페이지 상단 자연 매칭 |
| `ReactNavigationNavbar` | `@toss/tds-react-native` (root, via `./components/navbar/ReactNavigationHelper`) | React Navigation의 `screenOptions`에 꽂는 헬퍼(`HeaderLeft`/`HeaderRight`/`BackButton`/`CloseButton`/`HeaderTitle`/`TitleTxt`/`SubtitleTxt`) | ❌ — Granite 진입점에서 React Navigation을 직접 다루지 않는 한 본 미니앱 채택 불요 |

**채택 근거**:
1. Granite 페이지(`pages/*.tsx`)는 컴포넌트 본문 안에서 Navbar를 직접 렌더하는 패턴(07 §7.8 라인 419~423)이 자연. `PageNavbar`가 이 패턴에 정합.
2. `ReactNavigationNavbar`는 React Navigation의 `screenOptions.headerLeft/headerRight/headerTitle` 슬롯용. Granite가 React Navigation을 wrap한다고는 하나, 본 미니앱은 Granite의 `createRoute`를 사용하는 추상화 위에 있어 직접 `screenOptions`를 손대지 않는다.

**Phase 2 사용 정책**:
- 홈(`pages/index.tsx`)과 생성(`pages/recipe/generate.tsx`)에서 `PageNavbar`를 직접 import.
- 정확한 `PageNavbar` props 시그니처는 frontend가 첫 사용 시 `node_modules/@toss/tds-react-native/dist/esm/extensions/page-navbar/PageNavbar.d.ts`로 확정. 그 결과로 06 §6.4.6의 매핑표 행을 업데이트.
- **공통 래퍼 `AppNavbar.tsx`는 만들지 않는다 (YAGNI)** — 2개 화면뿐. Phase 3에서 화면이 늘면 그때 추출.

### B.3 결정 — `TextField`의 `variant` 의무화 흡수

06 §6.3.2는 `variant`를 "박스는 box, 검색창은 line" 식으로 디자인 선호로 처리하지만, **실제 시그니처는 `variant` 필수**. SearchForm 입력은 `variant="line"` 고정 채택. 근거: 06 §6.4.1 라인 167 — "TDS `TextField variant=\"line\"`" 인용.

### B.4 결정 — `NumericSpinner`의 `disable` 표기

`disabled`가 아니라 `disable` (오타가 아니라 실제 prop명). frontend는 본 사실을 인지하고 `disable={!canSubmit}` 형식으로 사용.

---

## C. SSE 어댑터 구조 결정

### C.1 결정 — 위치: `src/services/sse-client.ts` (신규 모듈)

- **이유**: `api-client.ts`는 `apiFetch`(JSON 단일 응답 + 401 재시도 + zod) 단일 책임 (ADR-010 D5는 비스트리밍 한정 명시). SSE는 wire 파싱 + AsyncIterable + AbortSignal + `!res.body` 폴백 신호 등 책임이 다르므로 별 모듈로 분리한다 (SRP).
- **외부 인터페이스**: `streamRecipe(req: GenerateRecipeRequest, options: { signal?: AbortSignal; tossUserId?: string }): AsyncGenerator<StreamChunk>`. `recipes.ts`의 `generateRecipeStream`이 위임 Facade.

### C.2 결정 — AsyncIterable<StreamChunk> 시그니처

- 호출 측(훅)이 `for await (const chunk of stream) { handleChunk(chunk); }`로 소비. AbortSignal 발화 시 `reader.read()`가 throw → generator가 finally에서 `reader.releaseLock()` 후 종료.
- 대안(콜백 등록 방식) 기각 이유: 콜백은 청크 순서 보장이 약하고 cleanup이 분산된다. async iterator는 종료/취소가 언어 표준 흐름(try/catch/finally).

### C.3 결정 — 청크 zod 검증 정책

- **각 청크는 `streamChunkSchema.safeParse`** — 통과하면 yield, 실패하면 **무시 + 디버그 로그**(ADR-010 D1 정책의 SSE 확장).
- **예외 1**: `recipe` 청크의 zod 실패는 fatal — `recipe` 청크는 최종 결과이고 4자 정합 단언(03 §3.10 #9) 위반의 직접 신호. `ApiClientError('AI_PROVIDER_ERROR', 'AI 응답을 이해하지 못했어요.')` throw.
- **예외 2**: `error` 청크는 검증 통과 시 §C.4의 throw 경로로 진입.

### C.4 결정 — 에러 청크 매핑 위치 (team-lead 권장 #3 채택)

**결정**: `sse-client.ts`(어댑터 측)에서 `error` 청크를 `ApiClientError`로 변환 throw. 훅은 `try { for await ... } catch (err) { ... }` 한 곳에서 모든 에러(에러 청크, HTTP non-200, AbortError, 네트워크 실패, `!res.body`)를 통합 처리.

**근거**:
1. 단일 경로: 호출 측이 에러 분기를 두 군데(`for await` 안의 청크 분기 + `try/catch`)에 작성하면 중복 + 누락 위험. 한 곳에서 catch.
2. 일관성: 비스트리밍 `generateRecipe`(Phase 1)는 이미 `ApiClientError`로 throw — 동일 에러 타입을 SSE 경로에서도 사용하면 훅 측 매핑이 단일화.
3. 03 §3.10 #2(HTTP 상태 분기 금지)와 정합: 어댑터가 `error.code` 기반 분기를 강제하면 호출 측이 HTTP 상태로 분기할 여지가 사라진다.

**구현 패턴**:
```ts
// sse-client.ts (의사 코드 — 실제 구현은 api-client agent)
async function* streamRecipe(req, options) {
  // ... fetch + reader + parseSseEvents
  for (const chunk of events) {
    if (chunk.type === 'error') {
      throw new ApiClientError(chunk.error.code, chunk.error.message);
    }
    yield chunk;
    if (chunk.type === 'done') return;
  }
}
```

훅 측은:
```ts
try {
  for await (const chunk of stream) handleChunk(chunk);
  if (status !== 'error') setStatus('done');
} catch (err) {
  if (controller.signal.aborted) { setStatus('idle'); return; }
  setError(toUserMessage(err)); setStatus('error');
}
```

### C.5 결정 — `useRecipeGenerate` 훅 책임 경계

| 책임 | 본 훅 | sse-client | recipes.ts |
|------|------|------------|------------|
| HTTP 호출 + Accept 헤더 | — | ✅ | — |
| Response.body → reader → parseSseEvents | — | ✅ | — |
| `\n\n` 빈 줄 분리 + `data:` 다중 라인 처리 | — | ✅ | — |
| zod 청크 검증 | — | ✅ (§C.3) | — |
| `error` 청크 → throw | — | ✅ (§C.4) | — |
| AbortController 생성·전달 | ✅ | — | — |
| status 상태(`idle\|streaming\|done\|error`) | ✅ | — | — |
| progressText 누적 (text 청크) | ✅ — 내부 신호용 | — | — |
| `recipe` 청크 → `setRecipe` | ✅ | — | — |
| 비스트리밍 폴백 1회 (`!res.body`) | ✅ | — | (Phase 1 `generateRecipe` 호출) |
| unmount cleanup → abort | ✅ | — | — |
| 한국어 에러 메시지 매핑 | ✅ (`toUserMessage(ApiClientError)`) | — | — |
| 첫 청크 타임아웃(15s) + 전체 한도(90s) | ✅ | — | — |

> **점진 표시 UX 정책 (08 §8.3.5 채택 그대로)**: text 청크 delta는 **사용자 화면에 표시 금지**. 인디케이터만("AI가 레시피를 생성하고 있어요"). `recipe` 청크 도착 시 RecipeDisplay 1회 렌더. 디바운싱은 본 정책으로 자동 회피 (text를 안 그리니 깜빡임 없음).

### C.6 RN `fetch` ReadableStream 지원 — 사전 조사 + 검증 절차

**사전 조사 결과** (08 §8.2):
- React Native 0.74+ / Hermes 환경에서 `Response.body`는 일반적으로 `ReadableStream` 노출.
- 본 저장소: `react-native@0.84.0` + Granite `1.0.28` (CLAUDE.md "기술 스택" 표). 0.74+ 기준 충족.
- 그러나 **Granite 런타임 폴리필 상태는 SDK 검증 없이 확정 불가** — Phase 1의 SDK 패키지 경로 미해결과 같은 종류의 미검증 사실.

**검증 절차** (api-client + qa 합동):
1. Phase 2 첫 `granite dev` + sse-client 첫 호출에서 `res.body` truthy 여부 확인.
2. `res.body`가 `undefined`면 §C.4의 `'AI_PROVIDER_ERROR'` throw 경로 자동 동작 → 훅이 비스트리밍 폴백.
3. `TextDecoder` 가용 여부도 같은 시점에 확인. 미가용 시 폴리필 도입을 별 결정으로(architect 통지).
4. 미지원 환경 확정 시 ADR-011 초안(§F.2) 발효: 옵션 B(`react-native-sse`) 도입 결정 + 본 baseline §C.1 코드 폐기·교체.

**Phase 2 진행 정책**: §C.4의 자동 폴백이 있으므로 환경 미지원이어도 사용자 UX(최종 recipe 도착)는 보장. SSE 점진 UX만 비활성화. **검증 후 ADR로 결정 갱신 전까지는 옵션 A 단일 코드 경로 유지** (베이스라인 §G #2와 동일 정책 — 추측 변경 금지).

---

## D. Phase 1 산출물 영향 — 격리 유지 + Phase 2 추가 단언

### D.1 Phase 1 동결 유지 (ADR-010 D1~D7)

- `src/types/{api,recipe,user,env.d,index}.ts` — **수정 없음**. `StreamChunk` 타입은 Phase 1에서 이미 정의됨(`src/types/api.ts:99~104`).
- `src/lib/zod/{api,recipe,index}.ts` — **수정 없음**. `streamChunkSchema`는 신규 모듈 `src/lib/zod/stream.ts`로 별 추가.
- `src/services/api-client.ts` — **§A.2 허용 확장만**: `ApiFetchInit`에 `signal?: AbortSignal` 옵션 추가 + fetch 호출에 §D.3 cast 적용(2026-05-24 갱신). SSE 본문 처리는 본 wrapper 우회 (ADR-010 D5 비스트리밍 한정 명시 그대로) — apiFetch 자체는 JSON 단일 응답 유지.
- `src/services/recipes.ts` — **확장만**: `generateRecipeStream` 신규 + 기존 `generateRecipe`에 `signal?: AbortSignal` 1줄 추가. 기존 호출 호환.
- `src/hooks/useTossUserId.tsx` — **수정 없음**. 공개 generate 엔드포인트는 헤더 불필요라 본 훅과 무관.
- `src/_app.tsx` — **수정 없음**. Provider 마운트 그대로.
- `package.json` — 신규 의존성 없음 (`zod` Phase 1 추가분 그대로 사용. RN/Granite 표준 fetch + TextDecoder만 사용).
- `tsconfig.json` — **수정 없음**. ADR-010 D6(`lib: ["ESNext"]` + `types: ["react-native"]` + `module: "ESNext"`) 동결 유지. `AbortSignal` 타입 충돌은 §D.3 한시 통과 결정 적용.

### D.3 결정 — `AbortSignal` 타입 충돌 한시 통과 (api-client 통지 2026-05-24 응답)

**사실**: `tsconfig.json`이 `lib: ["ESNext"]` + `types: ["react-native"]` 둘 다 포함 → fetch의 `RequestInit.signal: global.AbortSignal`(RN globals.d.ts)과 사용자 코드의 `AbortController().signal: lib.dom AbortSignal`(ESNext lib)이 **TS 타입 nominal**로 다른 형태 → `fetch(url, { signal: options.signal })` 직접 전달 시 TS2769. 두 타입은 **런타임 동일 객체**(globalThis.AbortSignal). 근거 위치: RN globals.d.ts `node_modules/.pnpm/react-native@0.84.0_*/react-native/src/types/globals.d.ts:265, 275, 590~604` (api-client 통지 인용).

**결정 (옵션 3 채택 — api-client 권장 그대로)**: fetch 호출에서 `signal: <source>.signal as RequestInit['signal']` **단일 cast 패턴**으로 한시 통과. tsconfig.json은 수정하지 않는다.

**근거**:
1. **격리 범위 최소**: cast는 fetch 호출의 RequestInit 빌드 한 행에만 격리. 다른 모듈·다른 호출 전파 0건(qa §8B #1 grep). Phase 1 동결 코드의 본질 로직(에러 매핑·401 재시도·zod·SDK 격리·Provider 마운트)에 0건 영향.
2. **런타임 영향 0**: 두 타입은 동일 globalThis.AbortSignal 객체. cast는 TS 인지 차이만 좁힘.
3. **광범위 변경 회피**: 옵션 1(`lib` 제거)은 ESNext built-in(Promise/Map/Set/iterators/`AbortController`/`URL`/`TextDecoder` 등)의 가용성을 react-native types만으로 보장 가능한지 미검증. ADR-010 D6(`import.meta.env` 사용)의 안정성과 Phase 1 typecheck PASS 상태에 회귀 위험. 옵션 2(`types` 우선순위 활용)는 TS의 lib·types 병합 메커니즘상 한쪽이 우선되지 않고 union 적용되므로 효과 없음.
4. **격리 변경 우선 원칙**: ADR-010 D7(SDK 패키지 경로 미확정 → @ts-expect-error 1줄 한시 통과)과 같은 정책. 추측 변경 금지·격리 한시 통과·Phase 진입 시 정식 결정.

**적용 위치 (2026-05-24 갱신 — qa §8B #1 판정 요청 응답으로 옵션 (a) 채택)**: 정확히 **2곳**.
1. `src/services/sse-client.ts:76` — SSE fetch 호출 (§A.1 신규 모듈)
2. `src/services/api-client.ts:100` — `apiFetch` 의 fetch 호출 (§A.2 허용 확장 — `ApiFetchInit.signal?: AbortSignal` 옵션 추가의 자연 귀결)

**2곳 적용 결정 근거**:
- §A.2가 baseline에서 "기존 `generateRecipe`에 `signal?: AbortSignal` 1줄 추가"를 동결한 시점에 apiFetch 측 fetch 호출에서 동일 충돌이 발생하는 것은 **결정의 자연 귀결**이며 §A.2 허용 확장 범위 내.
- apiFetch에서 cast 제거는 typecheck FAIL → §A.2 결정 자체를 후퇴시켜 비스트리밍 폴백(08 §8.4.1) 시 abort 불가 회귀.
- 두 cast 모두 fetch RequestInit 빌드 한 곳에만 격리·동일 주석 동반·동일 의도 — **단일 패턴, 두 적용 지점**. 동일 결정의 일관 적용은 baseline §C.4(단일 에러 매핑)·ADR-010 D7(SDK 격리 단일 줄) 정책과 정합.
- 동등 cast(`as AbortSignal`/`as unknown as ... Signal`) 확산 0건(qa §8B #1 grep). 다른 모듈 전파 없음.
- api-client.ts 본질 변경(에러 매핑·401 재시도·zod·raw 응답 unwrap)은 0건 — §A.2 옵션 추가만.

**qa 매트릭스 §8B 단언 #1 갱신 명령**: "cast 정확히 1곳" → **"cast 정확히 2곳 (sse-client.ts + api-client.ts), 동일 패턴, 동등 cast 0건"**. §8B #4 갱신: "다른 모듈 전파 0건"의 "다른 모듈"은 hooks/pages/components/lib + recipes.ts 범위로 한정 (services/{sse-client,api-client}.ts는 적용 지점).

**해소 조건 (Phase 3 진입 시 또는 ADR-011 작성 시점에 architect 정식 결정)**:
- (a) RN 0.84 + Granite 1.0.28 환경에서 `lib` 제거 시 ESNext built-in 가용성 검증 PASS → tsconfig 정리 + cast 2곳 동시 제거.
- (b) react-native types가 `AbortSignal`을 `lib.dom`과 호환 형태로 갱신 (별 저장소 RN 측 변동) → cast 2곳 동시 제거.
- (c) 그 외 정식 해법(예: `@types/node`의 `AbortSignal` 통합) 발견 시 architect 재평가.

**ADR-011 (가칭) 반영**: §F.2의 결정 항목 표에 추가. T5(Phase 2 마무리)에서 ADR-011 단일 문서로 묶거나 ADR-010 보강 결정 시 본 §D.3을 인용.

### D.2 Phase 2 추가 격리 단언 (qa 검증 기준)

baseline §D(Phase 1)의 7항목에 더해 본 Phase 2의 추가 단언:

1. **직접 fetch 단일점 유지**: `src/`에서 직접 `fetch(` 호출은 `api-client.ts`(JSON 단일 응답) + `sse-client.ts`(SSE 스트림) 정확히 2곳. 컴포넌트·페이지·다른 훅에서 직접 fetch 0건.
2. **Tailwind 클래스 0건**: `className=`, `tw\`` 등 0건.
3. **`next/link`·`useRouter`·`href` 0건**: Granite `useNavigation`/`createRoute` 사용. 07 §7.9 검증 항목.
4. **`useAuth` 0건**: ADR-009 D2, 06 §6.4.6.
5. **Toss user hash 평문 노출 0건**: Phase 1 `formatTossUserIdMask` 헬퍼만 사용. SSE generate는 공개라 헤더도 미부착 (생략 가능).
6. **`text` 청크 delta가 사용자 화면에 그려지지 않음**: 08 §8.3.5 — 인디케이터만. `progressText` state는 내부 신호.
7. **`recipe` 청크 외 채널로 최종 결과 결정 금지**: `text` 청크 누적을 JSON.parse 하지 않음(08 §8.3.5 표 마지막 행). `setRecipe`는 `recipe` 청크에서만 호출.
8. **HTTP 200 + error 청크 → 사용자에게 에러 노출**: `sse-client`에서 `ApiClientError` throw → 훅이 setError. HTTP 상태로 분기 금지 (03 §3.10 #8).
9. **`GeneratedRecipe`(id 없음) 보호**: Phase 2 결과 화면이 `recipe.id`를 참조하면 컴파일 에러 (03 §3.10 #5, 불변식 2).
10. **공개 엔드포인트 헤더 정책**: `streamRecipe`는 `tossUserId` 미주입 시 `X-Toss-User-Id` 헤더 생략 (03 §3.2.1, 05 §5.3). 주입해도 백엔드는 무시(05 §5.3 라인 281).

---

## E. 산출 파일 책임 분담

> requirements §산출물의 §E.api / §E.fe 분담을 SSOT 명칭으로 정렬.

### E.api — `miniapp-api-client` 담당

| 파일 | 작성 종류 | SSOT 인용 |
|------|---------|----------|
| `src/services/sse-client.ts` (신규) | 신규 | §A.1, §C.1~C.4, 03 §3.2.4, 08 §8.3~8.4 |
| `src/services/recipes.ts` | 확장 (1 함수 추가 + signal 옵션) | §A.2 |
| `src/lib/zod/stream.ts` (신규) | 신규 | §A.3, 03 §3.10 #9, 04 §4.5.3 |
| `src/lib/zod/index.ts` | barrel 1줄 추가 | — |
| `src/hooks/useRecipeGenerate.ts` (신규) | 신규 | §A.4, §C.5, 08 §8.3.1~8.3.5 |

### E.fe — `miniapp-frontend` 담당

| 파일 | 작성 종류 | SSOT 인용 |
|------|---------|----------|
| `src/pages/index.tsx` | **재작성** (Phase 1 dev 트리거 일괄 제거) | §A.5, 07 §7.3.1, 06 §6.4.6 (PageNavbar §B.2) |
| `src/pages/recipe/generate.tsx` (신규) | 신규 | §A.5, 07 §7.3.2 |
| `src/components/SearchForm.tsx` (신규) | 신규 | §A.6, 06 §6.4.1, §B.1·B.3 |
| `src/components/RecipeDisplay.tsx` (신규) | 신규 | §A.6, 06 §6.4.2 |
| `src/components/NutritionPanel.tsx` (신규) | 신규 | §A.6, 06 §6.4.3 |
| `src/components/recipe-format.ts` (신규) | 신규 | 06 §6.4.8 |
| `src/pages/about.tsx` | 정리 또는 삭제 (Phase 1 잔여) | Phase 1 session log §6.3 |

### E.qa — `miniapp-qa` 담당

| 산출 | SSOT 인용 |
|------|----------|
| 청크 zod 정합 검증 (api-client 산출 검증) | 03 §3.2.4 + §A.3 + §C.3 |
| TDS 컴포넌트 실재성 cross-check (frontend 산출 검증) | §B.1 표 |
| 격리 단언 10건 (§D.2) | 본 §D.2 |
| 통합 스윕 (Phase 1 5건 + 본 Phase 5건) | 03 §3.10 + 06 §6.7 + 07 §7.9 + 08 §8.9 |
| AC2.1~AC2.6 통과 매트릭스 | requirements §수용 기준 + 10-SPRINT-PLAN §10.3 |

### E.작업 순서 (의존성 그래프)

```
[A] src/lib/zod/stream.ts                 (api-client, 단독)
    │
[B] src/services/sse-client.ts            (api-client, [A] 필요)
    │
[C] src/services/recipes.ts 확장          (api-client, [B] 필요)
    │
[D] src/hooks/useRecipeGenerate.ts        (api-client, [B][C] 필요)
    │
[E] src/components/recipe-format.ts       (frontend, 단독 — 병렬 가능)
[F] src/components/{SearchForm,RecipeDisplay,NutritionPanel}.tsx  (frontend, [E] 필요)
    │
[G] src/pages/index.tsx 재작성            (frontend, [F] 필요)
[H] src/pages/recipe/generate.tsx         (frontend, [D][F] 필요)
```

[A]~[D]는 api-client 순차. [E][F][G]는 frontend가 [A]~[D]와 병렬 가능. [H]만 [D] 완료 후.

---

## F. ADR 영향 검토

### F.1 ADR-010 D7 해소 절차 (SDK 패키지 경로 미확정)

ADR-010 §결과 표(라인 184~189) — D7은 "Phase 2 첫 `granite dev` 실행 / 백엔드 후속 ADR-X에서 SDK 가이드 갱신" 시 해소.

**Phase 2 해소 절차** (api-client + frontend 합동):
1. **첫 트리거**: `pages/index.tsx` 재작성 또는 `pages/recipe/generate.tsx` 신규 작성 후 `granite dev` 실행.
2. **검증 결과 분기**:
   - **모듈 해결됨**: `useTossUserId.tsx:21`의 `// @ts-expect-error` 주석 + 다음 줄 import의 expect-error 사유 제거. ADR-010 D7 Decision Trail에 "2026-05-XX 해소" 기록. 본 baseline §F.1 행 닫음.
   - **모듈 미해결**: 추측 변경 금지(ADR-010 §롤백 R1). architect(나)에게 SendMessage → baseline §B.2 갱신 + 별 저장소 AIReceipe의 SDK 사양 ADR 갱신 요청 사용자 보고.
3. **본 Phase 2 진행 가능 범위**: D7이 미해소여도 Phase 2 산출(SSE/화면)은 SDK 미사용 경로라 진행 가능. 단 `generate` 화면이 `useTossUserId` 훅을 import하지 않는 한정. 공개 endpoint라 헤더 미부착 — 본 baseline §A.1 그대로면 호출 가능.

### F.2 신규 ADR — ADR-011 가칭 (작성 트리거 시)

본 Phase 2의 결정 중 **새 결정 항목**은 다음 5개. 단일 ADR로 묶을지 또는 ADR-010 보강할지는 T5(Phase 2 마무리) 시점에서 결정.

| Phase 2 결정 | 본 baseline 위치 | ADR 후보 항목 |
|--------------|----------------|--------------|
| SSE 어댑터를 `sse-client.ts` 신규 모듈로 분리 (apiFetch 우회) | §C.1 | D8(가칭) — ADR-010 D5 비스트리밍 한정의 확장 |
| AsyncGenerator<StreamChunk> 시그니처 | §C.2 | D9 — SSE 소비 표준 |
| 에러 청크 → `ApiClientError` throw (어댑터 측 변환) | §C.4 | D10 — 단일 에러 매핑 |
| text 청크 사용자 화면 미표시 (인디케이터만) | §A.4 + 08 §8.3.5 채택 | D11 — Gemini 부분 JSON / Claude tool 모드 RN 컨텍스트 |
| `PageNavbar` 채택 + 공통 래퍼 미작성 | §B.2 | D12 — TDS 합성 결정 (06 §6.4.6 갱신 트리거) |
| `AbortSignal` 타입 충돌 cast 2곳 한시 통과 (sse-client + api-client) | §D.3 | D13 — RN/ESNext lib union TS2769 격리 (ADR-010 D7과 동일 패턴, 동일 cast 패턴·두 적용 지점) |

**처리 방식 권장**: T5 시점에서 6개를 단일 ADR-011 ("미니앱 Phase 2 스트리밍·UI 규약")으로 묶고, ADR-010 §결과 표의 "후속 결정으로 변경 가능" 행에 본 ADR-011 참조 양방향 추가.

### F.3 06-UI-MAPPING 갱신 요청 (architect → 본 baseline § I)

06 §6.4.6 `Navbar` 행을 `PageNavbar`로 갱신. 06 §6.5 요약표 #6 행도 동일 갱신. **본 작업은 T5(architect의 Phase 2 마무리) 시점에서 architect가 직접 실행** — frontend가 첫 사용 시 정확한 props 시그니처를 확정하면 그 결과를 06에 반영.

---

## G. 작업 중 멈춤 트리거 (Phase 1 §G와 동일 정책)

다음을 발견하면 api-client/frontend는 진행을 멈추고 architect(나)에게 SendMessage. 추측 진행 금지.

1. **SSE wire 형식과 실제 백엔드 응답의 불일치** — 03 §3.2.4 표(meta/text/recipe/error/done 5종)와 다른 event 이름, 다른 data shape, 다른 순서.
   - 처리: architect가 별 저장소 AIReceipe의 후속 ADR 갱신 요청 작성.
2. **TDS 컴포넌트 props 실제 시그니처가 §B.1 표와 다름** — 패키지 minor 업데이트 등으로 변동.
   - 처리: §B.1 표 갱신 + 06 §6.5 갱신 트리거.
3. **`Response.body` 미지원 확정** (§C.6 검증 단계).
   - 처리: 자동 폴백은 동작 — 본 Phase 진행. ADR-011 초안에 옵션 B 전환 트리거 명시.
4. **CORS preflight 실패** — `Access-Control-Allow-Headers`에 `X-Toss-User-Id` 누락 등.
   - 처리: 본 endpoint는 공개라 헤더 미부착 시 preflight 자체 미발생 가능성 — 그러나 발생 시 별 저장소 AIReceipe ADR 갱신 요청.
5. **응답 청크에 `userId`/snake_case 키 누출** — Mapper/AI 어댑터 버그.
   - 처리: zod 즉시 차단 (§C.3). 별 저장소 hotfix 요청.
6. **Granite 라우팅 동적 세그먼트 syntax 미확정** (`/recipe/[id]` 표기) — Phase 3 진입 시 검증. Phase 2 범위 외.

---

## H. 수용 기준 매핑 (requirements §수용 기준 / 10 §10.3 AC2.*)

| AC | 충족 산출 | qa 검증 방법 |
|----|----------|------------|
| **AC2.1** 입력 → 점진 표시 → 최종 완성 | §A.1·A.4·A.5 (sse-client + useRecipeGenerate + generate 화면) | "김치찌개" 수동 입력 후 텍스트 점진(인디케이터) → recipe 청크 도착 시 RecipeDisplay·NutritionPanel 일괄 렌더 |
| **AC2.2** 뒤로가기 시 abort | §A.4 (useEffect cleanup) + 08 §8.4.2 | unmount 시 AbortController.abort() 호출 단언. UI 상태 idle 또는 마지막 상태 일관 |
| **AC2.3** 빈/공백 차단 | §A.6 SearchForm (zod min(1) + trim) + 03 §3.2.2 라인 165 | 빈 입력으로 제출 → 클라이언트에서 차단(서버 도달 0건) |
| **AC2.4** 502/429 사용자 친화 한국어 | §A.4 + §C.4 (`ApiClientError.message`) | 백엔드 모킹 또는 실호출로 502 응답 → "AI 응답 생성에 실패했어요" 등. HTTP 숫자 노출 0건 |
| **AC2.5** `GeneratedRecipe`(id 없음) 타입 보호 | §D.2 #9 + 03 §3.10 #5 | TypeScript 단계에서 `recipe.id` 접근 시 컴파일 에러. 런타임 가드도 zod로 (`generatedRecipeSchema`는 id 미포함) |
| **AC2.6** 비로그인 정상 동작 | §A.1 (tossUserId 미주입 시 헤더 생략) + 05 §5.3 | `useTossUserId` 미사용 또는 미발급 상태에서 generate 호출 → 200 + recipe 청크 도착 |

---

## I. 본 baseline 동결 후 추후 architect 작업 (T5 인계)

1. **06-UI-MAPPING §6.4.6 / §6.5 갱신** — `Navbar` 행을 `PageNavbar`로, import 경로·실제 props 시그니처 추가 (§B.2 + §F.3).
2. **ADR-010 D7 해소 또는 보강** — Phase 2 첫 실행 결과에 따라 (§F.1).
3. **ADR-011 (가칭) 작성** — §F.2의 5개 결정 묶음.
4. **AGENTS.md 신규** — `src/components/AGENTS.md` (frontend가 컴포넌트 작성 후), `src/pages/AGENTS.md`(라우팅 규약).
5. **CLAUDE.md "현재 단계" 절 갱신** — Phase 1 완료 → Phase 2 완료.

---

## J. 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-24 | 초기 작성 (Phase 2 시작 베이스라인) | api-client/frontend/qa가 Phase 2 산출의 SSOT 인용 경로를 1:1 코드 매핑으로 고정. TDS 패키지 실재성 검증(15개) + Navbar→PageNavbar 결정 + SSE 어댑터 구조(C.1~C.4) + 라우트 경로 `/recipe/generate` 채택 + 훅 이름 `useRecipeGenerate` 채택 + ADR-010 D7 Phase 2 해소 절차 + ADR-011(가칭) 5개 결정 항목 인덱스 |
