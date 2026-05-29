# 01 — Architect Baseline: 하단 탭바([홈 / 마이 레시피]) 도입

> Phase 3 SSOT 우선 설계 (architect 단독 선행). 기준 디렉토리 `airecipe-miniapp/`.
> 발행 ADR: **ADR-017** (D53~D62). 07-ROUTING §7.8.1 갱신 완료.
> 날짜: 2026-05-29

---

## A. 실증 검증 결과 (블로커 게이트 — frontend 착수 전 필독)

### A.1 채택 방식 = (C) 커스텀 고정 하단 탭바

| 후보 | 판정 | 코드 근거 (파일:라인) |
|------|------|----------------------|
| (A) Granite 1급 탭 라우팅 | **기각** | `node_modules/@granite-js/react-native/dist/index.d.ts:1-23` — 탭 네비게이터 export 0건. `src/router/Router.tsx:24,203` — Router는 항상 `<StackNavigator.Navigator>`만 마운트(네비게이터 주입 props 없음). `dist/router/createRoute.d.ts:7-15` — `screenOptions`는 `NativeStackNavigationOptions`만. `dist/router/utils/mergeParentLayoutScreen.d.ts` — `_layout`은 `FC<{children}>` 래퍼이지 탭 네비게이터 아님. |
| (B) `@react-navigation/bottom-tabs` 직접 | **기각** | `package.json`/`pnpm-lock.yaml` 0건(미설치). 루트 네비게이터(StackNavigator) 고정이라 주입 슬롯 없음. 중첩 시 deep link 매칭(`getScreenPathMapConfig`)·진입 폴백 파손 + 번들/검수 리스크. |
| **(C) 커스텀 고정 하단 탭바** | **채택** | TDS 프리미티브로 합성 가능(A.2). NativeStack 계약 유지, 새 라우트 0개, deep link 무영향. |

**한 줄 근거**: Granite Router는 NativeStack을 고정 마운트하고 탭 네비게이터 export가 전무하며 TDS에 하단 탭바 전용 컴포넌트도 없으므로, 유일하게 계약-정합한 방법은 TDS 프리미티브 + RN Pressable로 합성한 고정 하단 바를 탭 노출 화면이 직접 렌더하는 것이다.

### A.2 TDS 실재성 (검증 완료)

| 사용 항목 | 실재 | 근거 |
|-----------|------|------|
| `Txt` | OK | `dist/esm/components/txt/Txt.d.ts`, 기존 전반 사용 |
| `colors` | OK | `dist/esm/index.d.ts:64` (`export { colors } from '@toss/tds-colors'`) |
| `Icon` | OK (단, `name: string` 자유 문자열) | `dist/esm/components/icon/Icon.d.ts:1-12` — `{ name: string; size?; color?; type? }`. ⚠️ 열거 아님 → 실재 검증된 name만(D60) |
| `PressableEffect` | OK | `dist/esm/interactions/pressable-effect/index.d.ts` |
| RN `Pressable`/`View` | OK | 기존 RecipeCard 등에서 사용 |
| `Tab`(상단 세그먼트) | 부적합 | `dist/esm/components/tab/Tab.d.ts` — 하단 바 아님 |
| `tab-view Tabs`(스와이프) | 부적합 | `dist/esm/extensions/tab-view/Tabs.d.ts` — 콘텐츠 TabView |

**하단 탭바 전용 TDS 컴포넌트는 없다.** → `Txt`+`colors`(+선택적 `Icon`) + RN `Pressable`/`View` 합성.

### A.3 ⚠️ appName 진입 폴백 회귀 (확인 — 본 작업에 포함, D62)

- 현재: `granite.config.ts:7` → `appName: 'airecipe'`.
- hotfix가 원복했어야 할 값: `'airecipe-miniapp'` (`_workspace_hotfix_entry_fallback/03_qa_report.md:21,101`, CLAUDE.md hotfix 표 #1).
- monorepo 병합(`05ef27c`)이 hotfix 이전 값을 재도입 → **진입 시 `/_404` 폴백 회귀 상태**.
- 탭바 도입과 별개로 앱이 홈 진입조차 못 하므로 **본 작업에서 동시 수정**.

---

## B. Frontend 구현 명세 (그대로 따라 구현)

### B.1 [신규] `src/components/BottomTabBar.tsx` — 단일 SSOT 컴포넌트 (D57)

```tsx
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@granite-js/react-native';
import { Txt, colors } from '@toss/tds-react-native';

export type TabKey = 'home' | 'my';

export interface BottomTabBarProps {
  /** 현재 화면이 자신의 활성 탭을 명시 전달 (런타임 상태 의존 제거 — D57/§3.4) */
  active: TabKey;
}

const TABS: { key: TabKey; label: string; path: '/' | '/my-recipes' }[] = [
  { key: 'home', label: '홈', path: '/' },
  { key: 'my', label: '마이 레시피', path: '/my-recipes' },
];

export function BottomTabBar({ active }: BottomTabBarProps) {
  const navigation = useNavigation();

  const handlePress = useCallback(
    (key: TabKey, path: '/' | '/my-recipes') => {
      if (key === active) return;          // 동일 탭 재탭 no-op
      navigation.navigate(path, {});        // D55 — navigate(재포커스)
    },
    [navigation, active],
  );

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.item}
            onPress={() => handlePress(tab.key, tab.path)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Txt
              typography="st11"
              color={isActive ? colors.orange500 : colors.grey500}
            >
              {tab.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.grey200,
    backgroundColor: colors.white,
    paddingBottom: 12,   // SafeArea 폴백 (D61) — useSafeAreaInsets 실재 확인 시 교체
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
});
```

**검증 필수 (frontend):**
1. 활성 색 = **`colors.orange500`(`#FF6B00`)** — QA 실증 확정(D59). `colors.primary`는 `@toss/tds-colors@0.1.0` **부재**(TS2339)이므로 사용 금지, `colors.blue500`은 브랜드 이질로 기각. **hex 직접 사용 금지.**
2. `colors.orange500`/`grey200`/`grey500`/`white` — 실재 확인됨(orange500=`#FF6B00`).
3. `Txt typography="st11"` — 기존 AI 면책 라인이 동일 레벨 사용(실재).
4. (선택) 아이콘 추가 시 `Icon name` 실재성 AppsInToss MCP `search_tds_rn_docs`로 확인 후에만(D60). 미확인 시 라벨 only로 출하.
5. SafeArea: `react-native-safe-area-context`/Granite 인셋 훅 실재 확인 후 `paddingBottom`을 `insets.bottom`으로. 미확인 시 위 상수 폴백 유지.

### B.2 [수정] `src/pages/index.tsx` (홈)

- D58: `PageNavbar.AccessoryButtons`/`AccessoryTextButton "마이 레시피"` 블록 **제거**. `handleOpenMyRecipes` 콜백도 제거. `PageNavbar`는 `Title`만 유지.
- "오늘의 추천 받기" CTA(`handleOpenRecommend`)·SearchForm은 **유지**.
- 화면 최하단에 `<BottomTabBar active="home" />` 추가. `root` 컨테이너는 `flex:1`이므로 ScrollView 아래에 형제로 배치(탭바가 항상 하단 고정).
- ScrollView `contentContainerStyle`에 `paddingBottom: 24` 정도 추가(탭바 가림 방지 — D61).
- import: `import { BottomTabBar } from '../components/BottomTabBar';`. `PageNavbar` 제거로 미사용 import 정리(`Button`은 추천 CTA에서 계속 사용).

구조:
```tsx
<View style={styles.root}>
  <PageNavbar><PageNavbar.Title>AI 레시피</PageNavbar.Title></PageNavbar>
  <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
    {/* intro + SearchForm + 추천 CTA (기존) */}
  </ScrollView>
  <BottomTabBar active="home" />
</View>
```

### B.3 [수정] `src/pages/my-recipes.tsx` (마이)

- **화면 로직 변경 최소화** (목록/필터/페이지네이션/즐겨찾기/광고 그대로).
- 최하단에 `<BottomTabBar active="my" />` 추가. 현재 구조의 최외곽 `View(flex:1)` 안, 콘텐츠(ScrollView 등) 다음 형제로.
- ScrollView/콘텐츠 `paddingBottom` 확보(탭바 가림 방지).
- 상단 `PageNavbar`의 BackButton은 유지(탭바와 별개 — 상세에서 돌아온 경우 등). 단 마이가 탭 진입의 종착이므로 BackButton 동작은 기존 그대로.
- import: `import { BottomTabBar } from '../components/BottomTabBar';`.

> 주의: 식별자 가드(`useTossUserId`)로 로딩/에러 분기가 화면 전체를 차지하는 경우에도 탭바는 보이는 게 자연스럽다. 분기 렌더가 `return` early인 구조라면, 탭바를 각 분기 바깥(최외곽 View 자식)으로 끌어올려 항상 렌더되게 한다.

### B.4 [수정] `granite.config.ts` (D62 — 회귀 동시 수정)

```ts
appName: 'airecipe-miniapp',   // 'airecipe'에서 원복 — 진입 deep link prefix와 1:1 동기
```
다른 필드(scheme/brand/env/ads) 변경 없음.

### B.5 변경 없음 (확인용)

- `src/router.gen.ts` — **변경 0**. 새 라우트 없음(D55). 기존 5라우트 그대로.
- `src/_app.tsx` — **변경 0**. 탭바는 화면별 마운트라 Provider 추가 불필요.
- `pages/*.tsx` shim 5개 — **변경 0**.
- `src/services`·`hooks`·zod·types — **변경 0**. api-client 팀 no-op.
- 스택 화면(`recipe/generate`·`[id]`·`recommend`)·`pages/_404.tsx` — **변경 0**(탭바 미렌더 D56).

### B.6 [선택] AGENTS.md

`src/components/AGENTS.md`에 `BottomTabBar` 행 1줄 추가(단일 하단 탭바 SSOT, 화면별 `active` prop 명시 전달, 색은 TDS 토큰). frontend가 컴포넌트 추가 시 동기.

---

## C. QA 검증 항목 (miniapp-qa)

| # | 항목 | 기대 |
|---|------|------|
| Q1 | typecheck | `pnpm typecheck` PASS |
| Q2 | lint | `pnpm lint` 0 errors (router.gen.ts 누적 warning 1건 허용) |
| Q3 | BottomTabBar 단일 컴포넌트 | `src/components/BottomTabBar.tsx` 1개. 중복 정의 0 (D57) |
| Q4 | 탭 전환 | 홈↔마이 `navigation.navigate('/'|'/my-recipes', {})`. push 아님(D55) |
| Q5 | 탭바 노출 범위 | `/`·`/my-recipes`만 렌더. generate/[id]/recommend/_404 **미렌더** (D56) — grep으로 BottomTabBar import가 두 화면에만 |
| Q6 | 홈 중복 진입점 제거 | `index.tsx`에 `AccessoryTextButton "마이 레시피"` 부재 (D58). "오늘의 추천" CTA 유지 |
| Q7 | 색 토큰 | hex 직접 사용 0건 — `colors.*`만 (ADR-015 D39). 활성/비활성 토큰 구분 |
| Q8 | 아이콘 | (추가 시) `Icon name` 실재 검증 근거 첨부. 미검증이면 라벨 only |
| Q9 | SafeArea | 하단 패딩 존재 + ScrollView paddingBottom으로 탭바 가림 없음 (D61) |
| Q10 | **appName 회귀** | `granite.config.ts` `appName: 'airecipe-miniapp'` (D62). dev 진입 시 홈 정상(=`/_404` 미표시). `navigation.getState` `routes[0].path` 정상 매칭 |
| Q11 | router.gen.ts | 변경 0 — 5라우트 그대로 |
| Q12 | 데이터 경로 | api-client/hooks/zod 변경 0 (계약 무영향) |

**Q10은 디바이스/샌드박스 dev 진입 실증이 최종 — 코드 측은 appName 문자열 1:1 확인까지.**

---

## D. SSOT 인용

- ADR-017 §1(실증)·§2(D53~D62)·§3(정합성) — 본 작업 결정 SSOT.
- 07-ROUTING §7.8.1 — 라우팅 측 SSOT(갱신 완료).
- 06-UI-MAPPING §6.1 — TDS colors 토큰 의무(hex 금지, ADR-015 D39).
- hotfix: `_workspace_hotfix_entry_fallback/03_qa_report.md` — appName 회귀 root cause.

## E. 팀 통지

- **frontend**: B.1~B.6 구현. 블로커 게이트 통과(방식 C 확정). 활성 색 `colors.orange500`(확정, D59). SafeArea 훅/Icon name은 실재 확인 후 채택(추측 금지).
- **api-client**: no-op (계약 무영향).
- **qa**: C의 Q1~Q12. Q10(appName)·Q5(노출 범위)·Q6(중복 제거) 우선.
- **백엔드 영향**: 없음.
