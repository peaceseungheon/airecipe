# Phase 2 Session Log — `airecipe-miniapp-phase2`

> 작성: miniapp-architect · 2026-05-24 (T5 산출)
> 입력: `_workspace/00_input/requirements.md`, `_workspace_phase1/04_session_log.md`(Phase 1 인계)
> 산출: ADR-011, 06-UI-MAPPING §6.4.6/§6.5 #6/§6.3.4 갱신, AGENTS.md 2종(`src/components|pages`) + 1종 보강(`src/services`), ADR-010 §결과 표 갱신, 본 문서, CLAUDE.md "현재 단계" 절 갱신
> 팀 구성: team-lead / miniapp-architect / miniapp-api-client / miniapp-frontend / miniapp-qa (4 에이전트 + 1 리더)

본 문서는 Phase 2 전체 흐름·결정·검증·미해결을 단일 위치에 보존하여 Phase 3 이후 신규 LLM 세션이 컨텍스트를 즉시 회복할 수 있게 한다.

---

## 1. Phase 2 목표 (입력 요구사항 §목적)

레시피 생성 화면(`/recipe/generate`) + SSE 스트리밍 — 기능 (a) 레시피 생성 + (b) 영양 분석. **저장 전**(`GeneratedRecipe`) 단계까지.

수용 기준 (requirements §수용 기준 / 10-SPRINT-PLAN §10.3):
- AC2.1 입력 → 점진 표시(인디케이터) → 최종 완성 (RecipeDisplay + NutritionPanel)
- AC2.2 뒤로가기/취소 시 in-flight abort, UI 일관
- AC2.3 빈/공백 클라이언트 zod 차단
- AC2.4 502/429 사용자 친화 한국어 메시지
- AC2.5 `GeneratedRecipe`(id 없음) 타입 보호
- AC2.6 비로그인 정상 동작(공개 endpoint)

---

## 2. 진행 흐름 (Task 단위)

| Task | 담당 | 상태 | 산출물 |
|------|------|------|--------|
| T1 — SSOT 인용 확정·TDS 매핑 검증·라우팅 구조·ADR 영향 검토 | miniapp-architect | completed | `_workspace/01_architect_phase2_baseline.md` (§A~§J, 10절) |
| T2 — SSE 스트리밍 어댑터·`generateRecipe` 스트리밍 모드·zod·`useRecipeGenerate` 훅 | miniapp-api-client | completed | `src/services/sse-client.ts`(신규) + `recipes.ts`(확장) + `api-client.ts`(§A.2 옵션) + `src/lib/zod/stream.ts`(신규) + `src/hooks/useRecipeGenerate.ts`(신규). `_workspace/02_api_client_summary.md` |
| T3 — 홈/생성 화면·SearchForm·RecipeDisplay·NutritionPanel + 라우팅 + dev 트리거 제거 | miniapp-frontend | completed | `src/components/{SearchForm,RecipeDisplay,NutritionPanel,recipe-format}.{tsx,ts}` + `src/pages/index.tsx`(재작성) + `src/pages/recipe/generate.tsx`(신규). `_workspace/02_frontend_summary.md` |
| T4 — Phase 2 점진 경계면 검증 + SSE 청크 정합 + TDS 실재성 + 통합 스윕 | miniapp-qa | completed | `_workspace/03_qa_report.md` (76 단언 PASS / 0 FAIL / 별 차원 PENDING 6건) |
| T5 — Phase 2 ADR/AGENTS.md/세션 기록 마무리 | miniapp-architect | completed | ADR-011, 06-UI-MAPPING §6.4.6/§6.5/§6.3.4 갱신, AGENTS.md 3종(components·pages 신규 + services 보강), ADR-010 §결과 표 갱신, 본 문서, CLAUDE.md "현재 단계" 갱신 |

---

## 3. 핵심 결정 (ADR-011로 동결)

| # | 결정 | 근거 | 영향 |
|---|------|------|------|
| D8 | SSE 어댑터를 `src/services/sse-client.ts` 신규 모듈로 분리 (apiFetch 우회) | SRP — JSON 단일 응답(401 재시도+zod+raw unwrap) vs SSE 와이어 파싱+AsyncIterable+!res.body 폴백은 책임이 다름. ADR-010 D5 비스트리밍 한정 정합 | `sse-client.ts` 신규 + `recipes.ts`에 `generateRecipeStream` Facade |
| D9 | `streamRecipe(req, options): AsyncGenerator<StreamChunk>` 시그니처 | 언어 표준 흐름(try/catch/finally) + 순서 보장 + 타입 안전 | 호출 측 `for await (const chunk of stream)` 패턴 강제 |
| D10 | `error` 청크 → 어댑터에서 `ApiClientError` throw (단일 매핑) | 호출 측 try/catch 한 곳에서 통합 처리. 비스트리밍 generateRecipe와 에러 타입 통일. 03 §3.10 #2(HTTP 상태 분기 금지) 정합 | `useRecipeGenerate`는 catch 단일 경로 |
| D11 | `text` 청크 delta 사용자 화면 표시 금지 (점진 인디케이터만) | Gemini 부분 JSON 깨진 토큰 노출 회피 + Claude tool 모드에서 빈 화면 회피 + 08 §8.3.5 채택 | 훅의 `progressText`는 내부 신호. UI는 "AI가 레시피를 생성하고 있어요" 인디케이터만 |
| D12 | TDS `Navbar` 단일 명칭 부재 → `PageNavbar`(extensions) 채택. 공통 래퍼 `AppNavbar.tsx` 미작성 | `@toss/tds-react-native@2.0.3` root export 직접 검증. `PageNavbar` compound API 적합. Granite 화면 본문 직접 렌더 패턴(07 §7.8) 정합. YAGNI — 화면 2개뿐 | `pages/index.tsx`·`pages/recipe/generate.tsx`에 직접 import. 06 §6.4.6 갱신 |
| D13 | `AbortSignal` 타입 충돌 cast 2곳 한시 통과 (sse-client.ts:76 + api-client.ts:100) | RN globals.d.ts vs ESNext lib `AbortSignal` nominal 차이. 런타임 동일 객체. tsconfig 변경 회피(ADR-010 D6 안정성). §A.2 옵션 추가의 자연 귀결 | 두 cast + 동일 주석. recipes.ts/useRecipeGenerate/페이지/컴포넌트로 전파 0건 |

상세 근거·대안·롤백은 [ADR-011](../docs/adr/ADR-011-miniapp-phase2-streaming-ui.md) 참조.

---

## 4. 산출 파일 인벤토리 (Phase 1 위에 누적)

### 코드 (Phase 2로 동결)

| 파일 | 라인수(대략) | 역할 |
|------|------------|------|
| `src/services/sse-client.ts` (신규) | ~180 | SSE → fetch+ReadableStream 어댑터, `streamRecipe` AsyncGenerator + `parseSseEvents`/`extractChunk` + `error` 청크 throw + `!res.body` 폴백 신호 + AbortSignal 전달 (§D.3 cast) |
| `src/services/recipes.ts` (확장) | 159 → ~180 | `generateRecipeStream` Facade 추가 + 6 함수에 `signal?: AbortSignal` 옵션 추가. 기존 호출 호환 |
| `src/services/api-client.ts` (§A.2 허용 확장) | 146 → ~160 | `ApiFetchInit.signal?: AbortSignal` 옵션 추가 + fetch 호출에 §D.3 cast. 본질 변경 0건 |
| `src/lib/zod/stream.ts` (신규) | ~40 | `streamChunkSchema` discriminated union 5종 (`recipe` 청크는 Phase 1 `generatedRecipeSchema` 재사용) |
| `src/hooks/useRecipeGenerate.ts` (신규) | ~190 | 외부 인터페이스(08 §8.3.2), 청크 분기, AbortController(명시 cancel + unmount cleanup), 비스트리밍 자동 폴백, 첫 청크 15s + 전체 90s 타임아웃 |
| `src/components/SearchForm.tsx` (신규) | ~120 | TDS TextField(variant="line") + NumericSpinner(disable) + Button, zod 클라 검증 |
| `src/components/RecipeDisplay.tsx` (신규) | ~140 | View + Txt + Badge + List/ListRow + actions slot. `id` 미참조 |
| `src/components/NutritionPanel.tsx` (신규) | ~100 | 칼로리 강조 + 4 매크로 grid + healthNote |
| `src/components/recipe-format.ts` (신규) | ~25 | `difficultyLabel`/`difficultyVariant`/`formatCookTime` 순수 함수 |
| `src/pages/index.tsx` (재작성) | ~70 | Phase 1 dev 트리거 일괄 제거 + PageNavbar + SearchForm |
| `src/pages/recipe/generate.tsx` (신규) | ~225 | PageNavbar + SearchForm + 진행 인디케이터 + 에러 박스 + RecipeDisplay/NutritionPanel + 자동 1회 생성 + handleCancel(reset) + handleRetry |
| `src/pages/about.tsx` | (삭제) | Phase 0 잔여 제거 (frontend T3에서 정리) |
| `src/services/index.ts` (확장) | — | `streamRecipe` barrel 추가 |
| `src/lib/zod/index.ts` (확장) | — | `streamChunkSchema` barrel 추가 |

### 인프라

- **의존성 변경 0건** — Phase 1의 `zod@^4.4.3`만 사용. `react-native-sse` 미도입(옵션 A 채택).
- **tsconfig 변경 0건** — ADR-010 D6 동결 유지. AbortSignal 타입 충돌은 §D.3 cast로 격리.

### 문서 (본 Phase에서 새로 추가/갱신)

| 파일 | 종류 | 작성자 |
|------|------|------|
| `_workspace/01_architect_phase2_baseline.md` | baseline 동결 (§A~§J 10절) | architect (T1) |
| `_workspace/02_api_client_summary.md` | api-client 산출 요약 + cast 격리 정책 표 | api-client (T2) |
| `_workspace/02_frontend_summary.md` | frontend 산출 요약 + 화면 구성 | frontend (T3) |
| `_workspace/03_qa_report.md` | QA 매트릭스 (76 PASS / 0 FAIL) | qa (T4) |
| `_workspace/04_session_log.md` | 본 문서 | architect (T5) |
| `docs/adr/ADR-011-miniapp-phase2-streaming-ui.md` | 새 ADR (D8~D13 6 결정 묶음) | architect (T5) |
| `docs/adr/ADR-010-*.md` | §결과 표 갱신 — D5/D6/D7 ↔ ADR-011 양방향 참조 | architect (T5) |
| `docs/appsintoss-port/06-UI-MAPPING.md` | §6.4.6/§6.5 #6/§6.3.4 + §6.9 변경 이력 갱신 | architect (T5) |
| `src/components/AGENTS.md` | 신규 — 도메인 컴포넌트 책임 + TDS 규약 + 스타일링 정책 | architect (T5) |
| `src/pages/AGENTS.md` | 신규 — Granite 라우팅 + 화면별 PageNavbar + SSE 결합 패턴 | architect (T5) |
| `src/services/AGENTS.md` | 보강 — sse-client 추가 + cast 격리 정책 + Phase 2 변경 사항 | architect (T5) |
| `CLAUDE.md` "현재 단계" 절 | Phase 1 완료 → Phase 2 완료 갱신 + 잔여 미해결 7항목 인계 | architect (T5) |

---

## 5. AC2.1~AC2.6 통과 점검 (Phase 2 → Phase 3 진입 게이트)

QA 최종 매트릭스(`_workspace/03_qa_report.md` §10·§14)를 본 문서에서 재확인:

| AC | 코드 경로 | 실호출 | 비고 |
|----|----------|--------|------|
| AC2.1 입력 → 점진 표시 → 최종 완성 | PASS | PENDING (백엔드 옵션 P 배포 후) | 인디케이터(streaming) + recipe 청크 → RecipeDisplay·NutritionPanel 1회 렌더 |
| AC2.2 abort + UI 일관 | PASS | PENDING | useEffect cleanup + handleCancel(reset) + AbortController.abort |
| AC2.3 빈/공백 차단 | PASS | — | SearchForm zod min(1) + trim |
| AC2.4 502/429 사용자 친화 한국어 | PASS | PENDING | sse-client `ApiClientError` throw → 훅 catch → `error` state 노출 |
| AC2.5 `GeneratedRecipe`(id 없음) 보호 | PASS | — | TS 컴파일 + zod (`generatedRecipeSchema` id 미포함). `recipe.id` 접근 0건 |
| AC2.6 비로그인 정상 동작 | PASS | PENDING | 공개 endpoint, generate 화면이 `useTossUserId` import하지 않음. `tossUserId` 미주입 시 헤더 생략 |

03 §3.10 본 Phase 적용 7건 PASS, 06 §6.7 6건 PASS, 07 §7.9 5+1 PASS (하드웨어 백 Phase 2 선택 — Phase 3 게이트), 08 §8.9 7+1 PASS (첫 sse 호출 검증 — dev server 시점), baseline §B.1 TDS 8종 PASS, baseline §D.2 격리 10건 PASS, baseline §D.3 cast 격리 4건 PASS, 통합 스윕 12건 PASS.

**전체: 76 단언 PASS, FAIL 0건 누적, PENDING 6건(별 차원).**

### Phase 2 → Phase 3 진입 게이트 판정: **PASS**

- 코드 경로 AC2.1~2.6 모두 통과.
- 실호출 4건(AC2.1/2.2/2.4/2.6) PENDING은 백엔드 옵션 P 배포에 의존하는 외부 차단 사항.
- 첫 sse 호출 환경 검증 1건은 dev server 실행 시점 — 미지원 확정 시 ADR-011 R1 트리거(옵션 B 전환). 자동 폴백이 동작하므로 사용자 UX 차단 없음.
- 하드웨어 백 가드 1건은 Phase 2 선택 비범위.
- baseline §G(SSOT 결함 보고) 트리거: 본 Phase에서 0건 발생.

---

## 6. 잔여 미해결 — Phase 3 인계

### 6.1 ADR-010 D7 SDK 패키지 경로 — 한시 통과 유지

- **현재 상태**: `useTossUserId.tsx:21` `@ts-expect-error` 1줄. Phase 2 산출은 공개 generate endpoint라 SDK 미사용 경로로 진행 가능했음.
- **Phase 3 트리거**: 첫 보호 endpoint 호출(예: `POST /api/recipes` 저장 또는 `GET /api/recipes` 목록) 시 `useTossUserId` 마운트 + `getAnonymousKey()` 호출이 실제 실행.
- **검증 시점**: Phase 3 baseline 동결 직후 첫 `granite dev` 실행. 모듈 미해결 시 architect SendMessage → baseline §B.2 갱신 + ADR-010 D7 Decision Trail.
- **추측 변경 금지** (ADR-010 §롤백 R1) — 다른 패키지 경로로 임의 변경 금지.

### 6.2 ADR-011 D13 AbortSignal cast 2곳 — 한시 통과 유지

- **현재 상태**: `src/services/sse-client.ts:76` + `src/services/api-client.ts:100` cast + §D.3 주석 동반. 격리 정책 (다른 모듈 전파 0건) qa 검증 PASS.
- **Phase 3 해소 조건** (3중 어느 하나):
  - (a) `lib: ["ESNext"]` 제거 후 ESNext built-in(Promise/Map/Set/iterators/AbortController/URL/TextDecoder) 가용성 검증 PASS → tsconfig 정리 + cast 2곳 동시 제거
  - (b) react-native types가 `AbortSignal`을 `lib.dom` 호환 형태로 갱신 (별 저장소 RN 측 변동) → cast 2곳 동시 제거
  - (c) `@types/node` 통합 또는 다른 정식 해법 발견 → architect 재평가
- **조건 충족 시점**: Phase 3 architect 책임. 본 Phase에서 풀려는 시도 금지.

### 6.3 RN `Response.body` / `TextDecoder` 미지원 환경 검증 — Phase 3 또는 dev server 시점

- **현재 상태**: 사전 조사상 RN 0.84+ Hermes에서 일반 지원이지만 Granite 런타임 폴리필 상태는 미검증. 자동 폴백(`useRecipeGenerate.ts:153-169`)이 ApiClientError + message 매칭으로 동작 — 미지원이어도 사용자 UX(최종 recipe 도착)는 보장.
- **검증 절차**: dev server 첫 sse 호출 시 `res.body` truthy + `TextDecoder` 가용 여부 확인.
- **미지원 확정 시 처리**: qa → architect SendMessage → ADR-011 R1 트리거 → 옵션 B(`react-native-sse`) 전환 결정. 외부 인터페이스(useRecipeGenerate)는 변경 없음 — 어댑터 내부만 교체.

### 6.4 백엔드 옵션 P 후속 마이그레이션 — 별 저장소 AIReceipe

본 저장소에서 결정·구현하지 않는다 (Phase 1 session log §6.2 인계 그대로 — Phase 2 마감 시점 미배포). 별 저장소의 후속 ADR에서 처리:

1. `profiles` 테이블 마이그레이션 추가
2. `resolveInternalUserId()` 미들웨어
3. `requireUser()` 헤더·쿠키 이중 경로 확장
4. CORS 헬퍼·OPTIONS preflight 핸들러
5. `SUPABASE_SERVICE_ROLE_KEY`·`APPSINTOSS_ALLOWED_ORIGINS` Vercel 등록

배포 완료 시 본 저장소의 AC2.1/2.2/2.4/2.6 실호출 검증 + Phase 3 보호 endpoint 호출 검증이 가능.

### 6.5 `useBackEvent` 하드웨어 백 가드 — Phase 3 게이트

- 07 §7.7.2의 `useBackEvent` + AbortController 연계는 Phase 2 선택 비범위로 미구현 (qa report §13.3).
- Phase 3 진입 시 결정:
  - 도입 결정 시 `useRecipeGenerate.cancel()` + 보호 화면(상세) `useEffect` cleanup과 함께 통합 구현
  - 정확한 `useBackEvent` API 시그니처는 Granite 공식 문서로 최종 확인

### 6.6 청크 간 30초 무응답 타임아웃 — Phase 3 후속

- Phase 2는 `useRecipeGenerate.ts`의 첫 청크 15s(`FIRST_CHUNK_TIMEOUT_MS`) + 전체 90s(`TOTAL_TIMEOUT_MS`)만 적용 (qa report §13.8).
- 08 §8.5.1 표의 청크 간 30s 무응답은 Phase 3 결정 권장 — 실측 후 추가.

### 6.7 디자인 토큰 결정 — 별 ADR

- 현재 hex 직접 사용(`#191F28`/`#4E5968`/`#F2F4F6`/`#FBE9E9` 등) — `RecipeDisplay`·`NutritionPanel`·`SearchForm`·`index.tsx`·`generate.tsx` 전반 (qa report §13.1).
- 06 §6.3.5는 adaptive 토큰 권장 — Phase 3 디자인 토큰 표 확정 시 일괄 교체 (별 ADR 또는 ADR-011 보강).

### 6.8 about 페이지 라우터 등록 — 출시 점검 인계

- `pages/about.tsx`는 frontend T3에서 정리(삭제) 완료. router.gen.ts에서도 자동 제외 확인 (`/recipe/generate` + `/` 만 등록, qa report §13.5).
- 향후 비기능 화면 추가 시 검수 영향 점검 — `appsintoss-publish-checklist` 스킬 사용.

### 6.9 SSE fragility 개선 (Phase 3 baseline 후보)

- api-client/qa 합동 발견 — `BODY_UNAVAILABLE_MESSAGE` const export 또는 `ApiClientError` sentinel field 도입으로 message 문자열 매칭 fragility를 줄이는 옵션.
- 본 Phase에서는 baseline §C.4 단일 매핑 정책 정합으로 결정 보류. Phase 3 baseline 동결 시 architect가 ADR-011 D-N 또는 별 ADR로 결정.

---

## 7. 의사소통 흐름 정리 (팀 메시지 채널 회고)

- baseline 동결 직후 architect → api-client/frontend/qa 3자 통지: SSOT 인용 경로 + 시작 신호 + 멈춤 조건(§G).
- api-client → architect: AbortSignal 타입 충돌 통지(§D.3 트리거). architect 옵션 (a)/(b)/(c) 제시 → api-client 권장 옵션 (a) 회신 → baseline §D.3 동결.
- qa → architect: `as RequestInit\b` grep에서 cast 2건 발견 → §D.3 단언 #1 판정 요청. architect 옵션 (a) 채택 — §D.3 범위 2곳으로 확장 갱신.
- api-client → architect: §D.3 갱신 적용 + 격리 grep 검증 + summary §10 갱신 보고.
- qa → architect: 전 산출 도착 후 통합 매트릭스 ALL PASS 보고.
- frontend → architect/qa: Badge `children: string` 제약 발견 → 06 §6.3.4에 추가 갱신.
- team-lead → architect: 단계별 task 할당, T1 재가동 알림(idle 회피), T5 진입 결정.

**baseline §G 트리거 (SSOT 결함 보고) 발동: 0건.** 미니앱 측이 백엔드 사양을 우회하거나 추측 변경하지 않음. 미세 결정(§D.3)은 통지 → 옵션 제시 → 채택 → 적용 → 검증 → 판정 갱신 표준 흐름으로 처리.

---

## 8. 결정 트레일 — baseline §C 결정의 채택 확정

baseline §C는 SSE 어댑터 구조 결정을 동결했고 본 Phase 검증으로 확정된 결정:

| baseline §C 항목 | Phase 2 종료 시점 결정 | 후속 변경 트리거 |
|-----------------|--------------------|---------------|
| §C.1 SSE 어댑터 `src/services/sse-client.ts` 신규 모듈 | **채택 확정** (ADR-011 D8) | RN `Response.body` 미지원 확정 시 ADR-011 R1 옵션 B 전환 |
| §C.2 AsyncGenerator<StreamChunk> | **채택 확정** (ADR-011 D9) | 동상 |
| §C.3 청크 zod 정책 (recipe fatal·error throw·기타 무시) | **채택 확정** (ADR-011 D9 부속) | 새 청크 타입 추가 시 zod 확장 |
| §C.4 에러 청크 단일 매핑 | **채택 확정** (ADR-011 D10) | Phase 3 다른 SSE-like 에러 형식 추가 시 매핑 확장 |
| §C.5 useRecipeGenerate 책임 경계 | **채택 확정** | 하드웨어 백 가드 Phase 3 도입 시 확장 |
| §C.6 RN fetch 지원 검증 | **PENDING** (dev server 첫 실행) | 미지원 확정 시 R1 |

§D.3는 미세 결정 처리 중 추가 갱신 (1곳 → 2곳 확장):

| baseline §D.3 항목 | 갱신 결과 | 갱신 사유 |
|-----------------|----------|----------|
| 적용 범위 | 1곳 → **2곳 확장** (ADR-011 D13) | qa §8B #1 판정 요청 → §A.2 자연 귀결로 옵션 (a) 채택 |

---

## 9. 다음 Phase (Phase 3 — 저장·목록·상세·즐겨찾기·삭제) 진입 준비

`docs/appsintoss-port/10-SPRINT-PLAN.md` §10.4에 따라 Phase 3는 다음을 진행:

- 저장 화면 (`/recipe/generate`의 결과에 "저장" 버튼) → `POST /api/recipes` 호출 → `/recipe/[id]` 진입
- 마이 레시피 목록 (`pages/my-recipes.tsx`) — `GET /api/recipes` + 필터(SegmentedControl)
- 레시피 상세 (`pages/recipe/[id].tsx`) — `GET /api/recipes/[id]` + 즐겨찾기/삭제
- 즐겨찾기 토글 (`FavoriteButton.tsx`) — `PATCH .../favorite` (멱등)
- 삭제 (`DeleteConfirmDialog.tsx` + `DELETE`)
- 보호 화면 가드 (`useTossUserId` 필수, ErrorPage 503/404)

Phase 2가 본 Phase에 영향을 줄 항목 (Phase 3 baseline 동결 시 검토):

1. **ADR-010 D7 해소** — 첫 보호 endpoint 호출 시점에서 SDK 패키지 경로 검증
2. **ADR-011 D13 해소** — 3중 조건 충족 시 cast 2곳 동시 제거 + tsconfig 정리
3. **`useBackEvent` 하드웨어 백** — 상세 화면 진입 + AbortController 연계 시 통합 구현
4. **청크 간 30s 타임아웃** — 본질 SSE 신뢰성 보강
5. **디자인 토큰 표 확정 + hex 일괄 교체** — 별 ADR
6. **SSE fragility 개선** (§6.9) — Phase 3 baseline에서 결정
7. **공통 래퍼 `AppNavbar.tsx` 추출 검토** — 화면 4~5개 도달 시 (ADR-011 D12 보류 트리거)
8. **단위 테스트(jest + @testing-library/react-native)** — 본격 도입 여부 별 ADR

---

## 10. 변경 이력

| 일시 | 변경 | 사유 |
|------|------|------|
| 2026-05-24 | Phase 2 session log 초안 작성 | T5 — Phase 2 마무리. baseline §C 결정의 채택 확정 + ADR-011 동결(D8~D13) + AGENTS.md 3종 + 06 §6.4.6/§6.5/§6.3.4 갱신 + ADR-010 §결과 표 갱신 + CLAUDE.md 현재 단계 갱신 + AC2.x 통과 점검 + Phase 3 인계 항목 9건 |
