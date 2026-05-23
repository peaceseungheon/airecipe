# Phase 1 — frontend 산출 요약

> 작성: miniapp-frontend · 2026-05-23 · 팀 `airecipe-miniapp-phase1`
> 입력: `_workspace/00_input/requirements.md`, `_workspace/01_architect_phase1_baseline.md`, `_workspace/02_api_client_summary.md`
> 범위: baseline §E 분담의 frontend 1차 작성 산출(2파일) + AC1.5 dev-only 임시 호출 트리거(1파일 갱신)

---

## 1. 산출 파일

### 코드

| 파일 | 책임 | baseline 매핑 |
|------|------|--------------|
| `src/hooks/useTossUserId.tsx` | Toss 익명 식별자 발급·캐싱·재발급·Context. `TossUserIdProvider`/`useTossUserId`/`formatTossUserIdMask` export | §A.7 |
| `src/_app.tsx` | `AppContainer`를 `TossUserIdProvider`로 래핑 | §A.8 |
| `src/pages/index.tsx` | AC1.5 dev-only 임시 호출 트리거(6 엔드포인트) + 첫 화면 임시 스캐폴드 | §F AC1.1·AC1.5 |

### 확장자

- `useTossUserId.tsx`는 JSX 포함이므로 `.tsx`. baseline의 `useTossUserId.ts` 표기는 컨벤션 정합 위해 확장자만 변경.

---

## 2. `useTossUserId.tsx` — 노출 인터페이스

```ts
export interface TossUserIdContextValue {
  tossUserId: TossUserId | undefined;        // 발급 전엔 undefined
  refresh: () => Promise<TossUserId>;        // 401 시 SDK 재호출 → 새 hash 반환
}

export function TossUserIdProvider({ children }: PropsWithChildren): JSX.Element;
export function useTossUserId(): TossUserIdContextValue;     // Provider 누락 시 throw
export function formatTossUserIdMask(hash: TossUserId | undefined): string;  // 평문 노출 금지용 마스킹 헬퍼
```

### 구현 결정 (baseline 인용)

| 결정 | 근거 |
|------|------|
| SDK import는 파일 최상단 단일 줄로 격리: `import { getAnonymousKey } from '@apps-in-toss/web-framework'` | §B.2 — 패키지 경로 변동 시 1행 수정으로 대응. 사양(05 §5.2.1 라인 73) 그대로. 추측 import 금지 |
| 모듈 미해결 가능성을 `@ts-expect-error` 1줄로 잠시 통과 | §B.2 — 빌드/실행 단계에서 미해결 시 즉시 architect에게 SendMessage. 다른 패키지로 임의 변경하지 않음 |
| 캐시는 모듈 스코프 `let cachedTossUserId` | §C.2 — 메모리 채택, SecureStore 보류 |
| hash zod 검증 `z.string().min(8).max(256)` | 05 §5.2.3 라인 118 — 백엔드와 동일 검증으로 부적합 hash 조기 차단 |
| 부적합 hash는 캐시에 두지 않고 throw | 호출부가 UI 에러로 변환 (Phase 2 화면 책임) |
| `refresh()` 시그니처는 `Promise<TossUserId>` 반환 | api-client `refreshTossUserId: () => Promise<string>` 시그니처와 정합. React Context state는 비동기 갱신이라 stale 회피 위해 직접 반환 |
| Provider는 마운트 시 캐시 보유 분 우선, 미보유 시 SDK 호출 1회 | §A.7 + 05 §5.4 — 콜드 스타트 후 동일 hash 가정 |
| 디버그용 `formatTossUserIdMask` 제공 (`len=N head=XY…` 형식) | 09 §9.5 라인 221 + 05 §5.10 라인 520 — UI/로깅에 평문 노출 금지. 마스킹 형태만 허용 |

### DIP

`api-client.ts`는 Toss SDK를 직접 import하지 않고, recipes.ts 호출 시 `auth: { tossUserId, refreshTossUserId }`로 hook 반환값을 주입받는다. SDK 의존은 본 훅 한 곳에만 존재.

---

## 3. `src/_app.tsx` — Provider 마운트

```tsx
function AppContainer({ children }: PropsWithChildren<InitialProps>) {
  return <TossUserIdProvider>{children}</TossUserIdProvider>;
}
export default AppsInToss.registerApp(AppContainer, { context });
```

- 변경 1줄: `<>...</>` → `<TossUserIdProvider>...</TossUserIdProvider>`.
- 추가로 `react/react-in-jsx-scope` 회피 위해 `import React from 'react'` 명시 (qa report §6 #2에서 정리 요청된 항목 — 본 작업으로 함께 해소).

---

## 4. `src/pages/index.tsx` — AC1.5 dev-only 임시 호출 트리거

### 동작 사양

- `Page` 컴포넌트가 임시 안내문과 dev-only 트리거 패널을 렌더링.
- 트리거 패널은 `const isDev = import.meta.env.APP_ENV !== 'production'` 가드 후에만 노출 → production 빌드에서는 트리거 컴포넌트가 트리에 진입하지 않음.
- 패널 구성:
  - `APP_ENV` 텍스트 표시.
  - `formatTossUserIdMask(tossUserId)` → `len=N head=XY…` 형식. **평문 hash 절대 미노출** (AC1.1: truthy 여부는 길이가 0보다 큰지로 판단 가능).
  - 6개 함수 호출 버튼: generate(공개) / list / get(dummy) / save(stub) / favorite(dummy) / delete(dummy).
  - 호출 결과는 화면 로그 패널(`describeResult`/`describeError`로 마스킹)과 `console.log('[phase1-dev] ...')` 양쪽에 출력. **응답 raw나 hash는 평문 출력하지 않음**.
- 보호 5개 함수는 `auth = { tossUserId, refreshTossUserId: refresh }` 가 truthy일 때만 호출. 미발급 시 "skip ... tossUserId 미발급" 표시 후 호출 보류 (헤더 없이 강제 호출하여 401 발생시키지 않음 — Phase 1은 백엔드 옵션 P 배포 미확인 상태이므로 안전한 기본값).

### 매핑

| AC | 달성 방법 |
|----|----------|
| AC1.1 | `formatTossUserIdMask(tossUserId)` 표시 — `(none)` 이외이면 truthy. 길이 정보로 zod min 8 충족 여부 확인 가능 |
| AC1.5 | 6 함수 각각 별 Pressable로 호출 — 호출 시그니처는 `_workspace/02_api_client_summary.md` §2 그대로 매핑 |

### Phase 2 진입 시 제거 계획

- `Phase1DevTrigger` 컴포넌트, `isDev` 가드, `STUB_GENERATED_RECIPE` 상수, 관련 styles 모두 일괄 제거. `Page` 본체는 06-UI-MAPPING의 TDS 컴포넌트 매핑으로 교체.

---

## 5. 보안·노출 정책 점검

| 항목 | 결과 |
|------|------|
| `X-Toss-User-Id` 평문 UI/console 노출 | **없음** — `useTossUserId.tsx`는 마스킹 헬퍼만 export. `pages/index.tsx`는 마스킹 형식으로만 표시·로깅 |
| hash가 console.log로 평문 누출 | **없음** — 호출 라벨/응답 요약/에러 코드만 출력 |
| API 키·service role 키 등 금지 환경변수 사용 | **없음** — `import.meta.env` 접근은 `APP_ENV` 1건 (env.d.ts 선언 범위 내) |
| 직접 fetch 호출 | **없음** — services 경유. CLAUDE.md §3 정합 |
| TDS 미적용 부분 | Phase 2 매핑 대상. Phase 1 임시 트리거는 RN 기본 컴포넌트만 사용 (baseline spawn 프롬프트 허용 범위 내) |

---

## 6. 라우트 표 (Phase 1)

| Granite 라우트 | 파일 | 비고 |
|---------------|------|------|
| `/` | `src/pages/index.tsx` | 임시 스캐폴드 + dev-only 트리거 |
| `/about` | `src/pages/about.tsx` | 스캐폴드 그대로 (Phase 2에서 정리 또는 삭제) |
| (404) | `pages/_404.tsx` | 스캐폴드 그대로 |

> `pages/index.tsx`, `pages/about.tsx`는 `src/pages/{index,about}.tsx`의 Route를 재export하는 barrel. `intoss://airecipe-miniapp/{}` 딥링크 형성.

---

## 7. 소비하는 api-client 메서드

`src/services` barrel에서 import하여 6개 모두 dev-only 트리거에서 호출:

| 함수 | 인자 | 사용 위치 |
|------|------|----------|
| `generateRecipe(req, options?)` | `{ dishName, servings }`, `{ tossUserId? }` | trigger "generate" |
| `listRecipes(query, auth)` | `{ page: 1, pageSize: 10 }`, `{ tossUserId, refreshTossUserId }` | trigger "list" |
| `getRecipe(id, auth)` | `'dummy-id'`, auth | trigger "get(dummy)" — NOT_FOUND 기대 |
| `saveRecipe(req, auth)` | `{ recipe: STUB_GENERATED_RECIPE }`, auth | trigger "save(stub)" |
| `toggleFavorite(id, req, auth)` | `'dummy-id'`, `{ isFavorite: true }`, auth | trigger "favorite(dummy)" — NOT_FOUND 기대 |
| `deleteRecipe(id, auth)` | `'dummy-id'`, auth | trigger "delete(dummy)" — NOT_FOUND 기대 |
| `ApiClientError` | 에러 분기에서 `error.code` 읽기 | `describeError(e)` |

---

## 8. 검증

### typecheck / lint

```bash
pnpm typecheck   # 통과 (0 에러)
pnpm lint        # 0 에러 (router.gen.ts의 unused-disable warning 1건은 자동 생성)
```

### 실호출 검증 (AC1.x)

- 본 산출은 코드 경로만 완성. 실호출 검증은 백엔드 옵션 P 배포 여부 의존 (baseline §F qa 책임 + spawn 프롬프트 step 4).
- `granite dev`로 미니앱 띄우면 dev-only 트리거가 노출됨. 각 버튼 누르면 console에 `[phase1-dev]` prefix로 호출 흐름 출력.
- SDK 패키지 미해결 시: `@apps-in-toss/web-framework` import 실패 → 즉시 architect에게 SendMessage (baseline §B.2 + §G #2).

---

## 9. 미해결·후속 작업

| 항목 | 처리 위치 |
|------|----------|
| `@apps-in-toss/web-framework` 패키지 경로 실 검증 (`@ts-expect-error` 해소) | granite dev 첫 실행 시. 미해결이면 architect에게 SendMessage (baseline §G #2) |
| AC1.1~1.5 실호출 검증 | qa 주도 (T4) — 백엔드 옵션 P 배포 후 |
| TDS 컴포넌트 매핑 | Phase 2 (06-UI-MAPPING) |
| dev-only 트리거 제거 + production 화면 작성 | Phase 2 진입 시 |
| `pages/about.tsx` 정리/삭제 | Phase 2 |

---

## 10. 변경 이력

| 일시 | 변경 | 사유 |
|------|------|------|
| 2026-05-23 단계 5 | `src/hooks/useTossUserId.tsx` 작성 (Provider + 훅 + 마스킹 헬퍼) | baseline §A.7 — types/user.ts ready 통지 후 진입 |
| 2026-05-23 단계 6 | `src/_app.tsx` Provider 마운트 + `src/pages/index.tsx` AC1.5 dev-only 트리거 작성 | baseline §A.8 + spawn 프롬프트 AC1.5 — api-client ready 통지 후 진입 |
| 2026-05-23 단계 6 fix | `useTossUserId.refresh` 시그니처 `Promise<TossUserId>`로 변경 | api-client `refreshTossUserId: () => Promise<string>` 시그니처 정합. React state 비동기 stale 회피 |
