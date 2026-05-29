# 02 — Frontend 산출 요약: 하단 탭바([홈 / 마이 레시피]) 도입

> 작성: miniapp-frontend. 기준 디렉토리 `airecipe-miniapp/`.
> SSOT: `_workspace/01_architect_baseline.md` §B, ADR-017 (D53~D62), 07-ROUTING §7.8.1.
> 날짜: 2026-05-29

---

## 1. 생성/수정/확인 파일

| 파일 | 작업 | 내용 |
|------|------|------|
| `src/components/BottomTabBar.tsx` | **신규** | 단일 SSOT 하단 탭바 컴포넌트(D57). baseline §B.1 골격 그대로. |
| `src/pages/index.tsx` | 수정 | "마이 레시피" 액세서리 버튼 + `handleOpenMyRecipes` 콜백 제거(D58). `<BottomTabBar active="home" />` 추가. scrollContent `paddingBottom: 24`(D61). PageNavbar는 Title만. |
| `src/pages/my-recipes.tsx` | 수정 | 식별자 가드 분기 + 메인 분기 양쪽에 `<BottomTabBar active="my" />` 추가(early-return 구조라 양쪽 마운트 → 항상 노출). scrollContent `paddingBottom: 24`. 목록/필터/페이지네이션/즐겨찾기/광고 로직 **무변경**. |
| `granite.config.ts` | 수정 | `appName: 'airecipe' → 'airecipe-miniapp'` 원복(D62 — monorepo 병합 회귀 수정). 다른 필드 무변경. |
| `src/components/AGENTS.md` | 수정 | `BottomTabBar` 행 1줄 추가(B.6 선택 항목). |

### 변경 없음(확인)
- `src/router.gen.ts` — 5라우트 그대로(Route-as 5건). 새 라우트 0개(D55).
- `src/_app.tsx` — Provider 추가 불필요(화면별 마운트).
- `pages/*.tsx` shim 5개 — 상대 경로(`../src/pages/...`) 그대로 유지. BottomTabBar 미포함.
- 스택 화면(`recipe/generate`·`[id]`·`recommend`)·`pages/_404.tsx` — BottomTabBar 미렌더(D56, 정적 스캔 확인).
- api-client / hooks / zod / types / services — 무변경(계약 무영향).

---

## 2. BottomTabBar가 사용한 TDS/RN 컴포넌트 (실재 검증 완료 — 본 세션 직접 확인)

| 항목 | 출처 | 실재 근거 (파일:라인) |
|------|------|----------------------|
| `Txt` (`typography`, `color`) | `@toss/tds-react-native` | `dist/esm/components/txt/Txt.d.ts` — `TxtProps { typography: Typography(필수); color?: ColorValue }`. |
| `colors` | `@toss/tds-react-native` → `@toss/tds-colors@0.1.0` | `tds-react-native dist/esm/index.d.ts:64` `export { colors } from '@toss/tds-colors'`. |
| `colors.orange500` (활성 탭) | `@toss/tds-colors@0.1.0` | `colors` Record 키에 `"orange500"` 실재(d.ts grep). light hex 토큰값(`#FF6B00`)이 brand primaryColor(`#FF6B35`) 최근접. `Txt.color?: string` 수용 → 정합. **확정: orange500**(아래 §6.0 참조). |
| `colors.grey500` / `grey200` / `white` | `@toss/tds-colors@0.1.0` | `colors` Record에 키 실재(모두 `string`). 기존 컴포넌트 사용 중. |
| `typography="st11"` | `@toss/tds-typography@0.0.3` | Typography union에 `st11` 존재(`dist/esm/index.d.ts`). 기존 `src/pages/recipe/recommend.tsx:127`에서 사용 중 → 타입 검증된 실재 값. |
| `useNavigation` | `@granite-js/react-native` | 전 페이지 사용. `navigation.navigate('/'\|'/my-recipes', {})`. |
| `Pressable` / `View` / `StyleSheet` | `react-native` | 기존 RecipeCard 등 동일 패턴. |

- **Icon 미사용(D60)**: `IconProps.name`이 자유 문자열이라 미검증 키 렌더 리스크 → 본 v1 라벨 only로 출하.
- **SafeArea: `paddingBottom: 12` 상수 폴백(D61)**: `react-native-safe-area-context`가 `package.json` 선언 의존성이 아니므로 인셋 훅 미사용. 가용 시 `insets.bottom`으로 교체(코드 주석 명시).
- **hex 직접 사용 0건(ADR-015 D39)**: 모든 색 `colors.*` 토큰. 활성 `colors.orange500` / 비활성 `colors.grey500` / 경계 `colors.grey200` / 배경 `colors.white`.

---

## 3. 소비하는 api-client 메서드

- **없음.** 순수 네비게이션/표현 UI. 데이터 호출 경로(`useMyRecipes`/`useToggleFavorite` 등) 무변경. api-client no-op(baseline §E 일치).

---

## 4. 라우트 표 (변경 없음 — 탭바는 기존 라우트 재사용)

| 탭 | 라벨 | navigate 경로 | pages 파일 실재 | 탭바 렌더 |
|----|------|--------------|----------------|-----------|
| home | 홈 | `navigation.navigate('/', {})` | `pages/index.tsx` → `src/pages/index.tsx` | O `active="home"` |
| my | 마이 레시피 | `navigation.navigate('/my-recipes', {})` | `pages/my-recipes.tsx` → `src/pages/my-recipes.tsx` | O `active="my"` |
| — | (상세) | — | `pages/recipe/[id].tsx` | X 미렌더(D56) |
| — | (생성) | — | `pages/recipe/generate.tsx` | X 미렌더(D56) |
| — | (추천) | — | `pages/recipe/recommend.tsx` | X 미렌더(D56) |
| — | (404) | — | `pages/_404.tsx` | X 미렌더(D56) |

- 모든 navigate 대상은 `router.gen.ts` 등록 라우트(`/`, `/my-recipes`)와 1:1 일치. 라우팅 정합 OK.

---

## 5. 검증 결과 (실제 출력 근거)

| 항목 | 명령 | 결과 |
|------|------|------|
| typecheck | `pnpm typecheck` (`tsc --noEmit`) | **PASS** (exit 0, 오류 0) |
| lint | `pnpm lint` (`eslint .`) | **PASS** (exit 0, **0 errors / 1 warning**) |

> 참고: warning 1건은 `src/router.gen.ts:1:1` "Unused eslint-disable directive" — baseline §C Q2가 허용한 누적 warning. 0 errors.

### QA 매트릭스 코드 측 자체 점검 (C §Q1~Q12 — 15개 정적 점검 ALL PASS)
- Q1 typecheck PASS / Q2 lint PASS
- Q3 BottomTabBar 단일 컴포넌트(`src/components/BottomTabBar.tsx` 1개, 중복 정의 0)
- Q4 `navigation.navigate(path, {})` (push 아님, 동일 탭 no-op)
- Q5 탭바 참조는 `src/pages/index.tsx`·`src/pages/my-recipes.tsx` 두 화면에만 — 정적 스캔으로 `D56_TWO_ONLY: True` 확인 (스택/404 미렌더)
- Q6 `index.tsx`에 `AccessoryTextButton`/`handleOpenMyRecipes` 부재 + "오늘의 추천" CTA 유지
- Q7 hex 0건 — `colors.*` 토큰만, 활성/비활성 토큰 구분
- Q8 Icon 미사용 → 라벨 only (안전 경로)
- Q9 탭바 `paddingBottom: 12` + 두 화면 scrollContent `paddingBottom: 24`(가림 방지)
- Q10 `granite.config.ts` `appName: 'airecipe-miniapp'` — 문자열 1:1 확인 완료(디바이스 dev 진입 실증은 QA/외부)
- Q11 router.gen.ts 5라우트 그대로(Route-as 5건)
- Q12 api-client/hooks/zod 변경 0

---

## 6.0 활성 탭 색 토큰 — **확정: `colors.orange500`** (architect 결정)

**확정**: 활성 탭 색 = `colors.orange500`. 비활성 = `colors.grey500`. (architect 결정, 본 차 적용 완료.)

근거:
- `colors.orange500` = `#FF6B00`(light hex 토큰값)으로 brand `primaryColor: #FF6B35`(주황)에 **최근접 실재 토큰**. `@toss/tds-colors@0.1.0` `colors` Record에 키 실재(d.ts grep 확인), `Txt.color?: string` 수용 → typecheck PASS.
- **`colors.primary` 기각**: 설치된 `@toss/tds-colors@0.1.0`에 키 부재 — 사용 시 `TS2339: Property 'primary' does not exist` typecheck 실패로 확인됨.
- **`colors.blue500` 기각**: 실재하나 brand(주황)와 색상 이질 → brand 정체성 불일치로 기각.
- hex 직접 사용 금지(ADR-015 D39) 준수 — `colors.*` 토큰만, hex 0건(D39 SSOT grep `['\"]#[0-9a-fA-F]{3,8}['\"]` over `src/ pages/` → 0 matches).

> 문서 정합(권장 후속): 06-UI-MAPPING §6.1 + ADR-017 §3.3에 활성 탭 토큰 `colors.orange500` 확정 반영(architect/문서 담당).

---

## 6. 미해결 / 주의 사항 (인계)

1. **Q10 dev 진입 실증은 외부**: appName 문자열 코드 측 1:1 확인 완료. 실제 디바이스/샌드박스 dev 진입 시 홈 정상(`/_404` 미표시) + `navigation.getState` `routes[0].path` 매칭은 QA/디바이스 검증 단계에서 최종 확정 필요.
2. **SafeArea 폴백(D61)**: 현재 `paddingBottom: 12` 상수. iOS 홈 인디케이터 겹침은 디바이스 확인 권장. `react-native-safe-area-context` 도입 시 `insets.bottom`으로 교체.
3. **아이콘 부재(D60)**: 라벨 only. 추후 토스 아이콘 레지스트리 `Icon name` 실재 검증 시 라벨+아이콘 확장 가능(후속).
4. **마이 화면 탭바 2회 마운트**: early-return 가드 구조상 가드 분기·메인 분기에 각각 마운트(항상 노출 목적). 두 인스턴스는 상호 배타 분기라 동시 렌더되지 않음. 향후 가드 패턴 리팩터 시 단일 마운트로 합칠 수 있음.

---

## 7. QA 요청

miniapp-qa에게 라우팅 정합성·TDS 실재성·api-client 소비(없음)·탭바 노출 범위(D56)·appName 회귀(D62) 교차 검증 요청. C §Q1~Q12, 특히 Q5/Q6/Q10 우선.

**활성 탭 색 토큰 — 확정 적용 완료**: §6.0 architect 결정 = `colors.orange500`(brand 주황 최근접 실재 토큰). `colors.primary` 부재(TS2339)·`colors.blue500` brand 이질로 기각. 코드 반영 완료(`src/components/BottomTabBar.tsx:70`). 문서(06 §6.1 / ADR-017 §3.3) 토큰 반영은 architect/문서 담당 후속 권장.
