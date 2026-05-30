# 0010. 미니앱 Phase 1 — 공유 인프라 코드 규약 (zod 의존성·메모리 캐싱·401 1회 재시도·SDK 단일 격리·raw 응답 검증)

> 전방 참조(2026-05-30): 본문이 인용하는 라우트 구현 위치 `src/pages/...`는 [ADR-018](./ADR-018-route-pages-consolidation.md)로 라우팅 루트 `pages/`로 통합됨. `router.gen.ts` 자동 생성·수동 수정 금지(§6.4)는 그대로 유효. 아래 시점 기록은 보존한다.

- 상태: 채택됨
- 날짜: 2026-05-23
- 적용 대상: 본 저장소(`airecipe-miniapp`) 클라이언트 한정 결정
- 영향 코드: `src/services/{api-client,recipes}.ts`, `src/lib/zod/{api,recipe}.ts`, `src/hooks/useTossUserId.tsx`, `src/types/{api,recipe,user,env.d}.ts`, `tsconfig.json`, `package.json`
- 참조 baseline: `_workspace/01_architect_phase1_baseline.md` (§B·§C·§E·§F)

---

## 맥락

[ADR-009](./ADR-009-appsintoss-port-architecture.md) D1·D2는 백엔드 분리·Toss 식별자 헤더 전환을 결정했고, [docs/appsintoss-port/03-API-CONTRACT.md], [05-AUTH.md], [09-ENV-CONFIG.md]가 미니앱이 따라야 할 인터페이스(요청·응답·헤더·CORS·환경변수)를 SSOT로 명세했다. Phase 1은 이 사양을 **실제 미니앱 코드**로 옮기는 단계다 — 6 엔드포인트를 호출할 공통 인프라(타입·zod·api-client·식별자 훅)를 만든다.

본 ADR 작성 시점 결정해야 했던 사항:

1. **응답 런타임 검증의 위치와 의존성 분류** — zod를 도입할지, 한다면 `dependencies`인지 `devDependencies`인지.
2. **`X-Toss-User-Id` 캐싱 위치** — 메모리인지 SecureStore인지.
3. **401 재시도 횟수와 무한 루프 방지** — 사양은 "1회"로 적혀 있으나 코드에서 어떻게 강제할지.
4. **Toss SDK 의존의 격리 깊이** — `@apps-in-toss/web-framework` 패키지 경로가 미확정이고 RN/Granite 환경에서 export 보장이 SSOT에서 검증되지 않은 상태에서 어떻게 미니앱 전체 코드를 보호할지.
5. **응답 unwrap 시점** — `apiFetch`가 `.data`를 unwrap하고 도메인 객체를 반환할지, raw `{ data, meta? }`를 반환할지.

추가로, baseline 동결 후 작업 중 발견된 **빌드 인프라 결정**도 본 ADR에 묶는다:

6. **tsconfig `module: "ESNext"` 추가** — `import.meta.env` 사용에 필요(TS1343).
7. **SDK 패키지 경로 미해결 한시 통과** — `@ts-expect-error` 1줄 + 실호출 검증 시점에서 architect 통지 흐름.

본 결정의 **수명은 Phase 1 종료(본 ADR 채택 시점)부터 Phase 2 SSE 도입까지**다. Phase 2가 도입하는 `AbortController`/`signal` 옵션·SSE chunk zod·낙관적 업데이트가 본 ADR 결정의 일부(특히 #5 raw 응답 반환·#3 재시도 정책)에 영향을 줄 수 있어 별 ADR로 갱신 또는 본 ADR을 superseded 처리한다.

---

## 결정

### D1. zod를 `dependencies`로 추가하고 모든 응답을 런타임 검증한다

- `package.json` `dependencies`에 `zod@^4.4.3` 추가.
- `src/lib/zod/api.ts`에 `apiResponseSchema<T>(inner)`·`apiListResponseSchema<T>(inner)`·`apiErrorSchema`·`listMetaSchema`·`apiErrorCodeSchema`를 정의하고, `src/lib/zod/recipe.ts`에 `generatedRecipeSchema` (`ingredients` min 1, `steps` min 1)·`recipeSchema = generatedRecipeSchema.extend({ id, isFavorite, createdAt })` 등 도메인 스키마를 정의.
- `apiFetch`는 raw 래핑 응답에 `apiResponseSchema(domainSchema)` 또는 `apiListResponseSchema(domainSchema)`를 적용하고, 검증 실패 시 `ApiClientError('INTERNAL_ERROR', '서버 응답 형식이 올바르지 않아요.')`를 throw.

### D2. `getAnonymousKey()` hash는 모듈 스코프 메모리 변수에 캐싱한다 (SecureStore 보류)

- `src/hooks/useTossUserId.tsx`의 모듈 스코프 `let cachedTossUserId: TossUserId | undefined` 변수가 캐시.
- Provider 마운트 시 캐시가 비어 있으면 SDK 호출 1회 (`useEffect`), 캐시가 있으면 그대로 노출.
- `refresh()`는 캐시를 비우고 SDK 재호출 → 새 hash 반환.
- SecureStore는 도입하지 않음 — 본 결정의 §근거 R2·R3 참조.

### D3. 401 자동 재시도는 정확히 1회 (재귀 깊이 1)

- `apiFetch`는 내부적으로 `apiFetchInternal(path, schema, init, allowRetry: boolean)`을 호출하고, 401 응답 + `init.refreshTossUserId !== undefined` + `allowRetry === true` 조건에서만 새 hash로 1회 재시도.
- 재귀 호출 시 `allowRetry = false` 전달 → 무한 루프 차단.
- `refreshTossUserId` 미제공 시(공개 엔드포인트 또는 호출부가 명시적으로 미제공) 401 발생해도 재시도하지 않고 그대로 `ApiClientError('UNAUTHORIZED', ...)` throw.

### D4. Toss SDK 의존은 `useTossUserId.tsx`에 단일 줄 import로 격리한다

- `getAnonymousKey` import 문은 미니앱 전체에서 `src/hooks/useTossUserId.tsx`의 단 한 줄에만 존재.
- `api-client.ts`는 SDK를 직접 import하지 않고, recipes.ts의 6 함수가 `auth: { tossUserId, refreshTossUserId }`로 hook 반환값을 인자로 받는다 (DIP).
- SDK 패키지 경로가 사양(`@apps-in-toss/web-framework`, 05 §5.2.1 라인 73)과 다르면 본 한 줄만 수정하면 된다.

### D5. `apiFetch`는 raw 래핑 응답을 반환하고 unwrap은 호출 측에서 수행한다

- `apiFetch<T>(path, schema, init): Promise<T>` — 호출부가 `apiResponseSchema(...)` 또는 `apiListResponseSchema(...)`를 전달하여 raw 응답의 `{ data, meta? }` 형식 자체를 검증한 뒤 그대로 받는다.
- `recipes.ts`의 5 함수(`generateRecipe`/`getRecipe`/`saveRecipe`/`toggleFavorite`/`deleteRecipe`)는 `wrapped.data`를 추출하여 도메인 객체를 반환.
- `listRecipes`만 raw `RecipeListResponse = { data, meta }` 그대로 반환 — `meta.pageSize`(clamp 적용값) 신뢰가 필요하기 때문.

### D6. `tsconfig.json`에 `compilerOptions.module: "ESNext"`를 추가한다

- `import.meta.env.API_BASE_URL` 사용(D5 구현·09 §9.4.2 SSOT)에 필요. 기존 `moduleResolution: "bundler"`와 정합.
- `src/types/env.d.ts`에 `ImportMetaEnv` ambient 타입(`API_BASE_URL`/`APP_ENV`/`LOG_LEVEL` 3키만 — 09 §9.1.1 표 그대로)을 선언.

### D7. SDK 패키지 경로 미확정 상태는 `@ts-expect-error` 1줄 + 실호출 검증 시 architect 통지로 한시 통과한다

- `useTossUserId.tsx:21`에 `// @ts-expect-error — Phase 1 baseline §B.2: 패키지 경로 미확정. 실행 단계에서 검증.` 주석 1줄 + 22행 import.
- Phase 2 첫 `granite dev` 실행 시 모듈 미해결이면 즉시 architect에게 SendMessage → baseline §B.2 갱신 + 본 ADR Decision Trail 추가. 추측으로 다른 패키지(`@apps-in-toss/framework` 등)로 변경 금지.

---

## 근거

### D1 zod = dependencies + 모든 응답 검증

- **백엔드와 미니앱이 다른 저장소·다른 배포 파이프라인**에서 동작한다 ([ADR-009] D4). 백엔드의 Mapper 회귀(snake_case 누출·`userId` 노출·필드 누락)가 발생하면 미니앱 측이 첫 방어선 — 03 §3.10 단언 #3·#4 위반을 화면에 닿기 전에 끊어야 한다.
- zod는 production 번들에 포함되어야 하므로 `dependencies`. `devDependencies`로 두면 빌드에서 제외돼 검증이 비활성화된다.
- 백엔드(별 저장소 `AIReceipe`)도 zod를 `dependencies`로 사용 — 컨벤션 정합.
- 번들 영향: zod ~50KB(gzip ~14KB). 09 §9.6 미니앱 100MB 한도 대비 무시 가능.

### D2 메모리 캐싱, SecureStore 보류

- **R1: hash는 재발급 가능한 식별자다.** 05 §5.4의 401 재시도 흐름이 곧 `getAnonymousKey()` 재호출이므로 영구 저장 가치가 낮다. 콜드 스타트마다 1회 SDK 호출은 측정상 무시 가능.
- **R2: SecureStore 검수 정책 가용성이 검증되지 않았다.** 09 §9.6 출시 검수 체크리스트에 SecureStore 권고 또는 금지가 명시되지 않았고, 05 §5.10은 "메모리 (또는 SecureStore — frontend가 검증)"으로 메모리를 디폴트로 표시한다.
- **R3: RN 측 표준 SecureStore 모듈이 확정되지 않았다.** 추측으로 `react-native-keychain` 등을 도입하면 추가 의존성·번들 영향·검수 정책 충돌 위험. YAGNI.
- **트레이드오프(수용)**: 디바이스에서 hash 값이 동일하다는 SDK 사양 가정에 기댄다(05 §5.2.1). 만약 매 콜드 스타트마다 다른 hash가 발급되면 사용자 입장에서는 "다른 사용자"가 된다 — Phase 1 검증 단계에서 이 가정이 깨지면 R1을 재검토하고 본 ADR을 superseded 처리해야 한다.

### D3 재시도 1회

- 05 §5.4의 의사 코드가 `retry=false` 플래그로 한 번만 재시도한다. SSOT 그대로 채택.
- 1회를 초과하면 무한 루프 위험 + 백엔드 부하 증폭. 401이 두 번 연속 발생하는 시나리오는 (a) hash 자체가 백엔드의 옵션 P 매핑에 거부됐거나 (b) 네트워크가 끊긴 경우 — 두 경우 모두 사용자 안내가 정답이지 자동 재시도가 해결책이 아니다.
- 429/5xx 자동 재시도는 도입하지 않음 — Phase 1 비범위. Phase 3 캐싱·낙관적 업데이트 시점에서 재검토.

### D4 SDK 단일 격리

- SOLID DIP: 화면·api-client 모두 SDK를 직접 의존하지 않고, hook 인터페이스(`{ tossUserId, refresh }`)에만 의존하게 한다. 이로써 SDK 패키지 경로·반환 타입 변동 시 미니앱 전체에 파급되지 않는다.
- baseline §B.2에서 발견된 **패키지 경로 미확정 사실**과 정합. SDK 의존을 한 곳에 모으면 변경 영향 범위가 1행으로 제한된다 — 본 결정이 Phase 2 진입 시 SDK 검증을 빠르게 처리할 안전망이 된다.

### D5 raw 응답 반환 + 호출 측 unwrap

- 03 §3.10 단언 #1은 "모든 성공 응답은 `{ data, meta? }`로 래핑"을 미니앱 측에서 검증할 수 있어야 한다. unwrap 후에 zod를 적용하면 래핑 자체 위반(예: 백엔드가 실수로 배열을 직접 반환)을 잡지 못한다 — raw 응답에 적용해야 한다.
- `listRecipes`가 raw `{ data, meta }`를 반환하는 이유: `meta.pageSize` (서버가 clamp 적용한 값, 03 §3.3.2 ADR-006)를 화면 측이 신뢰해야 한다.
- 트레이드오프: 호출부 5개 함수가 `wrapped.data`를 한 줄 추출하는 보일러플레이트 발생. 그러나 SSOT 단언 #1 보호 가치 > 5줄 보일러플레이트 비용.

### D6 tsconfig `module: "ESNext"`

- `import.meta`는 ES module syntax — `module: "CommonJS"`(TS 기본 추론값)에서는 TS1343 에러. ESNext는 `moduleResolution: "bundler"`(Granite/RN bundler 환경)와 정합한 표준 조합.
- `env.d.ts`로 `ImportMetaEnv`를 ambient 선언하여 TS 타입 보호 + 09 §9.1.1 금지 키(GEMINI/ANTHROPIC/SUPABASE 등)는 선언에서 제외 → 미니앱 코드가 실수로 접근하면 컴파일 에러.

### D7 SDK 미해결 한시 통과

- 추측으로 다른 패키지를 import하면 빌드는 통과해도 실행 시 `undefined`가 반환되거나 다른 형식의 hash를 받아 옵션 P 매핑에 실패하는 잠재 버그를 만든다.
- baseline §G #2 트리거를 명시적 통보 경로로 두고, ts-expect-error 1줄로 컴파일을 통과시켜 다른 산출물(api-client·zod·types·_app·dev 트리거)의 검증을 막지 않는다 — 동시 진행 가능성이 결정의 가치.

---

## 대안

### A. zod 미도입 — 응답을 그대로 신뢰

- 장점: 의존성 0, 번들 미증가.
- 단점: 백엔드 회귀(snake_case·`userId` 노출)가 화면에 닿음. SSOT 단언 #3·#4·#5의 미니앱 측 방어선 부재. 기각.

### B. SecureStore 즉시 도입

- 장점: 콜드 스타트 시 SDK 호출 1회 절약.
- 단점: 검수 정책 미검증, 패키지 선택 추측, 본질적으로 재발급 가능 식별자라 영구 보관 가치 낮음. 기각.

### C. 401 지수 백오프 + 다회 재시도

- 장점: 일시적 네트워크 단절 자동 복구.
- 단점: 본질 원인이 hash 거부(매핑 실패)일 때 무한 시도, 백엔드 부하 증폭. 사용자 안내가 더 정확한 응답. 기각.

### D. SDK를 api-client에 직접 import

- 장점: 호출부에서 인자 전달 없이 헤더 자동 부착.
- 단점: api-client가 SDK 패키지 경로 변동에 직격, DIP 위반, 단위 테스트 시 SDK mock 강제. 기각.

### E. `apiFetch`가 `.data` unwrap + 도메인 객체 반환

- 장점: 호출부 보일러플레이트 5줄 절약.
- 단점: 래핑 자체 위반(SSOT 단언 #1)을 미니앱이 검증하지 못함. 기각.

### F. tsconfig 변경 회피 — `process.env` 사용

- 장점: tsconfig 변경 없음.
- 단점: 09 §9.4.2 SSOT 위반(`import.meta.env` 명시). RN 빌드 환경 차이로 런타임에 undefined. 기각.

### G. SDK 패키지 경로 추측 변경 — `@apps-in-toss/framework`로 시도

- 장점: ts-expect-error 제거.
- 단점: 빌드 통과해도 export가 다르면 런타임 `undefined`. baseline §G #2 정책 위반. 기각.

---

## 결과

### 영향 받는 자산 (본 ADR로 동결)

- `src/types/{api,recipe,user,env.d,index}.ts` — 6 엔드포인트 요청·응답·도메인·식별자 타입, ambient env 타입.
- `src/lib/zod/{api,recipe,index}.ts` — 응답 검증 스키마 + factory.
- `src/services/{api-client,recipes,index}.ts` — 단일 fetch 호출점 + 6 도메인 함수.
- `src/hooks/useTossUserId.tsx` — SDK 격리·캐싱·재발급·Provider·마스킹 헬퍼.
- `src/_app.tsx` — Provider 마운트.
- `src/pages/index.tsx` — AC1.5 dev-only 임시 호출 트리거(Phase 2 진입 시 제거).
- `tsconfig.json` — `module: "ESNext"` 추가.
- `package.json` — `zod@^4.4.3` 추가 (dependencies).

### 미니앱 인터페이스 (다른 Phase에서 의존)

- `apiFetch<T>(path, schema, init): Promise<T>` — 단일 fetch 호출점. Phase 2의 SSE는 본 wrapper를 우회한 별 경로로 도입 (08-STREAMING).
- `ApiClientError extends Error` — 분기 키는 `error.code` (HTTP 상태 분기 금지).
- `recipes.ts`의 6 함수 시그니처 — Phase 2~4가 화면에서 호출.
- `useTossUserId()` 훅 — `{ tossUserId, refresh }`. `refresh()`는 `Promise<TossUserId>` 반환 (api-client 401 재시도의 동기 요구에 정합).
- `formatTossUserIdMask(hash)` — UI/로그 표시는 본 헬퍼만 사용.

### 후속 결정으로 변경 가능 (다음 Phase 트리거)

| 결정 | 변경 트리거 | 변경 방향 |
|------|-----------|----------|
| D2 메모리 캐싱 | 콜드 스타트 SDK 지연이 UX 측정으로 문제로 확인 / 검수 정책이 hash 영구 보관 권고 | SecureStore 도입 (별 ADR) |
| D3 401 1회 재시도 | Phase 3 캐싱·낙관적 업데이트 도입 | 429/5xx 지수 백오프 옵션 분리 |
| D5 raw 응답 반환 | Phase 2 SSE 도입 (08-STREAMING의 chunk 파서 + `apiFetch` 우회) | 본 ADR D5는 비스트리밍 한정 — SSE는 별 경로. **2026-05-24 [ADR-011](./ADR-011-miniapp-phase2-streaming-ui.md) D8로 실현** (`src/services/sse-client.ts` 신규 모듈로 분리, apiFetch 우회). D5 정책 유효 유지 |
| D6 tsconfig `module: "ESNext"` + `lib: ["ESNext"]` + `types: ["react-native"]` | RN/ESNext lib `AbortSignal` 타입 충돌 발견 (2026-05-24) | **[ADR-011](./ADR-011-miniapp-phase2-streaming-ui.md) D13으로 한시 통과** (cast 2곳 격리 + tsconfig 동결 유지). 본 ADR D6 정책 유효 유지. Phase 3 또는 ADR-011 D13 해소 조건 충족 시 tsconfig 정리 검토 |
| D7 SDK 미해결 | Phase 2 첫 `granite dev` 실행 / 백엔드 후속 ADR-X(별 저장소)에서 SDK 가이드 갱신 | baseline §B.2 갱신 + 본 ADR Decision Trail 추가 또는 superseded. **2026-05-24 Phase 2 종료 시점에는 한시 통과 유지** — Phase 2 산출은 SDK 미사용 경로(공개 generate endpoint)라 진행 가능. dev server 첫 실행 검증은 Phase 3 진입 시 또는 별도 트리거 |
| **신규 — Phase 2 결정 일괄** | Phase 2 진입 (2026-05-24) | **[ADR-011](./ADR-011-miniapp-phase2-streaming-ui.md) D8~D13** — SSE 어댑터 분리·AsyncGenerator·에러 청크 단일 매핑·text 청크 미표시·PageNavbar 채택·AbortSignal cast 2곳 한시 통과. 본 ADR D1~D7과 누적 동결 |
| **신규 — Phase 3 결정 일괄** | Phase 3 진입 (2026-05-24) | **[ADR-012](./ADR-012-miniapp-phase3-routing-cache-404.md) D14~D18** — `/my-recipes` + `/recipe/[id]` 라우트·Context+bump trigger 캐시 무효화·NotFoundScreen 단일 컴포넌트·저장 후 상세 직진·단순 페이지네이션. 본 ADR D3(401 1회 재시도) → ADR-012 4 훅에서 동일 패턴(refresh 주입). D5(raw 응답 정책) → ADR-012 D15에서 listRecipes 예외 그대로 유지. D7(SDK 한시 통과) → Phase 3에서도 검증 미달(인계 #1). 본 ADR D1~D7과 누적 동결 |

### 미니앱이 알 필요가 없는 것 (재차 단언, baseline §D)

본 ADR D1~D7 어느 결정도 다음을 알지 못한다 — 미니앱 코드·타입·테스트에 등장 금지 (05 §5.10 + baseline §D):

- `profiles` / `internal_user_id` / service role / `SUPABASE_SERVICE_ROLE_KEY`
- `auth.uid()` / RLS / Supabase Auth 쿠키 세션
- 응답 `userId` 키 (03 §3.10 단언 #4)
- AI Provider 키 (Gemini/Anthropic)
- `APPSINTOSS_ALLOWED_ORIGINS` 등 백엔드 환경변수

### 백엔드 후속 ADR 요청 (별 저장소 `AIReceipe`)

본 ADR로 미니앱 코드가 완성됐지만, 실 호출 검증(AC1.2·AC1.3)은 별 저장소의 다음 후속 작업에 의존한다 — `AIReceipe` 저장소에서 처리할 항목:

1. `profiles` 테이블 마이그레이션 추가 (02 §2.3.1).
2. `resolveInternalUserId()` 미들웨어 추가 (05 §5.2.3 의사 코드).
3. `requireUser()` 확장 — 헤더·쿠키 이중 경로 (05 §5.2.4).
4. CORS 헬퍼·OPTIONS preflight 핸들러 추가 (03 §3.1.4 + 05 §5.5).
5. `SUPABASE_SERVICE_ROLE_KEY`·`APPSINTOSS_ALLOWED_ORIGINS` Vercel 등록 (05 §5.6).

위 5건은 본 저장소가 결정·구현하지 않는다 — `AIReceipe` 저장소의 ADR-010(가칭 — 별 저장소 번호와 본 저장소 번호는 무관)에서 별 PR로 진행. 본 결정 트리에서는 단지 그 후속이 필요하다는 사실만 명시.

---

## 검증

본 ADR이 채택된 시점에서 다음이 확인되어 있다 (baseline §F + qa report §5):

- **AC1.1**: `useTossUserId` Provider 마운트 시 SDK 호출 → zod 검증 → 캐시 → tossUserId truthy (마스킹 형식 표시). [코드 경로 PASS]
- **AC1.2**: `listRecipes`가 raw `{ data, meta }`를 받아 `apiListResponseSchema(recipeSchema)`로 검증. [코드 경로 PASS / 실호출 PENDING — 백엔드 옵션 P 배포 후]
- **AC1.3**: 401 응답 + `refreshTossUserId` 제공 시 1회 재시도, `refresh()`가 새 hash 반환하여 동기 요구 만족. [코드 경로 PASS / 실호출 PENDING]
- **AC1.4**: 6 함수 모두 `apiResponseSchema(...)` 또는 `apiListResponseSchema(...)` 적용 + 전체 src snake_case 0건, `userId` 응답 키 0건. [PASS]
- **AC1.5**: 6 함수 export 확인 + `pages/index.tsx`의 dev-only 트리거 6 버튼 정확 시그니처. [PASS]

03 §3.10 단언 11/11 PASS (4 N/A: Phase 2 스트리밍/AI, 백엔드 CORS), 05 §5.7.3 4/4 PASS (2 백엔드 N/A), baseline §D 격리 단언 7/7 PASS, 통합 스윕 5/5 PASS. **FAIL 0건 누적** (qa report `_workspace/03_qa_report.md` §0).

---

## 롤백

- **R1. SDK 패키지 경로 사양 위반 확정**: D7 한시 통과 → architect가 baseline §B.2 갱신 + 본 ADR D4 import 한 줄을 실제 경로로 수정 + ts-expect-error 제거. ADR 자체는 유효(D4 정책은 변경 없음, 격리 위치는 그대로).
- **R2. `getAnonymousKey()` 가 콜드 스타트마다 다른 hash를 반환**: D2 메모리 캐싱 가정 붕괴 → 사용자 격리 깨짐. 본 ADR D2를 superseded 처리하고 (a) SecureStore 도입 (b) 백엔드 측 식별자 갱신 정책 재검토 (별 저장소 ADR).
- **R3. zod 4.x 호환성 이슈**: 4.4.3 → 다른 버전 또는 typebox/io-ts 대체. 본 ADR D1 채택은 유효, 패키지만 교체.
- **R4. SSE 도입으로 raw 응답 반환 정책이 호환 안 됨**: Phase 2가 본 ADR D5의 비스트리밍 한정을 확장 — `apiFetch`는 그대로 두고 별 경로(`streamFetch` 등)를 도입. 본 ADR은 superseded되지 않고 비스트리밍 한정으로 유효 유지.

---

## 참고 ADR

- [ADR-001 (Supabase + Repository + Mapper + RLS)](./ADR-001-supabase.md) — 본 ADR D1의 응답 검증이 ADR-001 Mapper 회귀의 안전망.
- [ADR-002 (AI Adapter + Facade + Factory)](./ADR-002-ai-adapter.md) — 백엔드 격리. 미니앱(본 ADR)은 호출만.
- [ADR-005 (소유권 위반 404 수렴)](./ADR-005-ownership-violation-404.md) — 본 ADR D1의 `ApiErrorCode` enum에서 `FORBIDDEN`을 예약 코드로만 두고 미니앱 코드에 분기 미작성하는 결정의 근거.
- [ADR-008 (Gemini 기본 + Claude 비활성 보존)](./ADR-008-gemini-default-with-claude-fallback.md) — 백엔드 결정. 미니앱(본 ADR)은 Provider 선택을 인지하지 않음.
- [ADR-009 (앱인토스 미니앱 포팅)](./ADR-009-appsintoss-port-architecture.md) — 본 ADR이 D2(헤더 인증)·D5(옵션 P) 결정을 실제 코드로 옮긴 첫 단계. **양방향 참조**: ADR-009 §결과·§영향 받지 않는 자산 표에 본 ADR-010 추가 필요(별 갱신).

---

## 참고 SSOT

- `_workspace/01_architect_phase1_baseline.md` — Phase 1 baseline (본 ADR의 결정 트리 입력).
- `_workspace/02_api_client_summary.md` — api-client 산출 요약 (D1·D3·D5·D6 구현 인덱스).
- `_workspace/02_frontend_summary.md` — frontend 산출 요약 (D2·D4·D7 구현 인덱스).
- `_workspace/03_qa_report.md` — Phase 1 QA 매트릭스 (본 ADR 검증 근거).
- `docs/appsintoss-port/03-API-CONTRACT.md` §3.1~3.10 — 응답·헤더·에러·CORS·경계 단언.
- `docs/appsintoss-port/05-AUTH.md` §5.2.1·5.2.2·5.4·5.7·5.10 — Toss 식별자·헤더·401 재시도·RLS·미니앱 격리.
- `docs/appsintoss-port/09-ENV-CONFIG.md` §9.1.1·9.4.2·9.5·9.6 — 환경변수·plugin-env·보안 체크리스트·출시 정책.
