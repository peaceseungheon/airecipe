# 진입 폴백 hotfix QA report — 4 root cause 확정 + 모두 fix + 정상 진입 검증

> 일자: 2026-05-29
> 결과: **4 root cause 모두 확정 + fix 적용 후 사용자 dev 검증으로 정상 동작 확인**. typecheck PASS, lint 0 errors(Phase 3 누적 router.gen.ts warning 1건만).

## ★ 본 root cause 추가 확정 (진단 로그로 확정)

`pages/_404.tsx`에 추가한 `__DEV__` `navigation.getState` 진단 로그가 결정적 단서를 제공:

```json
{
  "routeNames": ["/_404", "/", "/my-recipes", "/recipe/:id", "/recipe/generate", "/recipe/recommend"],
  "routes": [{ "name": "/_404", "path": "-miniapp", "key": "..." }]
}
```

- `routeNames` 6개 모두 등록 정상 → 라우트 등록 문제 아님.
- `routes[0].path = "-miniapp"` → 진입 deep link `intoss://airecipe-miniapp`에서 SDK가 prefix `intoss://airecipe`(코드 `appName: 'airecipe'`)를 strip → 잔여 `"-miniapp"` → 어떤 라우트와도 매칭 안 됨 → wildcard `*` → `/_404` 폴백.
- **commit `87625a4 chore: 앱 이름 변경`**(`airecipe-miniapp` → `airecipe`)가 콘솔 등록 deep link prefix와 미스매치를 만든 정확한 원인.

**fix**: `granite.config.ts` `appName: 'airecipe-miniapp'`로 원복.

## A. 확정 root cause: TDS ErrorPage 좌·우 버튼 카피 하드코딩 매핑 오류

### A.1 TDS 실 구현 검증 (`node_modules/.../ErrorPage.js`)

`@toss/tds-react-native@2.0.3`의 `ErrorPage`는 좌·우 두 버튼 카피를 **하드코딩**:

| 버튼 위치 | 카피 | 핸들러 prop |
|----------|------|------------|
| 좌측 | "고객센터 문의" (statusCode 무관) | `onPressLeftButton` |
| 우측 (404·기본) | "닫기" | `onPressRightButton` |
| 우측 (400) | "다시 입력하기" | `onPressRightButton` |

### A.2 이전 NotFoundScreen 코드 결함 (Phase 3 commit 이래 누적)

```tsx
// 결함 코드
<ErrorPage
  statusCode={404}
  title="레시피를 찾을 수 없어요"
  subtitle="삭제되었거나 다른 사용자의 레시피일 수 있어요."
  onPressLeftButton={onBack}   // ← 좌측 "고객센터 문의"에 onBack 잘못 바인딩
/>
// onPressRightButton 미설정 → 우측 "닫기" 무동작
```

**사용자 보고와 정확히 일치**: "닫기 버튼을 눌러도 동작하지 않아."

### A.3 fix 후 (Phase 본 사이클)

```tsx
<ErrorPage
  statusCode={404}
  title={title}                            // default + override 가능
  subtitle={subtitle}                      // default + override 가능
  onPressLeftButton={onContactSupport}     // 좌측 "고객센터 문의" — 현재 미연동
  onPressRightButton={onBack}              // 우측 "닫기" — 정상 바인딩
/>
```

## B. 부수 fix: `_404.tsx` 카피 분리 + 진입 폴백 진단 로그

- 진입 시 _404가 떴을 때 "레시피를 찾을 수 없어요" 카피는 부적합 → "원하시는 화면을 찾지 못했어요" / "홈으로 이동해서 다시 시도해주세요"로 분기.
- `handleBack`: `navigate('/', {})` try → 실패 시 `goBack()` 폴백.
- `__DEV__` 환경에서 `console.warn('[airecipe-miniapp] _404 fallback rendered. Check route matching / initial URL.')` 1회 — 사용자의 dev 진입 시점 로그 확보용.

## C. 검증 매트릭스

| # | 항목 | 결과 |
|---|------|------|
| Q1 | TDS ErrorPage 카피 매핑 (좌="고객센터 문의" / 우 404="닫기") 실 구현(`node_modules/.../ErrorPage.js`) 검증 | PASS |
| Q2 | NotFoundScreen 신 props `onBack`이 `onPressRightButton`에 바인딩 | PASS |
| Q3 | `onContactSupport?` 좌측 "고객센터 문의" prop화(default undefined → 좌측 무동작) | PASS — 별 ADR로 CS 연동 진화 |
| Q4 | title/subtitle prop화 + default 카피 유지 | PASS |
| Q5 | 기존 사용처 `src/pages/recipe/[id].tsx:130` 백워드 호환 (`onBack`만 전달 → default 카피 유지) | PASS |
| Q6 | `_404.tsx` 카피 분기 — 진입 폴백용 다른 텍스트 | PASS |
| Q7 | `_404.tsx` handleBack 견고화 — try-catch + canGoBack 폴백 | PASS |
| Q8 | `_404.tsx` __DEV__ console.warn 진단 로그 | PASS |
| Q9 | typecheck PASS | PASS |
| Q10 | lint 0 errors (router.gen.ts Phase 3 누적 warning 1건만) | PASS |

## D. 진입 시 _404 표시 root cause — 확정 (appName 미스매치)

### D.1 가설 매트릭스 최종

| # | 가설 | 결과 |
|---|------|------|
| H1 | appName 미스매치 | **CONFIRMED** — 사용자 응답 "콘솔 airecipe"는 다른 필드(displayName 등)였고, 실 deep link prefix는 `airecipe-miniapp`. `navigation.getState`의 `routes[0].path = "-miniapp"`로 확정 |
| H2 | shim resolve 실패 | 기각 (metro 에러 없음) |
| H3/H4/H10 | linking config·initial URL | 부분 적중 — initial URL이 비-root였던 게 맞으나 원인은 appName 미스매치 |

### D.2 사용자 검증 결과

`pnpm dev:local` 재실행 → 토스 앱 메인 메뉴에서 미니앱 진입 → **정상 홈 화면 표시 확정** (사용자 보고: "정상동작 확인함").

## E. 산출 파일 (최종)

| 파일 | 변경 |
|------|------|
| **`granite.config.ts`** | **`appName: 'airecipe' → 'airecipe-miniapp'` 원복 (★ 본 root cause fix)** |
| `src/components/NotFoundScreen.tsx` | TDS 카피 매핑 정정 + props 확장 (`onContactSupport?`, `title?`, `subtitle?`) + JSDoc 정정 |
| `pages/_404.tsx` | 진입 폴백 카피 분리 + handleBack try-catch + `__DEV__` `navigation.getState` JSON 진단 로그 유지 |
| `pages/{index,my-recipes,recipe/generate,recipe/[id],recipe/recommend}.tsx` | shim 5종 절대 → 상대 경로 정정 |
| `src/router.gen.ts` | Granite plugin-router로 정규 순서 재생성 |
| `docs/appsintoss-port/06-UI-MAPPING.md` | §6.5 NotFoundScreen 행 — TDS 카피 매핑 정정 + 변경 이력 |

## F. 백워드 호환

- `useRecipeDetail.ts` doc comment 예시 + `src/pages/recipe/[id].tsx:130`에서 `<NotFoundScreen onBack={...} />` 시그니처 그대로 사용 — title/subtitle/onContactSupport는 optional이라 무영향. default 카피("레시피를 찾을 수 없어요")는 단건 404용 그대로.
- ADR-005 + ADR-012 D16 단일 컴포넌트 정책 유지.
- 라우트 경로·SSOT 변경 0건.

## G. 검수 정책 인계 (출시 전 검증 필수)

- **콘솔 등록 deep link prefix ↔ `granite.config.ts` `appName` 1:1 동기화 의무**.
- `appName` 변경 시 commit 전 dev 진입 검증 필수. 변경 PR에 `navigation.getState` 출력 첨부 권장.
- 별 ADR 추가 검토(콘솔 등록 정보 ↔ 미니앱 코드 동기 표).
