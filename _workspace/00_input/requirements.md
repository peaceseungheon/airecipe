# Phase 4 — 즐겨찾기·삭제 + 404 UI 통일 (기능 e, f)

> 출처: 사용자 요청 "phase4 작업 진행"
> SSOT: `docs/appsintoss-port/10-SPRINT-PLAN.md` §10.5

## 목적

즐겨찾기 토글과 삭제를 완성하고, 404 케이스를 모든 화면에서 일관 처리. Phase 3 산출 `NotFoundScreen`(단일 컴포넌트)·`useRecipeCacheTrigger.invalidate()`·`RecipeCard.{onToggleFavorite,onDelete}` 자리표시 prop을 활성화한다.

## 입력 전제 (Phase 3 완료)

- ADR-012 동결 — D14~D18 (목록 라우트 `/my-recipes`, 캐시 무효화 Context+bump trigger, 저장 후 `/recipe/[id]` 직진, `NotFoundScreen` 단일 컴포넌트, EmptyState 정의, 페이지네이션 단순).
- Phase 3 산출 (수정 0건 동결):
  - `src/hooks/{useRecipeCache.tsx, useMyRecipes.ts, useRecipeDetail.ts, useSaveRecipe.ts}`
  - `src/components/{RecipeCard,EmptyState,NotFoundScreen}.tsx` — RecipeCard는 Phase 4 즐겨찾기/삭제 prop 자리표시(`onToggleFavorite?`, `onDelete?`) 보유, 본 Phase에서 활성화.
  - `src/pages/{my-recipes.tsx, recipe/[id].tsx, recipe/generate.tsx, index.tsx}`
  - `src/_app.tsx` — `RecipeCacheProvider` 래핑됨.
- Phase 1·2 동결(ADR-010·011) 그대로.
- `src/services/recipes.ts` — `toggleFavorite`/`deleteRecipe` 메서드는 Phase 1 baseline에서 이미 정의 완료. 본 Phase는 호출 측(훅·컴포넌트·페이지) 작성이 핵심.
- `pnpm typecheck`/`lint` PASS, QA FAIL 0건.
- AGENTS.md: `src/{types,lib/zod,services,hooks,components,pages}/` 모두 Phase 3까지 갱신 완료.

## 산출물 (10-SPRINT-PLAN §10.5 출력)

### 1. 즐겨찾기 토글 (기능 e)

**API 계약** (03 §3.6): `PATCH /api/recipes/[id]/favorite`, 본문 `{ isFavorite: boolean }` (목표 값, 토글 아님 — 멱등). 응답 200 + `{ data: Recipe }`. 404·401·400·503 분기.

- **`useToggleFavorite`** 훅 신규
  - 시그니처: `(id: string) => { toggle: (target: boolean) => Promise<void>, isPending: boolean, error: string | null }` (baseline에서 확정).
  - `toggleFavorite(id, { isFavorite: target }, auth)` 호출 + 401 자동 재시도(`refresh` 주입).
  - 성공 시: 마이 목록 + 상세 화면 일관성 보장 (baseline에서 결정 — `useRecipeCacheTrigger.invalidate()` 호출 / `useRecipeDetail.refetch()` 직접 호출 등).
  - 404(`error.code === 'NOT_FOUND'`) 시: 상세 화면이면 `NotFoundScreen` 분기, 목록 카드면 캐시 무효화 후 카드 사라짐.
  - AbortController unmount 처리 + cancelled 플래그 (기존 훅 패턴 준수).

- **`FavoriteButton`** 컴포넌트 신규 (06 §6.4.5)
  - props: `{ isFavorite: boolean; onToggle: (target: boolean) => void | Promise<void>; pending?: boolean }` (06 §6.4.5 — 멱등 목표값 콜백 시그니처 유지).
  - TDS `IconButton` + `name="icon-star-bold-mono"`(채움)/`"icon-star-mono"`(비움) — Phase 4 baseline에서 정확한 icon name 확정 (TDS Icon 카탈로그 검증).
  - `accessibilityState={{ selected: isFavorite }}` + `accessibilityLabel`(한국어).
  - `disabled={pending}`.

- **활성화 위치**:
  - `RecipeCard.onToggleFavorite` 자리표시 prop 활성화 — `<FavoriteButton />` 합성. `recipe.isFavorite` 사용.
  - 상세 화면(`/recipe/[id]`)에 즐겨찾기 버튼 추가 — 헤더(`PageNavbar.AccessoryButtons`) 또는 본문.

- **낙관적 업데이트 정책** (AC4.1): baseline에서 결정.
  - 안 a: 낙관적 — UI 즉시 별 채움 → 응답 OK → 그대로 / 실패 → 롤백.
  - 안 b: 보수적 — pending 상태 표시 → 응답 OK 후 별 채움.
  - 권장: 안 a (UX 우선, AC4.1과 일치). 롤백은 `useToggleFavorite` 내부에서 처리 또는 호출 측이 prev state 보관.

### 2. 즐겨찾기 필터 (AC4.2)

- **`FilterTabs`** 컴포넌트 신규 (06 §6.5 — TDS `SegmentedControl` 또는 `Tab`)
  - props: `{ value: 'all' | 'favorite'; onChange: (v: 'all' | 'favorite') => void }`.
  - 실재성 검증: baseline에서 `@toss/tds-react-native`의 `SegmentedControl`/`Tab` 표본 확인.

- **`/my-recipes` 페이지 확장**:
  - 상단에 `<FilterTabs />` 렌더.
  - `useMyRecipes({ ..., favorite: value === 'favorite' ? true : undefined })`.
  - 필터 변경 시 `page` state 1로 리셋.
  - 빈 상태 분기:
    - 전체 0건 → 기존 EmptyState ("저장된 레시피가 없어요" + "레시피 만들러 가기").
    - 즐겨찾기 0건 → EmptyState 재사용 ("즐겨찾기한 레시피가 없어요" + "전체 보기" 또는 "레시피 만들러 가기").

### 3. 삭제 (기능 f)

**API 계약** (03 §3.7): `DELETE /api/recipes/[id]`, 본문 없음. 응답 200 + `{ data: { id } }`. 멱등 참고 — 두 번째 호출은 404("이미 삭제됨"으로 처리 — 01-FEATURES AC3).

- **`useDeleteRecipe`** 훅 신규
  - 시그니처: `(id: string) => { remove: () => Promise<void>, isPending: boolean, error: string | null }` (baseline에서 확정).
  - `deleteRecipe(id, auth)` 호출 + 401 자동 재시도.
  - 성공 시: `useRecipeCacheTrigger.invalidate()` 호출 → 마이 목록 자동 refetch (Phase 3 동일 패턴 — ADR-012 D15 재사용).
  - 404 시: "이미 삭제됨"으로 정상 처리(에러 표시 없이 invalidate 후 navigate). baseline에서 확정.
  - AbortController unmount 처리.

- **`DeleteConfirmDialog`** 컴포넌트 신규 (06 §6.5 — TDS `ConfirmDialog` 합성)
  - props: `{ open: boolean; recipeName: string; onConfirm: () => void; onCancel: () => void; pending?: boolean }`.
  - TDS `ConfirmDialog` 실재 확인됨 (`@toss/tds-react-native/dist/esm/components/dialog/ConfirmDialog.d.ts`). baseline에서 props 시그니처 확정.
  - 확인 버튼: "삭제"(destructive 컬러) — TDS 권장 패턴.
  - 취소 버튼: "취소".
  - 한국어 카피: "이 레시피를 삭제할까요?\n삭제하면 되돌릴 수 없어요."

- **활성화 위치**:
  - 상세 화면(`/recipe/[id]`) 에 삭제 버튼 추가 (`PageNavbar.AccessoryButtons` 또는 본문 footer).
  - 삭제 성공 후: `navigation.goBack()` 또는 `navigate('/my-recipes', {})` (baseline 확정).
  - 목록 화면(`/my-recipes`) `RecipeCard.onDelete` 자리표시 prop 활성화 여부: baseline 결정. **권장**: Phase 4 v1은 **상세 화면에서만 삭제** — 카드 측 onDelete는 자리표시 유지(과도한 swipe·long-press UX 회피). 카드 onDelete 활성화는 별 ADR.

### 4. 404 UI 통일 (AC4.4)

- 404 응답을 받는 3개 엔드포인트(`GET[id]` Phase 3 완료 / `PATCH favorite` / `DELETE`) 모두 동일 `NotFoundScreen` 컴포넌트로 라우팅.
- Phase 3 baseline §H.2 #13 "단일 컴포넌트 정책" 강화 — `pages/`에서 `<ErrorPage statusCode={404}>` 직접 렌더 + 인라인 "찾을 수 없" 텍스트 금지 (Phase 4에서도 유지).
- PATCH favorite 404 (상세 화면): `NotFoundScreen` 즉시 표시 + 캐시 invalidate.
- PATCH favorite 404 (목록 카드): 캐시 invalidate → 카드 자동 제거 (별도 UI 없음).
- DELETE 404: "이미 삭제됨"으로 정상 처리 → invalidate + navigate. UI는 NotFoundScreen 표시하지 않음 (사용자 의도 달성).

### 5. 동시성 (AC4.5 + 멱등 검증)

- PATCH favorite 두 번 빠르게 → 마지막 의도가 보장됨 (멱등 — `isFavorite` 목표 값 명시 덕분).
- `useToggleFavorite` 내부: 직전 in-flight 요청 abort → 새 요청 발행. cancelled 플래그로 stale setState 차단.
- 두 명의 다른 식별자 시나리오에서 격리 유지 (백엔드 옵션 P 미배포 시 PENDING, Phase 1·2·3과 동일 패턴).

## 수용 기준 (10-SPRINT-PLAN §10.5 AC4.*)

- **AC4.1**: 즐겨찾기 토글 시 별 즉시 채워짐 → 응답 OK → 그대로 / 실패 → 롤백.
- **AC4.2**: 즐겨찾기 필터 토글 시 목록이 즉시 갱신.
- **AC4.3**: 삭제 확인 → 200 + `{ data: { id } }` → 목록에서 제거.
- **AC4.4**: 이미 삭제된 id로 다시 PATCH/DELETE 시 404 → 동일 "찾을 수 없어요" UI (PATCH) / "이미 삭제됨" 정상 처리 (DELETE).
- **AC4.5**: 두 명의 다른 식별자 시나리오에서 격리 유지 (백엔드 옵션 P 미배포 시 코드 경로 PASS / 실 호출 PENDING).

## SSOT 인용 경로

| 영역 | 챕터 |
|------|------|
| PATCH favorite 엔드포인트(멱등·404·400·503) | `docs/appsintoss-port/03-API-CONTRACT.md` §3.6 |
| DELETE 엔드포인트(200+id·404·503) | `03-API-CONTRACT.md` §3.7 |
| `FavoriteButton` 매핑 (IconButton + 멱등 콜백) | `06-UI-MAPPING.md` §6.4.5 |
| `DeleteConfirmDialog` 매핑 (TDS ConfirmDialog) | `06-UI-MAPPING.md` §6.5 |
| `FilterTabs` 매핑 (SegmentedControl/Tab) | `06-UI-MAPPING.md` §6.5 |
| 404 UI 단일 컴포넌트 (`NotFoundScreen`) | Phase 3 baseline §H.2 #13 + ADR-005 + ADR-012 D16 |
| 캐시 무효화 (`useRecipeCacheTrigger.invalidate()`) | Phase 3 baseline §D.2 + ADR-012 D15 |
| 401 자동 재시도 | `05-AUTH.md` §5.4 + ADR-010 D3 |
| RecipeCard prop 자리표시 활성화 | Phase 3 baseline §B.2 + `src/components/RecipeCard.tsx:32-35` |
| 디렉터리 책임 | `src/{hooks,components,pages}/AGENTS.md` |
| Phase 1·2·3 동결 규약 | `ADR-010`, `ADR-011`, `ADR-012` |
| 미니앱 코드 규칙 (TDS·zod·헤더 비노출) | `CLAUDE.md` 코드 규칙 |

## 비범위

- Phase 5 — TDS 점검·번들 100MB·콘솔·검수 체크리스트 (별 Phase).
- 카드 측 삭제 UX(swipe·long-press) — 별 ADR(Phase 4 v1은 상세 화면에서만 삭제).
- 무한 스크롤 — Phase 5 출시 직전 별 ADR (Phase 3 누적 미해결).
- 디자인 토큰 hex → adaptive 일괄 교체 — 별 ADR (Phase 3 누적 미해결).
- 백엔드 옵션 P 배포 — 별 저장소 AIReceipe (본 저장소 외부 작업).
- `useBackEvent` 하드웨어 백 — Phase 4 PATCH/DELETE 낙관적 업데이트 도입 시 검토 (보류 가능).

## 위험·완화

| 위험 | 완화 |
|------|------|
| TDS Icon name(`icon-star-bold-mono`/`icon-star-mono`) 실재 확인 | baseline에서 TDS Icon 카탈로그 또는 `node_modules/@toss/tds-react-native` 표본 검증 → 실재 안 하면 대안 icon name 채택 + 06 §6.4.5 갱신. |
| TDS `SegmentedControl`/`Tab` 둘 중 실재 확인 | baseline에서 표본 검증 → 둘 다 부재 시 `Button` 토글 합성. |
| 낙관적 업데이트 롤백 정책 모호 | baseline §A.1·§A.2에서 안 a(낙관적+롤백)/안 b(보수적) 1택 + 롤백 위치(훅 내부 vs 호출 측) 명시. AC4.1 검증 시 두 시나리오(성공·실패) 코드 경로 PASS. |
| PATCH favorite 성공 시 마이 목록 + 상세 화면 동시 갱신 정책 (Phase 3 baseline §D.2 인계 미결) | baseline에서 결정 — (1) `invalidate()` 호출 (마이 목록) + (2) 상세 화면은 응답 Recipe로 직접 state 업데이트 (refetch 회피 — UX 즉시성). |
| DELETE 404 처리 (이미 삭제됨) — 에러 vs 성공 분기 | baseline에서 결정 — 404 시 `useDeleteRecipe`가 성공으로 정규화(invalidate + navigate). 사용자 의도 달성. 01-FEATURES AC3 인용. |
| RecipeCard 카드 측 즐겨찾기 토글 시 무한 클릭 → 다중 PATCH | `FavoriteButton.pending` + `disabled={pending}` + 직전 in-flight abort. 멱등 덕분에 최종 일관성 보장. |
| ConfirmDialog 백 버튼 처리(하드웨어 백·dimmer 클릭) | TDS `closeOnDimmerClick` + 백 버튼 시 onCancel 자동 호출. `useBackEvent` 별도 도입은 보류. |
| 상세 화면 삭제 후 navigation — `goBack()` 시 마이 목록 자동 갱신 보장 | `useRecipeCacheTrigger.invalidate()`로 마이 목록 자동 refetch. `goBack()`로 충분 — `navigate('/my-recipes', {})`는 history 중복 우려. |
| AC4.4 PATCH 404 시 NotFoundScreen 표시 위치 (상세 화면만 / 목록에도?) | baseline에서 결정 — 상세 화면만. 목록 카드는 invalidate로 자동 제거(별도 UI 없음). |
| Phase 3 인계 — `useBackEvent` 도입 시점 | 본 Phase에서 보류 가능 — TDS Dialog 자체 백 처리 + navigation goBack로 충분. 별 ADR. |
| 백엔드 옵션 P 배포 전 AC4.5 실증 불가 | Phase 1·2·3과 동일 PENDING 패턴 — 코드 경로 PASS + curl 시뮬레이션 기록. |
