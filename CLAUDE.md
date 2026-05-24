# airecipe-miniapp

AI 레시피 안내 — 앱인토스 미니앱 (React Native + Granite + TDS).

본 저장소는 **별 저장소 `AIReceipe`**(Next.js 웹앱, 백엔드 SSOT)의 자매 프로젝트로, 백엔드는 그대로 두고 미니앱 클라이언트만 별 코드베이스로 개발한다.

---

## 세션 시작 규칙 — 반드시 먼저 읽을 것

신규 LLM 세션이 이 저장소에서 작업을 시작할 때 다음 순서로 읽는다:

1. **`docs/appsintoss-port/00-OVERVIEW.md`** — 챕터 인덱스·재사용 자산·읽기 순서.
2. **`docs/adr/ADR-009-appsintoss-port-architecture.md`** — 본 미니앱의 모든 핵심 결정.
3. **`docs/appsintoss-port/10-SPRINT-PLAN.md`** — 현재 어느 Phase에서 무엇을 해야 하는지.

그 후 작업 영역에 따라 챕터별로 진입:

| 작업 | 읽을 챕터 |
|------|----------|
| 기능·수용 기준 확인 | 01-FEATURES |
| Supabase 스키마·user 매핑 이해 | 02-DATA-MODEL |
| 백엔드 호출 (요청·응답·CORS·인증 헤더) | 03-API-CONTRACT |
| Gemini/Claude 응답 형식·zod 이해 | 04-AI-PROVIDER |
| Toss 인증·`getAnonymousKey()` | 05-AUTH |
| UI 컴포넌트 매핑 (TDS) | 06-UI-MAPPING |
| 라우팅 (Granite + 파일 기반) | 07-ROUTING |
| SSE → fetch stream | 08-STREAMING |
| 환경변수·granite.config.ts | 09-ENV-CONFIG |
| 단계별 구현 순서 | 10-SPRINT-PLAN |

---

## 핵심 결정 (ADR-009 요약)

- **백엔드 분리**: 본 저장소는 미니앱 클라이언트만. 백엔드는 별 저장소(`AIReceipe`)의 Next.js API Routes를 Vercel에 배포하여 그대로 호출 (`API_BASE_URL`).
- **인증**: Toss 인증(`getAnonymousKey()`) → `X-Toss-User-Id` 헤더로 백엔드 전달. 회원가입/로그인 폼 없음.
- **사용자 식별**: 옵션 P — 백엔드의 `profiles` 테이블이 Toss userId hash ↔ internal uuid 매핑. 미니앱은 헤더만 알면 됨.
- **TDS 의무**: 비게임 미니앱은 `@toss/tds-react-native` 사용 필수 (검수 통과 조건).
- **MVP 범위**: Sprint 1 6기능 — 레시피 생성 / 영양 분석 / 저장 / 목록 / 즐겨찾기 / 삭제.

---

## 기술 스택

| 영역 | 값 |
|------|---|
| 프레임워크 | `@apps-in-toss/framework@^2.6.0`, `@granite-js/react-native@1.0.28` |
| React Native | `0.84.0` |
| React | `19.2.x` |
| TDS | `@toss/tds-react-native` (비게임 필수) |
| 환경변수 | `@granite-js/plugin-env` (빌드 시점 주입, `import.meta.env`) |
| 라우팅 | 파일 기반 (`pages/` 디렉터리 = `intoss://airecipe-miniapp/<path>`) |
| 패키지 매니저 | pnpm |
| 린트/포맷 | eslint + prettier |
| 테스트 | jest + `@testing-library/react-native` |

---

## 코드 규칙

1. **API 키·시크릿은 절대 미니앱에 두지 않는다**. `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, DB URL 모두 백엔드 전용. 09-ENV-CONFIG §9.1.1 금지 항목 참조.
2. **UI는 TDS 우선**. 커스텀 색상·폰트는 TDS 토큰 활용. 직접 `View/Text` 스타일링 최소화.
3. **백엔드 호출은 `src/services/api-client.ts`만 통과** (Phase 1에서 작성). 직접 `fetch` 호출 금지.
4. **응답은 zod 검증** 후 사용. 03-API-CONTRACT의 응답 shape이 SSOT.
5. **에러 메시지는 한국어 사용자 친화적**으로. HTTP 상태 그대로 노출 금지.
6. **`X-Toss-User-Id`는 노출 금지** — UI에 표시·로깅에 평문 포함 금지.

---

## 현재 단계

**Phase 2 완료 → Phase 3 진입 준비** (2026-05-24).

Phase 2(레시피 생성 화면 + SSE 스트리밍, 기능 a·b) **코드 경로 ALL PASS** — QA 매트릭스 FAIL 0건 누적 (`_workspace/03_qa_report.md`). Phase 1 동결(ADR-010 D1~D7) 그대로 유지. 산출물·결정은 ADR-011 + AGENTS.md 6종(Phase 1의 4종 + Phase 2 신규 `src/components|pages/AGENTS.md` 2종)에 동결. 06-UI-MAPPING §6.4.6은 `PageNavbar` 채택 갱신. 세션 전체 흐름은 `_workspace_phase1/04_session_log.md`(Phase 1) + `_workspace/04_session_log.md`(Phase 2 — 본 차).

코드 산출 (Phase 2 동결 — Phase 1 누적 위에 추가):
- `src/services/sse-client.ts` (신규) — SSE → fetch+ReadableStream 어댑터. `streamRecipe(req, options): AsyncGenerator<StreamChunk>`. wire 파싱 + `streamChunkSchema` zod + `error` 청크 → `ApiClientError` throw + `!res.body` 폴백 신호.
- `src/services/recipes.ts` (확장) — `generateRecipeStream` Facade 추가 + 기존 6 함수에 `signal?: AbortSignal` 옵션 추가. 기존 호출 호환.
- `src/services/api-client.ts` (Phase 2 §A.2 허용 확장) — `ApiFetchInit.signal?: AbortSignal` 옵션 추가 + fetch 호출에 §D.3 cast 적용. 본질(에러 매핑·401 재시도·zod·raw unwrap) 변경 0건.
- `src/lib/zod/stream.ts` (신규) — `streamChunkSchema` discriminated union 5종 (`recipe` 청크는 Phase 1 `generatedRecipeSchema` 재사용).
- `src/hooks/useRecipeGenerate.ts` (신규) — 외부 인터페이스(08 §8.3.2), 청크 분기, AbortController(명시 cancel + unmount cleanup), 비스트리밍 자동 폴백, 첫 청크 15s / 전체 90s 타임아웃.
- `src/components/{SearchForm,RecipeDisplay,NutritionPanel}.tsx + recipe-format.ts` (신규) — TDS primitives(Button/TextField/NumericSpinner/Badge/Txt/List/ListRow) 위 도메인 컴포넌트 + 순수 포맷 유틸.
- `src/pages/index.tsx` (재작성) — Phase 1 dev 트리거 일괄 제거 + PageNavbar + SearchForm.
- `src/pages/recipe/generate.tsx` (신규) — PageNavbar + SearchForm + 진행 인디케이터 + 에러 박스 + RecipeDisplay/NutritionPanel.
- `src/pages/about.tsx` — 정리 완료 (router.gen.ts에서 자동 제외 확인).
- 의존성·인프라 변경 0건 — Phase 1 그대로.

잔여 미해결 (Phase 3 인계):
- **ADR-010 D7 SDK 패키지 경로** — `useTossUserId.tsx:21` `@ts-expect-error` 한시 통과 유지. Phase 2 산출은 공개 generate endpoint라 SDK 미사용 경로로 진행 가능했음. dev server 첫 실행 검증은 Phase 3 진입 시 (보호 endpoint 호출 시점).
- **ADR-011 D13 AbortSignal cast 2곳** — `src/services/sse-client.ts:76` + `api-client.ts:100` 한시 통과 유지. RN/ESNext lib `AbortSignal` nominal 충돌. 해소 조건 (a)/(b)/(c) 충족 시 2곳 동시 제거.
- **AC2.1/2.2/2.4/2.6 실호출 검증** — 백엔드 옵션 P 배포 대기 (별 저장소 `AIReceipe`).
- **RN `Response.body` / `TextDecoder` 미지원 환경 검증** — Phase 2 baseline §C.6, dev server 첫 실행 시점. 미지원 확정 시 ADR-011 R1 트리거 (옵션 B `react-native-sse` 전환).
- **`useBackEvent` 하드웨어 백 가드** — Phase 2 선택 비범위 (07 §7.7.2). Phase 3 진입 시 결정 권장.
- **청크 간 30초 무응답 타임아웃** — Phase 2는 첫 청크 15s + 전체 90s만 적용. 08 §8.5.1 청크 간 30s는 Phase 3 후속 결정.
- **디자인 토큰 결정** — 현재 hex 직접 사용(`#191F28` 등). adaptive 토큰으로 일괄 교체 (별 ADR — qa report §13.1).

Phase 3(저장·목록·상세·즐겨찾기·삭제, 기능 c~f)는 `docs/appsintoss-port/10-SPRINT-PLAN.md` §10.4 참조. Phase별 수용 기준은 동 문서.

---

## 하네스: 앱인토스 RN 미니앱 개발

**목표:** SSOT 우선 설계 → 병렬 구현(api-client + frontend) → 점진적 QA + 검수 점검으로 본 미니앱을 Phase 0~5 단계로 출시 가능 상태까지 가져간다.

**트리거:** 본 미니앱의 기능 개발·수정·추가, 페이지/화면/api-client 메서드 추가, 아키텍처 설계, QA·검수 점검, 문서화, 버그 수정, 리팩터링 등 본 앱 관련 작업 요청 시 `miniapp-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**구성:** 에이전트 팀 4명(miniapp-architect / miniapp-api-client / miniapp-frontend / miniapp-qa) + 워커 스킬 5개. 상세는 `miniapp-orchestrator` 스킬과 `.claude/agents/`, `.claude/skills/`에서 관리.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-23 | 초기 구성 (4인 팀 + miniapp-orchestrator + 워커 5: technical-documentation, software-design-principles, integration-coherence-qa, granite-rn-development, appsintoss-publish-checklist) | 전체 | RN+Granite+TDS 미니앱 도메인. 별 저장소 AIReceipe의 하네스를 백엔드 분리·TDS 의무·검수 컨텍스트로 재설계 이식. `ai-recipe-integration`·`nextjs-fullstack` 제거, `granite-rn-development`·`appsintoss-publish-checklist` 신규. backend 에이전트 → api-client로 재정의 |

---

## 관련 저장소

- **백엔드 (Next.js)**: `AIReceipe` — https://github.com/peaceseungheon/AIReceipe
  - 6개 API 엔드포인트 + Supabase + AI Provider(Gemini/Claude) + RLS 정책 SSOT.
  - 본 저장소의 `docs/appsintoss-port/` 챕터는 그곳에서 작성된 SSOT 사본.
