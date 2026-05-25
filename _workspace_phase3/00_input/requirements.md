# Phase 3 — 저장·목록·상세 (기능 c, d)

> 출처: 사용자 요청 "Phase 2 끝났으면 Phase 3 작업 시작해"
> SSOT: `docs/appsintoss-port/10-SPRINT-PLAN.md` §10.4

## 목적

생성된 레시피를 백엔드에 저장하고, 마이 레시피 목록에서 조회/페이지네이션/필터, 상세 화면 진입까지.

## 입력 전제 (Phase 2 완료)

- ADR-011 동결 — D8~D13 (SSE 어댑터 분리, AsyncGenerator, error 청크 단일 매핑, text 청크 미표시, PageNavbar, AbortSignal cast).
- Phase 2 산출: `src/services/sse-client.ts`, `src/hooks/useRecipeGenerate.ts`, `src/lib/zod/stream.ts`, `src/components/{SearchForm,RecipeDisplay,NutritionPanel,recipe-format}.tsx`, `src/pages/{index,recipe/generate}.tsx`.
- Phase 1 산출(공유 타입·api-client·useTossUserId·zod) 동결 그대로.
- `pnpm typecheck`/`lint` PASS, FAIL 0건.
- AGENTS.md: `src/{types,lib/zod,services,hooks,components,pages}/`.

## 산출물 (10-SPRINT-PLAN §10.4 출력)

### 결과 화면의 "저장" 버튼
- `src/pages/recipe/generate.tsx`(또는 동등)에 "저장" 버튼 추가. 클릭 → `apiFetch('/api/recipes', { method: 'POST', body: { recipe: GeneratedRecipe }, tossUserId })`.
- 저장 성공 시: 마이 레시피 캐시 무효화 + 상세 화면(`/recipe/[id]`) 또는 마이 탭으로 이동.
- 저장 중 disabled + 한국어 에러 처리.

### 마이 레시피 목록 화면 (신규 라우트)
- `src/pages/recipes/index.tsx` (또는 baseline 확정 경로) — `GET /api/recipes?page=&pageSize=&favorite=` 호출.
- `RecipeCard` 컴포넌트(06 §6.4.4) — TDS `View`+`Pressable`+`Txt`+`Badge`+`IconButton`(즐겨찾기 자리표시는 Phase 4)+`Button`(삭제 Phase 4).
- 페이지네이션 또는 무한 스크롤 — baseline 결정.
- 즐겨찾기 필터 자리표시 (실제 토글은 Phase 4).
- 빈 목록 시 빈 상태 UI(`EmptyState` 신규 — 06 §6.5 추가 컴포넌트).
- `meta.pageSize` 신뢰 (clamp 50 — 03 §3.3.2).

### 레시피 상세 화면 (신규 라우트)
- `src/pages/recipe/[id].tsx` — `GET /api/recipes/[id]` 호출, `RecipeDisplay`+`NutritionPanel` 재사용.
- 직접 진입(딥링크) 지원 — 목록 캐시 의존 제거 (ADR-004).
- 404 시 "레시피를 찾을 수 없어요" UI (`NotFoundScreen` 신규 — 06 §6.5, ADR-005 통일).
- 새로고침(라우트 재진입)에도 정상 표시.
- 401 시 식별자 재발급 재시도 (api-client 기본 동작).

### 데이터 흐름 (api-client 또는 훅)
- `useMyRecipes(options)` — 목록 fetch + 페이지네이션 상태 + 캐시 무효화 트리거.
- `useRecipeDetail(id)` — 단건 fetch + 로딩/404/에러 상태.
- `useSaveRecipe()` — 저장 mutation + 성공 콜백(캐시 무효화·라우팅).
- 캐시 전략 결정 (baseline) — SWR/React Query 미도입 가정 시 자체 invalidation 패턴.
- AbortController unmount 처리.

### 라우팅 (07-ROUTING)
- `/recipes` (목록), `/recipe/[id]` (상세). `useNavigation`으로 진입. `Route.useParams<{ id: string }>()`.
- 생성 화면에서 저장 후 상세로 이동: `navigation.navigate('/recipe/[id]', { id })` 또는 마이 탭.

## 수용 기준 (10-SPRINT-PLAN §10.4 AC3.*)

- **AC3.1**: Phase 2에서 생성한 레시피 저장 → 201 + `Recipe`(id 포함) 응답.
- **AC3.2**: 마이 레시피 진입 시 방금 저장한 레시피가 첫 페이지에 보임.
- **AC3.3**: 카드 탭 → 상세 화면 진입 → 새로고침(라우트 재진입)에도 정상 표시.
- **AC3.4**: `pageSize=100` 요청 시 백엔드가 50으로 clamp, 응답 `meta.pageSize=50` 미니앱이 신뢰.
- **AC3.5**: 두 명의 다른 식별자로 저장 → 서로 보이지 않음 (소유자 격리).
- **AC3.6**: `?favorite=true` 필터 동작 (Phase 4 즐겨찾기 이후 실증).

## SSOT 인용 경로

| 영역 | 챕터 |
|------|------|
| 목록 엔드포인트(쿼리·페이지네이션·clamp·정렬) | `docs/appsintoss-port/03-API-CONTRACT.md` §3.3 |
| 단건 엔드포인트(404 수렴) | `03-API-CONTRACT.md` §3.4 |
| 저장 엔드포인트(201·zod) | `03-API-CONTRACT.md` §3.5 |
| RecipeCard 매핑 | `06-UI-MAPPING.md` §6.4.4 |
| EmptyState/NotFoundScreen 신규 컴포넌트 | `06-UI-MAPPING.md` §6.5 |
| 라우트(/recipes, /recipe/[id]), Route.useParams | `07-ROUTING.md` (관련 절) |
| 401 자동 재시도(Phase 1 로직) | `05-AUTH.md` §5.4 |
| 404 UI 통일 | `ADR-005-ownership-violation-404.md` |
| 페이지네이션 clamp | `ADR-006-pagesize-clamp.md` |
| 상세 라우트 딥링크 정책 | `ADR-004-get-recipe-by-id.md` |
| Phase 1·2 동결 규약 | `ADR-010`, `ADR-011` |
| 디렉터리 책임 | `src/{types,lib/zod,services,hooks,components,pages}/AGENTS.md` |

## 비범위

- Phase 4 — 즐겨찾기 토글 PATCH, 삭제 DELETE, 404 UI 일원화 마무리.
- 디자인 토큰 일괄 교체(Phase 2 §13.1 인계 — 별 ADR).
- 백엔드 옵션 P 후속 ADR 배포 — 본 저장소 외부 작업.

## 위험·완화

| 위험 | 완화 |
|------|------|
| Phase 2 인계 #1 — `@apps-in-toss/web-framework` SDK 경로 미해결 | Phase 3 첫 보호 endpoint 호출이 useTossUserId의 SDK 실호출 트리거. dev server 시점에 검증. 실패 시 ADR-010 §롤백 R1 적용 + baseline 갱신. |
| 새로고침(라우트 재진입) 시 useTossUserId 캐시 휘발 | 메모리 캐싱 정책(ADR-010 D2) 그대로. 재진입 시 1회 발급 동일. |
| 페이지네이션 상태와 캐시 무효화 충돌 | 단순 invalidation(다음 fetch에서 재호출) 패턴 채택 권장. SWR 도입은 별 ADR. |
| `/recipe/[id]` 동적 라우트 Granite 패턴 차이 | 07-ROUTING `Route.useParams<{ id: string }>()` 패턴 확정. id 형식(uuid) zod 검증. |
| 404 UI 분기가 3개 엔드포인트(GET[id]·PATCH·DELETE)에 동일 적용 | Phase 3은 GET[id]만, Phase 4에서 PATCH·DELETE 추가 시 동일 컴포넌트 재사용 보장. `NotFoundScreen` 컴포넌트 SRP 유지. |
| AC3.5 격리 검증 — 백엔드 옵션 P 미배포 시 실호출 불가 | 코드 경로 + curl 시뮬레이션 + 두 토큰 헤더로 별 요청 시퀀스 검증. |
| 빈 목록 vs 에러 분기 혼동 | `data: []` + `meta.total: 0` = 빈 상태(200), 503/401 = 에러 분기 별도. zod 검증 통과 응답은 항상 빈 배열을 정상 처리. |
