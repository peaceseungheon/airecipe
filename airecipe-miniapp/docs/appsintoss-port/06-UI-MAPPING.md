# 06. UI 매핑 — 웹 컴포넌트 ↔ TDS React Native 1:1 대응

> **이 챕터 전에 알아야 할 것**: [00-OVERVIEW.md](./00-OVERVIEW.md), [01-FEATURES.md](./01-FEATURES.md), [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md). 백엔드 응답 shape은 [03-API-CONTRACT.md](./03-API-CONTRACT.md), 사용자 식별 헤더는 [05-AUTH.md](./05-AUTH.md).
>
> **이 챕터 완료 후 다음 챕터**: [07-ROUTING.md](./07-ROUTING.md) — Granite 라우팅 매핑.

---

## 6.0 이 챕터의 목적

현재 웹(`src/components/`)의 컴포넌트 인벤토리를 신규 RN 미니앱(Granite >= 1.0)의 **TDS(`@toss/tds-react-native`)** 로 1:1 매핑한다. 미니앱이 비게임 카테고리이므로 **TDS 사용은 의무**(검수 통과 조건). Tailwind/shadcn은 미니앱에 가져오지 않는다.

| 항목 | SSOT |
|------|------|
| 현재 컴포넌트 카탈로그 | `src/components/AGENTS.md` |
| 현재 컴포넌트 코드 | `src/components/*.tsx`, `src/components/ui/*.tsx`, `src/components/recipe-format.ts` |
| 도메인 타입 (props 입력) | `src/types/recipe.ts`, `src/types/api.ts` |
| TDS RN 카탈로그 | `https://tossmini-docs.toss.im/tds-react-native/` |

## 6.1 매핑 원칙 (모든 항목에 공통)

1. **Tailwind 클래스 제거**: `className`·`cn()`·`@/lib/utils`는 RN에 없다. RN `StyleSheet.create`로 변환하거나 TDS 컴포넌트의 props(`size`/`variant`/`typography`)에 맡긴다.
2. **Tailwind 토큰 → TDS 토큰**: 색상(`text-orange-600`, `bg-zinc-100` 등)은 직접 코드값을 옮기지 않고 TDS의 [Typography](https://tossmini-docs.toss.im/tds-react-native/foundation/typography/) 토큰과 컬러 토큰(`@toss/tds-react-native`의 `colors.grey700` 등)을 사용한다. **hex 직접 사용 금지** (ADR-015 D39) — `colors.*` 토큰으로 일괄 교체 완료. ⚠️ **`colors.primary`는 `@toss/tds-colors@0.1.0`에 부재**(QA 실증 TS2339) — 사용 금지. **브랜드 강조색은 `colors.orange500`(`#FF6B00`)** 사용(brand `#FF6B35` 최근접 실재 토큰, ADR-017 D59). 신규 강조색도 hex 대신 brand 최근접 실재 토큰을 채택하는 것이 D39 hex-금지 정신에 부합. 다크 모드 adaptive(`colorsByPreference.light/dark` 또는 `useColors()` hook) 도입은 별 ADR(Phase 6 진화).
3. **`onClick` → `onPress`**: 모든 상호작용 이벤트를 RN 표기로 바꾼다. `onChange` → `onChangeText`(TextField).
4. **`aria-*` → RN a11y props**: `aria-label` → `accessibilityLabel`, `aria-pressed` → `accessibilityState={{ selected }}`, `role` → `accessibilityRole`.
5. **`href` → `useNavigation().navigate(path)`**: `next/link`·`useRouter().push`는 모두 `@granite-js/react-native`의 `useNavigation`으로 대체(07-ROUTING).
6. **`"use client"` 디렉티브 삭제**: RN은 클라이언트 단일 환경이므로 불필요. 서버 컴포넌트 개념도 없음.
7. **컴포넌트 SRP 유지**: 데이터 페칭은 훅으로 분리, 컴포넌트는 표현+콜백만. 현재 웹의 단일책임 분리(`src/components/AGENTS.md`)를 그대로 답습한다.
8. **공유 타입은 그대로 복사**: `src/types/recipe.ts`·`api.ts`는 RN 저장소로 복사하여 SSOT 동기. `cn`/`@/lib/utils`는 복사하지 않는다.
9. **404 UI 통일(ADR-005)**: 없음·타인 소유·잘못된 id는 모두 동일 "레시피를 찾을 수 없어요" UI — `ErrorPage statusCode={404}` 또는 `Txt` + `Button`으로 동일 메시지.

## 6.2 컴포넌트 인벤토리 (현재 웹) — 14개

| 분류 | 파일 | 미니앱 매핑 대상? |
|------|------|------------------|
| 도메인 — 폼/표시 | `SearchForm.tsx` | ✅ |
| 도메인 — 표시 | `RecipeDisplay.tsx` | ✅ |
| 도메인 — 표시 | `NutritionPanel.tsx` | ✅ |
| 도메인 — 목록 아이템 | `RecipeCard.tsx` | ✅ |
| 도메인 — 액션 버튼 | `FavoriteButton.tsx` | ✅ |
| 글로벌 — 네비게이션 | `NavBar.tsx` | ✅ (TDS `Navbar`로 1:1, but `useAuth` 의존 제거) |
| **인증 폼** | `AuthForm.tsx` | ❌ **제외** (ADR-009 D2: Toss 식별로 인증 폼 미구현) |
| 유틸 | `recipe-format.ts` | ✅ (그대로 이식 — 순수 함수) |
| UI primitive | `ui/button.tsx` | ✅ → TDS `Button` |
| UI primitive | `ui/input.tsx` | ✅ → TDS `TextField` |
| UI primitive | `ui/label.tsx` | ✅ → TDS `Txt`(typography 토큰) |
| UI primitive | `ui/card.tsx` | ✅ → `View` + TDS 색·여백 토큰 (또는 `ListRow` 조합) |
| UI primitive | `ui/badge.tsx` | ✅ → TDS `Badge` |
| UI primitive | `ui/alert.tsx` | ✅ → TDS `Toast`(임시) + 인라인 박스(`Txt`) (메시지에 따라 분기) |
| UI primitive | `ui/spinner.tsx` | ✅ → RN `ActivityIndicator` (TDS는 별도 Spinner 컴포넌트 없음 — 검색 결과 확인) 또는 TDS `Skeleton`(로딩 자리표시자) |

> **총 매핑 대상: 13개** (AuthForm 제외). 14개 인벤토리 중 1개 제외.

## 6.3 UI Primitives 매핑 (`src/components/ui/`)

### 6.3.1 `ui/button.tsx` → TDS [`Button`](https://tossmini-docs.toss.im/tds-react-native/components/button/)

| 현재 props | 현재 값 | TDS Button props | 매핑 값 |
|------------|---------|------------------|---------|
| `variant="primary"` | 주황 배경 | `display="primary"` | `primary` |
| `variant="secondary"` | 연한 회색 | `display="secondary"` | `secondary` |
| `variant="outline"` | 테두리만 | (없음) | `variant="line"` 또는 secondary 사용 |
| `variant="ghost"` | 투명 + hover | `display="tertiary"` 또는 TDS `TextButton` | (텍스트 버튼 컨텍스트면 TextButton 사용) |
| `variant="destructive"` | 빨간 배경 | `display="critical"` | `critical` |
| `size="sm"` | h-8 | `size="tiny"` | `tiny` |
| `size="md"` | h-10 | `size="medium"` | `medium` |
| `size="lg"` | h-12 | `size="large"` 또는 `big` | `large` |
| `size="icon"` | h-10 w-10 | (TDS `IconButton` 사용) | 별도 컴포넌트로 분리 |
| `disabled` | HTML disabled | TDS Button `disabled` | 그대로 |
| `onClick` | DOM 이벤트 | `onPress` | RN 이벤트 |

**아이콘 버튼 (`size="icon"`)** 은 [`IconButton`](https://tossmini-docs.toss.im/tds-react-native/components/icon-button/)으로 분리:
```tsx
<IconButton name="icon-trash-bold-mono" variant="clear" onPress={handleDelete} accessibilityLabel="삭제" />
```

### 6.3.2 `ui/input.tsx` → TDS [`TextField`](https://tossmini-docs.toss.im/tds-react-native/components/text-field/)

| 현재 props | TDS TextField props | 비고 |
|------------|---------------------|------|
| `value` | `value` | 동일 |
| `onChange={(e) => setX(e.target.value)}` | `onChangeText={setX}` | RN 패턴 (값 직접 전달) |
| `type="text"` | `keyboardType="default"` | 기본값 |
| `type="number"` | `keyboardType="number-pad"` | RN 표준 |
| `type="email"` | (사용 안 함 — AuthForm 제외) | - |
| `type="password"` | (사용 안 함 — AuthForm 제외) | - |
| `placeholder` | `placeholder` | 동일 |
| `disabled` | `editable={false}` | RN 표기 |
| `maxLength` | `maxLength` | 동일 |
| `min`/`max` | (number-pad에서 직접 검증) | onChangeText 내에서 clamp |
| `aria-label` | `accessibilityLabel` | a11y |

**variant 선택**: 폼 입력 박스는 `variant="box"` 또는 `variant="line"` (디자인 선호). 검색창은 TDS [`SearchField`](https://tossmini-docs.toss.im/tds-react-native/components/) 별도 검토.

### 6.3.3 `ui/card.tsx` → `View` + TDS 토큰

TDS RN에 직접 `Card` 컴포넌트는 없으므로 RN `View` + adaptive 토큰 + `Txt`(헤더/타이틀)로 조합한다. 또는 메뉴/리스트 컨텍스트면 [`ListRow`](https://tossmini-docs.toss.im/tds-react-native/components/list-row/) 사용.

```tsx
// Card 컨테이너
<View style={{ backgroundColor: adaptive.white, borderRadius: 12, padding: 20 }}>
  {/* CardHeader → */}
  <Txt typography="t3" color={adaptive.grey900}>{title}</Txt>
  {/* CardContent → */}
  {children}
</View>
```

Card·CardHeader·CardTitle·CardDescription·CardContent·CardFooter의 6개 sub-export는 미니앱에선 단일 `Card` 함수 컴포넌트 1개로 통합하거나, 그대로 6개로 분리해도 무방(취향).

### 6.3.4 `ui/badge.tsx` → TDS [`Badge`](https://tossmini-docs.toss.im/tds-react-native/components/badge/)

TDS Badge 표준 props: `size: 'tiny'|'small'|'medium'|'large'`, `badgeStyle: 'fill'|'weak'`, `type: '...'`(공식 예제는 `blue/teal/green/red` 명시). 카드 메타 라벨은 `size="tiny"` 또는 `small` 권장.

| 현재 variant | 의미 | TDS Badge props (1차 매핑) | 비고 |
|--------------|------|---------------------------|------|
| `default` | 주황(생성) | `type="red"`, `badgeStyle="fill"` (또는 TDS 팔레트가 `orange` 지원 시 그것) | 검수 시 디자이너와 색 토큰 합의 |
| `easy` | 녹색 (난이도 쉬움) | `type="green"`, `badgeStyle="fill"` | TDS 공식 예제 확인됨 |
| `medium` | 황색 (난이도 보통) | `type="teal"` 또는 `type="green"+badgeStyle="weak"` | 황색이 TDS 표준 type에 없을 가능성 — 대안 결정 |
| `hard` | 빨강 (난이도 어려움) | `type="red"`, `badgeStyle="fill"` | TDS 공식 예제 확인됨 |
| `muted` | 회색 (보조 메타) | `type="blue"+badgeStyle="weak"` 또는 TDS 표준 grey 토큰 | "fill" 회피 — 시각적 강조 낮음 |

> TDS Badge의 정확한 `type` 팔레트는 [Badge 문서](https://tossmini-docs.toss.im/tds-react-native/components/badge/)에서 v1 구현 시 최종 확정. 본 챕터는 **의미 매핑**만 정의: easy=긍정(green), hard=경고(red), medium=중립, default=강조, muted=보조. 색 토큰이 정확히 일치하지 않으면 디자인 검토.

> **Phase 2 frontend 발견 (2026-05-24 — qa 인계)**: `Badge` 컴포넌트는 `ParagraphBadgeProps` 상속이라 `children`이 **string 또는 number만 허용**(내부적으로 `<Paragraph>` 렌더). `<Badge><Txt>...</Txt></Badge>` 같은 nested element는 컴파일 또는 런타임 실패 가능. 라벨 텍스트는 단순 문자열 직접 전달(`<Badge size="small">{difficultyLabel[recipe.difficulty]}</Badge>`). 다국어/포맷팅이 필요한 경우 호출 측에서 미리 문자열 가공.

### 6.3.5 `ui/alert.tsx` → 분기

TDS에 직접 `Alert` 박스는 없다. 두 가지로 분기:

- **일시 알림(저장 성공·삭제 성공)** → TDS [`Toast`](https://tossmini-docs.toss.im/tds-react-native/components/toast/)
- **인라인 에러(폼 유효성·API 에러)** → RN `View` + `Txt`(typography `st9`/`st10`, color red 토큰)

```tsx
// 인라인 에러 박스
<View style={{ backgroundColor: adaptive.redLight, borderRadius: 12, padding: 12 }}>
  <Txt typography="st9" color={adaptive.red700} role="alert">
    {errorMessage}
  </Txt>
</View>
```

### 6.3.6 `ui/label.tsx` → TDS `Txt`

폼 라벨은 `<Label htmlFor>` 이지만 TDS의 `TextField`는 자체 `label`/`description` props를 제공하므로 별도 Label 컴포넌트가 필요 없을 수 있다. 필요시 `Txt typography="st9"`로 충분.

### 6.3.7 `ui/spinner.tsx` → RN `ActivityIndicator` 또는 TDS [`Skeleton`](https://tossmini-docs.toss.im/tds-react-native/components/skeleton/)

TDS RN에 별도 Spinner 컴포넌트는 검색 결과 부재. 두 가지 선택:

- **인라인 로딩(버튼 내부 등)** → RN `<ActivityIndicator size="small" color={adaptive.orange500} />`
- **콘텐츠 자리표시자(목록·상세 로딩)** → TDS `Skeleton` (실제 UI 레이아웃을 흉내내는 placeholder)

```tsx
// 목록 로딩
<Skeleton width="100%" height={120} borderRadius={12} />
<Skeleton width="80%" height={16} borderRadius={4} style={{ marginTop: 8 }} />
```

## 6.4 도메인 컴포넌트 매핑

### 6.4.1 `SearchForm.tsx`

요리 이름 + 인분 입력 + 제출 버튼. presentational + `onSubmit` 콜백 — 현재 구조 그대로 RN으로 옮긴다.

| 현재 요소 | 미니앱 매핑 |
|----------|-------------|
| `<form onSubmit>` | RN은 form 태그 없음 — 외부 `View` + 제출 함수를 Button `onPress`에 연결 |
| `<Input placeholder="요리 이름">` | TDS `TextField variant="line" placeholder="..."` |
| `<Input type="number" min={1} max={20}>` | 두 가지 옵션: (1) TDS [`NumericSpinner`](https://tossmini-docs.toss.im/tds-react-native/components/numeric-spinner/) (권장 — 키보드 없이 증감), (2) `TextField keyboardType="number-pad"` + onChangeText clamp |
| `<Button type="submit" disabled={!canSubmit}>` | TDS `Button display="primary" disabled={!canSubmit} onPress={handleSubmit}` |
| 진행 중 `<Spinner />` | Button 내부 RN `ActivityIndicator` 또는 Button의 `loading` prop(TDS Button이 지원하면) |
| `aria-label="요리 이름"` | `accessibilityLabel="요리 이름"` |

**NumericSpinner 권장**: 1~20 인분 범위에서 키보드보다 UX가 좋다.

**props 인터페이스는 그대로**: `(dishName: string, servings: number) => void` 콜백 시그니처 유지.

### 6.4.2 `RecipeDisplay.tsx`

레시피 전체(타이틀·설명·재료·단계·팁·영양) 표시. 입력은 `GeneratedRecipe | Recipe` 공통 필드만 사용 — RN에서도 동일하게 `id`를 읽지 않는다(불변식 2 보호).

| 현재 영역 | 미니앱 매핑 |
|----------|-------------|
| `<article>` | RN `<View>` |
| `<header><h1>` + `<p>` 설명 | `View` + `Txt typography="t1"`(타이틀) + `Txt typography="st9" color={adaptive.grey700}`(설명) |
| Badge 묶음(difficulty·servings·cookTime) | 6.3.4의 TDS `Badge` 3개 가로 배치 |
| `actions` 슬롯(저장/즐겨찾기 등) | 그대로 ReactNode prop으로 유지 |
| 재료 카드 — `<Card>` + `<ul>/<li>` | 6.3.3 Card 컨테이너 + [`List`](https://tossmini-docs.toss.im/tds-react-native/components/list/) + [`ListRow`](https://tossmini-docs.toss.im/tds-react-native/components/list-row/) (`ListRow.Texts`) |
| 조리 순서 — 번호 원형 + 텍스트 | RN 커스텀: `View` + `Txt`(원형 배경) — TDS 토큰 활용 |
| 요리 팁 — `<ul>` 디스크 | RN `View` + 각 tip을 `Txt typography="st9"` + 앞에 dot |
| 영양 패널 (`<NutritionPanel>`) | 그대로 분리 — 6.4.3 |

스크롤은 외부에서 `ScrollView`로 감싸거나, 페이지에서 `FlatList` 사용 시 헤더로 주입. 본 컴포넌트 자체는 스크롤 책임을 갖지 않는다(SRP).

### 6.4.3 `NutritionPanel.tsx`

1인분 영양 정보 — 칼로리 강조 + 4 매크로 + healthNote.

| 현재 요소 | 미니앱 매핑 |
|----------|-------------|
| Card 컨테이너 | 6.3.3 |
| `text-3xl font-bold` 칼로리 | `Txt typography="t1"` + 강조 색 토큰 |
| `kcal` 작은 단위 | `Txt typography="st10"` + grey 색 |
| 4-grid 매크로(탄수·단백·지방·식이섬유) | RN `View flexDirection: 'row', flexWrap: 'wrap'` + 각 셀 `View` |
| 각 매크로의 라벨/값 | `Txt typography="st10"`(라벨) + `Txt typography="t5"`(값) |
| healthNote 박스 | `View` + 연한 녹색 배경 + `Txt typography="st9"` (선택적 렌더링 그대로) |

**TableRow 대안**: 4 매크로를 TDS [`TableRow`](https://tossmini-docs.toss.im/tds-react-native/components/table-row/)(left/right 행)로도 표현 가능. 디자인 선호에 따라.

### 6.4.4 `RecipeCard.tsx`

저장된 레시피 목록 아이템. `Recipe`(id 포함) + 카드 클릭 → 상세 진입 + 즐겨찾기·삭제 액션.

| 현재 요소 | 미니앱 매핑 |
|----------|-------------|
| `<Card hover:shadow-md>` | 6.3.3 Card + `Pressable` 또는 `TouchableOpacity` 래퍼 |
| `<Link href={`/recipe/${recipe.id}`}>` 카드 | `Pressable onPress={() => navigation.navigate('/recipe/[id]', { id: recipe.id })}` — 07-ROUTING 참조 |
| 제목 `<Link>` | `Txt typography="t5"` + Pressable |
| `<FavoriteButton>` | 6.4.5 |
| 설명(line-clamp-2) | `Txt typography="st9" numberOfLines={2}` |
| Badge 묶음 | 6.3.4 |
| "자세히 보기" 보조 버튼 | TDS `Button display="secondary" size="tiny"` + `onPress={navigate}` |
| 삭제 보조 버튼 | TDS `Button display="tertiary" size="tiny" onPress={handleDelete}` |

**리스트 뷰**: 부모 화면(`my-recipes`)에서 `FlatList` 또는 RN `ScrollView`로 감싼다. TDS [`List`](https://tossmini-docs.toss.im/tds-react-native/components/list/)는 ListRow 기반이라 카드형 UI엔 부적합. 카드 그리드는 RN 표준 사용.

### 6.4.5 `FavoriteButton.tsx`

별 아이콘 토글 — `isFavorite` + `onToggle(target: boolean)`. **목표값 명시 멱등**(계약 4.1).

| 현재 요소 | 미니앱 매핑 |
|----------|-------------|
| `<button>` + 인라인 SVG path | TDS [`IconButton`](https://tossmini-docs.toss.im/tds-react-native/components/icon-button/) `name="icon-star-bold-mono"`(채움)/`"icon-star-mono"`(비움) — 정확한 icon name은 TDS Icon 카탈로그 확인 |
| `aria-pressed={isFavorite}` | `accessibilityState={{ selected: isFavorite }}` |
| `aria-label="즐겨찾기 추가/해제"` | `accessibilityLabel` 그대로 |
| 클릭 시 pending 상태 | TDS IconButton `disabled={pending}` + 자체 useState pending |
| `onToggle(!isFavorite)` | 동일 — 현재값의 반대 전달, 멱등 계약 유지 |
| `fill-orange-500 stroke-orange-500` | TDS Icon 색 prop (`color`) — adaptive 토큰 |

**props 시그니처는 변경 없음**: `(target: boolean) => Promise<void> | void`.

### 6.4.6 `NavBar.tsx` → TDS [`PageNavbar`](https://tossmini-docs.toss.im/tds-react-native/components/page-navbar/) (2026-05-24 갱신 — Phase 2 baseline §B.2 결정)

현재 웹의 NavBar는 sticky 상단 헤더 + 로고 + 메뉴 링크 + `useAuth`로 로그인/로그아웃 분기. 미니앱에선 TDS `PageNavbar`로 대체하되 **`useAuth` 의존을 제거**한다(ADR-009 D2: 미니앱은 `getAnonymousKey()` 자동 식별).

> **명칭 갱신 사실**: `@toss/tds-react-native@2.0.3` root export에는 단일 명칭 `Navbar`가 **없다**. 대신 `extensions/page-navbar`에서 `PageNavbar`(compound: `.Title`/`.AccessoryButtons`/`.AccessoryTextButton`/`.AccessoryIconButton`/`.TransparentScrollView`)와 `components/navbar/ReactNavigationHelper`의 `ReactNavigationNavbar`(React Navigation `screenOptions`용)가 별개로 export된다. 본 미니앱은 Granite `createRoute`/`useNavigation` 위에서 컴포넌트 본문에 navbar를 직접 렌더하는 패턴이라 **`PageNavbar`를 채택** (ADR-011 D12, baseline §B.2).

**import**:
```tsx
import { PageNavbar } from '@toss/tds-react-native';
```

**핵심 props** (`node_modules/@toss/tds-react-native/dist/esm/extensions/page-navbar/PageNavbar.d.ts` 인용):

| prop | 타입 | 기본 | 설명 |
|------|------|------|------|
| `preference` | `{ type: 'showAlways' } \| { type: 'transparent' } \| { type: 'none' }` | `{ type: 'showAlways' }` | navbar 표시 모드. `transparent` 사용 시 `PageNavbar.TransparentScrollView` 함께 사용 필수. `none`은 헤더 자체 숨김. |
| `children` | `ReactNode` | — | 타이틀·액세서리 버튼. compound API 사용. |

**compound API** (root에서 직접 import 불가, `PageNavbar.X` 형태로만):

| compound | 용도 |
|----------|------|
| `PageNavbar.Title` | 타이틀 텍스트 슬롯 |
| `PageNavbar.AccessoryButtons` | 우측 액세서리 영역 컨테이너 |
| `PageNavbar.AccessoryTextButton` | 텍스트 액세서리 버튼 (`children`: 한국어) |
| `PageNavbar.AccessoryIconButton` | 아이콘 액세서리 버튼 (`name: string` — TDS icon 카탈로그) |
| `PageNavbar.TransparentScrollView` | `preference: 'transparent'`일 때 함께 쓰는 ScrollView |

**현재 매핑 (Granite + Toss 식별 컨텍스트)**:

| 현재 요소 | 미니앱 매핑 |
|----------|-------------|
| `<header className="sticky top-0">` | 각 화면(`pages/*.tsx`) 컴포넌트 본문에서 `<PageNavbar>...</PageNavbar>` 직접 렌더. 글로벌 layout 없음 (07-ROUTING §7.8) |
| 로고 `<Link href="/">` | 홈 화면에선 navbar 좌측 액션 없음(필요 시 close 버튼). 보호 화면에선 Granite `useNavigation().goBack()` 호출 액세서리 버튼 |
| `title` (앱명) | `<PageNavbar.Title>AI 레시피</PageNavbar.Title>` |
| 우측 액션 — "레시피 생성" 링크 | `<PageNavbar.AccessoryButtons><PageNavbar.AccessoryTextButton onPress={() => navigation.navigate('/recipe/generate', {})}>레시피 만들기</PageNavbar.AccessoryTextButton></PageNavbar.AccessoryButtons>` |
| "마이 레시피" 링크 (로그인 시) | 미니앱은 항상 식별자 보유 → 조건부 분기 없이 항상 표시 (Phase 3 진입 시 적용) |
| "로그인"/"로그아웃" 버튼 | **제거** (ADR-009 D2) — Toss 식별이 자동이라 로그인/로그아웃 개념 없음 |

**Phase 2 실 사용 위치 (frontend 산출 인용 — qa report §13.5 인계)**:

| 파일 | 사용 형태 |
|------|----------|
| `pages/index.tsx` | `<PageNavbar><PageNavbar.Title>AI 레시피</PageNavbar.Title></PageNavbar>` (라우트 구현은 `pages/`, ADR-018) |
| `pages/recipe/generate.tsx` | 동일 패턴 + 화면 타이틀 |

**공통 래퍼(`AppNavbar.tsx`)는 만들지 않는다** (Phase 2 baseline §B.2 — YAGNI). Phase 3에서 화면이 늘면 그때 추출 검토.

> 본 컴포넌트는 미니앱에선 글로벌 `NavBar.tsx`로 옮기지 않고 각 화면이 `PageNavbar`를 직접 사용한다. **`ReactNavigationNavbar`는 채택 안 함** — React Navigation `screenOptions` 슬롯용으로 본 미니앱의 Granite `createRoute` 추상화 위에서 부적합.

### 6.4.7 `AuthForm.tsx` — **제외** (ADR-009 D2)

미니앱 v1에 미구현. 이유:

- 미니앱은 `getAnonymousKey()`로 즉시 사용자 식별 hash를 얻는다(05-AUTH).
- 회원가입/로그인/비밀번호 폼이 불필요.
- 백엔드의 Supabase Auth 경로는 그대로 살아있으나 미니앱은 호출하지 않는다(`X-Toss-User-Id` 헤더 경로만 사용).

만약 향후 R1 시나리오(ADR-009 롤백 R1)로 Toss 로그인 또는 Supabase 재도입이 필요해지면 별도 ADR로 처리.

### 6.4.8 `recipe-format.ts` — 그대로 이식

순수 함수(`difficultyLabel`, `difficultyVariant`, `formatCookTime`)만 export. RN에서도 동일하게 import해 사용. 변경 없음.

```ts
// 미니앱 저장소에서도 그대로 사용
export const difficultyLabel: Record<Difficulty, string> = {
  easy: "쉬움", medium: "보통", hard: "어려움",
};
```

## 6.5 컴포넌트 ↔ TDS 매핑 요약표 (한눈 보기)

| # | 현재 컴포넌트 | 책임 | 미니앱 TDS 매핑 | 비고 |
|---|--------------|------|-----------------|------|
| 1 | `SearchForm` | 요리명+인분 입력 폼 | `TextField` + `NumericSpinner` + `Button` | 콜백 시그니처 유지 |
| 2 | `RecipeDisplay` | 레시피 전체 표시 | `View` + `Txt` + `Badge` + `List`/`ListRow` + actions slot | 공통 필드만 사용(불변식 2) |
| 3 | `NutritionPanel` | 영양 카드 | `View` + `Txt`(typography 토큰) | TableRow 대안 가능 |
| 4 | `RecipeCard` | 목록 카드 | `View` + `Pressable` + `Txt` + `Badge` + `IconButton`(즐겨찾기) + `Button`(삭제) | `Link` → navigation.navigate |
| 5 | `FavoriteButton` | 별 토글 | `IconButton name="icon-star-..."` | 멱등 목표값 콜백 유지 |
| 6 | `NavBar` | 글로벌 헤더 | TDS `PageNavbar`(extensions) compound로 화면별 분산 — `.Title`/`.AccessoryButtons`/`.AccessoryTextButton`/`.AccessoryIconButton` | `useAuth` 제거 + 단일 `Navbar` 명칭 부재 → `PageNavbar` 채택 (Phase 2 baseline §B.2, ADR-011 D12). 공통 래퍼 미작성 (YAGNI) |
| 7 | `AuthForm` | 인증 폼 | **제외** | ADR-009 D2 |
| 8 | `recipe-format.ts` | 포맷 유틸 | 그대로 이식 | 순수 함수 |
| 9 | `ui/button` | 버튼 primitive | TDS `Button` (`display`/`size`) + `TextButton`/`IconButton` 보조 | variant 매핑표 6.3.1 |
| 10 | `ui/input` | 입력 primitive | TDS `TextField` (`variant="line"`) | onChange → onChangeText |
| 11 | `ui/label` | 라벨 primitive | TDS `Txt typography="st9"` 또는 TextField label prop | 별도 컴포넌트 불필요할 수 있음 |
| 12 | `ui/card` | 카드 primitive | `View` + adaptive 토큰 + `Txt`(타이틀) | 6 sub-export는 1개로 통합 가능 |
| 13 | `ui/badge` | 배지 primitive | TDS `Badge` (`type`/`badgeStyle`/`size`) | variant→type 매핑 6.3.4 |
| 14 | `ui/alert` | 알림 박스 | `Toast`(일시) 또는 `View`+`Txt`(인라인 에러) | 메시지 종류에 따라 분기 |
| 15 | `ui/spinner` | 로딩 인디 | RN `ActivityIndicator` 또는 TDS `Skeleton` | 컨텍스트별 |

(추가) **새 미니앱 전용 컴포넌트(현재 웹에 없음, 신규 추가)**:

| 새 컴포넌트 | 책임 | TDS 매핑 | 본 미니앱 실 구현 |
|-------------|------|---------|----------------|
| `FilterTabs` | 전체/즐겨찾기 필터 | TDS `SegmentedControl.Root` + `.Item` | **Phase 4 완료 (2026-05-25)** — `src/components/FilterTabs.tsx`. `import { SegmentedControl } from '@toss/tds-react-native'`. props `{ value: 'all'\|'favorite', onChange: (next) => void }`. `SegmentedControl.Root name="my-recipes-filter" value={value} size="small" onChange={...}` + Item 2개("전체"/"즐겨찾기"). ADR-013 D11. SegmentedControl 채택 사유: 2-state 라디오 시맨틱이 즐겨찾기 토글에 정합(Tab 기각 — 다중 카테고리·페이지 전환용) |
| `DeleteConfirmDialog` | 삭제 확인 다이얼로그 | TDS `ConfirmDialog` + `ConfirmDialog.Button` | **Phase 4 완료 (2026-05-25)** — `src/components/DeleteConfirmDialog.tsx`. `import { ConfirmDialog } from '@toss/tds-react-native'`. props `{ open, recipeName, onConfirm, onCancel, pending? }`. **TDS 실제 API 정정 (ADR-013 D23)**: `confirmText/cancelText/onConfirm/onCancel` 명명 props는 **실재하지 않음**. `leftButton`/`rightButton`(ReactElement 필수·2개 children 강제) + `onClose`/`onExited`(필수) + `closeOnDimmerClick`. `ConfirmDialog.Button = DoubleButtonItem = ComponentProps<typeof Button>` — 취소 `type="light" style="weak"`, 삭제 `type="danger" style="fill" loading={pending}`. 한국어 카피: title="이 레시피를 삭제할까요?" + description은 recipeName 인용 |
| `NotFoundScreen` | **단일 404 화면** (ADR-005). Phase 4 PATCH/DELETE 404 + Granite `_404` 폴백 재사용 보장 | TDS [`ErrorPage`](https://tossmini-docs.toss.im/tds-react-native/components/error-page/) `statusCode={404}` | **Phase 3 + 본 사이클 정정 (2026-05-29)** — `src/components/NotFoundScreen.tsx`. `import { ErrorPage } from '@toss/tds-react-native'`. props `{ onBack: () => void, onContactSupport?: () => void, title?: string, subtitle?: string }`. **TDS 카피 매핑 정정**: TDS ErrorPage의 좌측 버튼은 하드코딩 "고객센터 문의", 우측 버튼은 404 시 "닫기"(400 시 "다시 입력하기"). **`onBack`은 `onPressRightButton`("닫기")에 바인딩** — 사용자 "닫기" 의도와 일치. `onContactSupport`는 좌측 "고객센터 문의"에 바인딩(현재 미연동 — 별 ADR로 CS deeplink 추가 검토). title/subtitle은 default("레시피를 찾을 수 없어요" / 단건 404용) override 가능. ADR-012 D16. **단일 사용 위치 정책** — `pages/`에서 `<ErrorPage statusCode={404}>` 직접 렌더 + 인라인 "찾을 수 없" 텍스트 금지 |
| `EmptyState` | 빈 목록 안내 (마이 0건 + Phase 4 즐겨찾기 0건 등) | `View` + `Txt` + `Button`(생성하러 가기) | **Phase 3 완료 (2026-05-24)** — `src/components/EmptyState.tsx`. props 4종 `{ title, description, actionLabel, onAction }`으로 다양 빈 상태 재사용. presentational only. ADR-012 D18 |
| `RecipeCard` (06 §6.4.4 신규 구현) | 저장된 Recipe 카드 (마이 목록 아이템) | `View` + `Pressable` + `Txt` + `Badge` + `FavoriteButton`(Phase 4 활성화) | **Phase 3 완료 (2026-05-24) + Phase 4 확장 (2026-05-25)** — `src/components/RecipeCard.tsx`. props `{ recipe, onPress, onToggleFavorite?, onDelete?, favoritePending? }`. **Phase 4(ADR-013 D7·D22)**: `onToggleFavorite` 자리표시 활성화 → header에 `<FavoriteButton>` 합성. `onDelete` prop은 자리표시 유지(카드 측 삭제는 별 ADR — swipe·long-press 미도입). `recipe.id` 사용 OK (저장된 Recipe 한정) |
| `FavoriteButton` (06 §6.4.5) | 별 토글 (마이 카드 + 상세 화면 헤더) | TDS `IconButton` + Icon name 동적 fetch | **Phase 4 완료 (2026-05-25)** — `src/components/FavoriteButton.tsx`. `import { IconButton } from '@toss/tds-react-native'`. props `{ isFavorite, onToggle, pending? }`. 멱등 목표값 콜백 — `onToggle(!isFavorite)`. icon name: `icon-star-bold-mono`(채움)/`icon-star-mono`(비움) — 토스 CDN 동적 fetch(컴파일 검증 불가, dev 노랑 fallback이 멈춤 트리거 §H.1). `variant="clear"`, `iconSize={24}`, `accessibilityState={{ selected: isFavorite, disabled: pending }}` |

## 6.10 Phase 6 신규 컴포넌트 (테마 추천 — ADR-016)

Phase 6에서 추가되는 컴포넌트 2종. SegmentedControl·Pressable·Badge는 §6.5 표에서 이미 실재 검증됨 — 본 절은 합성 시그니처 SSOT만 동결.

| 새 컴포넌트 | 책임 | TDS 매핑 | 실 구현 (예정) |
|-------------|------|---------|----------------|
| `ThemePicker` | 상황(6종) + 날씨(5종) 테마 축 2개 선택 UI | TDS `SegmentedControl.Root` + `.Item` 2축 합성 | **Phase 6 (2026-05-29 예정)** — `src/components/ThemePicker.tsx`. `import { SegmentedControl, Txt } from '@toss/tds-react-native'`. props `{ value: RecommendationTheme, onChange: (next) => void }`. 2개 SegmentedControl.Root 행 — 상황(6 Item)·날씨(5 Item) 각 행 라벨 `Txt typography="st9"`. value는 nullable `{ situation?, weather? }`. 한국어 라벨 매핑은 03 §3.8.2 SSOT 사용. **검증 핵심**: 둘 다 미선택 시 부모가 disabled CTA 보장(AC6.1) |
| `RecommendationCard` | 추천 카드 1장 (요리명·설명·태그) | `Pressable` + `View` + `Txt`(typography 토큰) + `Badge` × N | **Phase 6 (2026-05-29 예정)** — `src/components/RecommendationCard.tsx`. `import { Pressable } from 'react-native'`(또는 TDS) + `import { Txt, Badge, colors } from '@toss/tds-react-native'`. props `{ item: RecommendationItem, onPress: () => void }`. 합성: Pressable 외곽 → Txt(`dishName`, `typography="t5"`) + Txt(`description`, `typography="t2" color={colors.grey700}`) + `tags.map(tag => <Badge type="normal" size="small">{tag}</Badge>)`. **추천은 ephemeral** — `recipe.id` 없음, 카드 탭 시 `dishName`을 URL 파라미터로 전달(`/recipe/generate?dishName=...`) — 기존 SearchForm `initialDishName` 재사용 |

> `useRecommendations` 훅과 `pages/recipe/recommend.tsx` 라우트는 §6.10 외 — 훅은 `src/hooks/AGENTS.md`, 라우트는 07-ROUTING §7.3.6에서 동결.

## 6.11 정적 법적 페이지 패턴 (이용약관·개인정보처리방침 — ADR-020)

`pages/terms.tsx`·`pages/privacy.tsx`는 별도 도메인 컴포넌트 없이 **TDS 프리미티브만으로 본문을 반복 렌더**하는 정적 패턴이다. 신규 컴포넌트 0개 — `src/components/`에 추가하지 않는다(단일 화면 전용·재사용 없음, ADR-009 단순성 원칙).

| 요소 | TDS 매핑 | 비고 |
|------|---------|------|
| 화면 제목 | `PageNavbar.Title` | "서비스 이용약관" / "개인정보처리방침" |
| 본문 컨테이너 | RN `ScrollView` + `contentContainerStyle`(padding 20·gap 20·paddingBottom 24) | 긴 본문 스크롤. paddingBottom은 하단 탭바 가림 방지(ADR-017 D61) |
| 조항/절 제목 | `Txt typography="t5" color={colors.grey900}` | 모듈 상수 배열을 `.map`으로 반복 |
| 본문 단락 | `Txt typography="st9" color={colors.grey700}` + `style={{ lineHeight: 22 }}` | 단락 배열 `.map` |
| 시행일 | `Txt typography="st11" color={colors.grey500}` | 본문 말미 1줄 |
| 하단 탭바 | `<BottomTabBar active="none" />` | 비-탭 화면(ADR-017 D63) |

> **본문 데이터**: 약관/처리방침 본문은 페이지 파일 내 모듈 상수(`ARTICLES`/`SECTIONS`: `{ title, body: string[] }[]`)로 둔다. 외부 호출 0건. hex 직접 사용 0건(`colors.*` 토큰만, ADR-015 D39). 사업자 정보 placeholder는 출시 전 확정(ADR-020 D74).
>
> **홈 푸터 진입(ADR-020 D72)**: `pages/index.tsx` `ScrollView` 하단에 `Pressable` + `Txt typography="st11" color={colors.grey500}` 텍스트 링크 2개를 가로 배치(가운데 `·` 구분, `colors.grey300`). 누름 → `navigation.navigate('/terms'|'/privacy', {})`.

**AI 면책 문구 (ADR-016 D52 — Phase 5 D40 패턴 재사용):**
- 위치: `pages/recipe/recommend.tsx` 추천 결과 리스트 하단 1줄.
- 카피: "AI가 생성한 참고용 추천이에요. 식당·식자재 등 실제 상황을 고려해 선택해주세요."
- 스타일: `<Txt typography="st11" color={colors.grey600}>` fixed 1줄.

## 6.12 요리 기록 피드 신규 컴포넌트 (ADR-021)

요리 기록 피드 단계에서 추가되는 컴포넌트 6종 + FAB. **별점은 TDS `Rating` 채택**(아래 ⚠ 정정).

> ⚠️ **TDS Rating 실재성 정정 (ADR-021 D79):** 계획 초안이 가정한 `EditableRating`/`ReadOnlyRating` **named export는 `@toss/tds-react-native` 최상위에 없다** — `rating/index.d.ts` barrel은 **`Rating`만** public export하고 두 컴포넌트는 내부 타입(`.d.ts` 미노출). 따라서 별점은 단일 `Rating`의 판별 유니온(`readonly` 분기)으로 사용한다:
> - 입력(폼): `<Rating readonly={false} value onValueChange size="large" max={5} />` (EditableRatingProps — `size:'medium'|'large'|'big'`).
> - 표시(카드/상세): `<Rating readonly value variant size max={5} />` (ReadOnlyRatingProps — `variant:'full'|'compact'|'iconOnly'`, `size:'tiny'..'big'`).
> 합성 글리프(★/☆) 불필요 — 검증된 TDS 컴포넌트로 충족(설계 §7.6).

| 새 컴포넌트 | 책임 | TDS 매핑 | 실 구현 |
|-------------|------|---------|---------|
| `PhotoPickerButton` | 요리 사진 선택 + 미리보기 | `Button`(type="light" style="weak") + RN `Image` + `Txt` | `src/components/PhotoPickerButton.tsx`. `media.pickFromAlbum()`(이미지 어댑터, SDK 직접 import 0건) → `PickedImage` 미리보기. props `{ value: PickedImage\|null, onPick }` |
| `StarRatingInput` | 별점 입력(1..5) | `Rating readonly={false}` (size="large") | `src/components/StarRatingInput.tsx`. `onValueChange` 결과 `Math.round`. props `{ value, onChange }` |
| `RecipeSnapshotPicker` | 기록에 첨부할 레시피 스냅샷 선택 | `Pressable` + `Txt` (목록) | `src/components/RecipeSnapshotPicker.tsx`. `useMyRecipes` 재사용(저장본) + 생성 결과 전달(미저장). `onSelect(recipe, sourceRecipeId)`. Recipe→GeneratedRecipe 추출은 폼이 수행 |
| `CookingLogForm` | 업로드 폼 조립 + 검증 | `TextField`(variant="line") + 위 3종 + `Button`(primary/fill) | `src/components/CookingLogForm.tsx`. 사진·레시피·별점·소감 필수 검증(한국어 안내, AC2). 에러 텍스트 `colors.red700`(기존 화면 관례). `onSubmit(CreateCookingLogRequest)` |
| `CookingLogCard` | 피드 카드(사진·요리명·별점·소감) | RN `Image` + `Rating readonly` (variant="compact" size="small") + `Txt` | `src/components/CookingLogCard.tsx`. `Pressable` 외곽 → 탭 시 상세. props `{ log: CookingLog, onPress }` |
| `FeedEmptyState` | 기록 0건 빈 상태 | `EmptyState` 재사용 | `src/components/FeedEmptyState.tsx`. title/description/actionLabel/onAction 위임 |

**FAB(피드 화면 — ADR-021 D83):** 우하단 "올리기" 버튼은 TDS 전용 컴포넌트 없이 RN `Pressable` + `Txt`(`colors.white`) 합성, 배경 `colors.orange500`. **hex 직접 사용 금지**(ADR-015 D39) — `colors` 토큰만(`orange500`/`white`). `position:'absolute' right:16 bottom:72 borderRadius:24`.

**기록 상세(`/cooking-log/[id]`):** 레시피 스냅샷 전체는 기존 `RecipeDisplay`(GeneratedRecipe 수용 — §6.4.2) 재사용. 404는 단일 `NotFoundScreen`(ADR-005). 삭제는 `Button`(type="danger" style="fill").

> `media` 이미지 어댑터·`useCooking*` 훅·`cooking-logs` 서비스는 §6.12 외 — 어댑터는 `src/lib/AGENTS.md`, 훅은 `src/hooks/AGENTS.md`, 라우트는 07-ROUTING §7.3.9~§7.3.11에서 동결.

## 6.6 접근성·국제화 체크리스트

| 항목 | 적용 방식 |
|------|----------|
| 스크린리더 라벨 | 모든 IconButton·Pressable에 `accessibilityLabel` 한국어 |
| 토글 상태 | `accessibilityState={{ selected, disabled }}` |
| 더 큰 텍스트(접근성) | TDS Typography 토큰(`t1`~`t5`, `st9`~`st12`) 사용. 직접 fontSize 하드코딩 금지 (TDS Typography 문서 권고) |
| 다크 모드 | adaptive 컬러 토큰 사용. 하드코딩 색 금지 |
| 한국어 텍스트 | 현재 코드와 동일한 카피 유지(현재 컴포넌트는 모두 한국어 카피) |
| 키보드 입력 | TextField `keyboardType` 적절히 (`number-pad`/`default`). 자동 대문자/스펠체크 비활성화는 `autoCorrect={false}` |

## 6.7 검증 절차 (QA가 확인할 항목)

QA(`integration-coherence-qa` 스킬)가 본 챕터 검증 시 확인:

- [ ] 14개 인벤토리 중 매핑 대상 13개 모두 본 챕터에 표가 존재 (AuthForm 제외 확인).
- [ ] 각 매핑 항목의 TDS 컴포넌트가 [TDS RN 카탈로그](https://tossmini-docs.toss.im/tds-react-native/components/)에 실제 존재 (Button, TextField, Card 대안, Badge, IconButton, Navbar, NumericSpinner, List, ListRow, Toast, Dialog, ErrorPage, Skeleton, SegmentedControl, Tab — 본 챕터에서 인용된 모든 컴포넌트).
- [ ] Tailwind 클래스가 매핑 표에 잔존하지 않음(현재 코드 인용은 제외).
- [ ] `href`/`useRouter().push`/`<Link>`가 매핑 표에 잔존하지 않음 — 모두 `navigation.navigate()`로.
- [ ] `useAuth` 의존이 매핑 표에서 모두 제거됨.
- [ ] presentation 컴포넌트가 API 직접 호출 책임을 갖지 않음(props/콜백 위임 — SRP 유지).
- [ ] `FavoriteButton` 매핑이 멱등 목표값 콜백 시그니처(`onToggle(target: boolean)`)를 그대로 유지.
- [ ] `RecipeDisplay`가 `GeneratedRecipe | Recipe` 공통 필드만 사용(`id` 미참조)을 유지.

## 6.8 SSOT 참조

- `src/components/AGENTS.md` — 현재 컴포넌트 책임/규약
- `src/components/*.tsx`, `src/components/ui/*.tsx` — 매핑 원본
- `src/types/recipe.ts`, `src/types/api.ts` — props 도메인 타입
- [TDS RN 카탈로그](https://tossmini-docs.toss.im/tds-react-native/components/) — TDS 컴포넌트 SSOT
- [TDS RN Typography](https://tossmini-docs.toss.im/tds-react-native/foundation/typography/) — 텍스트 토큰
- [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md) D2 — AuthForm 제외 결정
- [ADR-005](../adr/ADR-005-ownership-violation-404.md) — 404 UI 통일
- [01-FEATURES.md](./01-FEATURES.md) — 컴포넌트와 기능의 연결
- [07-ROUTING.md](./07-ROUTING.md) — `href`/`navigate` 대응 라우트 경로
- [08-STREAMING.md](./08-STREAMING.md) — 생성 화면의 스트리밍 UX

## 6.9 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-22 | 초기 작성 (세션 #4) | 14개 컴포넌트 → TDS RN 1:1 매핑 + AuthForm 제외 명시 |
| 2026-05-24 | §6.4.6 / §6.5 #6 행 갱신 — `Navbar` → `PageNavbar` 대체 (compound API + import 경로 + 핵심 props + Phase 2 실 사용 위치) | Phase 2 baseline §B.2 결정 + ADR-011 D12 — `@toss/tds-react-native@2.0.3` root에 `Navbar` 단일 명칭 부재 확인 후 `PageNavbar`(extensions) 채택. frontend 실 사용(`pages/index.tsx:36-38`, `pages/recipe/generate.tsx:108-110`) 검증 PASS. `ReactNavigationNavbar`는 본 미니앱 Granite 컨텍스트에 부적합으로 기각 |
| 2026-05-24 | §6.5 추가 컴포넌트 표 — NotFoundScreen·EmptyState·RecipeCard 행에 Phase 3 실 구현 시그니처 추가 (props·import 경로·합성 패턴·단일 사용 위치 정책) | Phase 3 baseline §A.2·§B.2·§B.3·§H.2 #13 + ADR-012 D16·D18 — `src/components/{NotFoundScreen,EmptyState,RecipeCard}.tsx` 완료. `NotFoundScreen`은 단일 컴포넌트 정책으로 Phase 4 PATCH/DELETE 404 재사용 보장. `EmptyState`는 props 4종으로 다양 빈 상태 재사용. `RecipeCard`는 저장된 Recipe 한정 `recipe.id` 사용. frontend 실 사용(`pages/recipe/[id].tsx:75`, `pages/my-recipes.tsx:124-130,131-139`) 검증 PASS |
| 2026-05-25 | §6.5 추가 컴포넌트 표 갱신 — FilterTabs/DeleteConfirmDialog/FavoriteButton 실 구현 시그니처 + RecipeCard 행 Phase 4 확장 표기. **ConfirmDialog props 정정** (`confirmText/cancelText/onConfirm/onCancel`은 실재하지 않음 — `leftButton`/`rightButton` ReactElement + `onClose`/`onExited` 필수가 SSOT) | Phase 4 완료(ADR-013 D11·D22·D23) — `src/components/{FilterTabs,DeleteConfirmDialog,FavoriteButton}.tsx` + RecipeCard 확장. TDS 실재성 검증: SegmentedControl·ConfirmDialog 둘 다 실재 PASS. icon name(`icon-star-bold-mono`/`icon-star-mono`)은 토스 CDN 의존이라 dev fallback이 멈춤 트리거 |
| 2026-05-29 | §6.10 Phase 6 신규 컴포넌트 절 추가 — `ThemePicker`(SegmentedControl 2축 합성) + `RecommendationCard`(Pressable + Txt + Badge) + AI 면책 문구 위치 동결 | Phase 6 — ADR-016 D44·D45·D52 동기. TDS 실재성: SegmentedControl·Pressable·Badge·Txt 모두 §6.5에서 이미 검증 PASS. 추천은 ephemeral(id 없음) — dishName URL 파라미터로 generate 화면 재사용 |
| 2026-05-29 | §6.1 색 규약 정합화 — 브랜드 강조색은 **`colors.orange500`(`#FF6B00`)** 사용 명시(brand `#FF6B35` 최근접 실재 토큰). `colors.primary`는 `@toss/tds-colors@0.1.0` **부재**(QA 실증 TS2339) → 사용 금지 명기. 신규 강조색은 hex 대신 brand 최근접 토큰 채택이 ADR-015 D39 hex-금지 정신에 부합 | 하단 탭바(ADR-017 D59) 활성 탭 색 확정에 수반. QA 실증: primary 토큰 비실재, orange500=`#FF6B00` 실재 |
| 2026-05-29 | §6.5 NotFoundScreen 행 정정 — TDS ErrorPage 좌·우 버튼 카피 하드코딩 명시("고객센터 문의" / "닫기"). `onBack`을 `onPressRightButton`("닫기")에 바인딩, `onContactSupport?` prop 추가. title/subtitle prop화로 진입 폴백 _404 카피 분리 | 사용자 보고 "닫기 버튼 무동작" root cause — Phase 3 이래 onBack을 좌측 "고객센터 문의" 버튼에 잘못 바인딩 + 우측 "닫기"는 핸들러 미설정. TDS 실 구현(`node_modules/.../ErrorPage.js`) 검증으로 정정 |
| 2026-05-25 | §6.1 매핑 원칙 — **색상은 TDS `colors` 토큰 사용** 규약 추가 (hex 직접 사용 금지). NutritionPanel에 AI 면책 문구 추가 (`Txt typography="st11" color={colors.grey600}`) | Phase 5 완료(ADR-015 D39·D40) — hex 60+곳을 light 모드 정확 동등치(`colors.white`/`grey100`/`grey700`/`grey900`/`blue500`/`red50`/`red700`/`green50`/`green700`/`grey50`/`grey200`/`grey500`)로 일괄 교체. typecheck/lint PASS. 다크 모드 adaptive 대응(`colorsByPreference`)은 별 ADR로 분리(Phase 6 진화) |
| 2026-06-03 | §6.12 요리 기록 피드 신규 컴포넌트 절 추가 — PhotoPickerButton/StarRatingInput/RecipeSnapshotPicker/CookingLogForm/CookingLogCard/FeedEmptyState + FAB 토큰 규약. **TDS Rating 실재성 정정**(ADR-021 D79): `EditableRating`/`ReadOnlyRating` named export 부재 → 단일 `Rating` 판별 유니온(`readonly` 분기)으로 입력/표시. | 요리 기록 피드 단계(ADR-021). TDS 실재성 검증: `rating/index.d.ts` barrel은 `Rating`만 export(QA 실증 TS2305). FAB은 `colors.orange500`/`white` 토큰(hex 0건) |
