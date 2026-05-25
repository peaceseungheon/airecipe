# Phase 4.5 — 토스 광고(앱인토스 SDK) 기반 작업

> 출처: 사용자 요청 "토스 광고를 붙이려고 하니깐 기반 작업을 진행해줘"
> SSOT 신규 생성: `docs/appsintoss-port/11-ADS.md` (본 사이클에서 작성)
> 관련 ADR 신규: `docs/adr/ADR-014-toss-ads-integration.md`

## 목적

앱인토스 RN 미니앱(`airecipe-miniapp`)에 **토스 광고 SDK**(`@apps-in-toss/framework` 노출)를 도입하기 위한 **기반 인프라**를 구축한다. 본 사이클의 산출은 광고를 실제 화면에 붙이기 전 단계의 "기반 작업"이다:

- SDK 의존성 격리(어댑터·훅·컴포넌트 추상화)
- 환경변수 분리(staging/production에서 광고 적용, dev에서 noop)
- 검수 정책(앱인토스 광고 정책)과의 정합성 검증
- 시범 적용 1~2곳(architect 결정 — 후보: 마이 레시피 목록 상단·하단, 생성 결과 화면 하단, 또는 보류)
- SSOT 챕터(`11-ADS.md`)·ADR-014 발행 + AGENTS.md 갱신

## 입력 전제 (현 시점)

- **Phase 4 일시 보류** — `_workspace_phase4_paused/`로 보존. 즐겨찾기·삭제·404 통일은 다음 사이클에서 재개 가능.
- **Phase 3 완료 동결** — Phase 3까지의 6 엔드포인트·라우팅·캐시·404 단일 컴포넌트(ADR-005·010·011·012) 그대로.
- **토스 SDK 패키지** — `@apps-in-toss/framework@^2.6.0`이 이미 설치되어 있고 `@apps-in-toss/types@2.6.0`이 의존성으로 포함됨.
- **콘솔** — `adGroupId` 발급은 앱인토스 콘솔에서 별도 신청·승인 필요(외부 의존성).
- **GeneralPlugin-env** — `granite.config.ts`에서 빌드 시점 환경변수 주입 사용 중(09-ENV-CONFIG §9.4.2).

## 토스 광고 SDK 외부 인터페이스 (현재 확인)

`node_modules/@apps-in-toss/framework/dist/index.d.ts` + `node_modules/.pnpm/@apps-in-toss+types@2.6.0/.../dist/index.d.ts` 인용:

### 1. `InlineAd` (인라인 배너) — `framework` root export
```ts
interface InlineAdProps extends BannerSlotCallbacks {
  adGroupId: string;
  theme?: 'auto' | 'light' | 'dark';
  tone?: 'blackAndWhite' | 'grey';
  variant?: 'expanded' | 'card';
  impressFallbackOnMount?: boolean;
}
declare function InlineAd(props: InlineAdProps): JSX.Element | null;

interface BannerSlotCallbacks {
  onAdRendered?: (p: BannerSlotEventPayload) => void;
  onAdViewable?: (p: BannerSlotEventPayload) => void;
  onAdClicked?: (p: BannerSlotEventPayload) => void;
  onAdImpression?: (p: BannerSlotEventPayload) => void;
  onAdFailedToRender?: (p: BannerSlotErrorPayload) => void;
  onNoFill?: (p: { slotId: string; adGroupId: string; adMetadata: Record<string, never> }) => void;
}

interface BannerSlotEventPayload {
  slotId: string;
  adGroupId: string;
  adMetadata: { creativeId: string; requestId: string; styleId: string };
}

interface BannerSlotErrorPayload {
  slotId: string;
  adGroupId: string;
  adMetadata: Record<string, never>;
  error: { code: number; message: string; domain?: string };
}
```

### 2. `loadFullScreenAd` (전면 광고 사전 로드) — `framework` root export
```ts
declare const loadFullScreenAd: {
  (params: LoadFullScreenAdParams): () => void;   // 반환값 = cancel 함수
  isSupported: () => boolean;
};

interface LoadFullScreenAdParams {
  options: { adGroupId: string };
  onEvent: (data: { type: 'loaded' }) => void;
  onError: (err: unknown) => void;
}
```

### 3. `showFullScreenAd` (전면 광고 표시) — `framework` root export
```ts
declare function showFullScreenAd(params: ShowFullScreenAdParams): () => void;   // 반환값 = cancel 함수
declare namespace showFullScreenAd {
  var isSupported: () => boolean;
}

interface ShowFullScreenAdParams {
  options: { adGroupId: string };
  onEvent: (data: ShowFullScreenAdEvent) => void;
  onError: (err: unknown) => void;
}

type ShowFullScreenAdEvent =
  | { type: 'clicked' }
  | { type: 'dismissed' }
  | { type: 'failedToShow'; error: AdError }
  | { type: 'impression' }
  | { type: 'show' }
  | { type: 'userEarnedReward'; amount: number; type_: string }
  | { type: 'requested' };

interface AdError { code: number; message: string; domain?: string }
```

## 산출물 (본 사이클)

### A. 문서 (SSOT)

1. **`docs/appsintoss-port/11-ADS.md`** (신규 챕터)
   - §11.0 이 챕터의 목적·읽기 순서
   - §11.1 SDK 외부 인터페이스 인용 (위 3개 — 본 문서 사본 + 패키지 경로 인용)
   - §11.2 적용 형태 선택 매트릭스 (Inline vs FullScreen vs 둘 다)
   - §11.3 환경 분리 정책 (`ADS_ENABLED`/`ADS_INLINE_GROUP_ID`/`ADS_FULLSCREEN_GROUP_ID` — dev/staging/production)
   - §11.4 미니앱 코드 의존성 격리 (어댑터 인터페이스 + dev noop 구현 + production 실 SDK 구현)
   - §11.5 UX 가이드 (배너 위치·전면 광고 트리거 조건·빈도 제한·접근성·다크모드 `theme: 'auto'`)
   - §11.6 검수 정책 정합성 (앱인토스 광고 정책·AI 면책 충돌 여부·CORS/도메인 화이트리스트 영향 0건 확인)
   - §11.7 테스트 가능성 (어댑터 mock·이벤트 콜백 검증)
   - §11.8 변경 이력
2. **`docs/adr/ADR-014-toss-ads-integration.md`** (신규 ADR)
   - 결정 카탈로그 (D25~D30 예상): 어댑터 분리 패턴, 환경변수 정책, dev noop 구현, 시범 적용 위치, 빈도 제한 정책, 광고 미수신(NoFill·Error) 시 UI 폴백.

### B. 코드

3. **`src/lib/ads/types.ts`** (신규) — 어댑터 인터페이스 정의 (SDK 의존성 격리)
   - `AdsAdapter` 인터페이스: `inline(props): JSX.Element`, `loadFullScreen(opts): Promise<void> | (() => void)`, `showFullScreen(opts): Promise<ShowResult>`, `isEnabled(): boolean`.
   - 타입은 SDK 타입을 재export하되 어댑터를 통해서만 접근 — 직접 SDK import는 어댑터 구현 파일만 허용.

4. **`src/lib/ads/adapter.toss.ts`** (신규) — 토스 SDK 실 구현 어댑터
   - `@apps-in-toss/framework`의 `InlineAd`/`loadFullScreenAd`/`showFullScreenAd`만 본 파일에서 import.
   - SDK 이벤트를 단일 Promise/콜백 시그니처로 정규화.

5. **`src/lib/ads/adapter.noop.ts`** (신규) — dev/테스트용 placeholder 어댑터
   - `inline` → 회색 박스 + "광고 영역 (dev)" 텍스트 (TDS `View`+`Txt`).
   - `loadFullScreen`/`showFullScreen` → 콘솔 로그 + 즉시 resolve. SDK 호출 없음.

6. **`src/lib/ads/index.ts`** (신규) — 환경에 따라 어댑터 선택
   - `import.meta.env.ADS_ENABLED === 'true'` → toss 어댑터, 아니면 noop.
   - `import.meta.env.APP_ENV === 'development'` → 강제 noop (dev에서 광고 호출 차단).

7. **`src/components/AppInlineAd.tsx`** (신규) — InlineAd 합성 컴포넌트
   - props: `{ slot: 'my-recipes-top' | 'recipe-detail-bottom' | ... }` (architect 결정).
   - 내부적으로 `ads.inline({ adGroupId: env.ADS_INLINE_GROUP_ID, theme: 'auto', tone: 'grey', variant: 'expanded' })`.
   - 콜백을 통해 onAdImpression/Clicked 로깅(필요 시).

8. **`src/hooks/useFullScreenAd.ts`** (신규) — load + show를 1회 호출로 묶은 훅
   - 시그니처(baseline 확정): `() => { request: () => Promise<ShowResult>, isPending: boolean, error: string | null }`.
   - 내부에서 `loadFullScreenAd` → 'loaded' 후 `showFullScreenAd` 호출. cleanup으로 cancel 함수 호출.
   - dev noop에서는 즉시 dismissed 시뮬레이션.

9. **`granite.config.ts`** (수정) — plugin-env에 광고 환경변수 추가
   - `ADS_ENABLED: string`, `ADS_INLINE_GROUP_ID: string`, `ADS_FULLSCREEN_GROUP_ID: string`.
   - `.env.local`(미트래킹) 예시 + `.env.staging`/`.env.production`(미트래킹) 사용법은 09-ENV-CONFIG 갱신에 명시.

10. **시범 적용 (1~2곳, architect 결정)**:
    - 후보 A: `src/pages/my-recipes.tsx` — 목록 상단/하단에 `<AppInlineAd slot="my-recipes-top" />`.
    - 후보 B: `src/pages/recipe/generate.tsx` — 생성 완료 + 저장 후에 `useFullScreenAd().request()` (선택적).
    - **권장**: 후보 A만 본 사이클에서 적용 — 전면 광고는 사용자 흐름 차단 위험 + 빈도 제한 정책 필요. ADR에서 결정.

11. **AGENTS.md 갱신**:
    - `src/lib/AGENTS.md`(없으면 신규) — 광고 어댑터 책임·SDK 의존성 격리 규칙.
    - `src/components/AGENTS.md` 보강 — `AppInlineAd` 책임.
    - `src/hooks/AGENTS.md` 보강 — `useFullScreenAd` 시그니처.

### C. 운영

12. **CLAUDE.md "현재 단계" 갱신** — Phase 4 보류 + Phase 4.5(토스 광고 기반) 완료 표기. 변경 이력에 행 추가.

## SSOT 인용 경로

| 영역 | 챕터 |
|------|------|
| SDK 외부 인터페이스 | `node_modules/@apps-in-toss/framework/dist/index.d.ts:192-248` + `node_modules/.pnpm/@apps-in-toss+types@2.6.0/.../dist/index.d.ts:309-365` |
| 환경변수 주입 | `docs/appsintoss-port/09-ENV-CONFIG.md` §9.4.2 (plugin-env) |
| 비밀 키 정책(클라이언트 비포함) | `docs/appsintoss-port/09-ENV-CONFIG.md` §9.1.1 + `CLAUDE.md` 코드 규칙 #1 |
| 검수 정책 | `docs/appsintoss-port/09-ENV-CONFIG.md` §9.6 + `appsintoss-publish-checklist` 스킬 |
| TDS 사용 의무 (placeholder UI도 TDS) | `CLAUDE.md` 코드 규칙 #2 + ADR-009 D3 |
| 어댑터 패턴(의존성 역전) | `software-design-principles` 스킬 |

## 수용 기준

- **AC4.5.1**: `pnpm typecheck` + `pnpm lint` PASS, FAIL 0건.
- **AC4.5.2**: `import.meta.env.ADS_ENABLED !== 'true'` 또는 dev 환경에서는 noop 어댑터만 사용 — `@apps-in-toss/framework`의 광고 API가 호출되지 않음 (코드 경로 PASS).
- **AC4.5.3**: 시범 적용 위치(architect 결정) 1곳 이상에 `<AppInlineAd />` 또는 `useFullScreenAd().request()`가 wiring되어 있음. 코드 경로 PASS.
- **AC4.5.4**: `adGroupId`는 코드에 하드코딩 0건. 모두 `import.meta.env.ADS_*_GROUP_ID`에서.
- **AC4.5.5**: SDK 직접 import(`@apps-in-toss/framework`의 `InlineAd`/`loadFullScreenAd`/`showFullScreenAd`)는 `src/lib/ads/adapter.toss.ts` 1곳에서만 발생.
- **AC4.5.6**: `docs/appsintoss-port/11-ADS.md` + `docs/adr/ADR-014-toss-ads-integration.md` 발행. AGENTS.md 3곳 갱신.
- **AC4.5.7**: `appsintoss-publish-checklist` 항목 중 광고 관련 정책 위반 0건(architect/qa 확인).
- **AC4.5.8**: noop 어댑터의 placeholder UI가 TDS 컴포넌트(`View`+`Txt`)만 사용(검수 정책 — 모든 UI는 TDS 위).

## 비범위

- **실 광고 송출 확인** — 콘솔에서 `adGroupId` 발급·승인이 별도 작업. 본 사이클은 코드 경로 PASS까지.
- **빈도 제한·세션 한도** — D29 ADR로 결정만 (구현은 후속 사이클에서 측정 데이터 본 뒤).
- **수익 분석·Analytics 연동** — onAdImpression/Clicked 콜백 위치만 마련. 분석 SDK 통합은 별 ADR.
- **Phase 4 미완(즐겨찾기·삭제·404 통일)** — 별 사이클에서 재개. `_workspace_phase4_paused/` 보존.
- **무한 스크롤·디자인 토큰 일괄 교체** — Phase 3 누적 미해결 그대로(Phase 5 또는 별 ADR).

## 위험·완화

| 위험 | 완화 |
|------|------|
| `adGroupId` 발급 전 빌드/실행 시 SDK가 어떻게 반응하는지 불명확 | dev에서 noop 강제. staging/production에서 `adGroupId` 없으면 빌드 시점 환경변수 누락 → AppInlineAd가 noop으로 폴백 (architect 결정). |
| InlineAd `onNoFill`/`onAdFailedToRender` 시 UI 빈 공간 노출 | placeholder 또는 collapse 정책 — ADR-014 결정. |
| 전면 광고 사용자 흐름 차단 (생성 직후) | 본 사이클에서는 전면 광고 시범 적용 보류 권장. ADR-014에서 결정. |
| 광고 정책 위반(AI 면책 충돌, 도박/디지털 자산 광고) | `appsintoss-publish-checklist` 스킬로 사전 점검. 차단 카테고리는 콘솔에서 설정. |
| `@apps-in-toss/framework` SDK 직접 import 누락 검사 | qa가 `src/{components,hooks,pages}/`에서 SDK 직접 import grep, 0건 검증(어댑터 외 0건). |
| TDS 외 컴포넌트 사용 (noop placeholder) | placeholder도 `View`+`Txt`만. 검수 정책 §9.6 준수. |
| `ADS_ENABLED` 분기 누락 — production 빌드에 실 SDK 호출 강제 | 어댑터 선택 로직(`src/lib/ads/index.ts`)에 단위 테스트 가능한 분기 로직. 환경변수 ↔ 어댑터 매핑 표 11-ADS §11.3에 명시. |
| 새로 추가한 환경변수가 빌드에 누락 | `granite.config.ts`의 plugin-env 설정과 `src/env.d.ts` 자동 생성 검증. T1에서 baseline에 명시. |
| Phase 4 미완 재개 시 누락 위험 | `_workspace_phase4_paused/` 보존 + CLAUDE.md "현재 단계"에 "Phase 4 보류" 명시 + Phase 4 인계 6항 그대로 유지. |
| `LoadFullScreenAdEvent`/`ShowFullScreenAdEvent` 이벤트 다양함 ('requested', 'show', 'impression', 'clicked', 'dismissed', 'failedToShow', 'userEarnedReward') 처리 누락 | 어댑터에서 모든 이벤트를 표준 `AdResult` 객체로 정규화. `dismissed`만 Promise resolve, `failedToShow`/`onError`는 reject. baseline에서 정규화 매핑 표 확정. |
