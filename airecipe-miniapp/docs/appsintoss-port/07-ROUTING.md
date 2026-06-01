# 07. 라우팅 매핑 — Next App Router ↔ Granite 라우팅

> **이 챕터 전에 알아야 할 것**: [00-OVERVIEW.md](./00-OVERVIEW.md), [01-FEATURES.md](./01-FEATURES.md), [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md), [05-AUTH.md](./05-AUTH.md)(인증 헤더).
>
> **이 챕터 완료 후 다음 챕터**: [08-STREAMING.md](./08-STREAMING.md) — SSE → fetch stream.

---

## 7.0 이 챕터의 목적

현재 웹의 7개 화면(`src/app/**/page.tsx`)을 신규 RN 미니앱(Granite >= 1.0)의 **파일 기반 라우팅**(`pages/`)으로 매핑한다. Granite는 내부적으로 [React Navigation](https://reactnavigation.org/) 위에 동작하며, `@granite-js/react-native`의 `createRoute`/`useNavigation`/`Route.useParams`을 표준 API로 사용한다.

| 항목 | SSOT |
|------|------|
| 현재 페이지 파일 | `src/app/**/page.tsx`, `src/app/layout.tsx` |
| 현재 인증 가드 | `src/proxy.ts`, `src/lib/supabase/middleware.ts` |
| Granite 라우팅 문서 | https://developers-apps-in-toss.toss.im/development/routing |
| 본 챕터의 매핑 대상 | 5개 화면 (AuthForm 페이지 2개 제외, layout은 Granite 메커니즘으로 흡수) |

## 7.1 현재 화면 인벤토리 (`src/app/`)

| 현재 경로 (URL) | 파일 | 보호 여부 | 미니앱 매핑? |
|----------------|------|-----------|--------------|
| `/` | `src/app/page.tsx` | 공개 | ✅ |
| `/recipe/generate` | `src/app/recipe/generate/page.tsx` | 공개(생성 API는 공개) | ✅ |
| `/my-recipes` | `src/app/my-recipes/page.tsx` | 보호 | ✅ |
| `/recipe/[id]` | `src/app/recipe/[id]/page.tsx` | 보호 | ✅ |
| `/auth/login` | `src/app/auth/login/page.tsx` | 공개 | ❌ **제외** (ADR-009 D2) |
| `/auth/signup` | `src/app/auth/signup/page.tsx` | 공개 | ❌ **제외** (ADR-009 D2) |
| (layout) | `src/app/layout.tsx` (NavBar + main + footer) | - | Granite 메커니즘으로 흡수 |

> **총 7개 → 매핑 5개**. layout은 Granite의 화면별 Navbar(06-UI-MAPPING 6.4.6) + 루트 진입점으로 분산되어 단일 layout 파일이 필요 없다.

## 7.2 Granite 라우팅 원칙 (선결)

Granite >= 1.0 라우팅의 핵심(공식 문서 인용):

1. **파일 기반 라우팅**: 미니앱 저장소의 `pages/` 디렉토리에 파일을 두면 라우트로 자동 등록된다. 예: `pages/about.tsx` → `/about`.
2. **`createRoute('/path', { component, validateParams })`**: 각 페이지가 자신의 `Route`를 export한다. `validateParams`로 params를 타입 안전 검증.
3. **`useNavigation()`**: 화면 이동(`navigation.navigate('/path', params)`), 뒤로(`navigation.goBack()`), `canGoBack()`, `dispatch(CommonActions.reset(...))`.
4. **`Route.useParams()`** 또는 **`useParams({ from: '/path' })`**: 라우트 파라미터를 타입 안전하게 읽는다.
5. **`src/router.gen.ts`** 자동 생성: 개발 모드에서 `pages/` 변경 감지 → 타입 정의 자동 생성. 수동 수정 금지.
6. **공통 wrapper(루트 layout 대응)**: Granite의 진입점(예: `App.tsx`/`granite.config.ts`)에서 글로벌 Provider(`@toss/tds-react-native`의 ThemeProvider, useOverlay context, SWR Provider 등)를 wrapping. **각 화면이 자신의 Navbar를 그린다** (글로벌 NavBar 대신).

## 7.3 화면 매핑 (5개)

### 7.3.1 홈 — `/` → `pages/index.tsx`

| 항목 | 현재 웹 | 미니앱 |
|------|---------|--------|
| 경로 | `/` | `/` (`pages/index.tsx`) |
| 진입 보호 | 공개 | 공개 |
| 핵심 UI | SearchForm + 로그인 사용자에 RecentRecipes(미리보기 6개) | SearchForm + **항상** RecentRecipes (미니앱은 항상 식별자 보유) |
| 진입 시 액션 | 없음 | **`getAnonymousKey()` 호출 → SecureStore/메모리 저장** (05-AUTH 2.1). 이미 저장됐으면 재호출 안 함 |
| 검색 제출 | `router.push('/recipe/generate?dishName=...&servings=...')` | `navigation.navigate('/recipe/generate', { dishName, servings })` |
| 로그인 유도 박스 | 비로그인 시 표시 | **삭제** (로그인 개념 없음) |
| 데이터 페칭 | `useMyRecipes({ pageSize: 6 })` | 동일 (RN 포팅) |

```tsx
// pages/index.tsx (예시 스케치)
import { createRoute, useNavigation } from '@granite-js/react-native';
import { useEffect } from 'react';
import { ensureAnonymousKey } from '@/lib/auth/anonymous-key';
import { SearchForm } from '@/components/SearchForm';
import { RecentRecipes } from '@/components/RecentRecipes'; // 분리 추출

export const Route = createRoute('/', {
  validateParams: (p) => p as Record<string, never>,
  component: HomePage,
});

function HomePage() {
  const navigation = useNavigation();

  useEffect(() => { ensureAnonymousKey(); }, []); // 05-AUTH 2.1

  const handleSearch = (dishName: string, servings: number) => {
    navigation.navigate('/recipe/generate', { dishName, servings });
  };

  return (
    <>
      <Navbar title="AI 레시피" />
      <ScrollView>
        <SearchForm onSubmit={handleSearch} submitLabel="레시피 만들기" />
        <RecentRecipes />
      </ScrollView>
    </>
  );
}
```

### 7.3.2 레시피 생성 — `/recipe/generate` → `pages/recipe/generate.tsx`

| 항목 | 현재 웹 | 미니앱 |
|------|---------|--------|
| 경로 | `/recipe/generate` | `/recipe/generate` (`pages/recipe/generate.tsx`) |
| 진입 보호 | 공개(생성 API는 공개) | 공개 (보호 가드 미적용) |
| 핵심 UI | SearchForm + 스트리밍 진행 + RecipeDisplay + 저장 버튼 | 동일 |
| 진입 시 쿼리 | `searchParams.get("dishName")`, `searchParams.get("servings")` | `Route.useParams()` → `{ dishName?: string, servings?: number }`. **초기값 있으면 자동 1회 생성** (현재 useEffect와 동일) |
| Suspense 처리 | `useSearchParams` 때문에 Suspense | RN은 Suspense 불필요 — params는 동기 |
| 스트리밍 | useRecipeGenerate(SSE) | useRecipeGenerate(fetch stream — 08-STREAMING) |
| 저장 액션 | `useMyRecipes.save` → `router.push('/recipe/[id]')` | 동일 — `navigation.navigate('/recipe/[id]', { id: saved.id })` |
| 비로그인 저장 안내 | 비로그인 시 "로그인하고 저장" 링크 | **삭제** — 미니앱은 항상 저장 가능 (`X-Toss-User-Id` 보유) |

```tsx
// pages/recipe/generate.tsx (스케치)
export const Route = createRoute('/recipe/generate', {
  validateParams: (p) => p as { dishName?: string; servings?: number },
  component: GeneratePage,
});

function GeneratePage() {
  const { dishName, servings } = Route.useParams();
  const navigation = useNavigation();
  const { status, progressText, recipe, error, generate } = useRecipeGenerate();
  const { save } = useMyRecipes();

  useEffect(() => {
    if (dishName) generate({ dishName, servings: servings ?? 2, stream: true });
  }, []);

  const handleSave = async () => {
    const saved = await save(recipe!);
    navigation.navigate('/recipe/[id]', { id: saved.id });
  };
  // ... SearchForm + 스트리밍 표시 + RecipeDisplay + 저장 버튼
}
```

### 7.3.3 마이 레시피 — `/my-recipes` → `pages/my-recipes.tsx`

| 항목 | 현재 웹 | 미니앱 |
|------|---------|--------|
| 경로 | `/my-recipes` | `/my-recipes` (`pages/my-recipes.tsx`) |
| 진입 보호 | 보호 (proxy.ts → /auth/login 리다이렉트) | **진입 시 식별자 보장** (7.5 가드) |
| 핵심 UI | 필터 토글 + RecipeCard 그리드 + 빈 상태 + 로딩 + 에러 | 동일 (TDS로 매핑) |
| 필터 토글 | 인라인 FilterTab 컴포넌트 | TDS `SegmentedControl` 또는 `Tab` |
| 카드 → 상세 | `<Link href="/recipe/[id]">` | `Pressable onPress={() => navigation.navigate('/recipe/[id]', { id })}` |
| 빈 상태 → 생성 | `<Link href="/recipe/generate">` | `<Button onPress={() => navigation.navigate('/recipe/generate', {})}>` |
| 데이터 페칭 | `useMyRecipes({ favorite, pageSize: 50 })` | 동일 |

### 7.3.4 레시피 상세 — `/recipe/[id]` → `pages/recipe/[id].tsx`

| 항목 | 현재 웹 | 미니앱 |
|------|---------|--------|
| 경로 | `/recipe/[id]` | `/recipe/[id]` (`pages/recipe/[id].tsx`) |
| 진입 보호 | 보호 (proxy.ts) | **진입 시 식별자 보장** (7.5 가드) |
| 핵심 UI | 로딩 → 404 분기 → RecipeDisplay + Favorite + 삭제 | 동일 |
| Params 읽기 | `use(params)` (Next 16) → `{ id }` | `Route.useParams()` → `{ id: string }` |
| 404 정책(ADR-005) | `useRecipe.notFound` → "레시피를 찾을 수 없습니다" | 동일. TDS [`ErrorPage`](https://tossmini-docs.toss.im/tds-react-native/components/error-page/) `statusCode={404}` 사용 권장 |
| 삭제 후 이동 | `router.push('/my-recipes')` | `navigation.navigate('/my-recipes', {})` (또는 `navigation.goBack()` 후 mutate) |
| 즐겨찾기/삭제 | `useRecipe.setFavorite/remove` | 동일 (멱등 목표값) |

```tsx
// pages/recipe/[id].tsx
export const Route = createRoute('/recipe/[id]', {
  validateParams: (p) => p as { id: string },
  component: RecipeDetailPage,
});

function RecipeDetailPage() {
  const { id } = Route.useParams();
  const navigation = useNavigation();
  const { recipe, isLoading, notFound, error, setFavorite, remove } = useRecipe(id);
  // ... 로딩 / 404 / 에러 / 정상 분기
}
```

### 7.3.6 테마 추천 — `/recipe/recommend` → `pages/recipe/recommend.tsx` (Phase 6, ADR-016 D49)

| 항목 | 미니앱 |
|------|--------|
| 경로 | `/recipe/recommend` (`pages/recipe/recommend.tsx`) |
| 진입 보호 | **진입 시 식별자 보장** (D47 — 보호 엔드포인트) |
| 핵심 UI | ThemePicker 2축 → "추천받기" Button → useRecommendations → RecommendationCard × 5 → AI 면책 1줄 |
| Params 읽기 | URL 파라미터 없음 (홈 CTA에서 진입) |
| 진입점 | 홈 `pages/index.tsx`에 "오늘의 추천 받기" Button 1개 (D50). 마이 목록은 미적용(시각 부담·광고 중복 회피) |
| 카드 탭 → 생성 | `navigation.navigate('/recipe/generate', { dishName: item.dishName })` — 기존 SearchForm `initialDishName` 재사용(Phase 2부터 지원) |
| 재추천 | ThemePicker 변경 시 자동 재호출(이전 in-flight abort) + 별도 "다시 받기" Button(D51). 캐시는 메모리 테마 hash key |

```tsx
// pages/recipe/recommend.tsx
export const Route = createRoute('/recipe/recommend', {
  validateParams: (p) => p as Record<string, never>,
  component: RecommendPage,
});

function RecommendPage() {
  const navigation = useNavigation();
  const [theme, setTheme] = useState<RecommendationTheme>({});
  const { items, isLoading, error, refresh } = useRecommendations(theme);

  // ... ThemePicker / "추천받기" Button (테마 미선택 시 disabled) / 분기 렌더
  // 카드 탭:
  //   onPress: () => navigation.navigate('/recipe/generate', { dishName: item.dishName })
  // 하단 AI 면책:
  //   <Txt typography="st11" color={colors.grey600}>AI가 생성한 참고용 추천이에요...</Txt>
}
```

> **이름 선택 사유 (D49)**: `/recipe/recommend`는 기존 `/recipe/*` 그룹과 일관성 유지. `/recommendations`(최상위 그룹 부담)·`/recipe/recommendations`(URL 길이) 기각.

### 7.3.5 layout (현재 `src/app/layout.tsx`) — **Granite 메커니즘으로 흡수**

| 현재 layout 요소 | 미니앱 처리 |
|-----------------|-------------|
| `<html lang="ko">` | RN은 HTML 없음 — 무관 |
| `<body>` 글로벌 폰트/배경 | RN의 글로벌 스타일은 `App.tsx` 또는 `granite.config.ts`에서 TDS ThemeProvider/SafeAreaProvider 등으로 wrap |
| `<NavBar />` 글로벌 | **각 화면이 화면별 TDS `Navbar` 직접 렌더** (06-UI-MAPPING 6.4.6). 글로벌 NavBar 없음 |
| `<main>` 컨테이너 | 화면별 `ScrollView`/`View`로 분산 |
| `<footer>` "AI 레시피 · Sprint 1" | **제거** (미니앱에 footer는 부자연스럽고, Toss 미니앱 가이드는 자체 footer 권장하지 않음) |
| `<Suspense>` (generate 페이지) | RN은 Suspense 불필요 |

> Granite의 진입점(예: `App.tsx`)에서 다음 wrapping이 권장됨:
>
> ```tsx
> <TdsThemeProvider>
>   <SWRConfig value={{ /* ... */ }}>
>     <RootNavigator />  {/* Granite가 pages/를 자동 등록 */}
>   </SWRConfig>
> </TdsThemeProvider>
> ```

## 7.4 라우트 매핑 요약표

| # | 현재 경로 | 현재 파일 | 미니앱 경로 | 미니앱 파일 | 보호 |
|---|----------|----------|------------|-------------|------|
| 1 | `/` | `src/app/page.tsx` | `/` | `pages/index.tsx` | 공개 |
| 2 | `/recipe/generate` | `src/app/recipe/generate/page.tsx` | `/recipe/generate` | `pages/recipe/generate.tsx` | 공개 |
| 3 | `/my-recipes` | `src/app/my-recipes/page.tsx` | `/my-recipes` | `pages/my-recipes.tsx` | 식별자 보장 |
| 4 | `/recipe/[id]` | `src/app/recipe/[id]/page.tsx` | `/recipe/[id]` | `pages/recipe/[id].tsx` | 식별자 보장 |
| 5 | — (신규, Phase 6) | — | `/recipe/recommend` | `pages/recipe/recommend.tsx` | 식별자 보장 |
| - | `/auth/login` | `src/app/auth/login/page.tsx` | — | **제외** | — |
| - | `/auth/signup` | `src/app/auth/signup/page.tsx` | — | **제외** | — |
| - | (layout) | `src/app/layout.tsx` | — | Granite ThemeProvider + 화면별 Navbar | — |

> **이름 일관성**: Granite의 동적 세그먼트 표기는 React Navigation을 따라 본 챕터에서 `[id]`로 표기했다 (Granite 공식 예제는 단순 경로 위주이며 동적 세그먼트의 구체 syntax는 미니앱 LLM이 `@granite-js/react-native` 최신 문서로 확정). `validateParams: (p) => p as { id: string }`로 타입은 보장.

## 7.5 인증 보호 게이트 — `proxy.ts` 대체

### 7.5.1 현재 웹의 가드 (proxy.ts → updateSession)

```ts
// src/lib/supabase/middleware.ts
const PROTECTED_PREFIXES = ["/my-recipes", "/recipe/"];
const PUBLIC_EXCEPTIONS  = ["/recipe/generate"];

// 세션 검증 → 미인증 + 보호경로면 /auth/login으로 redirect
```

웹은 매 요청마다 Supabase 쿠키 세션을 갱신하고, 쿠키가 없는 사용자는 `/auth/login`으로 리다이렉트한다.

### 7.5.2 미니앱의 가드 (식별자 보장 패턴)

미니앱은 **proxy.ts 없음**. 대신:

1. **앱 진입 시 1회 식별자 보장**: 루트 진입점(`App.tsx`)에서 `ensureAnonymousKey()` 호출 → SecureStore 또는 메모리에 저장. 실패 시 에러 화면.
2. **보호 화면 진입 가드**: `/my-recipes`, `/recipe/[id]` 컴포넌트의 최상단에서 `useTossUserId()` 훅으로 식별자 존재를 확인 → 없으면 재발급 시도 → 그래도 없으면 ErrorPage(503/오프라인).
3. **redirect 화면 없음**: 미니앱에 `/auth/login` 화면이 없으므로 리다이렉트할 대상이 없다. 식별자 확보 실패는 인라인 에러 또는 ErrorPage로 노출하고 사용자에게 재시도 버튼 제공.

```tsx
// src/hooks/useTossUserId.ts (가칭, 05-AUTH 2.1)
import { useEffect, useState } from 'react';
import { getAnonymousKey } from '@apps-in-toss/web-framework';

export function useTossUserId() {
  const [tossUserId, setTossUserId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const key = await Promise.resolve(getAnonymousKey()); // SDK API에 따라 sync/async
        if (mounted) setTossUserId(key);
      } catch (e) {
        if (mounted) setError(e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return { tossUserId, error };
}
```

> 정확한 `getAnonymousKey` 시그니처(sync/async)는 05-AUTH 2.1을 따른다. 본 챕터는 라우팅 가드 패턴만 정의한다.

### 7.5.2.1 `X-Toss-User-Id` 헤더 송출 — `api-client` 단일 인터셉트 (SRP)

backend 결정 #13에 따라 헤더 첨부 로직은 **api-client 한 곳**에 둔다(SRP). 각 훅·페이지가 직접 헤더를 손대지 않는다.

```ts
// src/hooks/api-client.ts (미니앱 버전)
import { getStoredTossUserId, refreshTossUserId } from '@/lib/auth/toss-user';

export async function authFetch(input: string, init?: RequestInit) {
  const tossUserId = await getStoredTossUserId();   // SecureStore 또는 메모리
  const headers = {
    'Content-Type': 'application/json',
    ...(tossUserId ? { 'X-Toss-User-Id': tossUserId } : {}),
    ...init?.headers,
  };
  let res = await fetch(input, { ...init, headers });

  // 401 → 1회 재시도 (backend 결정 #2)
  if (res.status === 401) {
    const fresh = await refreshTossUserId();
    if (fresh) {
      res = await fetch(input, {
        ...init,
        headers: { ...headers, 'X-Toss-User-Id': fresh },
      });
    }
  }
  return res;
}
```

장점:
- `useMyRecipes`, `useRecipe`, `useRecipeGenerate`가 헤더 코드를 중복하지 않는다.
- 401 재시도 정책이 한 곳에서 강제된다 — 누락 위험 0.
- 향후 헤더 추가(예: `X-Client-Version`, `X-Request-Id`)도 단일 위치 수정.

### 7.5.3 가드 적용 표

| 미니앱 화면 | 가드 패턴 | 실패 시 |
|-------------|---------|--------|
| `/` | 가드 없음. 진입 시 `ensureAnonymousKey` 호출(논블로킹) | 식별자 미확보 시 RecentRecipes만 숨김 |
| `/recipe/generate` | 가드 없음(공개 API) | 동일 |
| `/my-recipes` | 식별자 필수 — `useTossUserId` → 없으면 `ErrorPage statusCode={503}` "다시 시도" | ErrorPage |
| `/recipe/[id]` | 식별자 필수 + 404 통일(ADR-005) | 식별자 없음 → ErrorPage; 식별자 있고 API 404 → "레시피를 찾을 수 없습니다" |

> **요점**: 웹의 prefix-기반 가드 → 미니앱은 **식별자 보유 여부 단일 조건**으로 단순화. 식별자가 항상 보장되므로(`getAnonymousKey`는 비게임 미니앱에서 즉시 반환) 실제 가드 실패는 거의 발생하지 않는다.

### 7.5.4 데이터 소비 규약 (api-client 단일 위치 강제, backend 결정 #4·#8·#9·#11·#14)

훅/페이지가 응답을 다룰 때 따라야 할 규약. **위반 시 런타임 불일치의 주범** — api-client(`requestData`/`requestList`)가 한 곳에서 강제하고, 호출부는 unwrap된 도메인 타입만 본다.

| # | 규약 | 강제 위치 | 위반 시 |
|---|------|---------|--------|
| #4a | **응답 `{ data, meta? }` unwrap**: 단건은 `.data`, 목록은 `.data`/`.meta`. 배열 직접 반환 없음. | `requestData<T>` / `requestList<T>` (`src/hooks/api-client.ts`) | 도메인 객체가 `{data: ...}` shape으로 새서 UI에서 `recipe.dishName` undefined |
| #4b | **camelCase 강제**: 응답에 snake_case가 새면 Mapper 버그. `userId` 키는 응답에 없음(ADR-001 매핑 표). | 동일 (`api-client`) + 컴포넌트 타입 (`@/types/recipe`·`api`) | TypeScript가 컴파일 단계에서 차단; 런타임 새면 즉시 에러 보고 |
| #8 | **`pageSize` clamp**: `?pageSize=100` 보내도 백엔드가 50으로 clamp 후 200 응답(ADR-006, 03 §3.3.2). 미니앱은 **요청값이 아니라 `meta.pageSize`를 신뢰**. | `useMyRecipes` 페이징 계산 | "1/5 페이지" 계산이 어긋남 |
| #9 | **`favorite` 쿼리는 문자열 `"true"`/`"false"` 만**: boolean을 URLSearchParams에 직접 넣으면 `[object]`로 직렬화될 위험. 그 외 값은 400. | `useMyRecipes` 키 빌더 (`buildListKey`) | 400 — 사용자에게 빈 목록 또는 에러 |
| #11 | **DELETE 응답은 `{ data: { id } }`** (204 아님). 캐시 무효화에 id 사용. | `useMyRecipes.remove` / `useRecipe.remove` | 응답 파싱 실패 또는 무효화 키 누락 |
| #14 | **AI SDK 설치 금지**: 미니앱 저장소 `package.json`에 `@anthropic-ai/sdk`·`@google/genai`·`@google/generative-ai` 등록 금지. AI는 백엔드 전용. (04 §4.8) | CI: dependency 화이트리스트 + `package.json` 검사 lint | 키 노출 위험·번들 비대 — 빌드 차단 |

미니앱 저장소에서 따라야 할 패턴:

```ts
// 올바름 ✅ — api-client가 unwrap, 호출부는 도메인 타입만
const recipes: Recipe[] = (await requestList<Recipe>('/api/recipes?favorite=true')).data;

// 잘못됨 ❌ — 제네릭 캐스팅으로 unwrap 우회 시 런타임 폭발
const recipes = await fetch('/api/recipes').then(r => r.json()) as Recipe[];
// 실제 shape은 { data: Recipe[], meta }임 — recipes는 undefined 접근 시 throw

// favorite 쿼리 ✅
params.set('favorite', favoriteOnly ? 'true' : 'false');

// favorite 쿼리 ❌ — boolean 직접 주입
params.set('favorite', favoriteOnly as any);  // → "[object]" → 400
```

## 7.6 딥링크 (`intoss://` 스킴)

### 7.6.1 딥링크 형식

AppsInToss는 `intoss://<appName>/path?param=value` 형식의 딥링크를 지원한다(출처: `docs/공유/getTossShareLink.md`).

- 예: `intoss://ai-recipe/recipe/abc-uuid` → 미니앱의 `/recipe/[id]` 화면을 `id=abc-uuid`로 진입.
- 외부 공유 시 토스 앱이 설치되어 있으면 미니앱으로, 없으면 앱스토어로 이동.

### 7.6.2 본 미니앱의 딥링크 진입점 (2개)

| 딥링크 | 매핑 화면 | 용도 |
|--------|----------|------|
| `intoss://<appName>/` | `/` (홈) | 앱 첫 진입 |
| `intoss://<appName>/recipe/[id]` | `/recipe/[id]` | 레시피 상세 공유 |

> 외부에서 `/recipe/generate?dishName=...`로 진입시키는 딥링크는 v1 범위 외(Toss 외부 공유 시나리오가 없음). 향후 확장.

### 7.6.3 초기 진입 스킴 읽기

```ts
import { getSchemeUri } from '@apps-in-toss/framework';

// 첫 화면에서 진입 스킴 확인 (페이지 이동으로 인한 변경은 반영 안 됨)
const initialScheme = getSchemeUri();
```

> Granite의 파일 기반 라우팅 + React Navigation linking 설정으로 자동 파싱되므로, **명시적 `getSchemeUri` 호출은 분석/로깅용으로만 사용**한다. 라우팅 자체는 자동.

### 7.6.4 `getTossShareLink` (공유 링크 생성)

레시피 상세에서 "공유" 버튼을 추가할 경우(v1 범위 외, 향후):

```ts
import { getTossShareLink } from '@apps-in-toss/web-framework';

const url = getTossShareLink({
  path: `/recipe/${recipe.id}`,
  ogImageUrl: '...', // 옵션
});
// → intoss://<appName>/recipe/<id> 변환된 URL
```

## 7.7 뒤로가기 & 하드웨어 백

### 7.7.1 패턴 매핑

| 시나리오 | 현재 웹 | 미니앱 |
|----------|---------|--------|
| 헤더 좌측 뒤로 | (NavBar에 없음 — 브라우저 뒤로가기) | TDS `<Navbar.BackButton onPress={() => navigation.goBack()} />` |
| 닫기 | 없음 | TDS `<Navbar.CloseButton />` (필요 시) |
| Android 하드웨어 백 | 브라우저 처리 | Granite [`useBackEvent`](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면) 훅으로 화면별 처리 |
| 저장 직후 이동 | `router.push('/recipe/[id]')` (replace 아님) | `navigation.navigate('/recipe/[id]', { id })` — 단순 push. 생성 화면으로 돌아가지 않게 하려면 `CommonActions.reset` 사용 |
| 삭제 후 마이로 | `router.push('/my-recipes')` | `navigation.goBack()`(스택 위에 마이가 있을 때) 또는 `navigation.navigate('/my-recipes', {})` 후 mutate |

### 7.7.2 useBackEvent 적용 예 (생성 화면)

스트리밍 중 사용자가 백 버튼을 누르면 `AbortController.abort()` 호출 후 이동(08-STREAMING).

```tsx
import { useBackEvent } from '@apps-in-toss/framework';

function GeneratePage() {
  const { status, cancel } = useRecipeGenerate();
  const back = useBackEvent();

  useEffect(() => {
    const handler = () => {
      if (status === 'streaming') {
        cancel();
        return true; // 처리됨 — 시스템 백 막음
      }
      return false; // 기본 백 동작 허용
    };
    back.addEventListener('hardwareBackPress', handler);
    return () => back.removeEventListener('hardwareBackPress', handler);
  }, [status, cancel, back]);
}
```

> 정확한 `useBackEvent` API 시그니처는 [Granite 공식 문서](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면)에서 최종 확인. 본 챕터는 패턴만 정의.

## 7.8 NavBar 분산 결정

현재 웹의 글로벌 NavBar(로고/생성/마이/로그인)는 미니앱에서 **글로벌이 아니라 화면별 TDS Navbar**로 분산된다.

| 미니앱 화면 | Navbar 구성 |
|-------------|-------------|
| `/` (홈) | `<Navbar title="AI 레시피" right={<Navbar.TextButton onPress={() => navigation.navigate('/my-recipes', {})}>마이</Navbar.TextButton>} />` |
| `/recipe/generate` | `<Navbar left={<Navbar.BackButton onPress={navigation.goBack} />} title="레시피 생성" />` |
| `/my-recipes` | `<Navbar left={<Navbar.BackButton onPress={navigation.goBack} />} title="마이 레시피" />` |
| `/recipe/[id]` | `<Navbar left={<Navbar.BackButton onPress={navigation.goBack} />} title={recipe?.dishName ?? "레시피"} />` |
| `/recipe/recommend` (Phase 6) | `<Navbar left={<Navbar.BackButton onPress={navigation.goBack} />} title="오늘의 추천" />` |

**하단 탭바 대안**: 홈/마이만으로 구성된 단순 미니앱이므로 v1은 탭바 없이 **스택 네비게이션**만으로 충분. 향후 화면 수가 늘면 하단 탭 도입 검토. → **이 검토가 §7.8.1로 실행됨 (ADR-017).**

### 7.8.1 하단 탭바 도입 — 커스텀 고정 하단 바 (ADR-017, D53~D62)

사용자 요청("내 레시피 목록 탭")에 따라 [홈 `/`][마이 레시피 `/my-recipes`] 2탭 **하단 탭바**를 도입한다. Granite/TDS 실증 검증 결과를 ADR-017이 동결했다.

**실증 결론(코드 근거):**
- Granite는 하단 탭 네비게이터를 **1급 지원하지 않는다**. `@granite-js/react-native@1.0.28`의 export(`dist/index.d.ts`)에 탭 네비게이터 부재, `Router`는 항상 `StackNavigator`(NativeStack)만 마운트(`src/router/Router.tsx:203`), `createRoute.screenOptions`는 `NativeStackNavigationOptions`만 수용(`dist/router/createRoute.d.ts`). `_layout` 예약어는 자식 스크린 전환 네비게이터가 아니라 래퍼 FC(`mergeParentLayoutScreen`).
- `@react-navigation/bottom-tabs`는 미설치(`package.json`/lock 0건)이며 루트 네비게이터 주입 슬롯도 없다.
- TDS에는 하단 탭바 전용 컴포넌트가 없다. `Tab`(상단 세그먼트)·`tab-view Tabs`(스와이프 콘텐츠)는 용도가 다름. → **TDS 프리미티브(`Txt`/`colors`/선택적 `Icon`) + RN `Pressable`/`View`로 합성.**

**채택(C — 커스텀 고정 하단 탭바):** NativeStack 위에 `BottomTabBar` 단일 컴포넌트를 두고, **각 화면이 직접 마운트**한다. 탭 누름 → `navigation.navigate(path, {})`. **새 라우트·router.gen.ts 변경 0개.**

> ⚠️ **노출 범위 전 화면 확대 (ADR-017 D63, 2026-05-30 — D56 대체):** 사용자 요청("모든 화면 노출")으로 비-탭 화면(생성/추천/상세/_404)에도 탭바를 마운트한다. 비-탭 화면은 `active="none"`(활성 탭 없음 센티넬 — 두 탭 모두 비활성색 `grey500`·`selected:false`). early-return 분기(식별자 가드·404)에도 마운트. `BottomTabBarProps.active`는 `'home'|'my'|'none'`. 아래 표는 D63 반영본이다.

| 화면 | 하단 탭바 (D63) | 상단 Navbar |
|------|----------------|-------------|
| `/` (홈) | `<BottomTabBar active="home" />` | `PageNavbar` Title만 (AccessoryTextButton "마이 레시피" **제거** — D58) |
| `/my-recipes` (마이) | `<BottomTabBar active="my" />` (식별자 가드 분기 + 정상 분기) | `PageNavbar` BackButton + "마이 레시피" |
| `/recipe/generate` | `<BottomTabBar active="none" />` (정상 분기 — ScrollView 형제) | 기존 유지 |
| `/recipe/recommend` | `<BottomTabBar active="none" />` (식별자 가드 + 정상 분기) | 기존 유지 |
| `/recipe/[id]` | `<BottomTabBar active="none" />` (식별자 가드 + 404 분기 + 정상 분기) | 기존 유지 |
| `/_404` | `<BottomTabBar active="none" />` (`View` 래퍼로 `NotFoundScreen`과 형제) | `NotFoundScreen`(ErrorPage) |

> 비-탭 화면은 push로 진입했으므로 탭 누름 시 `navigate`는 탭 루트로 **재포커스(pop-to)**한다 — 스택을 깊게 만들지 않음(D63d, D55 불변).

**활성 색** = TDS `colors.orange500`(`#FF6B00`, brand `#FF6B35` 최근접 실재 토큰 — D59), 비활성 = `colors.grey500`. ⚠️ `colors.primary`는 `@toss/tds-colors@0.1.0`에 **부재**(TS2339)라 사용 불가(§3.3). hex 직접 사용 금지(ADR-015 D39). 아이콘은 `Icon.name`이 자유 문자열이라 실재 검증 시에만 추가, 미검증 시 라벨 only(D60). 하단 SafeArea 패딩 + ScrollView `paddingBottom` 확보(D61).

> ✅ **appName 정정(2026-06-01, ADR-017 D62 폐기)**: `granite.config.ts` `appName`의 정본은 **`airecipe`**다 — 앱인토스 콘솔 등록명과 1:1(커밋 `c491ac6` "콘솔 앱이름으로 수정"). ADR-017 D62가 `'airecipe-miniapp'`로 원복하라고 한 것은 콘솔 deep link prefix를 오판한 잘못된 지시이며, `c491ac6` + 사용자 확정으로 **폐기**됐다. **appName을 `airecipe-miniapp`으로 바꾸지 말 것.** 콘솔 등록 deep link prefix ↔ `appName` 1:1 동기는 출시 전 검증 의무.

## 7.9 검증 절차 (QA가 확인할 항목)

- [ ] 7개 현재 화면 인벤토리 → 미니앱 매핑 5개 + 제외 2개(auth/*) 명시.
- [ ] 모든 미니앱 라우트가 `pages/<file>.tsx` 위치와 일치.
- [ ] `next/link`/`useRouter`/`href` 코드 흔적이 매핑 표에서 모두 `navigation.navigate`로 변환됨.
- [ ] proxy.ts 가드(`PROTECTED_PREFIXES`)가 미니앱에서는 식별자 보유 단일 조건으로 단순화되었고, 보호 화면 2개(`/my-recipes`, `/recipe/[id]`)에 가드 적용 표가 존재.
- [ ] 404 통일(ADR-005)이 본 챕터 7.3.4에 반영됨.
- [ ] 딥링크 형식(`intoss://<appName>/recipe/[id]`)이 09-ENV-CONFIG의 appName 결정과 정합. (09 작성 후 교차 확인)
- [ ] 하드웨어 백 + AbortController 연계 패턴이 8장과 정합. (08 작성 후 교차 확인)
- [ ] layout.tsx 흡수 방식(글로벌 NavBar 제거, 화면별 Navbar)이 06-UI-MAPPING 6.4.6과 일치.

## 7.10 SSOT 참조

- `src/app/page.tsx`, `src/app/my-recipes/page.tsx`, `src/app/recipe/generate/page.tsx`, `src/app/recipe/[id]/page.tsx` — 현재 화면 SSOT
- `src/app/layout.tsx` — 글로벌 layout
- `src/proxy.ts`, `src/lib/supabase/middleware.ts` — 현재 가드 (미니앱 매핑 대상)
- [Granite 라우팅 문서](https://developers-apps-in-toss.toss.im/development/routing) — `createRoute`, `useNavigation`, `Route.useParams`
- [Granite 뒤로가기 useBackEvent](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면) — 하드웨어 백 훅
- [Granite getTossShareLink](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/공유/getTossShareLink.md) — 딥링크 형식
- [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md) D2 — auth/* 제외 및 proxy 미적용
- [ADR-005](../adr/ADR-005-ownership-violation-404.md) — 404 통일
- [ADR-007](../adr/ADR-007-proxy-file-convention.md) — 현재 proxy 컨벤션 (미니앱 적용 안 함)
- [05-AUTH.md](./05-AUTH.md) — `getAnonymousKey`/`X-Toss-User-Id` 식별 흐름
- [06-UI-MAPPING.md](./06-UI-MAPPING.md) — Navbar/Pressable 등 TDS 매핑
- [08-STREAMING.md](./08-STREAMING.md) — 생성 화면의 AbortController·hardware back 연계

## 7.11 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-22 | 초기 작성 (세션 #4) | App Router 7화면 → Granite 5화면 매핑 + proxy 가드 식별자 단일 조건으로 단순화 + 딥링크/백버튼 |
| 2026-05-29 | §7.8.1 신설 — 하단 탭바([홈/마이 레시피]) 도입. Granite/TDS 실증 검증(탭 네비게이터 1급 부재 → 커스텀 고정 하단 바 채택) + 홈 AccessoryTextButton 제거 + appName 회귀 동시 수정 명시. ADR-017 D53~D62. | 사용자 요청(마이 레시피 탭) — §7.8 "향후 검토"의 실행 |
| 2026-05-30 | §7.8.1 노출 범위 표 갱신 — **전 화면 확대(ADR-017 D63, D56 대체).** 비-탭 화면(생성/추천/상세/_404)에도 `<BottomTabBar active="none" />` 마운트, early-return 분기 포함, `active:'home'\|'my'\|'none'`. D55 재포커스 불변 명시. | 사용자 요청("모든 화면 노출") |
