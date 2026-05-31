# 세션 작업 기록 (SESSION_NOTES)

> 매 세션 시작 시 이 파일을 반드시 읽고, 완료된 작업과 다음 할 일을 파악한다.  
> 새 작업 완료 시 이 파일을 업데이트하여 누적 기록을 유지한다.

---

## 세션 #1 — 2026-05-21

### 완료된 작업 (Sprint 1 MVP)

**기능 구현**
- [x] 요리 이름으로 레시피 상세 생성 (Claude claude-sonnet-4-6, tool use, SSE 스트리밍)
- [x] 영양 정보 분석 (AI 자동 생성, 1인분 기준 칼로리·탄수화물·단백질·지방·식이섬유)
- [x] 레시피 저장 (Supabase PostgreSQL, 소유자 격리)
- [x] 즐겨찾기 토글 (멱등, isFavorite 목표값 명시 방식)
- [x] 회원가입/로그인 (Supabase Auth, 쿠키 기반 세션)
- [x] 레시피 삭제

**아키텍처 결정 (ADR-001~007)**
- ADR-001: Supabase (PostgreSQL + Auth + RLS)
- ADR-002: Claude AI Adapter 패턴 (AIRecipeProvider 인터페이스, ClaudeRecipeProvider 구현)
- ADR-003: 상태 관리 — SWR (캐싱·뮤테이션) + React hooks
- ADR-004: GET /api/recipes/[id] 단건 조회 엔드포인트 추가 (딥링크 지원)
- ADR-005: 소유권 위반 시 404 수렴 (RLS 특성상 403 구분 불가)
- ADR-006: pageSize > 50 시 400 거부 대신 50으로 clamp
- ADR-007: middleware.ts → proxy.ts 전환 (Next.js 16 규약)

**QA에서 발견·해소된 이슈 3건**
1. useRecipe 목록 캐시 매칭 → GET /api/recipes/[id] 직접 호출로 수정
2. middleware `/recipe/` 미가드 → PROTECTED_PREFIXES 추가 + /recipe/generate 공개 예외
3. pageSize .max(50) 거부 → clamp transform으로 변경

**커밋**: `391637e` — `feat: Sprint 1 MVP 완료 — AI 레시피 생성·영양 분석·저장·즐겨찾기`  
**GitHub**: https://github.com/peaceseungheon/AIReceipe

---

## 세션 #2 — 2026-05-22

### 변경
- AI 모델 기본값 `claude-sonnet-4-6` → `claude-haiku-4-5-20251001` (비용 ~70% 절감).
- 사유: F1·F2는 tool use로 출력 스키마가 강제되므로 모델 가중치 차이가 양식 안정성에 끼치는 영향이 작다. 동일 Anthropic family라 tool use·prompt caching 호환성 유지. Adapter 격리(ADR-002) 덕분에 1줄 변경.
- 오버라이드: `ANTHROPIC_MODEL` 환경변수로 sonnet/opus 지정 가능 (품질 부족 시).

### 수정 파일
- `src/lib/ai/claude-recipe-provider.ts` — `DEFAULT_MODEL` 변경
- `src/lib/ai/AGENTS.md`, `AGENTS.md` — 기본 모델 설명 갱신
- `docs/adr/ADR-002-ai-adapter.md` — 개정 노트 추가
- `_workspace/02_backend_summary.md` — 모델 기록 갱신
- `.claude/skills/ai-recipe-integration/SKILL.md` — 기본 시작 모델 가이드 갱신

### 다음 검증 필요
- 실 Anthropic API로 한국어 레시피 생성 품질 비교 (haiku 결과가 충분한지). 부족하면 `ANTHROPIC_MODEL=claude-sonnet-4-6`로 즉시 롤백.

---

## 세션 #3 — 2026-05-22

### 변경
- AI 기본 Provider **Claude → Gemini** (`gemini-3.1-flash-lite`, SDK `@google/genai`). 사용자 결정.
- **Factory 도입**: `src/lib/ai/ai-recipe-provider.factory.ts` 신규 — `AI_PROVIDER` 환경변수로 런타임 선택, 기본 `gemini`.
- **Claude 코드·SDK·env 비활성 보존** — 삭제하지 않음. `AI_PROVIDER=claude`로 즉시 롤백 가능 (운영 안전망).
- **구조화 출력 방식 분기**: Gemini는 `responseSchema`, Claude는 tool use. 두 스키마 모두 동일한 `GeneratedRecipe`로 수렴. zod 검증은 Provider-agnostic 단일 경로.
- `AIRecipeProvider` 인터페이스 불변 — Service·Route·UI 영향 없음 (ADR-002의 격리가 가치 실증).

### 수정/신규 파일 (역할별)

**코드 (backend 영역 — 본 세션에서는 문서만 처리)**
- 신규: `src/lib/ai/gemini-recipe-provider.ts`, `src/lib/ai/ai-recipe-provider.factory.ts`, `src/lib/ai/prompts/recipe-response-schema.ts`
- 보존: `src/lib/ai/claude-recipe-provider.ts`, `src/lib/ai/prompts/recipe-tool-schema.ts`
- 수정 완료: Composition Root(`composition.ts`) — Factory 호출로 변경, `package.json` — `@google/genai` 추가

**문서 (본 세션 산출물)**
- 신규: `docs/adr/ADR-008-gemini-default-with-claude-fallback.md`
- 신규: `.env.local.example`
- 수정: `docs/adr/ADR-002-ai-adapter.md` (Revision 2026-05-22 후속 추가)
- 수정: `src/lib/ai/AGENTS.md` (Provider-agnostic 재작성)
- 수정: `AGENTS.md` (다이어그램·디렉토리 책임·ADR 목록·환경변수)
- 수정: `README.md` (인트로·기술 스택·아키텍처 요약·환경변수)
- 수정: `docs/SESSION_NOTES.md` (이 파일)
- 수정: `.claude/skills/ai-recipe-integration/SKILL.md` (Provider-agnostic 일반화)

### 다음 검증 필요 (세션 #3)
- 실 `GEMINI_API_KEY`로 한국어 레시피 생성 품질을 기존 Claude haiku 대비 비교 (양식 안정성·조리 단계 디테일·영양 추정 정확도).
- Gemini `responseSchema` 출력이 zod 스키마(`recipe-schema.ts`)를 통과하는지 E2E 검증.
- 스트리밍 텍스트 델타가 UI에서 자연스러운지 확인 (Gemini는 부분 JSON이 흐를 수 있어 점진 렌더링 체감이 Claude와 다를 수 있음).
- `AI_PROVIDER=claude` 롤백 동작 확인 (환경변수 한 줄 변경만으로 Claude 경로 복귀하는지).

### 기술 부채에 추가
- [ ] 두 Provider의 응답 스키마(`recipe-response-schema.ts` ↔ `recipe-tool-schema.ts`) ↔ zod(`recipe-schema.ts`) ↔ 도메인 타입(`src/types/recipe.ts`) **4자 동기화 자동 검증 테스트** — 현재 수동 유지.
- [ ] Gemini `cachedContents` API 도입 평가 (현재 Gemini 캐싱 미사용; Claude는 `cache_control: ephemeral` 적용 중).
- [ ] **2026-11(6개월 후) Claude 비활성 코드 제거 평가** — Gemini 운영 안정성이 확인되면 별도 ADR로 제거 결정.

---

## 세션 #4 — 2026-05-22

### 목적
현재 Next.js 웹앱(AIReceipe)을 별도의 신규 앱인토스 미니앱(React Native + Granite)으로 개발할 때, **신규 프로젝트의 LLM 에이전트가 본 문서 묶음 하나만 읽고 동일 기능을 구현할 수 있는 포팅 사양서**를 작성한다. **현재 코드는 일절 수정하지 않는다.**

### 팀 구성
4인 에이전트 팀: architect / backend / frontend / qa. 오케스트레이터(team-lead) 조율. ADR-009 + 11챕터(00~10) 분담 작성.

### 핵심 결정 (ADR-009)
1. **백엔드 처리**: 현재 Next.js API를 Vercel에 그대로 유지·운영. 미니앱은 HTTPS만 호출. 6개 엔드포인트와 ADR-001/002/005/008 자산 그대로 보존.
2. **인증 전환**: Supabase Auth 폼을 미니앱에서 제거하고 `getAnonymousKey()` hash를 `X-Toss-User-Id` 헤더로 전달. 회원가입/로그인 화면·`AuthForm`·`useAuth`·`/auth/*` 페이지는 미니앱 v1 미구현.
3. **MVP 범위**: Sprint 1 6기능(생성·영양·저장·목록·즐겨찾기·삭제) 전체를 한 번에 포팅.
4. **분리 운영**: 신규 미니앱은 별 저장소·별 빌드 파이프라인. 현재 코드는 절대 수정하지 않는다.
5. **사용자 식별 옵션**: **P** (profiles 매핑 테이블 추가, `recipes.user_id` uuid 보존). 옵션 Q(컬럼 타입 마이그레이션)는 ADR-001 RLS·외래키·매핑 표를 무너뜨려 기각.

### 산출물 (모두 신규)

**ADR**
- 신규: `docs/adr/ADR-009-appsintoss-port-architecture.md`

**포팅 사양서 (`docs/appsintoss-port/`, 11챕터)**
- 00-OVERVIEW.md — 입구·원칙·읽기 순서·재사용 자산 인덱스 (architect)
- 01-FEATURES.md — Sprint 1 6기능 인벤토리·수용 기준·사용자 흐름 (architect)
- 02-DATA-MODEL.md — Supabase 스키마·RLS·옵션 P 매핑 (architect)
- 03-API-CONTRACT.md — 6개 엔드포인트 요청/응답·zod·CORS·인증 헤더 (backend)
- 04-AI-PROVIDER.md — Gemini/Claude·Factory·프롬프트·responseSchema·tool use (backend)
- 05-AUTH.md — `getAnonymousKey()`·`X-Toss-User-Id`·옵션 P upsert (backend)
- 06-UI-MAPPING.md — 14개 웹 컴포넌트 → TDS(`@toss/tds-react-native`) 1:1 매핑 (frontend)
- 07-ROUTING.md — App Router 7화면 → Granite 라우팅 (frontend)
- 08-STREAMING.md — SSE → RN fetch stream·점진 렌더링·취소 (frontend)
- 09-ENV-CONFIG.md — 환경변수·`granite.config.ts`·도메인 화이트리스트·appName 규칙 (architect)
- 10-SPRINT-PLAN.md — Phase 0~5 구현 순서·의존성·수용 기준 체크리스트 (architect)

**운영 산출물**
- `_workspace_appsintoss_port/01_architect_baseline.md` — backend/frontend/qa에 전파한 기준선 요약
- `_workspace_appsintoss_port/03_qa_report.md` — Task #5 QA 종합 sweep 보고서 (최종 PASS)

**갱신 (기존 코드는 무수정, 인덱스/상호참조만)**
- `AGENTS.md` — ADR 목록에 ADR-009 추가
- `README.md` — docs 트리에 `appsintoss-port/` 추가
- `docs/adr/ADR-001/002/005/008` — 각각 "후속 ADR" 절 추가하여 ADR-009 상호 참조

### QA 결과 (Task #5, qa)
- 10개 경계면 매트릭스 전부 PASS.
- 1차 sweep FAIL 4건(#6-A/B/C/D — 모두 환경변수·CORS 일관성) → backend·architect 패치 후 RESOLVED. 패치 상세: `03_qa_report.md` §C.2(#6-A) · §C.3(#6-D) · §C.5(#6-B `Accept` 헤더 추가, #6-C `Max-Age 600` 통일, 09 §9.3.1 SSOT 위임). 03·05·09 횡단 grep 결과 drift 없음.
- 선택적 보완 5건(D-1~D-5) 모두 자발 반영. 특히 D-5(09 CORS SSOT 위임)는 architect가 §9.3.1 머리에 "값이 다르면 03/05가 우선" 명시.
- TDS RN 컴포넌트 12개+ 실재성 — AppsInToss MCP로 검증 완료.
- AppsInToss 출시 정책(getAnonymousKey/번들/서비스 오픈 정책) — MCP로 검증 완료.
- 미해결 사항 없음. 상세는 `_workspace_appsintoss_port/03_qa_report.md`.

### 워크플로우 (실제 진행)
- Phase 3 (계약 선행): architect가 ADR-009 + 00/01/02 + baseline 작성하여 기준선 잡고 backend/frontend/qa에 SendMessage 통지.
- Phase 4 (병렬): backend(03/04/05) + frontend(06/07/08) 병렬, architect는 동시에 09/10 진행.
- Phase 5 (QA): qa가 챕터 간 정합성 sweep → FAIL 4건 발견 → backend/architect 패치 → 재검증 PASS.
- Phase 6 (마무리): architect가 본 SESSION_NOTES 작성 + ADR-009 ↔ ADR-001~008 상호참조 + AGENTS.md/README.md 인덱스 갱신.

### 다음 검증 필요 (세션 #5)
- 실제 신규 RN+Granite 미니앱 저장소 스캐폴딩 (10-SPRINT-PLAN Phase 0)
- Granite >= 1.0 + `@toss/tds-react-native` 의존성 설치 확인
- `getAnonymousKey()` 실제 호출로 hash 발급 검증 (SDK 2.4.5+)
- 백엔드 옵션 P 마이그레이션 (별도 ADR — ADR-010 예정) — `profiles` 테이블 추가 + 미들웨어 `resolveInternalUserId()`
- CORS 화이트리스트 운영 origin 확정 (토스 WebView origin + RN origin)
- AppsInToss 콘솔에 appName(`aireceipe`)·displayName·아이콘·도메인 화이트리스트 등록

### 기술 부채에 추가 (세션 #4)
- [ ] 백엔드 옵션 P 마이그레이션 ADR 작성·구현 (방법 A service role 우회 vs 방법 B 익명 Auth 사용자 — 02-DATA-MODEL §2.3.2 참조)
- [ ] 11챕터 + 4 ADR 후속노트 + AGENTS/README 인덱스의 **장기 동기화 자동화** — drift 방지 (예: 링크 체크 CI, ADR 인덱스 자동 생성)
- [ ] AI 면책 문구 정책 결정 — `nutrition.healthNote`가 의료 자문이 아님을 미니앱·웹 양쪽에 어떻게 노출할지 (앱인토스 서비스 오픈 정책 검토)

### SSOT 참조 (세션 #4)
- `docs/appsintoss-port/00-OVERVIEW.md` — 본 묶음의 입구
- `docs/adr/ADR-009-appsintoss-port-architecture.md` — 포팅 결정
- `_workspace_appsintoss_port/01_architect_baseline.md` — architect 기준선 요약
- `_workspace_appsintoss_port/03_qa_report.md` — QA 종합 sweep (PASS)
- `_workspace_appsintoss_port/00_input/requirements.md` — 세션 #4 입력 요구사항

---

## 세션 #5 — 2026-05-24/25

### 목적
별 저장소 `airecipe-miniapp`(RN 미니앱)이 본 백엔드를 `X-Toss-User-Id` 헤더로 호출 가능하도록, 본 저장소(AIReceipe)에 **옵션 P 마이그레이션 + 인증 경로 병존(쿠키+헤더)**을 배포한다. 세션 #4의 ADR-009 D5(옵션 P 채택 선언)의 백엔드 구현 단계.

### 팀 구성
세션 #4와 동일 4인 팀: architect / backend / frontend / qa. 팀 이름 `option-p-deploy`. 6 Task 직선 파이프라인(Task #1 architect 선행 → #2/#3 backend → #4 frontend → #5 qa → #6 architect 마무리).

### 핵심 결정 (ADR-010)
- **D1.** `profiles(internal_user_id uuid PK, toss_user_id text UNIQUE)` 매핑 테이블 추가.
- **D2. `recipes.user_id` FK 제거** — 한 컬럼에 두 출처 uuid(`auth.users.id` + `profiles.internal_user_id`)가 공존해야 해서 FK는 한 테이블만 가리킬 수 없음. cascade delete 손실은 Sprint 1 영향 0.
- **D3.** `requireUser(request)` 단일 추상 — 헤더 우선·쿠키 fallback. Route Handler가 두 경로 분기를 인지하지 않음(OCP).
- **D4.** 헤더 경로는 service-role 클라이언트로 RLS 우회 + Repository `.eq('user_id', internalUserId)` 단일 방어로 격리. 쿠키 경로는 기존 RLS 그대로.
- **D5.** CORS — `APPSINTOSS_ALLOWED_ORIGINS` 화이트리스트 echo + `Allow-Headers: Content-Type, X-Toss-User-Id, Accept` + OPTIONS 204. SSE는 init.headers에 `buildCorsHeaders` spread.
- **D6.** Toss userId hash(`getAnonymousKey()`) 평문 신뢰 — Sprint 1 위협 모델 수용. 강화(서명·nonce)는 Sprint 2 검토.
- **D7. Composition Root `getRecipeService(source: AuthSource)`** — backend Task #2 구현 단계 결정. cookie → 쿠키 클라이언트, header → service-role.
- **D8. `POST /api/recipes/generate`는 비인증 공개 유지** — backend Task #3 구현 단계 결정. 원래 비로그인 미리보기 흐름을 지원하던 공개 엔드포인트로, `requireUser` 강제 시 웹앱 회귀(401). CORS + OPTIONS만 부착.

### 산출물

**ADR**
- 신규: `docs/adr/ADR-010-option-p-toss-user-mapping.md` (D1~D8)
- 갱신: ADR-001, ADR-005, ADR-009의 "후속 ADR" 절에 ADR-010 상호 참조 추가

**코드**
- 신규: `src/lib/auth/require-user.ts`, `src/lib/auth/toss-user-resolver.ts`, `src/lib/auth/index.ts`
- 신규: `src/lib/supabase/service-role.ts` (헤더 경로 전용)
- 신규: `src/lib/cors.ts` (`withCors`, `corsPreflightResponse`, `buildCorsHeaders`)
- 확장: `src/types/user.ts` (`InternalUser`, `AuthSource`)
- 갱신: `src/lib/composition.ts` (`getRecipeService(source)` 분기, D7)
- 갱신: `src/app/api/recipes/route.ts`, `src/app/api/recipes/[id]/route.ts`, `src/app/api/recipes/[id]/favorite/route.ts` (5개 핸들러 — requireUser(req) + withCors + OPTIONS)
- 갱신: `src/app/api/recipes/generate/route.ts` (비인증 유지 + withCors + SSE buildCorsHeaders + OPTIONS, D8)
- 레거시: `src/lib/auth.ts` (@deprecated, 호출자 0건 — Sprint 2 제거 검토)

**DB**
- 신규: `supabase/migrations/0002_profiles_toss_mapping.sql` (FK drop + profiles + RLS on + 정책 0개 + idempotent)
- 갱신: `supabase/schema.sql` (profiles 정의 추가, recipes FK 제거 표시)

**문서**
- 갱신: `docs/api/recipes.md` (인증 두 경로·CORS·OPTIONS 절 추가, 각 엔드포인트 제목에 "쿠키/헤더" 표기)
- 신규: `src/lib/auth/AGENTS.md` (분기 규칙·격리 책임·적용 범위)
- 갱신: `src/app/api/AGENTS.md` (ADR-010 인증/CORS 규약 반영)
- 갱신: `src/lib/supabase/AGENTS.md` (service-role.ts 항목 추가, 신/구 requireUser 구분)
- 갱신: `AGENTS.md` 루트 ADR 목록에 ADR-010 추가
- 갱신: `.env.local.example` (`APPSINTOSS_ALLOWED_ORIGINS`)

**운영 산출물**
- `_workspace_option_p/00_input/requirements.md` — 본 세션 요구사항
- `_workspace_option_p/01_architect_design.md` — 시그니처·통일 패턴·QA 11케이스 매트릭스 (§4 옵션 C 변형 확정, §5 5+1 분류, §7 Q1~Q10+Q8b)
- `_workspace_option_p/02_backend_module_summary.md` — Task #2 모듈 산출
- `_workspace_option_p/02_backend_routes_summary.md` — Task #3 Route 갱신 + §C generate 비인증 결정
- `_workspace_option_p/02_frontend_regression_check.md` — Task #4 웹앱 회귀 검증
- `_workspace_option_p/sync_notes.md` — 미니앱 저장소(airecipe-miniapp) 동기화 안내
- `_workspace_option_p/03_qa_report.md` — Task #5 통합 정합성 QA (11/11 PASS)

### QA 결과 (Task #5, qa)
검증 매트릭스 **11/11 PASS, FAIL 0건**, 수정 루프 0회로 수렴:
- Q1 쿠키 경로 / Q2 헤더 경로 + profiles upsert / Q3 헤더 우선 / Q4 401 / Q5 ADR-005 404 수렴(양 경로) / Q6 OPTIONS 204 화이트리스트 / Q7 비화이트리스트 / Q8 SSE+CORS / Q8b generate 비인증 / Q9 웹앱 회귀 / Q10 DB FK drop·profiles·RLS on.
- D7 RLS 우회 안전성: Repository 4 메서드 모두 `.eq("user_id", userId)` 부착, service-role 사용 지점 2곳만(`composition.ts:52`, `toss-user-resolver.ts:45`), Mapper도 user_id를 DTO에서 제외 — 누출 경로 없음.
- OBSERVATION 1건(O1, FAIL 아님): 두 AGENTS.md가 레거시 `requireUser()` 시그니처 언급 → 본 Task #6에서 해소 완료.

### 빌드/Lint/타입 검증
backend Task #3 §F에서 `npm run build` + `npm run lint` + `tsc --noEmit` 모두 통과 보고. Task #6 마무리 단계에서 architect가 재확인.

### 다음 검증 필요 (세션 #6)
- 실 Supabase 환경에서 `0002_profiles_toss_mapping.sql` 적용 후 마이그레이션 멱등성 확인.
- 실 `APPSINTOSS_ALLOWED_ORIGINS` 운영 origin 확정(Toss WebView · RN · staging/prod 분리) — `09-ENV-CONFIG §9.3` 미니앱 측 SSOT 동기.
- 실 미니앱(`airecipe-miniapp`)에서 `getAnonymousKey()` hash로 6개 API 호출 E2E.
- 부하 시 `profiles` upsert 경합 안전성 — 동일 hash 동시 호출 시 UNIQUE 제약·`onConflict` 동작 확인.
- service-role 키 운영 환경 분리(staging/prod, Vercel 환경변수 격리).

### 기술 부채에 추가 (세션 #5)
- [ ] `src/lib/auth.ts` 레거시 완전 제거 — Sprint 2 ADR로 결정(현재 호출자 0건 확인됨, 안전망으로만 유지).
- [ ] Toss userId hash 신뢰 모델 강화 옵션(서명 토큰·nonce·timestamp) — Sprint 2 위협 평가 후 결정.
- [ ] FK drop으로 cascade delete가 끊긴 부분 — 사용자 삭제 흐름 도입 시 service-role 기반 `deleteUserCascade(internalUserId)` 헬퍼 추가.
- [ ] Q3(헤더+쿠키 동시) 통합 테스트 자동화 — 현재 코드 리뷰로만 보장.

### SSOT 참조 (세션 #5)
- `docs/adr/ADR-010-option-p-toss-user-mapping.md` — 본 세션의 모든 결정 진실 공급원
- `_workspace_option_p/01_architect_design.md` — 인터페이스 시그니처·통일 패턴·QA 매트릭스
- `_workspace_option_p/03_qa_report.md` — QA 11/11 PASS
- `_workspace_option_p/sync_notes.md` — 미니앱 저장소 갱신 안내
- `src/lib/auth/AGENTS.md` — 인증 디렉터리 가이드

---

## 세션 #6 — 2026-05-30

### 목적
미니앱이 `POST /api/recommendations` 호출 시 **404** 반환 → 원인은 백엔드 라우트 미구현(미니앱 ADR-016에서 "백엔드 외부 작업 PENDING"으로 예고). 미니앱은 이미 이 엔드포인트를 소비하도록 완성(Phase 6)돼 있어, 백엔드를 **미니앱 동결 계약에 맞춰 추종 구현**. 미니앱 무변경.

### 팀 구성
4인 팀: architect / backend / qa (frontend는 본 작업 무관 — 웹앱 UI 변경 없음). Skill 중복 호출로 architect 2회 스폰됐으나 둘 다 동일하게 ADR-011 + baseline으로 수렴, 마지막 에이전트가 Bash 교차검증으로 정합 확인.

### 핵심 결정 (ADR-011, D-R1~D-R10)
- **계약 출처**: 추천 계약 SSOT는 미니앱 측 3파일(`airecipe-miniapp/src/lib/zod/recommendations.ts`, `docs/appsintoss-port/03-API-CONTRACT.md §3.8`, `docs/adr/ADR-016`). 백엔드는 이를 1:1 추종(백엔드 ADR 번호는 별개 체계 → ADR-011).
- 요청 `{ theme: { situation?, weather? } }` — situation 6·weather 5 enum, 최소 1축 refine. 응답 `{ data: { items[5], meta: { theme(echo), generatedAt(ISO) } } }`.
- **보호 엔드포인트** — `requireUser(request)`(ADR-010) 재사용. 무상태(D-R8)라 반환값 미사용, 401 차단만 목적. 신규 인증 코드 0.
- **AI 5개 강제의 최종 보증은 서버 zod `.length(5)`** (`parseRecommendationItems`) — Gemini `responseSchema`/Claude tool use는 보조(배열 고정 길이 강제 불가).
- 별도 인터페이스 `AIRecommendationProvider`(ISP) + Gemini/Claude 어댑터 + Factory(`AI_PROVIDER`, ADR-008 패턴). 모델 default는 generate와 동일(`gemini-3.1-flash-lite`/`claude-haiku-4-5-20251001`).
- DB write/마이그레이션/리포지토리 0건(무상태, D-R8).

### 산출물
**ADR**: 신규 `docs/adr/ADR-011-recommendations.md` (D-R1~D-R10 + 롤백 R1~R4).
**코드 (신규 11)**: `src/app/api/recommendations/route.ts`, `src/services/recommendation.service.ts`, `src/lib/ai/recommendation-schema.ts`, `ai-recommendation-provider.ts`(인터페이스), `ai-recommendation-provider.factory.ts`, `gemini-recommendation-provider.ts`, `claude-recommendation-provider.ts`, `prompts/recommendation-{prompt-factory,response-schema,tool-schema}.ts`, `docs/api/recommendations.md`.
**코드 (변경 4)**: `src/lib/validation.ts`(`recommendationsRequestSchema`), `src/lib/composition.ts`(`getRecommendationService()` lazy 싱글턴), `src/types/api.ts`(추천 타입 re-export), AGENTS.md 4종.
**운영**: `_workspace/01_architect_baseline.md`(433줄, 13파일 명세 + Q1~Q14), `_workspace/02_backend_summary.md`, `_workspace/03_qa_report.md`.

### QA 결과 (recipe-qa)
**Q1~Q14 14/14 PASS, FAIL 0**. 계약 미러(enum·길이 제약 node 스크립트 diff MATCH), 응답 shape ↔ 미니앱 `recommendationsResponseSchema` 통과, camelCase 100%/snake_case 0, 서버 zod 5개 강제 경로 확인, requireUser 최상단, 에러 카탈로그(`AI_ERROR` 미존재), CORS(OPTIONS 204 + X-Toss-User-Id). `tsc --noEmit` exit 0 / `eslint` 0 / `next build`에 `ƒ /api/recommendations` 등재.

### 함정 메모 (다음 세션 주의)
- `ServiceError(code, message, cause?)` — statusCode 인자 없음. HTTP는 `api-response.ts`의 `STATUS_BY_CODE`가 code로 도출.
- **`AI_ERROR` 코드는 존재하지 않음**. AI 실패는 `AIProviderError(kind, msg)` → 서비스가 `AI_RATE_LIMITED`/`AI_PROVIDER_ERROR` 매핑.
- `withCors(response, request)` — 두 번째 인자 request.

### 다음 검증 필요 (세션 #7)
- **실 AI 키로 동적 통합 테스트** — provider 모킹 또는 staging 실호출로 200+items5, AI 4/6개·길이위반→502 확인(QA가 키 부재로 정적 분석 대체).
- `APPSINTOSS_ALLOWED_ORIGINS` staging/prod 등록 — 미니앱 실 출처(추천 엔드포인트도 동일 화이트리스트 적용).
- 미니앱은 백엔드 배포 후 자동 정상 동작(코드 변경 불요).

### SSOT 참조 (세션 #6)
- `docs/adr/ADR-011-recommendations.md` — 본 세션 결정 진실 공급원
- `_workspace/01_architect_baseline.md` — 구현 명세 + Q1~Q14
- `_workspace/03_qa_report.md` — QA 14/14 PASS
- 미니앱 계약: `airecipe-miniapp/src/lib/zod/recommendations.ts` (추종 대상 SSOT)

---

## 세션 #7 — 2026-05-30

### 목적
사용자 요청으로 AI 기본 Provider를 **Kimi(Moonshot AI)** 로 전환. Kimi는 OpenAI 호환 API라 ADR-008의 Factory + Adapter 격리에 무리 없이 편입. **응답 계약(`GeneratedRecipe`·`RecommendationItem[]`) 불변** → 미니앱·웹 프론트·API 계약 소비자 무영향. 본 세션은 architect(문서/계약 정합성) 담당분 — 코드 구현은 recipe-backend가 병렬 진행.

### 핵심 결정 (ADR-012)
- **신규 Kimi 어댑터 추가** (레시피 생성·추천 두 경로 각각). 구조화 출력은 OpenAI 호환 `response_format: { type: "json_object" }` → 기존 zod 검증(`recipe-schema.ts`·`recommendation-schema.ts`)이 단일 최종 게이트.
- **`openai` npm SDK + `baseURL` 방식**: `baseURL=https://api.moonshot.ai/v1`(env 오버라이드), 모델 `kimi-k2`(env 오버라이드).
- **기본 Provider `gemini` → `kimi`**. 두 Factory의 `AIProviderKind`에 `"kimi"` 추가, `DEFAULT_PROVIDER="kimi"`.
- **Gemini·Claude는 삭제 없이 롤백 보존**. `AI_PROVIDER=gemini`(또는 `claude`) 한 줄로 즉시 원복.
- 인터페이스(`AIRecipeProvider`·`AIRecommendationProvider`) 불변 — Service·Route·UI·미니앱 무변경(LSP/DIP).
- 환경변수: `KIMI_API_KEY`·`KIMI_MODEL`(기본 `kimi-k2`)·`KIMI_BASE_URL`(기본 `https://api.moonshot.ai/v1`).

### 산출물 (architect 분)
**ADR**: 신규 `docs/adr/ADR-012-kimi-moonshot-provider.md` (Context/Decision/근거/대안 A~D/결과 + 환경변수표 + ADR-002/008/011 관계).
**문서 갱신**: `docs/adr/ADR-008` 후속 ADR에 ADR-012 링크 1줄 추가. `docs/SESSION_NOTES.md`(본 항목). `CLAUDE.md` 변경 이력 1행.

### 함정 메모 (다음 세션 주의)
- **OpenAI 호환 `json_object`는 스키마/길이를 SDK 레벨에서 강제하지 못함** (Gemini `responseSchema`·Claude tool use와 다름). 모델이 형식을 어길 수 있으므로 **zod가 유일한 최종 검증**. 추천 5개 강제는 서버 `.length(5)`(ADR-011)가 보증 — Kimi에서도 동일하게 유효해야 함.
- 구조화 출력 스키마가 Provider별 3종(responseSchema/tool input_schema/json_object 프롬프트 지시)으로 늘어남 → 모두 동일 도메인 타입·zod로 수렴해야 하는 수동 동기화 부담 한 갈래 증가.
- 새 의존성 `openai` 1개 추가. ADR-008의 "보존 Provider 정리 검토"와 함께 Kimi 안정화 후 정리 별도 ADR.

### 다음 검증 필요 (세션 #8)
- recipe-backend 구현 완료 후 QA: 두 Factory `AIProviderKind`/`DEFAULT_PROVIDER`에 `kimi` 반영 + 신규 Kimi 어댑터가 인터페이스 만족 + `.env.local.example`에 `KIMI_*` 등재 + ADR-012 문서 ↔ 구현 정합.
- 실 Kimi(Moonshot) 키로 동적 통합 테스트 — 200 + `GeneratedRecipe`/items5, `json_object` 형식 위반 시 zod 실패 → 적절한 에러 코드 매핑 확인.
- 롤백 경로(`AI_PROVIDER=gemini`/`claude`) 회귀 무손상 확인.

### SSOT 참조 (세션 #7)
- `docs/adr/ADR-012-kimi-moonshot-provider.md` — 본 세션 결정 진실 공급원
- `docs/adr/ADR-008` — Factory·`AI_PROVIDER` 토글 토대(본 ADR이 직접 후속)

---

## 다음 세션에서 할 일

### 🔴 즉시 필요 (환경 설정 — 개발 시작 전 필수)
```bash
cp .env.local.example .env.local
# 아래 값을 채워야 앱이 동작함:
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
# AI_PROVIDER=gemini           # 기본 (ADR-008)
# GEMINI_API_KEY=              # AI_PROVIDER=gemini일 때 필수
# ANTHROPIC_API_KEY=           # AI_PROVIDER=claude(롤백) 모드에서만 필수
```
Supabase 대시보드에서 `supabase/schema.sql` 실행 (테이블 생성)

### 🟡 런타임 검증 (환경 키 확보 직후)
- [ ] 실 Supabase RLS 하 소유권 격리 통합 테스트 (내 레시피만 조회되는지)
- [ ] 실 Anthropic tool output의 zod 스키마 통과 확인 (레시피 생성 E2E)
- [ ] 인증 플로우 E2E: 회원가입 → 로그인 → 레시피 생성 → 저장 → 즐겨찾기 → 삭제

### 🟢 Sprint 2 후보 기능
우선순위 순:
1. **재료 기반 레시피 추천** — 보유 재료 입력 → 만들 수 있는 레시피 목록 AI 추천
2. **레시피 검색·필터** — 마이 레시피에서 키워드·즐겨찾기·난이도 필터
3. **소셜 공유** — 레시피 공유 링크 생성 (비로그인 읽기 허용)
4. **레시피 수정** — 저장된 레시피 편집 기능

### 🔵 기술 부채 / 개선사항
- [ ] `middleware.ts` 루트에 남아 있음 (삭제 필요, `src/proxy.ts`가 실제 엔트리)
- [ ] Supabase 타입 자동 생성 (`supabase gen types typescript`) 적용 고려
- [ ] 레시피 생성 스트리밍 UX 개선 — text 델타 점진 표시 완성도 향상
- [ ] 에러 토스트 UI — 현재 Alert 컴포넌트 기반, toast 라이브러리 전환 고려
- [ ] 페이지네이션 UI — GET /api/recipes의 meta.total·page 활용

---

## 파일 구조 (Sprint 1 기준)

```
AIReceipe/
├── src/
│   ├── app/
│   │   └── api/                  # API 라우트 전용 (recipes, recommendations) — 화면 없음
│   ├── lib/
│   │   ├── ai/                   # AI Providers (Gemini 기본 / Claude 보존, Factory) — ADR-008
│   │   └── supabase/             # client, server, middleware
│   ├── mappers/                  # snake_case ↔ camelCase
│   ├── repositories/             # RecipeRepository (추상) + SupabaseRecipeRepository
│   ├── services/                 # RecipeService, RecipeGenerationService
│   ├── types/                    # 공유 타입 SSOT (recipe.ts, api.ts, user.ts)
│   └── proxy.ts                  # Next.js proxy (ADR-007)
├── docs/
│   ├── adr/                      # ADR-001~007
│   ├── api/recipes.md            # API 문서
│   └── SESSION_NOTES.md          # ← 이 파일
├── supabase/
│   ├── schema.sql
│   └── migrations/
├── _workspace/                   # 에이전트 팀 산출물 (감사 추적용, 수정 X)
├── .claude/                      # 에이전트 정의 + 스킬
└── CLAUDE.md                     # 프로젝트 규칙
```

---

## 주요 참고 파일

| 파일 | 용도 |
|------|------|
| `_workspace/01_architect_api_contract.md` | API 계약 SSOT — 엔드포인트 요청/응답 shape |
| `_workspace/03_qa_report.md` | QA 리포트 — 검증된 경계면 목록 |
| `docs/adr/` | 아키텍처 결정 근거 |
| `src/types/` | 공유 TypeScript 타입 |
| `.env.local.example` | 필요한 환경변수 목록 |
