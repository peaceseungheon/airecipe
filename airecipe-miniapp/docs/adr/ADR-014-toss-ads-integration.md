# ADR-014 — 토스 광고(앱인토스 SDK) 도입과 의존성 격리

- 상태: Accepted
- 일자: 2026-05-25
- 결정자: orchestrator(메인 세션 — 팀 1개 동시 제약으로 architect-as-orchestrator 합의)
- 관련 ADR: ADR-009(아키텍처 — 백엔드 분리·TDS 의무), ADR-010(api-client 단일 경로 원칙 일반화), ADR-012(Phase 3 결정 — RecipeCacheProvider 등)
- 관련 SSOT: `docs/appsintoss-port/11-ADS.md`, `_workspace/01_architect_phase45_baseline.md`, `_workspace/00_input/requirements.md`

## 컨텍스트

본 미니앱 `airecipe-miniapp`은 Phase 0~3을 완료(스캐폴딩·인프라·생성+스트리밍·저장·목록·상세). Phase 4(즐겨찾기·삭제·404 통일)는 작업 중 우선순위 변경으로 일시 보류(`_workspace_phase4_paused/`). 사용자 요구 — **토스 광고를 붙이기 위한 기반 작업**.

도전 과제:
1. 토스 광고 SDK(`@apps-in-toss/framework`의 `InlineAd`·`loadFullScreenAd`·`showFullScreenAd`)를 도입하되, **SDK 의존성이 화면 코드 전체에 퍼지지 않게** 격리.
2. dev 환경에서 SDK 호출 0건(콘솔에서 `adGroupId` 발급 전·승인 전에도 빌드/실행 가능).
3. 검수 정책(09 §9.6) 준수 — placeholder UI도 TDS 위.
4. 전면 광고 7가지 이벤트(`requested/show/impression/clicked/dismissed/failedToShow/userEarnedReward`)를 일관된 결과 타입(`AdResult`)으로 정규화.
5. 시범 적용 1곳에서 코드 경로 PASS — 실 광고 송출 검증은 콘솔 발급 후 별 작업.

본 ADR은 이 5개 도전을 13개 결정(D25~D38)으로 동결한다.

## 결정 카탈로그 (D25~D38)

### D25 — 토스 공식 광고 SDK만 사용
- **결정**: `@apps-in-toss/framework`의 `InlineAd` / `loadFullScreenAd` / `showFullScreenAd`만 사용. 외부 광고 네트워크(Google AdMob 직접·Meta Audience Network 등) 통합 금지.
- **근거**: 검수 정책(09 §9.6) — 비게임 미니앱은 토스 공식 SDK 경로만 안전. 외부 SDK 통합은 검수 반려·정책 위반 위험.
- **대안 기각**: AdMob SDK 직접 통합 — 검수 위반 위험 + 미니앱 번들 100MB 제한 위협.

### D26 — 어댑터 패턴(의존성 역전)
- **결정**: `src/lib/ads/types.ts`에 `AdsAdapter` 인터페이스. SDK 직접 import는 `src/lib/ads/adapter.toss.tsx` 1곳만 허용. 모든 다른 파일은 `src/lib/ads/index.ts`의 `ads` 객체만 import.
- **근거**: ADR-010 D3(api-client 단일 경로)을 광고 SDK에도 일반화 — `software-design-principles`의 의존성 역전 원칙. SDK 교체·mock·환경 분기에 유리.
- **시행 검증**: `grep -rn "from ['\"]@apps-in-toss/framework['\"]" src/` → 광고 API는 adapter.toss.tsx 1곳만.

### D27 — 환경 분기 정책
- **결정**: `src/lib/ads/index.ts`에서 `import.meta.env.APP_ENV === 'local'` 또는 `ADS_ENABLED !== 'true'` 시 noop 어댑터, 그 외 toss 어댑터.
- **근거**: dev에서 SDK 호출을 차단(콘솔 미발급 대비) + 환경별 토글로 staging에서 광고 끔도 가능.
- **대안 기각**: 단일 어댑터 + 런타임 분기 — SDK import 자체가 항상 발생, dev에서도 native 로딩 시도 가능.

### D28 — 환경변수 3개 추가
- **결정**: `granite.config.ts`의 plugin-env에 `ADS_ENABLED: string`, `ADS_INLINE_GROUP_ID: string`, `ADS_FULLSCREEN_GROUP_ID: string` 추가. 모두 빈값 기본.
- **근거**: 빌드 시점 인라인(09 §9.4.2). 비밀 키 아니므로 클라이언트 노출 OK(`adGroupId`는 공개 식별자).
- **시행 검증**: `src/env.d.ts` 자동 갱신(또는 수동 sync) + plugin-env가 string으로 인라인.

### D29 — dev placeholder UI는 TDS 위
- **결정**: noop 어댑터의 inline placeholder는 회색 박스 + "광고 영역 (dev · slot)" 텍스트. TDS `View`+`Txt`만 사용.
- **근거**: 검수 정책(09 §9.6) — 모든 UI는 TDS 위. dev 환경도 빌드 산출물이 동일 룰 적용.

### D30 — 시범 적용 위치·범위
- **결정**: 본 사이클은 `src/pages/my-recipes.tsx`의 **빈 상태 EmptyState 아래** + **데이터 목록 끝(pageInfo 아래)** 두 위치에 `<AppInlineAd slot="my-recipes-bottom" />` 1회씩. 전면 광고(`useFullScreenAd`)는 코드만 마련, **wiring 0곳**.
- **근거**: 사용자 흐름 차단 위험(전면 광고를 생성/저장 직후 발사) + 빈도 제한 정책 별 ADR. 인라인은 비차단형 → 안전.
- **대안 기각**: 생성 화면 결과 영역 — Phase 2에서 결과가 점진 렌더되므로 광고 끼우면 UX 혼란.

### D31 — 컴포넌트/훅 인터페이스 확정
- **결정**:
  - `<AppInlineAd slot: string; theme?='auto'; tone?='grey'; variant?='expanded' />` — slot prop은 로깅 구분용. BannerSlotCallbacks 미노출(D33).
  - `useFullScreenAd(): { request: () => Promise<AdResult>, isPending: boolean, error: string | null }`.
  - `type AdResult = 'shown' | 'dismissed' | 'failedToShow' | 'no_fill' | 'cancelled'`.
- **근거**: InlineAdProps + ShowFullScreenAdEvent union을 단일 결과로 정규화 — 호출 측은 상태/이벤트 미신경.

### D32 — 이벤트 정규화 매핑 (전면 광고)
- **결정** (어댑터 `showFullScreen` 내부):
  - `requested`/`show`/`impression`/`clicked` → console.debug only
  - `dismissed` → Promise resolve(`'dismissed'`)
  - `failedToShow` → Promise reject(`Error('failedToShow')`) — `@apps-in-toss/types@2.6.0`의 `AdFailedToShow$1`은 error 필드 없음, 추가 정보 onError 콜백 경로
  - `userEarnedReward` → 본 미니앱 미사용 → console.debug + dismissed 동일
  - `onError` → Promise reject(err)
  - AbortSignal → cancelLoad/cancelShow 호출 후 resolve(`'cancelled'`)
- **근거**: 7가지 이벤트를 단일 흐름으로 묶고 호출 측은 catch만 처리.

### D33 — 콜백 로깅 정책
- **결정**: BannerSlotCallbacks(`onAdImpression/Clicked/Rendered/FailedToRender/NoFill`)는 어댑터 내부 console.debug only. AppInlineAd props로 외부 노출 안 함. Analytics SDK 통합은 별 ADR.
- **근거**: YAGNI — Phase 4.5는 기반만, 측정·분석은 측정 데이터 본 뒤 별 사이클.

### D34 — 빈도 제한·세션 한도 미적용
- **결정**: 본 사이클 미적용. 어댑터에 hook point만(미래에 빈도 제한 wrapper 추가 가능).
- **근거**: YAGNI + 측정 데이터 필요.

### D35 — 신규 SSOT 챕터 발행
- **결정**: `docs/appsintoss-port/11-ADS.md` 신규 발행 — 광고 SDK 사용 패턴·환경 분리·QA 매트릭스·검수 정합성.
- **근거**: 광고 영역은 03~09 어디에도 없음. 별 챕터가 SSOT.

### D36 — AGENTS.md 갱신
- **결정**:
  - `src/lib/AGENTS.md` 신규 (ads 디렉토리 책임).
  - `src/components/AGENTS.md` 보강 (AppInlineAd).
  - `src/hooks/AGENTS.md` 보강 (useFullScreenAd).
- **근거**: `technical-documentation` 스킬 — 디렉토리 책임 추적.

### D37 — qa 검증 의무
- **결정**: 본 사이클의 qa(메인이 수행)는 `src/`에서 `from '@apps-in-toss/framework'` grep으로 광고 SDK import가 `src/lib/ads/adapter.toss.tsx` 1곳만임을 확인 + `adGroupId.*=.*['"]` 하드코딩 0건 확인.
- **시행 결과 (2026-05-25)**: PASS — adapter.toss.tsx 1행, 다른 광고 SDK import 0건. `adGroupId`는 모두 `config.inlineGroupId`/`config.fullScreenGroupId`를 통과.

### D38 — `src/env.d.ts` 자동 갱신 가정 + 수동 sync 허용
- **결정**: `granite.config.ts`에 env 키 추가 시 `src/env.d.ts`가 plugin-env에 의해 자동 재생성. 본 사이클은 dev/build 미실행 환경에서 typecheck를 위해 메인이 수동으로 `src/env.d.ts`를 갱신(`.gitignore` 대상이므로 빌드 시 덮어써짐).
- **근거**: env.d.ts는 `.gitignore` — 빌드 산출물. typecheck는 본 사이클 핵심 검증이므로 수동 sync 허용.

## 결과

본 사이클(2026-05-25) 산출:

- **코드 6개**: `src/lib/ads/{types.ts, adapter.noop.tsx, adapter.toss.tsx, index.ts}`, `src/components/AppInlineAd.tsx`, `src/hooks/useFullScreenAd.ts`.
- **인프라 2개**: `granite.config.ts` env 키 3개 추가, `src/env.d.ts` 수동 sync.
- **시범 적용 1곳**: `src/pages/my-recipes.tsx` 빈 상태 + 정상 목록 양쪽 하단 `<AppInlineAd slot="my-recipes-bottom" />`.
- **문서 3개**: 본 ADR, `docs/appsintoss-port/11-ADS.md`, AGENTS.md 3건.
- **lint 보강**: `eslint.config.mjs`에 `.granite/**` ignore 추가(빌드 산출물 검사 제외).

QA 매트릭스 G1~G9 PASS (G3·G7·G8·G9는 자동 검증, G4·G5·G6는 코드 정독 검증).

## 영향

- **긍정**:
  - SDK 의존성이 단일 모듈로 격리 → 교체·mock·환경 분기 용이.
  - dev 환경에서 SDK 호출 0건 → 콘솔 발급 전에도 빌드/실행 가능.
  - 검수 정책 정합 → 출시 직전 추가 작업 없음.
  - 시범 위치 1곳 → 측정 데이터 수집 시작 가능.
- **부정/제약**:
  - 전면 광고 wiring 0곳 → 실 광고 표시는 별 사이클에서.
  - 빈도 제한·Analytics 통합 미해결 → 별 ADR.
  - 콘솔에서 `adGroupId` 발급·승인 외부 의존성 → 본 코드만으로는 실 광고 검증 불가.

## 후속 작업 (별 사이클·ADR)

- **빈도 제한·세션 한도** — 어댑터에 wrapper 추가(D34 후속).
- **Analytics 통합** — onAdImpression/Clicked → Analytics SDK(D33 후속).
- **전면 광고 시범 적용** — 트리거 조건(예: 저장 3회마다·세션 1회) 결정 후 wiring.
- **다른 화면 인라인 적용** — `/recipe/[id]` 상세 화면 하단·`/` 홈 등 — 측정 데이터 본 뒤.
- **Phase 4 재개** — `_workspace_phase4_paused/01_architect_phase4_baseline_partial.md` 진입점.

## 롤백 조건

- (R1) 토스 광고 정책 변경으로 본 SDK가 deprecated → adapter.toss.tsx만 교체, 다른 코드 영향 0(D26 격리 덕분).
- (R2) 검수 반려(광고 영역이 컨텐츠와 충돌) → D30 시범 적용 위치만 제거, 어댑터·훅·컴포넌트는 유지.
