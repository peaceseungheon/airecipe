# Phase 4.5 QA Report — 토스 광고 SDK 기반 작업

> 검증자: orchestrator(메인) — 팀 1개 동시 제약으로 architect/qa as-orchestrator
> 일자: 2026-05-25
> 입력: `_workspace/01_architect_phase45_baseline.md` §G QA 매트릭스 (G1~G9)
> 코드 산출: `src/lib/ads/*` (4 파일), `src/components/AppInlineAd.tsx`, `src/hooks/useFullScreenAd.ts`, `granite.config.ts` 확장, `src/env.d.ts` 수동 sync, `src/pages/my-recipes.tsx` 시범 적용, `eslint.config.mjs` `.granite/**` ignore 보강
> 문서: `docs/appsintoss-port/11-ADS.md`, `docs/adr/ADR-014-toss-ads-integration.md`, `src/lib/AGENTS.md`(신규), `src/components/AGENTS.md`/`src/hooks/AGENTS.md`(보강)

## 매트릭스 (G1~G9)

| ID | 항목 | 검증 방법 | 결과 |
|----|------|----------|------|
| G1 | 광고 SDK 직접 import는 `adapter.toss.tsx` 1곳만 | `grep -rn "from ['\"]@apps-in-toss/framework['\"]" src/` | **PASS** — 광고 API(`InlineAd`/`loadFullScreenAd`/`showFullScreenAd`)는 `adapter.toss.tsx:22` 1행만. 다른 import는 `_app.tsx:2`의 `AppsInToss`(미니앱 컨테이너)와 `useTossUserId.tsx:21`의 `getAnonymousKey`(Toss 인증 SDK)로 광고와 무관. ADR-014 D26 시행 PASS. |
| G2 | `adGroupId` 하드코딩 0건 | `grep -rn "adGroupId[[:space:]]*[:=]" src/` | **PASS** — 모두 `config.inlineGroupId`/`config.fullScreenGroupId` 주입(`adapter.toss.tsx:47, 100, 105`). 하드코딩 0건. |
| G2b | `ADS_*` env 변수 접근은 `index.ts` 1곳만 | `grep -rn "ADS_INLINE_GROUP_ID\|ADS_FULLSCREEN_GROUP_ID\|ADS_ENABLED" src/` | **PASS** — 실 접근은 `src/lib/ads/index.ts:19, 21, 22` 3행만(어댑터 선택 + 주입). 그 외 등장은 `env.d.ts` 타입 선언 + 주석/에러 메시지. 직접 분기 0건. |
| G3 | `granite.config.ts`에 `ADS_*` 3개 정의 + `env.d.ts` 반영 | 파일 정독 | **PASS** — `granite.config.ts:22-25`에 3개 키 추가 (`ADS_ENABLED`, `ADS_INLINE_GROUP_ID`, `ADS_FULLSCREEN_GROUP_ID`, 기본값 `'false'`/`''`/`''`). `src/env.d.ts:7-9` 수동 sync 완료(빌드 시 plugin-env가 재생성). |
| G4 | noop placeholder는 TDS `View`+`Txt`만 | `src/lib/ads/adapter.noop.tsx` 정독 | **PASS** — RN `View`/`StyleSheet`(layout 기본)와 TDS `Txt typography="st9"`만 사용. TouchableOpacity·Text(원시) 직접 사용 0건. |
| G5 | `AppInlineAd`가 BannerSlotCallbacks 미노출 | `src/components/AppInlineAd.tsx` 정독 | **PASS** — `AppInlineAdProps = InlineAdSlotProps`로 `slot/theme/tone/variant` 4개만. `onAd*` 콜백은 어댑터 내부 console.debug(D33). |
| G6 | `useFullScreenAd` cleanup이 cancel 함수 호출 | `src/hooks/useFullScreenAd.ts` 정독 | **PASS** — useEffect cleanup에서 `abortRef.current?.abort()`. `request()`마다 직전 in-flight abort + 새 AbortController. 어댑터 측 `signal.addEventListener('abort', onAbort)`이 cancelLoad/cancelShow 호출 → SDK 리소스 누수 0. |
| G7 | `pnpm typecheck` + `pnpm lint` PASS | 명령 실행 | **PASS** — typecheck exit 0(에러 0). lint exit 0(0 errors, 1 warning `router.gen.ts` 자동 생성 unused-disable — Phase 3 누적 무해). 단, lint 첫 실행 시 `.granite/**` 빌드 산출물에서 21 errors 발견 → `eslint.config.mjs`에 `**/.granite/**` ignore 보강 후 PASS. |
| G8 | `my-recipes.tsx` 4-way 분기 중 빈+정상에만 광고 | 파일 정독 | **PASS** — 로딩/에러 분기에는 `<AppInlineAd />` 미렌더(`my-recipes.tsx:98-103, 104-123`), 빈 분기(125-136)와 정상 list(140-178) 양쪽 하단에 `<View style={styles.adSlot}><AppInlineAd slot="my-recipes-bottom" /></View>` 1회씩. 일관성 PASS. |
| G9 | 문서 발행 — 11-ADS.md + ADR-014 + AGENTS.md 3건 | 파일 존재 확인 | **PASS** — `docs/appsintoss-port/11-ADS.md`(신규), `docs/adr/ADR-014-toss-ads-integration.md`(신규), `src/lib/AGENTS.md`(신규), `src/components/AGENTS.md`(AppInlineAd 행 + 규약 추가), `src/hooks/AGENTS.md`(useFullScreenAd 행 + 규약 추가). |

**전체 판정: ALL PASS (코드 경로 9/9), FAIL 0건**.

## SDK 이벤트 정규화 검증 (ADR-014 D32)

`src/lib/ads/adapter.toss.tsx` showFullScreen 내부 switch:

| SDK 이벤트 | 어댑터 처리 (코드) | 결과 |
|-----------|------------------|------|
| `requested` | console.debug + (계속) | PASS |
| `show` | console.debug + (계속) | PASS |
| `impression` | console.debug + (계속) | PASS |
| `clicked` | console.debug + (계속) | PASS |
| `dismissed` | resolve(`'dismissed'`) + cleanup | PASS |
| `failedToShow` | reject(`Error('failedToShow')`) + cleanup | PASS (types에 error 필드 없음 — 인용 정확) |
| `userEarnedReward` | console.debug + resolve(`'dismissed'`) + cleanup | PASS (본 미니앱 미사용) |
| (signal abort) | resolve(`'cancelled'`) + cleanup | PASS |
| (onError) | reject(err) + cleanup | PASS |

## 환경 분기 매트릭스 (ADR-014 D27·E)

| 환경 | APP_ENV | ADS_ENABLED | 분기 코드(`index.ts`) | 어댑터 |
|------|---------|-------------|---------------------|--------|
| local dev | `local` | (any) | `if (env.APP_ENV === 'local') return noopAdsAdapter;` (line 18) | **noop** |
| staging (광고 끔) | `staging` | `"false"` | `if (env.ADS_ENABLED !== 'true') return noopAdsAdapter;` (line 19) | **noop** |
| staging (광고 켬) | `staging` | `"true"` | `return createTossAdsAdapter({ inlineGroupId: env.ADS_INLINE_GROUP_ID ?? '', fullScreenGroupId: env.ADS_FULLSCREEN_GROUP_ID ?? '' });` (line 20-23) | **toss** |
| production | `production` | `"true"` | (동일) | **toss** |

빈 group ID 대비: toss 어댑터의 `TossInlineAdSlot`은 `if (!config.inlineGroupId) return null;` → 빈 공간 회피. `showFullScreen`은 `if (!config.fullScreenGroupId) reject` → 호출 측 catch.

## 검수 정책 정합성 (`appsintoss-publish-checklist` 적용)

| 항목 | 정합성 |
|------|--------|
| 토스 공식 SDK만 사용 | PASS (D25) |
| TDS 의무 (placeholder도) | PASS (D29, G4) |
| 권한 추가 | NO (`permissions: []` 유지) |
| 도메인 화이트리스트 | 영향 0(광고는 SDK 내부 호출) |
| 번들 100MB | PASS (광고는 native 측, JS 번들 증가 미미) |
| AI 면책 충돌 | NO (영양 정보/healthNote와 별 컨테이너) |
| 디지털 자산/도박 카테고리 | NO (토스 SDK가 카테고리 필터링) |

## PENDING (외부 의존성)

| 항목 | 사유 | 해소 조건 |
|------|------|----------|
| 실 광고 송출 검증 | 앱인토스 콘솔에서 `adGroupId` 발급·승인 외부 작업 | 콘솔 등록 + 환경변수 주입 + staging 배포 후 검증 |
| 전면 광고 시범 적용 | D30 본 사이클 wiring 보류 (빈도 제한 정책 별 ADR) | 빈도 제한 결정 + 트리거 위치 결정 별 ADR |
| Analytics SDK 통합 | D33 본 사이클 미적용 (console.debug only) | 측정 SDK 결정 별 ADR |

## 결론

Phase 4.5(토스 광고 기반 작업) **ALL PASS — 코드 경로 9/9, FAIL 0건**. ADR-014 D25~D38 13 결정 모두 시행. 다음 단계:
1. CLAUDE.md "현재 단계" 갱신 + 변경 이력 추가.
2. 커밋.
3. Phase 4 보류 팀원 정리 (별 메시지).
4. (외부) 콘솔 `adGroupId` 발급 후 staging 배포 검증.
