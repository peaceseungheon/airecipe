# 03. API 계약 — 6개 엔드포인트·인증 헤더·CORS·에러 형식

> **이 챕터 전에 알아야 할 것**: [00-OVERVIEW.md](./00-OVERVIEW.md), [01-FEATURES.md](./01-FEATURES.md), [02-DATA-MODEL.md](./02-DATA-MODEL.md), [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md), [`_workspace/01_architect_baseline.md`](../../_workspace_appsintoss_port/01_architect_baseline.md).
>
> **이 챕터 완료 후 다음 챕터**: [04-AI-PROVIDER.md](./04-AI-PROVIDER.md) (배경 이해) → [05-AUTH.md](./05-AUTH.md) (옵션 P upsert·CORS 미들웨어 흐름).

---

## 3.0 이 챕터의 목적

미니앱이 호출할 **6개 엔드포인트**의 요청·응답·에러·인증·CORS를 단일 진실로 명세한다. 본 챕터는 **인용 문서**다 — 응답 shape의 SSOT는 다음 세 자원이며, 본 챕터는 그것을 미니앱 컨텍스트(헤더 인증·CORS·옵션 P)로 재해석할 뿐 응답 자체를 재정의하지 않는다.

| SSOT | 경로 |
|------|------|
| 계약 문서 | `_workspace/01_architect_api_contract.md` |
| 공유 타입 | `src/types/api.ts`, `src/types/recipe.ts` |
| 구현 코드 | `src/app/api/recipes/**/route.ts`, `src/lib/api-response.ts`, `src/lib/validation.ts`, `src/lib/sse.ts` |
| 구현 노트 | `docs/api/recipes.md` |

> **원칙 (ADR-009 D4)**: 본 챕터는 현재 코드를 묘사할 뿐 수정을 지시하지 않는다. 백엔드 변경 필요 항목(미들웨어·CORS 헤더 추가)은 **백엔드 후속 ADR**에서 처리하며, 본 챕터는 그 ADR이 따라야 할 사양만 명시한다.

## 3.1 공통 규약 (계약 0절 인용 + 미니앱 컨텍스트 보강)

### 3.1.1 응답 래핑 (성공)

모든 JSON 성공 응답은 `{ data, meta? }`로 래핑된다 (배열 직접 반환 금지 — `_workspace/01_architect_api_contract.md` 0.1).

```ts
// src/types/api.ts
interface ApiResponse<T>      { data: T; }
interface ApiListResponse<T>  { data: T[]; meta: ListMeta; }
interface ListMeta            { total: number; page: number; pageSize: number; }
```

**미니앱 클라이언트는 반드시 `.data`(목록은 `.data`/`.meta`)를 unwrap**하여 도메인 객체로 전달한다. snake_case가 응답에 새면 Mapper 버그이므로 미니앱은 즉시 에러로 신고한다(ADR-001 매핑 표).

### 3.1.2 에러 형식 (통일)

모든 에러는 동일한 shape이다 (계약 0.2).

```ts
// ApiError (src/types/api.ts)
interface ApiError {
  error: {
    code: ApiErrorCode;   // 기계 판독용
    message: string;      // 사람이 읽는 메시지 (한국어)
  };
}

type ApiErrorCode =
  | "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" /* 예약, ADR-005 */
  | "NOT_FOUND" | "AI_RATE_LIMITED" | "INTERNAL_ERROR"
  | "AI_PROVIDER_ERROR" | "DB_ERROR";
```

미니앱은 **HTTP 상태가 아니라 `error.code`로 분기**한다. `FORBIDDEN`은 Sprint 1에서 발생하지 않는다 — 본인 것 아니면 404로 수렴한다 (ADR-005). 미니앱 UI는 본인 소유 위반·없음·잘못된 id를 모두 동일 "레시피를 찾을 수 없어요" 화면으로 처리한다(D 검증 항목, baseline D7).

| code | HTTP | 미니앱 권장 처리 |
|------|------|------------------|
| `VALIDATION_ERROR` | 400 | 입력 폼/쿼리 재검증 안내 토스트 |
| `UNAUTHORIZED` | 401 | `getAnonymousKey()` 재발급 후 1회 재시도 (05-AUTH 5.4) |
| `FORBIDDEN` | 403 | **Sprint 1 미발생** — 예약 코드 |
| `NOT_FOUND` | 404 | "레시피를 찾을 수 없어요" UI (ADR-005) |
| `AI_RATE_LIMITED` | 429 | "잠시 후 다시 시도해 주세요" 토스트 |
| `INTERNAL_ERROR` | 500 | 일반 에러 화면 |
| `AI_PROVIDER_ERROR` | 502 | AI 생성 실패 안내 (생성 화면 한정) |
| `DB_ERROR` | 503 | 일반 에러 화면 |

### 3.1.3 인증 헤더 (미니앱 신규 규약)

**모든 보호 엔드포인트에 `X-Toss-User-Id` 헤더 필수.** 값은 `getAnonymousKey()`(`@apps-in-toss/web-framework`)가 반환한 hash 문자열이다 (baseline C1, ADR-009 D2). 백엔드는 이 헤더를 받아 옵션 P 매핑(`profiles` 테이블)을 통해 `internal_user_id`(uuid)로 변환한다 (05-AUTH 5.2).

| 헤더 | 값 | 비고 |
|------|----|------|
| `X-Toss-User-Id` | `getAnonymousKey()` 반환 hash 문자열 | 보호 5개 엔드포인트 필수. 공개 1개는 생략 가능 |
| `Content-Type` | `application/json` | 본문이 있는 요청 |
| `Accept` | `application/json` 또는 `text/event-stream`(스트리밍) | 미니앱 선택 |

이중 경로 지원 (baseline C4): 백엔드는 `X-Toss-User-Id` 헤더 또는 Supabase Auth 쿠키 세션 중 **하나**가 있으면 인증된 것으로 본다. 둘 다 없으면 401. 미니앱 경로는 헤더, 웹 경로는 쿠키.

**경계 표** (baseline C2·C3 인용):

| 엔드포인트 | 인증 | 미니앱 헤더 | 비고 |
|-----------|------|-------------|------|
| `POST /api/recipes/generate` | **공개** | 생략 가능 | 비로그인 생성 허용 (계약 1절) |
| `GET /api/recipes` | 필요 | 필수 | 본인 것만 조회 |
| `GET /api/recipes/[id]` | 필요 | 필수 | 본인 것만, 없음·타인 모두 404 |
| `POST /api/recipes` | 필요 | 필수 | 본인 소유로 저장 |
| `PATCH /api/recipes/[id]/favorite` | 필요 | 필수 | 본인 것만 수정 |
| `DELETE /api/recipes/[id]` | 필요 | 필수 | 본인 것만 삭제 |

### 3.1.4 CORS (미니앱 신규 규약)

미니앱은 외부 도메인에서 백엔드를 호출하므로 **백엔드가 CORS 응답 헤더를 반환해야 한다**. 본 챕터의 결정:

- **허용 출처 정책**: 화이트리스트 방식. 미니앱은 `granite.config.ts`의 `appName`을 사용해 `https://<appName>.tossmini.toss.im`(가칭 — 실제 도메인은 09-ENV-CONFIG 챕터에서 architect가 AppsInToss MCP 검증 후 확정) 형태의 출처에서 호출한다. 백엔드는 다음 환경변수 `APPSINTOSS_ALLOWED_ORIGINS`(콤마 구분)로 허용 출처를 받는다.
- **개발 환경**: 로컬 RN dev는 출처가 동적이거나 무출처(no origin)일 수 있으므로, 백엔드는 환경변수 `NODE_ENV !== "production"`일 때 한해 `Access-Control-Allow-Origin: *`를 반환한다 (운영에서는 절대 `*` 금지 — 자격증명 헤더와 충돌).
- **자격증명**: 미니앱은 쿠키를 보내지 않고 헤더만 보내므로 `Access-Control-Allow-Credentials`는 **불필요**하다 (false 또는 미설정). 단, 동일 백엔드가 웹 쿠키 세션도 지원해야 하므로 웹 출처(예: 운영 웹 도메인)에 대해서는 `Allow-Credentials: true` + 명시적 출처 echo가 필요하다.

#### 응답 헤더 (필수)

| 응답 헤더 | 값 (미니앱 출처) |
|-----------|------------------|
| `Access-Control-Allow-Origin` | 요청 `Origin`이 화이트리스트에 있으면 그 값을 echo, 아니면 미설정 |
| `Access-Control-Allow-Methods` | `GET, POST, PATCH, DELETE, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type, X-Toss-User-Id, Accept` |
| `Access-Control-Max-Age` | `600` (10분) |
| `Vary` | `Origin` (캐시 정확성) |

#### Preflight (OPTIONS)

브라우저/일부 RN 환경은 `X-Toss-User-Id` 같은 **커스텀 헤더 사용 시 preflight OPTIONS**를 보낸다. 백엔드는 6개 엔드포인트 각각이 `OPTIONS`에 대해 위 헤더만 담은 204 응답을 반환해야 한다. 백엔드 후속 ADR에서 공통 `OPTIONS` 핸들러 또는 `proxy.ts` 보강으로 구현한다.

#### 화이트리스트 결정 (본 챕터 확정 사항)

- **운영**: `https://<appName>.tossmini.toss.im` 형태의 미니앱 운영 출처 1개 (실제 도메인은 09-ENV-CONFIG에서 확정 후 baseline 업데이트).
- **스테이징**: 별도 staging 도메인 1개 추가 (`APPSINTOSS_ALLOWED_ORIGINS`에 콤마로 추가).
- **로컬 RN dev**: 출처를 알 수 없으므로 백엔드는 `NODE_ENV=development`일 때만 모든 출처 허용 (운영 빌드에는 동일 동작 절대 금지).
- **웹 도메인(현재 운영)**: 그대로 자격증명 모드 유지(쿠키 세션). 미니앱 출처와는 별 매트릭스.

> 도메인 화이트리스트는 09-ENV-CONFIG 챕터의 `APPSINTOSS_ALLOWED_ORIGINS` 정의로 강제된다. 본 챕터와 09는 이 변수명을 SSOT로 공유한다.

### 3.1.5 타입 네이밍

API 경계는 **항상 camelCase** (DB snake_case는 Mapper에서 변환). 자세한 컬럼 매핑은 [02-DATA-MODEL.md](./02-DATA-MODEL.md) 2.1 참조.

### 3.1.6 baseURL

미니앱은 환경변수(09-ENV-CONFIG)로 주입되는 baseURL에 위 경로를 붙여 호출한다. baseURL은 본 챕터에서 명시하지 않는다 (운영/스테이징 환경에 따라 다름).

---

## 3.2 엔드포인트 1 — `POST /api/recipes/generate` (공개, 스트리밍 가능)

요리 이름을 받아 AI(Gemini 기본, Claude 롤백)로 레시피 + 1인분 영양 정보를 생성한다. **저장하지 않는다** (id 없음). 미니앱 사용 기능 (a) 레시피 생성 + (b) 영양 분석.

### 3.2.1 인증

**공개**. `X-Toss-User-Id` 헤더 생략 가능 (계약 1절 그대로). 미니앱은 진입 시 식별자를 이미 보유하고 있어도 본 엔드포인트에는 보내지 않아도 무방. 생성된 결과를 저장(POST `/api/recipes`)할 때만 헤더가 필요하다.

### 3.2.2 요청

```http
POST /api/recipes/generate HTTP/1.1
Content-Type: application/json
Accept: application/json     # 비스트리밍
# 또는
Accept: text/event-stream    # 스트리밍 (stream: true와 함께)
```

```ts
// src/types/api.ts — GenerateRecipeRequest
{
  "dishName": string,        // 1~100자, 공백만 차단(zod trim+min(1))
  "servings"?: number,       // int, 1~20, 기본 2
  "stream"?: boolean         // 기본 false. true면 SSE
}
```

요청 zod 스키마: `src/lib/validation.ts` 의 `generateRequestSchema` (인용).

```ts
// src/lib/validation.ts
generateRequestSchema = z.object({
  dishName: z.string().trim().min(1, "요리 이름을 입력하세요.").max(100),
  servings: z.number().int().min(1).max(20).optional(),
  stream: z.boolean().optional(),
})
```

### 3.2.3 응답 — 비스트리밍 (`stream` 미지정 또는 false)

- **HTTP 200**, `Content-Type: application/json`
- 본문: `{ data: GeneratedRecipe }` (`GenerateRecipeResponse` = `ApiResponse<GeneratedRecipe>`)

`GeneratedRecipe` shape (저장 전 — **id/createdAt/userId 없음**):

```ts
// src/types/recipe.ts
{
  dishName: string;
  description: string;
  servings: number;
  cookTimeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
  steps: Array<{ order: number; instruction: string }>;
  tips: string[];                  // 빈 배열 가능
  nutrition: {
    calories: number;
    carbohydrates: number;
    protein: number;
    fat: number;
    fiber: number;
    healthNote: string;
  }
}
```

### 3.2.4 응답 — 스트리밍 (`stream: true`)

- **HTTP 200**, `Content-Type: text/event-stream; charset=utf-8`
- 추가 헤더: `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`
- SSE wire 형식: `event: <type>\ndata: <JSON>\n\n` (`src/lib/sse.ts` `encodeSSE` 함수가 단일 책임)

**청크 타입** (`StreamChunk` discriminated union by `type`):

| event 라인 | data JSON | 의미 | 순서 |
|------------|-----------|------|------|
| `event: meta` | `{"type":"meta","dishName":string}` | 생성 시작 알림 | 1회 (시작) |
| `event: text` | `{"type":"text","delta":string}` | 진행 중 텍스트 델타 (UX 점진 표시용, 없을 수 있음) | 0~N회 |
| `event: recipe` | `{"type":"recipe","recipe":GeneratedRecipe}` | **최종 구조화 결과** | 1회 |
| `event: error` | `{"type":"error","error":{"code":ApiErrorCode,"message":string}}` | 생성 중 오류 (HTTP 200 + 청크) | 0~1회 |
| `event: done` | `{"type":"done"}` | 스트림 종료 | 1회 (마지막) |

**SSE wire 예시**:

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

**미니앱 소비 규칙** (08-STREAMING 챕터의 SSOT 참조 대상):

1. 청크는 `event:` + `data:` + 빈 줄로 구분된다. `data:`의 값을 `JSON.parse`하여 `StreamChunk`로 다룬다.
2. 최종 결과는 **`recipe` 청크의 `.recipe`** 다 (`text` 청크의 누적이 아님).
3. `text` 청크는 선택적이다 (Gemini는 부분 JSON, Claude는 tool 강제 모드라 비어있을 수 있음). UI 점진 표시가 필요 없으면 무시 가능.
4. **에러는 HTTP 200 + `error` 청크**다 (HTTP 상태로 분기 금지). `error` 후 항상 `done` 청크가 따라온다.
5. `done` 청크 수신 시 스트림 종료. fetch stream `reader.read()` 루프 종료.
6. 클라이언트가 도중 중단할 때는 `AbortController.abort()` (08-STREAMING).

### 3.2.5 에러 (비스트리밍)

| HTTP | code | 조건 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | `dishName` 누락/공백만/100자 초과, `servings` 범위 외, JSON 본문 파싱 실패 |
| 429 | `AI_RATE_LIMITED` | AI Provider 레이트 리밋 (재시도 후에도) |
| 500 | `INTERNAL_ERROR` | 서버 일반 오류 |
| 502 | `AI_PROVIDER_ERROR` | AI 생성 실패 (스키마 불일치·타임아웃·기타 SDK 오류) |

### 3.2.6 에러 (스트리밍)

스트리밍 모드에서는 **HTTP는 항상 200**이고, 에러는 `error` 청크로 전달된다 (계약 1.3, `src/app/api/recipes/generate/route.ts` 70~75행). HTTP 상태로 분기 시도 금지.

```
event: error
data: {"type":"error","error":{"code":"AI_PROVIDER_ERROR","message":"레시피 생성에 실패했습니다."}}

event: done
data: {"type":"done"}

```

### 3.2.7 CORS

본 엔드포인트는 공개이지만 외부 출처(미니앱)에서 호출되므로 3.1.4의 CORS 헤더가 동일하게 적용된다. 스트리밍 응답에도 `Access-Control-Allow-Origin`은 첫 헤더 블록에 포함되어야 한다.

---

## 3.3 엔드포인트 2 — `GET /api/recipes` (인증, 목록)

내 레시피 목록. 소유자 격리 (RLS + 애플리케이션 user_id 스코프 이중 방어; 미니앱 경로는 service role 우회 + 애플리케이션 스코프 단일 방어, 02-DATA-MODEL 2.3.2). 미니앱 사용 기능 (d) 목록 조회.

### 3.3.1 인증

`X-Toss-User-Id` 헤더 필수 (또는 Supabase Auth 쿠키). 없으면 401.

### 3.3.2 요청

```http
GET /api/recipes?favorite=true&page=1&pageSize=20 HTTP/1.1
X-Toss-User-Id: <getAnonymousKey() hash>
```

쿼리 파라미터:

| 파라미터 | 타입 | 기본 | 검증 |
|----------|------|------|------|
| `favorite` | `"true"` \| `"false"` | (미지정 = 전체) | `z.enum(["true","false"]).transform(v => v === "true")` — 그 외 값은 400. `z.coerce.boolean()`은 `"false"`를 true로 오인하므로 금지 (ADR-006) |
| `page` | int >= 1 | 1 | 비숫자·0·음수는 400 |
| `pageSize` | int >= 1 | 20 | 비숫자·0·음수는 400. **상한 50은 거부하지 않고 50으로 clamp**(ADR-006). `meta.pageSize`에 적용값 반환 |

요청 zod 스키마: `src/lib/validation.ts` 의 `listQuerySchema` (인용).

### 3.3.3 응답 — 200

```ts
// src/types/api.ts — RecipeListResponse = ApiListResponse<Recipe>
{
  "data": Recipe[],                            // ID·createdAt·isFavorite 포함
  "meta": { "total": number, "page": number, "pageSize": number }
}
```

`Recipe` shape = `GeneratedRecipe` + 저장 필드 (`src/types/recipe.ts`):

```ts
{
  ...GeneratedRecipe 모든 필드,    // dishName, description, ..., nutrition
  id: string;                       // uuid
  isFavorite: boolean;
  createdAt: string;                // ISO8601
  // userId는 응답에 포함하지 않음 (서버 내부 격리용, ADR-001 매핑 표)
}
```

**빈 목록은 200 + `{"data":[],"meta":{...}}`** (404 아님). 정렬: `created_at desc` (`docs/api/recipes.md` 인용).

### 3.3.4 에러

| HTTP | code | 조건 |
|------|------|------|
| 401 | `UNAUTHORIZED` | `X-Toss-User-Id` 헤더 없음 + 쿠키 세션 없음 |
| 400 | `VALIDATION_ERROR` | `page`/`pageSize` 비숫자·0·음수, `favorite` 비허용 값 |
| 503 | `DB_ERROR` | Supabase 접근 실패 |

> 상한 초과(예: `pageSize=100`)는 400이 아니라 200 + clamp(50). `meta.pageSize=50` 으로 미니앱이 적용값 확인.

### 3.3.5 CORS

3.1.4 정책 적용. preflight OPTIONS 응답 시 `Access-Control-Allow-Methods: GET, OPTIONS` 포함 (공통 핸들러).

---

## 3.4 엔드포인트 3 — `GET /api/recipes/[id]` (인증, 단건)

저장된 레시피 1건 조회. `/recipe/[id]` 딥링크·새로고침 진입을 지원 (목록 캐시 의존 제거; ADR-004). 미니앱 사용 기능 (d) 상세 진입.

### 3.4.1 인증

`X-Toss-User-Id` 헤더 필수. 없으면 401.

### 3.4.2 요청

```http
GET /api/recipes/<uuid> HTTP/1.1
X-Toss-User-Id: <getAnonymousKey() hash>
```

본문 없음. 경로 파라미터 `id`는 uuid 형식이어야 한다 (현재 코드는 형식 검증을 별도로 강제하지 않으나, 잘못된 형식이면 DB에서 빈 행 반환 → 404로 수렴; ADR-005).

> 구현 노트(후속 ADR): Postgres가 잘못된 uuid 문자열에 대해 `22P02` 오류를 throw하면 현재 코드 경로는 503 `DB_ERROR`로 가버린다. 404 수렴을 보장하려면 백엔드 후속 ADR에서 (a) 경로 파라미터 uuid zod 검증 추가 또는 (b) Repository에서 `22P02` 캐치 후 빈 결과로 정규화하는 처리를 추가한다. 본 챕터 사양은 404 수렴이며, 이 노트는 그 사양을 깨뜨리는 실제 코드 경로를 백엔드 후속 ADR에서 점검하라는 단언이다.

### 3.4.3 응답 — 200

```ts
// src/types/api.ts — GetRecipeResponse = ApiResponse<Recipe>
{ "data": Recipe }   // 목록의 Recipe와 동일 shape
```

### 3.4.4 에러

| HTTP | code | 조건 |
|------|------|------|
| 401 | `UNAUTHORIZED` | 헤더·쿠키 모두 없음 |
| 404 | `NOT_FOUND` | **없음·잘못된 id·타인 소유 모두 수렴** (ADR-005) |
| 503 | `DB_ERROR` | Supabase 접근 실패 |

> **ADR-005 소유권 정책**: RLS + user_id 스코프 하에서 타인 행은 빈 결과로 돌아와 "타인 소유(존재)"와 "없음"을 서버가 구분할 수 없고, 존재 은닉 관점에서도 404가 더 안전하다. `403 FORBIDDEN`은 이 엔드포인트에서 발생하지 않는다.
>
> 미니앱은 분기를 단순화한다: **404 = "레시피를 찾을 수 없어요" UI 통일**. baseline D7과 일치.

### 3.4.5 CORS

3.1.4 정책.

---

## 3.5 엔드포인트 4 — `POST /api/recipes` (인증, 저장)

생성된 `GeneratedRecipe`를 현재 사용자 소유로 저장. 미니앱 사용 기능 (c) 저장.

### 3.5.1 인증

`X-Toss-User-Id` 헤더 필수. 백엔드는 옵션 P 매핑을 통해 `internal_user_id`(uuid)로 변환 후 `recipes.user_id`에 저장한다 (05-AUTH 5.2).

### 3.5.2 요청

```http
POST /api/recipes HTTP/1.1
Content-Type: application/json
X-Toss-User-Id: <getAnonymousKey() hash>
```

```ts
// src/types/api.ts — SaveRecipeRequest
{ "recipe": GeneratedRecipe }   // 3.2.3의 GeneratedRecipe 전체
```

요청 zod 스키마: `src/lib/validation.ts` 의 `saveRecipeRequestSchema` — 내부적으로 `generatedRecipeSchema`(`src/lib/ai/recipe-schema.ts`)를 사용해 `dishName`, `ingredients`(≥1), `steps`(≥1), `nutrition`을 검증한다.

### 3.5.3 응답 — 201

```ts
// src/types/api.ts — SaveRecipeResponse = ApiResponse<Recipe>
{ "data": Recipe }    // id, createdAt, isFavorite=false 포함
```

### 3.5.4 에러

| HTTP | code | 조건 |
|------|------|------|
| 401 | `UNAUTHORIZED` | 헤더·쿠키 모두 없음 |
| 400 | `VALIDATION_ERROR` | JSON 본문 파싱 실패, `recipe` 스키마 위반 (`ingredients` 빈 배열·필수 필드 누락 등) |
| 503 | `DB_ERROR` | Supabase 접근 실패 |

### 3.5.5 CORS

3.1.4 정책. preflight OPTIONS 시 `Access-Control-Allow-Headers: Content-Type, X-Toss-User-Id, Accept` 포함 필수 (§3.1.4 표·05 §5.5.4와 동일).

---

## 3.6 엔드포인트 5 — `PATCH /api/recipes/[id]/favorite` (인증, 멱등)

지정 레시피의 `isFavorite`를 **목표 값으로 설정**. 토글 아님 — 동일 호출 재전송 시 결과 동일 (멱등). 미니앱 사용 기능 (e) 즐겨찾기 토글.

### 3.6.1 인증

`X-Toss-User-Id` 헤더 필수.

### 3.6.2 요청

```http
PATCH /api/recipes/<uuid>/favorite HTTP/1.1
Content-Type: application/json
X-Toss-User-Id: <getAnonymousKey() hash>
```

```ts
// src/types/api.ts — ToggleFavoriteRequest
{ "isFavorite": boolean }    // 설정할 목표 값 (토글 아님)
```

> 설계 의도 (계약 4.1): 토글 대신 목표 값 명시 → 재시도/동시성에 멱등하고 프론트 낙관적 업데이트와 일치. 미니앱이 별 아이콘을 두 번 빠르게 누르더라도 마지막 목표 값이 최종 상태가 된다.

### 3.6.3 응답 — 200

```ts
// src/types/api.ts — ToggleFavoriteResponse = ApiResponse<Recipe>
{ "data": Recipe }    // isFavorite 반영된 갱신 레시피
```

### 3.6.4 에러

| HTTP | code | 조건 |
|------|------|------|
| 401 | `UNAUTHORIZED` | 헤더·쿠키 모두 없음 |
| 400 | `VALIDATION_ERROR` | `isFavorite` 누락/비boolean, JSON 파싱 실패 |
| 404 | `NOT_FOUND` | **없음·타인 소유 수렴** (ADR-005) |
| 503 | `DB_ERROR` | Supabase 접근 실패 |

### 3.6.5 CORS

3.1.4 정책.

---

## 3.7 엔드포인트 6 — `DELETE /api/recipes/[id]` (인증)

지정 레시피 삭제. 미니앱 사용 기능 (f) 삭제.

### 3.7.1 인증

`X-Toss-User-Id` 헤더 필수.

### 3.7.2 요청

```http
DELETE /api/recipes/<uuid> HTTP/1.1
X-Toss-User-Id: <getAnonymousKey() hash>
```

본문 없음.

### 3.7.3 응답 — 200

```ts
// src/types/api.ts — DeleteRecipeResponse = ApiResponse<{ id: string }>
{ "data": { "id": string } }    // 삭제된 레시피 id (프론트 캐시 무효화용)
```

> 204 No Content 대신 200 + id 반환 (계약 5절): 응답 일관성 + 미니앱 캐시 무효화에 id 활용. 미니앱은 `data.id`로 목록 캐시에서 해당 항목을 제거한다.

### 3.7.4 에러

| HTTP | code | 조건 |
|------|------|------|
| 401 | `UNAUTHORIZED` | 헤더·쿠키 모두 없음 |
| 404 | `NOT_FOUND` | **없음·타인 소유 수렴** (ADR-005) |
| 503 | `DB_ERROR` | Supabase 접근 실패 |

> 멱등성 참고: 동일 id를 두 번 DELETE 호출하면 첫 번째는 200, 두 번째는 404. 미니앱은 404를 "이미 삭제됨"으로 처리하면 사용자 경험상 동일하다 (01-FEATURES AC3).

### 3.7.5 CORS

3.1.4 정책. preflight OPTIONS 시 `Access-Control-Allow-Methods: DELETE, OPTIONS` 포함.

---

## 3.8 엔드포인트 7 — `POST /api/recommendations` (인증, Phase 6, ADR-016)

테마(상황·날씨) 기반 요리 5개 추천. 미니앱 사용 기능 (g) 테마 추천. **본 엔드포인트의 백엔드 구현은 별 저장소 `AIReceipe`의 외부 작업** — 미니앱 측은 본 절을 SSOT로 zod 계약·api-client·UI 구현.

### 3.8.1 인증 (D47)

`X-Toss-User-Id` 헤더 필수. 401 자동 재시도 1회(05 §5.4 패턴 재사용).

### 3.8.2 요청 (D44)

```http
POST /api/recommendations HTTP/1.1
Content-Type: application/json
X-Toss-User-Id: <getAnonymousKey() hash>

{
  "theme": {
    "situation": "dinner" | "lunch" | "midnight" | "gathering" | "solo" | "special" | null,
    "weather": "hot" | "cold" | "rainy" | "sunny" | "chilly" | null
  }
}
```

**불변식:** `situation`과 `weather` 중 **최소 1개**는 non-null 필요. zod `refine`으로 검증.

| 축 | 값 | 한국어 라벨 |
|----|----|----------|
| situation | `lunch` | 점심 |
| situation | `dinner` | 저녁 |
| situation | `midnight` | 야식 |
| situation | `gathering` | 모임 |
| situation | `solo` | 혼밥 |
| situation | `special` | 특별한 날 |
| weather | `hot` | 더운 날 |
| weather | `cold` | 추운 날 |
| weather | `rainy` | 비 오는 날 |
| weather | `sunny` | 화창한 날 |
| weather | `chilly` | 쌀쌀한 날 |

### 3.8.3 응답 — 200 (D45, D46, D48)

```ts
// src/types/api.ts — RecommendationsResponse = ApiResponse<{ items, meta }>
{
  "data": {
    "items": [
      {
        "dishName": string,        // max 60
        "description": string,     // max 120
        "tags": string[]           // 각 max 16, array max 5
      }
      // ... 정확히 5개 (D46 length(5))
    ],
    "meta": {
      "theme": { situation?, weather? },   // echo
      "generatedAt": string                // ISO 8601
    }
  }
}
```

- `Content-Type: application/json` 단일 응답. 비-stream (D48).
- 이미지 URL 미포함 (D45 토큰·CDN·저작권 비용 최소).
- `items.length === 5` 강제 (D46). 위반 시 zod fail → 미니앱이 INTERNAL_ERROR로 정규화.

### 3.8.4 에러

`ApiErrorCode` 8종 카탈로그 재사용(신규 코드 없음 — `src/lib/zod/api.ts`).

| HTTP | code | 조건 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | `theme` 둘 다 null·미상 키·길이 초과 |
| 401 | `UNAUTHORIZED` | 헤더 없음 → 미니앱이 1회 자동 재시도 |
| 429 | `AI_RATE_LIMITED` | AI Provider 레이트 |
| 500 | `INTERNAL_ERROR` | 서버 측 zod 응답 검증 실패 포함 |
| 502 | `AI_PROVIDER_ERROR` | Gemini/Claude 응답 실패 |
| 503 | `DB_ERROR` | 사용자 매핑·로그 저장 실패 (선택적) |

### 3.8.5 CORS

3.1.4 정책. preflight OPTIONS 시 `Access-Control-Allow-Methods: POST, OPTIONS` 포함.

### 3.8.6 외부 작업 PENDING (ADR-016)

| 항목 | 비고 |
|------|------|
| `app/api/recommendations/route.ts` 구현 | AI 프롬프트 — Gemini/Claude 응답 zod 검증 |
| 옵션 P 인증 미들웨어 적용 | 기존 `X-Toss-User-Id` → internal uuid 매핑 재사용 |
| CORS 화이트리스트 등록 | 본 엔드포인트 추가 |
| staging·prod 배포 | 환경별 |
| 미배포 시 동작 | 미니앱은 401/404 → ApiClientError 카탈로그로 한국어 안내 |

---

## 3.9 HTTP 상태 매트릭스 (한눈)

| 엔드포인트 | 200 | 201 | 400 | 401 | 404 | 429 | 500 | 502 | 503 |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| POST /generate (json) | O | - | O | - | - | O | O | O | - |
| POST /generate (stream) | O*| - | O | - | - | -**| O | -**| - |
| GET /recipes | O | - | O | O | - | - | - | - | O |
| GET /recipes/[id] | O | - | - | O | O | - | - | - | O |
| POST /recipes | - | O | O | O | - | - | - | - | O |
| PATCH /recipes/[id]/favorite | O | - | O | O | O | - | - | - | O |
| DELETE /recipes/[id] | O | - | - | O | O | - | - | - | O |
| POST /recommendations | O | - | O | O | - | O | O | O | O |

> `*` 스트리밍은 HTTP 200 + `error` 청크로 에러 전달.  
> `**` 스트리밍 모드에서는 AI 레이트리밋/Provider 에러도 200 + `error` 청크로 변환된다 (`src/app/api/recipes/generate/route.ts` 70~75행 `toChunkError`).  
> 보호 6개 엔드포인트는 모두 `403 FORBIDDEN`을 발생시키지 않는다 (ADR-005, ApiErrorCode 예약).

---

## 3.10 미니앱 fetch 클라이언트 권장 패턴 (의사 코드)

본 챕터는 미니앱 클라이언트의 정확한 구현을 강제하지 않는다 — 권장 패턴만 제시한다 (실제 구현은 frontend의 08-STREAMING, `src/hooks/api-client.ts` 참조).

```ts
// 미니앱 측 — 의사 코드 (실제 코드는 별 저장소)
// API_BASE는 Granite plugin-env가 빌드 시점에 주입한다 (09-ENV-CONFIG §9.4.2 SSOT).
const API_BASE = import.meta.env.API_BASE_URL;
const TOSS_USER_ID = await getAnonymousKey();   // @apps-in-toss/web-framework

async function authedFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("X-Toss-User-Id", TOSS_USER_ID);
  if (init?.body) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    // 본문이 ApiError shape일 수도 있고, 네트워크 에러일 수도 있다.
    const err: ApiError = await res.json().catch(() => ({
      error: { code: "INTERNAL_ERROR", message: "네트워크 오류" }
    }));
    throw err;   // 호출부가 error.code로 분기
  }

  return res.json();    // { data, meta? }
}
```

401 자동 재시도(`getAnonymousKey()` 재발급)는 05-AUTH 5.4 참조.

---

## 3.11 경계면 불변식 (QA 체크리스트)

QA가 03 챕터를 검증할 때 적용할 단언 (계약 6절 + 미니앱 컨텍스트):

1. 모든 성공 응답은 `{ data, meta? }`로 래핑. 배열 직접 반환 없음.
2. 모든 에러는 `{ error: { code, message } }`. 미니앱은 `code`로 분기 (HTTP로 분기 금지).
3. 응답 키는 모두 camelCase. snake_case 누출 없음 (특히 `created_at`, `is_favorite`, `cook_time_minutes`).
4. 응답에 `userId` 키 없음 (ADR-001 매핑 표 — 서버 내부 격리용).
5. `GeneratedRecipe`(미저장)와 `Recipe`(저장됨, id 포함)는 다른 타입. 저장 전 화면에 `id` 접근 금지.
6. 보호 6개 엔드포인트는 `X-Toss-User-Id` 헤더 없으면 401. 공개 1개는 헤더 생략 허용.
7. 404 분기는 ADR-005 통일: 없음·잘못된 id·타인 소유 모두 동일. 미니앱 UI는 단일 경로.
8. 스트리밍 모드의 에러는 HTTP 200 + `error` 청크. HTTP 상태로 분기 금지.
9. AI tool input_schema / Gemini responseSchema / zod / `GeneratedRecipe` 타입 4자 일치 (04-AI-PROVIDER 4.5).
10. `pageSize` 상한 50 초과는 400이 아니라 clamp(50). 미니앱은 `meta.pageSize` 신뢰.
11. `favorite` 쿼리는 `"true"`/`"false"`만 허용 (그 외 400). `z.coerce.boolean()` 금지.
12. CORS 응답에 `X-Toss-User-Id` 가 `Access-Control-Allow-Headers`에 포함. preflight OPTIONS 204 반환.
13. CORS 운영 환경에서 `Access-Control-Allow-Origin: *` 미사용. 화이트리스트 echo만.
14. 멱등 보장: PATCH favorite 동일 요청 재전송 시 결과 동일.
15. DELETE 응답 본문 `{ data: { id } }` (204 아님).

---

## 3.12 SSOT 참조

| 영역 | 경로 |
|------|------|
| 응답 shape SSOT | `_workspace/01_architect_api_contract.md` |
| 타입 SSOT | `src/types/api.ts`, `src/types/recipe.ts` |
| 검증 SSOT | `src/lib/validation.ts`, `src/lib/ai/recipe-schema.ts` |
| Route 구현 | `src/app/api/recipes/route.ts`, `src/app/api/recipes/generate/route.ts`, `src/app/api/recipes/[id]/route.ts`, `src/app/api/recipes/[id]/favorite/route.ts` |
| 응답 헬퍼 | `src/lib/api-response.ts`, `src/lib/sse.ts` |
| 구현 노트 | `docs/api/recipes.md` |
| ADR | [ADR-001](../adr/ADR-001-supabase.md), [ADR-004](../adr/ADR-004-get-recipe-by-id.md), [ADR-005](../adr/ADR-005-ownership-violation-404.md), [ADR-006](../adr/ADR-006-pagesize-clamp.md), [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md) |
| 인증 흐름 디테일 | [05-AUTH.md](./05-AUTH.md) |
| AI Provider 배경 | [04-AI-PROVIDER.md](./04-AI-PROVIDER.md) |
| 스트리밍 클라이언트 | [08-STREAMING.md](./08-STREAMING.md) — frontend 담당 |

---

## 3.13 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-22 | 초기 작성 (세션 #4 Task #2) | 미니앱 6개 엔드포인트·`X-Toss-User-Id` 인증·CORS 화이트리스트·옵션 P 후속 명세 |
| 2026-05-22 | §3.4.2 잘못된 uuid 22P02 처리 노트 추가 | qa sweep 보완 2 — 404 수렴 사양과 실제 코드 경로(503) 갭 명시 |
| 2026-05-22 | §3.5.5 Allow-Headers 표기에 `Accept` 추가, §3.10 의사 코드의 baseURL을 `import.meta.env.API_BASE_URL`로 교체 | qa Task #5 종합 sweep FAIL #6-A·#6-D — 09 SSOT(`API_BASE_URL`)·§3.1.4 표(3개 헤더)와의 정합 복원 |
| 2026-05-29 | §3.8 `POST /api/recommendations` 신설 + §3.9~§3.12 renumber + §3.11.6 "5→6" 갱신 | Phase 6 — ADR-016 D44~D52 동기 + 외부 작업 PENDING 명시 |
