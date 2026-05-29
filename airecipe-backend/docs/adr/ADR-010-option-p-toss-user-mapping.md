# 0010. 옵션 P 채택 — `profiles` 매핑 테이블 + 인증 경로 병존(쿠키+헤더)

- 상태: 채택됨
- 날짜: 2026-05-24
- 적용 대상: 본 저장소(AIReceipe) — 백엔드 구현 + 미니앱 호출 가능 양 저장소 영향
- 사전 결정: ADR-009 D5(옵션 P 채택 선언) — 본 ADR이 구체 실행안

> **번호 시퀀스 명시:** 미니앱 저장소(`airecipe-miniapp`)의 ADR-010과 본 저장소(`AIReceipe`)의 ADR-010은 **별 시퀀스**다. 의미가 다를 수 있다. 본 ADR은 본 저장소의 ADR 시퀀스(ADR-001~009)의 후속이다.

---

## 맥락

세션 #4에서 ADR-009로 앱인토스 미니앱 포팅 아키텍처를 확정했고 D5에서 **옵션 P**(profiles 매핑 테이블)를 채택한 바 있다. ADR-009는 미니앱 측 사양만 다뤘고 백엔드 구현 변경은 후속 ADR로 미뤘다. 본 ADR이 그 후속이다.

핵심 결정해야 할 사항:

1. `profiles` 테이블의 정확한 스키마.
2. 기존 `recipes.user_id`의 외래키(`auth.users(id)`)를 어떻게 처리할 것인가 — 미니앱 사용자는 `auth.users`에 행이 없는데 같은 컬럼에 매핑되어야 한다.
3. Supabase Auth 쿠키(웹앱)와 `X-Toss-User-Id` 헤더(미니앱) 두 인증 경로를 어떻게 병존시킬 것인가. 분기·우선순위·RLS 정책은?
4. RLS 정책(`auth.uid() = user_id`)이 헤더 경로에서는 `auth.uid()`가 NULL이라 모두 차단된다. 어떻게 우회할 것인가?

제약:

- **기존 웹앱 동작 손상 없음** — Supabase Auth + 쿠키 + RLS는 그대로 살아남아야 한다.
- ADR-001의 데이터 모델(`recipes.user_id` uuid)·Mapper·RLS는 보존한다(ADR-009 D5).
- ADR-005의 소유권 위반 404 수렴 정책은 미니앱에도 동일하게 적용된다.
- 응답 shape 변경 금지(03-API-CONTRACT 그대로).
- 미니앱 저장소는 일절 수정하지 않는다(동기화 안내만).

---

## 결정

> **구현 단계 추가 결정 (2026-05-25, backend Task #2/#3 보강):**
> - **D7. Composition Root는 `getRecipeService(source: AuthSource)` 형태로 분기** — 설계 §4 옵션 C(client 주입)의 변형. Route는 `requireUser(req)` 반환의 `source`만 composition에 넘기고, composition이 `cookie` → 쿠키 클라이언트, `header` → service-role 클라이언트를 선택한다. Repository(`SupabaseRecipeRepository`)는 모든 메서드에 `.eq('user_id', userId)` 필터를 이미 부착하고 있어 RLS 우회 시에도 격리가 보장된다.
> - **D8. `POST /api/recipes/generate`는 비인증 공개 엔드포인트로 유지** — 본래 비로그인 미리보기 흐름을 지원하던 공개 엔드포인트이며, `requireUser` 강제 시 웹앱 회귀(401)와 미니앱 흐름 단절을 유발해 제약 1(웹앱 동작 손상 없음)을 위반한다. 따라서 generate는 인증 호출 없이 **CORS + OPTIONS만** 부착하고, 미니앱도 `X-Toss-User-Id` 헤더 없이 호출 가능하다. (D3 "6개 핸들러 모두 적용"의 예외 — generate 단 1건.) 이로써 결과적으로 5개 핸들러(목록·저장·단건·삭제·즐겨찾기)에 `requireUser(req)`가 적용되고, generate는 CORS만 적용된다.

### D1. `profiles` 테이블 — 미니앱 사용자 매핑

```sql
create table if not exists public.profiles (
  internal_user_id uuid primary key default gen_random_uuid(),
  toss_user_id     text unique not null,
  created_at       timestamptz not null default now()
);

create index if not exists profiles_toss_user_id_idx on public.profiles(toss_user_id);
```

- `internal_user_id`: 백엔드 내부 식별자(uuid). `recipes.user_id`와 같은 도메인 값.
- `toss_user_id`: Toss `getAnonymousKey()` 반환 hex hash(평문). UNIQUE.
- 신규 미니앱 사용자 첫 호출 시 `resolveInternalUserId(tossUserIdHash)`가 upsert로 행을 생성하고 internal_user_id를 반환한다.

### D2. **`recipes.user_id` FK 처리 — (a) FK 제거**

세 가지 대안을 검토하여 **(a) FK 제거 + 컬럼·인덱스 유지**를 채택한다.

| 대안 | 설명 | 평가 |
|------|------|------|
| **(a) FK 제거** | `references auth.users(id) on delete cascade` 제약을 drop. 컬럼 타입 uuid 유지. | **채택** |
| (b) FK를 `profiles(internal_user_id)`로 변경 | 웹앱 가입 시 `profiles`에 동기 행을 자동 생성하도록 트리거 또는 코드 추가. | 기각 — 웹앱 흐름 침범 |
| (c) FK `auth.users(id)` 유지 | 미니앱 사용자가 `auth.users`에 없으므로 INSERT 실패. service-role로도 우회 불가(제약 자체가 막음). | 기각 — 작동 불가 |

**(a) FK 제거 채택 이유:**

- 한 컬럼(`recipes.user_id`)에 두 출처의 uuid가 공존해야 한다 — 웹앱은 `auth.users.id`, 미니앱은 `profiles.internal_user_id`. FK는 한 테이블만 가리킬 수 있어 두 출처를 모두 표현 불가.
- (b)는 웹앱 회원가입 흐름에 트리거·동기 코드를 추가해야 해서 ADR-001/웹앱 사용자에 미치는 영향이 크다. "웹앱 동작 손상 없음" 제약 위반 위험.
- FK 제거 시 잃는 것은 **cascade delete**(auth.users 삭제 시 recipes 자동 삭제)뿐이다. 현재 Sprint 1에서 사용자 삭제 흐름은 구현되어 있지 않고, 향후 도입 시 service-role 클라이언트 + 애플리케이션 코드(`deleteUserCascade(internalUserId)`)로 대체할 수 있다.
- 일관성은 **애플리케이션 레이어 + service-role**에서 보장한다: `requireUser()`가 항상 유효한 internal_user_id만 반환하고, repository는 그 값을 `user_id`에 INSERT한다.

마이그레이션 단편:

```sql
-- 0002_profiles_toss_mapping.sql
alter table public.recipes drop constraint if exists recipes_user_id_fkey;
-- (cascade delete는 더 이상 자동 작동하지 않음 — ADR-010 D2 트레이드오프)
```

### D3. 인증 경로 병존 전략 — 헤더 우선 · 쿠키 fallback · `requireUser(request)` 단일 추상

> **적용 범위 (D8 보강):** 보호 라우트 5개(GET/POST `/api/recipes`, GET/DELETE `/api/recipes/[id]`, PATCH `/api/recipes/[id]/favorite`). `POST /api/recipes/generate`는 비인증 유지(D8) — `requireUser` 호출 없음.

`src/lib/auth/require-user.ts`(신규)가 두 경로를 분기하는 단일 진입점이다. 기존 `src/lib/auth.ts`의 `requireUser()`(인자 없음)는 deprecated하고 내부적으로 신 API를 호출하도록 위임한다(웹앱 무수정 보장).

분기 규칙:

1. `request.headers.get('x-toss-user-id')`가 존재하고 비어있지 않다면:
   - `resolveInternalUserId(hash)`를 호출하여 internal_user_id를 upsert·조회.
   - 반환: `{ internalUserId, source: 'header' }`
2. 헤더가 없다면 기존 경로:
   - `createSupabaseServerClient().auth.getUser()` → user 객체.
   - 반환: `{ internalUserId: user.id, source: 'cookie' }`
3. 둘 다 실패 시 `ServiceError('UNAUTHORIZED')`.

**왜 헤더 우선?** 미니앱은 Granite WebView 또는 RN fetch로 호출하므로 Supabase Auth 쿠키가 전달될 수 없거나 무관한 값일 수 있다. 헤더가 있다는 것은 명시적인 미니앱 호출이므로 즉시 미니앱 경로로 분기한다.

### D4. RLS 우회 전략 — 헤더 경로는 service-role + 애플리케이션 격리

웹앱(쿠키 경로):
- 기존 그대로 — `createSupabaseServerClient()`로 anon key + 쿠키 세션. RLS 정책 `auth.uid() = user_id`가 격리 강제.

미니앱(헤더 경로):
- `auth.uid()`가 NULL이므로 기존 RLS 정책이 **모든 행을 차단**한다.
- **service-role 클라이언트**(`createSupabaseServiceRoleClient()`, 신규)를 사용해 RLS를 우회한다.
- 격리는 **애플리케이션 레이어**에서 강제: repository가 항상 `.eq('user_id', internalUserId)` 필터를 명시적으로 부착하고, repository 계약을 통과하지 않은 임의 쿼리를 금지한다(ADR-001의 "이중 방어"가 미니앱 경로에서는 "단일 방어"로 약화됨 — 트레이드오프).
- ADR-005(소유권 위반 404 수렴)는 그대로 적용: service-role 쿼리도 `.eq('user_id', internalUserId)` 필터로 타인 행이 0건 반환되도록 한다 — RLS가 아닌 애플리케이션 필터가 같은 효과를 낸다.

**트레이드오프(보안 약화):**
- 미니앱 경로는 RLS 우회로 인해 애플리케이션 버그(필터 누락) 시 즉시 데이터 누출 가능. 코드 리뷰·QA로 보강(QA Task #5에서 명시적으로 검증).
- 미니앱용 별도 RLS 정책(`profiles` 매핑 + JWT custom claim)을 두는 대안도 있으나 Sprint 1 범위 초과. Sprint 2 이상에서 재검토.

### D5. CORS 정책 — 모든 보호 라우트에 OPTIONS + 헤더 화이트리스트

- 환경변수 `APPSINTOSS_ALLOWED_ORIGINS`(콤마 구분)로 origin 화이트리스트 관리.
- 모든 라우트(`route.ts` 4개 파일, 6개 핸들러 — 인증·비인증 무관)에 `OPTIONS` export 추가. CORS는 인증과 독립적인 cross-origin 정책이므로 generate(비인증)에도 동일 적용.
- 응답 헤더(미니앱 측 09-ENV-CONFIG §9.3.1과 일치):
  - `Access-Control-Allow-Origin`: 요청 origin이 화이트리스트에 있으면 echo, 아니면 미부착.
  - `Access-Control-Allow-Headers: Content-Type, X-Toss-User-Id, Accept`
  - `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
  - `Access-Control-Max-Age: 600`
  - `Access-Control-Allow-Credentials: false` — 쿠키 경로(웹앱)는 same-origin이므로 CORS 무관. credentials 허용 시 origin echo 시 보안 리스크.
- `withCors(response, request)` 헬퍼가 정상 응답에 헤더를 부착하고, `corsPreflightResponse(request)`가 OPTIONS 응답을 생성한다.
- SSE 라우트(`generate/route.ts`)는 streaming `Response`이므로 init.headers에 CORS 헤더를 직접 부착(`withCors` 적용 불가).

### D6. Toss userId 신뢰 모델

- `X-Toss-User-Id` 헤더 값(평문 hex hash)을 백엔드는 **신뢰**한다. JWT 서명 검증·복호화 없음.
- 위협 모델: 누군가 다른 사용자의 hash를 알아내면 그 사용자로 가장 가능. 그러나 `getAnonymousKey()`는 미니앱 SDK 내부 hash이므로 외부 노출 채널이 매우 제한적이다(앱 내부 메모리). Sprint 1 미니앱 도메인에서는 수용 가능한 리스크.
- 강화 옵션(Sprint 2 검토): Toss 측 서명 토큰 도입, 또는 백엔드에서 nonce/timestamp 검증.

---

## 근거

- **(a) FK 제거 선택**: 두 출처의 uuid를 한 컬럼에 담아야 하는 본질적 제약 + 웹앱 무영향 우선. cascade delete 손실은 Sprint 1 영향 0.
- **헤더 우선 · 쿠키 fallback**: 명시적 호출(헤더)이 묵시적 세션(쿠키)보다 우선해야 미니앱이 의도대로 식별된다. 쿠키가 의도치 않게 전달되어도(예: 같은 도메인 웹뷰) 헤더가 있으면 미니앱으로 처리.
- **service-role 격리**: ADR-001의 RLS 이중 방어가 미니앱 경로에서는 단일 방어로 약화되지만, 애플리케이션 필터가 ADR-005의 404 수렴을 그대로 보장한다. 이 트레이드오프를 명시함으로써 QA·코드 리뷰에 책임 지점을 명확히 한다.
- **`requireUser(request)` 단일 추상**: Route Handler 입장에서 두 경로 분기는 보이지 않는다. 향후 인증 경로가 추가되어도(예: 토스 로그인) 본 함수만 확장한다 — OCP.

---

## 대안

### A1. 옵션 Q (recipes.user_id를 text로 마이그레이션)
ADR-009 D5에서 이미 기각. RLS·인덱스·Mapper·계약을 전부 갈아엎어야 함.

### A2. (b) FK를 profiles(internal_user_id)로 변경
웹앱 회원가입에 동기 코드 추가 필요 → 웹앱 무영향 제약 위반. 기각.

### A3. (c) FK 유지 + 미니앱 사용자에게 가짜 `auth.users` 행 생성
service-role로 `auth.users`에 임의 행을 만들면 Supabase Auth 내부 일관성이 깨질 수 있고, 이메일 없는 행을 만드는 것은 Supabase Auth 의도와 맞지 않음. 기각.

### A4. 모든 사용자에게 동일 RLS 정책(custom JWT claim)
미니앱 측에서 JWT를 발급하거나 Toss 인증 토큰을 검증해야 하는데, 이는 ADR-009 D2와 충돌(미니앱은 `getAnonymousKey` 단독 사용). Sprint 2 이상으로 연기.

---

## 영향

### 변경되는 자산

| 자산 | 변경 내용 |
|------|----------|
| `supabase/migrations/0002_profiles_toss_mapping.sql` | 신규 — `profiles` 테이블 + `recipes` FK drop |
| `supabase/schema.sql` | 갱신 — profiles 정의 + recipes FK 제거 표시 |
| `src/lib/auth/require-user.ts` | 신규 — `requireUser(request)` |
| `src/lib/auth/toss-user-resolver.ts` | 신규 — `resolveInternalUserId(hash)` |
| `src/lib/auth.ts` | deprecated — 신 API에 위임 |
| `src/lib/supabase/service-role.ts` | 신규 — service-role 클라이언트 팩토리(헤더 경로 전용) |
| `src/lib/cors.ts` | 신규 — `withCors`, `corsPreflightResponse` |
| `src/types/user.ts` | 확장 — `InternalUser`, `AuthSource` |
| `src/app/api/recipes/route.ts` | 갱신 — `requireUser(req)` + `withCors` + OPTIONS |
| `src/app/api/recipes/[id]/route.ts` | 갱신 — 동일 패턴 |
| `src/app/api/recipes/[id]/favorite/route.ts` | 갱신 — 동일 패턴 |
| `src/app/api/recipes/generate/route.ts` | 갱신 — **비인증 유지(D8)** + `withCors`(JSON 분기) + SSE init.headers에 `buildCorsHeaders` + OPTIONS |
| `src/lib/composition.ts` | 갱신 — `getRecipeService(source: AuthSource)` 분기(D7) |
| `docs/api/recipes.md` | 갱신 — 헤더 인증 + CORS + OPTIONS 표기 |
| `.env.local.example` | 추가 — `APPSINTOSS_ALLOWED_ORIGINS` |

### 보존되는 자산

- ADR-001 RLS 정책(쿠키 경로) — 그대로.
- ADR-002 AI Adapter+Factory — 그대로(인증과 무관).
- ADR-005 소유권 위반 404 수렴 — 양 경로 모두 적용.
- 웹앱 페이지·`useAuth`·proxy — 그대로.
- API 응답 shape(03-API-CONTRACT) — 그대로.

### Repository 인터페이스 영향

`RecipeRepository`는 이미 `userId: string`을 받으므로 시그니처 변경 없음. service-role 클라이언트 선택은 Composition Root(D7 `getRecipeService(source)`)가 담당한다. `SupabaseRecipeRepository`의 모든 메서드에 `.eq('user_id', userId)` 필터가 이미 부착되어 있어 RLS 우회 시에도 격리가 단일 방어로 유지된다.

---

## 검증

ADR-010이 검증되었다고 판단하는 기준 (QA Task #5):

1. 웹앱 사용자가 6개 API를 모두 호출 가능 — 5개 보호 라우트는 쿠키 경로 RLS 통과, generate는 비인증 공개. 자기 행만 접근.
2. 미니앱 사용자(헤더만)가 6개 API를 모두 호출 가능 — 5개 보호 라우트는 헤더 경로 service-role, generate는 헤더 없이도 호출 가능. 자기 행만 접근.
3. 두 사용자가 서로의 레시피를 조회할 수 없음(타인 id로 GET → 404).
4. 헤더와 쿠키가 동시 전달되면 헤더 경로가 우선되어 처리됨(쿠키는 무시).
5. OPTIONS preflight가 화이트리스트 origin에 대해 204 + 올바른 헤더 반환, 비화이트리스트는 헤더 부재.
6. 응답 shape 변화 없음(03-API-CONTRACT 그대로) — frontend 회귀 없음.
7. `npm run build` + `npm run lint` + `tsc --noEmit` 통과(backend Task #3 §F에서 이미 확인).
8. **(D8 추가)** generate 비인증 흐름이 웹앱(비로그인 미리보기)·미니앱(헤더 없이 호출) 양쪽에서 동작. 401이 발생하지 않음.

---

## 롤백

다음 시나리오 발생 시 본 ADR을 개정한다:

- **R1. 미니앱에서 헤더 변조 공격이 실제 위협으로 확인**: D6 신뢰 모델을 폐기하고 토스 측 서명 토큰 검증을 도입(ADR-011).
- **R2. cascade delete 손실이 운영 문제**: service-role 기반 `deleteUserCascade` 헬퍼를 추가하거나, profiles에 통합 FK(b)로 재마이그레이션 검토.
- **R3. 두 경로 분기 복잡도가 통제 불가**: 미니앱 전용 백엔드 라우트 prefix(`/api/mini/recipes/...`)로 라우트 분리.

---

## 참고 ADR

- [ADR-001](ADR-001-supabase.md) — Supabase + Repository + Mapper + RLS. 본 ADR이 쿠키 경로에서는 보존, 헤더 경로에서는 RLS 우회.
- [ADR-005](ADR-005-ownership-violation-404.md) — 소유권 위반 404 수렴. 양 경로 모두 적용.
- [ADR-009](ADR-009-appsintoss-port-architecture.md) — 앱인토스 미니앱 포팅 아키텍처. 본 ADR이 D5(옵션 P 채택)의 후속 실행안.

## 참고 SSOT

- `_workspace_option_p/00_input/requirements.md` — 본 작업 요구사항.
- `_workspace_option_p/01_architect_design.md` — 인터페이스 시그니처·통일 패턴.
- 미니앱 측 `docs/appsintoss-port/02-DATA-MODEL.md` §2.3, `03-API-CONTRACT.md` §3.1.4, `05-AUTH.md`, `09-ENV-CONFIG.md` §9.3 — 미니앱 호출 사양 SSOT.
