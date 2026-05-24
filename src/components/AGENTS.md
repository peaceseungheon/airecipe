# src/components — TDS primitives 위에 빌드한 도메인 컴포넌트 + 순수 포맷 유틸

## 책임

Phase 2의 레시피 생성 화면(`/recipe/generate`)과 홈(`/`)이 사용하는 **presentational** 도메인 컴포넌트. TDS RN primitives(`Button`/`TextField`/`NumericSpinner`/`Badge`/`Txt`/`List`/`ListRow`)와 RN core(`View`/`ScrollView`/`StyleSheet`) 위에 빌드한다. 비즈니스 로직(API 호출·상태 관리)은 갖지 않는다 — `pages/`와 `hooks/`의 책임.

## 파일

| 파일 | 역할 | SSOT |
|------|------|------|
| `SearchForm.tsx` | 요리명 + 인분 입력 폼. `(dishName, servings) => void` 콜백. 클라이언트 zod 검증(공백/min 1/max 100/min 1/max 20인분) | 06 §6.4.1, baseline §A.6 |
| `RecipeDisplay.tsx` | `GeneratedRecipe` 전체 표시 — 타이틀·설명·Badge 3종·재료 List·단계·tips·actions slot. `id` 미참조(불변식 2) | 06 §6.4.2, baseline §A.6 |
| `NutritionPanel.tsx` | `Nutrition` — 칼로리 강조 + 4 매크로(2x2 grid) + healthNote 박스 | 06 §6.4.3, baseline §A.6 |
| `recipe-format.ts` | 순수 함수: `difficultyLabel`/`difficultyVariant`/`formatCookTime` | 06 §6.4.8 |

## 규약 (강제)

- **TDS 우선** — 모든 텍스트는 `Txt typography=...`, 모든 버튼은 `Button`. 직접 `Text/TouchableOpacity` 사용 최소화. 입력은 `TextField variant="line"` + `NumericSpinner` (06 §6.3).
- **`NumericSpinner.disable`은 오타가 아닌 prop명** — `disabled` 아님 (baseline §B.4 / qa report §13.6).
- **`TextField.variant`는 필수** — `'box'\|'line'\|'big'\|'hero'` 중 하나 (baseline §B.3).
- **PageNavbar 사용 금지 (본 디렉터리)** — Navbar는 화면별(`pages/*.tsx`)에서만 렌더한다(07 §7.8). 공통 래퍼 `AppNavbar.tsx`도 만들지 않음 (ADR-011 D12, baseline §B.2 YAGNI).
- **GeneratedRecipe.id 참조 0건** — `RecipeDisplay`는 저장 전(`GeneratedRecipe`)과 저장됨(`Recipe`) 공통 필드만 사용. `id`/`createdAt`/`isFavorite` 미참조 (03 §3.10 #5, 불변식 2).
- **호출·상태 0건** — 컴포넌트는 presentational. `fetch`/`useState`(폼 입력 외)/`useEffect`(폼 외) 사용 금지. 비즈니스 로직은 부모(`pages/`) 또는 `hooks/`로 위임.
- **actions slot은 ReactNode prop** — `RecipeDisplay`의 actions(저장/즐겨찾기 등)는 `actions?: ReactNode` prop으로 주입. 자체 버튼 렌더 금지.
- **콜백 시그니처 고정** — `SearchForm.onSubmit: (dishName: string, servings: number) => void`. Phase 3 이후도 시그니처 유지.

## 스타일링 규약

- **TDS 토큰 우선 (지향)** — adaptive 컬러 토큰(`colors.adaptive.grey900` 등) 사용을 지향한다.
- **현재 hex 사용 정책 (Phase 2 한정)** — Phase 2 산출은 hex 직접 사용(`#191F28`/`#4E5968`/`#F2F4F6`/`#FBE9E9` 등) 중. qa report §13.1 정보 공유. 06 §6.3.5는 adaptive 토큰 권장이지만 본 Phase는 디자인 토큰 표 미확정으로 hex 보존. **Phase 3 디자인 토큰 결정 시 일괄 교체** — 별 ADR 또는 ADR-011 보강. 본 Phase에서는 FAIL 아님.
- **fontSize 하드코딩 금지** — Typography 토큰(`t1`~`t5`, `st9`~`st12`)만 사용 (06 §6.6).
- **Tailwind 클래스 0건** — `className`/`tw\`` 패턴 사용 금지 (baseline §D.2 #2).

## 진입점

- 외부 import 경로: `import { SearchForm } from '../components/SearchForm';` 등 직접 import. barrel(`index.ts`)은 만들지 않음(파일 수 4개 — YAGNI).
- 의존 방향: `pages/*.tsx` → `components/*.tsx` → TDS primitives. 역방향 금지.

## 변경 트리거

- 새 도메인 컴포넌트 필요 (예: `RecipeCard`, `FavoriteButton`, `FilterTabs`, `EmptyState`, `NotFoundScreen`) → Phase 3 진입 시 추가. 06 §6.4·§6.5 표 인용.
- TDS primitive props 시그니처 변경 발견 (패키지 minor 업데이트) → baseline §B.1 + 06 §6.5 갱신 트리거. architect 통지.
- 디자인 토큰 표 확정 → hex 직접 사용 일괄 교체 (별 ADR).

## 비범위 (Phase 2)

- 저장된 레시피 카드(`RecipeCard.tsx`) — Phase 3.
- 즐겨찾기 토글(`FavoriteButton.tsx`) — Phase 3.
- 삭제 확인 다이얼로그(`DeleteConfirmDialog.tsx`) — Phase 3.
- 빈 상태/404 화면(`EmptyState.tsx`/`NotFoundScreen.tsx`) — Phase 3.
- 단위 테스트(jest + @testing-library/react-native) — Phase 2 비범위. qa의 정적 검증으로 대체. 추가 필요 시 별 ADR.

## 관련 ADR / 챕터

- [ADR-009](../../docs/adr/ADR-009-appsintoss-port-architecture.md) D2 — `useAuth` 제거 (AuthForm 미작성).
- [ADR-011](../../docs/adr/ADR-011-miniapp-phase2-streaming-ui.md) D11/D12 — text 청크 미표시(인디케이터만), PageNavbar 채택.
- [06-UI-MAPPING.md](../../docs/appsintoss-port/06-UI-MAPPING.md) §6.3·§6.4·§6.5·§6.6 — TDS 매핑 표·접근성·국제화.
- [01-FEATURES.md](../../docs/appsintoss-port/01-FEATURES.md) — 기능 a/b의 수용 기준.
