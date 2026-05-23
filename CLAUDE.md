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

**Phase 1 완료 → Phase 2 진입 준비** (2026-05-23).

Phase 1(공유 타입·API 클라이언트·식별자 훅) ALL PASS — QA 매트릭스 FAIL 0건 (`_workspace/03_qa_report.md`). 산출물·결정은 ADR-010 + AGENTS.md 4종(`src/types|lib/zod|services|hooks/AGENTS.md`)에 동결. 세션 전체 흐름은 `_workspace/04_session_log.md`.

코드 산출 (Phase 1 동결):
- `src/types/{api,recipe,user,env.d,index}.ts` — 6 엔드포인트 요청·응답·도메인·식별자 타입, ambient env.
- `src/lib/zod/{api,recipe,index}.ts` — 응답 검증 스키마 + factory.
- `src/services/{api-client,recipes,index}.ts` — 단일 fetch 호출점(`apiFetch`) + 6 도메인 함수 + `ApiClientError`.
- `src/hooks/useTossUserId.tsx` — Toss SDK 단일 격리·메모리 캐싱·Provider·마스킹 헬퍼.
- `src/_app.tsx` — `TossUserIdProvider` 마운트.
- `src/pages/index.tsx` — Phase 2 진입 시 일괄 제거할 dev-only AC1.5 트리거.
- 의존성: `zod@^4.4.3` (deps).
- 인프라: `tsconfig.json`에 `"module": "ESNext"` 추가.

잔여 미해결(Phase 2 인계):
- `@apps-in-toss/web-framework` 패키지 경로 — `useTossUserId.tsx:21` `@ts-expect-error` 1줄로 한시 통과. 첫 `granite dev` 실행 시 검증 (ADR-010 D7 + §롤백 R1).
- AC1.2/1.3 실호출 검증 — 별 저장소 `AIReceipe`의 옵션 P 후속 마이그레이션(profiles 테이블·`resolveInternalUserId`·CORS preflight) 배포 후 가능.

Phase 2(레시피 생성 화면 + 스트리밍, 기능 a·b)는 `docs/appsintoss-port/10-SPRINT-PLAN.md` §10.3 참조. Phase별 수용 기준은 동 문서.

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
