# Phase 1 Session Log — `airecipe-miniapp-phase1`

> 작성: miniapp-architect · 2026-05-23 (T5 산출)
> 입력: `_workspace/00_input/requirements.md`
> 산출: ADR-010, AGENTS.md 4종, 본 문서, CLAUDE.md "현재 단계" 절 갱신
> 팀 구성: team-lead / miniapp-architect / miniapp-api-client / miniapp-frontend / miniapp-qa (4 에이전트 + 1 리더)

본 문서는 Phase 1 전체 흐름·결정·검증·미해결을 단일 위치에 보존하여 Phase 2 이후 신규 LLM 세션이 컨텍스트를 즉시 회복할 수 있게 한다.

---

## 1. Phase 1 목표 (입력 요구사항 §목적)

6 백엔드 엔드포인트 호출을 위한 **공통 인프라**를 만든다. 화면 구현(Phase 2 이후) 전에 단일 호출 경로를 표준화한다.

수용 기준 (10-SPRINT-PLAN §10.2 / baseline §F):
- AC1.1 진입 시 `useTossUserId()` hash 반환
- AC1.2 `apiFetch('/api/recipes')` → 200 + 빈 사용자 응답
- AC1.3 헤더 누락 → 401 자동 재시도 후 정상
- AC1.4 응답 zod 통과, snake_case 미존재
- AC1.5 6 엔드포인트 호출 가능

---

## 2. 진행 흐름 (Task 단위)

| Task | 담당 | 상태 | 산출물 |
|------|------|------|--------|
| T1 — SSOT 인용 확정·api-client/frontend 통지 | miniapp-architect | completed | `_workspace/01_architect_phase1_baseline.md` |
| T2 — 공유 타입·api-client·zod·useTossUserId 구현 | miniapp-api-client | completed | types(5) + zod(3) + services(3) + tsconfig + zod dep 추가. `_workspace/02_api_client_summary.md` |
| T3 — `_app.tsx` Provider 마운트 + AC1.5 dev 트리거 | miniapp-frontend | completed | `useTossUserId.tsx` + `_app.tsx` + `pages/index.tsx`. `_workspace/02_frontend_summary.md` |
| T4 — 모듈별 점진 경계면 검증 + 통합 스윕 | miniapp-qa | completed | `_workspace/03_qa_report.md` (ALL PASS, FAIL 0) |
| T5 — ADR/AGENTS.md/세션 기록 마무리 | miniapp-architect | in_progress | ADR-010, AGENTS.md 4종, 본 문서, CLAUDE.md 갱신 |

---

## 3. 핵심 결정 (ADR-010으로 동결)

| # | 결정 | 근거 | 영향 |
|---|------|------|------|
| D1 | zod = `dependencies`, 모든 응답 zod 검증 | 백엔드/미니앱 분리 배포 → 미니앱이 첫 방어선. SSOT 단언 #3·#4 보호 | `src/lib/zod/*` + `api-client`가 raw 응답에 적용 |
| D2 | hash 메모리 캐싱 (SecureStore 보류) | 재발급 가능 식별자 + 검수 정책 미검증 + RN 표준 SecureStore 모듈 미확정 | `src/hooks/useTossUserId.tsx` 모듈 스코프 캐시 |
| D3 | 401 재시도 정확히 1회 (`allowRetry` 플래그) | 무한 루프 방지 + 본질 원인 hash 거부일 때 다회 시도 무의미 | `api-client.ts` 재귀 깊이 1 |
| D4 | Toss SDK 단일 줄 격리 (DIP) | 패키지 경로 미확정 + 변동 시 1행 수정으로 대응 | `useTossUserId.tsx`에만 import |
| D5 | `apiFetch`는 raw `{ data, meta? }` 반환 + 호출 측 unwrap | SSOT 단언 #1(래핑 검증)을 미니앱 측에서 가능하게 | `recipes.ts`가 `wrapped.data` 추출 (listRecipes 제외) |
| D6 | `tsconfig.module: "ESNext"` + `env.d.ts` ambient | `import.meta.env` TS1343 회피 + 09 §9.1.1 3키 격리 | `tsconfig.json` + `src/types/env.d.ts` |
| D7 | SDK 미해결 `@ts-expect-error` 한시 통과 | 추측 변경 금지(베이스라인 §G #2) + 다른 산출 검증 차단 안 함 | `useTossUserId.tsx:21` 1줄 + 첫 실행 시 검증 |

상세 근거·대안·롤백은 [ADR-010](../docs/adr/ADR-010-miniapp-phase1-conventions.md) 참조.

---

## 4. 산출 파일 인벤토리

### 코드 (Phase 1로 동결)

| 파일 | 라인수(대략) | 역할 |
|------|------------|------|
| `src/types/api.ts` | 122 | `ApiResponse`/`ApiError`/`StreamChunk` 등 |
| `src/types/recipe.ts` | 49 | 도메인 타입 |
| `src/types/user.ts` | — | `TossUserId`/`TossUserIdentity` |
| `src/types/env.d.ts` | — | `ImportMetaEnv` ambient |
| `src/types/index.ts` | — | barrel |
| `src/lib/zod/api.ts` | 43 | factory + error/listMeta |
| `src/lib/zod/recipe.ts` | 49 | 도메인 스키마 |
| `src/lib/zod/index.ts` | — | barrel |
| `src/services/api-client.ts` | 146 | `apiFetch` + `ApiClientError` + 401 재시도 |
| `src/services/recipes.ts` | 159 | 6 도메인 함수 |
| `src/services/index.ts` | — | barrel |
| `src/hooks/useTossUserId.tsx` | 146 | SDK 격리·캐싱·Provider·마스킹 |
| `src/_app.tsx` | (Phase 0 갱신) | TossUserIdProvider 마운트 |
| `src/pages/index.tsx` | — | dev-only AC1.5 트리거 (Phase 2 제거 예정) |

### 인프라

| 파일 | 변경 |
|------|------|
| `package.json` | `dependencies`에 `zod@^4.4.3` 추가 |
| `tsconfig.json` | `compilerOptions.module: "ESNext"` 추가 |

### 문서 (본 Phase로 새로 추가/갱신)

| 파일 | 종류 | 작성자 |
|------|------|------|
| `_workspace/01_architect_phase1_baseline.md` | baseline 동결 | architect (T1) |
| `_workspace/02_api_client_summary.md` | api-client 산출 요약 | api-client (T2) |
| `_workspace/02_frontend_summary.md` | frontend 산출 요약 | frontend (T3) |
| `_workspace/03_qa_report.md` | QA 매트릭스 (ALL PASS) | qa (T4) |
| `_workspace/04_session_log.md` | 본 문서 | architect (T5) |
| `docs/adr/ADR-010-miniapp-phase1-conventions.md` | 새 ADR | architect (T5) |
| `docs/adr/ADR-009-*.md` | 참고 ADR에 ADR-010 역참조 추가 | architect (T5) |
| `src/types/AGENTS.md` | 디렉터리 책임·SSOT·규약 | architect (T5) |
| `src/lib/zod/AGENTS.md` | 동상 | architect (T5) |
| `src/services/AGENTS.md` | 동상 | architect (T5) |
| `src/hooks/AGENTS.md` | 동상 | architect (T5) |
| `CLAUDE.md` "현재 단계" 절 | Phase 0 → Phase 1 완료 갱신 | architect (T5) |

---

## 5. AC1.1~AC1.5 통과 점검 (Phase 1 → Phase 2 진입 게이트)

QA 최종 매트릭스(`_workspace/03_qa_report.md` §5)를 본 문서에서 재확인:

| AC | 코드 경로 | 실호출 | 비고 |
|----|----------|--------|------|
| AC1.1 | PASS | PENDING (백엔드 옵션 P 배포 후) | `useTossUserId` SDK→zod→cache + Provider 노출 |
| AC1.2 | PASS | PENDING | `listRecipes` + `apiListResponseSchema(recipeSchema)` |
| AC1.3 | PASS | PENDING | `api-client` 401 재시도 + `refresh()` 새 hash 반환 |
| AC1.4 | PASS | — | 6 함수 zod 적용 + snake_case 전체 src 0건 |
| AC1.5 | PASS | — | 6 함수 export + dev 트리거 6 버튼 정확 시그니처 |

03 §3.10: 11/11 PASS (4 N/A — Phase 2 스트리밍/AI #8·9, 백엔드 CORS #12·13)
05 §5.7.3: 4/4 PASS (2 백엔드 N/A)
baseline §D 격리 단언: 7/7 PASS
통합 스윕: 5/5 PASS (typecheck/lint/직접 fetch 단일점/X-Toss-User-Id 평문 노출/env 키 격리)

**FAIL 누적: 0건**

### Phase 2 진입 게이트 판정: **PASS**

- 코드 경로 AC1.1~1.5 모두 통과.
- 잔여 PENDING(AC1.2/1.3 실호출)은 백엔드 옵션 P 배포에 의존하는 외부 차단 사항 → 본 저장소 Phase 1의 책임 범위 외. 본 저장소는 사양 기반 코드 경로를 모두 동결했다.
- baseline §G(SSOT 결함 보고) 트리거: 본 Phase에서 0건 발생.

---

## 6. 잔여 미해결 — Phase 2 인계

### 6.1 `@apps-in-toss/web-framework` 패키지 경로 확정

- **상태**: `useTossUserId.tsx:21` `@ts-expect-error` 1줄로 한시 통과.
- **검증 시점**: Phase 2 첫 `granite dev` 실행 또는 첫 RN 빌드 시 모듈 미해결 발생 여부.
- **처리**: 미해결이면 architect에게 SendMessage → baseline §B.2 갱신 + ADR-010 D7 Decision Trail 추가. 추측으로 다른 패키지(`@apps-in-toss/framework` 등)로 변경 금지 (ADR-010 §롤백 R1).

### 6.2 백엔드 옵션 P 후속 마이그레이션 (별 저장소 `AIReceipe` ADR)

본 저장소에서 결정·구현하지 않는다. 별 저장소의 후속 ADR(가칭 — 별 저장소 번호 체계 별도)에서 처리할 항목 (05 §5.9 + ADR-010 §결과):

1. `profiles` 테이블 마이그레이션 추가.
2. `resolveInternalUserId()` 미들웨어.
3. `requireUser()` 헤더·쿠키 이중 경로 확장.
4. CORS 헬퍼·OPTIONS preflight 핸들러.
5. `SUPABASE_SERVICE_ROLE_KEY`·`APPSINTOSS_ALLOWED_ORIGINS` Vercel 등록.

배포 완료 시 본 저장소의 AC1.2·AC1.3 실호출 검증이 가능해진다.

### 6.3 Phase 2 진입 시 일괄 제거 항목

- `src/pages/index.tsx`의 `Phase1DevTrigger` 컴포넌트, `isDev` 가드, `STUB_GENERATED_RECIPE` 상수, 호출 패널 styles 일괄 제거 → 06-UI-MAPPING의 TDS 컴포넌트 매핑으로 교체.
- `src/pages/about.tsx` 정리 또는 삭제.

### 6.4 무해 경고 (수정 불요)

- `src/router.gen.ts` unused-disable warning 1건 — 자동 생성 파일. eslint --fix 시 자동 생성기가 다시 추가 가능. **무해**.

---

## 7. 의사소통 흐름 정리 (팀 메시지 채널 회고)

- baseline 동결 직후 architect → api-client/frontend/qa 3자 통지: SSOT 인용 경로 + 시작 신호 + 멈춤 조건 (§G).
- api-client → architect: `tsconfig.json` `module: "ESNext"` 보강 사전 통지 (베이스라인 §G 외 정당 보강 — 진행 승인됨).
- frontend → architect: baseline 정독 완료 + SDK 격리 처리 계획 통지 (별 동의 불요).
- qa → architect: baseline 흡수 + QA 골격 PENDING 매트릭스 통지.
- team-lead → architect: 단계별 task 할당, T5 시작 시점 명확화 (T4 통과 후).

**baseline §G 트리거 (SSOT 결함 보고) 발동: 0건.** 미니앱 측이 백엔드 사양을 우회하거나 추측 변경하지 않음.

---

## 8. 결정 트레일 — 베이스라인 §C 보류 결정의 채택 확정

baseline §C는 "보류"로 명시했고 본 Phase 검증으로 확정된 결정:

| baseline §C 항목 | Phase 1 종료 시점 결정 | 후속 변경 트리거 |
|-----------------|--------------------|---------------|
| §C.1 신규 ADR 보류 | **ADR-010으로 채택 확정** (zod·메모리 캐싱·401 1회·SDK 격리·raw 응답·tsconfig·SDK 미해결 한시 통과) | Phase 2 SSE 도입 시 ADR-010 D5 비스트리밍 한정 확장 |
| §C.2 메모리 캐싱 | **채택** (ADR-010 D2) | 콜드 스타트 SDK 지연이 UX 측정 문제 / 검수 정책 변경 |
| §C.3 401 재시도 1회 | **채택** (ADR-010 D3) | Phase 3 429/5xx 자동 재시도 별 ADR |
| §C.4 unwrap 호출 측 | **채택** (ADR-010 D5) | Phase 2 SSE 별 경로 |

---

## 9. 다음 Phase (Phase 2 — 레시피 생성 화면 + 스트리밍) 진입 준비

`docs/appsintoss-port/10-SPRINT-PLAN.md` §10.3에 따라 Phase 2는 다음을 진행:

- 홈 + 생성 화면 라우트 등록 (07-ROUTING).
- 입력 폼 (요리명 + 인분 수, 클라이언트 zod 검증).
- `POST /api/recipes/generate` 스트리밍 호출 (`stream: true` + `Accept: text/event-stream`).
- `Response.body`를 `ReadableStream`으로 읽어 청크 파싱 (08-STREAMING).
- 청크 타입 분기: meta / text / recipe / error / done.
- `AbortController` 도입.
- TDS 컴포넌트 매핑 (06-UI-MAPPING).

Phase 2가 본 Phase의 결정에 미칠 영향 (예상):
- ADR-010 D5 raw 응답 반환 → 비스트리밍 한정으로 유지. SSE는 별 경로(`streamFetch` 등).
- ADR-010 D3 401 재시도 → 스트리밍 응답에는 적용 안 됨 (HTTP 200 + error 청크 형식, 03 §3.2.6).
- ADR-010 D6 tsconfig — `AbortSignal` RN/DOM 타입 충돌 가능 → 그 시점 해결.
- ADR-010 D7 SDK 미해결 한시 통과 → 첫 `granite dev` 실행 시 검증으로 해소.

---

## 10. 변경 이력

| 일시 | 변경 | 사유 |
|------|------|------|
| 2026-05-23 | Phase 1 session log 초안 작성 | T5 — Phase 1 마무리. baseline §C 보류 결정의 채택 확정 + ADR-010 동결 + AGENTS.md 4종 발행 + AC1.x 통과 점검 + Phase 2 인계 |
