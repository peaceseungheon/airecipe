# 진입 버그 분석 baseline — NotFoundScreen 진입 + 닫기 무동작

> 일자: 2026-05-29
> 작성자: orchestrator (메인 세션 단일 수행)
> 단계: 원인 후보 매트릭스 + 안전 fix 후보 + 사용자 추가 정보 요청.

---

## A. 증상 재확인

1. 토스 인증 통과 후 미니앱 진입.
2. 홈(`/`) 대신 **NotFoundScreen**(`pages/_404.tsx` → `src/components/NotFoundScreen.tsx`)이 표시.
3. ErrorPage 좌측 버튼(현재 카피 "닫기" 또는 "뒤로") 탭 → 무동작.

---

## B. 코드 경로 검토 결과

### B.1 Granite 라우팅 메커니즘 (`@granite-js/react-native@1.0.28`)

- `Granite.registerApp(AppContainer, { appName, context, ... })`로 등록.
- `require.context('./pages')`가 root `pages/` 폴더의 모든 `.ts(x)`를 인덱싱.
- `getRouteScreens(context)` (node_modules/.../router/utils/screen.tsx:23)가:
  - `context(key)?.default ?? routeMap.get(context(key)?.Route?._path)?.component`로 컴포넌트 추출 (양 패턴 지원).
  - `getRoutePath(filePath)`로 `./index.tsx` → `/`, `./recipe/[id].tsx` → `/recipe/:id`, `./_404.tsx` → `/_404`.
- `getScreenPathMapConfig`가 react-navigation linking config 생성:
  - `screensConfig['/'] = { path: '' }` — root 매칭.
  - `screensConfig['/_404'] = { path: '*' }` — **모든 매칭 실패 시 폴백**.
  - `_404` 페이지 미존재 시 throw `'404 page not found.'`.

### B.2 본 미니앱의 페이지 등록

| 파일 (root) | 패턴 | re-export 대상 (src) | route path |
|-------------|------|--------------------|-----------|
| `pages/index.tsx` | `export { Route } from 'pages/index';` | `src/pages/index.tsx` | `/` |
| `pages/my-recipes.tsx` | `export { Route } from 'pages/my-recipes';` | `src/pages/my-recipes.tsx` | `/my-recipes` |
| `pages/recipe/generate.tsx` | `export { Route } from 'pages/recipe/generate';` | `src/pages/recipe/generate.tsx` | `/recipe/generate` |
| `pages/recipe/[id].tsx` | `export { Route } from 'pages/recipe/[id]';` | `src/pages/recipe/[id].tsx` | `/recipe/[id]` (→ `/recipe/:id`) |
| `pages/recipe/recommend.tsx` (Phase 6 신규) | `export { Route } from 'pages/recipe/recommend';` | `src/pages/recipe/recommend.tsx` | `/recipe/recommend` |
| `pages/_404.tsx` | `export default function NotFoundPage()` | (raw 합성 — NotFoundScreen import) | `/_404` (path `*`) |

### B.3 router.gen.ts 검증

- `plugin-router`의 `generateRouterFile()`을 본 사이클에서 직접 호출 시뮬레이션 → Phase 6 수동 갱신과 **내용 동일**(순서만 다름). 자동 생성도 동일 라우트를 등록함.
- 즉 라우트 등록 자체는 정상.

### B.4 babel/metro 측 import 해석

- `babel-preset-granite@1.0.28`은 `[@react-native/babel-preset, @babel/plugin-transform-export-namespace-from]`만 포함 — **`babel-plugin-module-resolver` 없음**.
- `tsconfig.json` `baseUrl: "src"`는 tsc 전용. metro/babel은 영향 없음.
- 그러므로 `pages/index.tsx`의 `from 'pages/index'`는 metro에서:
  - node_modules에 `pages` 패키지 없음 → resolve 실패 가능.
  - **단, Phase 2~5에서 이 패턴 그대로 동작 보고된 적 있는지 사용자 확인 필요**. 만약 실제 dev에서 한 번도 진입 검증 안 했다면 본 issue가 처음 발견된 가능성.

---

## C. 원인 후보 매트릭스

| # | 가설 | 가능성 | 검증 방법 |
|---|------|-------|----------|
| H1 | **앱 이름 미스매치** — `granite.config.ts`의 `appName: 'airecipe'`가 콘솔 등록 prefix와 불일치 → 진입 URL 매칭 실패 → `path: '*'` → `/_404` | **HIGH** | 사용자에게 콘솔 등록 appName 확인 |
| H2 | **shim re-export resolve 실패** — `from 'pages/index'`가 metro에서 resolve 안 됨 → 컴포넌트 등록 실패 → 라우트 미존재 → `/_404` | MEDIUM | metro dev server 로그(stderr) — `Unable to resolve` 메시지 확인 |
| H3 | **진입 URL 비-root path** — 토스 SDK가 default path를 `/`가 아닌 임의 string으로 설정 | MEDIUM | dev server에서 navigation 초기 state 로그 |
| H4 | **`_404.tsx`의 navigation.canGoBack 분기 결함** — Granite 폴백 컨텍스트에서 useNavigation이 일부 메서드 미지원이라 onBack 무동작 (ADR-015 §롤백 R3 사전 기록) | MEDIUM (닫기 무동작은 설명, 진입 시 _404는 별 cause) | _404 코드 단순화 후 재현 |
| H5 | **TossUserIdProvider SDK 호출 실패** — `getAnonymousKey()` throw → ErrorBoundary fallback이 `/_404` | LOW (Granite는 `defaultErrorComponent` 별도라 _404 직결 아님) | useTossUserId catch 흐름 검토 |
| H6 | **`pages/recipe/recommend.tsx` Phase 6 신규가 라우트 등록 break** — Granite의 라우트 path 충돌 또는 검증 실패 | LOW (router.gen.ts 시뮬레이션 PASS) | Phase 6 commit revert 후 재현 |
| H7 | **NotFoundScreen 카피 부적합** — "레시피를 찾을 수 없어요"는 단건 404용. 진입 폴백 _404 카피는 별도여야 함 (UX 결함) | HIGH (UX) | 카피 분리 |

---

## D. 가장 의심되는 cause

**H1 (앱 이름 미스매치) + H7 (카피 부적합) 결합** 가능성 높음.

- Phase 5 commit `dd045c8` → `87625a4 chore: 앱 이름 변경` (airecipe-miniapp → airecipe) 시점에 콘솔/진입 prefix와 미스매치 가능.
- 이미 H7 — 진입 폴백 _404가 "레시피를 찾을 수 없어요"로 떠서 사용자가 "왜 진입했는데 레시피 404?"로 혼동.
- 닫기 무동작은 H4 — `navigation.canGoBack=false` + `navigate('/', {})` 호출했지만 `/` 자체가 매칭 실패면 또 _404 → 사용자 체감 "무동작".

---

## E. 안전 fix 후보 (root cause 미해소 시에도 적용 가능)

### E.1 NotFoundScreen 카피 prop화 (백워드 호환)

- 현재 시그니처: `NotFoundScreenProps { onBack }`.
- 확장: `NotFoundScreenProps { onBack, title?, subtitle?, leftButtonText? }` — default는 현재 카피 유지.
- `_404.tsx`에서 카피 분기: 진입 폴백 시 "원하시는 페이지를 찾을 수 없어요" / 홈으로 이동 안내.
- 단일 컴포넌트 정책(ADR-012 D16) 유지 — 분기는 prop으로만.

### E.2 _404.tsx handleBack 견고화

- `canGoBack` 분기 제거, 항상 `navigation.navigate('/', {})` + 실패 catch.
- 닫기 텍스트 "홈으로" 명시.
- 추가 reload UX는 별 ADR.

### E.3 `appName` 동기화 안내

- 콘솔 등록명 ↔ `granite.config.ts` `appName` 1:1 확인 절차를 09-ENV-CONFIG 또는 10-SPRINT-PLAN에 추가.

---

## F. 사용자에게 확인 요청할 항목

1. **콘솔 등록 정보**: 앱인토스 콘솔에 등록된 미니앱의 `appName`은? (현재 코드: `airecipe`).
2. **진입 경로**: 어떤 방식으로 미니앱에 진입했는지 (토스 앱 메인 → 미니앱 메뉴 / 특정 deeplink / dev server QR / 기타).
3. **dev server 메시지**: `pnpm dev` 또는 `pnpm dev:local`로 띄울 때 metro/babel 측 에러·warning 있었는지 (특히 `Unable to resolve module 'pages/...'`).
4. **닫기 버튼 카피**: ErrorPage에 표시된 닫기 버튼의 정확한 텍스트(좌측·우측). TDS `ErrorPage`는 `onPressLeftButton`/`onPressRightButton` 둘 다 노출 가능.

---

## G. 본 사이클 진행 계획

1. ✅ 분석 baseline 작성(본 문서) + 가설 동결.
2. ⏸ **사용자 응답 대기** — F 4항 정보.
3. fix 결정 + 적용:
   - 정보 응답에 따라 E.1·E.2 단독 또는 결합 적용.
   - root cause가 H1이면 `granite.config.ts` `appName` 조정 + 콘솔 동기 안내.
4. typecheck + lint 통과.
5. QA + session log.
