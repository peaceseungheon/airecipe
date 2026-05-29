# src/components/ — 재사용 UI (presentational)

이 디렉토리는 **표현(presentational)** 컴포넌트만 둔다. 데이터 페칭·비즈니스 로직은 훅(`src/hooks/`)이나 페이지가 담당하고, 컴포넌트는 props로 받은 도메인 타입(`@/types`)을 렌더링하거나 사용자 의도를 콜백으로 상위에 전달한다(SRP — software-design-principles 스킬).

## 핵심 규약
- 컴포넌트는 `@/types`의 공유 타입을 props로 받는다. 응답 shape을 자체적으로 추측·캐스팅하지 않는다.
- **GeneratedRecipe(미저장) vs Recipe(저장됨) 구분(계약 불변식 2).** `RecipeDisplay`는 두 타입의 **공통 필드만** 사용하며 `id`를 읽지 않는다 — 미저장/저장 화면 모두에서 안전. `id`가 필요한 컴포넌트(`RecipeCard`)는 `Recipe`만 받는다.
- 액션(저장/즐겨찾기/삭제)은 컴포넌트가 직접 API를 호출하지 않고 콜백(`onToggle`, `onDelete` 등)으로 상위(훅 보유)에 위임한다.
- 즐겨찾기는 토글이 아니라 **목표값 명시**(계약 4). `FavoriteButton`은 현재값의 반대값을 `onToggle(target)`으로 전달한다.

## 파일
| 파일 | 책임 | 입력 |
|------|------|------|
| `ui/` | shadcn 패턴 경량 프리미티브 (Button/Input/Label/Card/Badge/Alert/Spinner) | HTML 속성 + variant/size |
| `recipe-format.ts` | difficulty 라벨·조리시간 포맷 헬퍼 | 도메인 값 |
| `RecipeCard.tsx` | 저장된 레시피 목록 카드 (→ /recipe/[id] 링크) | `Recipe` + 액션 콜백 |
| `RecipeDisplay.tsx` | 레시피 전체 표시(재료/단계/팁/영양) | `GeneratedRecipe \| Recipe` + actions 슬롯 |
| `NutritionPanel.tsx` | 1인분 영양 정보 패널 | `NutritionInfo` |
| `FavoriteButton.tsx` | 즐겨찾기 버튼 (목표값 콜백) | `isFavorite` + `onToggle` |
| `SearchForm.tsx` | 요리 이름+인분 입력 폼 | `onSubmit` 콜백 |
| `AuthForm.tsx` | 로그인/회원가입 공용 폼 | `mode` + `onSubmit`/`onSuccess` |
| `NavBar.tsx` | 글로벌 네비게이션 (useAuth 소비) | (없음) |

## 주의사항
- `ui/`의 프리미티브는 `cn`(clsx+tailwind-merge, `@/lib/utils`)으로 클래스 병합. Tailwind 4 사용.
- 상호작용/훅을 쓰는 컴포넌트만 `"use client"`. 순수 표현(`NutritionPanel`, `RecipeDisplay`, `Card`, `Badge` 등)은 서버 컴포넌트로 둔다.
- 라우팅 링크(`href`)는 실제 `src/app/` 페이지 경로와 일치해야 한다: `/`, `/recipe/generate`, `/recipe/[id]`, `/my-recipes`, `/auth/login`, `/auth/signup`.
