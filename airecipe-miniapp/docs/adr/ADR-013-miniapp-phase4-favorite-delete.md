# ADR-013 — Phase 4 즐겨찾기·삭제·404 통일 (낙관적 UI · DELETE 404 정규화 · ConfirmDialog 정정)

> 전방 참조(2026-05-30): 본문이 인용하는 라우트 구현 위치 `src/pages/{my-recipes,recipe/[id]}.tsx`는 [ADR-018](./ADR-018-route-pages-consolidation.md)로 라우팅 루트 `pages/`로 통합됨. 아래 시점 기록은 보존한다.

- 상태: Accepted
- 일자: 2026-05-25
- 결정자: orchestrator(메인 세션 — 팀 1개 동시 제약으로 architect-as-orchestrator)
- 관련 ADR: ADR-005(404 통일), ADR-010(api-client 단일 경로·메모리 캐싱), ADR-011(Phase 2 SSE), ADR-012(Phase 3 라우팅·캐시·404 단일 컴포넌트), ADR-014(Phase 4.5 광고 SDK 격리)
- 관련 SSOT: `docs/appsintoss-port/03·06`, `_workspace/01_architect_phase4_baseline.md`, `_workspace_phase4_paused/` (partial baseline 보존)

## 컨텍스트

Phase 3 완료 후 즐겨찾기 토글(PATCH `/api/recipes/[id]/favorite`)·삭제(DELETE `/api/recipes/[id]`)·404 UI 통일을 마무리. Phase 4는 토스 광고 우선순위로 일시 보류된 뒤(Phase 4.5 산출 후) 재개. 도전 과제:

1. PATCH 멱등 보장(03 §3.6.2 "목표값 명시")과 낙관적 UI(AC4.1) 양립.
2. DELETE 404가 "이미 삭제됨"인 사용자 의도 달성 케이스(01-FEATURES AC3).
3. Phase 3 산출 `NotFoundScreen` 단일 컴포넌트 정책(ADR-012 D16)을 PATCH/DELETE 404에 그대로 재사용.
4. ConfirmDialog 실제 API가 요구사항 표기와 다른 점 정정.
5. 카드 목록에서 카드별 hook 호출 불가(rules of hooks) → 훅 시그니처 정정.

## 결정 카탈로그 (D19~D24)

### D19 — 낙관적 업데이트 정책 (안 a + 호출 측 prev 보관)
- **결정**: 호출 측이 (a) `mutate(next)` 즉시 적용 → (b) `await toggle(id, target)` → (c) 응답 `null` 시 `mutate(prev)` 롤백.
- **근거**: 훅 1개가 다양한 컨테이너(`useMyRecipes.data[]`, `useRecipeDetail.data`)의 state를 알 수 없음 → 훅 내부 prev 보관은 horizontal coupling. 호출 측이 prev를 알고 있음.
- **결과**: `useMyRecipes.mutate(next)` + `useRecipeDetail.mutate(next)` 신규 추가(Phase 4 확장).

### D20 — PATCH 성공 시 캐시 갱신 정책 (`invalidate()` + 상세 직접 mutate)
- **결정**: `useToggleFavorite.toggle()` 성공 시 (1) `invalidate()` 호출(마이 목록 자동 refetch) + (2) Recipe 반환. 호출 측(상세 화면)은 응답 Recipe를 받아 `useRecipeDetail.mutate(updated)`로 즉시 갱신 — 별도 GET refetch 회피.
- **근거**: PATCH 응답이 갱신된 Recipe 전체 반환(03 §3.6.3) → refetch는 불필요한 GET 1회 + 네트워크 왕복. 직접 setState가 즉시성·트래픽 모두 우월.
- **대안 기각**: refetch GET 1회 추가 — 비용.

### D21 — DELETE 404 성공 정규화
- **결정**: `useDeleteRecipe.remove()`가 `ApiClientError.error.code === 'NOT_FOUND'`를 성공으로 정규화 → `invalidate()` + `true` 반환. UI 메시지 0건.
- **근거**: 03 §3.7.4 멱등성 참고 + 01-FEATURES AC3 — "이미 삭제됨"이 사용자 의도와 동일. UX상 두 경우 구분 불필요.
- **결과**: 호출 측은 성공·404 구분 없이 navigation.goBack() 또는 navigate.

### D22 — 삭제 활성화 위치 (상세 화면만, 카드 onDelete prop 자리표시 유지)
- **결정**: 본 사이클은 상세 화면(`recipe/[id].tsx`)에만 삭제 버튼 + DeleteConfirmDialog 활성화. RecipeCard의 `onDelete` prop은 자리표시로 유지(미렌더).
- **근거**: 카드 측 삭제 트리거(swipe·long-press·별 IconButton)는 추가 UX 결정 필요. v1 단순성 우선. 자리표시는 향후 swipe·long-press UX 도입 여지.

### D23 — DeleteConfirmDialog 합성 (TDS ConfirmDialog 정확한 API 정정)
- **결정**: `ConfirmDialog` 실제 props는 `leftButton`/`rightButton` (`ReactElement` 필수, 2개 children 강제) + `onClose`/`onExited` (필수). `ConfirmDialog.Button = DoubleButtonItem = ComponentProps<typeof Button>` — TDS Button props 그대로(`type: 'primary'|'danger'|'light'|'dark'` + `style: 'fill'|'weak'`).
- **정정**: 요구사항(`_workspace/00_input/requirements.md:78`)의 `confirmText/cancelText/onConfirm/onCancel`은 TDS 실제 API 아님. partial baseline 초안의 `display="secondary"/"critical"`도 부정확.
- **확정 합성** (`src/components/DeleteConfirmDialog.tsx`):
  - 취소 버튼: `<ConfirmDialog.Button type="light" style="weak">취소</ConfirmDialog.Button>`
  - 삭제 버튼: `<ConfirmDialog.Button type="danger" style="fill">삭제</ConfirmDialog.Button>`
- **결과**: 06 §6.5 행 갱신(본 ADR과 동기 발행).

### D24 — `useToggleFavorite` id 가변 시그니처 (rules of hooks 정합)
- **결정**: `useToggleFavorite()` (인자 없음) + `toggle(id, target)` 패턴. `pendingId: string | null`로 진행 중 id 추적(카드별 pending UI 판정용).
- **근거**: 카드 목록(`data.map(...)`)에서 카드별 `useToggleFavorite(card.id)` 호출은 rules of hooks 위반. 단일 hook 인스턴스를 다양한 id에 공유 + `pendingId`로 어느 카드가 진행 중인지 판정.
- **상세 화면**(`recipe/[id].tsx`)도 동일 시그니처 — `pendingId === recipe.id` 검사.
- **`useDeleteRecipe(id)`는 그대로** — 상세 화면 1곳에서만 호출, id 가변 불필요.

## 추가 정책 (Phase 3 동결 그대로 유지)

### 404 단일 컴포넌트 정책 강화 (ADR-012 D16 답습)
- PATCH/DELETE 404 응답 시점에도 `<NotFoundScreen onBack={...} />` 그대로 재사용.
- 상세 화면의 PATCH 404: useToggleFavorite가 null 반환 → mutate(prev) 롤백 → 사용자가 다시 진입 시 useRecipeDetail의 GET이 404를 받아 notFound 분기 → NotFoundScreen 렌더. 본 사이클은 PATCH 시점의 즉시 NotFoundScreen 전환 안 함(별 UI 강요 X — D9).
- 목록 카드 PATCH 404: `invalidate()` 자동 호출 → 카드가 자동 사라짐(백엔드가 본인 소유만 반환).
- DELETE 404: D21로 성공 정규화 → UI 분기 없음.

### invalidate() 호출 위치 (ADR-012 D15 답습)
- `useToggleFavorite.toggle` 성공 시 1회.
- `useDeleteRecipe.remove` 성공·404 정규화 시 1회.
- 실패 시 0건 (stale 데이터 유지가 안전 — Phase 3 `useSaveRecipe` 패턴).

### 삭제 후 navigation (`goBack()` 우선)
- Phase 3 `recipe/[id].tsx:49-55` 패턴 재사용 — `canGoBack?.() ? goBack() : navigate('/my-recipes', {})`.
- `invalidate()` 자동 호출되므로 goBack 후 마이 목록 자동 refetch.

## 결과 (산출 코드 — Phase 3·4.5 누적 위에 추가)

| 파일 | 작성 종류 | 라인 |
|------|----------|------|
| `src/hooks/useToggleFavorite.ts` | 신규 | ~120 |
| `src/hooks/useDeleteRecipe.ts` | 신규 | ~105 |
| `src/hooks/useMyRecipes.ts` | 확장 (mutate 추가) | +18 |
| `src/hooks/useRecipeDetail.ts` | 확장 (mutate 추가) | +18 |
| `src/components/FavoriteButton.tsx` | 신규 | ~35 |
| `src/components/FilterTabs.tsx` | 신규 | ~30 |
| `src/components/DeleteConfirmDialog.tsx` | 신규 | ~60 |
| `src/components/RecipeCard.tsx` | 확장 (onToggleFavorite 활성화 + favoritePending) | +20 |
| `src/pages/my-recipes.tsx` | 확장 (FilterTabs + RecipeCard 콜백 + 낙관적 mutate) | +60 |
| `src/pages/recipe/[id].tsx` | 확장 (FavoriteButton + 삭제 + Dialog + 낙관적 mutate) | +90 |

라우트 신규 0건 — Phase 3 4 라우트 그대로 유지.

QA 매트릭스 ALL PASS (Q1~Q7 + 추가):
- `<ErrorPage>` 직접 렌더 — `NotFoundScreen.tsx:28` 단 1곳.
- `<NotFoundScreen>` 사용 — `pages/recipe/[id].tsx:130` 단 1곳.
- "찾을 수 없" 인라인 텍스트 — 페이지 0건(NotFoundScreen + 에러 매핑 표만).
- `invalidate()` 호출 — useSaveRecipe + useToggleFavorite + useDeleteRecipe(2곳: 성공·404).
- 직접 fetch — services/api-client.ts + sse-client.ts 정확 2곳(Phase 1·2 동결).
- TDS 신규 import — IconButton(FavoriteButton) + SegmentedControl(FilterTabs) + ConfirmDialog(DeleteConfirmDialog) 각 1곳.
- typecheck + lint 0 errors.

## 수용 기준 (10-SPRINT-PLAN §10.5 AC4.*)

- **AC4.1**: 즐겨찾기 토글 시 별 즉시 채워짐 → 성공 유지 / 실패 시 mutate(prev) 롤백. **코드 경로 PASS**.
- **AC4.2**: FilterTabs 변경 → query.favorite 변경 → useMyRecipes 자동 refetch + page 1 리셋. **코드 경로 PASS**.
- **AC4.3**: 삭제 확인 → 200 + `{ data: { id } }` → invalidate + goBack. **코드 경로 PASS**.
- **AC4.4**: PATCH 404 → 상세 화면은 mutate(prev) 롤백 후 사용자가 새로 진입 시 NotFoundScreen / DELETE 404 → 성공 정규화 → invalidate + goBack. 카드 목록 PATCH 404는 invalidate로 자동 제거. **코드 경로 PASS**.
- **AC4.5**: 다른 식별자 격리 — useTossUserId 헤더 격리 그대로. 백엔드 옵션 P 배포 후 실증 — PENDING.

## 영향

- **긍정**:
  - 낙관적 UI로 즐겨찾기 즉시성 보장 (UX 우선).
  - 삭제 멱등 + 404 정규화로 동시성 안전.
  - Phase 3 `NotFoundScreen`·`invalidate trigger` 그대로 재사용 — 컴포넌트 SRP + 캐시 단일 진입점.
  - `useMyRecipes`·`useRecipeDetail` mutate 추가로 향후 다른 mutation(예: 메모·평점)에도 동일 패턴 일반화 가능.
- **부정/제약**:
  - 카드 측 PATCH 404 발생 시 사용자에게 별도 알림 없이 카드만 사라짐 — UX 결정. v1 단순성 우선.
  - 카드 측 삭제는 자리표시 — 향후 swipe·long-press 별 ADR.

## 후속 작업 (Phase 5)

- TDS 점검 + 콘솔 등록 + 검수 가이드(09 §9.6 + `appsintoss-publish-checklist`).
- 광고 정책 점검(ADR-014 §11.6).
- 디자인 토큰 hex → adaptive 일괄 교체 (Phase 2 누적).
- 무한 스크롤 (Phase 3 누적).
- 백엔드 옵션 P 배포 후 AC3.5·AC3.6·AC4.5 실증.

## 롤백 조건

- (R1) PATCH 응답 isFavorite이 요청 target과 다름 — 백엔드 멱등 위반 → architect 통지 후 hotfix(별 저장소).
- (R2) DELETE 응답이 204인 경우 — zod 검증 실패. recipes.ts deleteResponseSchema 즉시 throw → 별 저장소 hotfix.
