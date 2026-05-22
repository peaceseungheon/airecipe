# AIReceipe — 프로젝트 가이드 (AGENTS.md)

AI 기반 요리 레시피 안내 웹앱. Next.js 14+ (App Router) + TypeScript. 핵심 비기능 요구: SOLID·디자인 패턴 준수, 철저한 문서화.

## 아키텍처 개요 (레이어 의존성 방향)

```
[UI 컴포넌트] → [훅] → (HTTP) → [Route Handler] → [Service] → [Repository] → [Supabase]
                                                       │
                                                       └→ [AIRecipeProvider 추상] ← [ClaudeRecipeProvider]
```

의존성은 항상 안쪽(도메인)을 향한다. Service는 구체 Supabase 클라이언트·Anthropic SDK가 아니라 **추상 인터페이스**에 의존한다(DIP). 외부 SDK는 어댑터로 격리한다.

## 디렉토리 지도

| 디렉토리 | 책임 | AGENTS.md |
|---------|------|-----------|
| `src/types/` | 공유 타입 (API 계약의 코드 표현 = SSOT) | `src/types/AGENTS.md` |
| `src/app/api/` | Route Handler — HTTP I/O·검증·인증만 (얇게) | 백엔드 작성 |
| `src/services/` | 비즈니스 로직·유스케이스 조합 (프레임워크 독립) | 백엔드 작성 |
| `src/repositories/` | 데이터 접근 (Supabase CRUD) | 백엔드 작성 |
| `src/lib/ai/` | Claude 어댑터 (생성/영양 분석, 프롬프트, 파싱) | 백엔드 작성 |
| `src/lib/supabase/` | Supabase 클라이언트 팩토리 (server/client) | 백엔드 작성 |
| `src/mappers/` | DB row(snake) ↔ DTO(camel) 변환 단일 위치 | 백엔드 작성 |
| `src/hooks/` | 데이터 페칭/상태 훅 (use*.ts) | 프론트 작성 |
| `src/components/` | 재사용 UI (presentational) | 프론트 작성 |
| `docs/adr/` | 아키텍처 결정 기록 | — |
| `docs/api/` | 엔드포인트 API 문서 | 백엔드 작성 |
| `_workspace/` | 스프린트 산출물(요구사항/아키텍처/계약) | — |

## 핵심 규약

1. **계약 우선(SSOT)**: API 요청/응답 타입은 `src/types/`에 정의하고 백엔드/프론트가 동일 타입을 import한다. 계약 원본은 `_workspace/01_architect_api_contract.md`.
2. **응답 래핑**: 모든 성공 응답은 `{ data, meta? }`. 에러는 `{ error: { code, message } }`. 프론트는 `.data`를 unwrap.
3. **API 경계는 camelCase**: DB의 snake_case는 `src/mappers/`에서만 변환. snake_case가 응답에 새면 버그.
4. **Route는 얇게**: 비즈니스 로직은 Service로(SRP). 외부 SDK는 Service/컴포넌트에 직접 노출 금지(DIP).
5. **GeneratedRecipe vs Recipe**: 생성된(미저장, id 없음) 레시피와 저장된(id 있음) 레시피는 다른 타입. 저장 전 id 접근 금지.
6. **패턴은 근거와 함께**: 디자인 패턴 도입 시 ADR 작성. 구현체 하나뿐인 추상화는 금지(YAGNI).

## 설계 결정 (ADR)
- [ADR-001](docs/adr/ADR-001-supabase.md) — Supabase + Repository/Mapper 패턴
- [ADR-002](docs/adr/ADR-002-ai-adapter.md) — Claude AI Adapter + Facade + Factory
- [ADR-003](docs/adr/ADR-003-state-management.md) — SWR + React 로컬 상태
- [ADR-004](docs/adr/ADR-004-single-recipe-fetch.md) — 단건 조회 GET /api/recipes/[id] 추가
- [ADR-005](docs/adr/ADR-005-ownership-violation-404.md) — 소유권 위반 404 수렴 (403 미사용)
- [ADR-006](docs/adr/ADR-006-pagesize-clamp.md) — pageSize 상한 초과 clamp (400 거부 아님)
- [ADR-007](docs/adr/ADR-007-proxy-file-convention.md) — 페이지 보호 proxy.ts 전환 (Next 16, 구 middleware.ts)

## 개발 명령
- 개발 서버: `npm run dev`
- 타입체크 + 빌드: `npm run build` (DoD: 타입 오류 없음)
- 린트: `npm run lint`
- 단위 테스트: `npm test`

> `npm run build` 통과는 any/캐스팅으로 우회된 경계면 불일치를 잡지 못한다. QA의 경계면 검증(`integration-coherence-qa`)을 반드시 거친다.

## 환경 변수 (.env.local — `.env.local.example` 참조)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 브라우저 클라이언트도 사용(공개 anon key)
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용. 클라이언트 번들에 절대 노출 금지
- `ANTHROPIC_API_KEY` — 서버 전용. 클라이언트 번들에 절대 노출 금지 (선택: `ANTHROPIC_MODEL` 기본 `claude-haiku-4-5-20251001` — 비용 최적화. 품질 부족 시 `claude-sonnet-4-6`/`claude-opus-4-7`로 오버라이드)

## 페이지 / API 맵
| 경로 | 설명 |
|------|------|
| `/` | 홈 — 요리 이름 검색 |
| `/recipe/generate` | 레시피 생성 폼 + 결과 |
| `/recipe/[id]` | 저장된 레시피 상세 |
| `/my-recipes` | 마이 레시피 (로그인 필요) |
| `/auth/login`, `/auth/signup` | 인증 |

| API | 인증 | 설명 |
|-----|------|------|
| POST `/api/recipes/generate` | 공개 | 생성 + 영양 분석 (JSON/SSE) |
| GET `/api/recipes` | 필요 | 내 레시피 목록 |
| GET `/api/recipes/[id]` | 필요 | 레시피 단건 조회 (딥링크) |
| POST `/api/recipes` | 필요 | 저장 |
| PATCH `/api/recipes/[id]/favorite` | 필요 | 즐겨찾기 설정(멱등) |
| DELETE `/api/recipes/[id]` | 필요 | 삭제 |
