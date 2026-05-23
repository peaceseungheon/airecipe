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
2. **Tailwind 토큰 → TDS 토큰**: 색상(`text-orange-600`, `bg-zinc-100` 등)은 직접 코드값을 옮기지 않고 TDS의 [Typography](https://tossmini-docs.toss.im/tds-react-native/foundation/typography/) 토큰과 어댑티브 컬러 토큰(`adaptive.grey600` 등)을 사용한다. **하드코딩 금지** — 다크 모드·접근성(더 큰 텍스트) 지원이 깨진다.
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

### 6.4.6 `NavBar.tsx` → TDS [`Navbar`](https://tossmini-docs.toss.im/tds-react-native/components/navbar/)

현재 웹의 NavBar는 sticky 상단 헤더 + 로고 + 메뉴 링크 + `useAuth`로 로그인/로그아웃 분기. 미니앱에선 TDS `Navbar`로 대체하되 **`useAuth` 의존을 제거**한다(ADR-009 D2: 미니앱은 `getAnonymousKey()` 자동 식별).

| 현재 요소 | 미니앱 매핑 |
|----------|-------------|
| `<header className="sticky top-0">` | TDS `<Navbar>` (각 화면 상단에 화면별 주입 — Granite는 글로벌 NavBar 대신 화면별 Navbar 사용이 자연스러움) |
| 로고 `<Link href="/">` | `<Navbar.BackButton onPress={() => navigation.canGoBack() && navigation.goBack()} />` (홈 진입은 NavBar 좌측이 보통 뒤로가기) — 홈 화면에선 `left={null}` 또는 닫기 버튼 |
| `title` (앱명) | `<Navbar title="AI 레시피" />` |
| 우측 액션 — "레시피 생성" 링크 | `right={<Navbar.TextButton onPress={() => navigation.navigate('/generate')}>레시피 생성</Navbar.TextButton>}` |
| "마이 레시피" 링크 (로그인 시) | 미니앱은 항상 식별자 보유 → 조건부 분기 없이 항상 표시. 그러나 글로벌 NavBar가 아니라 **탭(하단 탭바) 또는 화면별 Navbar에서 분기 권장** — 07-ROUTING에서 결정 |
| "로그인"/"로그아웃" 버튼 | **제거** (ADR-009 D2) — Toss 식별이 자동이라 로그인/로그아웃 개념 없음 |

> NavBar는 단일 컴포넌트로 옮기지 않고, **각 화면의 layout에서 TDS Navbar를 직접 사용**하는 것이 RN 패턴이다. 본 컴포넌트는 미니앱에선 사실상 **삭제**되고 화면별 Navbar로 분산된다.

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
| 6 | `NavBar` | 글로벌 헤더 | TDS `Navbar`로 화면별 분산 | `useAuth` 제거 |
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

| 새 컴포넌트 | 책임 | TDS 매핑 |
|-------------|------|---------|
| `FilterTabs` (현 my-recipes의 인라인 FilterTab을 추출) | 전체/즐겨찾기 필터 | TDS `SegmentedControl` 또는 `Tab` |
| `DeleteConfirmDialog` | 삭제 확인 다이얼로그 (수용 기준 1.6 AC1) | TDS [`Dialog`](https://tossmini-docs.toss.im/tds-react-native/components/dialog/) (`ConfirmDialog`) |
| `NotFoundScreen` | 404 화면 (ADR-005) | TDS [`ErrorPage`](https://tossmini-docs.toss.im/tds-react-native/components/error-page/) `statusCode={404}` |
| `EmptyState` | 빈 목록 안내 (마이 레시피 0건) | `View` + `Txt` + `Button`(생성하러 가기) |

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
