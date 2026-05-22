# API: Recipes (Sprint 1) — 구현 문서

> 계약 SSOT: `_workspace/01_architect_api_contract.md`. 타입: `@/types`(`src/types/`).
> 이 문서는 **실제 구현된** 응답 shape을 기록한다. 문서·타입·실제 응답 세 가지가 일치해야 한다.

## 공통 규약

- **성공(단건)**: `{ "data": <T> }` (`ApiResponse<T>`)
- **성공(목록)**: `{ "data": <T[]>, "meta": { total, page, pageSize } }` (`ApiListResponse<T>`)
- **에러**: `{ "error": { "code": ApiErrorCode, "message": string } }` (`ApiError`)
- **경계는 camelCase.** snake_case가 응답에 새면 Mapper 버그.
- 프론트는 항상 `.data`를 unwrap한다.

### 에러 코드 → HTTP 상태
| code | HTTP |
|------|------|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `AI_RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 |
| `AI_PROVIDER_ERROR` | 502 |
| `DB_ERROR` | 503 |

---

## POST /api/recipes/generate

요리 이름으로 레시피 + 영양 정보 생성. **공개**(비로그인 허용). 저장 안 함(id 없음).

### 요청 (`GenerateRecipeRequest`)
```json
{ "dishName": "김치찌개", "servings": 2, "stream": false }
```
- `dishName`: 필수, 1~100자(공백만이면 400).
- `servings`: 선택, 1~20, 기본 2.
- `stream`: 선택, 기본 false.

### 응답 — 비스트리밍 (`stream` 미지정/false), 200
`GenerateRecipeResponse` = `{ data: GeneratedRecipe }`
```json
{
  "data": {
    "dishName": "김치찌개",
    "description": "...",
    "servings": 2,
    "cookTimeMinutes": 30,
    "difficulty": "easy",
    "ingredients": [{ "name": "묵은지", "quantity": 300, "unit": "g" }],
    "steps": [{ "order": 1, "instruction": "..." }],
    "tips": ["..."],
    "nutrition": {
      "calories": 250, "carbohydrates": 12, "protein": 18,
      "fat": 14, "fiber": 4, "healthNote": "..."
    }
  }
}
```

### 응답 — 스트리밍 (`stream: true`), 200, `text/event-stream`
SSE. 각 이벤트 = `event: <type>` + `data: <StreamChunk JSON>` + 빈 줄.
순서: `meta` → (`text`*) → `recipe` → `done`. **최종 결과는 `recipe` 청크의 `.recipe`**(= GeneratedRecipe).
```
event: meta
data: {"type":"meta","dishName":"김치찌개"}

event: recipe
data: {"type":"recipe","recipe":{ ...GeneratedRecipe... }}

event: done
data: {"type":"done"}
```
- `text` 청크는 선택적 진행 표시용(없을 수 있음 — tool 강제 모드).
- **스트리밍 에러는 HTTP 200 + `error` 청크**: `{"type":"error","error":{"code","message"}}` 후 `done`.

### 에러 (비스트리밍)
`400 VALIDATION_ERROR`, `429 AI_RATE_LIMITED`, `502 AI_PROVIDER_ERROR`, `500 INTERNAL_ERROR`.

---

## GET /api/recipes — 인증

내 레시피 목록. 소유자 격리.

### 요청 (query)
- `?favorite=true|false` (선택) — "true"/"false"만 허용, 그 외 값은 400.
- `?page=number` (선택, 기본 1) — 비숫자/0/음수는 400.
- `?pageSize=number` (선택, 기본 20, 최대 50) — 50 초과는 거부하지 않고 **50으로 clamp**(ADR-006). `meta.pageSize`에 실제 적용값 반환. 비숫자/0/음수는 400.

### 응답 200 (`RecipeListResponse`)
`{ data: Recipe[], meta: { total, page, pageSize } }`
```json
{ "data": [ { ...Recipe (id, isFavorite, createdAt 포함) } ],
  "meta": { "total": 3, "page": 1, "pageSize": 20 } }
```
- 빈 목록도 200: `{ "data": [], "meta": { "total": 0, "page": 1, "pageSize": 20 } }`.
- 최신순 정렬(`created_at desc`).

### 에러
`401 UNAUTHORIZED`, `400 VALIDATION_ERROR`(잘못된 쿼리), `503 DB_ERROR`.

---

## GET /api/recipes/[id] — 인증 (ADR-004)

저장된 레시피 1건 조회. `/recipe/[id]` 딥링크·새로고침 진입 지원(목록 캐시 의존 제거). 본문 없음.

### 응답 200 (`GetRecipeResponse` = `ApiResponse<Recipe>`)
`{ data: Recipe }` — 목록의 Recipe와 동일 shape(id 포함).

### 에러
`401 UNAUTHORIZED`, `404 NOT_FOUND`(없거나 타인 소유), `503 DB_ERROR`.

> 구현 노트(ADR-005 확정): 없음·잘못된 id·타인 소유는 모두 `404 NOT_FOUND`로 수렴한다. RLS + user_id 스코프상 타인 레시피는 조회 결과가 비어 "타인 소유"와 "없음"을 구분할 수 없고, 존재 은닉(정보 누출 방지) 관점에서도 404가 안전하다. `403 FORBIDDEN`은 이 엔드포인트에서 발생하지 않는다(ApiErrorCode에 예약만 유지). 계약 2.5.3/0.2/0.3과 일치.

---

## POST /api/recipes — 인증

`GeneratedRecipe`를 현재 사용자 소유로 저장.

### 요청 (`SaveRecipeRequest`)
```json
{ "recipe": { ...GeneratedRecipe... } }
```
- 검증: `dishName`, `ingredients`(≥1), `steps`(≥1), `nutrition` 필수.

### 응답 201 (`SaveRecipeResponse`)
`{ data: Recipe }` — `id`, `createdAt`, `isFavorite=false` 포함.

### 에러
`401 UNAUTHORIZED`, `400 VALIDATION_ERROR`, `503 DB_ERROR`.

---

## PATCH /api/recipes/[id]/favorite — 인증

즐겨찾기 목표 값 설정(토글 아님 — 멱등).

### 요청 (`ToggleFavoriteRequest`)
```json
{ "isFavorite": true }
```

### 응답 200 (`ToggleFavoriteResponse`)
`{ data: Recipe }` — `isFavorite` 반영.

### 에러
`401 UNAUTHORIZED`, `404 NOT_FOUND`(미존재/타인 소유), `400 VALIDATION_ERROR`, `503 DB_ERROR`.

> 구현 노트(ADR-005 확정): 타인 소유·미존재 모두 `404 NOT_FOUND`로 수렴(RLS + user_id 스코프 조회 결과 빈 행 → 존재 은닉). `403 FORBIDDEN`은 Sprint 1에서 발생하지 않으며 ApiErrorCode에 예약만 유지(향후 공유 레시피 등 명시적 권한 거부 대비). 계약 4.3과 일치.

---

## DELETE /api/recipes/[id] — 인증

레시피 삭제. 본문 없음.

### 응답 200 (`DeleteRecipeResponse`)
`{ data: { id: string } }` — 삭제된 id (프론트 캐시 무효화용).

### 에러
`401 UNAUTHORIZED`, `404 NOT_FOUND`, `503 DB_ERROR`.
