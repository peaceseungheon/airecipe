# Phase 1 QA Report — 모듈별 점진 경계면 검증 + 통합 스윕

> 작성: miniapp-qa · 2026-05-23 · 팀 `airecipe-miniapp-phase1`
> 기준 baseline: `_workspace/01_architect_phase1_baseline.md`
> 입력 SSOT: `docs/appsintoss-port/03-API-CONTRACT.md` §3.10, `05-AUTH.md` §5.7.3, `_workspace/00_input/requirements.md`
> 범위: Phase 1 산출물 8종(types 3 + zod 2 + services 2 + hook 1 + Provider 통합) 경계면 검증 + 통합 스윕

본 리포트는 모듈 완성 통지마다 누적 업데이트한다. 각 단언은 PASS / FAIL / PENDING / N/A(Phase 2 이연) 로 표시하고, 결과의 근거는 파일:라인 인용.

---

## 0. 요약 — 최종

| 영역 | PASS | FAIL | PENDING | N/A |
|------|:----:|:----:|:-------:|:---:|
| 03 §3.10 경계면 불변식 | 11 | 0 | 0 | 4 |
| 05 §5.7.3 QA 단언 | 4 | 0 | 0 | 2 |
| baseline §D 격리 단언 | 7 | 0 | 0 | - |
| AC1.1~AC1.5 (코드 경로) | 5 | 0 | 0 | - |
| AC1.2/1.3 실호출 (선택) | 0 | 0 | 2 | - |
| 통합 스윕 | 5 | 0 | 0 | - |

**전체 판정: ALL PASS (코드 경로)** — FAIL 0건 누적. AC1.2/1.3 실호출 검증만 백엔드 옵션 P 배포 대기.

---

## 1. baseline §A 산출 파일 검증 매트릭스

| 파일 | 1차 작성자 | 도착 여부 | 단언 매핑 |
|------|----------|---------|----------|
| `src/types/api.ts` | api-client | **PASS** | §A.1 (16개 심볼 1:1 매핑) + 단언 #1·#3·#4·#5·#7 |
| `src/types/recipe.ts` | api-client | **PASS** | §A.2 (6개 심볼) + Generated/Recipe 분리(#5) |
| `src/types/user.ts` | api-client | **PASS** | §A.3 (`TossUserIdentity`, `TossUserId`) — `User { id, email }` 미도입 |
| `src/types/index.ts` | api-client | **PASS** | 3개 모듈 re-export |
| `src/types/env.d.ts` | api-client | **PASS** | API_BASE_URL/APP_ENV/LOG_LEVEL 3종만, 금지 키 0건 |
| `src/lib/zod/api.ts` | api-client | **PASS** | §A.6 5종 + factory `<T extends z.ZodType>` 정합 |
| `src/lib/zod/recipe.ts` | api-client | **PASS** | §A.6 6종 + ingredients min 1 / steps min 1 |
| `src/lib/zod/index.ts` | api-client | **PASS** | 2개 모듈 re-export |
| `src/services/api-client.ts` | api-client | **PASS** | §A.4 + §C.3 (401 1회) + §C.4 (raw 래핑) — 21개 단언 통과 |
| `src/services/recipes.ts` | api-client | **PASS** | §A.5 6 함수 + encodeURIComponent + stream:false 강제 |
| `src/services/index.ts` | api-client | **PASS** | barrel |
| `tsconfig.json` | api-client | **PASS** | `"module": "ESNext"` 추가 (import.meta.env 지원) |
| `src/hooks/useTossUserId.tsx` | frontend | **PASS** | §A.7 SDK 단일 줄 격리(`@ts-expect-error`) + zod min(8).max(256) + 메모리 캐싱 + 마스킹 헬퍼 |
| `src/_app.tsx` | frontend | **PASS** | §A.8 TossUserIdProvider 마운트 + react import 추가(lint 정리) |
| `src/pages/index.tsx` | frontend | **PASS** | AC1.5 dev-only 트리거 + 마스킹 표시 + isDev 가드 |

---

## 2. 03 §3.10 경계면 불변식 (15단언) — 최종

| # | 단언 | 상태 | 근거 (파일:라인) |
|---|------|:----:|----------------|
| 1 | `{ data, meta? }` 래핑, 배열 직접 반환 없음 | **PASS** | `src/lib/zod/api.ts:34-43` factory + `src/services/recipes.ts` 6 함수에 적용 |
| 2 | 에러 `{ error: { code, message } }`, code 기반 분기 | **PASS** | `src/services/api-client.ts:138-145` + `src/pages/index.tsx:163` `e.error.code` 분기 |
| 3 | camelCase only, snake_case 누출 없음 | **PASS** | grep 전체 src 0건 |
| 4 | 응답 `userId` 키 없음 | **PASS** | grep 전체 src 0건 (주석 1건은 명세 설명 `src/types/api.ts:7`) |
| 5 | GeneratedRecipe ≠ Recipe | **PASS** | `src/types/recipe.ts:33-49` + `src/services/recipes.ts` generateRecipe→GeneratedRecipe(:47), 그 외→Recipe |
| 6 | 보호 헤더 부착, 공개 생략 | **PASS** | `src/services/api-client.ts:77-79` + `src/services/recipes.ts` AuthedCallOptions 강제, GenerateOptions 옵션 |
| 7 | NOT_FOUND 단일 분기, FORBIDDEN 미분기 | **PASS** | `src/types/api.ts:32-44` + grep "FORBIDDEN" 분기 코드 0건 |
| 8 | 스트리밍 에러 HTTP 200 + chunk | N/A | Phase 2. `src/services/recipes.ts:48` stream:false 강제로 Phase 1 차단 |
| 9 | AI 4자 일치 | N/A | Phase 2 이후 |
| 10 | pageSize clamp 신뢰 | **PASS** | `src/services/recipes.ts:65-79` raw `{data,meta}` 반환 + `src/lib/zod/api.ts:28-32` listMetaSchema 검증 |
| 11 | favorite "true"/"false" 문자열 | **PASS** | `src/services/recipes.ts:72` boolean → `src/services/api-client.ts:132` `String(value)` → 정확한 문자열 |
| 12 | CORS Allow-Headers + OPTIONS | N/A | 백엔드 |
| 13 | CORS Allow-Origin: * 미사용 | N/A | 백엔드 |
| 14 | PATCH favorite 멱등 | **PASS** | `src/services/recipes.ts:124-140` ToggleFavoriteRequest `{ isFavorite: boolean }` |
| 15 | DELETE `{ data: { id } }` | **PASS** | `src/services/recipes.ts:39, :151, :158` |

---

## 3. 05 §5.7.3 QA 단언 (6항) — 최종

| # | 단언 | 상태 | 근거 |
|---|------|:----:|------|
| 1 | 두 사용자 데이터 격리 | **PASS** | `src/services/api-client.ts` 모듈 스코프 공유 변수 없음 — 호출마다 인자 받음. hook은 단일 사용자 컨텍스트 |
| 2 | 미니앱 측 user_id 필터 누락 | N/A | 백엔드 |
| 3 | profiles anon 조회 불가 | N/A | 백엔드 |
| 4 | 헤더 없이 보호 호출 시 401 | **PASS** | `src/services/recipes.ts` 보호 5함수 `auth: AuthedCallOptions` 필수 (TS 강제) + `src/pages/index.tsx:78-83` `requireAuth` 가드 (미발급 시 호출 보류) |
| 5 | 헤더 형식 위반(zod min 8) 차단 | **PASS** | `src/hooks/useTossUserId.tsx:39` `z.string().min(8).max(256)` + `:53-56` 부적합 시 throw, 캐시 미저장 |
| 6 | 본인 것 아닌 id → 404 (403 아님) | **PASS** | 미니앱 코드에 FORBIDDEN 분기 미작성 (grep 0건) + 미니앱 UI는 ApiErrorCode 분기에서 NOT_FOUND 단일 경로 |

---

## 4. baseline §D 격리 단언 — 전체 src 최종

| # | 금지 단어 | 검증 방법 | 상태 | 결과 |
|---|----------|----------|:----:|------|
| 1 | `profiles` | `rg "profiles" src/` | **PASS** | 0건 |
| 2 | `internal_user_id` | `rg ...` | **PASS** | 0건 |
| 3 | `service_role` / `SUPABASE_SERVICE_ROLE_KEY` | `rg -i ...` | **PASS** | 0건 |
| 4 | `auth.uid()` / RLS | `rg ...` | **PASS** | 0건 |
| 5 | `userId` 응답 키 | `rg "\\buserId\\b" src/` | **PASS** | 1건(주석, `src/types/api.ts:7` 명세 설명) |
| 6 | snake_case 키 일체 | `rg ...` | **PASS** | 0건 |
| 7 | AI Provider 키 | `rg ...` | **PASS** | 0건 |

---

## 5. AC1.1~AC1.5 (baseline §F) — 최종

| AC | 충족 산출 | 검증 방법 | 상태 | 근거 |
|----|----------|----------|:----:|------|
| AC1.1 | useTossUserId + Provider + 마스킹 표시 | hash 반환 + tossUserId truthy 확인 (마스킹 형식 표시) | **PASS (코드 경로)** | `src/hooks/useTossUserId.tsx:51-58` SDK→zod→cache, `:88-89` Provider state, `src/pages/index.tsx:89` `formatTossUserIdMask` 표시. 실호출 검증은 백엔드 배포 후 |
| AC1.2 | listRecipes + apiFetch + 헤더 | 코드 경로 + (실호출 옵션) | **PASS (코드 경로) / PENDING (실호출)** | `src/services/recipes.ts:65-79` + `src/services/api-client.ts:73-105` 헤더 주입 + 401 재시도. 실호출은 백엔드 옵션 P 배포 후 |
| AC1.3 | api-client 401 retry + hook refresh | 401 시 1회 재시도 + 무한루프 방지 | **PASS (코드 경로) / PENDING (실호출)** | `src/services/api-client.ts:98-106` allowRetry=false 재귀 + `src/hooks/useTossUserId.tsx:90-95` refresh가 새 hash 반환 |
| AC1.4 | zod 적용 + snake_case 미존재 | recipeSchema 적용 + camelCase only | **PASS** | recipes.ts 6 함수 모두 apiResponseSchema/apiListResponseSchema 적용 + 전체 src snake_case 0건 |
| AC1.5 | 6 함수 호출 가능 | export 확인 + dev 트리거 | **PASS** | `src/services/index.ts:3-10` 6 함수 export + `src/pages/index.tsx:92-127` 6 버튼 정확 시그니처 |

---

## 6. 통합 스윕 — 최종

| # | 항목 | 명령 | FAIL 조건 | 상태 | 결과 |
|---|------|------|----------|:----:|------|
| 1 | TypeScript 컴파일 | `pnpm typecheck` | exit 0 이외 | **PASS** | exit 0 (frontend 통합 후) |
| 2 | ESLint | `pnpm lint` | exit 0 이외 (운영 코드 한정) | **PASS** | 0 errors, 1 warning(`router.gen.ts` 자동 생성 unused-disable, 무해) |
| 3 | 직접 fetch 호출 | `rg "\\bfetch\\s*\\(" src/` | services 외 발견 시 FAIL | **PASS** | `src/services/api-client.ts:89` 단 1건 (CLAUDE.md §3 정합) |
| 4 | `X-Toss-User-Id` 평문 노출 | `rg -i "x-toss-user-id" src/` | console.log/Alert/JSX/Text 내 발견 시 FAIL | **PASS** | `src/services/api-client.ts:16` 상수 정의 1건만 (헤더 키 정의, 노출 아님). hook은 `formatTossUserIdMask`로만 표시. pages/index.tsx는 마스킹 형식만 |
| 5 | 환경변수 키 격리 | `rg "import\\.meta\\.env\\." src/` | API_BASE_URL/APP_ENV/LOG_LEVEL 외 누출 | **PASS** | API_BASE_URL(api-client.ts:22) + APP_ENV(pages/index.tsx:20, :88) 2 키만 사용. env.d.ts 선언 범위 내. GEMINI/ANTHROPIC/SUPABASE 0건. process.env 주석에 "금지" 명시만 |

### 추가 검증 (스윕 결과 부속)

- **Toss SDK 단일점 (baseline §A.7 DIP)**: `getAnonymousKey` import는 `src/hooks/useTossUserId.tsx:22` 단 1곳. 호출은 `:52` 단 1곳. api-client.ts는 SDK 미직접 의존. **PASS**.
- **hash 평문 console.log**: `console.log.*tossUserId\b` / `console.log.*hash\b` 검색 결과 0건. **PASS**.

---

## 7. baseline §G — 백엔드 위반 보고 트리거

발견 시 본 섹션에 누적:

- (없음 — Phase 1 최종 시점)

---

## 8. 발견된 FAIL 누적 (수정 요청 발송 이력)

발견 즉시 본 섹션에 누적. 형식: `[일시] 모듈 / 파일:라인 / 위반 단언 / 수정 방법 / 발송 대상`.

- **(없음 — Phase 1 최종 시점. FAIL 0건 누적)**

---

## 9. 정보 공유 (FAIL 아님, 향후 참고)

### 9.1 generatedRecipeSchema의 servings/cookTimeMinutes 양수 제약 부재
- 응답 측 zod는 03 §3.2.3 SSOT 그대로 `number` (`.int()`만). 백엔드 응답에 추가 제약 부과 부적절. PASS.

### 9.2 ApiErrorCode 8종 정확 일치 + FORBIDDEN 분기 미작성 패턴
- baseline §A.1 비고 #7 정합. 미니앱은 NOT_FOUND 단일 분기.

### 9.3 zod 4.4.3 호환성
- `z.enum`, `extend`, factory 모두 정상.

### 9.4 api-client.ts SRP·DIP 준수
- HTTP I/O + 헤더 + 401 + zod의 단일 책임. SDK 미import. recipes.ts는 apiFetch만 호출.

### 9.5 deleteRecipe 반환 타입
- `DeleteRecipeResponse['data']` indirection 일관성 측면 OK.

### 9.6 favorite 쿼리 string 변환
- `String(true)` = `"true"` 정확 매핑. 백엔드 z.enum과 정합.

### 9.7 tsconfig "module": "ESNext"
- `import.meta.env` 지원에 필요. 영향 없음 확인.

### 9.8 SDK import `@ts-expect-error`
- `src/hooks/useTossUserId.tsx:21-22`. baseline §B.2 "패키지 경로 변동 가능"에 따른 임시 통과. **첫 실 호출 검증 단계에서 패키지 경로가 사양과 다르면 즉시 architect에게 통지 + baseline §B.2 갱신**(frontend가 명시했고 qa도 그 흐름 동의). 추측 변경 금지 정확히 준수.

### 9.9 useTossUserId.refresh `Promise<TossUserId>` 시그니처
- baseline 위반 아님. baseline §A.7 책임 표는 반환 타입 미명시. 05 §5.4 의사 코드 의도(새 hash로 재호출)와 api-client.ts:99-103 흐름과 정확히 일치. 미니앱 내부 인터페이스 정합 조정으로 architect 통지 불필요.

### 9.10 dev-only 트리거 production 진입
- `isDev` 가드(`src/pages/index.tsx:20, :29`)로 트리 진입 안 됨. plugin-env가 APP_ENV를 상수 인라인하면 minifier가 dead-code-eliminate. 단, Phase1DevTrigger 컴포넌트와 STUB_GENERATED_RECIPE 데이터·헬퍼는 tree shaking 의존으로 번들에 잔존 가능. 호출 경로 없으므로 보안 영향 없음. **Phase 2 진입 시 일괄 제거 계획(frontend §4) 그대로 진행**.

### 9.11 hash 마스킹 형식 `len=N head=XY…`
- 09 §9.5 라인 221 "평문 노출 금지" 정합. 머리 2자는 hash 정보 가치 무시할 만함(base16 기준 충돌 확률 1/256). 운영에 노출 안 됨(`isDev` 가드). PASS. **방어적 강화 옵션**으로 머리 1자 또는 0자로 더 보수적으로 가는 것도 가능(FAIL 아님, 결정 frontend 재량).

### 9.12 router.gen.ts unused-disable warning
- 자동 생성 파일. 0 errors이므로 PASS. eslint --fix로 해결 가능하지만 자동 생성기가 다시 추가할 수 있음.

---

## 10. 변경 이력

| 일시 | 변경 | 사유 |
|------|------|------|
| 2026-05-23 14:1x | 초기 골격 작성 | baseline 동결 통지 수신 → 단언 매트릭스 PENDING으로 초기화 |
| 2026-05-23 14:2x | types + zod 모듈 PASS 갱신 | api-client 1차 검증. 단언 8건 PASS / §D 7건 PASS / typecheck PASS / zod 4.4.3 호환 |
| 2026-05-23 14:3x | api-client.ts + recipes.ts PASS 갱신 | api-client 2차 검증. 단언 11건 PASS / §D 0건 유지 / 통합 스윕 5건 PASS / FAIL 0건 누적 |
| 2026-05-23 14:5x | frontend 산출(useTossUserId + _app.tsx + pages/index.tsx) PASS + 통합 스윕 재실행 | frontend 검증 요청 처리. 03 §3.10 11/11 PASS, 05 §5.7.3 4/4 PASS, §D 7/7 PASS, AC1.1~AC1.5 모두 PASS(코드 경로), 통합 스윕 5/5 PASS. SDK 단일점·hash 노출 없음 확인. **FAIL 0건 누적, Phase 1 ALL PASS** |
