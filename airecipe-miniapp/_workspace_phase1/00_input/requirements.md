# Phase 1 — 공유 타입·API 클라이언트·식별자 훅

> 출처: 사용자 요청 "Phase 1 (공유 타입·API 클라이언트·식별자 훅) 시작해줘"
> SSOT: `docs/appsintoss-port/10-SPRINT-PLAN.md` §10.2

## 목적

6개 백엔드 엔드포인트 호출을 위한 **공통 인프라**를 만든다. 실제 화면 구현(Phase 2) 전에 단일 호출 경로를 표준화한다.

## 입력 전제 (Phase 0 완료)

- `granite.config.ts` 기본 작성 완료 (appName: `airecipe-miniapp`, displayName: `AI 레시피`, scheme: `intoss`, plugin-env 주입).
- `pages/index.tsx`, `pages/about.tsx`, `pages/_404.tsx` 스캐폴드 존재.
- `src/_app.tsx` 컨테이너 존재.
- `src/{hooks,lib,services,types}` 빈 폴더.
- `.env.example`로 `API_BASE_URL`/`APP_ENV`/`LOG_LEVEL` 정의됨.

## 산출물 (10-SPRINT-PLAN §10.2 출력)

### 코드

- `src/types/recipe.ts` — `GeneratedRecipe`, `Recipe`, `Ingredient`, `Step`, `Nutrition`, `Difficulty` (백엔드 `src/types/recipe.ts` 동기).
- `src/types/api.ts` — `ApiResponse<T>`, `ApiListResponse<T>`, `ListMeta`, `ApiError`, `ApiErrorCode`, 요청·응답 타입(`GenerateRecipeRequest`/`Response`, `SaveRecipeRequest`/`Response`, `RecipeListResponse`, `GetRecipeResponse`, `ToggleFavoriteRequest`/`Response`, `DeleteRecipeResponse`, `StreamChunk` 유니온).
- `src/types/user.ts` — 미니앱용 `User` (Toss 식별자 기반 재정의; 이메일·세션 개념 없음).
- `src/hooks/useTossUserId.ts` — `getAnonymousKey()` 캐싱, 401 시 refresh, React Context Provider + 훅.
- `src/services/api-client.ts` — `apiFetch(path, init)` 래퍼, `X-Toss-User-Id` 자동 헤더, `.data`/`.meta` unwrap, 401 자동 재시도 1회, `ApiError` throw.
- `src/services/recipes.ts` (또는 동등 경로) — 6개 엔드포인트 호출 함수(`generateRecipe`, `listRecipes`, `getRecipe`, `saveRecipe`, `toggleFavorite`, `deleteRecipe`). 단, 스트리밍 본격 구현은 Phase 2 — Phase 1은 비스트리밍 generate + 응답 zod 검증.
- `src/lib/zod/recipe.ts` — `generatedRecipeSchema`, `recipeSchema`, `nutritionSchema` 등 응답 검증 스키마.
- `src/lib/zod/api.ts` — `apiResponseSchema`, `apiErrorSchema`, `listMetaSchema` 공통.

### 통합

- `src/_app.tsx` — `TossUserIdProvider` 마운트.

### 의존성

- `zod` 패키지 추가 (devDeps 또는 deps).

## 수용 기준 (10-SPRINT-PLAN §10.2 AC1.*)

- **AC1.1**: 미니앱 첫 진입 시 `useTossUserId()`가 hash 반환 (콘솔/임시 표시).
- **AC1.2**: `apiFetch('/api/recipes', { tossUserId })` → 200 OK + `{ data: [], meta: {...} }` (빈 사용자).
- **AC1.3**: `apiFetch('/api/recipes')` (헤더 누락) → 401 자동 재시도 후 정상.
- **AC1.4**: 응답 shape이 zod 검증 통과. snake_case 키 미존재.
- **AC1.5**: 6개 엔드포인트 모두 호출 가능 상태 (UI 없음, 콘솔/임시 버튼).

## SSOT 인용 경로

| 영역 | 챕터 |
|------|------|
| 응답 shape·에러·헤더·CORS | `docs/appsintoss-port/03-API-CONTRACT.md` §3.1~3.7 |
| Toss 식별자·401 재시도 패턴·옵션 P | `docs/appsintoss-port/05-AUTH.md` §5.2.1, §5.2.2, §5.4 |
| 환경변수 (`API_BASE_URL`, `APP_ENV`)·금지 키 목록 | `docs/appsintoss-port/09-ENV-CONFIG.md` §9.1.1, §9.4.2 |
| 사용자 식별 옵션 P (미니앱은 헤더만 알면 됨) | `docs/appsintoss-port/02-DATA-MODEL.md` §2.3 |
| 아키텍처 결정 | `docs/adr/ADR-009-appsintoss-port-architecture.md` |

## 비범위

- Phase 2 이후 — 실제 화면(생성/저장/목록/상세/즐겨찾기/삭제), SSE 스트리밍 본격 구현, 낙관적 업데이트.
- 백엔드 측 옵션 P 마이그레이션 (`ADR-010` 가칭, 별 저장소 `AIReceipe`에서 작업).
- TDS 컴포넌트 매핑 (Phase 2부터).

## 위험·완화

| 위험 | 완화 |
|------|------|
| `getAnonymousKey()` SDK 호출 패턴/import 경로 변동 | 05-AUTH §5.2.1 인용 + 코드에 SDK 버전 명시 주석. SDK 호출은 단일 함수로 격리하여 추후 대응 용이. |
| 백엔드 미니앱 경로(옵션 P) 미배포 → 401 무한 루프 | `docs/appsintoss-port/10-SPRINT-PLAN.md` §10.8 위험 #2 — Phase 1 시작 전 backend 후속 ADR 적용 확인. Phase 1 코드는 사양 기반으로 작성하되 실호출 검증(AC1.2/1.3)은 백엔드 준비 후 수행. |
| zod 응답 검증이 백엔드 응답과 미세 차이 발생 | 03-API-CONTRACT의 타입 인용 + 실응답 비교 테스트. QA가 첫 호출 응답 캡처로 검증. |
