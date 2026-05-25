# Phase 4 QA Report — 즐겨찾기·삭제·404 통일

> 검증자: orchestrator(메인 — 팀 1개 동시 제약으로 architect/api-client/frontend/qa-as-orchestrator)
> 일자: 2026-05-25
> 입력: `_workspace/01_architect_phase4_baseline.md` §C.qa 매트릭스 + §B D1~D13 + ADR-013 D19~D24

## 매트릭스 (Q1~Q9)

| ID | 항목 | 검증 방법 | 결과 |
|----|------|----------|------|
| Q1 | `<ErrorPage>` 직접 렌더 — NotFoundScreen 외 0건 | `grep -rn "<ErrorPage" src/` | **PASS** — `src/components/NotFoundScreen.tsx:28` 실 렌더 1곳, 나머지는 모두 주석·문서. |
| Q2 | `<NotFoundScreen>` 사용 위치 | `grep -rn "<NotFoundScreen" src/pages` | **PASS** — `src/pages/recipe/[id].tsx:130` 실 렌더 1곳. Phase 4 PATCH/DELETE 404는 컴포넌트 재사용 보장(ADR-013 추가 정책 + ADR-012 D16). |
| Q3 | "찾을 수 없" 인라인 텍스트 — pages 0건 | `grep -rn "찾을 수 없" src/` | **PASS** — 페이지 인라인 0건. NotFoundScreen title + 6개 훅의 ERROR_CODE_MESSAGES.NOT_FOUND 매핑 표만(에러 카탈로그 — 정상). |
| Q4 | invalidate() 호출 위치 정합 | `grep -rn "invalidate()" src/hooks` | **PASS** — useSaveRecipe(Phase 3 1곳), useToggleFavorite(D13 1곳), useDeleteRecipe(D13 2곳: 성공·404 정규화). 실패 시 0건. |
| Q5 | 직접 fetch는 api-client 단일 경로 | `grep -rn "\\bfetch(" src/` | **PASS** — `services/api-client.ts:102` + `services/sse-client.ts:78` 정확 2곳. Phase 1·2 동결 그대로. 신규 0건. |
| Q6 | 라우트 매니페스트 — Phase 3 그대로 (4 라우트) | `cat src/router.gen.ts` | **PASS** — `/`, `/recipe/generate`, `/my-recipes`, `/recipe/[id]` 4 라우트. 신규 0건. |
| Q7 | TDS 신규 3 import — IconButton/SegmentedControl/ConfirmDialog 각 1곳 | `grep -rn "from '@toss/tds-react-native'" src/components` | **PASS** — FavoriteButton(IconButton) + FilterTabs(SegmentedControl) + DeleteConfirmDialog(ConfirmDialog) 각 1 import. |
| Q8 | typecheck + lint | `pnpm typecheck` + `pnpm lint` | **PASS** — typecheck exit 0, lint 0 errors (1 무해 warning `router.gen.ts` Phase 3 누적). |
| Q9 | 멱등 검증 — PATCH 두 번 호출 시 마지막 의도 보장 | `useToggleFavorite` 코드 정독 | **PASS** — 직전 in-flight `abortRef.current?.abort()` + `setPendingId(id)` + `controller.signal.aborted` 검사로 stale 결과 차단. 03 §3.6.2 멱등 계약과 정합. |

## D19~D24 시행 검증

| ID | 결정 | 시행 위치 | 결과 |
|----|------|----------|------|
| D19 | 낙관적 안 a + 호출 측 prev 보관 | `my-recipes.tsx:handleToggleFavorite` (`data.find` → `mutate(next)` → `await toggle` → 실패 `mutate(prev)`), `recipe/[id].tsx:handleToggleFavorite` (`recipe` → `mutate({...prev, isFavorite: target})` → 실패 `mutate(prev)`) | PASS |
| D20 | PATCH 성공 시 invalidate + 상세 mutate (refetch 회피) | `useToggleFavorite.toggle` 성공 시 `invalidate()` 1회 + `return updated`. `recipe/[id].tsx` 성공 시 `mutate(updated)` — refetch GET 호출 0건 | PASS |
| D21 | DELETE 404 성공 정규화 | `useDeleteRecipe.remove` catch에서 `NOT_FOUND` → `invalidate()` + `return true`. setError 0건. | PASS |
| D22 | 삭제 상세 화면만 + 카드 onDelete 자리표시 유지 | `recipe/[id].tsx` Button + DeleteConfirmDialog 활성화. RecipeCard.onDelete prop 정의만(렌더 0건). my-recipes에서 `onDelete` 미사용. | PASS |
| D23 | ConfirmDialog 합성 정정 | `DeleteConfirmDialog.tsx` — leftButton/rightButton ReactElement + onClose/onExited 필수. ConfirmDialog.Button type/style props 사용. | PASS |
| D24 | useToggleFavorite id 가변 시그니처 | `useToggleFavorite()` 인자 없음 + `toggle(id, target)` 호출. `pendingId === recipe.id`로 카드별 pending. | PASS |

## AC4.* 수용 기준 (코드 경로)

| ID | 수용 기준 | 결과 |
|----|----------|------|
| AC4.1 | 즐겨찾기 토글 시 별 즉시 채워짐 → 성공 유지 / 실패 시 롤백 | **PASS** — my-recipes·[id] 둘 다 mutate(next) → 실패 시 mutate(prev). |
| AC4.2 | 즐겨찾기 필터 토글 시 목록 즉시 갱신 | **PASS** — FilterTabs onChange → setFilter + setPage(1) → query 변경 → useMyRecipes useEffect dep 변동 → 자동 refetch. |
| AC4.3 | 삭제 확인 → 200 → 목록에서 제거 | **PASS** — useDeleteRecipe.remove 성공 → invalidate() → useMyRecipes refetch → 목록에서 자동 제거. recipe/[id]는 handleBack. |
| AC4.4 | PATCH 404 → NotFoundScreen 분기 (상세 화면) / DELETE 404 → 성공 정규화 | **PASS** — PATCH 404는 호출 측 mutate(prev) + 다시 진입 시 useRecipeDetail 404 → NotFoundScreen. DELETE 404는 D21 정규화. 카드 측 PATCH 404는 invalidate 자동 제거. |
| AC4.5 | 다른 식별자 격리 | **PENDING (실호출)** — useTossUserId 헤더 격리 코드 경로 그대로(Phase 1 ADR-010·D5 단일 위치). 백엔드 옵션 P 배포 후 실증. Phase 1·2·3과 동일 PENDING 패턴. |

## 동시성·멱등 시나리오 검증 (AC4.5 + 03 §3.10 #14)

| 시나리오 | 코드 경로 |
|---------|----------|
| 같은 카드 별 두 번 빠르게 누름 | (1) `toggle(id, true)` 시작 → abortRef set → (2) 두 번째 `toggle(id, false)` 호출 시 직전 abort → 새 controller → setPendingId(id) → ... — 마지막 호출의 target만 서버에 반영(멱등 계약 4.1). UI는 mutate로 즉시 반영, invalidate로 서버 truth와 재동기화. PASS. |
| 다른 두 카드 동시 토글 | useToggleFavorite는 단일 인스턴스 + pendingId 1개라 직전 abort. 사용자가 같은 시점에 두 별을 누르면 첫 호출이 abort되어 첫 카드는 mutate(prev) 롤백. UX 한계 — v1 수용. 후속 별 ADR(다중 동시 PATCH 큐) 필요 시. |
| 삭제 진행 중 dimmer 클릭 | `closeOnDimmerClick={!pending}` + `onCancel` 가드(`if (!deletePending) setConfirmOpen(false)`) — pending 중 모달 닫힘 차단. PASS. |
| 삭제 성공 후 마이 목록 자동 갱신 | `useDeleteRecipe.remove` 성공 → `invalidate()` → useMyRecipes useEffect dep 변동 → refetch. handleBack 후 마이 목록 도착 시 데이터 갱신됨. PASS. |

## TDS 신규 컴포넌트 cross-check

| 컴포넌트 | TDS 패키지 d.ts | 합성 정합 |
|---------|----------------|-----------|
| `FavoriteButton` | `IconButton.d.ts` — `{ name, variant, iconSize, label, accessibilityLabel, accessibilityState, disabled, onPress }` | PASS — name string + variant clear + iconSize 24 + 한국어 label/accessibilityLabel + accessibilityState selected/disabled + onPress. |
| `FilterTabs` | `SegmentedControl/Root.d.ts` + `Item.d.ts` — `{ name, value, defaultValue?, size, onChange }` + `{ value, children }` | PASS — name="my-recipes-filter" + size="small" + onChange 형 변환(`v as FilterValue`). Item 2개. |
| `DeleteConfirmDialog` | `ConfirmDialog.d.ts` — `{ open, title, description, content?, leftButton, rightButton, closeOnDimmerClick?, onClose, onExited, onEntered? }` + `Button = DoubleButtonItem = ComponentProps<typeof Button>` | PASS — open/title/description/closeOnDimmerClick/onClose/onExited + leftButton·rightButton(ConfirmDialog.Button) + Button props type='light'/'danger' + style='weak'/'fill'. 2 children 강제 충족. |

## 멈춤 트리거 (baseline §H) 발생 여부

| 트리거 | 발생? | 비고 |
|--------|------|------|
| H1: icon-star-bold-mono/icon-star-mono 노랑 fallback | **N/A** — dev server 미실행 환경. 실 발생 시 대안 카탈로그 적용 + 06 §6.4.5 갱신 트리거. baseline §H.1 prerecord. |
| H2: ConfirmDialog 2 children throw | 미발생 — DeleteConfirmDialog가 leftButton/rightButton 정확히 2개 ReactElement 주입. |
| H3: PATCH 응답 isFavorite target 불일치 | N/A — 실호출 미수행. ADR-013 R1로 보존. |
| H4: DELETE 응답이 204 | N/A — 실호출 미수행. ADR-013 R2로 보존. |
| H5: 백엔드 옵션 P 미배포 | **누적** — Phase 1·2·3 그대로. AC4.5 PENDING. |
| H6: SDK 패키지 경로 | **누적** — Phase 1·2·3 그대로. dev server 첫 실행 시점 검증. |

## 결론

**Phase 4 ALL PASS (코드 경로 Q1~Q9 + D19~D24 + AC4.1~AC4.4)**. FAIL 0건. AC4.5는 백엔드 옵션 P 배포 후 실증 PENDING(Phase 1·2·3과 동일 누적).

다음 단계:
1. CLAUDE.md "현재 단계" 갱신 — Phase 4 완료.
2. 06 §6.5 갱신 — FavoriteButton/FilterTabs/DeleteConfirmDialog 실 구현 시그니처.
3. AGENTS.md 보강 — hooks/components/pages.
4. 커밋.
