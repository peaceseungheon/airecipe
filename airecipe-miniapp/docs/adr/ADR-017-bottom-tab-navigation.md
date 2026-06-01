# ADR-017 — 하단 탭바([홈 / 마이 레시피]) 도입: 커스텀 고정 하단 바 채택

> 전방 참조(2026-05-30): 본문이 인용하는 `src/pages/{index,my-recipes}.tsx`(BottomTabBar 마운트 화면)는 [ADR-018](./ADR-018-route-pages-consolidation.md)로 라우팅 루트 `pages/`로 통합됨. BottomTabBar 결정(D53~D62)은 불변. 아래 시점 기록은 보존한다.

- 상태: Accepted
- 날짜: 2026-05-29
- 관련: [ADR-009](./ADR-009-appsintoss-port-architecture.md)(포팅 아키텍처), [ADR-012](./ADR-012-miniapp-phase3-routing-cache-404.md)(라우팅·캐시·404), [ADR-016](./ADR-016-recommendations.md)(추천), `docs/appsintoss-port/07-ROUTING.md §7.8`
- 결정자: miniapp-architect (Phase 3 SSOT 우선 설계 선행)

---

## 0. 맥락

사용자 요청: "내 레시피 저장 목록을 조회할 수 있는 탭" → 라우터/오케스트레이터 확정 결과 **하단 탭바 방식**으로 [홈 `/`][마이 레시피 `/my-recipes`] 2탭 상시 노출. `src/pages/my-recipes.tsx`는 이미 완성된 화면(목록·필터·페이지네이션·낙관적 즐겨찾기·인라인광고)이며 재구현 금지.

`07-ROUTING.md §7.8`은 "v1 탭바 없음, 향후 화면 수 증가 시 하단 탭 도입 검토"라 기록했고, 본 ADR이 그 도입이다.

본 ADR의 핵심 책무는 **Granite/TDS의 실제 API로 하단 탭의 구현 가능 방식을 실증 확정**하는 것이다(추측 금지, 코드 근거 첨부).

---

## 1. 실증 검증 결과 (블로커 — frontend 착수 게이트)

### 1.1 Granite의 네비게이터는 NativeStack 단일 — 1급 탭 라우팅 없음

- `@granite-js/react-native@1.0.28`의 공개 진입점 `dist/index.d.ts`(23줄 전체)에는 탭 네비게이터 export가 **하나도 없다**. export 목록: `createRoute`/`useNavigation`/`useParams`(router/createRoute), `BackButton`, `useRouterBackHandler`, `useIsInitialScreen`, image/lottie/video/status-bar/keyboard 등. **`createBottomTabNavigator`·`Tabs`·`TabNavigator` 부재.**
  - 근거: `node_modules/@granite-js/react-native/dist/index.d.ts:1-23`.
- 라우터의 유일한 네비게이터는 `StackNavigator`(NativeStack 래퍼)다. `Router`는 내부에서 **항상** `<StackNavigator.Navigator>{Screens}</StackNavigator.Navigator>`만 렌더한다 — 네비게이터 종류를 주입할 props가 없다.
  - 근거: `node_modules/@granite-js/react-native/src/router/Router.tsx:24`(`import { StackNavigator }`), `:203`(`<StackNavigator.Navigator screenOptions={screenOptions}>{Screens}</StackNavigator.Navigator>`). `dist/router/components/StackNavigator.d.ts`는 `@react-navigation/native-stack` 기반.
- `createRoute`의 `screenOptions`는 `NativeStackNavigationOptions`만 받는다(탭 옵션 타입 부재).
  - 근거: `dist/router/createRoute.d.ts:7-15`(`RouteOptions.screenOptions?: NativeStackNavigationOptions | ...`).
- 파일 기반 라우팅은 `_layout` 예약어(`RESERVED_KEYWORDS = ['_layout']`)로 **레이아웃 래퍼**를 지원한다. 그러나 `_layout`은 `mergeParentLayoutScreen`이 만드는 `FC<{ children }>` 래퍼일 뿐이며, **각 스크린을 감싸는 컴포넌트**이지 자식 스크린을 전환하는 별도 네비게이터(자체 탭 상태·헤더)가 아니다.
  - 근거: `dist/router/utils/mergeParentLayoutScreen.d.ts`(`LayoutScreen = FC<{ children: ReactNode }>`, "innermost → outermost reduce"), `src/router/hooks/useRouterControls.tsx:39-69`(layout으로 `<routeScreen.component/>`를 감싼 뒤 여전히 `<StackNavigator.Screen>`으로 등록).

→ **결론(A 기각)**: Granite는 하단 탭 네비게이터를 1급으로 지원하지 않는다.

### 1.2 `@react-navigation/bottom-tabs` 직접 사용 불가(현실적으로)

- `package.json`·`pnpm-lock.yaml` 어디에도 `@react-navigation/bottom-tabs` 없음(grep 0건). react-navigation은 Granite가 `@granite-js/native/@react-navigation/*`로 **번들 내부에 vendoring**해서 쓰며, 앱이 직접 의존성으로 추가하지 않는다.
- 설령 추가하더라도, Granite의 `Router`(앱 루트)가 NativeStack을 **고정**으로 마운트하므로(§1.1), bottom-tabs Navigator를 루트에 끼울 자리가 없다. `_layout`으로 우회해 bottom-tabs Navigator를 자식 스크린 안에서 마운트하면 **NativeStack 안에 또 다른 Navigator를 중첩**하는 형태가 되어, 각 스크린이 이미 등록된 stack route와 충돌하고 deep link 매칭(`getScreenPathMapConfig`)·진입 폴백이 깨진다. 검수·번들(react-navigation 추가 의존성) 리스크도 발생.

→ **결론(B 기각)**: 가능은 하나 프레임워크 계약과 충돌·리스크 과다.

### 1.3 TDS에 "하단 탭바" 전용 컴포넌트 없음 — 프리미티브로 합성

- `@toss/tds-react-native@2.0.3` export 목록(`dist/esm/index.d.ts`)에 `Tab`, `tab-view(Tabs)`가 있으나 **둘 다 상단/콘텐츠 영역 탭**이다:
  - `components/tab` → `Tab`/`Tab.Item`: 가로 텍스트 탭(상단 세그먼트형). `fluid`·`redBean` props. **고정 하단 바·아이콘 슬롯 없음**. 근거: `dist/esm/components/tab/Tab.d.ts`, `TabItem.d.ts`(props: `value`/`children`/`onPress`/`style`/`redBean`).
  - `extensions/tab-view` → `Tabs`/`Tabs.List`/`Tabs.Views`: **스와이프형 콘텐츠 TabView**(상단 인디케이터 + 페이지 뷰). 화면 전체를 차지하는 라우트 전환용 하단 바가 아님. 근거: `dist/esm/extensions/tab-view/index.d.ts`, `Tabs.d.ts`/`TabsList.d.ts`/`TabsViews.d.ts`.
- 하단 탭바에 쓸 **실재 프리미티브**(확인됨):
  - `Icon`(`components/icon`) — `{ name: string; size?: number; color?: string; type?: 'default'|'circle' }`. ⚠️ `name`은 **자유 문자열**(열거 유니온 아님) — 특정 아이콘 키 렌더 보장 불가(§3.2 회피책). 근거: `dist/esm/components/icon/Icon.d.ts`.
  - `Txt`(`components/txt`) — 라벨용. 기존 전반에서 사용 중.
  - `colors`(`@toss/tds-colors` re-export) — `colors.primary`/`grey*`/`white` 등 토큰. 근거: `dist/esm/index.d.ts:64`.
  - RN `Pressable`/`View` + TDS `PressableEffect`(`interactions/pressable-effect`) — 탭 항목 누름.

→ **결론**: 하단 탭바는 **TDS 프리미티브(Txt/colors/선택적 Icon) + RN Pressable/View 합성**으로 만든다.

### 1.4 최종 채택: (C) 커스텀 고정 하단 탭바 컴포넌트 + `navigation.navigate`

Granite NativeStack 위에, **항상 화면 하단에 고정 렌더되는 커스텀 `BottomTabBar` 컴포넌트**를 두고, 탭 항목 누름 시 `navigation.navigate('/' | '/my-recipes', {})`로 전환한다. 활성 탭은 **현재 라우트 이름**으로 판정한다.

---

## 2. 결정 카탈로그 (D53~D62)

| # | 결정 | 근거 |
|---|------|------|
| **D53** | **채택 방식 = (C) 커스텀 고정 하단 탭바**. Granite 1급 탭(A)·react-navigation bottom-tabs(B) 모두 기각. | §1.1~1.3 코드 근거 |
| **D54** | 탭 2개 고정: `[홈 → '/'][마이 레시피 → '/my-recipes']`. 라벨 "홈"/"마이 레시피". | 요구사항 1 |
| **D55** | 탭 전환은 `navigation.navigate(path, {})` (push 아님 — `navigate`는 동일 라우트 존재 시 재포커스). 활성 판정은 라우트 이름 기준. **새 라우트 0개** — 기존 `/`·`/my-recipes` 재사용. | NativeStack 동작. router.gen.ts 변경 0 |
| **D56** | ~~탭바는 **`/` 와 `/my-recipes` 두 화면에만** 렌더. 스택 라우트(`/recipe/generate`·`/recipe/[id]`·`/recipe/recommend`)·`/_404`에는 **렌더하지 않음**(상세/생성/추천은 몰입형 진입, BackButton 헤더로 복귀).~~ **→ [D63](#21-d63-2026-05-30--노출-범위-전-화면-확대-d56-대체)으로 대체됨(2026-05-30).** 노출 범위가 전 화면으로 확대됨. 원문은 시점 기록으로 보존. | §1.1 — 글로벌 탭바를 끼울 루트 슬롯이 없으므로 "탭이 보여야 하는 화면이 직접 렌더"가 유일·정합한 방법 |
| **D57** | 탭바는 화면별로 마운트하되 **단일 `BottomTabBar` 컴포넌트**(SSOT 1개) 재사용. 홈/마이가 각각 `<BottomTabBar active="home"\|"my" />` 1줄로 마운트. | 중복 제거(DRY), 단일 컴포넌트 정책(ADR-012 D16 패턴 답습) |
| **D58** | 홈의 `PageNavbar.AccessoryTextButton "마이 레시피"` **제거**(탭바와 중복). 홈 `PageNavbar`는 Title만 유지. "오늘의 추천 받기" CTA(ADR-016 D50)는 유지. | 요구사항 3 — 중복 진입점 제거 |
| **D59** | 활성 탭 색은 TDS **`colors.orange500`(`#FF6B00`)**, 비활성은 `colors.grey500`. brand primaryColor `#FF6B35`의 최근접 실재 토큰. hex 직접 사용 금지(ADR-015 D39) — **TDS 토큰만**. ⚠️ `colors.primary`는 `@toss/tds-colors@0.1.0`에 **부재**(QA 실증 TS2339), `colors.blue500`은 실재하나 브랜드(주황)와 이질이라 기각. 근거·기각안 §3.3. | ADR-015 D39 hex 금지 + QA 실증 |
| **D60** | 탭 항목 표현은 **라벨(Txt) 우선**. `Icon`은 `name`이 실재 검증된 경우에만 추가(§3.2). 실재 미확인 시 라벨 only로 출하 — 검수·런타임 안전. | §1.3 Icon.name 자유 문자열 리스크 |
| **D61** | 하단 SafeArea 패딩 처리 필수(홈 인디케이터 영역). RN `useSafeAreaInsets` 또는 TDS 제공 인셋 훅 실재 확인 후 적용; 미확인 시 `paddingBottom` 상수 폴백. ScrollView 콘텐츠가 탭바에 가리지 않도록 `contentContainerStyle`에 `paddingBottom` 확보. | iOS 홈바 겹침 방지 |
| **D62** | ~~**[정합성 회귀 동시 수정]** `granite.config.ts` `appName`을 `'airecipe'` → `'airecipe-miniapp'`로 원복.~~ **🚫 폐기(2026-06-01)** — 아래 정정 참조. | 아래 §3.1 |

> **🚫 D62 폐기 정정 (2026-06-01)**: D62는 콘솔 등록 deep link prefix를 `'airecipe-miniapp'`으로 **오판**했다. 실제 콘솔 등록 앱이름은 **`airecipe`**이며, 커밋 `c491ac6`("앱인토스 콘솔에 저장되어 있는 앱이름으로 수정")가 `appName: 'airecipe'`로 의도적으로 재설정한 것이 정본이다(사용자 확정 2026-06-01). **`appName`은 `'airecipe'`이며, `'airecipe-miniapp'`으로 바꾸지 말 것.** D62 및 §3.1의 회귀 진단은 잘못된 전제(콘솔 prefix=`airecipe-miniapp`)에 기반했으므로 무효. hotfix root cause #1(CLAUDE.md)도 동일하게 무효.

---

## 2.1 D63 (2026-05-30) — 노출 범위 전 화면 확대 (D56 대체)

> 사용자 요청(2026-05-30): "`src/components/BottomTabBar.tsx`가 모든 화면에서 보였으면 좋겠어." → D56(노출 범위 `/`·`/my-recipes` 한정)을 대체한다. baseline: `_workspace/01_architect_baseline.md`.

### 맥락 — D56 재검토

D56은 "글로벌 탭바를 끼울 루트 슬롯이 없으니 탭이 보여야 하는 화면만 직접 렌더"라는 §1.1 제약에서 **노출 범위를 최소화**했다. 그러나 그 제약(루트 슬롯 부재 → 화면별 직접 마운트)은 **노출 범위를 강제하지 않는다** — 화면별 마운트는 노출 화면이 늘어도 동일하게 적용 가능하다. 사용자는 비-탭 화면(생성/추천/상세/_404)에서도 탭으로 즉시 홈·마이에 복귀하길 원한다. 막다른 화면(_404)·몰입형 진입 화면에서도 탭바는 **탈출 경로**로 기능해 UX상 이득이며, 구현 비용은 화면별 1줄 마운트뿐이다.

### 결정 카탈로그 (D63 세부)

| # | 결정 | 근거 |
|---|------|------|
| **D63** | **노출 범위 = 전 화면.** `/`·`/my-recipes`(탭 화면) + `/recipe/generate`·`/recipe/recommend`·`/recipe/[id]`·`/_404`(비-탭 화면) **모두** `BottomTabBar`를 직접 마운트한다. D56(2화면 한정)을 대체. | 사용자 요청 "모든 화면" + 탈출 경로 UX. 화면별 마운트(D57)는 화면 수와 무관하게 동일 적용 |
| **D63a** | **`active` prop에 `'none'` 도입.** `BottomTabBarProps.active: TabKey` → **`TabKey \| 'none'`**. 탭 화면은 `'home'\|'my'`, 비-탭 화면은 `'none'` 전달. `'none'`은 "활성 탭 없음" 센티넬 — `TABS`에 추가하지 않음(탭 항목 2개 불변). | 비-탭 화면은 활성 탭이 없음을 정확히 표현. `handlePress` no-op 가드(`key===active`)·`isActive`(`tab.key===active`)·accessibilityState(`selected`)가 `'none'`에서 자동 정합(두 탭 모두 비활성·비선택·navigate 정상) — **로직 변경 0, 타입만 확장** |
| **D63b** | **early-return 분기에도 마운트.** 식별자 가드(my-recipes·recommend·[id])·404 분기([id])·_404 폴백 등 **별도 JSX 트리를 반환하는 모든 분기**에 탭바를 마운트한다(누락 시 그 분기에서 탭바 사라짐 — my-recipes line 122 가드 분기 선례 답습). | 분기는 서로 다른 render 경로. "전 화면 노출"은 "전 분기 노출"을 함의 |
| **D63c** | **404/폴백 화면 마운트 패턴.** `NotFoundScreen`(=TDS `ErrorPage`, `flex:1` 전체 화면)을 쓰는 [id] 404 분기·`_404.tsx`는 `<View flex:1>`로 감싸 `ErrorPage`와 탭바를 형제로 둔다. | `ErrorPage`는 자체 전체화면 컴포넌트 — ScrollView 패턴 적용 불가, View 래퍼 형제 배치가 정합 |
| **D63d** | **D55 재포커스 유지.** 비-탭 화면(push 진입)에서 탭 누름 → `navigation.navigate(path, {})`는 NativeStack에서 대상 라우트가 스택에 있으면 **pop-to(재포커스)**, 없으면 push. `/`·`/my-recipes`는 탭 루트라 **스택을 깊게 만들지 않고 탭 루트로 복귀** — 의도대로. D55 불변. | NativeStack `navigate` 동작. 서브 화면 자체 BackButton(한 단계 pop)과 공존·무충돌 |
| **D63e** | **paddingBottom 정합.** generate/recommend/[id]의 `scrollContent`에 `paddingBottom: 24` 신규 추가(홈/마이 기존값과 통일) — 콘텐츠가 하단 고정 탭바에 가리지 않도록. 가드 분기(ScrollView 없음)·404 분기는 불요. | D61 SafeArea·가림 방지 정신을 비-탭 화면에 확장 |

### `active='none'` 정합 검증 (D63a 실증)

| 지점 | 코드 | `active==='none'` 결과 |
|------|------|------------------------|
| no-op 가드 | `if (key === active) return` | `'home'!=='none'`·`'my'!=='none'` → 미발동, 두 탭 navigate 정상 |
| 활성 판정 | `isActive = tab.key === active` | 두 탭 `false` → 강조 없음 |
| 접근성 | `accessibilityState={{ selected: isActive }}` | 두 탭 `selected:false` → "선택된 탭 없음" 정확 |
| 색 | `isActive ? colors.orange500 : colors.grey500` | 두 탭 `grey500`(비활성색) |

→ `BottomTabBar.tsx`는 **`active` 타입·JSDoc만 변경**, `TABS`/`map`/`handlePress`/`styles` 무변경.

### 기각·대안

- **(D63-alt) `_layout` 글로벌 마운트**: §1.1·§4 기재대로 `_layout`은 자식 스크린 전환 네비게이터가 아니라 래퍼 FC라 탭 상태·고정 바를 일관 제공하지 못하고, 모든 화면(원치 않는 미래 화면 포함)을 무조건 감싸 화면별 제어력을 잃는다. 화면별 마운트(D57·D63b)가 더 정밀·명시적 → 기각.
- **_404 제외안**: 사용자 "모든 화면" 명시 + _404는 막다른 화면이라 탈출 경로(탭) 제공이 오히려 적합 → **포함**(D63).

### 산출 위치

- `BottomTabBar.tsx`(active 타입), 6개 페이지 마운트(`_workspace/01_architect_baseline.md §B` 표), 07 §7.8.1 노출 범위 표, `src/components/AGENTS.md` BottomTabBar 행. 백엔드/api-client/zod/types/router.gen.ts 변경 0.

---

## 3. 정합성·리스크

### 3.1 ~~⚠️ appName 진입 폴백 회귀~~ 🚫 오진단 폐기 (2026-06-01)

> **🚫 본 절은 잘못된 진단이었음 (2026-06-01 정정).** 아래 분석은 콘솔 등록 deep link prefix가 `'airecipe-miniapp'`이라고 **오판**한 데서 출발했다. 실제 콘솔 등록 앱이름은 **`airecipe`**이고, 커밋 `c491ac6`("콘솔에 저장된 앱이름으로 수정")가 `appName: 'airecipe'`로 맞춘 것이 정본이다(사용자 확정). 따라서 D62의 "`airecipe-miniapp` 원복"은 폐기됐고, `appName`은 `'airecipe'`가 맞다. 아래 원문은 이력 보존용.

~~CLAUDE.md hotfix 기록과 `_workspace_hotfix_entry_fallback/01_architect_baseline.md`(line 6)는 `appName`을 `'airecipe-miniapp'`로 원복했다고 명시하나, 현재 `granite.config.ts:7`은 `appName: 'airecipe'`다(검증 확인). monorepo 병합(commit `05ef27c`)이 hotfix 이전 값을 재도입한 것으로 보인다.~~

~~영향: 진입 deep link `intoss://airecipe-miniapp`에서 prefix를 strip한 결과가 `"-miniapp"` 잔여가 되어 어떤 라우트와도 매칭되지 않고 wildcard → `/_404`로 폴백한다.~~ → **무효(위 정정 참조).**

검수 정책(출시 전 필수): 콘솔 등록 deep link prefix ↔ `granite.config.ts` `appName`(=`airecipe`) 1:1 동기 확인.

### 3.2 Icon.name 자유 문자열 리스크 (D60)

`IconProps.name: string`은 열거 유니온이 아니므로, 임의 아이콘 키가 토스 아이콘 레지스트리에 실재하는지 타입으로 보장되지 않는다. 잘못된 name은 빈 렌더/경고가 될 수 있다. → 라벨 우선, 아이콘은 실재 확인 시에만(AppsInToss MCP `search_tds_rn_docs` 또는 dev 런타임 확인).

### 3.3 색 토큰 실재 확인 — 활성 탭 색 = `colors.orange500` (D59, QA 실증 확정)

활성 탭 색은 **`colors.orange500`(= `#FF6B00`)**로 확정한다. brand primaryColor `#FF6B35`의 최근접 실재 토큰이다.

| 후보 | 판정 | 근거 |
|------|------|------|
| `colors.primary` | **기각** | `@toss/tds-colors@0.1.0`에 **부재** — 사용 시 TS2339(QA 실증). 06-UI-MAPPING §6.1/§6.2의 `colors.primary` 예시도 본 패키지 버전에선 비실재 → §6 동시 정합화. |
| `colors.blue500` | **기각** | 실재하나 브랜드(주황 `#FF6B35`)와 색상 이질 — 강조색 일관성 위배. |
| **`colors.orange500`** | **채택** | 실재(`#FF6B00`). brand `#FF6B35` 최근접. hex 직접 사용 없이 토큰만으로 brand 강조 달성. |

기존 코드 패턴(`colors.grey900`/`grey700`/`grey500`/`white`)은 실재 검증됨. 활성 색 채택은 ADR-015 D39와 정합 — D39의 "정확 동등치" 규약은 기존 hex를 토큰으로 교체하는 맥락이며, 신규 강조색은 brand 최근접 실재 토큰(`orange500`) 채택이 D39 hex-금지 정신에 부합(06-UI-MAPPING §6.1 정합화 동반).

### 3.4 활성 탭 판정 — 현재 라우트 이름

`navigation`에서 현재 라우트 이름을 얻는다. NativeStack `useNavigation`은 react-navigation `getState`/`useRoute`를 노출하므로, **각 화면이 자신의 active 값을 prop으로 명시 전달**(`<BottomTabBar active="home" />`)하는 방식을 채택해 런타임 상태 의존을 없앤다(D57). 단순·결정적.

---

## 4. 기각안

- **(A) Granite 1급 탭 라우팅**: export·Router 내부 모두 NativeStack 고정 — 부재(§1.1).
- **(B) `@react-navigation/bottom-tabs` 직접**: 미설치 + 루트 네비게이터 주입 슬롯 없음 + 중첩 네비게이터로 deep link/진입 폴백 파손 + 번들·검수 리스크(§1.2).
- **(C-alt) TDS `Tabs`(tab-view) 사용**: 스와이프 콘텐츠 TabView라 라우트 단위 하단 바 아님(§1.3).
- **`_layout`에 탭바 래퍼만 두기**: `_layout`은 모든 자식 스크린(상세/생성/추천 포함)을 감싸므로 D56(스택 화면 숨김)과 충돌. 화면별 마운트(D57)가 더 정밀.

---

## 5. 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-29 | 초기 발행 — D53~D62. 방식 (C) 커스텀 고정 하단 탭바 채택, appName 회귀 동시 수정 동결. | 하단 탭바 도입 Phase 3 SSOT 우선 설계 |
| 2026-05-29 | D59·§3.3 갱신 — 활성 탭 색 `colors.orange500`(`#FF6B00`) 확정. `colors.primary`(`@toss/tds-colors@0.1.0` 부재, TS2339)·`colors.blue500`(브랜드 이질) 기각 기록. 06-UI-MAPPING §6.1·§6.2 동시 정합화. | QA 실증 — primary 토큰 비실재 |
| 2026-05-30 | **§2.1 D63 신설 — 노출 범위 전 화면 확대(D56 대체).** D56 원문 보존 + D63 전방 주석. `active: TabKey \| 'none'` 도입(D63a — 로직 무변경, 타입만 확장)·early-return 분기 마운트(D63b)·404/폴백 View 래퍼 패턴(D63c)·D55 재포커스 유지 재확인(D63d)·generate/recommend/[id] paddingBottom 24(D63e). 07 §7.8.1·`src/components/AGENTS.md` 동시 갱신. | 사용자 요청 "모든 화면 노출" — 탈출 경로 UX, 화면별 마운트는 화면 수 무관 동일 적용 |
