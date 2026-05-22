---
name: recipe-app-orchestrator
description: "AI 요리 레시피 안내 웹앱(Next.js+TS)을 개발하는 에이전트 팀을 조율하는 오케스트레이터. 레시피 앱 기능 개발, AI 레시피 생성/추천·영양 분석 구현, 페이지/API 추가, 아키텍처 설계, QA 검증을 통합 진행한다. 후속 작업: 레시피 앱 기능 수정·추가, 부분 재실행, 업데이트, 보완, 다시 실행, 이전 결과 개선, 버그 수정, 리팩터링, 문서화 요청 시에도 반드시 이 스킬을 사용. 레시피/요리/식단/영양 관련 앱 작업이면 트리거."
---

# Recipe App Orchestrator

AI 요리 레시피 안내 웹앱을 개발하는 에이전트 팀을 조율하여 동작하는 코드와 철저한 문서를 생성하는 통합 스킬. 소프트웨어 공학 원칙(디자인 패턴, SOLID)과 철저한 문서화가 핵심 요구사항이다.

## 실행 모드: 에이전트 팀

풀스택 개발은 백엔드↔프론트 간 API 계약 합의와 QA의 실시간 경계면 피드백이 품질을 좌우하므로 에이전트 팀이 최적이다. 패턴은 **계약 우선 파이프라인 + 병렬 구현 + 점진적 QA**의 복합형이다.

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 주요 스킬 | 출력 |
|------|-------------|------|----------|------|
| `recipe-architect` | recipe-architect (커스텀) | 요구사항·아키텍처·API 계약·문서 총괄 | software-design-principles, technical-documentation | `_workspace/01_architect_*.md`, `src/types/`, `docs/adr/`, AGENTS.md |
| `recipe-backend` | recipe-backend (커스텀) | API Route·Service·Repository·AI 통합 | nextjs-fullstack, ai-recipe-integration, software-design-principles | `src/app/api/`, `src/services/`, `src/lib/ai/`, `docs/api/` |
| `recipe-frontend` | recipe-frontend (커스텀) | 페이지·컴포넌트·훅·UI 상태 | nextjs-fullstack, software-design-principles | `src/app/`, `src/components/`, `src/hooks/` |
| `recipe-qa` | recipe-qa (커스텀, general-purpose 기반) | 통합 정합성·계약 준수 검증 | integration-coherence-qa | `_workspace/03_qa_report.md` |

> 모든 팀원은 `model: "opus"`로 스폰한다.

## 워크플로우

### Phase 0: 컨텍스트 확인 (후속 작업 지원)
1. `_workspace/` 존재 여부와 `src/` 코드 존재 여부를 확인한다.
2. 실행 모드 결정:
   - **`_workspace/` 미존재** → 초기 실행. Phase 1로.
   - **존재 + 사용자가 부분 수정/버그 수정/기능 추가 요청** → 부분 재실행. 영향받는 팀원만 스폰하고, 기존 산출물 중 대상만 수정. 계약에 영향이 있으면 아키텍트를 반드시 포함한다.
   - **존재 + 완전히 새 요구사항** → 새 실행. 기존 `_workspace/`를 `_workspace_{YYYYMMDD_HHMMSS}/`로 이동 후 Phase 1.
3. 부분 재실행 시 이전 산출물 경로를 각 팀원 프롬프트에 포함하여 기존 결과를 읽고 피드백을 반영하도록 지시한다.

### Phase 1: 준비
1. 사용자 요구사항을 분석한다 — 어떤 기능/화면/AI 기능이 필요한가, 범위는 어디까지인가.
2. 요구사항이 모호하면 추측하지 말고 사용자에게 확인한다.
3. `_workspace/` 생성, 요구사항을 `_workspace/00_input/requirements.md`에 저장.

### Phase 2: 팀 구성

1. 팀 생성 (TeamCreate, 모든 멤버 `model: "opus"`):
   - `recipe-architect` (agent_type: recipe-architect)
   - `recipe-backend` (agent_type: recipe-backend)
   - `recipe-frontend` (agent_type: recipe-frontend)
   - `recipe-qa` (agent_type: recipe-qa)
2. 작업 등록 (TaskCreate, 의존성 명시):
   - T1 `요구사항·아키텍처·API 계약 정의` → architect
   - T2 `공유 타입(src/types/)·ADR·루트 AGENTS.md 작성` → architect (depends_on T1)
   - T3 `백엔드 API·Service·AI 통합 구현` → backend (depends_on T2)
   - T4 `프론트 페이지·컴포넌트·훅 구현` → frontend (depends_on T2)
   - T5 `각 모듈 경계면 점진적 검증` → qa (depends_on T3, T4 — 단, 모듈별로 조기 시작)
   - T6 `API 문서·컴포넌트 문서 작성` → backend, frontend (각자 담당분)

> 팀원당 작업 수가 적정 범위(4~6개)가 되도록 큰 기능은 모듈 단위로 T3~T5를 분할한다.

### Phase 3: 계약 우선 설계 (architect 선행)
**실행 방식:** architect가 먼저 단독 진행, 나머지는 대기.

1. architect가 요구사항 → 도메인 모델 → 아키텍처 → **API 계약**을 정의하고 `src/types/`에 공유 타입을 작성한다.
2. 패턴 결정을 `docs/adr/`에 ADR로 기록한다.
3. 계약 확정 시 architect가 `recipe-backend`와 `recipe-frontend`에게 계약 경로(`_workspace/01_architect_api_contract.md` + `src/types/`)를 **동시에** SendMessage로 통지한다.

> 계약이 확정되기 전에 backend/frontend가 구현을 시작하면 경계면 불일치가 발생한다. 이 게이트를 반드시 지킨다.

### Phase 4: 병렬 구현 + 점진적 QA
**실행 방식:** backend와 frontend가 병렬, QA가 모듈별로 즉시 검증.

**팀원 간 통신 규칙:**
- `recipe-backend`는 각 API 완성 시 **실제 응답 shape**(필드명·래핑·동기/비동기)을 `recipe-frontend`에게 SendMessage로 통지한다.
- `recipe-frontend`는 훅 작성 전 해당 API의 응답 shape을 backend에게 확인한다.
- API 또는 페이지가 하나 완성될 때마다 담당자가 `recipe-qa`에게 검증을 요청한다 (incremental QA).
- `recipe-qa`는 경계면 이슈 발견 시 생산자·소비자 **양쪽**에게 파일:라인+수정법을 통지한다. 계약 결함이면 architect에게 통지한다.
- 계약을 바꿔야 하는 사정이 생기면 backend/frontend는 직접 바꾸지 않고 architect에게 먼저 알린다.

**산출물 저장:**

| 팀원 | 코드 출력 | 워크스페이스 요약 |
|------|----------|------------------|
| backend | `src/app/api/`, `src/services/`, `src/repositories/`, `src/lib/ai/`, `src/mappers/` | `_workspace/02_backend_summary.md` |
| frontend | `src/app/`, `src/components/`, `src/hooks/` | `_workspace/02_frontend_summary.md` |
| qa | (수정 요청은 메시지로) | `_workspace/03_qa_report.md` |

**리더 모니터링:**
- 팀원이 유휴 상태가 되면 자동 알림 수신. TaskGet으로 전체 진행률 확인.
- 특정 경계면에서 backend↔frontend가 막히면 SendMessage로 architect를 끌어들여 계약을 조정.

### Phase 5: 통합 검증 및 문서 마무리
1. 모든 구현 작업 완료 대기 (TaskGet).
2. QA가 전체 경계면 최종 스윕을 수행하고 `_workspace/03_qa_report.md`를 확정한다.
3. QA 리포트의 실패 항목이 모두 해소될 때까지 해당 팀원이 수정 (최대 2~3회 루프, 무한 루프 방지).
4. architect가 문서 정합성을 점검한다 — API 문서 ↔ 실제 응답 ↔ 공유 타입 일치, ADR 최신화, AGENTS.md 갱신.
5. `npm run build`와 `npm run lint`로 최종 확인. 빌드 통과가 런타임 정상을 보장하지 않으므로 QA 통과를 함께 완료 기준으로 삼는다.

### Phase 6: 정리 및 진화
1. 팀원에게 종료 요청 (SendMessage), 팀 정리 (TeamDelete).
2. `_workspace/` 보존 (감사 추적용).
3. 사용자에게 결과 요약 + QA 리포트 핵심을 보고한다.
4. 피드백을 요청한다 ("결과에서 개선할 부분이 있나요? 팀 구성/워크플로우를 바꾸고 싶나요?"). 피드백이 있으면 하네스 진화 경로(아래)로 반영하고 CLAUDE.md 변경 이력에 기록한다.

## 데이터 흐름

```
[리더] → TeamCreate(4명)
  Phase 3: [architect] → API 계약 + src/types/ + ADR
                │ SendMessage(계약 경로) ↓ ↓
  Phase 4: [backend] ←─ shape 통지 ─→ [frontend]
                │                          │
                ↓ (모듈 완성마다)           ↓
              [qa] 경계면 교차검증 → 양쪽에 수정 통지
                │
  Phase 5: 최종 스윕 + 문서 정합성(architect) + build/lint
                ↓
           동작 코드 + docs/ + QA 리포트
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| architect 계약 미완 상태로 구현 시작 우려 | Phase 3 게이트 강제 — 계약 통지 전 backend/frontend 작업 보류 |
| 팀원 1명 실패/중지 | 리더가 감지 → SendMessage로 상태 확인 → 재시작. 실패 시 작업 재할당 |
| backend↔frontend 응답 shape 충돌 | architect를 끌어들여 계약을 SSOT로 조정, 양쪽이 따름 |
| QA 수정 루프가 수렴 안 함 | 최대 2~3회 후 중단, 미해결 이슈를 리포트에 명시하고 사용자에게 보고 |
| 팀원 과반 실패 | 사용자에게 알리고 진행 여부 확인 |
| 빌드 통과했으나 QA 경계면 실패 | 빌드만으로 완료 처리 금지, QA 통과까지 수정 |

## 테스트 시나리오

### 정상 흐름
1. 사용자: "보유 재료로 레시피를 추천받고 영양 정보를 보여주는 기능을 만들어줘".
2. Phase 1: 기능 범위 분석, `_workspace/00_input/`에 저장.
3. Phase 2: 4명 팀 + T1~T6 작업 등록.
4. Phase 3: architect가 `POST /api/recipes/recommend` 계약·`src/types/recipe.ts`·추천 전략 패턴 ADR 작성 후 backend/frontend에 통지.
5. Phase 4: backend가 추천 Service+Claude 어댑터 구현, 응답 shape을 frontend에 통지 → frontend가 추천 화면+훅 구현 → QA가 응답shape↔훅타입, AI출력↔UI 경계 검증.
6. Phase 5: 최종 스윕, 문서 정합성 확인, build/lint 통과.
7. 결과: 동작하는 추천 기능 + `docs/api/`·ADR + QA 리포트.

### 에러 흐름
1. Phase 4에서 frontend가 `data.recipes`를 기대하나 backend가 `{ data: { recipes } }`로 래핑.
2. QA가 응답shape↔훅타입 교차검증에서 불일치 발견.
3. QA가 backend·frontend 양쪽에 파일:라인+수정법 통지, 계약 모호성이면 architect에게도 통지.
4. architect가 계약을 명확화(`{ recipes, total }`), backend/frontend가 양쪽 정렬.
5. QA 재검증 통과 후 Phase 5 진행.

## 하네스 진화
실행 후 피드백 유형별 반영:
- 결과물 품질 → 해당 스킬 수정 (예: AI 레시피가 부실 → `ai-recipe-integration` 보강)
- 역할/책임 → 에이전트 정의 수정 (예: 보안 검토 필요 → 에이전트 추가)
- 워크플로우 순서 → 이 오케스트레이터 수정
- 트리거 누락 → description 확장

모든 변경은 CLAUDE.md 변경 이력 테이블에 날짜·내용·대상·사유를 기록한다.
