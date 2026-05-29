# 진입 버그 — 어플 진입 시 NotFoundScreen 노출 + 닫기 버튼 무동작

> 일자: 2026-05-29
> 입력자: 사용자 — "로그인 하고 어플 진입 시 src/components/NotFoundScreen.tsx '레시피를 찾을 수 없어요'가 뜨면서 아무것도 동작하지 않아. 닫기 버튼을 눌러도 동작하지 않아."
> 우선순위: P0 — 사용자가 앱을 전혀 사용하지 못함.

---

## 1. 증상

1. 토스 인증 통과 후 미니앱 진입.
2. **홈(`/`) 대신 NotFoundScreen("레시피를 찾을 수 없어요")이 표시**.
3. ErrorPage 좌측 "닫기"(또는 뒤로) 버튼 탭 → 아무 동작 없음.
4. 사용자가 앱을 사용할 수 없는 상태.

---

## 2. 컨텍스트

- Phase 5에서 `pages/_404.tsx`를 raw `<Text/>` → `<NotFoundScreen onBack={...} />` 합성으로 교체(ADR-012 D16 단일 컴포넌트 정책 + ADR-015 D40 검수 준수).
- `pages/_404.tsx`는 라우트 미매칭 폴백 시점에 렌더되는 Granite 표준 페이지.
- 진입 시점에 _404가 떴다는 건 `/` 라우트가 매칭되지 않았다는 의미.
- Phase 6에서 `/recipe/recommend` 라우트 추가 + `router.gen.ts` 수동 갱신 + 홈 CTA 추가.

---

## 3. 의심 원인 후보

| # | 가설 | 확인 방법 |
|---|------|----------|
| H1 | `router.gen.ts`가 granite build/dev 시 자동 재생성 — 수동 추가분(`/recipe/recommend`)이 `require.context` 인식과 불일치 → 진입 라우트 매칭 실패 | dev server 로그 + `_404.tsx`가 모든 진입에서 떴는지 (Phase 6 전에는 정상?) |
| H2 | `pages/recipe/recommend.tsx` shim의 `from 'pages/recipe/recommend'` import 경로가 metro/granite resolver에서 실패 → 라우트 등록 깨짐 | 빌드/번들 시점 에러, recommend.tsx import 확인 |
| H3 | `_404.tsx`의 `handleBack`이 `canGoBack=false` + `navigate('/', {})` 시도 — `/`도 매칭 실패면 무한 _404 루프(사용자 체감: "아무 동작 없음") | _404 코드 흐름 |
| H4 | 토스 미니앱 진입 시 deeplink path가 `/`가 아니라 다른 경로(예: 빈 string·undefined)로 들어와 매칭 실패 | Granite 라우팅 spec + AppsInToss.registerApp 동작 |
| H5 | Phase 6 코드 변경 무관, 별 root cause(예: 토스 SDK 업데이트·콘솔 설정 변경)로 진입 path 바뀜 | git bisect — Phase 5 commit 시점은 정상 동작했는지 |
| H6 | `useTossUserId`가 SDK 호출 실패 → throw → 상위에서 catch → fallback으로 _404 | useTossUserId 에러 경로 |
| H7 | `_404.tsx`의 NotFoundScreen 카피("레시피를 찾을 수 없어요")가 라우트 미매칭에 부적합 — 사용자에게 잘못된 정보 전달(라우트가 아니라 레시피가 없다는 메시지). UX 자체도 잘못. | NotFoundScreen prop 분리 필요성 검토 |

---

## 4. 출력 영역 (본 사이클)

### 4.1 분석 (architect)
- H1~H7 후보 중 root cause 식별 — 코드 검토 + 가능하면 dev 재현.
- Granite 라우팅·`require.context`·deeplink 매핑 메커니즘 정리.
- `_404.tsx` 재방문 — 단일 컴포넌트 정책(D16) 유지하면서 진입 폴백 UX를 별 카피로 분리할지 결정.

### 4.2 코드 수정 (api-client + frontend)
- 라우팅 등록 정합 (router.gen.ts 자동 재생성 vs 수동 갱신 정책 확정).
- `_404.tsx`의 카피 분리 — `NotFoundScreen`에 `title`/`subtitle` prop 추가하거나 `_404.tsx` 전용 ErrorPage 분기.
- "닫기 버튼 무동작" 해결 — `canGoBack=false` 케이스에서 명확한 동작(예: 홈으로 이동 + 라우트 등록 안전 확인 + 사용자에게 재시도 안내).

### 4.3 QA
- 진입 시 NotFoundScreen 미노출 확인.
- 모든 라우트(`/`, `/recipe/generate`, `/my-recipes`, `/recipe/[id]`, `/recipe/recommend`) 진입 동작.
- typecheck + lint.

---

## 5. 제약 사항

- **TDS 의무** — `@toss/tds-react-native` 사용. raw Text/View 금지(Phase 5 정책).
- **hex 직접 사용 금지** — `colors.*` 토큰만(Phase 5 D39).
- **404 단일 컴포넌트 정책 유지 가능성** — `NotFoundScreen`은 본래 레시피 단건 404용. 진입 폴백 UX 분리는 별 ADR 검토(ADR-012 D16 진화).
- 백엔드 외부 작업 불필요 — 본 버그는 미니앱 클라이언트 측 라우팅 + UI.

---

## 6. 참조 SSOT

- `docs/appsintoss-port/07-ROUTING.md` — Granite 라우팅 + `_404` 폴백.
- `docs/adr/ADR-005` — 404 통일 정책.
- `docs/adr/ADR-012` D16 — NotFoundScreen 단일 컴포넌트.
- `docs/adr/ADR-015` D40 — _404.tsx의 NotFoundScreen 재사용.
- `pages/_404.tsx` — 폴백 진입점.
- `src/components/NotFoundScreen.tsx` — 404 화면 합성.
- `src/_app.tsx`, `require.context.ts` — Granite 등록.
- `_workspace_phase5/04_session_log.md`, `_workspace_phase6/04_session_log.md` — 직전 사이클 산출.
