# 02 — Frontend Summary: BottomTabBar 전 화면 노출 (ADR-017 D63)

SSOT: `_workspace/01_architect_baseline.md` §B.4·§B.5, `docs/adr/ADR-017-bottom-tab-navigation.md` §2.1 D63. architect 동결 스펙 그대로 구현. 임의 변경 0.

## 변경 파일 (6)

| 파일 | 변경 내용 | 마운트 분기 수 |
|------|----------|----------------|
| `src/components/BottomTabBar.tsx` | `BottomTabBarProps.active` 타입 `TabKey` → `TabKey \| 'none'` + JSDoc 1줄(D63). TABS/handlePress/map/styles 전부 무변경 | N/A (컴포넌트 정의) |
| `pages/index.tsx` | 변경 없음 — 이미 `active="home"` 마운트(line 76) + paddingBottom 24 | 1 (기존) |
| `pages/my-recipes.tsx` | 변경 없음 — 이미 가드 + 정상 분기 `active="my"` 2곳 + paddingBottom 24 | 2 (기존) |
| `pages/recipe/generate.tsx` | import 추가 + 정상 분기 `</ScrollView>` 다음·root `</View>` 직전 `<BottomTabBar active="none" />` + scrollContent paddingBottom 24 신규 | 1 |
| `pages/recipe/recommend.tsx` | import 추가 + 식별자 가드 분기(`</View>` center 다음, root 닫기 전) + 정상 분기(`</ScrollView>` 다음) 2곳 마운트 + scrollContent paddingBottom 24 신규 | 2 |
| `pages/recipe/[id].tsx` | import 추가 + 식별자 가드 분기 + 404 분기(`<View styles.root>` 래퍼로 NotFoundScreen과 형제, §B.4) + 정상 분기(`</ScrollView>` 다음, DeleteConfirmDialog 형제 앞) 3곳 마운트 + scrollContent paddingBottom 24 신규 | 3 |
| `pages/_404.tsx` | `View`·`StyleSheet` import 추가 + `BottomTabBar` import + NotFoundScreen을 `<View styles.root flex:1>` 래퍼로 감싸 탭바 형제 배치(§B.5) + styles 추가 | 1 |

총 새 마운트 분기: generate 1 + recommend 2 + [id] 3 + _404 1 = **7** (기존 index 1 + my-recipes 2 포함 시 전체 10 마운트 지점).

## active 값 분포
- 탭 화면: index `"home"`, my-recipes `"my"`.
- 비-탭 화면: generate/recommend/[id]/_404 전부 `"none"` — 두 탭 모두 `isActive=false`(grey500), handlePress 가드 미발동(navigate 정상).

## 소비 컴포넌트
- `src/components/BottomTabBar.tsx` (단일 SSOT). api-client 소비 0 — 탭 누름은 `navigation.navigate(path, {})`만. 백엔드/api-client/zod/types/router.gen.ts 변경 0.

## 검증 결과
- `pnpm typecheck` — PASS (exit 0).
- `pnpm lint` — 0 errors, 1 warning(`src/router.gen.ts` 누적 unused eslint-disable, 기대치). exit 0.
