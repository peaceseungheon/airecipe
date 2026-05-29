# Phase 4 Baseline — 즐겨찾기·삭제 + 404 UI 통일 (기능 e, f)

> 작성: miniapp-architect · 2026-05-25 · 팀 `airecipe-miniapp-phase4`
> **재개**: 2026-05-25 orchestrator(메인 세션 — 팀 1개 동시 제약으로 architect-as-orchestrator) — Phase 4.5(`_workspace_phase45/`) 완료 후 Phase 4 재개. partial을 정식 승격 + Button props 정정 추가.
> 상태: **정식 — TDS 실재성 검증 완료 + 13 결정 동결**.

> **재개 시 정정 사항 (2026-05-25)**: `ConfirmDialog.Button = DoubleButtonItem = ComponentProps<typeof Button>`. TDS Button 실제 props는 `type: 'primary'|'danger'|'light'|'dark'` + `style: 'fill'|'weak'` 두 prop 분할(Button.d.ts 인용). partial 초안의 `display="secondary"`/`display="critical"`은 부정확 — 정정 동결: 취소 `type="light" style="weak"`, 삭제 `type="danger" style="fill"`. `display`는 ConfirmDialog 내부에서 자동 처리됨(생략 OK).
> 입력 SSOT: `_workspace/00_input/requirements.md`, `docs/appsintoss-port/03·06`, `docs/adr/ADR-005·010·011·012`, `_workspace_phase3/01_architect_phase3_baseline.md`, Phase 3 산출 코드.

---

## A. TDS 실재성 검증 결과 (Phase 4 신규 사용 분) — 검증 PASS

### A.1 ConfirmDialog (`@toss/tds-react-native@2.0.3`)

**경로**: `node_modules/@toss/tds-react-native/dist/esm/components/dialog/ConfirmDialog.d.ts`
**export**: `node_modules/.../components/dialog/index.d.ts` — `ConfirmDialog` default + `ConfirmDialogProps` type.

**정확한 시그니처** (인용):

```ts
export interface ConfirmDialogProps extends Pick<BaseDialogProps,
  'open' | 'closeOnDimmerClick' | 'onClose' | 'onExited' | 'onEntered'>,
  AccessibilityProps {
    title: ReactNode;          // 필수
    description?: ReactNode;
    content?: ReactNode;
    leftButton: ReactElement;  // 필수
    rightButton: ReactElement; // 필수
}
declare const ConfirmDialog: ForwardRefExoticComponent<ConfirmDialogProps & RefAttributes<View>> & {
    Button: typeof DoubleButtonItem;  // ConfirmDialog.Button — DoubleButtonItem(size="large", flexGrow:1)
};
```

**BaseDialog 필수 props** (`BaseDialog.d.ts:4-14`):

```ts
export interface BaseDialogProps extends AccessibilityProps {
    open: boolean;
    closeOnDimmerClick?: boolean;
    onClose: () => void;       // 필수
    onExited: () => void;       // 필수 — NOTE: onCloseAnimationEnd
    onEntered?: () => void;
}
```

**구현 검증** (`ConfirmDialog.js`): `DoubleButton`이 `Children.count`로 정확히 2개 children 강제 (다르면 `throw new Error('There should be 2 children in DoubleButton.')`).

**`DeleteConfirmDialog` 합성 시그니처 (확정)**:

```tsx
// src/components/DeleteConfirmDialog.tsx (신규)
import { ConfirmDialog } from '@toss/tds-react-native';

export interface DeleteConfirmDialogProps {
  open: boolean;
  recipeName: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 진행 중 — 확인 버튼 비활성화. */
  pending?: boolean;
}

export function DeleteConfirmDialog({
  open, recipeName, onConfirm, onCancel, pending,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="이 레시피를 삭제할까요?"
      description={`"${recipeName}"을(를) 삭제하면 되돌릴 수 없어요.`}
      closeOnDimmerClick={!pending}
      onClose={onCancel}
      onExited={() => { /* close 애니메이션 종료 — no-op (호출 측이 open=false 유지) */ }}
      leftButton={
        <ConfirmDialog.Button type="light" style="weak" onPress={onCancel} disabled={pending}>
          취소
        </ConfirmDialog.Button>
      }
      rightButton={
        <ConfirmDialog.Button type="danger" style="fill" onPress={onConfirm} loading={pending} disabled={pending}>
          삭제
        </ConfirmDialog.Button>
      }
    />
  );
}
```

> 요구사항(`requirements.md:78`)이 명시한 `confirmText`/`cancelText` props는 **실재하지 않음**. `leftButton`/`rightButton`에 `ReactElement` 주입이 SSOT 패턴. 06 §6.5 갱신 시 정정 필요 (T5에서 처리).

### A.2 IconButton + Icon (`@toss/tds-react-native@2.0.3`)

**IconButton.d.ts**:
```ts
type Variant = 'fill' | 'clear' | 'border';
type Asset = { source: SvgImageProps['href']; name?: never }
           | { source?: never; name: string };
interface IconButtonBaseProps extends PressableProps {
    color?: string; bgColor?: string;
    variant?: Variant; iconSize?: number; label?: string;
    style?: StyleProp<ViewStyle>;
}
export type IconButtonProps = IconButtonBaseProps & Asset;
```

**Icon.d.ts**:
```ts
export interface IconProps extends Pick<ViewProps,'style'>, AccessibilityProps {
    size?: number; color?: string;
    type?: 'default' | 'circle';
    name: string;  // ← string 타입, enum 아님
}
prefetchIcon: (name: string) => Promise<void>;
```

**Icon 카탈로그는 enum이 아니라 동적 SVG fetch**: `Icon.js` 인용 — `https://static.toss.im/icons/svg/icn-{name}.svg` 또는 `icon-{name}.svg` URL에서 런타임 fetch. 컴파일 타임 실재성 검증 불가. dev fallback은 노랑 배경(`showFallback`).

**TDS 코드 내 사용 예 (정합 패턴 표본)**:
| 사용 | 경로 |
|------|------|
| `name="icon-share-dots-mono"` | `extensions/page-navbar/PageNavbar.d.ts:57,75` |
| `name="icon-info-circle"` | `components/result/Result.d.ts:30` |
| `name="icn-attention-color"` | `components/toast/components/types.d.ts:6` |
| `name="icon-plus"` | `components/list-footer/ListFooter.d.ts:37` |
| `name="icn-bank-toss"` | `components/grid-list/GridList.d.ts:8` |

**결정**: `icon-star-bold-mono`(채움) / `icon-star-mono`(비움)는 토스 CDN(`https://static.toss.im/icons/svg/`) 의존이므로 본 저장소에서 100% 정적 검증 불가. **dev server 첫 실행 시 노랑 fallback 노출 여부로 검증 트리거**(§E.2 멈춤 트리거). 실재 안 하면 대안:
- 1순위: `icn-star-mono` / `icn-star-bold-mono` (`icn-` prefix)
- 2순위: TDS Icon 카탈로그(`https://tossmini-docs.toss.im/tds-react-native/foundation/icon/`) 직접 검색 → 별 모양 대체명.
- 3순위: Icon 자체 합성 불가 시 `<IconButton>`에 `source` prop으로 외부 SVG 주입.

### A.3 SegmentedControl + Tab 둘 다 실재 (PASS)

**SegmentedControl** — `node_modules/.../components/segmented-control/`:
- `index.d.ts`: `export const SegmentedControl: { Root, Item }` (compound).
- `Root.d.ts`: `value: string, defaultValue?, indicator?, size?: 'small'|'large', alignment?: 'fixed'|'fluid', name: string, disabled?, onChange?: (value: string) => void, children`. `@react-stately/radio` `RadioGroupProps` extends.
- `Item.d.ts`: `value: string, size?: 'small'|'large', disabled?, children, style?`.

**Tab** — `node_modules/.../components/tab/`:
- `Tab.d.ts`: `Tab({ fluid?, ...BaseTabProps })` + `Tab.Item = TabItem`.
- `TabItem.d.ts`: `redBean?, value: TabValue, children, style?, onPress?`.

**결정**: **SegmentedControl 채택** (`/my-recipes`의 "전체/즐겨찾기" 2-state 분기에 정합 — 라디오 시맨틱). Tab은 다중 카테고리 + 페이지 전환용. 둘 다 부재 가정한 Button 합성 대안은 **불필요**.

`FilterTabs` 합성 시그니처 (확정):

```tsx
// src/components/FilterTabs.tsx (신규)
import { SegmentedControl } from '@toss/tds-react-native';

export type FilterValue = 'all' | 'favorite';

export interface FilterTabsProps {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}

export function FilterTabs({ value, onChange }: FilterTabsProps) {
  return (
    <SegmentedControl.Root
      name="my-recipes-filter"
      value={value}
      size="small"
      onChange={(v) => onChange(v as FilterValue)}
    >
      <SegmentedControl.Item value="all">전체</SegmentedControl.Item>
      <SegmentedControl.Item value="favorite">즐겨찾기</SegmentedControl.Item>
    </SegmentedControl.Root>
  );
}
```

### A.4 ErrorPage (Phase 3 누적 — 검증 완료)

`components/error-page/ErrorPage.d.ts:1-9` — Phase 3 baseline §B.1에서 이미 PASS. Phase 4 PATCH 404 시 NotFoundScreen 재사용으로 추가 검증 불필요.

---

## B. 결정 카탈로그 — 13/13 사전 동결 (T1 완료 직전 상태)

각 결정에 SSOT 인용(파일:라인 또는 §절) + 권장 선택 + 근거. 다음 세션에서 정식 baseline으로 승격 시 §A·§C 인용 그대로 사용 가능.

### D1. TDS Icon name (`icon-star-bold-mono` / `icon-star-mono`) — **dev 검증 트리거로 동결**
- SSOT: `Icon.d.ts:8`(`name: string`), `Icon.js:1` URL 패턴.
- 결정: 1순위 그대로 시도. 노랑 fallback 발생 시 §E.2 멈춤 트리거 → 대안 카탈로그(A.2).
- 06 §6.4.5 표(라인 234)가 이미 동일 name 명시 — 정합.

### D2. SegmentedControl (Tab 아님) — 채택
- SSOT: §A.3 (둘 다 실재). 06 §6.5 추가 컴포넌트 표(라인 338) "TDS `SegmentedControl` 또는 `Tab`".
- 결정: SegmentedControl 채택. 근거: 2-state 라디오 시맨틱이 즐겨찾기 토글에 정합.

### D3. ConfirmDialog props 시그니처 — 정정 후 동결
- SSOT: §A.1 (`ConfirmDialog.d.ts:6-12` 인용).
- 결정: 요구사항이 표기한 `confirmText`/`cancelText`/`onConfirm`/`onCancel`은 **TDS 실제 API 아님**. `leftButton`/`rightButton`(`ReactElement` 필수, 2개 children 강제) + `onClose`/`onExited`(필수). `DeleteConfirmDialog` 합성 시그니처 §A.1 그대로 동결.
- 06 §6.5 갱신 필요(T5) — `ConfirmDialog` 행에 정확한 props 명시.

### D4. 낙관적 업데이트 정책 — **안 a(낙관적+롤백) 채택, 롤백 위치는 호출 측**
- SSOT: `requirements.md:46-49` AC4.1, Phase 3 baseline §H.2 (불변식 패턴).
- 결정: **안 a + 롤백을 호출 측이 prev 보관**.
- 근거:
  - (1) UX 우선 (AC4.1 "별 즉시 채워짐").
  - (2) `useToggleFavorite` 훅 내부에 prev state 보관 시 **horizontal coupling** — 카드 측 isFavorite은 부모 `useMyRecipes.data[]`에 있고, 상세 측 isFavorite은 `useRecipeDetail.data`에 있어 훅이 다름. 훅 1개가 다른 훅의 state를 알 수 없음.
  - (3) 호출 측(RecipeCard / 상세 화면)이 onPress 시점에 (a) `setOptimistic(target)` → (b) `await toggle(target)` → (c) 실패 시 `setOptimistic(prev)` 패턴.
- 훅 시그니처: `{ toggle: (target: boolean) => Promise<Recipe | null>, isPending: boolean, error: string | null }` (Recipe | null 반환 — 호출 측이 분기).

### D5. PATCH 성공 시 캐시 갱신 정책 — **invalidate() + 상세 화면은 응답 Recipe로 직접 state 업데이트**
- SSOT: Phase 3 baseline §D.5 (라인 248-250) — "Phase 4 PATCH favorite 성공 후에는 (1) `useRecipeDetail.refetch()` 직접 호출 + (2) `invalidate()` 호출 — Phase 4에서 결정".
- 결정 정정: **refetch() 회피 — 응답 Recipe로 직접 state 갱신**. 이유: PATCH 응답이 갱신된 Recipe 전체를 반환(03 §3.6.3 "200 + `{ data: Recipe }`") → refetch는 불필요한 GET 1회 + 네트워크 왕복. 직접 setState가 즉시성·트래픽 모두 우월.
- 구현: `useRecipeDetail`에 `mutate: (next: Recipe) => void` 추가. `useToggleFavorite.toggle`은 성공 시 (1) Recipe 반환, (2) `invalidate()` 호출. 상세 화면이 반환값 받아 `mutate(updated)` 호출.
- 대안 (refetch): 별도 GET 1회 추가 — 기각.

### D6. DELETE 404 처리 — 성공으로 정규화
- SSOT: 03 §3.7.4 (라인 496-502) + 01-FEATURES AC3 "이미 삭제됨" + `requirements.md:73`.
- 결정: `useDeleteRecipe`가 `ApiClientError.error.code === 'NOT_FOUND'`를 성공으로 정규화 → `invalidate()` + null 반환 + 에러 메시지 0건. 호출 측은 성공/404 구분 안 함 → navigate.
- 사용자 한국어 메시지 0건 — UX상 "이미 삭제됨"과 "방금 삭제됨"이 동일 결과.

### D7. 삭제 활성화 위치 — 상세 화면만 (카드 onDelete prop 자리표시 유지)
- SSOT: `requirements.md:86` 권장 + Phase 3 baseline §B.2 (RecipeCard `onDelete?` 자리표시).
- 결정: **상세 화면만**. 카드 측 onDelete는 prop 자리표시 그대로 유지(제거 안 함 — 향후 swipe·long-press UX 도입 시 재활성화 여지).
- 근거: 카드 측 삭제 트리거는 (a) swipe (b) long-press (c) 별 IconButton 어느 패턴도 추가 UX 결정 필요. v1 단순성 우선.

### D8. 삭제 후 navigation — `goBack()` 우선 + 폴백
- SSOT: `requirements.md:147` 완화 표 행("`goBack()`로 충분 — `navigate('/my-recipes', {})`는 history 중복 우려").
- 결정: Phase 3 `recipe/[id].tsx:49-55`의 `handleBack` 패턴 재사용 — `navigation.canGoBack?.() ? goBack() : navigate('/my-recipes', {})`. 캐시 invalidate는 `useDeleteRecipe` 내부 자동(D13) → goBack 후 마이 목록 자동 refetch.

### D9. PATCH 404 UI 분기 — 상세 화면만 NotFoundScreen, 목록 카드는 invalidate로 자동 제거
- SSOT: `requirements.md:148` + ADR-005 + ADR-012 D16.
- 결정: **상세 화면만** `<NotFoundScreen onBack={handleBack} />` 렌더. 목록 카드는 별도 UI 없이 invalidate로 자동 사라짐.
- 근거: 카드 측 PATCH 404는 (a) 카드 즉시 사라짐(invalidate refetch — 백엔드가 본인 소유 목록만 반환) (b) 별도 토스트 미사용(단순). 상세는 화면 전체가 NotFoundScreen 전환.

### D10. 훅 시그니처 — 확정
- `useToggleFavorite(id: string): { toggle: (target: boolean) => Promise<Recipe | null>, isPending: boolean, error: string | null, reset: () => void }`.
  - 인자: id (현재 토글 대상). 한 컴포넌트가 한 id만 토글한다는 가정 — 카드 측은 카드별 훅 인스턴스(map 내부 use).
  - 반환: 성공 Recipe / 실패·취소 null. 호출 측이 분기.
- `useDeleteRecipe(id: string): { remove: () => Promise<boolean>, isPending: boolean, error: string | null, reset: () => void }`.
  - 반환: 성공·404 정규화 true / 실패 false. 호출 측이 분기 후 navigate.
- 둘 다 패턴: `useTossUserId` + `useRecipeCacheTrigger.invalidate` + `useRef<AbortController>` + cancelled 플래그. Phase 3 `useSaveRecipe.ts` 패턴 답습.

### D11. FilterTabs 위치·import·호출 패턴
- 파일: `src/components/FilterTabs.tsx` (신규).
- import: `import { SegmentedControl } from '@toss/tds-react-native'`.
- 합성: §A.3.
- 호출 (`pages/my-recipes.tsx`):
  ```tsx
  const [filter, setFilter] = useState<FilterValue>('all');
  const query = useMemo(() => ({
    page, pageSize: PAGE_SIZE,
    favorite: filter === 'favorite' ? true : undefined,
  }), [page, filter]);
  // filter 변경 시 page 1 리셋:
  const handleFilterChange = (next: FilterValue) => {
    setFilter(next); setPage(1);
  };
  ```

### D12. 404 단일 컴포넌트 정책 강화 (ADR-012 D16 → Phase 4 유지)
- SSOT: ADR-012 D16 + Phase 3 baseline §H.2 #13.
- 결정: 변경 없이 그대로 유지. `pages/`에서 `<ErrorPage statusCode={404}>` 직접 렌더 + 인라인 "찾을 수 없" 텍스트 **0건** — 항상 `<NotFoundScreen onBack={...} />`. Phase 4 PATCH 404가 추가 사용 위치(상세 화면, D9).

### D13. invalidate() 호출 위치
- `useToggleFavorite.toggle` 성공 시 1회.
- `useDeleteRecipe.remove` 성공·404 정규화 시 1회 (D6).
- 실패 시 0건 (stale 데이터 유지가 안전).

---

## C. 산출물 1:1 매핑 — SSOT 인용 → 미니앱 코드 (Phase 4)

### C.api — `miniapp-api-client` 담당 (신규 2 훅)

| 파일 | 작성 종류 | SSOT 인용 |
|------|---------|----------|
| `src/hooks/useToggleFavorite.ts` (신규) | 신규 | D10, 03 §3.6 (라인 423-464), `services/recipes.ts:163-179`, ADR-010 D3, ADR-012 D15 |
| `src/hooks/useDeleteRecipe.ts` (신규) | 신규 | D6, D10, 03 §3.7 (라인 468-506), `services/recipes.ts:184-198`, ADR-010 D3, ADR-012 D15 |
| `src/hooks/useRecipeDetail.ts` (확장) | 확장 — `mutate: (next: Recipe) => void` 추가 | D5 (PATCH 성공 시 호출 측이 mutate로 직접 갱신) |

`src/services/recipes.ts`의 `toggleFavorite`/`deleteRecipe`는 **Phase 1 정의 완료** — 수정 0건.

### C.fe — `miniapp-frontend` 담당 (신규 3 컴포넌트 + 2 페이지 확장)

| 파일 | 작성 종류 | SSOT 인용 |
|------|---------|----------|
| `src/components/FavoriteButton.tsx` (신규) | 신규 | 06 §6.4.5 (라인 228-241), D1, D10 |
| `src/components/FilterTabs.tsx` (신규) | 신규 | D2, D11, A.3 |
| `src/components/DeleteConfirmDialog.tsx` (신규) | 신규 | D3, A.1 |
| `src/components/RecipeCard.tsx` (확장) | `onToggleFavorite` 활성화 (FavoriteButton 렌더), `onDelete` prop 자리표시 유지 | D7 |
| `src/pages/my-recipes.tsx` (확장) | FilterTabs 추가 + page 리셋 + favorite query + RecipeCard에 onToggleFavorite 콜백 결합 | D11, D9 |
| `src/pages/recipe/[id].tsx` (확장) | FavoriteButton + 삭제 Button + DeleteConfirmDialog state + 삭제 후 handleBack + PATCH 404 시 NotFoundScreen 분기 | D5, D6, D7, D8, D9 |

### C.qa — `miniapp-qa` 담당

| 산출 | SSOT 인용 |
|------|----------|
| 응답 zod 정합 (toggleFavorite 200, deleteRecipe 200 + `{id}`) | 03 §3.6.3 / §3.7.3 |
| 멱등 검증 (PATCH 두 번 → 마지막 의도) | 03 §3.6.2 + `requirements.md:98-99` AC4.5 |
| 낙관적 업데이트 롤백 코드 경로 | D4 + AC4.1 |
| 404 단일 컴포넌트 단언 (Phase 3 §H.2 #13 누적) | D9, D12 |
| 캐시 invalidate 위치 단언 (D13) | D13 |
| TDS 신규 3종 cross-check | A.1, A.3 |
| 라우트 매트릭스 — Phase 3 그대로 (4 라우트), 신규 0건 | ADR-012 D14 |

---

## F. 작업 분할 다이어그램 (T2/T3 동기화 지점)

```
[A] src/hooks/useToggleFavorite.ts                (api-client, 단독)
[B] src/hooks/useDeleteRecipe.ts                  (api-client, 단독)
[C] src/hooks/useRecipeDetail.ts 확장 (mutate)    (api-client, 단독)
    │
[D] src/components/FavoriteButton.tsx             (frontend, [A] 시그니처만 필요 — D10으로 동결됐으므로 병렬)
[E] src/components/FilterTabs.tsx                 (frontend, 단독 — TDS만)
[F] src/components/DeleteConfirmDialog.tsx        (frontend, 단독 — TDS만)
    │
[G] src/components/RecipeCard.tsx 확장            (frontend, [D] 필요)
    │
[H] src/pages/my-recipes.tsx 확장                 (frontend, [A][D][E][G] 필요)
[I] src/pages/recipe/[id].tsx 확장                (frontend, [A][B][C][D][F] 필요)
```

**병렬 구간**:
- [A][B][C]는 api-client 내 병렬 가능 (각 훅 독립).
- [D][E][F]는 frontend 내 병렬 가능 (각 컴포넌트 독립, [D]는 [A] 시그니처 D10 동결로 코드 도착 불필요).
- api-client [A][B][C] ↔ frontend [D][E][F]는 **완전 병렬** — D10 훅 시그니처 + A.1/A.3 컴포넌트 시그니처가 본 baseline에서 동결됐으므로.

**동기화 지점**:
- [H] = [A]+[D]+[E]+[G] 모두 도착 후.
- [I] = [A]+[B]+[C]+[D]+[F] 모두 도착 후.

---

## G. ADR-013 가칭 결정 카탈로그 (T5 정식 발행 대상)

5 결정 후보를 단일 ADR-013로 묶을지 ADR-012 보강할지는 T5에서 결정.

| 가칭 ID | 결정 | 본 baseline 위치 |
|---------|------|----------------|
| D19 | 낙관적 업데이트 안 a + 호출 측 prev 보관 | D4 |
| D20 | PATCH 성공 시 invalidate() + 상세 화면 mutate (refetch 회피) | D5 |
| D21 | DELETE 404 성공 정규화 (UI 메시지 0건) | D6 |
| D22 | 삭제 활성화 위치 상세 화면만 (카드 onDelete prop 유지) | D7 |
| D23 | DeleteConfirmDialog 합성 시그니처 (leftButton/rightButton + ConfirmDialog.Button) — TDS 실제 API 정정 | D3, A.1 |

ADR-012 D15(invalidate Context+bump trigger) / D16(NotFoundScreen 단일) 그대로 재사용 — 본 ADR-013은 D19~D23만 추가.

---

## H. 멈춤 트리거 (Phase 3 §G 패턴 계승)

1. **`icon-star-bold-mono`/`icon-star-mono` 노랑 fallback** — §A.2.
   - 처리: 대안 카탈로그 적용 + 06 §6.4.5 갱신.
2. **ConfirmDialog DoubleButton "2 children" throw** — leftButton/rightButton 누락 또는 Fragment·null 전달 시.
   - 처리: 양쪽 모두 `ConfirmDialog.Button` 또는 일반 `Button` ReactElement로 채움.
3. **PATCH 응답 isFavorite이 요청 target과 다름** — 백엔드 멱등 위반.
   - 처리: 추측 변경 금지. zod 검증은 통과(boolean) → 호출 측이 응답값 신뢰. architect 통지.
4. **DELETE 응답이 200 + `{ id }` 아닌 204** — 03 §3.7.3 위반.
   - 처리: ADR-010 D5 zod 즉시 throw → 별 저장소 hotfix.
5. **백엔드 옵션 P 미배포** — Phase 1·2·3 누적 그대로.
6. **SDK 패키지 경로** — Phase 3 누적 §G #3.

---

## I. 다음 세션 진입 체크리스트

본 partial을 정식 baseline으로 승격할 때:

- [ ] `_workspace/`를 `_workspace_phase4_paused/`로 이동 (Phase 1·2·3 패턴).
- [ ] 새 `_workspace/00_input/requirements.md` 작성 또는 본 requirements 그대로 사용.
- [ ] 본 partial의 §A·§B·§C·§F·§G를 `01_architect_phase4_baseline.md`로 승격 (이미 동결됐으므로 복사·보강만).
- [ ] `_workspace_phase3/` Phase 3 산출 그대로 참조 (수정 0건).
- [ ] api-client T2 / frontend T3에게 본 partial §F 다이어그램 + §D10 훅 시그니처 + §A.1/A.3 컴포넌트 시그니처로 SendMessage.
- [ ] T1 task description의 "[보류 - 2026-05-25 토스 광고 우선순위 전환]" 마커 제거.

---

## J. T1 진행도 (보류 시점)

| 항목 | 상태 |
|------|------|
| SSOT 로드 (`requirements.md`, 03, 06, ADR-005, ADR-012, Phase 3 baseline) | 완료 |
| Phase 3 산출 코드 검토 (services/hooks/components/pages) | 완료 |
| TDS 실재성 검증 — ConfirmDialog | 완료 (A.1) |
| TDS 실재성 검증 — IconButton/Icon + Icon 카탈로그 패턴 | 완료 (A.2) |
| TDS 실재성 검증 — SegmentedControl + Tab | 완료 (A.3) |
| 13 필수 결정 동결 | 완료 (D1~D13) |
| 작업 분할 다이어그램 + 동기화 지점 | 완료 (§F) |
| ADR-013 결정 카탈로그 | 완료 (§G) |
| 멈춤 트리거 | 완료 (§H) |
| **정식 baseline `01_architect_phase4_baseline.md` 파일 발행** | **미완** |
| **api-client/frontend SendMessage 통지** | **미완** |
| **TaskUpdate T1 status=completed** | **미완 (보류)** |

다음 세션은 §I 진입 체크리스트만 따라가면 24~48시간 내 T2/T3 병렬 진입 가능.

---

## K. 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-25 | Partial dump (T1 정식 baseline 발행 직전 보류) | 사용자 우선순위가 "토스 광고 기반 작업"으로 전환 — Phase 4 일시 보류. SSOT 검증·13 결정 카탈로그·작업 분할까지 사전 동결한 상태를 다음 세션 재개점으로 보존 |
