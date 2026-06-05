# 11. 토스 광고(앱인토스 SDK) 사용 가이드

> **이 챕터 전에 알아야 할 것**: 09-ENV-CONFIG(plugin-env·검수 정책), ADR-009(아키텍처), `CLAUDE.md` 코드 규칙.
>
> **이 챕터 완료 후**: 본 미니앱이 토스 광고 SDK를 의존성 격리된 어댑터로 사용하고, 환경별로 자동 활성/비활성하며, dev에서 SDK 호출 0건임을 검증할 수 있다.

---

## 11.0 이 챕터의 목적

본 미니앱이 **앱인토스 토스 광고 SDK**(`@apps-in-toss/framework`의 `InlineAd` / `loadFullScreenAd` / `showFullScreenAd`)를 안전하게 도입한다:

- SDK 의존성을 단일 어댑터 모듈로 격리(다른 모든 파일은 어댑터만 호출)
- 환경 분기(dev → noop, staging/production+ADS_ENABLED → toss)
- 검수 정책(09 §9.6) 정합성 — 모든 placeholder도 TDS 위
- 이벤트 7종(`requested/show/impression/clicked/dismissed/failedToShow/userEarnedReward`) 정규화 매핑
- 시범 적용 1곳(`/my-recipes` 하단), 전면 광고는 코드만(시범 wiring 보류)

본 챕터는 ADR-014와 짝이다. ADR-014가 결정(D25~D38)을 보전하고, 본 챕터는 사용 패턴·코드 위치·QA 매트릭스를 보전한다.

## 11.1 SDK 외부 인터페이스 (인용)

`node_modules/@apps-in-toss/framework/dist/index.d.ts:192-248` + `@apps-in-toss/types/dist/index.d.ts:309-353`.

```ts
// InlineAd — 인라인 배너
interface InlineAdProps extends BannerSlotCallbacks {
  adGroupId: string;
  theme?: 'auto' | 'light' | 'dark';
  tone?: 'blackAndWhite' | 'grey';
  variant?: 'expanded' | 'card';
  impressFallbackOnMount?: boolean;
}
function InlineAd(props: InlineAdProps): JSX.Element | null;

interface BannerSlotCallbacks {
  onAdRendered?, onAdViewable?, onAdClicked?, onAdImpression?,
  onAdFailedToRender?, onNoFill?: ((payload) => void);
}

// loadFullScreenAd — 전면 광고 사전 로드 (cancel 반환)
declare const loadFullScreenAd: {
  (params: { options: { adGroupId }, onEvent: (e: { type: 'loaded' }) => void, onError: (err) => void }): () => void;
  isSupported: () => boolean;
};

// showFullScreenAd — 전면 광고 표시 (cancel 반환)
declare function showFullScreenAd(params: {
  options: { adGroupId },
  onEvent: (e: ShowFullScreenAdEvent) => void,
  onError: (err) => void,
}): () => void;

type ShowFullScreenAdEvent =
  | { type: 'requested' } | { type: 'show' } | { type: 'impression' }
  | { type: 'clicked' }   | { type: 'dismissed' }
  | { type: 'failedToShow' }     // 주의: error 필드 없음 (types 인용)
  | { type: 'userEarnedReward'; data: {...} };
```

> 주의: 본 미니앱이 사용하는 `@apps-in-toss/types@2.6.0`의 `AdFailedToShow$1`은 `{ type: 'failedToShow' }`만 (error 필드 없음). 광고 실패 원인은 별도 `onError` 콜백 경로로 전달.

## 11.2 적용 형태 선택 매트릭스

| 형태 | 사용처(권장) | 트리거 | SSOT |
|------|------------|--------|------|
| InlineAd (인라인 배너) | 목록·상세 화면 하단·빈 상태 | 화면 마운트 시 자동 | D30 — `/my-recipes` 하단 |
| FullScreen (전면 광고) | 생성 직후·핵심 전환 후 | 사용자 명시 액션 | D30 — **본 사이클 wiring 보류**(빈도 제한 정책 별 ADR) |

본 사이클은 InlineAd만 시범 적용. 전면 광고는 코드만 마련(`src/hooks/useFullScreenAd.ts`).

## 11.3 환경 분리 정책

`granite.config.ts`의 plugin-env에 등록된 키:

| 변수 | 타입 | dev 기본 | staging/production 권장 |
|------|------|---------|-------------------------|
| `ADS_ENABLED` | `string` | `"false"` | `"true"` |
| `ADS_INLINE_GROUP_ID` | `string` | `""` | 앱인토스 콘솔 발급값 |
| `ADS_FULLSCREEN_GROUP_ID` | `string` | `""` | 앱인토스 콘솔 발급값 |

`src/lib/ads/index.ts`의 분기 (D27):

```ts
// pseudo
if (APP_ENV === 'local')         → noop
else if (ADS_ENABLED !== 'true') → noop
else                              → toss(config)
```

| 환경 | APP_ENV | ADS_ENABLED | 어댑터 |
|------|---------|-------------|--------|
| local dev | `local` | (any) | noop |
| staging (광고 끔) | `staging` | `"false"` | noop |
| staging (광고 켬) | `staging` | `"true"` | **toss** |
| production | `production` | `"true"` | **toss** |

빌드 시점 환경변수는 `process.env`로 받아 `import.meta.env.X`로 인라인. `.env.local`/`.env.staging`/`.env.production` 또는 CI 환경변수에서 주입(09 §9.4.1).

## 11.4 미니앱 코드 의존성 격리

본 챕터의 핵심 정책 — **SDK 직접 import는 단일 위치만**.

| 파일 | 책임 | SDK 직접 import |
|------|------|----------------|
| `src/lib/ads/types.ts` | 어댑터 인터페이스 (`AdsAdapter`, `AdResult`, `InlineAdSlotProps`) | 0 |
| `src/lib/ads/adapter.toss.tsx` | 토스 SDK 실 구현 어댑터 + 이벤트 정규화 | **1 (허용 — 본 모듈만)** |
| `src/lib/ads/adapter.noop.tsx` | dev/disabled placeholder 어댑터 | 0 |
| `src/lib/ads/index.ts` | 환경 분기 → `ads` 객체 export | 0 |
| `src/components/AppInlineAd.tsx` | `ads.InlineAdSlot` 위임 | 0 |
| `src/hooks/useFullScreenAd.ts` | `ads.showFullScreen` 위임 | 0 |
| `pages/**`(라우트 구현 — ADR-018), `src/components/**` 그 외 | `<AppInlineAd>`/`useFullScreenAd()` 사용 | 0 |

검증: `grep -rn "from ['\"]@apps-in-toss/framework['\"]" src/ | grep -i "InlineAd\|loadFullScreen\|showFullScreen"` → `adapter.toss.tsx` 1행만.

(별도로 `_app.tsx`의 `AppsInToss`와 `useTossUserId.tsx`의 `getAnonymousKey`는 광고 SDK가 아니라 미니앱 컨테이너/식별 SDK — 격리 정책 대상 외.)

## 11.5 UX 가이드

### 11.5.1 배너 위치

**전 화면 상단 고정 배너 (ADR-022 rev.2 — `TopAdBanner`).**

- 각 라우트 화면이 `PageNavbar` **바로 아래**(스크롤 영역 밖, 상단 고정)에 `<TopAdBanner slot="..." />`를 1줄 마운트한다 — `BottomTabBar`와 동일한 **화면-내 마운트 패턴**(ADR-017 D53). ⚠ `_app.tsx` 앱 루트에 마운트 금지(ADR-022 rev.1 — 루트 마운트는 TDSProvider·네비게이션 컨텍스트 바깥이라 운영 빌드에서 앱 전체 크래시했다).
- `InlineAd`는 impression 측정 컨텍스트가 필수 → 고정 배너는 `impressFallbackOnMount: true`로 마운트(어댑터에서 일괄, ADR-022 D85). `IOScrollView` 사용 시엔 그 안에 배치.
- 광고 렌더 실패가 앱을 죽이지 않도록 `AppInlineAd`는 에러 바운더리로 감쌈(ADR-022 D86). 미지원 환경(Toss앱 < 5.241.0 등)은 배너만 숨김.
- `ads.isEnabled()`(D27 게이트) false면 `null` 렌더(공간 0·회귀 0). live group id는 `.env.<env>` `ADS_INLINE_GROUP_ID` + `ADS_ENABLED=true`로 주입.
- 적용 범위: 10개 라우트 화면 메인 콘텐츠(상단). `/my-recipes`는 상단으로 통일(기존 하단 `my-recipes-bottom` 제거). `_404`·`NotFoundScreen`(전체화면)·전이 분기는 제외.

### 11.5.2 전면 광고 트리거

- 사용자 명시 액션 후만(예: 저장 직후·결과 화면 진입). 자동 트리거 금지.
- 본 사이클은 wiring 0곳(D30) — 빈도 제한 정책 결정 후 적용.

### 11.5.3 접근성·다크모드

- `theme: 'auto'` 기본 — TDS adaptive와 일치.
- `tone: 'grey'` 기본 — 본 미니앱 화이트 베이스에 자연스러움.
- placeholder UI도 TDS `Txt typography="st9"` + adaptive 컬러.

### 11.5.4 빈 응답 처리

- `onNoFill` 발생 시 `<AppInlineAd>`는 toss 어댑터 내부에서 `null` 렌더(빈 공간 회피).
- 화면 측은 광고 영역 높이를 고정 가정하지 않음(`minHeight`만 어댑터가 보장).

## 11.6 검수 정책 정합성

09 §9.6 비게임 출시 가이드 + `appsintoss-publish-checklist`:

| 항목 | 본 챕터 정합성 |
|------|---------------|
| 토스 공식 SDK 사용 | ✓ `@apps-in-toss/framework`만 (외부 광고 네트워크 0) |
| TDS 의무 (placeholder도) | ✓ noop 어댑터의 placeholder가 `View`+`Txt`만 사용 (D29) |
| AI 면책과의 충돌 | ✓ 광고 영역과 AI 생성 콘텐츠는 시각적 분리(레시피 카드 ↔ 광고 슬롯 별 컨테이너) |
| 디지털 자산·도박·자금세탁 카테고리 | ✓ 토스 SDK가 카테고리 필터링 담당(미니앱 측 추가 검사 없음) |
| CORS/도메인 화이트리스트 | ✓ 영향 0 (광고는 토스 SDK 내부 호출, 미니앱 백엔드 도메인 무관) |
| 권한 | ✓ 추가 권한 0 (`permissions: []`) |
| 번들 100MB | ✓ 광고는 native 측 (번들 증가 미미) |
| AI 면책 문구 | (별도 — 영양 정보·`healthNote`에 적용, 광고와 무관) |

## 11.7 테스트 가능성

- 어댑터 인터페이스(`AdsAdapter`)로 mock 구현 가능 — 단위 테스트에서 `ads` 객체 swap.
- `useFullScreenAd` 훅은 `request()` 호출 시 어댑터의 `showFullScreen`을 한 번 호출하므로 mock으로 결과 검증 가능.
- 본 사이클은 단위 테스트 미포함(YAGNI) — 추후 도입 시 본 §의 패턴 따름.

## 11.8 QA 매트릭스 (`integration-coherence-qa` 스킬 적용)

QA가 본 챕터 검증 시 다음 9건을 확인:

- [ ] (G1) `grep -rn "from ['\"]@apps-in-toss/framework['\"]" src/` → 광고 SDK(InlineAd/loadFullScreenAd/showFullScreenAd)는 `src/lib/ads/adapter.toss.tsx` 1행만.
- [ ] (G2) `adGroupId.*=.*['"]` (하드코딩) grep → 0건.
- [ ] (G3) `granite.config.ts`에 `ADS_*` 3개 키 정의 + `src/env.d.ts`에 반영(빌드 시 자동).
- [ ] (G4) noop placeholder가 TDS `View`+`Txt`만 사용(직접 RN import 0건은 React Native primitives 한정 — `StyleSheet`/`View`는 노출 React Native, `Txt`는 TDS).
- [ ] (G5) `AppInlineAd` props가 SDK BannerSlotCallbacks를 외부에 노출하지 않음.
- [ ] (G6) `useFullScreenAd` cleanup이 cancel 함수 호출(unmount·새 request) — SDK 리소스 누수 0.
- [ ] (G7) `pnpm typecheck` + `pnpm lint` PASS (0 errors, router.gen.ts warning 무해).
- [ ] (G8) `my-recipes.tsx` 4-way 분기(로딩/에러/빈/정상) 중 빈+정상에만 광고 렌더. 로딩/에러 미렌더.
- [ ] (G9) 11-ADS.md + ADR-014 + AGENTS.md 3건 발행.

## 11.9 SSOT 참조

- ADR-014 (광고 도입 결정 카탈로그)
- `_workspace/01_architect_phase45_baseline.md` (Phase 4.5 baseline)
- `node_modules/@apps-in-toss/framework/dist/index.d.ts:192-248` + `@apps-in-toss/types/dist/index.d.ts:309-353` (SDK 타입)
- 09-ENV-CONFIG §9.4 (plugin-env), §9.6 (검수 정책)
- ADR-009 (백엔드 분리 + TDS 의무 + 의존성 격리 원칙)
- `CLAUDE.md` 코드 규칙

## 11.10 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-25 | 초기 작성 (Phase 4.5) | 토스 광고 SDK 도입 기반 작업 — 어댑터 격리, 환경 분리, 시범 적용 1곳(`/my-recipes` 하단). ADR-014 D25~D38 13 결정 동결과 동시 발행. |
| 2026-06-04 | 전역 상단 고정 배너 추가 (ADR-022 rev.1, **철회**) — `_app.tsx` 루트 마운트 방식. | 운영 빌드 실기기에서 앱 전체 검정 화면 크래시(InlineAd가 TDSProvider·네비게이션 컨텍스트 바깥에서 렌더). |
| 2026-06-05 | 전 화면 상단 고정 배너 (ADR-022 rev.2) — §11.5.1을 `TopAdBanner` 화면-내 마운트로 정정. 각 화면 `PageNavbar` 아래 마운트 + `impressFallbackOnMount: true`(impression 컨텍스트) + `AppInlineAd` 에러 바운더리(앱 크래시 방지) + 환경 게이트 유지. `/my-recipes` 하단 배너 제거(상단 통일). | rev.1 크래시 정정 + 공식 RN-BannerAd 가이드 반영. 실기기 운영 빌드 노출 확인. |
