# ADR-021 — 요리 기록 피드 (홈→피드 전환 + 3탭 재편 + 사진 업로드)

- **상태:** Accepted (미니앱 측 코드 완료, 디바이스 실증 PENDING)
- **날짜:** 2026-06-03
- **맥락 범위:** cross-cutting — 백엔드(`airecipe-backend/`) 4 엔드포인트 + 미니앱(`airecipe-miniapp/`) 화면/플러밍. 본 ADR은 **미니앱 측** 결정을 기록한다(백엔드는 별 계약 — `03-API-CONTRACT.md §3.8b`).
- **관련:** ADR-009(아키텍처), ADR-014(SDK 어댑터 격리 규약), ADR-015 D39(hex→colors 토큰), ADR-017(BottomTabBar)·D63(active='none'), ADR-018(라우트 `pages/` 단일 계층), ADR-020(개인정보처리방침), 설계 스펙 `docs/superpowers/specs/2026-06-03-cooking-log-feed-design.md`, 구현 계획 `docs/superpowers/plans/2026-06-03-cooking-log-feed-miniapp.md`.

## 배경

사용자가 **만든 요리의 기록**(사진 1장 + 레시피 스냅샷 + 별 5점 + 소감)을 올리고, 미니앱 메인(홈)을 **내 기록 피드**로 전환한다. 앱 구조를 3탭 **[피드 · 레시피 · 마이]** 로 재편한다. 본 단계는 **개인(owner-scoped)** 중심 MVP — 공개 피드·소셜 상호작용은 비범위(설계 스펙 §2).

이미지 처리 사실(설계 스펙 §4): 앱인토스 `AppsInToss.fetchAlbumPhotos`/`openCamera`가 런타임에 실재하나 `.d.ts`에 **미선언(untyped 브리지)** → 로컬 타입 어댑터 격리 필요. 두 API 모두 **base64 data URI** 반환 → 업로드는 base64-in-JSON이 안전 경로(RN FormData multipart는 Android 회귀 위험).

## 결정 (D75~D83)

- **D75 — 3탭 재편(피드 `/`·레시피 `/recipe`·마이 `/my-recipes`).** `BottomTabBar.TabKey`를 `'home'|'my'` → `'feed'|'recipe'|'my'`로 확장. 기존 홈 콘텐츠(SearchForm + "오늘의 추천" CTA + 약관 푸터)는 신규 `pages/recipe/index.tsx`(레시피 탭)로 이전하고, 홈(`/`)은 요리 기록 피드로 전환. `'none'` 센티넬·`navigate(재포커스)` 로직(ADR-017 D55·D63) 불변 — 타입·`TABS` 배열만 확장. 기존 비-탭 화면(generate/recommend/[id]/_404/terms/privacy)은 이미 `active="none"`/`"my"`라 무변경.

- **D76 — 미디어 브리지 격리 어댑터(`src/lib/media/`).** 앱인토스 이미지 브리지를 광고 어댑터(ADR-014)와 동일 규약으로 단일 모듈 격리. SDK 직접 import는 `adapter.appsintoss.ts` 1곳만(grep 검증). 브리지가 `.d.ts`에 없어 **로컬 타입 선언**. `APP_ENV==='local'` → noop, 미지원 환경 → noop 폴백. 노출: `media.pickFromAlbum()/pickFromCamera() → Promise<PickedImage|null>`, `PickedImage={dataUri,mimeType}`. (플러밍 M2 — 본 ADR 이전 커밋 완료.)

- **D77 — base64-in-JSON 백엔드 경유 업로드(설계 §3 D6).** 미니앱은 R2를 직접 접근하지 않는다. `createCookingLog`가 `image`(data URI)+`mimeType`+`recipe`+`rating`+`review`를 단일 POST로 전송 → 백엔드가 R2 업로드·presign·삭제 전담. 호출은 기존 단일 경로(`apiFetch`)만 통과(직접 fetch 금지).

- **D78 — 레시피 스냅샷 내장(설계 §3 D2·D8).** 기록은 `GeneratedRecipe` 스냅샷을 내장 — 원본 레시피 수정/삭제와 무관하게 보존. 출처 2종: (a) 저장본 선택(`RecipeSnapshotPicker` → `useMyRecipes` 재사용, `sourceRecipeId=r.id`), (b) 레시피 생성 결과 "이 레시피로 기록 남기기"(미저장 `GeneratedRecipe` 전달, `sourceRecipeId=null`). 저장본(Recipe)을 골라도 백엔드로는 GeneratedRecipe 공통 필드만 전송(`CookingLogForm.toGeneratedRecipe` — id/isFavorite/createdAt strip).

- **D79 — TDS 별점은 `Rating`(판별 유니온) 채택, `EditableRating`/`ReadOnlyRating` named import 정정.** ⚠ **실재성 정정:** 계획 초안은 `EditableRating`/`ReadOnlyRating`를 `@toss/tds-react-native` 최상위 named export로 가정했으나, 실제 `rating/index.d.ts` barrel은 **`Rating`만** public export하고 두 컴포넌트는 내부 타입(`.d.ts` 미노출)이다. 따라서 입력은 `<Rating readonly={false} ...>`(= EditableRatingProps: `value`/`onValueChange?`/`size:'medium'|'large'|'big'`/`max?`), 표시는 `<Rating readonly ...>`(= ReadOnlyRatingProps: `value`/`variant:'full'|'compact'|'iconOnly'`/`size:'tiny'..'big'`/`max?`)로 사용. 합성 글리프(★/☆) 불필요 — 검증된 TDS 컴포넌트로 충족(설계 §7.6).

- **D80 — photos/camera 권한 선언(`granite.config.ts`).** `appsInToss({ permissions: [{name:'photos',access:'read'},{name:'camera',access:'access'}] })`. 타입 실재 확인: `@apps-in-toss/plugins`의 `Permission` 유니온 — `photos.access ∈ 'read'|'write'`, `camera.access = 'access'`. 최소권한(앨범 읽기 + 카메라 촬영)만 선언.

- **D81 — 별 캐시 프로바이더(`useCookingLogCache`).** 피드 목록 무효화 트리거를 `useRecipeCache`(ADR-012 D15) 미러로 분리 — 피드/레시피 목록은 독립 무효화. `_app.tsx`에서 `RecipeCacheProvider` 안쪽 형제로 마운트. 생성/삭제 성공 시 `invalidate()` 1회 → 피드 자동 refetch(상단 노출, AC4). (플러밍 M5 — 본 ADR 이전 커밋 완료.)

- **D82 — 삭제 훅 시그니처 `useDeleteCookingLog(id).remove()`.** id를 **훅 인자**로 받고 `remove()`는 무인자(useDeleteRecipe 미러). 상세 페이지에서 `useDeleteCookingLog(params.id ?? '')` 후 `remove()` 호출. 404는 성공 정규화(멱등) — 성공·404 모두 invalidate + 피드 복귀(AC6).

- **D83 — FAB·피드 색은 colors 토큰만(ADR-015 D39).** 우하단 FAB(`Pressable`)는 `colors.orange500`(배경)·`colors.white`(텍스트). 에러 텍스트는 기존 화면 관례(`colors.red700`) 미러. hex 0건 grep SSOT 유지.

## 결과

**플러밍(M1·M2·M4·M5 — 본 ADR 이전 커밋):**
- `src/lib/zod/cooking-log.ts`·`src/types/cooking-log.ts` — 요청/응답 zod + 도메인 타입.
- `src/lib/media/` — 이미지 피커 격리 어댑터(types/normalize/adapter.appsintoss/adapter.noop/index).
- `src/services/cooking-logs.ts` — api-client 메서드 4종(create/list/get/delete).
- `src/hooks/useCookingLogCache.tsx`·`useCookingFeed.ts`·`useCreateCookingLog.ts`·`useDeleteCookingLog.ts`·`useCookingLogDetail.ts` + `_app.tsx` 래핑.

**화면/문서(M3·M6~M11 — 본 차):**
- `granite.config.ts` (수정) — photos/camera 권한(D80).
- `src/components/BottomTabBar.tsx` (수정) — 3탭 재편(D75).
- `pages/index.tsx` (재작성) — 요리 기록 피드 + FAB(D75·D83).
- `pages/recipe/index.tsx` (신규) — 레시피 탭 랜딩(기존 홈 콘텐츠 이전).
- `src/components/PhotoPickerButton.tsx`·`StarRatingInput.tsx`·`RecipeSnapshotPicker.tsx`·`CookingLogForm.tsx` (신규) — 업로드 폼(D76·D78·D79).
- `pages/cooking-log/new.tsx` (신규) — 업로드 페이지.
- `src/components/CookingLogCard.tsx`·`FeedEmptyState.tsx` (신규) + `pages/cooking-log/[id].tsx` (신규) — 피드 카드·빈 상태·상세(삭제, D79·D82).
- `src/router.gen.ts` (수동 갱신) — `/recipe`·`/cooking-log/new`·`/cooking-log/:id` 등록(`ait build` 시 자동 재생성).
- `pages/recipe/generate.tsx` (수정) — 생성 완료 블록에 "이 레시피로 기록 남기기"(미저장 recipe 전달, D78).
- 문서: 06-UI-MAPPING·07-ROUTING·09-ENV-CONFIG 갱신 + `pages/privacy.tsx` 사진 저장 고지(ADR-020 형식) + AGENTS.md 4종.
- 검증: typecheck PASS, lint 0 errors(router.gen.ts 누적 warning 1건), test 7 PASS. hex 0건·SDK 직접 import는 media/ads 어댑터만(grep).

## 검수 영향 점검 (appsintoss-publish-checklist)

- **신규 권한(photos/camera)** — 콘솔 권한 선언 + `granite.config.ts` `permissions` 동기 필요. 최소권한(앨범 읽기·카메라 촬영)만 선언, 정당화: 요리 사진 첨부가 기록의 필수 입력.
- **개인정보(사진)** — 사진은 개인정보 → 개인정보처리방침(ADR-020)에 사진 저장·보관·서명 URL·삭제 동반 고지 추가(D77 정합). 비공개 R2 버킷 + presigned URL.
- **딥링크 prefix** — 신규 `intoss://airecipe/recipe`·`/cooking-log/new`·`/cooking-log/:id`(prefix=`scheme://appName`, appName=`airecipe`). 기존 메커니즘 → 콘솔 변경 불필요.
- **도메인 화이트리스트/CORS** — 백엔드 4 엔드포인트(`/api/cooking-logs*`)를 기존 미니앱 origin 화이트리스트에 추가(백엔드 측 작업, 설계 §6.6).
- **AI 면책** — 기록 자체는 AI 산출 아님(기존 generate/recommend의 AI 면책 패턴 유지, 본 단계 신규 면책 불필요).

## 외부 작업 PENDING

- **디바이스 사진 선택 실증** — `media.pickFromAlbum()/pickFromCamera()`의 실제 반환 형태(data URI vs raw base64) 디바이스 검증(`normalizePicked`가 양쪽 흡수하나 실증 필요). 광고 SDK 선례와 동일한 외부 작업.
- **백엔드 배포** — `cooking_logs` 테이블·RLS·R2 버킷·4 엔드포인트 + CORS 화이트리스트 등록 + R2 시크릿 주입(staging/prod). 미배포 시 미니앱은 401/404 → 한국어 안내(자동).
- **권한 콘솔 등록** — 앱인토스 콘솔 photos/camera 권한 + 최소권한 정당화 제출.
- **R2 presigned URL TTL ↔ 피드 캐싱** 상호작용 — 만료 후 재조회 시 목록 응답마다 신선한 presign(백엔드 측, 설계 §7.6).
