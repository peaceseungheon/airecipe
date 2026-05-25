# src/components — TDS primitives 위에 빌드한 도메인 컴포넌트 + 순수 포맷 유틸

## 책임

Phase 2의 레시피 생성 화면(`/recipe/generate`)과 홈(`/`)이 사용하는 **presentational** 도메인 컴포넌트. TDS RN primitives(`Button`/`TextField`/`NumericSpinner`/`Badge`/`Txt`/`List`/`ListRow`)와 RN core(`View`/`ScrollView`/`StyleSheet`) 위에 빌드한다. 비즈니스 로직(API 호출·상태 관리)은 갖지 않는다 — `pages/`와 `hooks/`의 책임.

## 파일

| 파일 | 역할 | SSOT |
|------|------|------|
| `SearchForm.tsx` (Phase 2) | 요리명 + 인분 입력 폼. `(dishName, servings) => void` 콜백. 클라이언트 zod 검증(공백/min 1/max 100/min 1/max 20인분) | 06 §6.4.1, Phase 2 baseline §A.6 |
| `RecipeDisplay.tsx` (Phase 2) | `GeneratedRecipe` 또는 `Recipe` 공통 필드만 표시 — 타이틀·설명·Badge 3종·재료 List·단계·tips·actions slot. `id` 미참조(불변식 2) | 06 §6.4.2, Phase 2 baseline §A.6 |
| `NutritionPanel.tsx` (Phase 2) | `Nutrition` — 칼로리 강조 + 4 매크로(2x2 grid) + healthNote 박스 | 06 §6.4.3, Phase 2 baseline §A.6 |
| `recipe-format.ts` (Phase 2) | 순수 함수: `difficultyLabel`/`difficultyTone`/`formatCookTime`/`formatServings` | 06 §6.4.8 |
| `RecipeCard.tsx` (Phase 3) | 저장된 `Recipe` 카드 — Pressable 전체 클릭 영역 + Txt(t5/st9) + Badge 3종. **`recipe.id` 사용 OK** (저장된 Recipe 한정). Phase 4 즐겨찾기/삭제 prop만 받고 미렌더 | 06 §6.4.4, Phase 3 baseline §A.2·§B.2 |
| `EmptyState.tsx` (Phase 3) | 빈 상태 안내 — props 4종(title/description/actionLabel/onAction)으로 재사용 가능. 마이 0건 / Phase 4 즐겨찾기 0건 등 | 06 §6.5, Phase 3 baseline §A.2·§B.3 |
| `NotFoundScreen.tsx` (Phase 3) | **단일 404 UI** — TDS `ErrorPage statusCode={404}` 합성. props `{ onBack }`. **Phase 4 PATCH/DELETE 404 재사용 보장** | 06 §6.5, ADR-005, ADR-012 D16, Phase 3 baseline §A.2·§B.3·§H.2 #13 |
| `AppInlineAd.tsx` (Phase 4.5) | 토스 인라인 광고 합성 — `ads.InlineAdSlot` 위임. props `{ slot, theme?, tone?, variant? }`. SDK BannerSlotCallbacks 미노출. dev에서 placeholder, staging/prod(+ADS_ENABLED)에서 실 광고 | 11-ADS §11.4, ADR-014 D26·D31·D33 |

## 규약 (강제)

- **TDS 우선** — 모든 텍스트는 `Txt typography=...`, 모든 버튼은 `Button`. 직접 `Text/TouchableOpacity` 사용 최소화. 입력은 `TextField variant="line"` + `NumericSpinner` (06 §6.3).
- **`NumericSpinner.disable`은 오타가 아닌 prop명** — `disabled` 아님 (Phase 2 baseline §B.4 / qa report §13.6).
- **`TextField.variant`는 필수** — `'box'\|'line'\|'big'\|'hero'` 중 하나 (Phase 2 baseline §B.3).
- **PageNavbar 사용 금지 (본 디렉터리)** — Navbar는 화면별(`pages/*.tsx`)에서만 렌더한다(07 §7.8). 공통 래퍼 `AppNavbar.tsx`도 만들지 않음 (ADR-011 D12, Phase 2 baseline §B.2 YAGNI).
- **`GeneratedRecipe.id` 참조 0건** — `RecipeDisplay`는 저장 전(`GeneratedRecipe`)과 저장됨(`Recipe`) 공통 필드만 사용. `id`/`createdAt`/`isFavorite` 미참조 (03 §3.10 #5, 불변식 2).
- **`Recipe.id` 사용 OK는 `RecipeCard`만** — Phase 3 baseline §H.2 #11. `RecipeCard`는 `recipe: Recipe` props 받으며 카드 클릭 콜백 + Phase 4 즐겨찾기/삭제 자리표시 prop에서 사용. RecipeDisplay/NutritionPanel/SearchForm은 여전히 `id` 미참조.
- **`<ErrorPage>` 직접 렌더 금지** — Phase 3 baseline §H.2 #13. `NotFoundScreen.tsx:28` 단 1곳에만 import. 다른 컴포넌트·pages에서 `ErrorPage` 직접 import·렌더 금지. 404 화면은 항상 `<NotFoundScreen onBack={...} />` 1개 컴포넌트로 통일.
- **광고 SDK 직접 import 금지** — Phase 4.5 ADR-014 D26. `@apps-in-toss/framework`의 `InlineAd`/`loadFullScreenAd`/`showFullScreenAd`는 본 디렉토리에서 import 0건. `AppInlineAd.tsx`는 `../lib/ads`의 `ads` 객체만 사용. 광고 UI 추가 시에도 동일 패턴(`<AppInlineAd slot="...">`).
- **호출·상태 0건** — 컴포넌트는 presentational. `fetch`/`useState`(폼 입력 외)/`useEffect`(폼 외) 사용 금지. 비즈니스 로직은 부모(`pages/`) 또는 `hooks/`로 위임.
- **actions slot은 ReactNode prop** — `RecipeDisplay`의 actions(저장/즐겨찾기 등)는 `actions?: ReactNode` prop으로 주입. 자체 버튼 렌더 금지.
- **콜백 시그니처 고정** — `SearchForm.onSubmit: (dishName: string, servings: number) => void`, `RecipeCard.onPress: () => void`, `EmptyState.{ onAction: () => void }`, `NotFoundScreen.{ onBack: () => void }`. Phase 4 이후도 시그니처 유지.
- **`Badge.children`은 string 또는 number만** — Phase 2 frontend 발견(06 §6.3.4 갱신, qa 인계). `<Badge><Txt>...</Txt></Badge>` 같은 nested element 금지. 라벨 텍스트 직접 전달.

## 스타일링 규약

- **TDS 토큰 우선 (지향)** — adaptive 컬러 토큰(`colors.adaptive.grey900` 등) 사용을 지향한다.
- **현재 hex 사용 정책 (Phase 2~3 누적)** — Phase 2·3 산출은 hex 직접 사용(`#191F28`/`#4E5968`/`#F2F4F6`/`#FBE9E9`/`#E5E8EB`/`#C0392B`/`#8B95A1` 등) 중. Phase 2 qa report §13.1 + Phase 3 qa §14.6 정보 공유. 06 §6.3.5는 adaptive 토큰 권장이지만 디자인 토큰 표 미확정으로 hex 보존. **Phase 4 진입 전 별 ADR 권장** — 일괄 교체. 본 Phase 3에서는 FAIL 아님 (Phase 2 인계 #7 누적).
- **fontSize 하드코딩 금지** — Typography 토큰(`t1`~`t5`, `st9`~`st12`)만 사용 (06 §6.6).
- **Tailwind 클래스 0건** — `className`/`tw\`` 패턴 사용 금지 (Phase 2 baseline §D.2 #2).

## 진입점

- 외부 import 경로: `import { SearchForm } from '../components/SearchForm';` 등 직접 import. barrel(`index.ts`)은 만들지 않음(파일 수 7개 — YAGNI).
- 의존 방향: `pages/*.tsx` → `components/*.tsx` → TDS primitives. 역방향 금지.

## 변경 트리거

- 새 도메인 컴포넌트 필요 (예: `FavoriteButton`, `FilterTabs`, `DeleteConfirmDialog`) → Phase 4 진입 시 추가. 06 §6.4·§6.5 표 인용.
- TDS primitive props 시그니처 변경 발견 (패키지 minor 업데이트) → Phase 2 baseline §B.1 + 06 §6.5 갱신 트리거. architect 통지.
- 디자인 토큰 표 확정 → hex 직접 사용 일괄 교체 (별 ADR — Phase 4 진입 전 권장).

## 비범위 (Phase 3)

- 즐겨찾기 토글(`FavoriteButton.tsx`) — Phase 4. RecipeCard의 onToggleFavorite prop 자리표시 활성화.
- 삭제 확인 다이얼로그(`DeleteConfirmDialog.tsx`) — Phase 4. TDS `ConfirmDialog` 합성.
- 즐겨찾기 필터 토글(`FilterTabs.tsx`) — Phase 4. TDS `SegmentedControl` 또는 `Tab`.
- 단위 테스트(jest + @testing-library/react-native) — Phase 1~3 비범위. qa의 정적 검증으로 대체. 추가 필요 시 별 ADR.

## 관련 ADR / 챕터

- [ADR-005](../../docs/adr/ADR-005-ownership-violation-404.md) — 404 통일 → `NotFoundScreen` 단일 컴포넌트 정책 (ADR-012 D16 구체화).
- [ADR-009](../../docs/adr/ADR-009-appsintoss-port-architecture.md) D2 — `useAuth` 제거 (AuthForm 미작성).
- [ADR-011](../../docs/adr/ADR-011-miniapp-phase2-streaming-ui.md) D11/D12 — text 청크 미표시(인디케이터만), PageNavbar 채택.
- [ADR-012](../../docs/adr/ADR-012-miniapp-phase3-routing-cache-404.md) D16/D18 — NotFoundScreen 단일 컴포넌트 + EmptyState 재사용 정책 + Phase 4 PATCH/DELETE 404 컴포넌트 재사용 보장.
- [06-UI-MAPPING.md](../../docs/appsintoss-port/06-UI-MAPPING.md) §6.3·§6.4·§6.5·§6.6 — TDS 매핑 표·접근성·국제화.
- [01-FEATURES.md](../../docs/appsintoss-port/01-FEATURES.md) — 기능 a~d의 수용 기준.
