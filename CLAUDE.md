# AIReceipe (monorepo)

AI 기반 요리 레시피 안내 서비스. 두 서브프로젝트로 구성된 monorepo다.

| 서브프로젝트 | 디렉토리 | 스택 | 역할 |
|-------------|---------|------|------|
| 백엔드 | [`airecipe-backend/`](airecipe-backend/) | Next.js + TypeScript + Supabase + AI Provider(Gemini/Claude) | API·Service·Repository·AI·DB(SSOT) |
| 미니앱 | [`airecipe-miniapp/`](airecipe-miniapp/) | React Native + Granite + TDS (앱인토스) | 미니앱 클라이언트. 백엔드 API를 HTTPS 호출 |

각 서브프로젝트의 상세 규칙·진행 상황은 해당 디렉토리의 `CLAUDE.md`를 따른다. 서브프로젝트에서 작업할 때는 그 디렉토리를 기준으로 한다(빌드·테스트·경로).

## 하네스 (에이전트 팀)

하네스는 **이 루트 `.claude/`에서 단일 관리**한다. 두 도메인 팀이 공존하며, 최상위 라우터가 작업을 분배한다.

- **라우터:** `airecipe-router` — 루트에서 레시피 앱 작업을 받으면 백엔드/미니앱을 판별해 해당 오케스트레이터로 위임하고 기준 디렉토리를 확정한다. 양쪽에 걸친 작업(계약 변경 등)은 백엔드 먼저 → 미니앱 정렬 순서로 조율한다.
- **백엔드 팀:** 오케스트레이터 `recipe-app-orchestrator`, 에이전트 `recipe-architect`/`recipe-backend`/`recipe-frontend`/`recipe-qa`, 기준 디렉토리 `airecipe-backend/`.
- **미니앱 팀:** 오케스트레이터 `miniapp-orchestrator`, 에이전트 `miniapp-architect`/`miniapp-api-client`/`miniapp-frontend`/`miniapp-qa`, 기준 디렉토리 `airecipe-miniapp/`.
- **도메인 분리 워커 스킬:** 이름이 겹치는 3종은 `-backend`/`-miniapp` 접미사로 분리한다 — `software-design-principles-*`, `technical-documentation-*`, `integration-coherence-qa-*`. 단일 도메인 스킬은 접미사 없이: `nextjs-fullstack`·`ai-recipe-integration`(백엔드), `granite-rn-development`·`appsintoss-publish-checklist`(미니앱).

> 에이전트/스킬 정의의 상대 경로(`src/`, `docs/`, `_workspace/`, `pages/` 등)는 모두 **각 팀의 기준 디렉토리 하위**로 해석한다. 오케스트레이터가 팀원 스폰 시 기준 디렉토리를 프롬프트에 명시한다.

## 변경 이력

| 날짜 | 변경 내용 | 사유 |
|------|----------|------|
| 2026-05-29 | 두 독립 저장소(backend·miniapp)를 단일 monorepo로 통합(이력 보존), 하네스를 루트 `.claude/`로 이전 — 두 팀 유지 + `airecipe-router` 추가, 충돌 워커 스킬 3종 도메인 접미사 분리 | 단일 저장소 관리 + 하네스 중앙화 |
