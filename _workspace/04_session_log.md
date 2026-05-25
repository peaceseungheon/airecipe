# Phase 4 Session Log — 즐겨찾기·삭제·404 통일 (재개 및 완료)

> 일자: 2026-05-25
> 입력: 사용자 — "phase 4 작업 재개"
> 실행: orchestrator(메인 세션, auto mode) — 팀 1개 동시 제약으로 architect/api-client/frontend/qa-as-orchestrator(Phase 4.5와 동일 패턴)

## 타임라인

1. **재개 결정** — Phase 4.5(토스 광고 기반) 완료 후 Phase 4(즐겨찾기·삭제·404 통일) 재개. 사용자 요청 "phase 4 작업 재개".

2. **워크스페이스 정리**:
   - `_workspace` (Phase 4.5 산출) → `_workspace_phase45/` 보존.
   - `_workspace_phase4_paused` → `_workspace/` (재개).
   - `_workspace_phase4_paused/01_architect_phase4_baseline_partial.md` → `_workspace/01_architect_phase4_baseline.md` (정식 승격).

3. **baseline 정정 추가** (정식 승격 시):
   - "보류" 마커 제거 + 재개 메타 추가.
   - **§A.1 ConfirmDialog Button props 정정**: partial 초안의 `display="secondary"/"critical"`은 부정확 → `type="light" style="weak"`(취소), `type="danger" style="fill"`(삭제). TDS Button d.ts(`type` + `style` 두 prop 분할)와 정합.
   - **§B D10 useToggleFavorite 시그니처 정정**: rules of hooks 위반(카드 목록 map 안 카드별 hook 호출 불가) → 시그니처 `useToggleFavorite()` + `toggle(id, target)` + `pendingId` 추적.

4. **TDS 추가 검증** — `ConfirmDialog.Button = DoubleButtonItem = ComponentProps<typeof Button>` 확인. Button.d.ts: `type: 'primary'|'danger'|'light'|'dark'` + `style: 'fill'|'weak'` + `display`/`size`/`loading`/`disabled` 등.

5. **코드 작성 — 신규 5 + 확장 4 + Phase 3 그대로 1**:
   - `src/hooks/useToggleFavorite.ts` (신규) — id 가변 시그니처 + pendingId + 직전 in-flight abort + invalidate.
   - `src/hooks/useDeleteRecipe.ts` (신규) — 404 성공 정규화 + invalidate.
   - `src/hooks/useMyRecipes.ts` 확장 — `mutate(next)` 추가(낙관적 mutation 지원).
   - `src/hooks/useRecipeDetail.ts` 확장 — `mutate(next)` 추가(PATCH 응답 직접 갱신, refetch 회피).
   - `src/components/FavoriteButton.tsx` (신규) — IconButton + 멱등 콜백 + 접근성.
   - `src/components/FilterTabs.tsx` (신규) — SegmentedControl 2-state.
   - `src/components/DeleteConfirmDialog.tsx` (신규) — ConfirmDialog 정확한 props 합성.
   - `src/components/RecipeCard.tsx` 확장 — onToggleFavorite 자리표시 활성화 + favoritePending prop.
   - `src/pages/my-recipes.tsx` 확장 — FilterTabs + RecipeCard.onToggleFavorite + 낙관적 mutate + favoriteError 토스트.
   - `src/pages/recipe/[id].tsx` 확장 — PageNavbar.AccessoryButtons에 FavoriteButton + 본문 하단 삭제 Button + DeleteConfirmDialog + 낙관적 mutate + favorite·delete 에러 토스트.

6. **typecheck 1차 PASS** — exit 0.

7. **lint 1차 FAIL** — `cancelled` 변수가 mutation 훅(useEffect cleanup 없음)에서 변경 없이 let 선언 → `prefer-const` error 2건. 변수 자체가 무의미하므로 제거. controller.signal.aborted만 사용으로 정합.

8. **lint 2차 PASS** — 0 errors, 1 무해 warning(router.gen.ts Phase 3 누적).

9. **QA 매트릭스 Q1~Q9 grep 검증 ALL PASS** + D19~D24 시행 검증 ALL PASS + AC4.1~AC4.4 코드 경로 PASS(AC4.5는 백엔드 옵션 P 배포 PENDING).

10. **문서 작성**:
    - `docs/adr/ADR-013-miniapp-phase4-favorite-delete.md` 발행 — D19~D24 6 결정.
    - `docs/appsintoss-port/06-UI-MAPPING.md` §6.5 갱신 — FilterTabs/DeleteConfirmDialog/FavoriteButton 실 구현 + RecipeCard Phase 4 확장 + ConfirmDialog props 정정.
    - `src/hooks/AGENTS.md` 보강 — useToggleFavorite/useDeleteRecipe 행 + 낙관적 UI/id 가변 시그니처 규약.
    - `src/components/AGENTS.md` 보강 — FavoriteButton/FilterTabs/DeleteConfirmDialog 행 + ConfirmDialog 정정 규약.
    - `src/pages/AGENTS.md` 보강 — my-recipes·[id] Phase 4 확장 표기 + 낙관적 UI/단일 hook 규약.
    - `_workspace/03_qa_report.md` 작성 — Q1~Q9 매트릭스 + D19~D24 시행 + AC4.* + 멈춤 트리거 검토.

11. **CLAUDE.md "현재 단계" 갱신** (다음 단계).

12. **커밋** (다음 단계).

## 결정 사항 (D19~D24, ADR-013 발행)

| ID | 결정 | 출처 |
|----|------|------|
| D19 | 낙관적 안 a + 호출 측 prev 보관 | baseline §B D4 |
| D20 | PATCH 성공 시 invalidate + 상세 mutate (refetch 회피) | baseline §B D5 |
| D21 | DELETE 404 성공 정규화 | baseline §B D6 |
| D22 | 삭제 활성화 상세 화면만 (카드 onDelete 자리표시 유지) | baseline §B D7 |
| D23 | ConfirmDialog 합성 정정 (leftButton/rightButton + Button props) | baseline §A.1 + 재개 시 정정 |
| D24 | useToggleFavorite id 가변 시그니처 (rules of hooks) | 재개 시 정정 |

추가 정책 (Phase 3·4.5 답습):
- D12: 404 단일 컴포넌트 정책 강화 — ADR-012 D16 답습.
- D13: invalidate 호출 위치 — ADR-012 D15 답습.
- D8: 삭제 후 handleBack 패턴 — Phase 3 답습.

## QA 결과 요약

**ALL PASS — Q1~Q9 매트릭스 9/9 + D19~D24 시행 6/6 + AC4.1~AC4.4 4/4 PASS, FAIL 0건**. typecheck PASS, lint 0 errors. AC4.5는 백엔드 옵션 P 배포 후 실증 PENDING(Phase 1·2·3·4.5와 동일 누적).

## 누적 미해결 (Phase 1~4.5 위에 갱신)

| 항목 | 출처 | 상태 |
|------|------|------|
| SDK 패키지 경로 (`@apps-in-toss/web-framework` 미해결) | Phase 2 인계 #1 | dev server 실행 시점 검증 보류 |
| AbortSignal cast 2곳 | ADR-011 D13 | Phase 5 재평가 |
| `useBackEvent` 하드웨어 백 | Phase 3 인계 #3 | 별 ADR — 본 사이클 ConfirmDialog가 dimmer click + closeOnDimmerClick으로 해결 |
| 디자인 토큰 hex → adaptive 일괄 교체 | Phase 2 인계 #7 | 별 ADR (Phase 5 진입 전 권장) |
| 백엔드 옵션 P 배포 | 별 저장소 AIReceipe | 외부 작업 |
| 무한 스크롤 | Phase 3 인계 #6 | Phase 5 별 ADR |
| 콘솔 `adGroupId` 발급·승인 | Phase 4.5 PENDING | 외부 작업 |
| 전면 광고 wiring + 빈도 제한 | ADR-014 D30·D34 | 별 ADR |
| Analytics SDK 통합 | ADR-014 D33 | 별 ADR |
| 카드 측 삭제 UX (swipe·long-press) | Phase 4 ADR-013 D22 | 별 ADR |
| 다중 동시 PATCH 큐 | Phase 4 QA report 동시성 한계 | 별 ADR (현 v1 수용) |

## Phase 5 인계

- TDS 점검 + 콘솔 등록 + 검수 가이드 (09 §9.6 + appsintoss-publish-checklist 스킬).
- 광고 정책 정합 점검 (ADR-014 §11.6).
- 디자인 토큰 hex → adaptive 일괄 교체 별 ADR.
- 무한 스크롤 별 ADR.
- 콘솔 `adGroupId` 발급 후 staging 광고 검증.
- 백엔드 옵션 P 배포 후 AC3.5·AC3.6·AC4.5 실증.
