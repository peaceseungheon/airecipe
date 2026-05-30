# 03 — QA 통합 정합성 리포트: 하단 탭바([홈 / 마이 레시피]) 도입

> 작성: miniapp-qa. 기준 디렉토리 `airecipe-miniapp/`.
> 검증 SSOT: `_workspace/01_architect_baseline.md` §C (Q1~Q12), ADR-017 (D53~D62), 02_frontend_summary.md.
> 스킬: `integration-coherence-qa-miniapp` (경계면 교차 비교 + TDS 실재성).
> 날짜: 2026-05-29

---

## 0. 결론 요약

**전체 결과: PASS (12/12). FAIL 0건. 미검증(외부) 1건(Q10 디바이스 실증 — 코드 측은 PASS).**

빌드 통과만으로 완료 처리하지 않고 경계면(navigate↔라우트, 색토큰↔설치본, 탭바 노출↔화면)까지 교차 검증했다. 모든 경계면 정합. 신규 위반 0건.

| 영역 | 결과 |
|------|------|
| 통합 정합성 (navigate ↔ router.gen.ts 라우트 키) | PASS |
| 계약 준수 (api-client/hooks/zod/router.gen.ts 무변경) | PASS |
| TDS 실재성 (Txt/colors/typography 설치본 대조) | PASS |
| 검수 정책 (appName↔deep link prefix, hex 금지, permissions[]) | PASS |
| 코드 품질 (단일 SSOT, 미사용 import 0, 색토큰만) | PASS |

---

## 1. Q1~Q12 PASS/FAIL 매트릭스

| # | 항목 | 기대 | 결과 | 근거 |
|---|------|------|------|------|
| Q1 | typecheck | `pnpm typecheck` PASS | **PASS** | `tsc --noEmit` 직접 실행 → exit 0, 오류 출력 0 (`TYPECHECK_EXIT=0`) |
| Q2 | lint | `pnpm lint` 0 errors (router.gen.ts warning 1건 허용) | **PASS** | `eslint .` exit 0 — **0 errors, 1 warning**. warning은 `src/router.gen.ts:1:1 Unused eslint-disable directive` — baseline이 명시 허용한 Phase 3 누적 router.gen.ts warning 정확히 그 1건. 직접 실행 `LINT_EXIT=0`. (※ frontend summary §5는 "0 warning"이라 기재 — 본 QA 실행에서는 1건 표시. 기준상 허용 범위라 PASS, 다만 summary 기재와 불일치 — §4-5 인계) |
| Q3 | BottomTabBar 단일 컴포넌트 | 1개, 중복 정의 0 (D57) | **PASS** | `src/components/BottomTabBar.tsx` 1개만 정의(`export function BottomTabBar`). `grep -rln BottomTabBar` → 정의 1 + 소비 2 |
| Q4 | 탭 전환 | `navigate('/'\|'/my-recipes', {})`, push 아님 (D55) | **PASS** | `BottomTabBar.tsx:51` `navigation.navigate(path, {})`. `path: '/' \| '/my-recipes'`(L49). push/reset 0건. 동일 탭 no-op(L50). 두 path 모두 router.gen.ts 등록 라우트 |
| Q5 | 탭바 노출 범위 | `/`·`/my-recipes`만 (D56) | **PASS** | import는 `src/pages/index.tsx:21`·`src/pages/my-recipes.tsx:33` **두 화면에만**. `src/pages/recipe/*`·`pages/` shim 5개 → grep 0건 |
| Q6 | 홈 중복 진입점 제거 | `index.tsx` AccessoryTextButton 부재(D58), 추천 CTA 유지 | **PASS** | `index.tsx` AccessoryTextButton/handleOpenMyRecipes/AccessoryButtons grep 0건. "오늘의 추천 받기" CTA(`index.tsx:71` + `handleOpenRecommend:38`) 유지 |
| Q7 | 색 토큰 | hex 0건, `colors.*`만, 활성/비활성 구분 (D39) | **PASS** | `BottomTabBar.tsx` hex(`#xxx`) grep 0건. 활성 `colors.blue500`(L71) / 비활성 `colors.grey500`(L71) / 경계 `colors.grey200`(L86) / 배경 `colors.white`(L87) |
| Q8 | 아이콘 | 추가 시 Icon name 실재 근거, 미검증이면 라벨 only | **PASS** | Icon 미사용(grep 0건). 라벨 only 출하(D60 안전 경로) |
| Q9 | SafeArea | 하단 패딩 + ScrollView paddingBottom 가림 없음 (D61) | **PASS** | `BottomTabBar.tsx:88` `paddingBottom: 12`. 두 화면 scrollContent `paddingBottom: 24`(`index.tsx:89`, `my-recipes.tsx:264`) |
| Q10 | appName 회귀 | `'airecipe-miniapp'` (D62) | **PASS (코드 측)** | `granite.config.ts:7` `appName: 'airecipe-miniapp'`. HEAD 커밋 blob도 동일 값. 디바이스 dev 진입 실증은 외부 |
| Q11 | router.gen.ts | 변경 0 — 5라우트 그대로 | **PASS** | `git status` clean. `git diff HEAD -- src/router.gen.ts` empty. 5라우트(`/`·`/my-recipes`·`/recipe/:id`·`/recipe/generate`·`/recipe/recommend`) 유지 |
| Q12 | 데이터 경로 | api-client/hooks/zod 변경 0 | **PASS** | `git diff HEAD -- src/services src/hooks src/lib/zod src/types` empty. BottomTabBar는 api-client 메서드 0개 소비(순수 네비게이션 UI) |

---

## 2. 통과 상세 (경계면 교차 비교)

### 2.1 통합 정합성 — navigate 호출 ↔ 등록 라우트 (Q4·Q5)
양쪽 동시 읽기로 1:1 대조 (생산자: `src/router.gen.ts` / 소비자: `navigation.navigate` 전수):

| navigate 대상 | 호출 위치 | router.gen.ts 등록 | 정합 |
|--------------|----------|-------------------|------|
| `'/'` | BottomTabBar.tsx (path 변수 L41,L49) | `'/'` (L11) | OK |
| `'/my-recipes'` | BottomTabBar.tsx (path 변수 L42,L49) | `'/my-recipes'` (L12) | OK |
| `'/recipe/:id'` | my-recipes.tsx:66, generate.tsx:106, recommend.tsx:106 | `'/recipe/:id'` (L13) | OK |
| `'/recipe/generate'` | index.tsx:33, my-recipes.tsx:72 | `'/recipe/generate'` (L14) | OK |
| `'/recipe/recommend'` | index.tsx:39, my-recipes.tsx:42 | `'/recipe/recommend'` (L15) | OK |

- **라우트 키 표기 정합 교차 확인 완료**: 코드는 동적 세그먼트를 `'/recipe/:id'`(콜론)로 호출하고 router.gen.ts도 `'/recipe/:id'`로 등록 — 일치. pages 파일명 `[id].tsx`(브래킷)은 Granite 파일 라우팅 규약이고, 등록 키/navigate 키는 콜론 표기로 일관. 불일치 없음.
- 탭바의 `path`는 `'/' | '/my-recipes'` 유니온 타입(L40,L49)으로 좁혀져 있어 오타 라우트 컴파일 차단. typecheck PASS가 `RegisterScreenInput` 키와의 일치를 보증.

### 2.2 TDS 실재성 — 설치본 직접 대조 (표본 ≥5)
06/baseline 인용을 설치본 `node_modules`와 직접 교차(SDK 버전별 시그니처 차이 검증):

패키지는 pnpm 격리 설치로 resolve된다 — `node_modules/.pnpm/@toss+tds-colors@0.1.0/...`, `node_modules/.pnpm/@toss+tds-typography@0.0.3/...` (frontend가 보고한 버전과 **정확히 일치**). 각 토큰을 resolve된 실제 경로에서 직접 grep으로 대조:

| 인용 항목 | baseline/summary 주장 | 설치본 실제 (resolve된 경로) | 실재 |
|-----------|----------------------|------------------------------|------|
| `Txt` | `dist/esm/components/txt/Txt.d.ts` | `tds-react-native/dist/esm/index.d.ts:49 export * from './components/txt'` + `components/txt/Txt.d.ts` 실존 | **OK** (경로·export 일치) |
| `Txt` props `typography`/`color` | `TxtProps { typography 필수; color? }` | `components/txt/Txt.d.ts` + `typography.d.ts` 존재. typecheck PASS가 `typography="st11"`·`color` 수용 보증 | OK |
| `colors` | `index.d.ts:64 re-export` | `tds-react-native/dist/esm/index.d.ts:64 export { colors } from '@toss/tds-colors'` | OK |
| `colors.blue500` (활성) | `@toss/tds-colors@0.1.0`에 실재 | PRESENT (`@toss+tds-colors@0.1.0` 직접 grep) | OK |
| `colors.grey500`/`grey200`/`white`/`grey900`/`grey700` | 실재 | 모두 PRESENT | OK |
| `colors.red700`/`red50` (my-recipes 에러 UI) | 실재 | 모두 PRESENT | OK |
| `colors.primary` (D59 1순위) | **부재** | **ABSENT** (grep 0건, `@toss+tds-colors@0.1.0`) | 부재 확인 — 폴백 `blue500` 채택 정당 |
| `colors.orange500` (brand 근접 후보) | 미채택, architect 회부 | PRESENT | (회부 사안 — §4-2) |
| `typography="st11"` | `@toss/tds-typography@0.0.3` union | PRESENT (`@toss+tds-typography@0.0.3` + `tds-react-native typographyMap`에도 존재) | OK |
| `useNavigation` | granite export | `@granite-js/react-native@1.0.28` 전 페이지 사용, typecheck PASS | OK |

→ **TDS 실재성 PASS** (표본 10개 ≥5 요건 충족). 존재하지 않는 컴포넌트/토큰 가정 0건. 가공된 props 0건. baseline §A.2 / summary §2의 인용 경로(`components/txt/Txt.d.ts`)·버전(`tds-colors@0.1.0`/`tds-typography@0.0.3`)이 설치본과 정확히 일치 — frontend의 실재성 보고가 검증됨. `colors.primary` 부재는 frontend가 정확히 식별하고 문서화된 폴백(`blue500`)을 채택, typecheck PASS로 안전성 입증.

### 2.3 계약 무영향 — git 교차 검증 (Q11·Q12)
- `git status --short` → clean. 작업 트리 == HEAD. 탭바 4파일(BottomTabBar/index/my-recipes/granite.config) + AGENTS.md는 병합 이력 내 커밋 상태이며 HEAD blob과 작업 트리 동일.
- `git diff HEAD -- src/router.gen.ts src/services src/hooks src/lib/zod src/types` → empty. 계약·데이터 경로 무변경 확정.
- BottomTabBar 소비 api-client 메서드 = 0 (summary §3 일치). 직접 `fetch(`/`XMLHttpRequest` 0건.

### 2.4 검수 정책 (appsintoss-publish-checklist 관점)
- **appName ↔ deep link prefix 1:1**: `granite.config.ts:7 appName: 'airecipe-miniapp'` — 콘솔 등록 prefix `intoss://airecipe-miniapp`와 동기(D62 회귀 수정 완료). hotfix root cause #1 재발 방지.
- **권한 최소화**: `permissions: []` 유지(탭바는 권한 무요구).
- **hex 미포함 / TDS 토큰 의무**: 신규 컴포넌트 hex 0건(ADR-015 D39 준수).
- **키·시크릿 미포함**: 탭바는 네트워크 0 — 해당 없음.
- **번들 영향**: 새 의존성 0개(react-navigation/safe-area-context 미추가 — 방식 C 채택 효과). 번들 증가 무시 가능.

### 2.5 코드 품질
- 단일 SSOT 컴포넌트(D57) — `BottomTabBar` 1개를 두 화면이 `active` prop으로 재사용. 중복 정의 0.
- 미사용 import 0 (lint PASS). 홈에서 PageNavbar 액세서리 제거 후 잔여 import 없음.
- 계층 분리 준수 — 탭바는 표현/네비게이션만, 데이터 호출 0.
- Icon/SafeArea 미검증 항목을 가정하지 않고 안전 폴백(라벨 only, paddingBottom 상수) 채택 — 추측 0.

---

## 3. 실패 (수정 필요)

**없음 (0건).**

---

## 4. 미검증 / 인계 (FAIL 아님)

1. **Q10 디바이스 dev 진입 실증 (외부)**: appName 문자열 코드 측 1:1 PASS. 실제 디바이스/샌드박스에서 `intoss://airecipe-miniapp` 진입 시 홈 정상(`/_404` 미표시) + `navigation.getState` `routes[0].path` 매칭은 디바이스 검증 단계에서 최종 확정. (baseline §C 주석과 일치 — 코드 측 한계까지 검증 완료.)

2. **활성 탭 색 토큰 — architect 결정 대기 (회부 사안, 차단 아님)**: 현재 `colors.blue500` 채택(D59·baseline §B.1 #1 명시 폴백, `tds-colors@0.1.0`에 실재, typecheck PASS). `colors.primary`는 설치본에 **부재**(QA 직접 grep 0건으로 확인 — frontend 보고 검증됨). brand `primaryColor: '#FF6B35'`(주황) 근접 `colors.orange500`(설치본 실재) 전환 여부는 시각 정체성 결정. **통지 대상: miniapp-architect** — D59 / 06-UI-MAPPING §6.1 / ADR-017 §3.3 확정 후 갱신 권장. 어느 쪽이든 hex 금지·TDS 토큰 원칙은 충족되어 출시 차단 아님.

3. **SafeArea iOS 홈 인디케이터 겹침 (디바이스 확인 권장)**: `paddingBottom: 12` 상수 폴백(D61). `react-native-safe-area-context` 미선언 의존성이라 인셋 훅 미사용은 정합한 결정. iOS 실기 겹침 여부만 디바이스에서 확인 권장(후속).

4. **(해당 없음 — 철회)**: 초기 QA 1차 grep에서 Txt 경로 불일치로 의심했으나, pnpm resolve 경로 재검증 결과 baseline/summary 인용 경로(`components/txt/Txt.d.ts`)가 설치본과 정확히 일치함을 확인. 문서 정정 불필요.

5. **frontend summary §5 lint warning 기재 불일치 (문서 정합, 비차단)**: summary §5는 "0 warning"이라 기재했으나 본 QA 실행에서 `src/router.gen.ts:1:1 Unused eslint-disable directive` warning 1건 표시됨. 이는 baseline Q2가 명시 허용한 누적 1건이라 **기준상 PASS**. 다만 산출 요약과 실제 출력이 불일치하므로 통지. **통지 대상: miniapp-frontend** — summary §5 lint 결과 "0 errors / 1 warning(허용)"으로 정정 권장. (선택: `eslint --fix`로 해당 directive 제거 시 0/0 가능하나 router.gen.ts는 자동생성 파일이라 다음 `granite build`에서 재생성되므로 무의미 — 현 상태 허용 유지 권장.)

---

## 5. 팀 통지

- **frontend**: 코드 측 Q1~Q12 ALL PASS. FAIL 0. 추가 수정 요청 없음. (비차단) summary §5 lint 기재 "0 warning" → "0 errors / 1 warning(허용)"으로 정정 권장(§4-5). 활성 색 토큰은 architect 결정 반영만 대기.
- **architect**: 활성 탭 색 토큰 확정(§4-2, `blue500` vs `orange500`) — frontend 회부 건 QA 검증 완료(`primary` 설치본 부재 + `blue500`/`orange500` 실재 직접 확인), 결정 권한은 architect. D59 / 06-UI-MAPPING §6.1 / ADR-017 §3.3 갱신. 출시 차단 아님.
- **api-client**: no-op 확정 (계약·데이터 경로 git diff empty).
- **백엔드 영향**: 없음.

---

## 6. 검증 명령 출처 (재현 가능)

```
pnpm typecheck                               # exit 0, 오류 0 (Q1)
pnpm lint                                     # exit 0, 0 errors / 1 warning(router.gen.ts, 허용) (Q2)
grep -rln BottomTabBar src pages             # 정의 1 + index/my-recipes 2 (Q3/Q5)
grep -n "AccessoryTextButton" src/pages/index.tsx   # 0건 (Q6)
grep -nE "#[0-9a-fA-F]{3,8}" src/components/BottomTabBar.tsx  # 0건 (Q7)
grep -n appName granite.config.ts            # 'airecipe-miniapp' (Q10)
git status --short / git diff HEAD -- <contract>    # clean / empty (Q11/Q12)
# TDS 토큰 실재성 — pnpm 격리 설치 경로에서 직접 grep:
grep -roh "blue500|grey500|grey200|white|primary|orange500" \
  node_modules/.pnpm/@toss+tds-colors@0.1.0/node_modules/@toss/tds-colors  # primary만 ABSENT
grep -rl st11 node_modules/.pnpm/@toss+tds-typography@0.0.3/node_modules/@toss/tds-typography  # PRESENT
grep -n "export \* from './components/txt'" \
  node_modules/@toss/tds-react-native/dist/esm/index.d.ts  # Txt export (L49)
```

---

# 03b — 라우트 통합 검증 (ADR-018: src/pages → pages 통합)

> 작성: miniapp-qa (독립 재검증). 날짜: 2026-05-30.
> 검증 대상: arch-consolidate(ADR-018·문서·pages/AGENTS.md) + fe-consolidate(shim 5개 실구현 교체·src/pages 삭제).
> 방법: 보고 불신 — 직접 실행·grep 교차 검증. 정답 기준 = 기존 pages/_404.tsx.

## 결론 요약 — 라우트 통합

**전체 결과: GO. FAIL 0건. MINOR(비차단) 1건.**
7개 검증 항목 PASS. typecheck 0 errors / lint 0 errors(기지 warning 1건). 경계면(파일경로↔라우트경로↔router.gen↔navigation) 전부 정합.

## 항목별 결과

### 1. 라우팅 루트 일관성 — PASS
- `require.context.ts`: `require.context('./pages')` — 루트 pages/ 스캔 확인.
- `src/router.gen.ts`: 5개 라우트 모두 `from '../pages/...'` import (index/my-recipes/recipe/[id]/recipe/generate/recipe/recommend).
- 파일↔라우트 1:1 매핑 (createRoute 인용 — 파일:라인):
  - `/` ← pages/index.tsx:24 `createRoute('/')`
  - `/my-recipes` ← pages/my-recipes.tsx:43 `createRoute('/my-recipes')`
  - `/recipe/:id` ← pages/recipe/[id].tsx:39 `createRoute('/recipe/:id')` (router.gen `'/recipe/:id'` 선언과 일치)
  - `/recipe/generate` ← pages/recipe/generate.tsx:45 `createRoute('/recipe/generate')`
  - `/recipe/recommend` ← pages/recipe/recommend.tsx:30 `createRoute('/recipe/recommend')`
- navigation.navigate 호출 값 전부 등록 라우트 키와 매칭: `/`, `/recipe/generate`, `/recipe/recommend`, `/recipe/:id`, `/my-recipes`. 미등록 라우트로의 navigate 0건.
  - 주: navigate는 런타임 형(`/recipe/:id`), 07-ROUTING 산문은 파일 규약형(`/recipe/[id]`) — Granite 규약상 동일 라우트, createRoute/router.gen이 `:id`로 통일돼 정합.

### 2. shim 잔재 0 — PASS
- grep `export { Route } from`·`../src/pages`·`from '../../src/pages` → pages/ 전체 0건.
- 5개 파일 모두 실제 컴포넌트 구현(createRoute + 화면 함수 + TDS import). re-export shim 아님.
- `_404.tsx` 불변 — 원래 실구현(NotFoundScreen 결합) 유지.

### 3. import 깊이 정합 — PASS
- pages/*.tsx의 모든 `../src/...`(depth1) / `../../src/...`(depth2) import를 실모듈로 해석 → 26건 전부 존재(끊긴 import 0).
  - top-level(index/my-recipes): `../src/{components,hooks,lib}/...` ✓
  - recipe 하위([id]/generate/recommend): `../../src/{components,hooks,lib}/...` ✓
- `_404.tsx` 정답 패턴(`../src/components/NotFoundScreen`)과 동일 깊이 규약 일치.

### 4. src/pages 완전 부재 — PASS
- `find` 결과 pages 디렉터리는 루트 `./pages`만. src/pages 디렉터리·파일 0건.

### 5. 살아있는 src 코드의 src/pages 참조 0건 — PASS
- 살아있는 `.ts/.tsx`(workspace/node_modules/.granite/router.gen 제외) 내 `src/pages` 참조 0건.
- 살아있는 문서: AGENTS.md(27/28/79/116)·pages/AGENTS.md(24)의 `src/pages` 표기는 전부 "shim 제거·신규 생성 금지" 서술(ADR-018 인지) — stale 경로 표기 아님, 정상.
- 06/10/11 SSOT: `src/pages` 참조 0건 (ADR-018 line 80 문서 갱신 완료). 07-ROUTING도 전부 `pages/...` 표기(line 27 `src/app/...`는 백엔드 경로, 무관).
- 역사적 ADR(010~017)의 `src/pages` 인용은 전부 ADR-018 전방참조 주석 동반 또는 시점 기록 — 정책상 허용.

### 6. 빌드 게이트 — PASS
- `pnpm typecheck` → exit 0, 0 errors.
- `pnpm lint` → exit 0, `0 errors, 1 warning`. warning = `src/router.gen.ts:1 Unused eslint-disable directive` — ADR-010 §6.4 기지(자동생성) 누적 warning. 신규 error/warning 0.

### 7. 문서 정합 — PASS
- `pages/AGENTS.md` 존재. 헤더 `# pages — Granite 파일 기반 라우팅...` (요건 `# pages...` 충족).
- `../docs/...` 상대 링크 표본(ADR-005/009~018, 07-ROUTING, 08-STREAMING) 전부 실파일 가리킴 — 끊김 0.
- `docs/adr/ADR-018-route-pages-consolidation.md` 존재.

## MINOR (비차단, arch-consolidate 권고)
- CLAUDE.md:95-96 — ADR-017(하단 탭바) 섹션이 BottomTabBar 수정 파일을 `src/pages/index.tsx`·`src/pages/my-recipes.tsx`로 표기. ADR-017 사이클의 시점 기록(바로 위 75-80 ADR-018 섹션이 대체 명시)이라 정책상 허용 범위지만, "현재 단계" 블록 하위라 `pages/`로 갱신하면 더 깔끔. 코드·빌드·라우팅 무영향. 책임: arch-consolidate(문서). 차단 아님.

## 최종 판정: **GO** (라우트 통합 — 경계면 전부 정합, 빌드 통과, FAIL 0)
