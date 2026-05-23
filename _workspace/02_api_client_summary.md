# Phase 1 — api-client 산출 요약

> 작성: miniapp-api-client · 2026-05-23 · 팀 `airecipe-miniapp-phase1`
> 입력: `_workspace/00_input/requirements.md`, `_workspace/01_architect_phase1_baseline.md`
> 범위: baseline §E 분담의 api-client 1차 작성 산출(7파일) + tsconfig·env.d.ts 보강

---

## 1. 산출 파일

### 코드

| 파일 | 책임 | baseline 매핑 |
|------|------|--------------|
| `src/types/recipe.ts` | 도메인 타입 `Difficulty`/`Ingredient`/`Step`/`Nutrition`/`GeneratedRecipe`/`Recipe` | §A.2 |
| `src/types/user.ts` | `TossUserId`, `TossUserIdentity` (미니앱 재정의) | §A.3 |
| `src/types/api.ts` | `ApiResponse`/`ApiListResponse`/`ListMeta`/`ApiError`/`ApiErrorCode`(8종) + 6 엔드포인트 요청·응답 타입 + `StreamChunk` discriminated union | §A.1 |
| `src/types/env.d.ts` | `ImportMetaEnv` ambient (`API_BASE_URL`/`APP_ENV`/`LOG_LEVEL`) | 09 §9.4.2 SSOT |
| `src/types/index.ts` | barrel | — |
| `src/lib/zod/api.ts` | `apiErrorCodeSchema`, `apiErrorSchema`, `listMetaSchema`, `apiResponseSchema<T>` / `apiListResponseSchema<T>` factory | §A.6 |
| `src/lib/zod/recipe.ts` | `difficultySchema`/`ingredientSchema`/`stepSchema`/`nutritionSchema`/`generatedRecipeSchema`(min 1)/`recipeSchema`(.extend id/isFavorite/createdAt) | §A.6 |
| `src/lib/zod/index.ts` | barrel | — |
| `src/services/api-client.ts` | `apiFetch<T>(path, schema, init)` 단일 fetch 래퍼 + `ApiClientError` + 401 1회 재시도 + zod 검증 (raw 응답에 적용, unwrap 안 함) | §A.4 + §C.3 + §C.4 |
| `src/services/recipes.ts` | 6 호출 함수 (`generateRecipe`/`listRecipes`/`getRecipe`/`saveRecipe`/`toggleFavorite`/`deleteRecipe`) | §A.5 |
| `src/services/index.ts` | barrel + 공개 타입 재노출 | — |

### 인프라 변경

| 파일 | 변경 | 사유 |
|------|------|------|
| `package.json` | `dependencies`에 `zod@^4.4.3` 추가 (`pnpm add zod`) | baseline §B.1 |
| `tsconfig.json` | `compilerOptions.module: "ESNext"` 한 줄 추가 | `import.meta.env`(baseline §A.4) 사용을 위해 TS1343 회피. `moduleResolution: "bundler"`와 정합 |

> tsconfig 변경은 architect에게 사전 통지(SendMessage) 완료. baseline §G 멈춤 조건 4가지 어느 항목에도 해당하지 않음.

---

## 2. 노출 인터페이스

### apiFetch wrapper

```ts
export function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: ApiFetchInit,
): Promise<T>;

export interface ApiFetchInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  tossUserId?: string;
  refreshTossUserId?: () => Promise<string>;
}

export class ApiClientError extends Error {
  readonly error: { code: ApiErrorCode; message: string };
}
```

### 6 도메인 호출

```ts
// 공개 — Phase 1은 stream:false 강제
generateRecipe(req: GenerateRecipeRequest, options?: { tossUserId?: string }): Promise<GeneratedRecipe>

// 보호 — auth: { tossUserId: string; refreshTossUserId?: () => Promise<string> }
listRecipes(query: RecipeListQuery, auth: AuthedCallOptions): Promise<RecipeListResponse>
getRecipe(id: string, auth: AuthedCallOptions): Promise<Recipe>
saveRecipe(req: SaveRecipeRequest, auth: AuthedCallOptions): Promise<Recipe>
toggleFavorite(id: string, req: ToggleFavoriteRequest, auth: AuthedCallOptions): Promise<Recipe>
deleteRecipe(id: string, auth: AuthedCallOptions): Promise<{ id: string }>
```

`listRecipes`는 `{data, meta}` 둘 다 필요해 raw 그대로 반환. 나머지 5개는 `.data` unwrap 후 반환.

---

## 3. 응답 shape SSOT 인용 위치

| 영역 | 인용 |
|------|------|
| 응답 래핑 `{data, meta?}` | 03 §3.1.1 (라인 28~32) |
| 에러 `{error:{code,message}}` + 8 코드 enum | 03 §3.1.2 (라인 42~67) |
| `X-Toss-User-Id` 헤더 송출 | 03 §3.1.3 (라인 71~76) + 05 §5.2.2 (라인 88~96) |
| `GenerateRecipeRequest` / `GeneratedRecipe` | 03 §3.2.2~3.2.3 (라인 152~198) |
| `RecipeListQuery` / `RecipeListResponse` | 03 §3.3.2~3.3.3 (라인 287~315) |
| `GetRecipeResponse` | 03 §3.4.3 (라인 356~358) |
| `SaveRecipeRequest` / `SaveRecipeResponse` | 03 §3.5.2~3.5.3 (라인 396~407) |
| `ToggleFavoriteRequest` / `ToggleFavoriteResponse` | 03 §3.6.2~3.6.3 (라인 440~450) |
| `DeleteRecipeResponse` | 03 §3.7.3 (라인 488~490) |
| `StreamChunk` discriminated union | 03 §3.2.4 표 (라인 209~214) |
| 401 자동 재시도 1회 | 05 §5.4 (라인 287~314) |
| baseURL `import.meta.env.API_BASE_URL` | 09 §9.4.2 + 03 §3.9 (라인 535) |

---

## 4. 재시도·타임아웃 정책

| 항목 | 정책 | 근거 |
|------|------|------|
| 401 자동 재시도 | refreshTossUserId 주어진 경우 1회만 (재귀 깊이 1) | 05 §5.4 retry flag + baseline §C.3 |
| 401 + refreshTossUserId 미주어짐 | 재시도 없이 throw | 05 §5.4 경계 조건 #3 |
| 429/5xx 자동 재시도 | **없음** (Phase 1) | baseline에 미명시. 호출 측이 사용자 안내 매핑. Phase 3 이후 캐싱·낙관적 업데이트 도입 시 재검토 |
| 네트워크 fetch reject | 즉시 `INTERNAL_ERROR` throw (재시도 없음) | baseline에 미명시 — 무한 루프·과부하 방지 |
| 타임아웃 | **명시적 타임아웃 없음** (RN fetch 기본값) | baseline §A.4 미요구. AbortController·signal은 Phase 1 비범위 (SSE 본격 구현 시 Phase 2의 08-STREAMING 작업) |

> Phase 2에서 SSE 도입 시 `AbortController`·`signal` 옵션 부활이 필요. tsconfig의 RN/DOM AbortSignal 타입 충돌을 그때 해결.

---

## 5. throw하는 에러 카테고리

`ApiClientError`는 항상 `{ code, message }` 형태로 다음 코드 중 하나를 가진다.

| code | 발생 조건 |
|------|----------|
| `VALIDATION_ERROR` | 400 응답 |
| `UNAUTHORIZED` | 401 응답 (재시도 후에도 실패) |
| `NOT_FOUND` | 404 응답 (단건/즐겨찾기/삭제) |
| `AI_RATE_LIMITED` | 429 응답 (generateRecipe만) |
| `INTERNAL_ERROR` | 500 응답 / 네트워크 fetch reject / 본문 JSON 파싱 실패 / 응답 zod 검증 실패 |
| `AI_PROVIDER_ERROR` | 502 응답 (generateRecipe만) |
| `DB_ERROR` | 503 응답 |
| `FORBIDDEN` | enum에 포함되나 Sprint 1 미발생 (ADR-005 → 404 수렴) |

호출 측은 `error.code`로 분기 (HTTP 상태로 분기 금지; 03 §3.10 #2). 사용자 메시지는 한국어로 별도 매핑(screens 측 책임).

---

## 6. 테스트 방법

### typecheck / lint

```bash
pnpm typecheck   # 통과
pnpm lint        # 내 작성 파일 0 에러
                 # (src/_app.tsx의 react-in-jsx-scope, src/router.gen.ts warning는 Phase 0 스캐폴드/자동 생성)
```

### 수동 호출 검증 (AC1.1~1.5)

- frontend가 `useTossUserId` 완성 + `_app.tsx`에 Provider 마운트 + 임시 호출 트리거(예: 화면 또는 useEffect)를 추가하면 검증 가능.
- 검증 사양: baseline §F 표.
  - AC1.1: `tossUserId !== undefined && length >= 8`.
  - AC1.2: `listRecipes` 결과 zod `apiListResponseSchema(recipeSchema)` 통과 + 빈 사용자에서 `{data:[], meta:{...}}`.
  - AC1.3: 헤더 없이 첫 호출 강제 → 401 → refresh → 200. (백엔드 옵션 P 후속 ADR 적용 후 가능)
  - AC1.4: 응답 키 grep으로 `created_at|is_favorite|cook_time_minutes|user_id` 미존재 단언.
  - AC1.5: 6 함수 모두 호출 가능 상태 확인 (콘솔/임시 버튼).

### 단위 테스트 (선택)

- baseline은 jest unit 테스트를 Phase 1 필수로 요구하지 않음. QA가 점진 검증으로 대체.
- 작성 시: `global.fetch`를 jest.fn으로 모킹 → `apiFetch`가 보내는 method/path/headers/body 검증. `ApiClientError.error.code` 분기 검증.

---

## 7. 미해결·후속 작업

| 항목 | 처리 위치 |
|------|----------|
| `useTossUserId` 훅 작성 (SDK 단일 줄 격리) | frontend (baseline §A.7) |
| `_app.tsx`에 `TossUserIdProvider` 마운트 | frontend (baseline §A.8) |
| `@apps-in-toss/web-framework` 패키지 경로·`getAnonymousKey` 시그니처 검증 | frontend가 useTossUserId 첫 실행 시 검증, 결과를 architect에게 통지 (baseline §B.2) |
| SSE `StreamChunk` zod 스키마 작성 | Phase 2 (08-STREAMING 챕터 기반) |
| `AbortController` / `signal` 옵션 재도입 | Phase 2 (SSE 도입 시) |
| 429/5xx 지수 백오프 재시도 | Phase 3 이후 재검토 |
| `AppsInToss` 도메인 화이트리스트(`APPSINTOSS_ALLOWED_ORIGINS`) | 백엔드 후속 ADR-010 (별 저장소 `AIReceipe`) |
| 옵션 P 매핑(`profiles` upsert) | 백엔드 후속 ADR-010 |
| AC1.1~1.5 실 호출 검증 | frontend 완성 후 qa 주도 (baseline §F + Task #4) |

---

## 8. 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-23 | 초기 작성 (Phase 1 T2 산출) | api-client 1차 작성 산출 7파일 + zod 의존성 추가 + tsconfig module ESNext 보강 + env.d.ts 추가 |
