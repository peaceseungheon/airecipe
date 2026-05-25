# 05. 인증 — Toss 식별자 흐름·옵션 P 미들웨어·CORS·환경변수

> **이 챕터 전에 알아야 할 것**: [02-DATA-MODEL.md](./02-DATA-MODEL.md) 2.2~2.5(옵션 P 결정), [03-API-CONTRACT.md](./03-API-CONTRACT.md) 3.1.3·3.1.4(헤더·CORS), [`_workspace_appsintoss_port/01_architect_baseline.md`](../../_workspace_appsintoss_port/01_architect_baseline.md) C절.
>
> **이 챕터 완료 후 다음 챕터**: [06-UI-MAPPING.md](./06-UI-MAPPING.md) (frontend) 또는 [09-ENV-CONFIG.md](./09-ENV-CONFIG.md) (architect — 도메인 화이트리스트와 환경변수 종합).
>
> 본 챕터는 backend가 후속 ADR(예: ADR-010)에서 구현할 **인증 흐름 사양**이다. ADR-009 D4에 따라 현재 코드는 수정하지 않는다 — 본 챕터의 미들웨어·CORS 핸들러 추가는 백엔드 후속 ADR에서 한다.

---

## 5.0 이 챕터의 목적

미니앱이 백엔드의 6개 엔드포인트(03-API-CONTRACT)에 접근할 때의 **신원·권한·격리** 흐름을 단일 진실로 명세한다. 핵심 메시지 다섯 가지:

1. **신원의 원천**: `getAnonymousKey()` (`@apps-in-toss/web-framework`)가 반환하는 hash 문자열.
2. **전송 채널**: HTTPS 요청 헤더 `X-Toss-User-Id`.
3. **백엔드 처리**: 옵션 P 매핑 미들웨어가 hash → `internal_user_id`(uuid) 변환.
4. **격리**: 변환된 uuid가 기존 `recipes.user_id` 필터·RLS·Mapper 자리에 그대로 주입 → ADR-001 자산 그대로 살아남음.
5. **로그인 폼 없음**: 미니앱은 회원가입/로그인 UI를 전혀 갖지 않는다 (`getAnonymousKey()`가 자동 식별).

---

## 5.1 현재 흐름 — 웹(Supabase Auth) — 보존

미니앱 포팅의 비교 기준이다. 현재 코드는 수정하지 않으며, 웹 경로는 그대로 유지된다 (ADR-009 D4).

### 5.1.1 식별 메커니즘

- 사용자가 `/auth/login` 또는 `/auth/signup` 폼에서 이메일+패스워드로 가입·로그인.
- Supabase Auth가 세션 쿠키(sb-access-token, sb-refresh-token)를 발급.
- 매 페이지 요청마다 `proxy.ts` (`src/proxy.ts`) → `updateSession` (`src/lib/supabase/middleware.ts`)가 쿠키를 갱신·검증.
- 보호 페이지(`/my-recipes`, `/recipe/`) 진입 시 미인증이면 `/auth/login?redirectTo=...` 리다이렉트.

### 5.1.2 API 인증 (현재 운영)

- Route Handler 진입부에서 `requireUser()` (`src/lib/auth.ts`) 호출.
- `createSupabaseServerClient()` → `supabase.auth.getUser()` → user 없으면 `ServiceError("UNAUTHORIZED")` throw.
- 호출 성공 시 `user.id`(uuid)를 Service·Repository에 user_id 스코프로 전달.
- DB는 RLS `auth.uid() = user_id`로 **이중 방어** (ADR-001).

```ts
// src/lib/auth.ts (현재) — 인용
export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ServiceError("UNAUTHORIZED", "로그인이 필요합니다.");
  return { id: user.id, email: user.email ?? "" };
}
```

### 5.1.3 미니앱에서 제거되는 것

(baseline D1 / ADR-009 D2):

- `/auth/login`, `/auth/signup` 페이지
- `AuthForm` 컴포넌트
- `useAuth` 훅
- 회원가입·비밀번호 재설정 UI
- `proxy.ts`의 페이지 보호 가드 (미니앱은 Granite 라우팅 가드로 대체 — 07-ROUTING)

웹 사용자는 위 흐름을 그대로 사용한다 — 단일 백엔드가 두 경로(쿠키 세션 + 헤더)를 동시에 지원한다.

---

## 5.2 신규 흐름 — 미니앱(Toss 식별자) — 옵션 P

### 5.2.1 식별자 획득 (미니앱 측)

미니앱 진입 시점에 한 번 호출하여 hash를 메모리(또는 SecureStore)에 보관.

```ts
// 미니앱 측 — 의사 코드 (실제 SDK 메서드명은 AppsInToss MCP `search_docs "getAnonymousKey"`로 검증)
import { getAnonymousKey } from "@apps-in-toss/web-framework";

const tossUserId: string = await getAnonymousKey();
// 메모리 또는 SecureStore에 보관. 매 보호 요청에 헤더로 첨부한다.
```

특성 (ADR-009 D2·baseline B):

- 미니앱별 고유 hash 문자열. 사용자의 실명·생년월일·전화번호 등 PII 미포함.
- 비게임 미니앱 SDK 표준 (SDK 2.4.5+).
- 별도 인증 화면 없이 즉시 식별자 확보.
- 사용자에게 표시하지 않음 (hash는 사용자에게 의미 없는 값).

### 5.2.2 전송 채널 (헤더)

미니앱이 백엔드를 호출할 때 보호 5개 엔드포인트는 모두 `X-Toss-User-Id` 헤더를 포함한다 (03-API-CONTRACT 3.1.3).

```http
POST /api/recipes HTTP/1.1
Host: <api-base>
Content-Type: application/json
X-Toss-User-Id: <getAnonymousKey() hash>
```

| 엔드포인트 | 헤더 필수 여부 |
|-----------|---------------|
| `POST /api/recipes/generate` | 생략 가능 (공개) |
| `GET /api/recipes` | 필수 |
| `GET /api/recipes/[id]` | 필수 |
| `POST /api/recipes` | 필수 |
| `PATCH /api/recipes/[id]/favorite` | 필수 |
| `DELETE /api/recipes/[id]` | 필수 |

### 5.2.3 백엔드 미들웨어 — `resolveInternalUserId()` (옵션 P 핵심)

본 미들웨어는 백엔드 후속 ADR에서 추가될 모듈이다. 02-DATA-MODEL 2.3.3 의사 코드를 사양 형태로 확정한다.

#### 의사 코드 (사양)

```ts
// src/lib/auth/toss-user.ts (가칭, 후속 ADR에서 추가)
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

const HEADER_NAME = "x-toss-user-id";
const tossUserIdSchema = z.string().min(8).max(256);

/**
 * X-Toss-User-Id 헤더가 있으면 옵션 P 매핑으로 internal_user_id(uuid)를 반환.
 * 없거나 형식 위반이면 null.
 */
export async function resolveInternalUserId(req: Request): Promise<string | null> {
  const tossUserId = req.headers.get(HEADER_NAME);
  if (!tossUserId) return null;

  const parsed = tossUserIdSchema.safeParse(tossUserId);
  if (!parsed.success) return null;

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { toss_user_id: parsed.data },
      { onConflict: "toss_user_id", ignoreDuplicates: false },
    )
    .select("internal_user_id")
    .single();

  if (error) throw error;
  return data.internal_user_id;
}
```

#### 사양 항목

| 항목 | 사양 |
|------|------|
| 헤더 이름 | `X-Toss-User-Id` (Node fetch API는 헤더 키를 소문자로 정규화하므로 코드에서는 `x-toss-user-id`) |
| 값 검증 | `z.string().min(8).max(256)` — `getAnonymousKey()` hash 길이 예상 범위. 부적합 값은 미인증 처리 |
| 매핑 테이블 | `public.profiles(internal_user_id uuid PK, toss_user_id text unique)` (02-DATA-MODEL 2.3.1) |
| Supabase 클라이언트 | **service role** 클라이언트 (RLS 우회) — 02-DATA-MODEL 2.3.2 방법 A 채택 |
| Upsert 정책 | `onConflict: 'toss_user_id'`, `ignoreDuplicates: false` → 기존 행 반환 또는 신규 생성 |
| 반환 | `internal_user_id`(uuid) 또는 null (헤더 없음/형식 위반) |
| 예외 | DB 오류는 throw → Route가 `ServiceError("DB_ERROR")`로 변환 |

#### 옵션 P의 두 가지 격리 모델 — 채택은 방법 A

02-DATA-MODEL 2.3.2 의 두 옵션:

- **방법 A (채택)**: service role 클라이언트로 RLS 우회 + 애플리케이션 user_id 스코프 단일 방어.
- 방법 B: Supabase 익명 사용자 + JWT 발급 → RLS 이중 방어 유지. 가짜 이메일/익명 사용자 누적, 토큰 라이프사이클 추가 부담.

**채택: 방법 A**. 근거 (baseline B + 02-DATA-MODEL 2.3.2):

- 옵션 P의 목적은 ADR-001 자산(컬럼·외래키·인덱스·Mapper) 보존이며, RLS 격리의 본질은 이미 ADR-005에 따라 404 수렴으로 약화됐다. 방법 A의 "RLS 단일 방어"는 ADR-005 결정과 정합한다.
- 방법 B의 익명 사용자 발급은 `auth.users` 누적·토큰 라이프사이클 추가로 운영 복잡성이 커진다. YAGNI.
- **요건**: 방법 A 하에서는 모든 Route Handler가 `user_id` 스코프 필터를 빠뜨려선 안 된다 — 애플리케이션 코드가 격리의 단일 책임자. QA가 이 단언을 강제 검증한다 (02-DATA-MODEL 2.5 체크리스트).

### 5.2.4 보호 Route Handler 진입부 — 이중 경로 지원

기존 `requireUser()`는 Supabase 세션만 본다. 미니앱 포팅에서는 헤더 경로를 추가하여 **이중 경로**가 된다 (baseline C4).

#### 사양 (`requireUser()`의 확장된 동작)

후속 ADR에서 다음과 같이 변경 (현재 시그니처·반환 타입 보존):

```ts
// src/lib/auth.ts (후속 ADR에서 확장된 사양)
export async function requireUser(request?: Request): Promise<AuthedUser> {
  // 1) 웹 경로 — Supabase Auth 쿠키 세션 우선
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return { id: user.id, email: user.email ?? "" };
  }

  // 2) 미니앱 경로 — X-Toss-User-Id 헤더 (request가 전달된 경우만)
  if (request) {
    const internalUserId = await resolveInternalUserId(request);
    if (internalUserId) {
      return { id: internalUserId, email: "" };  // 미니앱은 이메일 없음
    }
  }

  // 3) 둘 다 없으면 UNAUTHORIZED
  throw new ServiceError("UNAUTHORIZED", "로그인이 필요합니다.");
}
```

**중요한 호환성 주석**:

- 반환 타입 `AuthedUser` 그대로. `user.id`(uuid)가 무엇이든 (Supabase auth.users uuid이든 profiles.internal_user_id uuid이든) Service·Repository·Mapper는 동일하게 사용 → **Repository·Service·Mapper 무변경** (02-DATA-MODEL 2.3.3 인용).
- 미니앱은 사용자 이메일을 모르므로 `email: ""`. 응답 DTO는 `userId`·`email`을 노출하지 않으므로 (ADR-001 매핑 표) UI에 새지 않는다.
- 우선순위: 쿠키 세션이 헤더보다 우선. 동일 사용자가 웹/미니앱을 같은 디바이스에서 동시 사용하더라도(가능성 낮음), 세션이 있으면 그쪽을 신뢰 — 이는 단순성을 위한 선택이며 미니앱 단독 사용에서는 영향 없음.
- Route Handler 시그니처: 현재 `requireUser()`는 인자 없는 형태. 후속 ADR에서 `request: NextRequest` 전달로 시그니처 변경 필요. 모든 호출부 (`src/app/api/recipes/*.ts`)에서 `request` 전달.

#### 보호 Route Handler 패턴 (사양)

```ts
// 예: src/app/api/recipes/route.ts (후속 ADR 적용 후)
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);   // ← request 전달 추가
    /* ... 기존 코드 그대로 ... */
  } catch (err) {
    return failFromError(err);
  }
}
```

### 5.2.5 흐름 다이어그램

```
미니앱 (RN + Granite)
   │
   │ ① getAnonymousKey() → hash 보관
   │
   │ ② 보호 API 호출
   │    Headers: X-Toss-User-Id: <hash>
   ▼
백엔드 Route Handler (src/app/api/recipes/**)
   │
   │ ③ requireUser(request)
   │      ├─ 쿠키 세션? (웹 경로)
   │      └─ X-Toss-User-Id 헤더? (미니앱 경로)
   ▼
resolveInternalUserId(req)  ──┐
   │                          │
   │ ④ zod 검증 (8~256자)     │
   │                          │
   │ ⑤ profiles.upsert        │
   │    (service role client) │
   ▼                          │
 internal_user_id (uuid)      │
   │                          │
   └──────────────────────────┘
   │
   │ ⑥ user.id = internal_user_id
   ▼
Service·Repository·Mapper (무변경 — ADR-001 자산 보존)
   │
   │ ⑦ DB 쿼리: WHERE user_id = $1 (애플리케이션 스코프)
   ▼
Supabase Postgres (service role 우회, RLS 미적용)
   │
   ▼
응답: { data, meta? } (camelCase, ADR-001 Mapper)
```

---

## 5.3 보호 5개 엔드포인트별 동작 요약

| 엔드포인트 | 헤더 없음 | 헤더 있음 (옵션 P) | 쿠키 세션 있음 (웹) |
|-----------|----------|---------------------|---------------------|
| `GET /api/recipes` | 401 | profiles upsert → internal_uuid → 본인 목록 200 | Supabase user.id → 본인 목록 200 |
| `GET /api/recipes/[id]` | 401 | 본인 것이면 200, 없음/타인 404 | 동일 |
| `POST /api/recipes` | 401 | profiles upsert → internal_uuid → 저장 201 | Supabase user.id → 저장 201 |
| `PATCH /api/recipes/[id]/favorite` | 401 | 본인 것이면 200, 없음/타인 404 | 동일 |
| `DELETE /api/recipes/[id]` | 401 | 본인 것이면 200, 없음/타인 404 | 동일 |

공개 1개:

| 엔드포인트 | 헤더 없음 | 헤더 있음 |
|-----------|----------|----------|
| `POST /api/recipes/generate` | 200 (생성, 비저장) | 200 (헤더 무시 — 저장하지 않으므로 식별자 불필요) |

> generate 엔드포인트는 헤더가 있어도 옵션 P upsert를 수행하지 않는다 — 저장하지 않는 경로에 매핑 행을 만드는 것은 노이즈를 키운다. 매핑 행 생성은 첫 보호 호출(`GET /api/recipes` 진입 또는 `POST /api/recipes` 저장) 시점에서만 일어난다.

---

## 5.4 401 응답 처리 (미니앱 측 권장 패턴)

미니앱은 401 응답을 받으면 다음 순서로 처리한다:

1. **식별자 재발급**: `getAnonymousKey()`를 다시 호출하여 hash 보관 갱신.
2. **1회 재시도**: 동일 요청을 새 헤더와 함께 1회 재시도.
3. **재시도 실패 시**: 에러 토스트("일시적으로 식별에 실패했어요. 잠시 후 다시 시도해 주세요").

```ts
// 미니앱 측 — 의사 코드 (api-client 안에서 401 인터셉트)
async function authedFetch(path: string, init?: RequestInit, retry = true) {
  const headers = new Headers(init?.headers);
  headers.set("X-Toss-User-Id", await getTossUserId());   // 캐시된 hash
  const res = await fetch(API_BASE + path, { ...init, headers });

  if (res.status === 401 && retry) {
    // 헤더 갱신 후 1회 재시도 (무한 루프 방지: retry=false)
    await refreshTossUserId();   // getAnonymousKey() 재호출
    return authedFetch(path, init, false);
  }
  if (!res.ok) throw (await res.json().catch(() => /* 기본 ApiError */));
  return res.json();
}
```

**경계 조건**:

- 401 재시도 후에도 실패하면 그대로 사용자에게 에러 노출.
- 동일 호출에서 401 → 재시도 → 401 → 무한 루프 방지: 재시도 플래그(`retry`) 한 번만 사용.
- 비로그인 생성(`POST /generate` 공개)에서는 401이 발생하지 않으므로 인터셉트 미적용.

---

## 5.5 CORS 정책 — 상세 (03-API-CONTRACT 3.1.4 인용·확장)

03-API-CONTRACT 3.1.4에서 결정된 CORS 정책의 인증 측면 디테일을 본 챕터에서 마무리한다.

### 5.5.1 운영 환경 — 화이트리스트 echo

- 환경변수 `APPSINTOSS_ALLOWED_ORIGINS` (콤마 구분 출처 목록) 정의 — 09-ENV-CONFIG.
- 요청 `Origin` 헤더 값이 화이트리스트에 있으면 `Access-Control-Allow-Origin`에 그 값을 echo.
- 화이트리스트에 없으면 CORS 헤더를 응답하지 않음 → 브라우저/RN 측에서 차단.

**실제 도메인 형태** (검증 필요 — 09-ENV-CONFIG 작성 시 architect가 AppsInToss MCP `search_docs "도메인 화이트리스트"`로 확정):

- 운영: `https://<appName>.tossmini.toss.im` (또는 토스 공식 미니앱 호스팅 도메인)
- 스테이징: 별 도메인 (운영 도메인과 분리)

### 5.5.2 개발 환경 — `NODE_ENV !== "production"` 만 와일드카드 허용

로컬 RN dev 서버는 `Origin`이 동적이거나 무출처일 수 있다. 백엔드는 `NODE_ENV !== "production"`인 경우에만 `Access-Control-Allow-Origin: *`를 반환.

```ts
// 백엔드 후속 ADR에서 추가될 CORS 헬퍼 (사양)
function buildCorsHeaders(origin: string | null): Headers {
  const h = new Headers();
  const isProd = process.env.NODE_ENV === "production";
  const whitelist = (process.env.APPSINTOSS_ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);

  if (!isProd) {
    h.set("Access-Control-Allow-Origin", "*");
  } else if (origin && whitelist.includes(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Vary", "Origin");
  } else {
    // 헤더 없음 → 브라우저가 차단
  }
  h.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, X-Toss-User-Id, Accept");
  h.set("Access-Control-Max-Age", "600");
  return h;
}
```

### 5.5.3 자격증명 헤더 정책

| 호출 출처 | `Access-Control-Allow-Credentials` | 비고 |
|----------|-----------------------------------|------|
| 미니앱 출처 (헤더 인증) | 미설정 또는 `false` | 쿠키 미전송. `*` 와 `true`는 공존 불가능, 단 미니앱은 `*`도 헤더 인증에 쓰지 않음 |
| 웹 도메인 (쿠키 세션) | `true` + 명시적 Origin echo | 쿠키 전송 필요. 화이트리스트에 운영 웹 도메인 포함 |

이중 모드를 한 백엔드가 지원하므로, 응답 헤더 생성 시 출처 매트릭스에 따라 분기한다 (운영 단일 백엔드, 두 클라이언트).

### 5.5.4 Preflight (OPTIONS) 핸들러

`X-Toss-User-Id`는 표준 헤더가 아니므로 브라우저/일부 RN 환경에서 보호 엔드포인트 호출 시 preflight `OPTIONS`를 발생시킨다.

**사양**: 6개 엔드포인트 각 경로(또는 공통 OPTIONS 핸들러)가 다음을 응답.

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: <echo or *>
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Toss-User-Id, Accept
Access-Control-Max-Age: 600
Vary: Origin
```

구현 방법 (백엔드 후속 ADR에서 선택):

- **방법 1**: 각 `route.ts` 에 `export async function OPTIONS()` 추가. 명시적이지만 보일러플레이트.
- **방법 2**: `proxy.ts` 또는 별도 미들웨어에서 OPTIONS 요청을 가로채 공통 처리. 단일 진실. 권장.

### 5.5.5 스트리밍 응답과 CORS

`POST /api/recipes/generate` 의 SSE 응답은 첫 헤더 블록에 `Access-Control-Allow-Origin`이 포함되어야 한다. 이후 청크는 일반 SSE wire 형식이며 추가 CORS 헤더는 필요 없음.

---

## 5.6 환경변수 매트릭스 (백엔드)

본 챕터에서 새로 도입되는 환경변수와 기존 변수를 종합 (09-ENV-CONFIG가 최종 SSOT, 본 표는 인증 측면 발췌).

| 변수 | 용도 | 기본값 | 필수 |
|------|------|--------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | 옵션 P 매핑 upsert·service role 우회 호출용. **백엔드 전용**, 절대 클라이언트 노출 금지 | (없음) | 필수 (미니앱 경로 활성화 시) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | (없음) | 필수 (기존) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (웹 쿠키 세션 갱신용) | (없음) | 필수 (기존) |
| `APPSINTOSS_ALLOWED_ORIGINS` | CORS 화이트리스트 (콤마 구분 출처) | (없음) | 필수 (운영). 미설정 시 운영에서 CORS 차단 |
| `NODE_ENV` | 런타임 환경 (`production`/`development`/`test`) | (Vercel 자동 설정) | (필수) |

**미니앱 환경변수에는 위 백엔드 변수 일절 포함하지 않는다** (04-AI-PROVIDER 4.8 키 격리 원칙). 미니앱 환경변수는 09-ENV-CONFIG에서 별도 명세.

### Toss 인증 측 환경변수 (백엔드 후속 ADR 검증 항목)

미니앱 측 `getAnonymousKey()` SDK 메서드 외에, **백엔드 측에서 Toss 토큰을 검증해야 하는 경우**가 있는지는 AppsInToss MCP `search_docs "인증"` 으로 architect가 검증한다.

현재 baseline B의 결정은 "`getAnonymousKey()` hash를 그대로 헤더로 받아 사용"이며, 별도 토큰 검증을 백엔드에서 수행하지 않는다 (hash 자체가 식별자). 따라서 본 챕터 사양에는 `TOSS_AUTH_SECRET` 등 검증 키를 **포함하지 않는다**.

> **검증 요청**: 본 결정은 baseline에 명시되어 있다. 그러나 출시 정책 또는 인증 정책이 hash 그대로 사용을 허용하지 않는다면 architect가 추가 결정(ADR-010 등)으로 변경해야 한다. 본 챕터는 그 시점에 별도 환경변수(`TOSS_AUTH_PUBLIC_KEY` 등)와 검증 미들웨어를 추가하는 형태로 갱신될 수 있다.

---

## 5.7 RLS 정책 — 본 챕터의 사양 결정 (방법 A 기반)

옵션 P 방법 A 채택에 따른 RLS 정책:

### 5.7.1 `public.recipes` (기존)

```sql
-- 그대로 유지 (ADR-001).
alter table public.recipes enable row level security;
create policy "owner_select" on public.recipes for select using (auth.uid() = user_id);
create policy "owner_insert" on public.recipes for insert with check (auth.uid() = user_id);
create policy "owner_update" on public.recipes for update using (auth.uid() = user_id);
create policy "owner_delete" on public.recipes for delete using (auth.uid() = user_id);
```

- **웹 경로**: 쿠키 세션 → `auth.uid()` non-NULL → RLS 통과.
- **미니앱 경로**: service role 우회 → RLS 무시 → **애플리케이션 user_id 스코프가 단일 격리 책임** (02-DATA-MODEL 2.3.2 방법 A).

### 5.7.2 `public.profiles` (신규)

```sql
-- 후속 마이그레이션 (백엔드 후속 ADR)
create table if not exists public.profiles (
  internal_user_id  uuid primary key default gen_random_uuid(),
  toss_user_id      text unique not null,
  created_at        timestamptz not null default now()
);
create index if not exists profiles_toss_user_id_idx on public.profiles(toss_user_id);

alter table public.profiles enable row level security;

-- 모든 클라이언트(anon/authenticated) 접근 거부.
-- service role만 우회. 미니앱·웹 사용자는 절대 직접 SELECT/INSERT 하지 않음.
create policy "deny_all_select_profiles" on public.profiles for select using (false);
create policy "deny_all_insert_profiles" on public.profiles for insert with check (false);
create policy "deny_all_update_profiles" on public.profiles for update using (false);
create policy "deny_all_delete_profiles" on public.profiles for delete using (false);
```

(02-DATA-MODEL 2.3.1 인용)

### 5.7.3 QA 단언 (02-DATA-MODEL 2.5 인용)

| 단언 | 검증 방법 |
|------|----------|
| 두 명의 서로 다른 Toss 식별자로 동일 API 호출 시 데이터가 섞이지 않음 | 통합 테스트 — `X-Toss-User-Id: A` 로 저장 후 `X-Toss-User-Id: B`로 목록 호출 시 빈 결과 |
| 미니앱 경로에서 `recipes` 쿼리에 user_id 필터가 누락된 호출이 있으면 데이터 격리 깨짐 | 코드 리뷰 + Repository 단언 (모든 쿼리에 `user_id` 스코프 명시) |
| `profiles` 테이블을 anon/authenticated 클라이언트가 직접 조회 불가 | RLS 정책 통합 테스트 (anon 키로 SELECT 시 빈 결과) |
| `X-Toss-User-Id` 헤더 없이 보호 엔드포인트 호출 시 401 | E2E 테스트 |
| 헤더 형식 위반(7자 미만 등)도 401 | E2E 테스트 |
| 본인 것 아닌 id 조회·삭제·즐겨찾기 시 404 (403 아님; ADR-005) | E2E 테스트 |

---

## 5.8 출시 정책 검증 항목 (architect 위임)

본 챕터의 인증 흐름은 **토스 미니앱 출시 정책에 부합해야 한다**. baseline 또는 09-ENV-CONFIG 작성 시 architect가 AppsInToss MCP로 다음 항목을 검증한다 — 본 챕터는 검증 결과에 따라 갱신될 수 있다.

| 검증 항목 | MCP 쿼리 권장 키워드 |
|----------|---------------------|
| `getAnonymousKey()` 사용 가능 여부 (비게임 미니앱 한정) | `"getAnonymousKey"`, `"사용자 식별"` |
| hash를 백엔드에 헤더로 전송하는 패턴의 정책 허용 여부 | `"인증"`, `"userId"`, `"토큰"` |
| 백엔드 도메인 화이트리스트 등록 요구 사항 | `"도메인 화이트리스트"`, `"외부 도메인"` |
| 출시 심사 시 인증·식별 측 점검 항목 | `"출시 정책"`, `"인증 정책"` |
| CORS·외부 API 호출 보안 가이드 | `"CORS"`, `"보안"`, `"네트워크"` |

> 검증 결과 hash 단독 헤더 전달이 허용되지 않으면, 별도 토큰 검증(예: Toss 발급 서명) 미들웨어 추가 필요. 그 경우 본 챕터 5.2.3을 갱신.

---

## 5.9 백엔드 변경 사항 요약 (백엔드 후속 ADR 체크리스트)

본 챕터를 구현하기 위해 백엔드가 후속 ADR(예: ADR-010 — 옵션 P 마이그레이션)에서 처리할 작업 목록:

- [ ] `supabase/migrations/{timestamp}_add_profiles.sql` 추가 (5.7.2 SQL).
- [ ] `src/lib/auth/toss-user.ts` 추가 — `resolveInternalUserId()`.
- [ ] `src/lib/supabase/server.ts` 또는 신규 모듈에 `createServiceRoleClient()` 추가 (이미 있다면 재사용).
- [ ] `src/lib/auth.ts` `requireUser()` 확장 — `request` 인자 + 이중 경로 (5.2.4).
- [ ] 모든 보호 Route Handler에서 `requireUser(request)` 로 호출 시그니처 변경 (`src/app/api/recipes/route.ts`, `[id]/route.ts`, `[id]/favorite/route.ts`).
- [ ] CORS 헬퍼 추가 (5.5.2 의사 코드) + 각 Route(또는 `proxy.ts` 미들웨어)에서 응답에 헤더 부착.
- [ ] **SSE 응답 헤더에도 CORS 포함** — `src/app/api/recipes/generate/route.ts:80-87` 의 스트리밍 `Response` 초기화 시 `Content-Type/Cache-Control/Connection` 옆에 `Access-Control-Allow-Origin`(+ `Vary: Origin`)을 함께 부착. 비스트리밍 경로의 CORS 헬퍼와 동일 분기 로직을 재사용해 일관성을 유지한다 (03 §3.2.7 / 05 §5.5.5 사양의 실제 코드 반영).
- [ ] OPTIONS preflight 핸들러 (5.5.4 방법 1 또는 2).
- [ ] `proxy.ts` matcher 검토: 보호 API에 OPTIONS가 진입할 수 있도록 (현재 matcher는 정적 자산만 제외하므로 영향 없을 가능성 높음 — 확인 필요).
- [ ] 환경변수 `SUPABASE_SERVICE_ROLE_KEY`, `APPSINTOSS_ALLOWED_ORIGINS` Vercel 등록.
- [ ] 통합 테스트 추가 (5.7.3 QA 단언).

> 본 챕터는 사양이며, 위 작업은 ADR-010(가칭)에서 별 PR로 묶어 진행한다 — 본 포팅 작업(세션 #4)의 산출물 범위는 **문서만**이다 (ADR-009 D4).

---

## 5.10 미니앱이 이 챕터에서 가져갈 것 (요약 한 화면)

| 항목 | 결론 |
|------|------|
| 로그인/회원가입 화면 만드나? | **아니오** (`getAnonymousKey()` 자동 식별). |
| 식별자는 어디서 얻나? | `@apps-in-toss/web-framework`의 `getAnonymousKey()` (진입 시 1회 + 401 시 재발급). |
| 어디에 보관하나? | 메모리 (또는 SecureStore — 토스 미니앱 환경에서 보안 저장소 가용 여부는 frontend가 검증). |
| 어떻게 보내나? | 보호 5개 엔드포인트 모두 `X-Toss-User-Id: <hash>` 헤더. |
| 공개 엔드포인트는? | `POST /api/recipes/generate`는 헤더 생략 가능 (보내도 무시됨). |
| 401 받으면? | `getAnonymousKey()` 재호출 → 1회 재시도 → 그래도 실패면 토스트. |
| 404 받으면? | "레시피를 찾을 수 없어요" UI (없음·잘못된 id·타인 소유 모두 동일; ADR-005). |
| 백엔드의 매핑·service role·RLS는 알아야 하나? | **아니오**. 백엔드 내부. 미니앱은 헤더만 정확히 보내면 된다. |
| 사용자에게 hash를 표시하나? | **아니오** (의미 없는 값). |

---

## 5.11 SSOT 참조

| 영역 | 경로 |
|------|------|
| 현재 인증 헬퍼 | `src/lib/auth.ts` |
| 현재 Supabase 클라이언트 | `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts` |
| 현재 proxy | `src/proxy.ts` |
| DB 스키마 | `supabase/schema.sql` (현재) + 후속 `supabase/migrations/*_add_profiles.sql` |
| ADR | [ADR-001](../adr/ADR-001-supabase.md) (RLS), [ADR-005](../adr/ADR-005-ownership-violation-404.md) (404 수렴), [ADR-007](../adr/ADR-007-proxy-file-convention.md) (proxy 컨벤션), [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md) (포팅 아키텍처, D2/D5), 후속 ADR-010 (가칭, 옵션 P 마이그레이션) |
| baseline | [`_workspace_appsintoss_port/01_architect_baseline.md`](../../_workspace_appsintoss_port/01_architect_baseline.md) C절 |
| 데이터 모델 | [02-DATA-MODEL.md](./02-DATA-MODEL.md) 2.3절 |
| API 헤더·CORS 계약 | [03-API-CONTRACT.md](./03-API-CONTRACT.md) 3.1.3·3.1.4 |
| 환경변수 종합 | [09-ENV-CONFIG.md](./09-ENV-CONFIG.md) (architect 작성 예정) |

---

## 5.12 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-22 | 초기 작성 (세션 #4 Task #2) | 미니앱 Toss 식별자 흐름·옵션 P 미들웨어·CORS 자격증명 매트릭스·백엔드 후속 ADR 체크리스트 명세 |
| 2026-05-22 | §5.9 체크리스트에 SSE CORS 누락 방지 항목 추가 | qa sweep 보완 1 — `generate/route.ts:80-87` SSE 응답 헤더에 CORS 부착 후속 ADR 명시 |
