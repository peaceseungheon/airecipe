---
name: airecipe-router
description: "AIReceipe monorepo의 최상위 라우터. 루트에서 레시피 앱 작업 요청을 받으면 대상이 백엔드(airecipe-backend/, Next.js·API·Supabase·AI Provider)인지 미니앱(airecipe-miniapp/, RN·Granite·TDS·앱인토스 출시)인지 판별해 해당 팀 오케스트레이터로 위임하고 기준 디렉토리를 확정한다. 어느 서브프로젝트인지 불명확한 레시피/요리/식단/영양 앱 작업, 또는 두 프로젝트에 걸친 작업(API 계약 변경의 양쪽 반영 등) 요청 시 이 스킬을 먼저 사용한다."
---

# AIReceipe Router (monorepo 최상위 라우터)

이 저장소는 monorepo로, 두 개의 독립 하네스 팀이 서브프로젝트별로 존재한다:

| 서브프로젝트 | 기준 디렉토리 | 오케스트레이터 | 도메인 |
|-------------|--------------|---------------|--------|
| 백엔드 | `airecipe-backend/` | `recipe-app-orchestrator` | Next.js+TS API Route·Service·Repository·Supabase·AI Provider(Gemini/Claude) |
| 미니앱 | `airecipe-miniapp/` | `miniapp-orchestrator` | React Native+Granite+TDS·앱인토스 출시 검수 |

## 역할

루트에서 들어온 작업 요청을 **올바른 팀으로 라우팅**하고, 그 팀이 자신의 기준 디렉토리 하위에서만 동작하도록 보장한다. 라우터 자신은 구현하지 않는다 — 판별 후 위임만 한다.

## 라우팅 절차

### 1. 대상 서브프로젝트 판별

요청의 신호로 대상을 정한다:

| 신호 | 대상 |
|------|------|
| API, Route Handler, Service, Repository, Supabase, RLS, DB 마이그레이션, AI Provider/프롬프트, `/api/...`, 영양 분석 로직, CORS | **백엔드** |
| 화면/페이지, 컴포넌트, Granite, TDS, RN, `pages/`, navigation, SSE 소비 훅, `getAnonymousKey`/Toss 인증, 광고 SDK, 앱인토스 콘솔/출시/검수 | **미니앱** |
| 명시적 경로(`airecipe-backend/...` vs `airecipe-miniapp/...`) | 해당 쪽 |
| 양쪽에 걸침 (예: API 계약 변경 → 백엔드 구현 + 미니앱 소비 정렬) | **순차 위임** (아래 3) |

불명확하면 추측하지 말고 사용자에게 "백엔드/미니앱 중 어느 쪽 작업인가요?"를 확인한다.

### 2. 단일 대상 위임

1. 기준 디렉토리를 확정한다 (`airecipe-backend/` 또는 `airecipe-miniapp/`).
2. 해당 오케스트레이터 스킬(`recipe-app-orchestrator` 또는 `miniapp-orchestrator`)을 호출한다.
3. 그 오케스트레이터의 "기준 디렉토리 (monorepo)" 섹션 규칙에 따라, 팀원 스폰 시 기준 디렉토리가 프롬프트에 반드시 포함되도록 한다.

### 3. 양쪽에 걸친 작업 (계약 우선 순서)

API 계약·응답 shape이 바뀌는 작업은 **백엔드 먼저, 미니앱 나중**:

1. `recipe-app-orchestrator`로 백엔드에서 계약·구현·문서를 확정한다.
2. 확정된 응답 shape / 엔드포인트 / 인증 헤더를 명시적으로 정리한다.
3. `miniapp-orchestrator`로 미니앱의 api-client·zod·화면을 그 계약에 정렬한다.
4. 두 서브프로젝트의 경계면(미니앱 api-client 타입 ↔ 백엔드 응답)이 일치하는지 최종 확인한다.

> 미니앱은 `airecipe-miniapp/docs/appsintoss-port/03-API-CONTRACT.md`를 SSOT 사본으로 두지만, 원본 계약은 백엔드 코드/문서다. 계약 변경은 항상 백엔드에서 시작한다.

## 하네스 구조 (참고)

- 에이전트(루트 `.claude/agents/`): `recipe-architect`·`recipe-backend`·`recipe-frontend`·`recipe-qa` (백엔드 팀), `miniapp-architect`·`miniapp-api-client`·`miniapp-frontend`·`miniapp-qa` (미니앱 팀).
- 도메인별 분리 스킬: `*-backend` / `*-miniapp` 접미사 (`software-design-principles`, `technical-documentation`, `integration-coherence-qa`).
- 공용/단일 도메인 스킬: `nextjs-fullstack`·`ai-recipe-integration`(백엔드), `granite-rn-development`·`appsintoss-publish-checklist`(미니앱).

## 하네스 진화

라우팅 규칙·기준 디렉토리·서브프로젝트 추가 변경은 이 라우터를 수정하고, 루트 `CLAUDE.md` 변경 이력에 날짜·내용·대상·사유를 기록한다.
