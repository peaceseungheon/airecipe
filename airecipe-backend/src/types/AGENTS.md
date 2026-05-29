# src/types/ — 공유 타입 (SSOT)

이 디렉토리는 백엔드와 프론트엔드가 **공유**하는 단일 진실 공급원(Single Source of Truth)이다. API 요청/응답 타입을 여기 정의하고 양쪽이 `@/types`에서 import한다. 타입을 양쪽에 따로 정의하면 경계면 불일치가 발생한다.

## 책임
- 도메인 타입(Recipe, Ingredient, NutritionInfo 등)과 API 계약 타입(요청/응답/에러)을 정의한다.
- 순수 타입만 — 런타임 로직·의존성 없음.

## 파일
| 파일 | 내용 |
|------|------|
| `recipe.ts` | `Difficulty`, `Ingredient`, `RecipeStep`, `NutritionInfo`, `GeneratedRecipe`, `Recipe` |
| `user.ts` | `User`, `SavedRecipe`(= Recipe 별칭) |
| `api.ts` | `ApiResponse<T>`, `ApiListResponse<T>`, `ApiError`, `ApiErrorCode`, 엔드포인트별 Request/Response, `StreamChunk` |
| `index.ts` | 배럴 re-export — 소비자는 `@/types`에서 import |

## 핵심 규약
1. **API 경계는 camelCase.** DB snake_case는 `src/mappers/`에서 변환하며 이 타입에는 절대 snake_case가 없다.
2. **GeneratedRecipe vs Recipe 구분.** `GeneratedRecipe`는 저장 전(id/createdAt 없음), `Recipe`는 저장 후(id 포함). 혼용 금지.
3. **응답 래핑 타입을 통해서만 응답한다.** 단건 `ApiResponse<T>`(`{data}`), 목록 `ApiListResponse<T>`(`{data, meta}`).
4. **AI tool use의 input_schema 필드명 = `GeneratedRecipe` 필드명.** 어긋나면 AI→UI 경계면 버그.
5. **StreamChunk는 discriminated union(`type`).** SSE 소비 측은 `type`으로 분기.

## 변경 시
- 이 타입들은 계약이다. 변경은 아키텍트가 주도하며 `_workspace/01_architect_api_contract.md`와 동기화하고 ADR에 근거를 남긴 뒤 백엔드/프론트/QA에 통지한다.
- 원본 계약: `_workspace/01_architect_api_contract.md`.
