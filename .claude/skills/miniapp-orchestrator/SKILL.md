---
name: miniapp-orchestrator
description: "앱인토스 RN 미니앱(airecipe-miniapp) 개발을 조율하는 오케스트레이터. Phase 0(스캐폴딩)~Phase 5(출시) 단계 진행, Granite 라우팅·TDS 컴포넌트·SSE 소비·검수 통과를 통합 진행한다. 후속 작업: 기능 수정·추가, 부분 재실행, 업데이트, 보완, 다시 실행, 이전 결과 개선, 버그 수정, 리팩터링, 문서화, 검수 점검 요청 시에도 반드시 이 스킬을 사용. 미니앱/RN/Granite/TDS/앱인토스/출시 관련 작업이면 트리거."
---

# Miniapp Orchestrator (앱인토스 RN 미니앱 오케스트레이터)

`airecipe-miniapp`(앱인토스 RN+Granite+TDS 미니앱)을 개발하는 에이전트 팀을 조율하여 동작하는 코드와 철저한 문서를 생성하는 통합 스킬. 미니앱 클라이언트는 백엔드(`airecipe-backend/`, 같은 monorepo)의 API를 HTTPS로 호출한다.

## 기준 디렉토리 (monorepo)

이 저장소는 monorepo이며 미니앱 코드는 **`airecipe-miniapp/`** 하위에 있다. 이 스킬과 모든 팀원이 참조하는 상대 경로(`src/`, `pages/`, `docs/`, `_workspace/`, `granite.config.ts` 등)는 전부 **`airecipe-miniapp/` 기준**이다.

- 작업 시작 시 기준 디렉토리가 `airecipe-miniapp/`임을 확인한다.
- 팀원(에이전트) 스폰 시 프롬프트에 **"기준 디렉토리: `airecipe-miniapp/` — 이 스킬·에이전트 정의의 모든 상대 경로는 이 접두사 하위로 해석·생성하라"** 를 반드시 포함한다.
- 빌드/린트(`pnpm typecheck`/`lint`) 등 명령도 `airecipe-miniapp/`에서 실행한다.
- 백엔드 API 계약 SSOT는 `airecipe-backend/`의 코드·문서를 직접 참조할 수 있다(같은 저장소).

## 실행 모드: 에이전트 팀

미니앱 개발은 백엔드 응답 shape↔api-client↔화면, TDS 매핑 실재성, 검수 정책 등 다수의 경계면이 있어 에이전트 팀이 최적이다. 패턴은 **SSOT 우선 + 병렬 구현 + 점진적 QA**의 복합형이다.

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 주요 스킬 | 출력 |
|------|-------------|------|----------|------|
| `miniapp-architect` | miniapp-architect (커스텀) | 아키텍처·SSOT 인용·ADR·문서 총괄 | software-design-principles-miniapp, technical-documentation-miniapp, granite-rn-development, appsintoss-publish-checklist | `_workspace/01_architect_*.md`, `docs/adr/`, `AGENTS.md` |
| `miniapp-api-client` | miniapp-api-client (커스텀) | 백엔드 호출 단일 경로·useTossUserId·zod·SSE 어댑터 | granite-rn-development, software-design-principles-miniapp, technical-documentation-miniapp | `src/services/`, `src/hooks/useTossUserId.ts`, `src/lib/zod/` |
| `miniapp-frontend` | miniapp-frontend (커스텀) | Granite pages·TDS RN·SSE 소비·낙관적 업데이트 | granite-rn-development, software-design-principles-miniapp, technical-documentation-miniapp, appsintoss-publish-checklist | `pages/`, `src/components/`, `src/_app.tsx` |
| `miniapp-qa` | miniapp-qa (커스텀, general-purpose 기반) | 통합 정합성·TDS 실재성·검수 정책 | integration-coherence-qa-miniapp, appsintoss-publish-checklist | `_workspace/03_qa_report.md` |

> 모든 팀원은 `model: "opus"`로 스폰한다. SSOT는 `docs/appsintoss-port/00~10` + `docs/adr/ADR-009`. 본 저장소는 백엔드를 보유하지 않는다.

## 워크플로우

### Phase 0: 컨텍스트 확인 (후속 작업 지원)
1. `_workspace/` 존재 여부와 `src/`·`pages/` 코드 존재 여부를 확인.
2. 실행 모드 결정:
   - **`_workspace/` 미존재** → 초기 실행. Phase 1로.
   - **존재 + 부분 수정/버그 수정/기능 추가 요청** → 부분 재실행. 영향받는 팀원만 스폰. SSOT(03/06/07/08) 변경 영향이 있으면 architect 포함.
   - **존재 + 새 요구사항** → 새 실행. 기존 `_workspace/`를 `_workspace_{YYYYMMDD_HHMMSS}/`로 이동 후 Phase 1.
3. 부분 재실행 시 이전 산출물 경로를 각 팀원 프롬프트에 포함.
4. **Phase 진입 판정**: `docs/appsintoss-port/10-SPRINT-PLAN.md`의 수용 기준(AC0.* ~ AC5.*)으로 현재 위치 확인. 다음 Phase 진입 가능한지 architect와 합의.

### Phase 1: 준비
1. 사용자 요구사항을 분석. 어떤 기능·화면·SSOT 영역에 해당하는지.
2. 모호하면 추측하지 말고 사용자에게 확인.
3. `_workspace/` 생성, 요구사항을 `_workspace/00_input/requirements.md`에 저장.

### Phase 2: 팀 구성
1. 팀 생성 (`TeamCreate`, 모든 멤버 `model: "opus"`):
   - `miniapp-architect` (agent_type: miniapp-architect)
   - `miniapp-api-client` (agent_type: miniapp-api-client)
   - `miniapp-frontend` (agent_type: miniapp-frontend)
   - `miniapp-qa` (agent_type: miniapp-qa)
2. 작업 등록 (`TaskCreate`, 의존성 명시):
   - T1 `요구사항 분석·SSOT 인용 위치 확정·ADR 갱신 검토` → architect
   - T2 `api-client 메서드·useTossUserId·zod·SSE 어댑터 구현` → api-client (depends_on T1)
   - T3 `pages/·components/·_app.tsx 구현` → frontend (depends_on T1)
   - T4 `모듈별 경계면 점진 검증` → qa (depends_on T2, T3 — 단, 모듈별 조기 시작)
   - T5 `ADR·AGENTS.md·SESSION 기록 마무리` → architect (depends_on T4)

### Phase 3: SSOT 우선 설계 (architect 선행)
**실행 방식:** architect가 단독 선행, 나머지는 대기.

1. architect가 요구사항을 `docs/appsintoss-port/`의 어느 챕터·절을 SSOT로 따르는지 인용 위치를 확정. 신규 결정이 필요하면 ADR 추가.
2. SSOT 인용 확정 시 architect가 `miniapp-api-client`·`miniapp-frontend`에게 **동시에** SendMessage로 통지 (인용 경로 + ADR 번호).

> SSOT 확정 전에 api-client/frontend가 구현을 시작하면 경계면 불일치가 발생한다. 게이트를 지킨다.

### Phase 4: 병렬 구현 + 점진적 QA
**실행 방식:** api-client와 frontend가 병렬, QA가 모듈별 즉시 검증.

**팀원 간 통신 규칙:**
- `miniapp-api-client`는 각 메서드 완성 시 시그니처(입력·반환·에러 카테고리)를 `miniapp-frontend`에게 SendMessage로 통지.
- `miniapp-frontend`는 화면 작성 전 필요한 api-client 메서드를 확인. 없으면 추가 요청.
- 모듈(메서드/화면) 완성마다 담당자가 `miniapp-qa`에게 검증 요청 (incremental QA).
- `miniapp-qa`는 경계면 이슈 발견 시 생산자·소비자 **양쪽**에 파일:라인+수정법 통지. SSOT 결함이면 architect에게 통지.
- SSOT 변경이 필요한 사정은 api-client·frontend가 직접 바꾸지 않고 architect에게 먼저 알린다.

**산출물 저장:**

| 팀원 | 코드 출력 | 워크스페이스 요약 |
|------|----------|------------------|
| api-client | `src/services/api-client.ts`, `src/hooks/useTossUserId.ts`, `src/lib/zod/` | `_workspace/02_api_client_summary.md` |
| frontend | `pages/`, `src/components/`, `src/_app.tsx` | `_workspace/02_frontend_summary.md` |
| qa | (수정 요청은 메시지로) | `_workspace/03_qa_report.md` |

**리더 모니터링:**
- 팀원이 idle이 되면 자동 알림. `TaskGet`으로 진행률 확인.
- 경계면에서 api-client↔frontend가 막히면 architect를 끌어들여 SSOT 인용을 명확화.

### Phase 5: 통합 검증 및 문서 마무리
1. 모든 구현 작업 완료 대기 (`TaskGet`).
2. QA가 전체 경계면 최종 스윕 → `_workspace/03_qa_report.md` 확정.
3. QA 리포트 실패 항목 해소 (최대 2~3회 루프).
4. architect가 문서 정합성 점검 — ADR ↔ 실제 구현, AGENTS.md 갱신, SESSION 기록.
5. `pnpm typecheck`와 `pnpm lint`로 최종 확인. 빌드 통과가 런타임 정상을 보장하지 않으므로 QA 통과를 완료 기준으로 함께 본다.
6. **Phase별 수용 기준 통과 점검** (`10-SPRINT-PLAN`의 AC*.*).

### Phase 6: 정리 및 진화
1. 팀원에게 종료 요청 (`SendMessage`), 팀 정리 (`TeamDelete`).
2. `_workspace/` 보존 (감사 추적).
3. 사용자에게 결과 요약 + QA 리포트 핵심 보고.
4. 피드백 요청 — 결과·구성·워크플로우 개선점. 반영 시 하네스 진화 경로 + `CLAUDE.md` 변경 이력 기록.

## 데이터 흐름

```
[리더] → TeamCreate(4명)
  Phase 3: [architect] → SSOT 인용 확정 + ADR (필요 시)
                │ SendMessage(인용 경로) ↓ ↓
  Phase 4: [api-client] ←─ 시그니처 통지 ─→ [frontend]
                │                              │
                ↓ (모듈 완성마다)               ↓
              [qa] 경계면 교차검증 → 양쪽에 수정 통지
                │
  Phase 5: 최종 스윕 + 문서 정합성(architect) + typecheck/lint
                ↓
           동작 미니앱 + docs/ + QA 리포트
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| architect SSOT 인용 미완 상태로 구현 시작 우려 | Phase 3 게이트 강제 — 인용 통지 전 api-client/frontend 작업 보류 |
| 팀원 1명 실패/중지 | 리더 감지 → SendMessage로 상태 확인 → 재시작. 실패 시 작업 재할당 |
| api-client↔frontend 시그니처 충돌 | architect 끌어들여 SSOT 인용을 단일화, 양쪽 정렬 |
| QA 수정 루프 미수렴 | 2~3회 후 중단, 미해결 이슈를 리포트에 명시·사용자 보고 |
| TDS 매핑 실재성 실패 (06) | AppsInToss MCP로 표본 검증 후 06 갱신 요청. 실재 안 하는 컴포넌트는 합성/대안으로 교체 |
| 검수 정책 위반 가능성 | `appsintoss-publish-checklist` 스킬로 사전 점검. 위반 시 architect가 새 ADR로 우회 결정 |
| 빌드 통과했으나 QA 경계면 실패 | 빌드만으로 완료 처리 금지, QA 통과까지 수정 |

## 테스트 시나리오

### 정상 흐름
1. 사용자: "Phase 2 — 레시피 생성 화면 + SSE 스트리밍 구현해줘".
2. Phase 1: 기능 범위 분석, `_workspace/00_input/`에 저장.
3. Phase 2: 4명 팀 + T1~T5 작업 등록.
4. Phase 3: architect가 `03-API-CONTRACT.md §3.1` + `08-STREAMING.md §8.x` + `06-UI-MAPPING.md`(SearchForm/RecipeDisplay/NutritionPanel) 인용 위치 확정, api-client/frontend 동시 통지.
5. Phase 4: api-client가 `generateRecipe(...)` 메서드 + SSE 어댑터 구현, 시그니처를 frontend에 통지 → frontend가 생성 화면+점진 렌더링 구현 → QA가 청크 처리·TDS·라우팅 검증.
6. Phase 5: 최종 스윕, AC2.1~AC2.6 통과 확인, typecheck/lint 통과.
7. 결과: 동작 화면 + 갱신된 ADR(필요시) + QA 리포트.

### 에러 흐름
1. Phase 4에서 frontend가 SSE `recipe` 청크의 `recipe` 필드를 기대하나 api-client가 `data.recipe`로 래핑 노출.
2. QA가 SSE 청크↔소비 코드 교차검증에서 불일치 발견.
3. QA가 api-client·frontend 양쪽에 파일:라인+수정법 통지. 08 SSOT 인용 모호성이면 architect에게도 통지.
4. architect가 08 §8.x 인용을 명확화하고 양쪽 정렬.
5. QA 재검증 통과 후 Phase 5 진행.

## 하네스 진화
실행 후 피드백 유형별 반영:
- 결과물 품질 → 해당 스킬 수정 (예: TDS 매핑 부실 → `granite-rn-development` 또는 06 챕터 보강)
- 역할/책임 → 에이전트 정의 수정 (예: 출시 검수 단독 에이전트 필요 → 추가)
- 워크플로우 순서 → 이 오케스트레이터 수정
- 트리거 누락 → description 확장

모든 변경은 `CLAUDE.md` 변경 이력 테이블에 날짜·내용·대상·사유를 기록.
