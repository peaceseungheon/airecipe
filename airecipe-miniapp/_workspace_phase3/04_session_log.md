# Phase 3 Session Log — `airecipe-miniapp-phase3`

> 작성: miniapp-architect · 2026-05-24 (T5 산출)
> 입력: `_workspace/00_input/requirements.md`, `_workspace_phase1/04_session_log.md`, `_workspace_phase2/04_session_log.md`(Phase 2 인계)
> 산출: ADR-012(D14~D18), 06 §6.5 추가 컴포넌트 표 갱신, AGENTS.md 3종(`src/hooks/`·`src/components/`·`src/pages/`) 보강, ADR-010·011 §결과 표 갱신, 본 문서, CLAUDE.md "현재 단계" 절 갱신
> 팀 구성: team-lead / miniapp-architect / miniapp-api-client / miniapp-frontend / miniapp-qa (4 에이전트 + 1 리더)

본 문서는 Phase 3 전체 흐름·결정·검증·미해결을 단일 위치에 보존하여 Phase 4 이후 신규 LLM 세션이 컨텍스트를 즉시 회복할 수 있게 한다.

---

## 1. Phase 3 목표 (입력 요구사항 §목적)

생성된 레시피를 백엔드에 저장하고, 마이 레시피 목록에서 조회·페이지네이션·필터, 상세 화면 진입까지 — 기능 (c) 저장 + (d) 목록·상세.

수용 기준 (requirements §AC3 / 10-SPRINT-PLAN §10.4):
- AC3.1 Phase 2에서 생성한 레시피 저장 → 201 + `Recipe`(id 포함) 응답
- AC3.2 마이 진입 시 방금 저장한 레시피가 첫 페이지에 보임
- AC3.3 카드 탭 → 상세 → 새로고침(라우트 재진입) 정상
- AC3.4 `pageSize=100` → 백엔드 clamp → `meta.pageSize=50` 신뢰
- AC3.5 두 식별자 격리 (소유자 격리)
- AC3.6 `?favorite=true` 필터 동작 (Phase 4 즐겨찾기 이후 실증)

---

## 2. 진행 흐름 (Task 단위)

| Task | 담당 | 상태 | 산출물 |
|------|------|------|--------|
| T1 — Phase 3 SSOT 인용·라우팅·캐시 전략·404 UI·ADR 영향 검토 | miniapp-architect | completed | `_workspace/01_architect_phase3_baseline.md` (§A~§K, 11절) |
| T2 — useMyRecipes·useRecipeDetail·useSaveRecipe 훅 + 캐시 무효화 | miniapp-api-client | completed | `src/hooks/{useRecipeCache,useMyRecipes,useRecipeDetail,useSaveRecipe}.{tsx,ts}` + `_app.tsx` 확장. `_workspace/02_api_client_summary.md` |
| T3 — RecipeCard·EmptyState·NotFoundScreen + /my-recipes·/recipe/[id] 라우트 + 저장 버튼 | miniapp-frontend | completed | `src/components/{RecipeCard,EmptyState,NotFoundScreen}.tsx` + `src/pages/{my-recipes,recipe/[id]}.tsx` + `src/pages/{index,recipe/generate}.tsx` 확장. `_workspace/02_frontend_summary.md` |
| T4 — Phase 3 점진 경계면 검증 + 404 UI 통일 + 캐시 정합 + 통합 스윕 | miniapp-qa | completed | `_workspace/03_qa_report.md` (76+ PASS / 0 FAIL / PENDING 6건 — 실호출 차원) |
| T5 — Phase 3 ADR/AGENTS.md/세션 기록 마무리 | miniapp-architect | completed | ADR-012, 06 §6.5 갱신, AGENTS.md 3종 갱신, ADR-010·011 §결과 표 갱신, 본 문서, CLAUDE.md "현재 단계" 갱신 |

---

## 3. 핵심 결정 (ADR-012로 동결)

| # | 결정 | 근거 | 영향 |
|---|------|------|------|
| D14 | 목록 라우트 `/my-recipes` + 상세 라우트 `/recipe/[id]` 채택. 파일 `pages/my-recipes.tsx` + `pages/recipe/[id].tsx` | 07 §7.3.3·§7.3.4 SSOT 우선(ADR-009 D4). requirements `/recipes`는 폐기. Granite 동적 세그먼트 검증 PASS(`getRoutePath` JSDoc) | router.gen.ts 4 라우트 등록, validateParams 패턴은 generate.tsx 답습 |
| D15 | 클라이언트 캐시 무효화 = Context + bump trigger. `useRecipeCacheTrigger`로 노출 | 대안 (b)EventEmitter / (c)focus refetch 기각. SWR/RQ 미도입 정합(번들 영향 0). 단순 int counter + useEffect dep | `_app.tsx`에 RecipeCacheProvider 안쪽 마운트. useMyRecipes trigger dep, useRecipeDetail 미포함, useSaveRecipe.save 성공 시 invalidate() 1회 |
| D16 | 404 UI = 단일 컴포넌트 `NotFoundScreen` (TDS `ErrorPage statusCode={404}` 합성). pages에서 `<ErrorPage>` 직접 렌더 0건 | ADR-005 정책 구체화. Phase 4 PATCH/DELETE 404 재사용 보장. SRP — 정책 변경이 곧 컴포넌트 1개 수정 | `src/components/NotFoundScreen.tsx` 신규(35줄), `[id].tsx:75` 단일 사용. `useRecipeDetail`이 404 정규화(notFound state) |
| D17 | 저장 성공 후 `/recipe/[id]` 직진 라우팅 | AC3.2·3.3 자연 흐름. 07 §7.3.2 표(웹 패턴) 정합. 캐시는 invalidate로 분리 보장 | `generate.tsx:120` navigation.navigate. handleBack은 canGoBack? + fallback `/my-recipes` |
| D18 | 페이지네이션 = 단순 페이지네이션(page useState + 이전/다음). 무한 스크롤은 Phase 5 별 ADR | MVP 단순성 + 백엔드 meta.pageSize 신뢰(ADR-006) + AC3.4 검증 단순화 | `my-recipes.tsx` page state + lastPage 계산. `query.pageSize`로 계산 0건 |

상세 근거·대안·롤백은 [ADR-012](../docs/adr/ADR-012-miniapp-phase3-routing-cache-404.md) 참조.

---

## 4. 산출 파일 인벤토리 (Phase 1·2 위에 누적)

### 코드 (Phase 3로 동결)

| 파일 | 라인수 | 역할 |
|------|------|------|
| `src/hooks/useRecipeCache.tsx` (신규) | 70 | Context + bump trigger. RecipeCacheProvider + useRecipeCacheTrigger |
| `src/hooks/useMyRecipes.ts` (신규) | 169 | listRecipes raw `{data, meta}` 보존 + trigger dep + 401 자동 재시도 |
| `src/hooks/useRecipeDetail.ts` (신규) | 163 | getRecipe + 404 정규화(`notFound` state) + 명시 refetch |
| `src/hooks/useSaveRecipe.ts` (신규) | 134 | saveRecipe + 성공 시 invalidate() 1회 + AbortController cleanup |
| `src/_app.tsx` (확장) | 24 | RecipeCacheProvider를 TossUserIdProvider 안쪽 래핑 1줄 |
| `src/components/RecipeCard.tsx` (신규) | 118 | Pressable + Txt + Badge 3종 + 즐겨찾기/삭제 prop 자리표시 |
| `src/components/EmptyState.tsx` (신규) | 67 | props 4종 재사용 컴포넌트 |
| `src/components/NotFoundScreen.tsx` (신규) | 35 | TDS ErrorPage 합성 — 단일 404 UI |
| `src/pages/my-recipes.tsx` (신규) | 207 | createRoute + 식별자 가드 + useMyRecipes + 4-way 분기 + 단순 페이지네이션 |
| `src/pages/recipe/[id].tsx` (신규) | 151 | createRoute + validateParams + 식별자 가드 + useRecipeDetail + 4-way 분기 + handleBack |
| `src/pages/recipe/generate.tsx` (확장) | 270 | useSaveRecipe 결합 + 저장 버튼 + 상세 직진 |
| `src/pages/index.tsx` (확장) | 81 | PageNavbar.AccessoryButtons로 마이 진입 활성화 |
| `src/router.gen.ts` (자동) | - | granite 자동 — 4 라우트 등록 |

### 인프라

- **의존성 변경 0건** — Phase 1·2의 zod·@toss/tds-react-native·@granite-js/react-native·@apps-in-toss/framework·react-native 그대로. SWR/React Query 미도입 정합 (ADR-012 D15).
- **tsconfig 변경 0건** — ADR-010 D6 동결 유지.
- **package.json 변경 0건**.

### 문서 (본 Phase에서 새로 추가/갱신)

| 파일 | 종류 | 작성자 |
|------|------|------|
| `_workspace/01_architect_phase3_baseline.md` | baseline 동결 (§A~§K 11절) | architect (T1) |
| `_workspace/02_api_client_summary.md` | api-client 산출 요약 + 격리 grep 결과 | api-client (T2) |
| `_workspace/02_frontend_summary.md` | frontend 산출 요약 + 화면 구성 | frontend (T3) |
| `_workspace/03_qa_report.md` | QA 매트릭스 (76+ PASS / 0 FAIL) | qa (T4) |
| `_workspace/04_session_log.md` | 본 문서 | architect (T5) |
| `docs/adr/ADR-012-miniapp-phase3-routing-cache-404.md` | 새 ADR (D14~D18 5 결정 묶음) | architect (T5) |
| `docs/adr/ADR-010-*.md` | §결과 표 갱신 — ADR-012 양방향 참조 | architect (T5) |
| `docs/adr/ADR-011-*.md` | §결과 표 갱신 — ADR-012 양방향 참조 | architect (T5) |
| `docs/appsintoss-port/06-UI-MAPPING.md` | §6.5 추가 컴포넌트 표 갱신 + §6.9 변경 이력 갱신 | architect (T5) |
| `src/hooks/AGENTS.md` | 보강 — Phase 2·3 화면 흐름 훅 5종(useRecipeGenerate + 4 신규) 책임·인터페이스·규약 추가 | architect (T5) |
| `src/components/AGENTS.md` | 보강 — RecipeCard·EmptyState·NotFoundScreen 추가 + §H.2 #11·#13 규약 추가 + Phase 2·3 hex 정책 누적 | architect (T5) |
| `src/pages/AGENTS.md` | 보강 — my-recipes·[id].tsx 라우트 추가 + 식별자 가드 패턴 + 네비게이션 흐름 매트릭스 + 라우트 4개 등록 정책 | architect (T5) |
| `CLAUDE.md` "현재 단계" 절 | Phase 0~3 누적 산출 + Phase 4 진입 인계 + 누적 미해결 6항 | architect (T5) |

---

## 5. AC3.1~AC3.6 통과 점검 (Phase 3 → Phase 4 진입 게이트)

QA 최종 매트릭스(`_workspace/03_qa_report.md` §6·§14)를 본 문서에서 재확인:

| AC | 코드 경로 | 실호출 | 비고 |
|----|----------|--------|------|
| AC3.1 저장 → 201 + id | PASS | PENDING (백엔드 옵션 P 배포 후) | useSaveRecipe + saveRecipe + recipeSchema zod 통과 |
| AC3.2 마이 첫 항목 = 방금 저장 | PASS | PENDING | invalidate trigger + created_at desc + listRecipes raw {data, meta} |
| AC3.3(a)(b) 카드 탭 → 상세 → 라우트 재진입 정상 | PASS | PENDING | useRecipeDetail + recipeSchema + 새 마운트 자동 fetch |
| AC3.3(c) 딥링크 진입 | PASS (코드) | PENDING (토스 환경) | 동일 경로 (a) 흐름. getSchemeUri 동작 별 검증 |
| AC3.4 pageSize=100 → meta.pageSize=50 신뢰 | PASS | PENDING | useMyRecipes raw `{data, meta}` + my-recipes.tsx lastPage 계산이 meta.pageSize 사용 |
| AC3.5 두 식별자 격리 | PASS (코드) | PENDING (curl 시뮬레이션) | tossUserId 헤더 매 요청 부착 + 보호 화면 가드 |
| AC3.6 favorite=true 필터 | PASS (코드만) | PENDING (Phase 4 즐겨찾기 이후 실증) | useMyRecipes query.favorite 코드 경로 PASS (api-client buildUrl boolean → "true" 자동 변환) |

03 §3.10 Phase 3 적용 8건 PASS (Phase 2의 N/A에서 활성), 06 §6.7 5건 PASS, 07 §7.9 5건 PASS, 07 §7.5.4 데이터 소비 5건 PASS, baseline §B.1 TDS 신규 4종 PASS, baseline §H.2 격리 8건 PASS, baseline §H.1 동결 회귀 11건 PASS (Phase 1·2 코드 수정 0건), baseline §H.3 cast 격리 3건 PASS, 통합 스윕 16건 PASS.

**전체: 76+ 단언 PASS, FAIL 0건 누적, PENDING 6건(실호출 차원).**

### Phase 3 → Phase 4 진입 게이트 판정: **PASS**

- 코드 경로 AC3.1~3.6 모두 통과.
- 실호출 6건 PENDING은 백엔드 옵션 P 배포에 의존하는 외부 차단 사항 + AC3.3(c) 딥링크 토스 환경 필요 + AC3.6 Phase 4 즐겨찾기 이후 실증.
- 멈춤 트리거 §G 8항목 0건 발생.

---

## 6. Phase 2 인계 9건 회수 표 (Phase 3 진행 결과)

| Phase 2 인계 # | Phase 3 상태 | 후속 |
|--------------|------------|------|
| #1 SDK 패키지 경로 (`@apps-in-toss/web-framework` 미해결) | **검증 미달** — 본 Phase 보호 endpoint 첫 호출(useMyRecipes/useRecipeDetail 마운트)이 트리거이나 qa 검증은 코드 경로 PASS에 머묾(dev server 미가동). Phase 4 dev server 진입 시점 또는 옵션 P 배포 후 검증 | ADR-010 D7 한시 통과 유지 |
| #2 AbortSignal cast 2곳 | **0건 추가 발생** — Phase 3 신규 코드는 fetch 직접 호출 0건이라 cast 발생 0. ADR-011 D13 해소 조건 (a)/(b)/(c) 그대로 보류 | ADR-011 D13 유지 |
| #3 RN Response.body / TextDecoder | 본 Phase 비범위 (SSE 0건) | Phase 4도 비범위 |
| #4 백엔드 옵션 P 미배포 | 본 Phase 보호 호출 PENDING(코드 경로 PASS) — 옵션 P 배포 후 실호출 검증 | 별 저장소 AIReceipe ADR |
| #5 useBackEvent 하드웨어 백 | 본 Phase **보류** — Phase 3 보호 화면은 single-shot fetch + unmount cleanup 충분 (baseline §C.6). Phase 4 PATCH/DELETE 낙관적 업데이트 도입 시 재검토 | Phase 4 진입 결정 |
| #6 청크 간 30s 타임아웃 | 본 Phase 비범위 (SSE는 generate만) | Phase 4 또는 별 ADR |
| #7 디자인 토큰 hex 직접 사용 | **누적 — Phase 3 신규 컴포넌트도 hex 사용** (RecipeCard `#191F28`/`#4E5968`/`#E5E8EB`/`#F2F4F6` 등, my-recipes/[id].tsx 동일). 별 ADR 권장 — Phase 4 진입 전 결정 | 별 ADR |
| #8 about 페이지 정리 | Phase 2에서 해소 완료 | — |
| #9 SSE fragility 개선 | 본 Phase 진행 없음 (SSE 비범위) | Phase 4 또는 별 ADR |

---

## 7. 의사소통 흐름 정리 (팀 메시지 채널 회고)

- baseline 동결 직후 architect → api-client/frontend/qa 3자 통지: SSOT 인용 경로 + 시작 신호 + 멈춤 조건(§G).
- qa → architect: 골격 PENDING 작성 + 보강 3건 회신 (식별자 가드 단일 분기 / AC3.3 (a)(b)(c) 분리 / cast 격리 grep 4종).
- api-client → architect: T2 완료 + 자기 검증 §H.2 #11~18 + §H.3 PASS 보고. architect cross-check PASS 회신.
- frontend → architect: T3 완료(통지 미수신, 파일 시스템 직접 확인). architect cross-check PASS — qa에 동결 신호 전파.
- qa → architect: T4 통합 검증 ALL PASS + T5 인계 사항 6건 + 신규 발견 3건(§14.6 hex / §14.9 handleBack fallback / §14.10 useRecipeGenerate cancel 미사용).
- team-lead → architect: 단계별 task 할당, T1 재가동 알림, T5 진입 결정.

**baseline §G 트리거 (SSOT 결함 보고) 발동: 0건.** 미니앱 측이 백엔드 사양을 우회하거나 추측 변경하지 않음.

---

## 8. 결정 트레일 — baseline §A·§D 결정의 채택 확정

baseline §A·§D는 라우팅·캐시·404·저장 흐름 결정을 동결했고 본 Phase 검증으로 확정된 결정:

| baseline 항목 | Phase 3 종료 시점 결정 | 후속 변경 트리거 |
|-----------------|--------------------|---------------|
| §A.3 `/my-recipes` + `/recipe/[id]` 라우트 등록 (단일 파일 패턴) | **채택 확정** (ADR-012 D14) | Phase 4·5 자식 라우트 추가 시 서브디렉터리 승격 |
| §A.4 저장 후 `/recipe/[id]` 직진 | **채택 확정** (ADR-012 D17) | Phase 4 삭제 후 마이 이동 등 화면별 정책 차별화 |
| §A.5 단순 페이지네이션 | **채택 확정** (ADR-012 D18) | Phase 5 출시 직전 무한 스크롤 별 ADR |
| §C.1·C.2 라우트 경로/validateParams 패턴 | **채택 확정** (ADR-012 D14) | Granite 동적 세그먼트 syntax 변경 시 |
| §C.4 식별자 가드 단일 분기 (Loading 렌더) | **채택 확정** (qa 보강 1 반영) | useTossUserId가 error state 노출 시 ErrorPage 503 추가 |
| §C.6 useBackEvent 보류 | 보류 유지 | Phase 4 PATCH/DELETE 낙관적 업데이트 시 |
| §D.1 Context + bump trigger | **채택 확정** (ADR-012 D15) | Phase 4·5 키별 부분 무효화 필요 시 SWR/RQ 별 ADR |
| §D.5 useRecipeDetail trigger 미포함 | **채택 확정** | Phase 4 PATCH favorite 후 refetch 도입 시 |
| §B.3 NotFoundScreen 단일 컴포넌트 | **채택 확정** (ADR-012 D16) | Phase 4 PATCH/DELETE 404에서 재사용 검증 |

---

## 9. 다음 Phase (Phase 4 — 즐겨찾기·삭제) 진입 준비

`docs/appsintoss-port/10-SPRINT-PLAN.md` §10.5(가칭)에 따라 Phase 4는 다음을 진행:

- 즐겨찾기 토글: `useToggleFavorite` 신규 → PATCH `/api/recipes/[id]/favorite` (멱등). 성공 시 invalidate + useRecipeDetail.refetch. `RecipeCard.onToggleFavorite` prop 활성화 또는 `FavoriteButton` 별 컴포넌트 추출.
- 삭제: `useDeleteRecipe` 신규 → DELETE `/api/recipes/[id]`. 응답 `{ data: { id } }`. 성공 시 invalidate + navigation.navigate('/my-recipes', {}) 또는 goBack(). `DeleteConfirmDialog` 컴포넌트 신규(TDS `ConfirmDialog`).
- 즐겨찾기 필터: `FilterTabs` 신규(TDS `SegmentedControl` 또는 `Tab`) + `useMyRecipes(query.favorite)`. `?favorite=true/false` 문자열 강제(03 §3.10 #11).
- 404 UI는 Phase 3 산출 `<NotFoundScreen />` 그대로 재사용(ADR-012 D16 단일 컴포넌트 정책).
- 캐시 무효화는 Phase 3 산출 `useRecipeCacheTrigger.invalidate()` 그대로 재사용(ADR-012 D15).
- `useBackEvent` 도입 결정 — Phase 4 PATCH/DELETE 낙관적 업데이트와 함께 통합.

Phase 3가 Phase 4에 영향을 줄 항목:

1. **ADR-010 D7 해소** — Phase 4 첫 보호 endpoint 호출 시점에서 SDK 패키지 경로 검증.
2. **ADR-011 D13 해소** — 3중 조건 충족 시 cast 2곳 동시 제거 + tsconfig 정리.
3. **`useBackEvent` 하드웨어 백** — PATCH/DELETE 낙관적 업데이트와 함께 통합 구현.
4. **디자인 토큰 표 확정 + hex 일괄 교체** — 별 ADR (Phase 4 진입 전 권장).
5. **백엔드 옵션 P 배포 완료** (별 저장소 AIReceipe) — Phase 3·4 모든 실호출 검증 활성화.
6. **무한 스크롤 검토** — Phase 5 출시 직전 별 ADR (ADR-012 D18 §대안 H).
7. **단위 테스트(jest + @testing-library/react-native)** — 본격 도입 여부 별 ADR.
8. **`useRecipeGenerate.cancel` 사용 재검토** (qa §14.10) — Phase 4·5에서 retired 또는 활성 결정.

---

## 10. 변경 이력

| 일시 | 변경 | 사유 |
|------|------|------|
| 2026-05-24 | Phase 3 session log 초안 작성 | T5 — Phase 3 마무리. baseline §A·§D 결정의 채택 확정 + ADR-012 동결(D14~D18) + AGENTS.md 3종 보강 + 06 §6.5 갱신 + ADR-010·011 §결과 표 갱신 + CLAUDE.md 현재 단계 갱신 + AC3.x 통과 점검 + Phase 2 인계 9건 회수 표 + Phase 4 인계 8항목 |
