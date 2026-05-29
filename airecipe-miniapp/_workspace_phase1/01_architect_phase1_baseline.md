# Phase 1 Baseline — SSOT 인용 매핑·의존성 결정·산출물 분담

> 작성: miniapp-architect · 2026-05-23 · 팀 `airecipe-miniapp-phase1`
> 입력 SSOT: `docs/appsintoss-port/03-API-CONTRACT.md`, `05-AUTH.md`, `09-ENV-CONFIG.md`, `docs/adr/ADR-009`
> 범위: Phase 1 (공유 타입·api-client·식별자 훅) 시작 전 SSOT 인용 경로를 코드로 옮기는 1:1 매핑
> 비범위: Phase 2 이후(화면·스트리밍·낙관적 업데이트), 백엔드 측 옵션 P 마이그레이션 (별 저장소 `AIReceipe` 후속 ADR-010)

본 baseline은 api-client·frontend·qa가 **추측 없이** 동일한 SSOT 지점을 참조하도록 인용 경로를 고정한다. 각 산출물의 키 라인은 본 문서가 가리키는 챕터·절·표·코드 블록에서만 가져온다.

---

## A. 산출물 1:1 매핑 — SSOT 인용 → 미니앱 코드

### A.1 `src/types/api.ts` — 공통 응답·에러·요청·응답·스트림 타입

| 산출 심볼 | SSOT 인용 (정확 위치) | 비고 |
|----------|----------------------|------|
| `interface ApiResponse<T> { data: T }` | 03 §3.1.1 코드 블록 (라인 28~32) | 그대로 옮긴다 |
| `interface ApiListResponse<T> { data: T[]; meta: ListMeta }` | 03 §3.1.1 코드 블록 | 동일 |
| `interface ListMeta { total: number; page: number; pageSize: number }` | 03 §3.1.1 / 03 §3.3.3 | 페이지네이션 응답 |
| `interface ApiError { error: { code: ApiErrorCode; message: string } }` | 03 §3.1.2 (라인 42~48) | SSOT 원문 그대로 |
| `type ApiErrorCode = ...` 유니온 (8종) | 03 §3.1.2 (라인 50~53) + 표(라인 58~67) | `FORBIDDEN`은 예약 — Sprint 1 미발생, 코드에는 포함하되 분기 매핑은 미니앱이 만들지 않음 (03 §3.10 단언 #7) |
| `GenerateRecipeRequest` | 03 §3.2.2 (라인 152~158) + zod 인용 §3.2.2 (라인 162~169) | `dishName: string`, `servings?: number`, `stream?: boolean` |
| `GenerateRecipeResponse = ApiResponse<GeneratedRecipe>` | 03 §3.2.3 + GeneratedRecipe shape §3.2.3 (라인 180~198) | 비스트리밍 응답 |
| `SaveRecipeRequest = { recipe: GeneratedRecipe }` | 03 §3.5.2 (라인 396~398) | |
| `SaveRecipeResponse = ApiResponse<Recipe>` | 03 §3.5.3 (라인 404~407) | HTTP 201 |
| `RecipeListResponse = ApiListResponse<Recipe>` | 03 §3.3.3 (라인 298~303) | |
| `RecipeListQuery = { favorite?: boolean; page?: number; pageSize?: number }` | 03 §3.3.2 표 (라인 287~292) | `pageSize` 상한 50 clamp는 서버 책임 (ADR-006) — 미니앱은 `meta.pageSize` 신뢰 |
| `GetRecipeResponse = ApiResponse<Recipe>` | 03 §3.4.3 (라인 356~358) | |
| `ToggleFavoriteRequest = { isFavorite: boolean }` | 03 §3.6.2 (라인 440~442) | 토글 아님 (멱등 set) |
| `ToggleFavoriteResponse = ApiResponse<Recipe>` | 03 §3.6.3 (라인 449~450) | |
| `DeleteRecipeResponse = ApiResponse<{ id: string }>` | 03 §3.7.3 (라인 488~490) | 204 아님 |
| `StreamChunk` discriminated union (`meta`/`text`/`recipe`/`error`/`done`) | 03 §3.2.4 표 (라인 209~214) | Phase 1은 타입만 선언, 실제 SSE 파싱은 Phase 2 (08-STREAMING) |

> **검증 단언 (03 §3.10 인용)**: `userId` 키 응답에 없음 (#4), camelCase only (#3), `{ data, meta? }` 래핑 의무 (#1), `GeneratedRecipe`와 `Recipe`는 다른 타입 (#5).

### A.2 `src/types/recipe.ts` — 도메인 타입

| 산출 심볼 | SSOT 인용 | 비고 |
|----------|----------|------|
| `Difficulty = "easy" \| "medium" \| "hard"` | 03 §3.2.3 (라인 184) | |
| `interface Ingredient { name: string; quantity: number; unit: string }` | 03 §3.2.3 (라인 186) | |
| `interface Step { order: number; instruction: string }` | 03 §3.2.3 (라인 187) | |
| `interface Nutrition { calories: number; carbohydrates: number; protein: number; fat: number; fiber: number; healthNote: string }` | 03 §3.2.3 (라인 189~196) | 키 이름·필드 수 SSOT 그대로 |
| `interface GeneratedRecipe { dishName, description, servings, cookTimeMinutes, difficulty, ingredients[], steps[], tips[], nutrition }` | 03 §3.2.3 (라인 180~198) | **id/createdAt/userId/isFavorite 없음** — Phase 2 생성 결과는 이 타입 |
| `interface Recipe extends GeneratedRecipe { id: string; isFavorite: boolean; createdAt: string }` | 03 §3.3.3 (라인 305~315) | 저장된 레시피. `userId` 응답에 없음 |

### A.3 `src/types/user.ts` — 미니앱용 식별자 타입 (재정의)

| 산출 심볼 | SSOT 인용 | 비고 |
|----------|----------|------|
| `interface TossUserIdentity { tossUserId: string }` | 05 §5.2.1 (라인 67~84) + 05 §5.10 표 | 미니앱은 **이메일/세션 없음** — 백엔드 웹의 `User { id, email }` 타입은 미니앱에 들여오지 않는다. hash는 사용자에게 표시 금지 |
| (타입 alias) `type TossUserId = string` | 05 §5.2.3 사양 — `z.string().min(8).max(256)` | brand type까지는 필요 없음(YAGNI). 검증은 zod로 |

> 00-OVERVIEW 0.5 "User 타입은 Toss hash 기반으로 재정의 필요"와 정합. 백엔드의 `auth.users` 기반 `User`는 미니앱에 들이지 않는다.

### A.4 `src/services/api-client.ts` — `apiFetch` 래퍼

| 산출 책임 | SSOT 인용 | 미니앱 동작 |
|----------|----------|-----------|
| baseURL = `import.meta.env.API_BASE_URL` | 09 §9.4.2 (라인 204~209) + 03 §3.9 (라인 535) | 빌드 시점 인라인. runtime `process.env` 금지 |
| `X-Toss-User-Id` 자동 헤더 | 03 §3.1.3 (라인 71~76) + 05 §5.2.2 (라인 88~96) | `tossUserId`가 주어지면 헤더에 부착. 공개 `POST /generate`는 생략 가능 (05 §5.3, 03 §3.2.1) |
| 본문 있을 시 `Content-Type: application/json` | 03 §3.9 의사 코드 (라인 540~541) | `init.body` 있을 때만 |
| 응답 `.ok` 시 `JSON.parse` 후 `{ data, meta? }` 반환 | 03 §3.9 (라인 543, 553) | unwrap은 호출부에서. 본 함수는 raw 래핑 응답을 반환 |
| `.ok` 아닐 시 `ApiError` throw | 03 §3.9 (라인 547~551) | 본문 파싱 실패 시 fallback `{ error: { code: "INTERNAL_ERROR", message: "네트워크 오류" } }` |
| **401 자동 재시도 1회** | 05 §5.4 (라인 287~314) | 식별자 재발급 후 재호출. 재귀 깊이 1 (retry flag) |
| `error.code` 기반 분기 단언 | 03 §3.1.2 표 (라인 58~67) + 03 §3.10 #2 | HTTP 상태 기반 분기 금지. 미니앱 사용자 메시지는 `error.message`(한국어) 또는 코드별 상수 |
| 응답 zod 검증 (`apiResponseSchema(domainSchema)`) | 03 §3.10 #1·#3·#4 + A.6 zod 모듈 | snake_case 누출은 mapper 버그 — 즉시 에러로 신고 (03 §3.1.1) |

> **SRP**: `api-client.ts`는 HTTP I/O + 헤더 부착 + 401 재시도 + zod 검증 wrapper의 단일 책임. 도메인별 호출(`generateRecipe`, `listRecipes` 등)은 별 모듈 (`src/services/recipes.ts`)로 분리해 DIP 준수.

### A.5 `src/services/recipes.ts` — 6 엔드포인트 호출 함수

각 함수는 `apiFetch`를 한 번 호출하고 응답에 도메인 zod 스키마를 적용한다.

| 함수 | 메서드 + 경로 | 요청 타입 | 응답 타입 | SSOT |
|------|--------------|----------|----------|------|
| `generateRecipe(req: GenerateRecipeRequest)` | `POST /api/recipes/generate` | 03 §3.2.2 | `GenerateRecipeResponse` (비스트리밍) | 03 §3.2 |
| `listRecipes(query: RecipeListQuery, tossUserId)` | `GET /api/recipes?...` | 쿼리스트링 | `RecipeListResponse` | 03 §3.3 |
| `getRecipe(id: string, tossUserId)` | `GET /api/recipes/{id}` | — | `GetRecipeResponse` | 03 §3.4 |
| `saveRecipe(req: SaveRecipeRequest, tossUserId)` | `POST /api/recipes` | `SaveRecipeRequest` | `SaveRecipeResponse` (201) | 03 §3.5 |
| `toggleFavorite(id, req: ToggleFavoriteRequest, tossUserId)` | `PATCH /api/recipes/{id}/favorite` | `ToggleFavoriteRequest` | `ToggleFavoriteResponse` | 03 §3.6 |
| `deleteRecipe(id: string, tossUserId)` | `DELETE /api/recipes/{id}` | — | `DeleteRecipeResponse` | 03 §3.7 |

> Phase 1 범위에서 `generateRecipe`는 **비스트리밍 (`stream: false`)** 만 구현. SSE 본격 구현은 Phase 2 (08-STREAMING).

### A.6 `src/lib/zod/*` — 응답 검증 스키마

| 파일 | 산출 심볼 | SSOT 인용 |
|------|----------|----------|
| `src/lib/zod/api.ts` | `apiErrorCodeSchema` (8종 enum) | 03 §3.1.2 |
| `src/lib/zod/api.ts` | `apiErrorSchema` | 03 §3.1.2 코드 블록 |
| `src/lib/zod/api.ts` | `listMetaSchema` | 03 §3.1.1 |
| `src/lib/zod/api.ts` | `apiResponseSchema<T>(inner)` factory | 03 §3.1.1 — `z.object({ data: inner })` |
| `src/lib/zod/api.ts` | `apiListResponseSchema<T>(inner)` factory | 03 §3.1.1 — `z.object({ data: z.array(inner), meta: listMetaSchema })` |
| `src/lib/zod/recipe.ts` | `difficultySchema`, `ingredientSchema`, `stepSchema`, `nutritionSchema` | 03 §3.2.3 |
| `src/lib/zod/recipe.ts` | `generatedRecipeSchema` (`ingredients` min 1, `steps` min 1) | 03 §3.2.3 + 03 §3.5.2 (`saveRecipeRequestSchema`의 내부 검증과 동일) |
| `src/lib/zod/recipe.ts` | `recipeSchema = generatedRecipeSchema.extend({ id, isFavorite, createdAt })` | 03 §3.3.3 |

> **`StreamChunk` zod 스키마는 Phase 1 비범위** — 08-STREAMING 챕터의 본격 SSE 구현 시 Phase 2에서 별 모듈로 추가 (`src/lib/zod/stream.ts` 가칭). Phase 1은 타입 선언만 (A.1 참조).

### A.7 `src/hooks/useTossUserId.ts` — 식별자 발급·캐싱·Context

| 산출 책임 | SSOT 인용 | 미니앱 동작 |
|----------|----------|-----------|
| `getAnonymousKey()` (`@apps-in-toss/web-framework`) 1회 호출 | 05 §5.2.1 (라인 67~84) | 미니앱 진입 시 1회. SDK 호출은 단일 함수로 격리 — SDK 버전 변동 대응 (Phase 1 베이스라인 위험 #1) |
| 캐싱 위치: **메모리 (모듈 스코프)** | 05 §5.2.1 (라인 69) + 05 §5.10 표 (라인 514) | SecureStore는 채택 보류 — 결정 §C.2 참조 |
| 401 시 refresh API 제공 | 05 §5.4 (라인 287~308) | `refresh()` 호출 시 SDK 재호출 후 캐시 교체 |
| React Context Provider + 훅 `useTossUserId()` | 03 §3.9 (라인 536) + Phase 1 입력 산출물 | `TossUserIdProvider`가 진입 시 발급, 훅은 `{ tossUserId, refresh }` 반환 |
| hash 노출 금지 | 09 §9.5 체크리스트 (라인 221) + 05 §5.10 표 | UI 표시·로깅 평문 포함 금지. 디버깅용도 환경별 LOG_LEVEL=debug에서만 허용 |
| zod 검증: `z.string().min(8).max(256)` | 05 §5.2.3 (라인 118) | 미니앱도 백엔드와 동일 검증을 적용해 부적합 hash 조기 차단 |

> **DIP**: Toss SDK는 본 훅 뒤로 격리한다. api-client는 SDK를 직접 import하지 않는다 — 훅에서 받은 hash를 인자로 받는다.

### A.8 `src/_app.tsx` 통합

| 변경 | SSOT |
|------|------|
| `TossUserIdProvider`로 `AppContainer` 자식 래핑 | Phase 1 입력 산출물 ## 통합 |

---

## B. 외부 의존성 결정

### B.1 `zod` 패키지 추가 — **`dependencies`(런타임)** 로 추가

- **결정**: `pnpm add zod@^3.23` (또는 안정 최신).
- **근거**:
  - zod는 **런타임 응답 검증**에 사용된다 (snake_case 누출·필드 누락 등 백엔드 계약 위반을 사용자 앞에 도달하기 전에 차단; 03 §3.1.1·§3.10 #3).
  - `devDependencies`는 빌드 도구·테스트 도구용. zod 스키마는 production 번들에 포함되어야 한다.
  - 백엔드(별 저장소 `AIReceipe`)도 `dependencies`로 사용 — 컨벤션 정합.
- **번들 영향**: zod ~50KB(gzip ~14KB). RN 미니앱 100MB 검수 한도(09 §9.6)에 비해 무시 가능.
- **타입 인프라**: zod 3.x는 TypeScript 5.x 호환 — 본 저장소 `typescript ^5.8.3`과 정합.

### B.2 `@apps-in-toss/web-framework` 패키지 — 추가 검증 필요

- 05 §5.2.1과 03 §3.9는 `import { getAnonymousKey } from '@apps-in-toss/web-framework'`를 사용한다.
- 현재 `package.json`은 `@apps-in-toss/framework@^2.6.0`만 의존성으로 가진다. **`@apps-in-toss/web-framework`의 실제 import 경로·패키지 존재 여부**는 Phase 0 단계의 SDK 검증 결과가 baseline에 명시되지 않았다.
- **api-client/frontend 작업 시작 전 결정 필요**: `@apps-in-toss/framework`가 `getAnonymousKey`를 export하는지 (단일 패키지 통합 가능성), 아니면 별 패키지 추가가 필요한지.
- **권장 처리 (api-client/frontend가 따를 것)**:
  1. `useTossUserId.ts`에서 SDK import는 **단일 줄로 격리**하고, 패키지 경로가 변동되더라도 1행 수정으로 대응 가능하게 한다.
  2. 첫 실 호출 검증(AC0.4·AC1.1)에서 패키지 경로가 다르다고 판명되면 즉시 본 baseline §B.2와 ADR-009 §검증을 업데이트.
  3. 본 baseline은 SSOT 사양을 그대로 따른다 — 추측해서 다른 경로를 선택하지 않는다.

### B.3 기타 추가 의존성 — **없음**

- `react-context`, `react-query` 등은 Phase 1 미도입. 단순 Context + 훅으로 충분 (YAGNI).
- 캐싱 라이브러리는 Phase 3(목록 캐시) 시점에 재검토.

---

## C. 결정 — SecureStore vs 메모리, 신규 ADR 필요성

### C.1 신규 ADR 필요한가? — **이 시점에는 불필요 (보류)**

- 본 Phase 1은 ADR-009 D2 결정(헤더 인증 + 옵션 P + 미니앱 로그인 폼 미구현) 그대로의 구현이다.
- 디자인 패턴 측: `apiFetch` Wrapper, `useTossUserId` Adapter, zod Factory 모두 03/05/09에 의사 코드가 명시되어 있다. **하나뿐인 구현체에 대한 인터페이스 추상화는 도입하지 않는다** (`software-design-principles` 오버엔지니어링 신호).
- 새 결정 항목이 발생할 때만 ADR 추가:
  - SecureStore 정식 도입 결정 시 → ADR-010 (가칭 — 별 저장소의 옵션 P 마이그레이션 ADR과 번호가 다를 수 있음, 본 저장소 측에서 미니앱 첫 결정은 ADR-010~)
  - 401 재시도 정책을 1회 초과로 늘리는 결정 시
  - 미니앱 측 캐싱/낙관적 업데이트 전략 (Phase 3 이후)

### C.2 SecureStore vs 메모리 — **메모리 채택 (Phase 1)**

- **결정**: `getAnonymousKey()` hash는 **모듈 스코프 메모리 변수**(또는 React Context 상태)에 보관한다. SecureStore는 Phase 1에서 도입하지 않는다.
- **근거**:
  1. hash는 **재발급 가능한 식별자**다 (05 §5.4 — 401 시 `getAnonymousKey()` 재호출로 즉시 복구). 영구 보관 가치가 낮다.
  2. 05 §5.10은 "메모리 (또는 SecureStore — 토스 미니앱 환경에서 보안 저장소 가용 여부는 frontend가 검증)"로 명시 — **메모리가 디폴트**이고 SecureStore는 선택.
  3. SecureStore 도입 시 RN 측 의존성(`react-native-keychain` 등) 추가 + 검수 정책 측 확인 필요 (09 §9.6 출시 검수 정책). YAGNI.
  4. Granite RN 환경에서 SecureStore에 해당하는 표준 모듈(`@apps-in-toss/framework` 또는 별 패키지)이 존재하는지는 검증되지 않았다. 추측 도입 금지.
- **트레이드오프 (수용)**:
  - 앱 재시작 시 매번 SDK 호출 1회 발생 — `getAnonymousKey()`는 비동기지만 빠르므로 영향 미미.
  - 동일 디바이스에서 hash가 변할 가능성은 SDK 사양상 낮음 (미니앱 진입 첫 호출 이후 동일). 그러나 미니앱은 그 가정에 기대지 않는다 — 401 재시도 시 새 hash로 대응.
- **재검토 트리거**: Phase 3 이후 (a) 콜드 스타트 SDK 지연이 UX 문제로 측정되거나 (b) 검수 정책이 hash 영구 보관을 권고할 때.

### C.3 `apiFetch` 재시도 정책 — **1회만**

- 05 §5.4 (라인 295, 313): `retry=false` 플래그로 무한 루프 방지. 재시도 1회 후에도 401이면 사용자에게 에러 노출.
- 본 baseline은 이 정책을 그대로 채택.

### C.4 응답 unwrap 위치 — **호출 측에서**

- `apiFetch`는 raw `{ data, meta? }` 반환. `.data` 추출은 `recipes.ts`의 각 함수가 수행.
- 근거: zod 검증은 raw 래핑 응답에 대해 수행해야 한다(`apiResponseSchema(...)` 적용). unwrap 후에 검증하면 래핑 자체 위반을 놓친다 (03 §3.10 #1).

---

## D. 미니앱은 알 필요가 없는 것 (격리 단언)

본 미니앱은 **헤더만 정확히 보내면 된다**. 다음은 백엔드 내부 사항으로, 미니앱 코드·타입·테스트에 등장하지 않는다 (05 §5.10 표 그대로).

| 항목 | 미니앱 인지 여부 | 근거 SSOT |
|------|----------------|----------|
| 옵션 P 매핑 (`profiles` 테이블) | **아니오** | 05 §5.10 (라인 519) — "백엔드의 매핑·service role·RLS는 알아야 하나? 아니오" |
| service role 우회 (`SUPABASE_SERVICE_ROLE_KEY`) | **아니오** — 키는 미니앱에 둘 수 없음 | 09 §9.1.1 금지 항목 (라인 34) |
| RLS 정책 (`auth.uid() = user_id`) | **아니오** | 05 §5.7 + 02 §2.3.2 |
| `internal_user_id` (uuid) | **아니오** — 응답에 `userId` 키 없음 | 03 §3.10 #4 + ADR-001 Mapper |
| Supabase Auth 쿠키 세션 | **아니오** — 미니앱은 헤더 단일 채널 | 05 §5.1.3 (미니앱 제거 항목) |
| Provider 선택(Gemini/Claude) | **아니오** — 호출만 | 09 §9.1.2 + 04-AI-PROVIDER |
| `APPSINTOSS_ALLOWED_ORIGINS` 화이트리스트 값 | **아니오** — 백엔드 환경변수 | 05 §5.6 + 09 §9.1.2 |

> **QA 검증 단언 (qa가 ##E의 검증 기준에 반영)**: 미니앱 코드·타입·테스트에서 위 표의 단어가 등장하면 SSOT 위반이다.

---

## E. 산출 파일 책임 분담 (api-client ↔ frontend)

| 파일 / 디렉토리 | 1차 작성자 | 2차 점검 | 비고 |
|---------------|----------|---------|------|
| `src/types/api.ts` | api-client | frontend | A.1 매핑 그대로 |
| `src/types/recipe.ts` | api-client | frontend | A.2 매핑 |
| `src/types/user.ts` | api-client | frontend | A.3 — 미니앱 재정의. 백엔드 `User` 들이지 않음 |
| `src/lib/zod/api.ts` | api-client | qa | A.6 매핑 |
| `src/lib/zod/recipe.ts` | api-client | qa | A.6 매핑 |
| `src/services/api-client.ts` | api-client | frontend, qa | A.4 + C.3 + C.4 |
| `src/services/recipes.ts` | api-client | qa | A.5 — 6개 호출 함수 |
| `src/hooks/useTossUserId.ts` | frontend | api-client (헤더 계약), qa | A.7 — Context + 훅. SDK import 단일 줄 격리 (§B.2) |
| `src/_app.tsx` 통합 | frontend | — | A.8 — Provider 마운트 |
| `.env.example` 보강 (필요 시) | architect | — | 09 §9.1.1 그대로 — 본 baseline 기준 변동 없음 |
| 신규 ADR (필요 시) | architect | api-client, frontend | §C.1 — 본 Phase에는 작성 보류 |

### E.1 작업 순서 권장 (의존성 그래프)

```
[1] src/types/api.ts + recipe.ts + user.ts        (api-client, 단독)
        │
        ├──→ [2] src/lib/zod/api.ts + recipe.ts   (api-client, 단독)
        │
        └──→ [3] src/services/api-client.ts        (api-client, 단독)
                       │
                       ├──→ [4] src/services/recipes.ts  (api-client)
                       │
[5] src/hooks/useTossUserId.ts                     (frontend, [1] 완료 후)
        │
        └──→ [6] src/_app.tsx 통합                 (frontend, [3]·[5] 완료 후)
```

[1]~[4]는 api-client 단독 진행 가능. [5]는 [1] 완료 후 frontend 단독 가능 (병렬). [6]은 [3]·[5] 모두 완료 후.

---

## F. 수용 기준 매핑 (10 §10.2 AC1.*) — 각 산출이 어떤 AC를 충족하는가

| AC | 충족 산출 | qa 검증 방법 |
|----|----------|------------|
| **AC1.1** — 첫 진입 시 hash 반환 | A.7 (`useTossUserId`) + A.8 (Provider) | 임시 화면 또는 콘솔 로그로 `tossUserId !== undefined && tossUserId.length >= 8` 단언 |
| **AC1.2** — `GET /api/recipes` 빈 사용자 → 200 + `{ data: [], meta: {...} }` | A.5 (`listRecipes`) + A.4 (`apiFetch`) + A.7 (헤더 발급) | 첫 호출 응답 캡처 → zod `apiListResponseSchema(recipeSchema)` 통과 |
| **AC1.3** — 헤더 누락 → 401 자동 재시도 후 정상 | A.4 §C.3 + A.7 `refresh` | 헤더 없이 호출 강제 → 첫 응답 401 → 재시도 → 200 단언 |
| **AC1.4** — zod 통과, snake_case 미존재 | A.6 + A.5의 각 함수가 zod 적용 | 응답 객체 key를 `Object.keys()`로 수집 → `created_at`/`is_favorite`/`cook_time_minutes`/`user_id` 미포함 단언 (03 §3.10 #3) |
| **AC1.5** — 6 엔드포인트 모두 호출 가능 | A.5 6 함수 | UI 없이 임시 콘솔 호출(또는 jest unit 스텁) → 각 함수 호출 시 정확한 method + path + 헤더 발사 단언 |

---

## G. 신규 ADR 또는 baseline 갱신 트리거 (작업 중 발견 시)

다음을 발견하면 **api-client/frontend는 진행을 멈추고 architect(나)에게 SendMessage**한다. 추측으로 진행 금지.

1. **SSOT 응답 shape과 실제 백엔드 응답의 불일치** — 03 챕터와 다른 키·타입·에러 코드가 응답에 등장.
   - 처리: architect가 별 저장소 `AIReceipe`의 후속 ADR 갱신 요청 작성. 본 저장소 baseline은 그동안 미동결.
2. **`@apps-in-toss/web-framework` 또는 `getAnonymousKey()` 호출 패턴이 사양과 다름** — 패키지 경로, 비동기/동기, 반환 타입.
   - 처리: §B.2 갱신. SDK 검증 결과를 본 baseline에 기록.
3. **CORS preflight 실패** — `Access-Control-Allow-Headers`에 `X-Toss-User-Id` 누락 등.
   - 처리: 백엔드 측 후속 ADR-010 (가칭)의 적용 여부 확인. 본 저장소 측 우회 금지 (CLAUDE.md 코드 규칙 #3).
4. **응답 자체에 `userId`/snake_case 키 누출** — Mapper 버그.
   - 처리: 03 §3.1.1 단언 위반 — 별 저장소 백엔드 hotfix 요청. 미니앱 측은 zod로 즉시 차단 (계약 위반 노출 금지).

---

## H. 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-23 | 초기 작성 (Phase 1 시작 베이스라인) | api-client/frontend/qa의 SSOT 인용 경로를 1:1 코드 매핑으로 고정. zod 런타임 의존성·메모리 캐싱·재시도 1회 정책·미니앱 격리 단언을 baseline에 동결 |
