# AIReceipe

AI 기반 요리 레시피 안내 웹앱 (Next.js + TypeScript). 핵심 요구사항: 디자인 패턴·SOLID 등 소프트웨어 공학 원칙 준수, 철저한 문서화.

## 세션 시작 규칙

**모든 세션 시작 시 반드시 `docs/SESSION_NOTES.md`를 읽어라.**  
이 파일에는 완료된 스프린트 기록, 다음 할 일, 기술 부채, 주요 파일 경로가 누적된다.  
작업 완료 후에는 SESSION_NOTES.md를 업데이트하여 다음 세션을 위한 기록을 남겨라.

## 하네스: AI 레시피 앱 개발

**목표:** 계약 우선 설계 → 병렬 구현 → 점진적 QA로 레시피 앱을 개발하되, 디자인 패턴과 철저한 문서화를 강제한다.

**트리거:** 레시피 앱의 기능 개발·수정·추가, AI 레시피 생성/추천·영양 분석 구현, 페이지/API 추가, 아키텍처 설계, QA 검증, 문서화, 버그 수정, 리팩터링 등 이 앱 관련 작업 요청 시 `recipe-app-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**구성:** 에이전트 팀 4명(recipe-architect / recipe-backend / recipe-frontend / recipe-qa) + 워커 스킬 5개. **하네스는 monorepo 루트 `.claude/`에서 관리한다** (서브프로젝트 `.claude/` 아님). 루트에서는 `airecipe-router`가 백엔드/미니앱을 판별해 위임하며, 백엔드 팀은 기준 디렉토리 `airecipe-backend/`로 동작한다. 도메인 분리 워커 스킬은 `-backend` 접미사(`software-design-principles-backend`, `technical-documentation-backend`, `integration-coherence-qa-backend`) + `nextjs-fullstack`·`ai-recipe-integration`.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-21 | 초기 구성 (4인 팀 + 5 스킬 + 오케스트레이터) | 전체 | Next.js+TS 레시피 앱, 디자인 패턴·문서화 강조 |
| 2026-05-22 | 앱인토스 포팅 사양서 11챕터 + ADR-009 작성 (세션 #4) | `docs/appsintoss-port/`·`docs/adr/ADR-009` | 신규 RN+Granite 미니앱을 별 저장소로 개발하기 위한 단일 LLM-소비형 포팅 사양 — 현재 코드 무수정 |
| 2026-05-30 | `POST /api/recommendations` 신규 구현 (테마 기반 요리 5개 추천) + ADR-011 발행 | `src/app/api/recommendations/`·`src/services/recommendation.service.ts`·`src/lib/ai/*-recommendation-*`·`docs/adr/ADR-011`·`docs/api/recommendations.md` | 미니앱 404 원인 = 백엔드 라우트 미구현(ADR-016 "외부 작업 PENDING"). 미니앱 동결 계약(03 §3.8/ADR-016) 추종 구현. requireUser 보호 + AI 어댑터+Factory(Gemini/Claude) + 서버 zod `.length(5)` 5개 강제. QA Q1~Q14 14/14 PASS, typecheck/lint/build 통과. 미니앱 무변경 |
