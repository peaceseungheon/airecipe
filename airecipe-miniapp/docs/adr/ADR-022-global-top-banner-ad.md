# ADR-022 — 전 화면 상단 고정 배너 광고

- **상태:** Accepted (rev.2 — rev.1 철회·정정)
- **날짜:** 2026-06-05
- **맥락 범위:** 미니앱 단독 (백엔드 무변경)
- **관련:** ADR-014(토스 광고 도입 — 어댑터 격리·환경 게이트·AppInlineAd), ADR-017(BottomTabBar 화면-내 마운트 패턴·D61 SafeArea), 11-ADS §11.5.1, 공식 가이드 [RN-BannerAd](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/광고/RN-BannerAd.html)

## 배경

사용자 요청: 토스 `InlineAd` 예시를 참고해 **배너 광고가 항상 보이도록**(모든 화면 상단 고정). 노출 보장은 **환경변수 게이트 유지**(테스트 id 하드코딩 폴백 미채택, 콘솔 발급 group id + `ADS_ENABLED='true'` 후 노출).

기존(ADR-014 Phase 4.5): 배너(`AppInlineAd`)는 `/my-recipes` 한 곳 하단에만 시범 적용 + 환경 게이트로 비활성 상태였다.

## rev.1 철회 (앱 루트 마운트 → 검정 화면 크래시)

최초 구현은 `_app.tsx`에서 네비게이터(`children`) **위에** 배너를 1회 마운트하는 전역 방식(`GlobalAdLayout`)이었다. dev(noop)에선 정상이었으나 **운영 빌드 실기기에서 앱 전체가 검정 화면으로 크래시**했다. 원인:

- Granite `registerApp`은 우리 `AppContainer`의 `children`으로 `<TDSProvider>{navigator}</TDSProvider>`를 주입한다. 즉 `TDSProvider`·네비게이션·스크린 컨텍스트는 모두 `children` **안쪽**에 있다.
- `GlobalAdLayout`은 `InlineAd`를 그 **바깥(앱 루트)**에 렌더했다. 공식 가이드상 `InlineAd`는 **impression 측정 컨텍스트(스크린/스크롤)** 안에서 렌더해야 하며, 루트에서는 렌더 실패가 트리 전체를 무너뜨렸다.

→ `GlobalAdLayout` 삭제, `_app.tsx` 원복.

## 결정 (D84~D88, rev.2)

- **D84 — 화면-내 마운트(`TopAdBanner`).** 배너는 각 화면이 `PageNavbar` 바로 아래(스크롤 영역 밖, 상단 고정)에 `<TopAdBanner slot="..." />` 1줄로 직접 마운트한다. 이는 `BottomTabBar`가 이미 안전하게 쓰는 **화면-내 마운트 패턴**과 동일(ADR-017 D53). 앱 루트가 아니라 스크린(=TDSProvider·네비게이션 컨텍스트 안)에서 렌더되므로 rev.1 크래시가 해소된다.
- **D85 — `impressFallbackOnMount: true`(필수).** 공식 가이드: `InlineAd`는 impression 측정 컨텍스트가 필요하며, `IOScrollView`로 감싸거나(권장) 그렇지 않으면 `impressFallbackOnMount={true}`를 줘야 한다. 본 배너는 스크롤 밖 **고정** 배너이므로 후자가 정합(항상 보이는 배너 → 마운트 시 impression). 이 설정 누락이 rev.1·초기 화면-내 시도의 렌더 실패 핵심 원인이었다. `src/lib/ads/adapter.toss.tsx`에서 일괄 적용. (이 패키지 버전엔 `IOScrollView`·`getTossAppVersion` export 부재 확인 → impressFallbackOnMount 채택.)
- **D86 — 광고 렌더 실패는 앱을 죽이지 않는다(에러 바운더리).** `AppInlineAd`를 `AdErrorBoundary`로 감싼다. 미지원 환경(가이드: Toss앱 < 5.241.0 등)에서 `InlineAd`가 던지는 `"This feature is not supported..."` 등 JS 예외를 잡아 **배너만 숨기고(null) 화면은 정상 유지**한다. (네이티브 레벨 크래시는 JS 바운더리로 못 잡으므로 그 경우는 콘솔 등록·승인·버전 문제로 별도 처리.)
- **D87 — 환경 게이트 유지 + 비활성 시 렌더 0.** `TopAdBanner`는 `ads.isEnabled()`(ADR-014 D27: `APP_ENV==='local'` 또는 `ADS_ENABLED!=='true'`면 false)가 false면 `null` 렌더 → dev/비활성에서 공간·placeholder 0(회귀 0). 테스트 id 하드코딩 폴백 미채택 — `adGroupId` 하드코딩 0건(11-ADS §11.8 G2). live group id는 `.env.<env>`의 `ADS_INLINE_GROUP_ID` + `ADS_ENABLED=true`로 주입.
- **D88 — 적용 범위 = 전 라우트 화면(상단 통일). 단 에러/404 폴백 제외.** 10개 라우트 화면(`/`·`/recipe`·`/my-recipes`·`/recipe/generate`·`/recipe/recommend`·`/recipe/:id`·`/cooking-log/new`·`/cooking-log/:id`·`/terms`·`/privacy`)의 메인 콘텐츠 `PageNavbar` 아래에 마운트. `/my-recipes`는 **기존 하단 `my-recipes-bottom` 배너 2곳을 제거**하고 상단으로 통일(한 화면 중복 회피, ADR-014 §11.5.1). `_404` 및 각 화면의 `NotFoundScreen`(전체화면 ErrorPage)·식별자 가드/로딩 등 전이 분기는 `PageNavbar`가 없거나 일시적이라 제외.

> **SafeArea(상단 인셋):** 본 배너는 `PageNavbar` 아래에 위치하므로 상단 상태바 인셋은 `PageNavbar`가 처리한다(rev.1의 루트 마운트 인셋 문제 소멸). 별도 보정 불필요.

## 결과

- `src/components/TopAdBanner.tsx` (신규) — `ads.isEnabled()` 게이트 + `<AppInlineAd slot>` 위임. SDK 직접 import 0건.
- `src/components/AppInlineAd.tsx` (수정) — `AdErrorBoundary`로 감싸 광고 렌더 실패 격리(D86).
- `src/lib/ads/adapter.toss.tsx` (수정) — `impressFallbackOnMount: true`(D85).
- 10개 `pages/*.tsx` (수정) — `PageNavbar` 아래 `<TopAdBanner slot="..." />` 마운트(D88). `pages/my-recipes.tsx`는 하단 배너 2곳 제거·`AppInlineAd` import 제거·`adSlot` style 제거.
- `src/_app.tsx` — rev.1 `GlobalAdLayout` 래핑 제거(원복). `src/components/GlobalAdLayout.tsx` 삭제.
- 문서: 본 ADR rev.2 + 11-ADS §11.5.1·§11.10 + `src/components/AGENTS.md` + `pages/AGENTS.md` + `CLAUDE.md`.
- 검증: typecheck PASS, lint 0 errors(router.gen.ts 누적 warning 1건), test 7 PASS. SDK 직접 import는 `adapter.toss.tsx` 1곳 유지(G1)·하드코딩 adGroupId 0건(G2). **실기기 운영 빌드에서 상단 배너 정상 노출 확인.**

## 검수 영향 점검 (appsintoss-publish-checklist)

- 광고 SDK: `@apps-in-toss/framework` `InlineAd`만 경유(외부 광고 네트워크 0). 도메인 화이트리스트·CORS·권한 영향 0. AI 생성 콘텐츠와 시각적 분리.

## PENDING

- live group id 인벤토리/승인 상태에 따른 노출률(노필 시 `onNoFill` → 배너 숨김).
- Toss앱 < 5.241.0 사용자: D86 바운더리로 앱은 정상, 배너만 미노출.
