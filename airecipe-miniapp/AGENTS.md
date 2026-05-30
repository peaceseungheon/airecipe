# AGENTS.md — airecipe-miniapp

신규 LLM 세션이 본 저장소의 디렉터리 구조와 책임을 빠르게 파악하기 위한 인덱스. 세션 시작 시 본 파일과 `CLAUDE.md`를 함께 읽는다.

> SSOT는 `docs/appsintoss-port/00~10` 챕터 + `docs/adr/ADR-009`. 본 파일은 디렉터리 책임 매핑만 다룬다.

## 레이어 의존성 방향

```
[pages (Granite 라우팅)]
       ▼
[src/components (TDS)]
       ▼
[src/hooks]
       ▼
[src/services/api-client]
       ▼
   (외부: 백엔드 HTTPS + Toss SDK)
```

규칙: 의존성은 안쪽(도메인)을 향한다. 화면 컴포넌트가 직접 외부(`fetch`, `@apps-in-toss/framework`)를 호출하지 않는다 — api-client·훅을 통과한다.

## 디렉터리 책임

### `pages/` — Granite 파일 기반 라우팅

- **책임**: 각 화면의 라우트 구현 정본. `intoss://airecipe-miniapp/<path>` 자동 매핑. 라우트 구현은 이 디렉터리 단일 계층(ADR-018 — 이전 `src/pages/` shim 2계층 제거).
- **핵심 규약**: `createRoute('/...')` 패턴. 비즈니스 로직은 화면 결합만 — presentational은 `src/components/`로 위임(`../src/...`/`../../src/...` 참조). `src/pages/` 신규 생성 금지.
- **주요 파일**: `index.tsx`(홈), `my-recipes.tsx`, `recipe/{generate,recommend,[id]}.tsx`, `_404.tsx`(404). 상세는 `pages/AGENTS.md`.
- **SSOT**: `docs/appsintoss-port/07-ROUTING.md` + `pages/AGENTS.md`.

### `src/_app.tsx` — 앱 컨테이너

- **책임**: 전역 Provider (Theme, ErrorBoundary, 컨텍스트) 부착. `AppsInToss.registerApp` 호출.
- **주의**: 화면별 상태가 아니라 앱 전체 필요한 것만.

### `src/components/` — TDS 기반 재사용 컴포넌트

- **책임**: TDS RN(`@toss/tds-react-native`) 위 컴포지션으로 만든 재사용 UI.
- **핵심 규약**: TDS 우선, 직접 `View/Text` 스타일링은 TDS 미커버 영역만.
- **SSOT**: `docs/appsintoss-port/06-UI-MAPPING.md` (현재 웹 컴포넌트 → TDS 매핑).

### `src/hooks/` — 데이터/식별자 훅

- **책임**: api-client 메서드 호출을 래핑한 React 훅.
- **주요 파일**:
  - `useTossUserId.ts` — `getAnonymousKey()` SDK 호출 + SecureStore/메모리 캐시.
  - `useRecipeGenerate.ts` — SSE 점진 렌더링 (08-STREAMING).
  - `useMyRecipes.ts`, `useRecipe.ts` 등 — 목록·단건 조회.
- **규약**: 모든 fetch는 api-client 통과. 훅이 직접 `fetch` 호출 금지.

### `src/services/` — API 클라이언트 단일 경로

- **책임**: 모든 백엔드 HTTPS 호출의 단일 진입점.
- **주요 파일**: `api-client.ts` — `API_BASE_URL`+`X-Toss-User-Id` 자동 주입, 일관 에러 매핑, 401 재시도, SSE 어댑터.
- **SSOT**: `docs/appsintoss-port/03-API-CONTRACT.md` + `05-AUTH.md` + `08-STREAMING.md`.

### `src/lib/` — zod 스키마·유틸

- **책임**: 응답 검증용 zod 스키마(`zod/`), 공용 유틸(`format/`, `parse/`).
- **주요 파일**: `lib/zod/recipe-schema.ts` 등.
- **규약**: 도메인 타입(`src/types/`)과 zod 스키마는 동일한 shape을 갖는다.

### `src/types/` — 공유 타입

- **책임**: 백엔드와 공유하는 도메인 타입 (별 저장소 `AIReceipe/src/types/`의 사본).
- **갱신**: 백엔드 측 SSOT가 변경되면 동기화 (commit hash·날짜 기록).
- **규약**: 본 저장소에서 임의 변경 금지. 변경 필요 시 architect가 백엔드 갱신 요청.

### `docs/appsintoss-port/` — 포팅 사양서 (SSOT)

- **책임**: 11챕터(00~10)로 미니앱 클라이언트 작성 사양 전부를 정의. 신규 LLM 세션의 최초 읽기 대상.
- **갱신**: 백엔드 측에서 작성된 사본. 미니앱 측 결정 변경 시 챕터 상단에 "마지막 동기화" 기록.

### `docs/adr/` — Architecture Decision Records

- **책임**: 미니앱·공통 결정 기록.
- **현재 보유**: ADR-001(Supabase), ADR-002(AI Adapter), ADR-005(소유권 404), ADR-008(Gemini 기본), ADR-009(앱인토스 포팅 결정).
- **신규 ADR**: ADR-010 이후 — 미니앱 측 결정. 최신: ADR-017(하단 탭바), ADR-018(라우트 구현 `pages/` 통합·`src/pages/` shim 제거).

### `granite.config.ts` — 앱 설정

- **책임**: `appName`, `displayName`, `icon`, `permissions`, `plugin-env` 환경변수 주입.
- **SSOT**: `docs/appsintoss-port/09-ENV-CONFIG.md` §9.2.

### `.env.example` / `.env.local`

- **책임**: 환경변수 템플릿·로컬 값.
- **금지**: API 키·시크릿 절대 두지 않음. 본 저장소는 `API_BASE_URL`, `APP_ENV`, `LOG_LEVEL`만.

### `.claude/agents/` — 에이전트 정의

- **책임**: 4명의 커스텀 에이전트 정의 (miniapp-architect, miniapp-api-client, miniapp-frontend, miniapp-qa).
- **갱신**: 역할 변경·신규 에이전트 추가 시. CLAUDE.md 변경 이력에 기록.

### `.claude/skills/` — 워커 스킬

- **책임**: 6개 스킬 (miniapp-orchestrator + 5 워커).
- **갱신**: 스킬 내용 보강·신규 스킬 추가 시. CLAUDE.md 변경 이력에 기록.

## 작업 흐름 요약

1. 신규 작업 요청 → `miniapp-orchestrator` 스킬 트리거 → 4인 팀 구성.
2. architect가 SSOT(`docs/appsintoss-port/`) 인용 위치 확정 → api-client·frontend에 통지.
3. api-client·frontend가 병렬 구현 → 모듈마다 qa에게 검증 요청.
4. qa가 경계면 교차 검증(`integration-coherence-qa`) + TDS 실재성 + 검수 정책(`appsintoss-publish-checklist`).
5. architect가 최종 문서 정합성 점검 → 종료.

## 워크스페이스

- `_workspace/` — 세션별 산출물 (입력·architect·api-client·frontend·qa 요약). 감사 추적용 보존.
- 부분 재실행 시 이전 산출물 활용.

## 흔한 함정

- 라우팅 루트는 루트 `pages/` 단일 계층 — 라우트 구현이 곧 여기 산다 (ADR-018). `src/pages/`(구 shim)는 제거됨. `src/pages/` 재생성 금지.
- `import.meta.env`는 빌드 시점 인라인 — 런타임 변경 불가.
- TDS 컴포넌트 시그니처는 SDK 버전 의존 — AppsInToss MCP로 확인.
- API 응답 shape 변경은 본 저장소에서 결정 금지 — 백엔드 저장소(`AIReceipe`)에서 결정.
