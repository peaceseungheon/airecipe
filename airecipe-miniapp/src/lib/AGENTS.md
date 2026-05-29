# src/lib/AGENTS.md

본 디렉토리는 미니앱 클라이언트의 **격리된 외부 의존성·순수 유틸**을 둔다. 각 하위 모듈은 SOLID의 D(의존성 역전)에 따라 외부 시스템을 어댑터로 감싼다.

## 하위 모듈

### `zod/`
- 응답 검증 스키마(api·recipe·stream). Phase 1~2에서 정의. 본 사이클 변경 없음.
- 호출 위치: `src/services/recipes.ts`, `src/services/sse-client.ts`.

### `ads/` (Phase 4.5 신규 — ADR-014)
- 토스 광고 SDK(`@apps-in-toss/framework`의 `InlineAd`/`loadFullScreenAd`/`showFullScreenAd`)를 어댑터로 격리.
- 외부 노출은 `index.ts`의 `ads` 객체 1개. 다른 어떤 파일도 어댑터 구현(toss/noop)을 직접 import 금지.
- 파일별 책임:
  - `types.ts` — `AdsAdapter` 인터페이스 + `InlineAdSlotProps` + `AdResult` 정의. SDK 직접 import 0건.
  - `adapter.toss.tsx` — 토스 SDK 실 구현. **SDK 직접 import는 본 파일만 허용**(ADR-014 D26). 7가지 SDK 이벤트를 `AdResult`로 정규화(D32).
  - `adapter.noop.tsx` — dev/disabled placeholder. SDK 호출 0건. placeholder UI는 TDS `View`+`Txt`만(D29).
  - `index.ts` — 환경 분기(D27): `APP_ENV === 'local'` 또는 `ADS_ENABLED !== 'true'` → noop, 그 외 toss.
- 호출 위치: `src/components/AppInlineAd.tsx`, `src/hooks/useFullScreenAd.ts`.

## 책임 규약

- **SDK 의존성 1곳 격리** — 광고 SDK는 `ads/adapter.toss.tsx`, Toss 인증 SDK는 `src/hooks/useTossUserId.tsx`(getAnonymousKey), 미니앱 컨테이너는 `src/_app.tsx`(AppsInToss). 다른 위치에서 `@apps-in-toss/framework` 광고 API import 0건.
- **순수 유틸** — `zod/` 스키마는 사이드 이펙트 0건. 변환·검증만.
- **환경 의존성은 어댑터에서만** — `import.meta.env.X` 접근은 가능한 한 단일 위치(예: `ads/index.ts`)에 모은다.
- **테스트 가능성** — 어댑터 인터페이스를 통해 mock 주입 가능. 직접 SDK call site 0건.

## SSOT 참조

- ADR-009(아키텍처), ADR-010 D3(단일 호출 경로 원칙), ADR-014(광고 도입 결정).
- `docs/appsintoss-port/11-ADS.md` (광고 SDK 사용 가이드).
- `docs/appsintoss-port/09-ENV-CONFIG.md` §9.4 (plugin-env), §9.6 (검수 정책).
