# 00. 앱인토스 포팅 — 개요 (입구 문서)

> **이 챕터를 읽기 전에 알아야 할 것**: 없음. 본 문서가 포팅 사양서 묶음의 입구이며, 이 묶음을 처음 읽는 신규 LLM 에이전트는 반드시 이 챕터부터 시작한다.
>
> **이 챕터 완료 후 다음 챕터**: [01-FEATURES.md](./01-FEATURES.md) — Sprint 1 6기능 인벤토리.

---

## 0.1 이 앱이 무엇을 하는가

**AIReceipe**는 사용자가 입력한 요리 이름을 기반으로 AI(Gemini 또는 Claude)가 레시피와 영양 정보를 생성하고, 사용자가 이를 자신의 라이브러리에 저장/관리하는 웹앱이다.

- 핵심 사용자 흐름: 요리명 입력 → AI 생성(스트리밍 표시) → 저장 → 마이 레시피에서 조회/즐겨찾기/삭제.
- 부가 가치: 영양 정보(칼로리·탄단지·식이섬유)와 건강 노트가 매 생성마다 함께 제공된다.

기능 6종 상세는 [01-FEATURES.md](./01-FEATURES.md) 참조.

## 0.2 왜 앱인토스 포팅이 필요한가

현재 AIReceipe는 Vercel에 배포된 Next.js 웹앱이다. 사용자가 토스 플랫폼(앱인토스 미니앱)으로 신규 진출하여 30M 토스 사용자에게 동일 가치를 제공하고자 한다.

포팅의 결정 사항(상세 근거는 [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md)):

| 결정 | 내용 |
|------|------|
| **백엔드 처리** | 현재 Next.js API를 Vercel에 그대로 유지. 미니앱은 HTTPS만 호출. |
| **인증** | Supabase Auth 제거. `getAnonymousKey()`로 미니앱별 고유 hash를 Toss userId로 사용. |
| **MVP 범위** | Sprint 1 6기능 전 범위 v1 포팅 (부분 포팅 없음). |
| **현재 코드** | **일절 수정하지 않음.** 새 미니앱은 별 저장소에서 신규 빌드. |
| **사용자 식별 옵션** | 옵션 P (profiles 매핑 테이블, `recipes.user_id` uuid 보존). |

## 0.3 이 문서 묶음을 읽는 신규 LLM에게 (가장 중요)

당신은 신규 React Native + Granite 미니앱 프로젝트의 LLM 에이전트다. 이 문서 묶음(`docs/appsintoss-port/00`~`10` + ADR-009)을 모두 읽으면 동일 기능을 RN+Granite로 구현하기에 충분한 사양이 모두 포함되어 있다.

### 원칙

1. **현재 코드는 절대 수정하지 않는다.** 모든 변경은 신규 저장소에서 일어난다.
2. **본 묶음의 챕터는 신규 RN 컨텍스트의 SSOT**다. 현재 웹 코드(`src/`)는 참조 자산이며, 본 묶음이 인용하는 부분만 SSOT로 본다(예: `_workspace/01_architect_api_contract.md`).
3. **TDS, Granite >= 1.0, RFC-1123 appName 규칙**을 반드시 따른다. 검수 통과의 전제다.
4. **각 챕터는 단독으로 읽을 수 있게 작성**되어 있다. 상단에 "이 챕터 전에 알아야 할 것"·"다음 챕터" 명시.
5. **백엔드 호출 계약은 변경 불가**(현재 운영 중). 미니앱은 정확히 6개 엔드포인트를 호출한다.

### 읽기 순서 (권장)

다음 순서대로 읽으면 의존성 그래프 상 막힘이 없다:

```
00-OVERVIEW (본 문서)
  ↓
ADR-009 (포팅 결정 전체)
  ↓
01-FEATURES (6기능 인벤토리)  ──┐
                                ├─→ 02-DATA-MODEL
                                │     ↓
                                │   03-API-CONTRACT
                                │     ↓
                                ├─→ 04-AI-PROVIDER (배경 이해용)
                                │   05-AUTH (가장 중요 — Toss 식별)
                                │     ↓
                                ├─→ 06-UI-MAPPING (TDS 매핑)
                                │   07-ROUTING (Granite 라우팅)
                                │   08-STREAMING (SSE → fetch stream)
                                │     ↓
                                └─→ 09-ENV-CONFIG (환경변수, granite.config.ts)
                                    10-SPRINT-PLAN (구현 순서, 의존성 그래프)
```

## 0.4 챕터 인덱스 (11문서)

| # | 파일 | 한 줄 요약 | 담당 | 우선순위 |
|---|------|------------|------|---------|
| 00 | [OVERVIEW.md](./00-OVERVIEW.md) | 입구·원칙·읽는 순서·재사용 자산 인덱스 | architect | 필수 1순위 |
| 01 | [FEATURES.md](./01-FEATURES.md) | Sprint 1 6기능 인벤토리·수용 기준·사용자 흐름 | architect | 필수 |
| 02 | [DATA-MODEL.md](./02-DATA-MODEL.md) | Supabase 스키마·RLS·옵션 P(profiles 매핑) | architect | 필수 |
| 03 | API-CONTRACT.md | 6개 엔드포인트 요청/응답·zod·CORS·인증 헤더 | backend | 필수 |
| 04 | AI-PROVIDER.md | Gemini/Claude·Factory·프롬프트·responseSchema·tool use | backend | 배경 이해용(미니앱은 호출만) |
| 05 | AUTH.md | `getAnonymousKey()`·`X-Toss-User-Id` 헤더·옵션 P upsert | backend | 필수 |
| 06 | UI-MAPPING.md | 14개 웹 컴포넌트 → TDS(@toss/tds-react-native) 1:1 매핑 | frontend | 필수 |
| 07 | ROUTING.md | App Router 7개 화면 → Granite 라우팅 매핑 | frontend | 필수 |
| 08 | STREAMING.md | SSE → RN fetch stream·점진 렌더링·취소 | frontend | 필수 |
| 09 | ENV-CONFIG.md | 환경변수·`granite.config.ts`·도메인 화이트리스트·appName 규칙 | architect | 필수 |
| 10 | SPRINT-PLAN.md | Phase 0~5 구현 순서·의존성·수용 기준 체크리스트 | architect | 필수 |

> **ADR-009**(`docs/adr/ADR-009-appsintoss-port-architecture.md`)는 별 위치에 있지만 본 묶음의 필수 동반 문서다. 챕터 01~10이 인용하는 결정의 근거가 모두 ADR-009에 있다.

## 0.5 재사용 가능한 자산 인덱스 (현재 코드)

미니앱은 새로 만들지만, 백엔드는 현재 자산을 그대로 호출한다. 아래는 미니앱 구현 시 인용·참조해야 할 SSOT다.

### API 자산 (백엔드 — 미니앱이 호출)

| 영역 | 경로 | 미니앱에서의 역할 |
|------|------|--------------------|
| API 계약 SSOT | `_workspace/01_architect_api_contract.md` | 미니앱의 fetch 호출 shape 기준 |
| API 엔드포인트 코드 | `src/app/api/recipes/route.ts`, `src/app/api/recipes/generate/route.ts`, `src/app/api/recipes/[id]/route.ts`, `src/app/api/recipes/[id]/favorite/route.ts` | 호출 대상 (수정 금지, 읽기만) |
| API 문서 (구현 노트) | `docs/api/recipes.md` | 응답 예제·에러 케이스 참조 |

### 공유 타입 (미니앱 신규 저장소로 복사)

| 영역 | 경로 | 미니앱에서의 역할 |
|------|------|--------------------|
| 도메인 타입 | `src/types/recipe.ts` | RN 프로젝트로 복사하여 SSOT 동기 유지 |
| API 타입 | `src/types/api.ts` | RN 프로젝트로 복사 (Request/Response shape) |
| 사용자 타입 | `src/types/user.ts` | 미니앱은 Toss userId 기반으로 재정의 필요 (User 인터페이스 참조용) |
| 인덱스 | `src/types/index.ts` | 위 모듈 묶음 |

> 미니앱은 새 저장소이므로 위 타입 파일을 그대로 복사하여 시작한다. 단, `User` 타입은 Supabase auth.users 기반에서 Toss hash 기반으로 재정의한다 (05-AUTH 챕터 참조).

### AI Provider (미니앱은 호출만 — 직접 호출 금지)

| 영역 | 경로 | 미니앱에서의 역할 |
|------|------|--------------------|
| Adapter 인터페이스 | `src/lib/ai/ai-recipe-provider.ts` | 배경 이해용 (미니앱은 호출 금지) |
| Factory | `src/lib/ai/ai-recipe-provider.factory.ts` | 백엔드 Provider 선택 로직 (미니앱 무관) |
| Gemini 구현 | `src/lib/ai/gemini-recipe-provider.ts` | 백엔드 기본 Provider |
| Claude 구현 | `src/lib/ai/claude-recipe-provider.ts` | 백엔드 롤백 Provider |
| 프롬프트 Factory | `src/lib/ai/prompts/` | 백엔드 내부 — 미니앱 무관 |
| zod 스키마 | `src/lib/ai/recipe-schema.ts` (또는 동등 위치) | 응답 검증 SSOT — 미니앱도 동일 zod 채택 권장 |

### DB 스키마와 RLS (백엔드만 알면 됨)

| 영역 | 경로 | 미니앱에서의 역할 |
|------|------|--------------------|
| 스키마 | `supabase/schema.sql` | 미니앱은 직접 DB 접근 없음. 백엔드 경유. |
| 마이그레이션 | `supabase/migrations/` | 옵션 P 적용 시 새 마이그레이션 추가(후속 ADR) |

### 아키텍처·결정 문서

| 영역 | 경로 |
|------|------|
| 레이어 설계 | `_workspace/01_architect_architecture.md` |
| 요구사항 | `_workspace/01_architect_requirements.md` |
| ADR 묶음 | `docs/adr/ADR-001` ~ `ADR-009` |
| AGENTS.md 묶음 | 루트 + `src/app/api/AGENTS.md`, `src/components/AGENTS.md`, `src/hooks/AGENTS.md`, `src/lib/ai/AGENTS.md`, `src/types/AGENTS.md` |

## 0.6 현재 코드는 절대 수정하지 않는다 (재차 강조)

본 포팅 작업의 산출물은 **문서**뿐이다 (`docs/adr/ADR-009-*.md`, `docs/appsintoss-port/00`~`10.md`).

신규 LLM이 미니앱 저장소에서 작업할 때:

- 현재 저장소(`/Volumes/external_ssd/side-projects/AIReceipe/`)는 **읽기 전용 참조**다.
- 미니앱 저장소(별 위치)에서 RN 컴포넌트·Granite 라우팅·`granite.config.ts`를 새로 작성한다.
- 백엔드는 Vercel에서 운영 중인 동일 인스턴스를 호출한다 (배포 별도 하지 않음).
- 백엔드 변경이 필요해지면 본 ADR 묶음이 아니라 **새 ADR**로 처리(예: 옵션 P 마이그레이션 ADR).

## 0.7 핵심 용어 약식 사전

| 용어 | 의미 |
|------|------|
| **AppsInToss / 앱인토스** | 토스 앱 내 미니앱 플랫폼 (Viva Republica) |
| **Granite** | 미니앱 프레임워크 (구 Bedrock의 신 명칭, v1.0+) |
| **TDS** | Toss Design System. 비게임 미니앱 필수 |
| **getAnonymousKey** | 비게임 미니앱 표준 식별 API. 미니앱별 고유 hash 반환 |
| **Toss userId** | 본 묶음에서는 `getAnonymousKey()`가 반환하는 hash를 가리킴 |
| **RFC-1123 appName** | 미니앱 appName 규칙(소문자·숫자·하이픈, RFC-1123 호스트명 형식) |
| **SSOT** | Single Source of Truth — 단일 진실 공급원 |
| **옵션 P** | profiles 매핑 테이블로 Toss userId ↔ internal uuid 매핑하는 사용자 식별 전략 (채택) |
| **SSE** | Server-Sent Events. 현재 웹의 스트리밍 방식. RN에서는 fetch stream으로 대체 |

## 0.8 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-22 | 초기 작성 (세션 #4) | 앱인토스 포팅 사양서 묶음의 입구 문서 |
