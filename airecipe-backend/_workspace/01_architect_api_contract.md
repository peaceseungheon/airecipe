# 01. API 계약 (SSOT) — Sprint 1

> **이 문서는 백엔드와 프론트엔드의 단일 진실 공급원이다.** 코드 표현은 `src/types/api.ts`, `src/types/recipe.ts`, `src/types/user.ts`. 문서·타입·실제 응답 세 가지가 반드시 일치해야 한다.
>
> 변경 시: 아키텍트만 변경하며, 변경 전후를 ADR에 기록하고 backend/frontend/qa에 즉시 통지한다.

---

## 0. 공통 규약

### 0.1 응답 래핑 (성공)
모든 JSON 성공 응답은 객체로 감싼다 (배열 직접 반환 금지 — 향후 메타데이터 여지).

```ts
// 단건
{ "data": <T> }
// 목록
{ "data": <T[]>, "meta": { "total": number } }
```

> 프론트 훅은 반드시 `.data`를 unwrap하여 컴포넌트에 전달한다.

### 0.2 에러 형식 (통일)
모든 에러는 동일한 shape. HTTP 상태 + body.

```ts
// ApiError (src/types/api.ts)
{
  "error": {
    "code": string,        // 기계 판독용 코드 (아래 표)
    "message": string      // 사람이 읽는 메시지 (한국어)
  }
}
```

| HTTP | code | 의미 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | 요청 본문/쿼리 검증 실패 |
| 401 | `UNAUTHORIZED` | 미인증 (로그인 필요) |
| 403 | `FORBIDDEN` | (Sprint 1 미사용 — 소유권 위반은 404로 수렴, ADR-005. 향후 공유 레시피 등 명시적 권한 거부 대비 코드만 예약) |
| 404 | `NOT_FOUND` | 리소스 없음 또는 타인 소유(존재 은닉, ADR-005) |
| 429 | `AI_RATE_LIMITED` | AI 제공자 레이트리밋 (재시도 후에도) |
| 500 | `INTERNAL_ERROR` | 서버 일반 오류 |
| 502 | `AI_PROVIDER_ERROR` | AI 생성 실패(파싱/타임아웃 포함) |
| 503 | `DB_ERROR` | Supabase 접근 실패 |

### 0.3 인증 (경계 확정)
- Supabase Auth 세션 쿠키 기반. 보호된 엔드포인트는 서버에서 세션 검증(`src/lib/supabase/server.ts`).
- 미인증 시 `401 UNAUTHORIZED`. 인증됐으나 타인 소유 리소스 접근 시 `404 NOT_FOUND`로 수렴(ADR-005 — RLS 격리 귀결 + 존재 은닉).
- 소유자 격리: 보호된 모든 레시피 접근은 `user_id = auth.uid()` 스코프 + RLS로 이중 방어(ADR-001).

#### API 인증 경계 표

| 엔드포인트 | 인증 | 소유자 격리 |
|-----------|------|-----------|
| `POST /api/recipes/generate` | 공개 (비로그인 허용) | N/A (미저장) |
| `GET /api/recipes` | 필요 | 본인 것만 조회 |
| `GET /api/recipes/[id]` | 필요 | 본인 것만 조회 (없음·타인 모두 404, ADR-005) |
| `POST /api/recipes` | 필요 | 본인 소유로 저장 |
| `PATCH /api/recipes/[id]/favorite` | 필요 | 본인 것만 수정 |
| `DELETE /api/recipes/[id]` | 필요 | 본인 것만 삭제 |

#### 페이지 보호 (proxy.ts와 일치 필수)

`proxy.ts`(Next 16 규약, 구 `middleware.ts` — ADR-007)의 페이지 가드는 위 API 경계와 모순되지 않아야 한다.

| 경로 | 보호 | 비고 |
|------|------|------|
| `/`, `/recipe/generate` | 공개 | 생성은 비로그인 허용 (API와 일치) |
| `/recipe/[id]` | 보호 | 저장된(본인) 레시피 상세 → 로그인 필요 |
| `/my-recipes` | 보호 | 로그인 필요 |
| `/auth/login`, `/auth/signup` | 공개 | 로그인 시 `/`로 리다이렉트 |

> 불변식: 페이지가 호출하는 API가 인증 필요(GET/POST/PATCH/DELETE /api/recipes*)면 그 페이지도 `proxy.ts` 보호 대상이어야 한다. `/recipe/generate`만 공개 API(generate)를 쓰므로 공개. 미인증 사용자가 보호 페이지 접근 시 `/auth/login`으로 리다이렉트한다. frontend는 이 표를 `proxy.ts` matcher와 일치시킨다. 런타임은 nodejs(proxy 규약, edge 미지원) — Supabase SSR 세션 갱신은 nodejs에서 정상.

### 0.4 타입 네이밍 규칙
- API 응답/요청 타입은 `src/types/api.ts`에 엔드포인트별로 정의.
- 도메인 타입(`Recipe`, `Ingredient` 등)은 `src/types/recipe.ts`.
- API 경계는 항상 **camelCase** (DB의 snake_case는 Mapper에서 변환, 절대 노출 안 함).

---

## 1. POST /api/recipes/generate — 레시피 생성 + 영양 분석

요리 이름을 받아 Claude AI로 레시피와 영양 정보를 생성. **저장하지 않는다** (id 없음). 스트리밍과 비스트리밍 두 모드 지원.

### 1.1 요청
```ts
// GenerateRecipeRequest (src/types/api.ts)
{
  "dishName": string,        // 필수, 1~100자
  "servings"?: number,       // 선택, 1~20, 기본 2
  "stream"?: boolean         // 선택, 기본 false. true면 SSE 스트리밍
}
```
- Content-Type: `application/json`
- 검증: `dishName` 공백만 있으면 `400 VALIDATION_ERROR`.

### 1.2 응답 (비스트리밍, `stream` 미지정 또는 false)
- 200 OK, Content-Type: `application/json`
```ts
// GenerateRecipeResponse (src/types/api.ts)
{
  "data": GeneratedRecipe   // ← src/types/recipe.ts
}
```
`GeneratedRecipe` shape (저장 전 — **id/createdAt/userId 없음**):
```ts
{
  "dishName": string,
  "description": string,
  "servings": number,
  "cookTimeMinutes": number,
  "difficulty": "easy" | "medium" | "hard",
  "ingredients": [ { "name": string, "quantity": number, "unit": string } ],
  "steps": [ { "order": number, "instruction": string } ],
  "tips": string[],                  // 빈 배열 가능
  "nutrition": {
    "calories": number,
    "carbohydrates": number,
    "protein": number,
    "fat": number,
    "fiber": number,
    "healthNote": string
  }
}
```

### 1.3 응답 (스트리밍, `stream: true`)
- 200 OK, Content-Type: `text/event-stream`
- **SSE(Server-Sent Events)** 형식. 각 이벤트는 `event:` + `data:` 라인, 빈 줄로 구분.
- 청크 타입 (모두 `data:`에 JSON 직렬화):

```ts
// StreamChunk (src/types/api.ts) — discriminated union by "type"
```

| event | data (JSON) | 의미 |
|-------|-------------|------|
| `meta` | `{ "type": "meta", "dishName": string }` | 시작. 생성 시작 알림 |
| `text` | `{ "type": "text", "delta": string }` | 진행 중 텍스트 델타(설명/단계 점진 표시용, 선택적 UI) |
| `recipe` | `{ "type": "recipe", "recipe": GeneratedRecipe }` | **최종 구조화 결과**. 이 청크가 완전한 GeneratedRecipe |
| `error` | `{ "type": "error", "error": { "code": string, "message": string } }` | 생성 중 오류 |
| `done` | `{ "type": "done" }` | 스트림 종료 |

SSE wire 예시:
```
event: meta
data: {"type":"meta","dishName":"김치찌개"}

event: text
data: {"type":"text","delta":"돼지고기와 묵은지를..."}

event: recipe
data: {"type":"recipe","recipe":{ ...GeneratedRecipe... }}

event: done
data: {"type":"done"}

```
- 프론트는 `recipe` 청크의 `recipe`를 최종 결과로 사용. `text`는 UX용 점진 표시(없어도 동작 가능).
- 오류 시 `error` 청크 후 `done`으로 종료. HTTP 상태는 이미 200이므로 **에러는 청크로 전달**됨에 주의.

### 1.4 에러 (비스트리밍)
- 400 `VALIDATION_ERROR`, 429 `AI_RATE_LIMITED`, 502 `AI_PROVIDER_ERROR`, 500 `INTERNAL_ERROR`

---

## 2. GET /api/recipes — 내 레시피 목록 (인증)

로그인 사용자가 저장한 레시피 목록. 소유자 격리.

### 2.1 요청
- 쿼리:
```
?favorite=true|false   // 선택. true면 즐겨찾기만
?page=number           // 선택, 기본 1 (>=1)
?pageSize=number       // 선택, 기본 20, 상한 50 (초과 시 50으로 clamp)
```
- **pageSize clamp 정책(ADR-006)**: `pageSize > 50`은 거부하지 않고 **50으로 잘라(clamp)** 200으로 응답한다. 응답 `meta.pageSize`에 실제 적용된 값(<=50)을 반환하므로 프론트가 적용값을 확인할 수 있다. 페이징 파라미터는 클라이언트 구성값이며 "상한까지 제공"이 목록 API 관용에 부합하고, 상한 변경이 프론트를 깨지 않는다.
- 단, `page`/`pageSize`가 **숫자가 아니거나 < 1**이면 `400 VALIDATION_ERROR`. (clamp는 상한 초과에만 적용, 음수/0/비숫자는 검증 실패)
- **favorite 검증**: `"true"`/`"false"`만 허용한다. 그 외 값(`?favorite=xyz`)은 `400 VALIDATION_ERROR`. 구현은 `z.enum(["true","false"]).transform(v => v === "true")` — `z.coerce.boolean()`은 비어있지 않은 문자열을 모두 true로 만들어 `?favorite=false`를 true로 오인하므로 사용하지 않는다.

### 2.2 응답 200
```ts
// RecipeListResponse (src/types/api.ts)
{
  "data": Recipe[],          // ← 저장된 레시피 (id 포함)
  "meta": { "total": number, "page": number, "pageSize": number }
}
```
`Recipe` shape = `GeneratedRecipe` + 저장 필드:
```ts
{
  ...GeneratedRecipe 모든 필드,
  "id": string,             // uuid
  "isFavorite": boolean,
  "createdAt": string       // ISO8601
  // userId는 응답에 포함하지 않음 (서버 내부 격리용)
}
```
- 빈 목록은 `{ "data": [], "meta": { "total": 0, "page": 1, "pageSize": 20 } }` (404 아님).

### 2.3 에러
- 401 `UNAUTHORIZED`, 400 `VALIDATION_ERROR`(비숫자/음수/0 page·pageSize), 503 `DB_ERROR`
- `pageSize` 상한(50) 초과는 400이 아니라 clamp(2.1, ADR-006).

---

## 2.5. GET /api/recipes/[id] — 레시피 단건 조회 (인증)

저장된 레시피 1건 조회. 보호 페이지 `/recipe/[id]`의 딥링크/새로고침 진입을 지원한다(목록 캐시 의존 불가). 소유자 격리.

> 추가 근거: 페이지네이션·직접 진입 시 목록 캐시 find가 깨지므로 단건 조회가 필요하다. ADR-004 참조.

### 2.5.1 요청
- 경로 파라미터: `id` (uuid). 본문 없음.

### 2.5.2 응답 200
```ts
// GetRecipeResponse (src/types/api.ts)
{
  "data": Recipe              // 저장된 레시피 (id 포함). 목록의 Recipe와 동일 shape
}
```

### 2.5.3 에러
- 401 `UNAUTHORIZED`, 404 `NOT_FOUND`, 503 `DB_ERROR`
- **소유권 정책(ADR-005)**: 없음·잘못된 id·타인 소유는 모두 `404 NOT_FOUND`로 수렴한다. RLS 이중 방어(ADR-001) 하에서 타인 행은 빈 결과로 돌아와 "타인 소유(존재)"와 "없음"을 서버가 구분할 수 없고, 존재 은닉상 404 통일이 더 안전하다. `403 FORBIDDEN`은 이 엔드포인트에서 발생하지 않는다.

---

## 3. POST /api/recipes — 레시피 저장 (인증)

생성된 `GeneratedRecipe`를 받아 현재 사용자 소유로 저장.

### 3.1 요청
```ts
// SaveRecipeRequest (src/types/api.ts)
{
  "recipe": GeneratedRecipe   // 1.2의 GeneratedRecipe 전체
}
```
- 검증: `recipe.dishName`, `ingredients`(>=1), `steps`(>=1), `nutrition` 필수. 위반 시 `400 VALIDATION_ERROR`.

### 3.2 응답 201
```ts
// SaveRecipeResponse (src/types/api.ts)
{
  "data": Recipe              // 저장 완료된 레시피 (id, createdAt, isFavorite=false 포함)
}
```

### 3.3 에러
- 401 `UNAUTHORIZED`, 400 `VALIDATION_ERROR`, 503 `DB_ERROR`

---

## 4. PATCH /api/recipes/[id]/favorite — 즐겨찾기 토글 (인증)

지정 레시피의 `isFavorite`를 토글. 소유자만 가능.

### 4.1 요청
- 경로 파라미터: `id` (uuid)
- 본문 (명시적 설정 방식, 토글 모호성 제거):
```ts
// ToggleFavoriteRequest (src/types/api.ts)
{
  "isFavorite": boolean       // 설정할 목표 값 (토글 아님 — 멱등)
}
```
> 설계: 토글 대신 목표 값을 명시 → 재시도/동시성에 멱등하고 프론트 낙관적 업데이트와 일치.

### 4.2 응답 200
```ts
// ToggleFavoriteResponse (src/types/api.ts)
{
  "data": Recipe              // isFavorite 반영된 갱신 레시피
}
```

### 4.3 에러
- 401 `UNAUTHORIZED`, 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 503 `DB_ERROR`
- **소유권 정책(ADR-005)**: 없음·타인 소유는 모두 `404 NOT_FOUND`로 수렴(RLS 격리 귀결). `403 FORBIDDEN` 미발생.

---

## 5. DELETE /api/recipes/[id] — 레시피 삭제 (인증)

지정 레시피 삭제. 소유자만 가능.

### 5.1 요청
- 경로 파라미터: `id` (uuid). 본문 없음.

### 5.2 응답 200
```ts
// DeleteRecipeResponse (src/types/api.ts)
{
  "data": { "id": string }    // 삭제된 레시피 id
}
```
> 204 No Content 대신 200 + 삭제 id 반환 → 프론트 캐시 무효화에 id 활용, 응답 일관성 유지.

### 5.3 에러
- 401 `UNAUTHORIZED`, 404 `NOT_FOUND`, 503 `DB_ERROR`
- **소유권 정책(ADR-005)**: 없음·타인 소유는 모두 `404 NOT_FOUND`로 수렴(RLS 격리 귀결). `403 FORBIDDEN` 미발생.

---

## 6. 타입 ↔ 엔드포인트 매핑 요약 (경계면 검증 기준)

| 엔드포인트 | 요청 타입 | 응답 타입 | 핵심 unwrap |
|-----------|----------|----------|-----------|
| POST /generate (json) | `GenerateRecipeRequest` | `GenerateRecipeResponse` → `data: GeneratedRecipe` | `.data` |
| POST /generate (stream) | `GenerateRecipeRequest` | SSE `StreamChunk` | `recipe` 청크의 `.recipe` |
| GET /recipes | (query) | `RecipeListResponse` → `data: Recipe[]` | `.data`, `.meta` |
| GET /recipes/[id] | (none) | `GetRecipeResponse` → `data: Recipe` | `.data` |
| POST /recipes | `SaveRecipeRequest` | `SaveRecipeResponse` → `data: Recipe` | `.data` |
| PATCH /favorite | `ToggleFavoriteRequest` | `ToggleFavoriteResponse` → `data: Recipe` | `.data` |
| DELETE /[id] | (none) | `DeleteRecipeResponse` → `data: {id}` | `.data.id` |

### 핵심 경계면 불변식 (QA 체크리스트)
1. 모든 성공 응답은 `{ data, meta? }`로 래핑 — 프론트는 `.data` unwrap.
2. `GeneratedRecipe`(미저장)와 `Recipe`(저장됨, id 포함)는 **다른 타입**. 저장 전 화면에 id 접근 금지.
3. 모든 에러는 `{ error: { code, message } }`. 프론트는 `code`로 분기.
4. API 경계는 camelCase. snake_case가 응답에 새면 Mapper 누락 — 버그.
5. 스트리밍 모드의 에러는 HTTP 200 + `error` 청크. 프론트가 청크 타입으로 분기.
6. AI tool use의 `input_schema` 필드명 = `GeneratedRecipe` 필드명 (AI→DTO→UI 일치).
