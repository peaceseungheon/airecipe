# 01 — Architect Baseline: BottomTabBar 전 화면 노출 (ADR-017 D63)

> 사용자 요청(2026-05-30): "`src/components/BottomTabBar.tsx`가 모든 화면에서 보였으면 좋겠어."
> 본 baseline은 ADR-017 D56(노출 범위 `/`·`/my-recipes` 한정)을 **D63으로 대체**하는 결정·스펙을 동결한다. 구현은 frontend.

SSOT 인용: `docs/adr/ADR-017-bottom-tab-navigation.md`(D53~D63), `docs/appsintoss-port/07-ROUTING.md §7.8.1`, `docs/appsintoss-port/06-UI-MAPPING.md §6.1`. 백엔드 무변경(03-API-CONTRACT 영향 0).

---

## A. 결정 요약 (요구사항 1~4 판정)

### A.1 — active prop 비활성 상태 설계 (요구사항 1) → **`active: TabKey | 'none'`**

비-탭 화면(generate/recommend/[id]/_404)은 활성 탭이 없다. `BottomTabBar.tsx`의 `active` prop 타입을 `TabKey` → `TabKey | 'none'`으로 확장하고, 탭 화면은 기존대로 `'home'|'my'`를, 비-탭 화면은 `'none'`을 전달한다.

**내부 로직 점검(변경 불필요 — 타입만 확장하면 정합):**

| 지점 | 현재 코드 | `active==='none'` 시 동작 | 판정 |
|------|-----------|---------------------------|------|
| `handlePress` no-op 가드 | `if (key === active) return` | `'home'!=='none'` ∧ `'my'!=='none'` → 가드 미발동, 두 탭 모두 정상 navigate | ✅ 정확 |
| 활성 판정 | `const isActive = tab.key === active` | 두 탭 모두 `false` | ✅ 어떤 탭도 강조 안 됨(의도) |
| accessibilityState | `selected: isActive` | 두 탭 모두 `selected:false` | ✅ 비-탭 화면에서 "선택된 탭 없음" 정확 표현 |
| 색 | `isActive ? orange500 : grey500` | 두 탭 모두 `grey500` | ✅ 전부 비활성색 |

→ **`TABS` 배열·`map` 렌더·`navigate` 로직 전부 무변경.** `BottomTabBarProps.active` 타입과 JSDoc만 확장. `'none'`은 "활성 탭 없음" 센티넬일 뿐 탭 항목이 아니므로 `TABS`에 추가하지 않는다(렌더 영향 0).

### A.2 — D55 재포커스 의미 (요구사항 3) → **의도대로. 변경 없음.**

서브 화면은 `navigation.navigate('/recipe/...')`로 **push** 진입한다. 서브 화면에서 홈/마이 탭을 누르면 `navigation.navigate('/' | '/my-recipes', {})`가 호출된다. NativeStack에서 `navigate`는 **대상 라우트가 스택에 이미 있으면 그 라우트로 pop-to(재포커스), 없으면 push**한다. `/`·`/my-recipes`는 탭 진입점(스택 하부)이므로 탭 누름은 **스택을 깊게 만들지 않고 해당 탭 루트로 복귀**한다. 이는 탭 UX의 기대 동작과 정확히 일치 — D55 유지, 추가 결정 불필요.

> 참고: `[id]`/`generate`/`recommend`는 자체 PageNavbar BackButton(또는 goBack 폴백)을 보유한다. 탭바의 navigate와 BackButton은 공존 가능하며 충돌하지 않는다(BackButton=한 단계 pop, 탭=탭 루트로 pop-to).

### A.3 — _404 노출 타당성 (요구사항 4) → **노출(포함).**

사용자가 "모든 화면" 명시. `_404`는 (1) 진입 deep link 미스매치 폴백, (2) 잘못된 경로 진입 시 표시된다. 탭바를 노출하면 사용자가 막다른 길에서 **탭으로 즉시 정상 화면(홈/마이)에 복귀**할 수 있어 UX상 이득이며, 요구사항의 "모든 화면"에도 부합한다. 활성 탭은 `'none'`.

다만 `_404`는 `NotFoundScreen`(TDS `ErrorPage`)을 렌더하는 구조라 마운트 방식이 다른 페이지와 다르다(§B.5 참조). `ErrorPage`는 전체 화면을 차지하는 TDS 컴포넌트이므로, 탭바는 `ErrorPage`와 형제로 `View` 래퍼 하단에 배치한다. → **포함하되 마운트 패턴은 §B.5 전용 스펙을 따른다.**

### A.4 — 마운트 지점·중복 마운트 (요구사항 2) → **§B 페이지별 스펙 표.**

각 페이지는 `root` View(flex:1) 안에 `PageNavbar` + `ScrollView`(+오버레이) 구조다. 탭바는 **`ScrollView` 형제로 `root` View의 최하단**에 둔다(고정 바). 단, 일부 페이지는 **early-return 분기**(식별자 가드·404)가 있어 그 분기에도 별도 마운트가 필요하다(my-recipes의 식별자 가드가 이미 line 122에 중복 마운트한 선례 답습). 분기별 마운트 필요 여부는 §B 표의 "마운트 위치" 열에 정확히 명시한다.

---

## B. 페이지별 마운트 스펙 (frontend 구현 표)

> 공통 규약:
> - 탭바는 항상 `root` View(`flex:1`)의 **직속 자식, `ScrollView`/`ErrorPage` 다음 형제**로 배치(화면 하단 고정).
> - early-return 하는 분기는 **각 분기의 `root` View 안에도** 동일하게 마운트(분기는 서로 다른 JSX 트리이므로 누락 시 그 분기에서 탭바가 사라짐).
> - `scrollContent.paddingBottom`은 탭바 높이(대략 `paddingTop 8 + 라인 ~18 + paddingBottom 12 + border` ≈ 40~50px)에 가림 방지 여유를 더해 **24** 유지(현행 홈/마이 값과 통일). 탭바 자체가 `root` 하단 고정이고 ScrollView는 그 위 영역을 차지하므로, RN 레이아웃상 ScrollView 콘텐츠 최하단이 탭바에 가리지 않으려면 paddingBottom 확보가 필요. 기존 미적용 3개 페이지(generate/recommend/[id])는 **paddingBottom 24 신규 추가**.

| # | 파일 | active 값 | 마운트 위치 (분기) | scrollContent.paddingBottom |
|---|------|-----------|---------------------|------------------------------|
| 1 | `pages/index.tsx` | `"home"` | 정상 1곳(이미 line 76) — 변경 없음 | 24 (이미 적용) |
| 2 | `pages/my-recipes.tsx` | `"my"` | (a) 식별자 가드 분기(이미 line 122) (b) 정상 분기(이미 line 251) — 변경 없음 | 24 (이미 적용) |
| 3 | `pages/recipe/generate.tsx` | `"none"` | 정상 1곳 — `</ScrollView>`(line 238) 다음, `root` View 닫기 전. early-return 없음(전 분기가 단일 ScrollView 내부) | **24 신규 추가** (현재 미적용) |
| 4 | `pages/recipe/recommend.tsx` | `"none"` | (a) 식별자 가드 분기(line 49~62 `root` View 안, `</View>` 닫기 전) (b) 정상 분기 — `</ScrollView>`(line 148) 다음 | **24 신규 추가** (양 분기 scrollContent + 가드 분기는 ScrollView 없음 → 추가 paddingBottom 불요, 탭바만) |
| 5 | `pages/recipe/[id].tsx` | `"none"` | (a) 식별자 가드 분기(line 113~126, `</View>` 닫기 전) (b) 404 분기(line 129~131 — `return <NotFoundScreen .../>`만 반환 → §B.4 처리) (c) 정상 분기 — `</ScrollView>`(line 213) 다음, `DeleteConfirmDialog` 형제 위치 그대로 | **24 신규 추가**(정상 분기 scrollContent) |
| 6 | `pages/_404.tsx` | `"none"` | §B.5 — `NotFoundScreen`을 `View` 래퍼로 감싸고 탭바를 형제로 추가 | N/A (ScrollView 없음) |

### B.1 — generate.tsx (#3)

- import: `import { BottomTabBar } from '../../src/components/BottomTabBar';`
- `</ScrollView>`(line 238) 다음 줄, `</View>`(root 닫기) 직전에 `<BottomTabBar active="none" />` 추가.
- `styles.scrollContent`에 `paddingBottom: 24,` 추가.

### B.2 — recommend.tsx (#4)

- import 동일.
- **식별자 가드 분기**(line 49~62): `</View>`(center) 다음, `root` `</View>` 직전에 `<BottomTabBar active="none" />` 추가. (이 분기는 ScrollView 없음 → paddingBottom 불요.)
- **정상 분기**: `</ScrollView>`(line 148) 다음, root `</View>` 직전에 `<BottomTabBar active="none" />` 추가.
- `styles.scrollContent`에 `paddingBottom: 24,` 추가.

### B.3 — [id].tsx (#5)

- import 동일.
- **식별자 가드 분기**(line 113~126): `</View>`(center) 다음, root `</View>` 직전에 `<BottomTabBar active="none" />`.
- **404 분기**(line 129~131): §B.4 처리 — `NotFoundScreen`을 `root` View로 감싸고 탭바 형제 추가.
- **정상 분기**: `</ScrollView>`(line 213) 다음 — 현재 `DeleteConfirmDialog`가 ScrollView 형제로 있음. `<BottomTabBar active="none" />`를 `</ScrollView>`와 `DeleteConfirmDialog` 사이(또는 그 다음)에 형제로 추가. 다이얼로그는 오버레이라 순서 무관하나 가독성 위해 탭바를 ScrollView 직후에 둔다.
- `styles.scrollContent`에 `paddingBottom: 24,` 추가.

### B.4 — [id].tsx 404 분기 (특수)

현재:
```
if (notFound) {
  return <NotFoundScreen onBack={handleBack} />;
}
```
변경:
```
if (notFound) {
  return (
    <View style={styles.root}>
      <NotFoundScreen onBack={handleBack} />
      <BottomTabBar active="none" />
    </View>
  );
}
```
`NotFoundScreen`(=`ErrorPage`)이 `flex:1`로 화면을 채우고 탭바가 하단 형제로 고정된다. `styles.root`는 이미 `flex:1` 존재 → 재사용.

### B.5 — _404.tsx (특수)

`NotFoundScreen`만 반환하던 구조를 `View` 래퍼 + 탭바 형제로 변경:
```
import { View, StyleSheet } from 'react-native';
import { BottomTabBar } from '../src/components/BottomTabBar';
...
return (
  <View style={styles.root}>
    <NotFoundScreen title="..." subtitle="..." onBack={handleBack} />
    <BottomTabBar active="none" />
  </View>
);
const styles = StyleSheet.create({ root: { flex: 1 } });
```
`_404`는 `colors`/`StyleSheet` 미import 상태 → `StyleSheet`·`View` import 추가 필요. `backgroundColor`는 `ErrorPage`가 자체 처리하므로 root에 불필요(flex:1만).

---

## C. BottomTabBar.tsx 변경 스펙 (frontend, 컴포넌트 1곳)

1. `export type TabKey = 'home' | 'my';` — **유지**(탭 항목 키는 2개 그대로).
2. `BottomTabBarProps.active` 타입: `TabKey` → **`TabKey | 'none'`**.
3. JSDoc `active` 설명에 "비-탭 화면은 `'none'` 전달 — 어떤 탭도 활성 아님(D63)" 1줄 추가.
4. `handlePress`·`TABS`·`map`·`styles` 등 **그 외 전부 무변경**(§A.1 점검 결과 로직 정합).

> 상단 파일 헤더 JSDoc의 "탭 노출 화면(`/`·`/my-recipes`)이 직접 렌더" 문구는 "모든 화면이 직접 렌더(D63 — 비-탭 화면은 `active='none'`)"로 갱신 권장(주석 일관성). 로직 영향 없음.

---

## D. SSOT 문서 갱신 위치 (architect 직접 갱신함 — §E)

| 문서 | 위치 | 갱신 내용 |
|------|------|----------|
| `docs/adr/ADR-017-...md` | §2 카탈로그 + 변경 이력 | **D63 신규**(D56 대체), D56 원문 보존 + 전방 주석, `active:'none'` 결정 기록 |
| `docs/appsintoss-port/07-ROUTING.md` | §7.8.1 노출 범위 표 | "스택/추천/_404 미렌더" → "전 화면 렌더(`active='none'`)"로 표 갱신 + D63 참조 |
| `docs/appsintoss-port/06-UI-MAPPING.md` | BottomTabBar 관련(§6.1 색 규약은 불변) | 변경 불요(색 규약 그대로). 별도 BottomTabBar 행 없음 → 갱신 불필요 |
| `src/components/AGENTS.md` | `BottomTabBar.tsx` 행 | "`/`·`/my-recipes` 두 화면만 마운트" → "**전 화면 마운트**(비-탭은 `active='none'`)" + props `{ active: 'home'\|'my'\|'none' }` |
| `airecipe-miniapp/CLAUDE.md` | 현재 단계 절 | 하단 탭바 노출 범위 D63 갱신(frontend 구현 완료 후 오케스트레이터/architect 갱신) |

---

## E. 완료 기준 (QA 인계)

- BottomTabBar `active` 타입 `'home'|'my'|'none'`. typecheck PASS.
- 6개 화면(index·my-recipes·generate·recommend·[id]·_404) + [id]의 식별자 가드/404/정상 3분기 + recommend의 가드/정상 2분기 모두에서 탭바 렌더.
- 비-탭 화면에서 두 탭 모두 비활성색(grey500)·`selected:false`. 탭 누름 시 navigate 정상(재포커스).
- generate/recommend/[id] scrollContent `paddingBottom:24` — 콘텐츠 탭바 가림 없음.
- lint 0 errors(router.gen.ts 누적 warning 1건 허용).
- 백엔드/api-client/zod/types/router.gen.ts 변경 0.
