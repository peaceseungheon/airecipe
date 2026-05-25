# Phase 4.5 Baseline — 토스 광고 기반 작업 (SDK 의존성 격리·환경 분리·시범 적용)

> 작성: orchestrator(직접 — 팀 1개 동시 제약으로 새 팀 스폰 불가) · 2026-05-25
> 입력 SSOT: `_workspace/00_input/requirements.md`, `node_modules/@apps-in-toss/framework/dist/index.d.ts:192-248`, `node_modules/.pnpm/@apps-in-toss+types@2.6.0/.../dist/index.d.ts:309-365`, `docs/appsintoss-port/09-ENV-CONFIG.md` §9.1.1/§9.4/§9.6, `CLAUDE.md` 코드 규칙
> 발행 ADR: ADR-014 (D25~D38)

## A. TDS/SDK 실재성 검증 — PASS

### A.1 `@apps-in-toss/framework` 광고 API

| 심볼 | export 경로 | 시그니처 출처 |
|------|-------------|--------------|
| `InlineAd` | `dist/index.d.ts:248` root export | `dist/index.d.ts:240-247` (InlineAdProps) |
| `loadFullScreenAd` | `dist/index.d.ts:192-195` root export | `dist/index.d.ts:192-195` + `@apps-in-toss/types/dist/index.d.ts:315-319` (LoadFullScreenAdParams) |
| `showFullScreenAd` | `dist/index.d.ts:196-199` root export | `dist/index.d.ts:196-199` + `@apps-in-toss/types/dist/index.d.ts:349-353` (ShowFullScreenAdParams) |
| `BannerSlotCallbacks` | `dist/index.d.ts:225-236` | inline 사용 콜백 6종 |
| `ShowFullScreenAdEvent` | `@apps-in-toss/types/dist/index.d.ts:346-348` | union: `clicked`/`dismissed`/`failedToShow`/`impression`/`show`/`userEarnedReward`/`requested` |
| `AdError` | `dist/index.d.ts:201-205` | `{ code, message, domain? }` |

### A.2 `@granite-js/plugin-env`

`granite.config.ts:19-23`에 이미 사용 중. config의 키를 자동으로 `src/env.d.ts`에 주입. 빌드 시점 인라인.

### A.3 검수 정책 (09 §9.6)

- 비게임 출시 가이드 — 광고는 토스 공식 SDK 사용 시 OK (외부 광고 네트워크 직접 통합 금지).
- TDS 의무 — placeholder UI도 TDS 위에 (`View`+`Txt`).
- 서비스 오픈 정책 — 광고 콘텐츠는 토스 SDK가 카테고리 필터링 담당 (도박/디지털 자산 자동 배제).

## B. 13 결정 동결 (ADR-014 D25~D38)

| ID | 결정 | 근거 |
|----|------|------|
| **D25** | 토스 공식 광고 SDK(`@apps-in-toss/framework`의 `InlineAd`/`loadFullScreenAd`/`showFullScreenAd`)만 사용. 외부 광고 네트워크 직접 통합 금지. | 검수 정책(09 §9.6) + 백엔드 분리 원칙(ADR-009). |
| **D26** | 어댑터 패턴(의존성 역전) — `src/lib/ads/types.ts`에 `AdsAdapter` 인터페이스 정의. SDK 직접 import는 `src/lib/ads/adapter.toss.ts` 1곳만 허용. | `software-design-principles` — SDK 교체 가능성·테스트 가능성 + Phase 1 ADR-010 D3(단일 호출 경로) 원칙 일반화. |
| **D27** | 환경 분기 — `src/lib/ads/index.ts`에서 `import.meta.env.APP_ENV === 'local'` 또는 `import.meta.env.ADS_ENABLED !== 'true'` 시 noop. 그 외 토스 어댑터. | dev에서 광고 호출 차단(콘솔/SDK 미발급 대비) + 환경별 토글 가능. |
| **D28** | 환경변수 3개 추가 — `ADS_ENABLED: string`(`"true"`/`"false"`), `ADS_INLINE_GROUP_ID: string`, `ADS_FULLSCREEN_GROUP_ID: string`. plugin-env로 빌드 시점 주입. dev에서 빈값 OK(noop). | 09 §9.4.2 패턴 — `import.meta.env.X`. 비밀 키 아님(클라이언트 노출 가능). |
| **D29** | dev placeholder UI — noop의 inline 컴포넌트는 회색 박스 + "광고 영역 (dev)" 텍스트. TDS `View`+`Txt`만 사용. | 검수 정책 §9.6 — 모든 UI는 TDS 위. 06 §6.3.3 카드 패턴 재사용. |
| **D30** | 시범 적용 — 본 사이클은 `src/pages/my-recipes.tsx` **목록 하단(빈 상태 + 데이터 목록 끝)**에 `<AppInlineAd slot="my-recipes-bottom" />` **1곳만**. 전면 광고는 코드만 마련하고 시범 적용 보류. | 사용자 흐름 차단 위험(전면 광고 = 생성 직후) + 빈도 제한 정책 별 ADR. 생성 화면 적용은 후속 사이클. |
| **D31** | 컴포넌트/훅 인터페이스 확정:<br>• `<AppInlineAd slot: string; theme?='auto'; tone?='grey'; variant?='expanded' />`<br>• `useFullScreenAd(): { request: () => Promise<AdResult>, isPending: boolean, error: string \| null }`<br>• `AdResult = 'shown' \| 'dismissed' \| 'failedToShow' \| 'no_fill' \| 'cancelled'` | InlineAdProps SSOT(`dist/index.d.ts:240-247`) + ShowFullScreenAdEvent union 정규화. |
| **D32** | 이벤트 정규화 매핑 (어댑터 `showFullScreen` 내부):<br>• `dismissed` → resolve(`'dismissed'`)<br>• `failedToShow` → reject(AdError) → 어댑터가 `'failedToShow'` 정규화 후 reject<br>• `clicked`/`impression`/`show`/`requested` → 콜백 로깅 only<br>• `userEarnedReward` → 본 미니앱은 보상형 미사용, 발생 시 로깅 + `'dismissed'` 처리<br>• `onError` → reject(string) | dismissed가 사용자 종료 신호, 다른 이벤트는 lifecycle. |
| **D33** | 콜백 로깅 정책 — onAdImpression/Clicked는 `console.log` only (본 사이클). Analytics SDK 통합은 별 ADR. `onNoFill`은 디버그 로깅 + UI는 collapse(빈 공간 노출 회피). | YAGNI — Phase 4.5는 기반만, 분석은 측정 데이터 본 뒤. |
| **D34** | 빈도 제한·세션 한도 — 본 사이클 미적용. 어댑터에 hook point만(미래에 빈도 제한 wrapper 추가 가능). | YAGNI + 측정 데이터 필요. |
| **D35** | 신규 SSOT 챕터 `docs/appsintoss-port/11-ADS.md` 발행. | 광고 영역은 03~09 어디에도 없음. 별 챕터가 SSOT. |
| **D36** | AGENTS.md 갱신 — `src/lib/AGENTS.md`(신규, ads 디렉토리 책임), `src/components/AGENTS.md` 보강(AppInlineAd), `src/hooks/AGENTS.md` 보강(useFullScreenAd). | `technical-documentation` — 디렉토리 책임 추적. |
| **D37** | qa(메인) 검증 의무 — `src/`에서 `from '@apps-in-toss/framework'` grep, `src/lib/ads/adapter.toss.ts` 외 0건 + `from 'react-native'`로의 위장 import 0건 + adGroupId 하드코딩 0건. | D26 시행 보장. |
| **D38** | typecheck — `granite.config.ts`에 `ADS_*` 키 추가 시 `src/env.d.ts`가 plugin-env에 의해 자동 재생성(빌드/dev 시점). typecheck 전에 빌드 1회 또는 메인이 수동으로 env.d.ts 갱신. | env.d.ts는 .gitignore — 자동 생성. |

## C. 작업 분할 다이어그램

```
[1] src/lib/ads/types.ts                                                 (직접 작성, 의존 0)
[2] src/lib/ads/adapter.noop.ts                  ← depends [1]            (직접 작성)
[3] src/lib/ads/adapter.toss.ts                  ← depends [1]            (직접 작성)
[4] src/lib/ads/index.ts                         ← depends [1][2][3]      (직접 작성)
[5] src/components/AppInlineAd.tsx               ← depends [1][4]          (직접 작성)
[6] src/hooks/useFullScreenAd.ts                 ← depends [1][4]          (직접 작성)
[7] granite.config.ts (env 키 3개 추가)          ← 독립                    (직접 작성)
[8] src/env.d.ts 갱신 (수동 또는 build 1회)      ← depends [7]             (수동 동기)
[9] src/pages/my-recipes.tsx 확장 (AppInlineAd)  ← depends [5]             (직접 작성)
[10] docs/appsintoss-port/11-ADS.md              ← depends [4-6]           (직접 작성)
[11] docs/adr/ADR-014-toss-ads-integration.md    ← depends [B]             (직접 작성)
[12] src/lib/AGENTS.md (신규), src/components/AGENTS.md·src/hooks/AGENTS.md 보강  (직접 작성)
[13] pnpm typecheck + pnpm lint                  ← depends [1-9]          (검증)
[14] _workspace/03_qa_report.md (D37 매트릭스)   ← depends [13]            (검증)
[15] _workspace/04_session_log.md                ← depends [14]            (마무리)
[16] CLAUDE.md "현재 단계" 갱신                  ← depends [15]            (마무리)
```

## D. SDK 이벤트 정규화 매핑 (D32 상세)

| SDK 이벤트 | 어댑터 처리 | AdResult |
|-----------|-------------|----------|
| `requested` | console.debug | (계속) |
| `show` | console.debug + `onShown` 콜백 호출 | (계속) |
| `impression` | console.debug + onAdImpression 콜백 호출 | (계속) |
| `clicked` | console.debug + onAdClicked 콜백 호출 | (계속) |
| `dismissed` | promise resolve | `'dismissed'` |
| `failedToShow` | promise reject(AdError) → 호출 측에서 정규화 catch | `'failedToShow'` |
| `userEarnedReward` | 본 미니앱 미사용 — 로깅 + dismissed 동일 처리 | `'dismissed'` |
| (no event, `onError`) | promise reject(err) → 호출 측 catch | `'failedToShow'` |

InlineAd `onNoFill` 콜백 → `AppInlineAd` 내부 state `isNoFill=true` → `null` 렌더(collapse). 다른 콜백은 props로 외부 노출하지 않음 (본 사이클 D33).

## E. 환경별 빌드 매트릭스

| 환경 | `APP_ENV` | `ADS_ENABLED` | `ADS_INLINE_GROUP_ID` | `ADS_FULLSCREEN_GROUP_ID` | 어댑터 |
|------|-----------|---------------|----------------------|---------------------------|--------|
| local dev | `local` | (any) | (빈값 OK) | (빈값 OK) | **noop** (APP_ENV gate) |
| staging | `staging` | `"true"` | 콘솔 발급값 | 콘솔 발급값 | **toss** |
| staging (광고 끔) | `staging` | `"false"` | (any) | (any) | **noop** |
| production | `production` | `"true"` | 콘솔 발급값 | 콘솔 발급값 | **toss** |

## F. 시범 적용 위치 (D30)

`src/pages/my-recipes.tsx`:
- **빈 상태 분기 위치(EmptyState 아래)**: 데이터 0건일 때도 광고 표시 — 사용자 컨텐츠 부재 시점에 광고 기회.
- **데이터 목록 끝 (마지막 RecipeCard 아래)**: 정상 목록에서도 광고 노출.

본 사이클은 두 위치 모두에 `<AppInlineAd slot="my-recipes-bottom" />` 1회 — 빈/정상 분기와 무관하게 `AdsBottomSlot`처럼 헬퍼 추출(my-recipes.tsx 내부 const 함수)로 중복 회피.

전면 광고는 hook만 마련(코드 PASS) + 페이지에 wiring 0건(D30).

## G. 자체 검증 체크리스트 (D37 qa 매트릭스)

- [ ] (G1) `src/` 전체에서 `from '@apps-in-toss/framework'` grep → `src/lib/ads/adapter.toss.ts` 1개 결과만.
- [ ] (G2) `src/` 전체에서 `adGroupId.*=.*['"]` (하드코딩) grep → 0건.
- [ ] (G3) `granite.config.ts`에 `ADS_*` 3개 키 정의 + `src/env.d.ts`에 자동 반영 확인.
- [ ] (G4) `src/lib/ads/adapter.noop.ts`의 placeholder UI가 TDS `View`+`Txt`만 사용 — TextField/Pressable 직접 RN import 0건.
- [ ] (G5) AppInlineAd의 props가 SDK BannerSlotCallbacks를 외부에 노출하지 않음(내부 캡슐화 — D33 정책).
- [ ] (G6) useFullScreenAd의 cleanup이 cancel 함수(load/show 둘 다)를 호출 — unmount 시 SDK 리소스 누수 0.
- [ ] (G7) `pnpm typecheck` PASS + `pnpm lint` PASS.
- [ ] (G8) my-recipes.tsx의 4-way 분기(로딩/비식별자/에러/정상+빈) 모두에서 `<AppInlineAd />` 위치 일관 또는 빈 상태에선 미렌더 결정.
- [ ] (G9) 11-ADS.md + ADR-014 발행 + AGENTS.md 3건 갱신.

## H. 멈춤 트리거

- (H1) `src/env.d.ts` 자동 갱신이 dev/build 없이 안 됨 — 수동 보강 또는 build 1회.
- (H2) granite.config.ts schema mismatch (env 타입 강제) — 빌드 에러 시 처리.
- (H3) typecheck FAIL — 즉시 수정 후 재실행.
- (H4) qa 매트릭스 G1 위반 (SDK 직접 import 다중 위치) — 즉시 어댑터 경로로 이동.

## I. 비범위 (재확인)

- 광고 빈도 제한(D34), Analytics 통합(D33), 전면 광고 wiring(D30), 콘솔 adGroupId 발급/승인, Phase 4 미완 작업(즐겨찾기·삭제·404 통일 — `_workspace_phase4_paused/`).

## J. 다음 단계 (실행 순서)

1. C 다이어그램 [1]~[9] 순서대로 코드 작성.
2. [13] typecheck/lint — env.d.ts 갱신 필요 시 수동 보강.
3. [14] qa 매트릭스 G1~G9 점검.
4. [10][11][12] 문서.
5. [15][16] session log + CLAUDE.md.
6. 커밋.
