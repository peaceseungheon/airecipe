# 03 — QA Report: BottomTabBar 전 화면 노출 (ADR-017 D63)

검증자: miniapp-qa. 기준 디렉토리 `airecipe-miniapp/`.
SSOT: `docs/adr/ADR-017-bottom-tab-navigation.md` §2.1 D63, `_workspace/01_architect_baseline.md`(§B 표·§B.4·§B.5), `_workspace/02_frontend_summary.md`.
방법: 양쪽 동시 읽기(스펙 ↔ 구현) + git diff 교차 + 빌드 게이트 직접 실행.

## 최종 verdict: **GO** — 7/7 PASS, FAIL 0건

---

## 항목별 결과

### 1. 전 화면 노출 실재성 — **PASS**

6개 페이지 전 렌더 분기에서 `<BottomTabBar ...>` 마운트 확인(파일:라인). 분기 트리별 교차 확인:

| 페이지 | 분기 | 마운트 라인 | active |
|--------|------|------------|--------|
| `pages/index.tsx` | 정상(단일) | :76 | `"home"` |
| `pages/my-recipes.tsx` | 식별자 가드 | :122 | `"my"` |
| `pages/my-recipes.tsx` | 정상(로딩/에러/빈/목록 4-way 공통 부모 root) | :251 | `"my"` |
| `pages/recipe/generate.tsx` | 정상(단일 ScrollView, early-return 없음) | :241 | `"none"` |
| `pages/recipe/recommend.tsx` | 식별자 가드 | :61 | `"none"` |
| `pages/recipe/recommend.tsx` | 정상(미선택/로딩/에러/정상 분기 공통 부모 root) | :152 | `"none"` |
| `pages/recipe/[id].tsx` | 식별자 가드 | :125 | `"none"` |
| `pages/recipe/[id].tsx` | 404 분기(View 래퍼로 NotFoundScreen과 형제, §B.4) | :135 | `"none"` |
| `pages/recipe/[id].tsx` | 정상(로딩/에러/정상 분기 공통 부모 root, ScrollView 직후·Dialog 형제) | :222 | `"none"` |
| `pages/_404.tsx` | 폴백(View 래퍼로 NotFoundScreen과 형제, §B.5) | :57 | `"none"` |

- 핵심 검증: generate/recommend/[id]/my-recipes 정상 분기는 `isLoading/error/data` 등을 ScrollView **내부**에서 분기하고 ScrollView·탭바는 `root` View의 공통 형제다. 따라서 내부 상태 분기와 무관하게 탭바가 항상 렌더 — 분기별 별도 마운트 불요(스펙 정합). early-return(별도 JSX 트리 반환)하는 분기(가드·404·_404)에는 각각 직접 마운트 확인. **누락 0건.**
- git diff 교차: 신규 마운트 7개(generate 1 + recommend 2 + [id] 3 + _404 1) — frontend summary와 일치. index/my-recipes는 prior cycle에서 이미 마운트(working tree == HEAD, 변경 0).

### 2. active prop 정합 — **PASS**

- 타입: `BottomTabBar.tsx:39` `active: TabKey | 'none'`(`TabKey = 'home' | 'my'`, :32). 탭 화면 `"home"`/`"my"`, 비-탭 4종 `"none"` 전달 — 전수 일치(항목 1 표).
- `'none'` 로직 정합(코드 성립 확인):
  - no-op 가드 `:52` `if (key === active) return` → `'home'!=='none'` ∧ `'my'!=='none'` → 미발동, 두 탭 navigate 정상.
  - `isActive = tab.key === active`(:61) → `'none'`에서 두 탭 모두 `false`.
  - 색(:73) `isActive ? colors.orange500 : colors.grey500` → 두 탭 `grey500`(비활성색).
  - 접근성(:68) `accessibilityState={{ selected: isActive }}` → 두 탭 `selected:false`.
- `TABS`/`map`/`handlePress`/`styles` 무변경 — git diff상 `BottomTabBar.tsx` 변경은 JSDoc 3줄 + 타입 `TabKey` → `TabKey | 'none'` **단 한 곳**(로직 0줄). 스펙 §C 정합.

### 3. import 경로 정합 — **PASS**

- depth1(`pages/*.tsx`): index/my-recipes/_404 모두 `'../src/components/BottomTabBar'` ✓
- depth2(`pages/recipe/*.tsx`): generate/recommend/[id] 모두 `'../../src/components/BottomTabBar'` ✓
- typecheck PASS(아래 항목 7)가 모든 경로 해석 성립을 보증. 깨진 경로 0건.

### 4. paddingBottom 정합 — **PASS**

- generate/recommend/[id] 정상 분기 `scrollContent`에 `paddingBottom: 24` **신규 추가** 확인(git diff: 각 파일 `+    paddingBottom: 24,` 1건). 추가 전 미적용 → 추가 후 1회 — 콘텐츠 탭바 가림 방지.
- index/my-recipes는 기존 24 유지(변경 0).
- 가드 분기·404 분기(ScrollView 없음)는 paddingBottom 불요 — 스펙 §B 정합.

### 5. 회귀 없음 — **PASS**

- git diff HEAD 전체 변경 파일: `BottomTabBar.tsx`·`pages/_404.tsx`·`pages/recipe/[id].tsx`·`generate.tsx`·`recommend.tsx`(코드 5) + `ADR-017`·`07-ROUTING.md`·`src/components/AGENTS.md`(문서 3) + `_workspace/*`(산출물). **그 외 0.**
- 금지 변경 대상 전수 확인(diff 부재 = 변경 0): `src/router.gen.ts` ✓, `src/services/api-client.ts`/`recipes.ts` ✓, `src/lib/zod/**` ✓, `src/types/api.ts` ✓, `src/_app.tsx` ✓, `granite.config.ts` ✓.
- 기존 로직(목록/필터/페이지네이션/즐겨찾기/광고/SSE/저장/404 폴백) 코드 무변경 — 본 차 변경은 각 페이지에 탭바 마운트 1줄(+import) + scrollContent paddingBottom 1줄에 국한.
- 참고(비-FAIL): `granite.config.ts:7` `appName: 'airecipe'`. ADR-017 D62는 `'airecipe-miniapp'` 원복을 동결했으나, 이후 커밋 `c491ac6`("앱인토스 콘솔에 저장되어 있는 앱이름으로 수정")가 콘솔 등록명 `'airecipe'`로 의도적으로 재설정. **D63 작업 범위 밖(granite.config.ts 변경 0이 본 작업 요구이며 충족)** — 본 검증의 FAIL 아님. 단, 콘솔 deep link prefix ↔ appName 1:1 동기는 출시 전 외부 작업으로 architect 재확인 권고(정보성).

### 6. 문서↔구현 정합 — **PASS**

- `ADR-017` §2.1 D63/D63a~e: `active: TabKey|'none'`, 전 화면 마운트, early-return 분기 마운트, 404/폴백 View 래퍼, paddingBottom 24 — 구현과 일치.
- `07-ROUTING.md` §7.8.1: 노출 범위 표가 6화면 전체 + `active="none"`(비-탭) + early-return 분기 명시로 갱신됨. D55 재포커스 불변 명시. 구현 일치.
- `src/components/AGENTS.md` BottomTabBar 행: props `{ active: 'home'|'my'|'none' }` + "전 화면 마운트" + 비-탭 `'none'` 비활성색/`selected:false`로 갱신. 구현 일치.
- 미세 잔존(비-FAIL, 프리-D63·D63 범위 밖): 07 §7.8.1 본문 "활성 색 = TDS `colors.primary` 계열 토큰" 1줄은 D53~D62 시점 텍스트로, 실제 채택색은 ADR-017 §3.3·D59가 `colors.orange500`으로 확정(`colors.primary`는 `@toss/tds-colors@0.1.0` 부재). 구현(`BottomTabBar.tsx:73`)은 `orange500` 정상. 문서 표현 정합화는 architect 후속 권고(정보성).

### 7. 빌드 게이트 — **PASS**

- `pnpm typecheck`(tsc --noEmit): exit 0, 에러 0. (`as`/`any` 우회 없음 — BottomTabBar 변경은 union 타입 확장뿐.)
- `pnpm lint`(eslint .): exit 0, **0 errors, 1 warning** — `src/router.gen.ts:1` "Unused eslint-disable directive"(누적 허용분 정확히 1건). 신규 코드발 warning 0.

---

## 통지

- **수정 요청 없음** — frontend 산출물 결함 0. architect 계약/정책 결함 0.
- **정보성(architect 후속 권고, 비차단):**
  1. 07-ROUTING §7.8.1 "활성 색 = `colors.primary` 계열" 문구를 `colors.orange500`로 정합화(D59 반영) — 구현은 이미 정상.
  2. `granite.config.ts` `appName='airecipe'`(D62 원복이 `c491ac6`로 재설정됨) ↔ 콘솔 등록 deep link prefix 1:1 동기 출시 전 디바이스 실증 — 본 D63 범위 밖, 진입 폴백 회귀 방지 차원.

## 외부 작업 PENDING (코드 측 검증 범위 밖)

- 디바이스/샌드박스 dev 진입 실증: 전 화면에서 하단 탭 노출·탭 누름 재포커스·iOS SafeArea 하단 겹침(현재 `paddingBottom: 12` 상수 폴백, D61).
