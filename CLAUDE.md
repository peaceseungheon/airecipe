# airecipe-miniapp

AI 레시피 안내 — 앱인토스 미니앱 (React Native + Granite + TDS).

본 저장소는 **별 저장소 `AIReceipe`**(Next.js 웹앱, 백엔드 SSOT)의 자매 프로젝트로, 백엔드는 그대로 두고 미니앱 클라이언트만 별 코드베이스로 개발한다.

---

## 세션 시작 규칙 — 반드시 먼저 읽을 것

신규 LLM 세션이 이 저장소에서 작업을 시작할 때 다음 순서로 읽는다:

1. **`docs/appsintoss-port/00-OVERVIEW.md`** — 챕터 인덱스·재사용 자산·읽기 순서.
2. **`docs/adr/ADR-009-appsintoss-port-architecture.md`** — 본 미니앱의 모든 핵심 결정.
3. **`docs/appsintoss-port/10-SPRINT-PLAN.md`** — 현재 어느 Phase에서 무엇을 해야 하는지.

그 후 작업 영역에 따라 챕터별로 진입:

| 작업 | 읽을 챕터 |
|------|----------|
| 기능·수용 기준 확인 | 01-FEATURES |
| Supabase 스키마·user 매핑 이해 | 02-DATA-MODEL |
| 백엔드 호출 (요청·응답·CORS·인증 헤더) | 03-API-CONTRACT |
| Gemini/Claude 응답 형식·zod 이해 | 04-AI-PROVIDER |
| Toss 인증·`getAnonymousKey()` | 05-AUTH |
| UI 컴포넌트 매핑 (TDS) | 06-UI-MAPPING |
| 라우팅 (Granite + 파일 기반) | 07-ROUTING |
| SSE → fetch stream | 08-STREAMING |
| 환경변수·granite.config.ts | 09-ENV-CONFIG |
| 단계별 구현 순서 | 10-SPRINT-PLAN |

---

## 핵심 결정 (ADR-009 요약)

- **백엔드 분리**: 본 저장소는 미니앱 클라이언트만. 백엔드는 별 저장소(`AIReceipe`)의 Next.js API Routes를 Vercel에 배포하여 그대로 호출 (`API_BASE_URL`).
- **인증**: Toss 인증(`getAnonymousKey()`) → `X-Toss-User-Id` 헤더로 백엔드 전달. 회원가입/로그인 폼 없음.
- **사용자 식별**: 옵션 P — 백엔드의 `profiles` 테이블이 Toss userId hash ↔ internal uuid 매핑. 미니앱은 헤더만 알면 됨.
- **TDS 의무**: 비게임 미니앱은 `@toss/tds-react-native` 사용 필수 (검수 통과 조건).
- **MVP 범위**: Sprint 1 6기능 — 레시피 생성 / 영양 분석 / 저장 / 목록 / 즐겨찾기 / 삭제.

---

## 기술 스택

| 영역 | 값 |
|------|---|
| 프레임워크 | `@apps-in-toss/framework@^2.6.0`, `@granite-js/react-native@1.0.28` |
| React Native | `0.84.0` |
| React | `19.2.x` |
| TDS | `@toss/tds-react-native` (비게임 필수) |
| 환경변수 | `@granite-js/plugin-env` (빌드 시점 주입, `import.meta.env`) |
| 라우팅 | 파일 기반 (`pages/` 디렉터리 = `intoss://airecipe-miniapp/<path>`) |
| 패키지 매니저 | pnpm |
| 린트/포맷 | eslint + prettier |
| 테스트 | jest + `@testing-library/react-native` |

---

## 코드 규칙

1. **API 키·시크릿은 절대 미니앱에 두지 않는다**. `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, DB URL 모두 백엔드 전용. 09-ENV-CONFIG §9.1.1 금지 항목 참조.
2. **UI는 TDS 우선**. 커스텀 색상·폰트는 TDS 토큰 활용. 직접 `View/Text` 스타일링 최소화.
3. **백엔드 호출은 `src/services/api-client.ts`만 통과** (Phase 1에서 작성). 직접 `fetch` 호출 금지.
4. **응답은 zod 검증** 후 사용. 03-API-CONTRACT의 응답 shape이 SSOT.
5. **에러 메시지는 한국어 사용자 친화적**으로. HTTP 상태 그대로 노출 금지.
6. **`X-Toss-User-Id`는 노출 금지** — UI에 표시·로깅에 평문 포함 금지.

---

## 현재 단계

**Phase 5(출시 준비) 완료 → 출시 외부 작업만 PENDING** (2026-05-25).

### Phase 5 — 출시 준비 (ADR-015, 본 차)

Phase 4 완료 후 출시 준비 사이클. **코드 측 검수 점검 ALL PASS** — Q1~Q10 매트릭스 10/10 PASS + D39~D43 시행 5/5 PASS + AC5.1·5.4 코드 측 PASS, AC5.2·5.3은 외부 작업 PENDING (`_workspace/03_qa_report.md`). typecheck PASS, lint 0 errors (router.gen.ts Phase 3 누적 무해 warning 1건).

5 결정 동결 (ADR-015 D39~D43): hex → TDS `colors` 토큰 일괄 교체(D39 — light 모드 정확 동등치) / NutritionPanel AI 면책 문구 추가(D40 — `typography="st11"` fixed 1줄) / 에러 메시지 카탈로그 동결(D41 — Phase 1·3·4 누적 그대로) / 환경별 빌드 스크립트 동결(D42 — `dev:local`/`dev:staging`/`build:staging`/`build:prod` 4종 유지) / 출시 PENDING 분리(D43 — 콘솔/디바이스/번들 외부 작업).

코드 산출 (Phase 5 동결 — Phase 1~4·4.5 누적 위에 변경):
- `src/components/NutritionPanel.tsx` — hex → TDS colors 토큰 + AI 면책 문구 추가(D40).
- `src/components/RecipeCard.tsx`/`SearchForm.tsx`/`RecipeDisplay.tsx`/`EmptyState.tsx` — hex → TDS colors 토큰.
- `src/pages/index.tsx`/`my-recipes.tsx`/`recipe/generate.tsx`/`recipe/[id].tsx` — hex → TDS colors 토큰.
- `src/lib/ads/adapter.noop.tsx` — hex → TDS colors 토큰.
- `pages/_404.tsx` (재작성) — raw `Text` → `NotFoundScreen` 재사용 + `useNavigation.canGoBack` 폴백. 단일 404 컴포넌트 정책(ADR-012 D16) 확장 적용.
- `docs/adr/ADR-015-miniapp-phase5-release-readiness.md` (신규) — D39~D43 5 결정 동결.
- `docs/appsintoss-port/06-UI-MAPPING.md` §6.1 — 색상은 TDS `colors` 토큰 의무 규약 추가, hex 직접 사용 금지 명시.
- `docs/appsintoss-port/09-ENV-CONFIG.md` §9.6 — 코드 측 통과/외부 작업 분리표 추가 (§9.6.1/§9.6.2).
- `src/components/AGENTS.md` — TDS colors 토큰 의무 + AI 면책 문구 fixed 위치 규약.

### 누적 미해결 해소 (Phase 5 본 차)

| 항목 | 출처 | 해소 사유 |
|------|------|----------|
| SDK 패키지 경로 (`@apps-in-toss/web-framework` 미해결) | Phase 1~4 인계 | `46f0566` 적용 후 typecheck PASS로 확정 |
| `useBackEvent` 하드웨어 백 | Phase 3 인계 #3 | Phase 4 ConfirmDialog `closeOnDimmerClick`로 해결됨 (재확인) |
| 디자인 토큰 hex 직접 사용 | Phase 2 인계 #7 | Phase 5 D39 일괄 교체로 해소 |
| AI 면책 문구 | 검수 가이드 §10.6 6번 | Phase 5 D40로 NutritionPanel 추가 |

### 누적 미해결 (Phase 6 진화 — 별 ADR 분리)

- **AbortSignal cast 2곳** — ADR-011 D13. 해소 조건 (a)/(b)/(c) 재평가.
- **무한 스크롤** — Phase 3 인계 #6. 사용자 데이터량 증가 후 별 ADR.
- **카드 측 삭제 UX (swipe/long-press)** — ADR-013 D22 후속 별 ADR.
- **다중 동시 PATCH 큐** — Phase 4 v1 한계.
- **전면 광고 wiring + 빈도 제한** — ADR-014 D30·D34 후속.
- **Analytics SDK 통합** — ADR-014 D33 후속.
- **다크 모드 adaptive 토큰** — ADR-015 D39 보조 별 ADR.

### 출시 외부 작업 PENDING (ADR-015 D43)

- **앱인토스 콘솔 등록** — appName/displayName/icon URL/카테고리/도메인 화이트리스트/고객센터·홈페이지/`adGroupId`.
- **백엔드 옵션 P 배포** — 별 저장소 `AIReceipe`.
- **`granite build` 산출물 100MB 이하** — 빌드 후 측정.
- **staging 배포 + 실 디바이스 e2e 테스트** — 6기능 무결성 (AC5.4).
- **콘솔 검토 요청 제출** — 반려 사유 응답 대기 (AC5.2·5.3).

> 본 절은 Phase 5 갱신 — 이전 Phase(0~4·4.5) 상세 산출은 각 phase의 session log(`_workspace_phase1~4/04_session_log.md`, `_workspace_phase45/04_session_log.md`, 본 차 `_workspace/04_session_log.md`) 참조. 결정 트리는 `docs/adr/ADR-009·010·011·012·013·014·015`.

---

## (이전) Phase 4(즐겨찾기·삭제·404 통일) 완료 → Phase 5 진입 준비 (2026-05-25)

### Phase 4 — 즐겨찾기·삭제·404 통일 (ADR-013, 본 차)

Phase 4.5(토스 광고 기반) 완료 후 Phase 4 재개. **코드 경로 ALL PASS** — Q1~Q9 매트릭스 9/9 PASS + D19~D24 시행 6/6 PASS + AC4.1~AC4.4 4/4 PASS, FAIL 0건 (`_workspace/03_qa_report.md`). typecheck PASS, lint 0 errors. AC4.5는 백엔드 옵션 P 배포 후 실증 PENDING (Phase 1·2·3·4.5 동일 누적).

6 결정 동결 (ADR-013 D19~D24): 낙관적 안 a + 호출 측 prev 보관(D19) / PATCH 성공 시 invalidate + 상세 mutate refetch 회피(D20) / DELETE 404 성공 정규화(D21) / 삭제 상세 화면만(D22) / **ConfirmDialog 정정** — `leftButton`/`rightButton` ReactElement + `onClose`/`onExited` 필수, Button props는 `type`/`style` 두 prop(D23) / `useToggleFavorite` id 가변 시그니처(D24 — rules of hooks).

코드 산출 (Phase 4 동결 — Phase 3·4.5 누적 위에 추가):
- `src/hooks/useToggleFavorite.ts` (신규) — id 가변 + pendingId 추적(D24) + 직전 in-flight abort + invalidate(D13).
- `src/hooks/useDeleteRecipe.ts` (신규) — 404 성공 정규화(D21) + invalidate.
- `src/hooks/useMyRecipes.ts` (확장) — `mutate(next: Recipe)` 추가 — 낙관적 mutation 지원(D19).
- `src/hooks/useRecipeDetail.ts` (확장) — `mutate(next: Recipe)` 추가 — PATCH 응답 직접 갱신, refetch GET 회피(D20).
- `src/components/FavoriteButton.tsx` (신규) — TDS `IconButton` + 멱등 목표값 콜백(`!isFavorite` 전달) + 접근성.
- `src/components/FilterTabs.tsx` (신규) — TDS `SegmentedControl.Root` + `.Item` 2-state.
- `src/components/DeleteConfirmDialog.tsx` (신규) — TDS `ConfirmDialog` 합성. `leftButton`/`rightButton`은 `ConfirmDialog.Button`(취소 `type="light" style="weak"`, 삭제 `type="danger" style="fill"`).
- `src/components/RecipeCard.tsx` (확장) — `onToggleFavorite` 자리표시 활성화(header에 FavoriteButton 합성) + `favoritePending` prop. `onDelete?`는 자리표시 유지(D22).
- `src/pages/my-recipes.tsx` (확장) — 상단 FilterTabs + RecipeCard.onToggleFavorite + 낙관적 mutate(prev/next 패턴) + filter 변경 시 page 1 리셋 + 빈 상태 분기(전체 0건 / 즐겨찾기 0건).
- `src/pages/recipe/[id].tsx` (확장) — PageNavbar.AccessoryButtons에 FavoriteButton + 본문 하단 삭제 Button + DeleteConfirmDialog state + 낙관적 mutate + 삭제 성공·404 정규화 후 handleBack.

라우트 신규 0건 — Phase 3 4 라우트 그대로 유지.

### 누적 미해결 (Phase 1~4)
- **SDK 패키지 경로** (`@apps-in-toss/web-framework` 미해결) — dev server 첫 실행 시점 검증.
- **AbortSignal cast 2곳** — ADR-011 D13. Phase 5 재평가.
- **`useBackEvent` 하드웨어 백** — 본 사이클 ConfirmDialog `closeOnDimmerClick` + dimmer click 처리로 해결. 별 ADR 불필요.
- **디자인 토큰 hex 직접 사용** — Phase 5 진입 전 별 ADR.
- **백엔드 옵션 P 배포** — 별 저장소 AIReceipe.
- **무한 스크롤** — Phase 5 별 ADR.
- **콘솔 `adGroupId` 발급·승인** — Phase 4.5 외부 작업.
- **전면 광고 wiring + 빈도 제한** — ADR-014 D30·D34 후속.
- **Analytics SDK 통합** — ADR-014 D33 후속.
- **카드 측 삭제 UX (swipe·long-press)** — ADR-013 D22 후속 별 ADR.
- **다중 동시 PATCH 큐** — Phase 4 v1 한계, 별 ADR.

> 본 절은 Phase 4 갱신 — 이전 Phase 산출은 각 phase의 session log(`_workspace_phase1~3/04_session_log.md`, `_workspace_phase45/04_session_log.md`) 참조.

Phase별 수용 기준은 `docs/appsintoss-port/10-SPRINT-PLAN.md`. 결정 트리는 `docs/adr/ADR-009·010·011·012·013·014`.

---

## (이전) Phase 4 일시 보류 + Phase 4.5(토스 광고 SDK 기반) 완료 (2026-05-25 오전).

### Phase 4.5 — 토스 광고 SDK 기반 작업 (ADR-014, 본 차)

`@apps-in-toss/framework`의 `InlineAd`/`loadFullScreenAd`/`showFullScreenAd`를 어댑터 격리 패턴으로 도입. **코드 경로 ALL PASS** — G1~G9 매트릭스 9/9 PASS, typecheck/lint 0 errors (`_workspace/03_qa_report.md`). 13 결정 동결(ADR-014 D25~D38) + 신규 SSOT 챕터 `docs/appsintoss-port/11-ADS.md` 발행. SDK 직접 import는 `src/lib/ads/adapter.toss.tsx` 1곳만(`grep` 검증). 시범 적용: `src/pages/my-recipes.tsx` 빈 EmptyState 아래 + 정상 목록 pageInfo 아래 양쪽에 `<AppInlineAd slot="my-recipes-bottom" />` 1회씩(로딩/에러 분기 미렌더). 환경 분기: `APP_ENV='local'` OR `ADS_ENABLED!=='true'` → noop, 그 외 toss 어댑터(D27).

코드 산출 (Phase 4.5 동결):
- `src/lib/ads/types.ts` (신규) — `AdsAdapter` 인터페이스 + `InlineAdSlotProps` + `AdResult` 5종.
- `src/lib/ads/adapter.toss.tsx` (신규) — 토스 SDK 실 구현. SDK 직접 import 단일 위치. 7 이벤트(`requested/show/impression/clicked/dismissed/failedToShow/userEarnedReward`) → `AdResult` 정규화(D32). cancelLoad/cancelShow + AbortSignal cleanup.
- `src/lib/ads/adapter.noop.tsx` (신규) — dev placeholder. TDS `View`+`Txt`만(D29).
- `src/lib/ads/index.ts` (신규) — 환경 분기로 `ads` 객체 export.
- `src/components/AppInlineAd.tsx` (신규) — `ads.InlineAdSlot` 위임. BannerSlotCallbacks 미노출(D33).
- `src/hooks/useFullScreenAd.ts` (신규) — `ads.showFullScreen` 위임. AbortController unmount cleanup. **Phase 4.5는 wiring 0곳**(D30 — 코드 경로만).
- `granite.config.ts` (확장) — env 키 3개 추가(`ADS_ENABLED`, `ADS_INLINE_GROUP_ID`, `ADS_FULLSCREEN_GROUP_ID`).
- `src/env.d.ts` (수동 sync — D38) — `.gitignore` 대상이라 빌드 시 plugin-env 재생성.
- `src/pages/my-recipes.tsx` (확장) — 빈+정상 양쪽 하단에 AppInlineAd. 로딩/에러 미렌더(G8).
- `eslint.config.mjs` (보강) — `.granite/**` ignore 추가(빌드 산출물 검사 제외).
- `src/lib/AGENTS.md` (신규) + `src/components/AGENTS.md`/`src/hooks/AGENTS.md` (보강) — 광고 SDK 직접 import 금지 규약 명시.

### Phase 4.5 PENDING (외부 또는 별 ADR)

| 항목 | 사유 | 해소 조건 |
|------|------|----------|
| 실 광고 송출 검증 | 콘솔에서 `adGroupId` 발급·승인 외부 작업 | 콘솔 등록 + 환경변수 주입 + staging 배포 |
| 전면 광고 시범 적용 | D30 본 사이클 wiring 보류 (빈도 제한 정책 필요) | 빈도 제한 ADR + 트리거 위치 결정 |
| Analytics SDK 통합 | D33 본 사이클 미적용 (console.debug only) | 측정 SDK 결정 별 ADR |

### Phase 4 일시 보류 (재개 진입점)

Phase 4(즐겨찾기·삭제·404 통일)는 토스 광고 우선순위 전환으로 일시 보류. `_workspace_phase4_paused/`에 보존:
- `_workspace_phase4_paused/00_input/requirements.md` — 5 출력 영역(즐겨찾기 토글·필터·삭제·404·동시성)
- `_workspace_phase4_paused/01_architect_phase4_baseline_partial.md` — 13 결정 사전 동결 + TDS 실재성 검증 5종 PASS + ADR-013 D19~D23 결정 카탈로그 + 멈춤 트리거 6항
- **중요 정정** (재개 시 적용 필수): ConfirmDialog 실제 props는 `leftButton`/`rightButton`(ReactElement, ConfirmDialog.Button 권장) + `onClose`/`onExited` 필수. 요구사항의 `confirmText/cancelText/onConfirm/onCancel`는 SSOT 아님 — 06 §6.5 갱신 + DeleteConfirmDialog 합성 시그니처 정정.

### Phase 3 완료 동결 (Phase 4·4.5 진입 전 — 2026-05-24)

Phase 3(저장·목록·상세, 기능 c·d) **코드 경로 ALL PASS** — QA 매트릭스 76+ PASS / FAIL 0건 누적 (`_workspace/03_qa_report.md`). Phase 1·2 동결(ADR-010·011) 그대로 유지(수정 0건). 본 Phase 결정은 ADR-012(D14~D18) + AGENTS.md 3종(`src/hooks|components|pages/AGENTS.md`) 보강에 동결. 06-UI-MAPPING §6.5 추가 컴포넌트 표는 NotFoundScreen·EmptyState·RecipeCard 실 구현 시그니처 반영. 세션 전체 흐름은 `_workspace_phase1/04_session_log.md`(Phase 1) + `_workspace_phase2/04_session_log.md`(Phase 2) + `_workspace/04_session_log.md`(Phase 3 — 본 차).

코드 산출 (Phase 3 동결 — Phase 1·2 누적 위에 추가):
- `src/hooks/useRecipeCache.tsx` (신규) — Context + bump trigger 캐시 무효화 (ADR-012 D15).
- `src/hooks/useMyRecipes.ts` (신규) — listRecipes raw `{data, meta}` 보존 (ADR-010 D5 예외) + trigger dep + 401 자동 재시도.
- `src/hooks/useRecipeDetail.ts` (신규) — getRecipe + 404 정규화(notFound state, ADR-005 통일).
- `src/hooks/useSaveRecipe.ts` (신규) — saveRecipe + 성공 시 invalidate() 정확 1회 + AbortController cleanup.
- `src/components/RecipeCard.tsx` (신규) — Pressable + Txt + Badge 3종. recipe.id 사용 OK(저장된 Recipe 한정). Phase 4 즐겨찾기/삭제 prop 자리표시.
- `src/components/EmptyState.tsx` (신규) — props 4종 재사용 컴포넌트.
- `src/components/NotFoundScreen.tsx` (신규) — TDS `ErrorPage statusCode={404}` 합성. **단일 컴포넌트 정책** — Phase 4 PATCH/DELETE 404 재사용 (ADR-012 D16).
- `src/pages/my-recipes.tsx` (신규) — `/my-recipes` 라우트. 식별자 가드 + useMyRecipes + EmptyState/RecipeCard 4-way 분기 + 단순 페이지네이션 (meta.pageSize 신뢰).
- `src/pages/recipe/[id].tsx` (신규) — `/recipe/[id]` 라우트. Granite 동적 세그먼트 + validateParams + useRecipeDetail + 4-way 분기(로딩/404/에러/정상).
- `src/pages/recipe/generate.tsx` (확장) — useSaveRecipe 결합 + 저장 버튼 + `/recipe/[id]` 직진 (ADR-012 D17).
- `src/pages/index.tsx` (확장) — PageNavbar.AccessoryButtons 마이 진입 활성화.
- `src/_app.tsx` (확장) — RecipeCacheProvider를 TossUserIdProvider 안쪽 래핑.
- `src/router.gen.ts` (자동) — 4 라우트 등록 (`/`, `/recipe/generate`, `/my-recipes`, `/recipe/[id]`).

### Phase 4 진입 인계
- 즐겨찾기 토글(PATCH `/api/recipes/[id]/favorite` 멱등) → `useToggleFavorite` + `FavoriteButton` 또는 `RecipeCard.onToggleFavorite` 활성화.
- 삭제(DELETE `/api/recipes/[id]`) → `useDeleteRecipe` + `DeleteConfirmDialog` (TDS `ConfirmDialog`).
- 즐겨찾기 필터(`?favorite=true`) → `FilterTabs` (TDS `SegmentedControl`/`Tab`) + `useMyRecipes(query.favorite)`.
- 404 UI는 Phase 3 산출 `<NotFoundScreen />` 그대로 재사용(ADR-012 D16).
- 캐시 무효화는 Phase 3 산출 `useRecipeCacheTrigger.invalidate()` 그대로 재사용(ADR-012 D15).

### 누적 미해결 (Phase 1~4.5)
- **SDK 패키지 경로** (`@apps-in-toss/web-framework` 미해결) — Phase 4 재개 시 dev server 시점 검증, 실패 시 ADR-010 §R1.
- **AbortSignal cast 2곳** — ADR-011 D13 해소 조건 (a)/(b)/(c) Phase 4·5 재평가.
- **`useBackEvent` 하드웨어 백** — Phase 4 PATCH/DELETE 낙관적 업데이트 도입 시 결정.
- **디자인 토큰 hex 직접 사용** — Phase 5 진입 전 별 ADR 권장(adaptive 토큰 일괄 교체).
- **백엔드 옵션 P 배포** — 별 저장소 AIReceipe의 후속 ADR. 미배포 상태에서는 모든 보호 호출이 401.
- **무한 스크롤** — Phase 5 출시 직전 별 ADR.
- **Phase 4 즐겨찾기·삭제·404 통일** — `_workspace_phase4_paused/`. 재개 시 partial baseline §I 6단계.
- **콘솔 `adGroupId` 발급·승인** — Phase 4.5 외부 작업 (앱인토스 콘솔).
- **전면 광고 wiring + 빈도 제한** — ADR-014 D30·D34 후속.
- **Analytics SDK 통합** — ADR-014 D33 후속.

> 본 절은 Phase 4.5 갱신 — 이전 Phase(0~3)의 상세 산출은 각 phase의 session log(`_workspace_phase1/04_session_log.md`, `_workspace_phase2/04_session_log.md`, `_workspace_phase3/04_session_log.md`) + Phase 4 미완은 `_workspace_phase4_paused/` 참조.

Phase별 수용 기준은 `docs/appsintoss-port/10-SPRINT-PLAN.md`. 결정 트리는 `docs/adr/ADR-009·010·011·012·014`.

---

## 하네스: 앱인토스 RN 미니앱 개발

**목표:** SSOT 우선 설계 → 병렬 구현(api-client + frontend) → 점진적 QA + 검수 점검으로 본 미니앱을 Phase 0~5 단계로 출시 가능 상태까지 가져간다.

**트리거:** 본 미니앱의 기능 개발·수정·추가, 페이지/화면/api-client 메서드 추가, 아키텍처 설계, QA·검수 점검, 문서화, 버그 수정, 리팩터링 등 본 앱 관련 작업 요청 시 `miniapp-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**구성:** 에이전트 팀 4명(miniapp-architect / miniapp-api-client / miniapp-frontend / miniapp-qa) + 워커 스킬 5개. 상세는 `miniapp-orchestrator` 스킬과 `.claude/agents/`, `.claude/skills/`에서 관리.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-23 | 초기 구성 (4인 팀 + miniapp-orchestrator + 워커 5: technical-documentation, software-design-principles, integration-coherence-qa, granite-rn-development, appsintoss-publish-checklist) | 전체 | RN+Granite+TDS 미니앱 도메인. 별 저장소 AIReceipe의 하네스를 백엔드 분리·TDS 의무·검수 컨텍스트로 재설계 이식. `ai-recipe-integration`·`nextjs-fullstack` 제거, `granite-rn-development`·`appsintoss-publish-checklist` 신규. backend 에이전트 → api-client로 재정의 |
| 2026-05-24 | Phase 3 완료 갱신 — "현재 단계" 절 재작성 (Phase 2 완료 → Phase 3 완료), Phase 4 진입 인계 + 누적 미해결 6항 명시 | CLAUDE.md | Phase 3 마무리(T5) — ADR-012 동결 + AGENTS.md 3종 보강 + 06 §6.5 갱신과 함께 본 문서도 동기 갱신 |
| 2026-05-25 | Phase 4 일시 보류 + Phase 4.5(토스 광고 SDK 기반) 완료 — "현재 단계" 절 재작성, Phase 4 재개 인계(_workspace_phase4_paused + ConfirmDialog 정정), Phase 4.5 산출 13 파일 + 누적 미해결 10항 명시. 팀 1개 동시 제약으로 메인 세션이 architect/api-client/frontend/qa 역할 통합 수행 — `airecipe-miniapp-phase4` 팀 미완 상태로 보존(api-client/frontend/qa 3명 shutdown 미응답 idle). | CLAUDE.md | Phase 4.5 마무리 — ADR-014 D25~D38 13 결정 동결 + 11-ADS.md 신규 SSOT + AGENTS.md 3종(src/lib 신규·components/hooks 보강) + 토스 광고 어댑터 격리 시범 적용 완료와 함께 본 문서 동기 갱신 |
| 2026-05-25 | Phase 4 재개 + 완료 — "현재 단계" 절 재작성(Phase 4 완료 → Phase 5 진입 준비), 산출 10 파일(신규 5 + 확장 4 + Phase 3 그대로 1) + 누적 미해결 11항 갱신(useBackEvent 해결 표기). `_workspace_phase45` 보존 + `_workspace_phase4_paused` → `_workspace` 재개. ADR-013(D19~D24 6 결정 — 낙관적 안 a + PATCH refetch 회피 + DELETE 404 정규화 + 삭제 상세만 + ConfirmDialog 정정 + useToggleFavorite id 가변) 발행 + 06 §6.5 갱신(FilterTabs/DeleteConfirmDialog/FavoriteButton + ConfirmDialog props 정정) + AGENTS.md 3종 보강 | CLAUDE.md | Phase 4 마무리 — Q1~Q9 + D19~D24 + AC4.1~AC4.4 ALL PASS, typecheck/lint 0 errors. AC4.5는 백엔드 옵션 P 배포 PENDING. Phase 5 진입 준비. |
| 2026-05-25 | Phase 5 완료 — "현재 단계" 절 재작성(Phase 5 출시 준비 완료 → 외부 작업만 PENDING). 산출 10 파일(hex → TDS colors 토큰 일괄 교체 + NutritionPanel AI 면책 + _404 NotFoundScreen 재사용) + 문서 4종(ADR-015 신규 + 06 §6.1/§6.9 + 09 §9.6 + components/AGENTS.md). `_workspace_phase4` 보존 + 새 `_workspace`로 진행. ADR-015(D39~D43 5 결정 — hex 토큰 교체 + AI 면책 + 에러 매핑 동결 + 빌드 스크립트 동결 + 출시 PENDING 분리) 발행. 누적 미해결 4항 해소(SDK 패키지/useBackEvent/hex/AI 면책) | CLAUDE.md | Phase 5 마무리 — Q1~Q10 + D39~D43 + AC5.1·5.4 코드 측 ALL PASS, typecheck/lint 0 errors. AC5.2·5.3은 콘솔/디바이스 외부 작업 PENDING. 출시 외부 작업 5항만 남음. |

---

## 관련 저장소

- **백엔드 (Next.js)**: `AIReceipe` — https://github.com/peaceseungheon/AIReceipe
  - 6개 API 엔드포인트 + Supabase + AI Provider(Gemini/Claude) + RLS 정책 SSOT.
  - 본 저장소의 `docs/appsintoss-port/` 챕터는 그곳에서 작성된 SSOT 사본.
