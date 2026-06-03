# 03 — QA 통합 정합성 리포트: 요리 기록 피드 (ADR-021, cooking-log-feed)

검증자: miniapp-qa. 기준 디렉토리 `airecipe-miniapp/`. 브랜치 `feat/cooking-log-feed`.
SSOT: `docs/appsintoss-port/03-API-CONTRACT.md` §3.8b(백엔드 QA 확정 shape), 설계 스펙·계획(2026-06-03), ADR-021 D75~D83.
방법: 양쪽 동시 읽기(SSOT ↔ 구현) — zod ↔ 03 ↔ services ↔ hooks ↔ pages/components 5단 교차 + TDS 실재성(설치 패키지 `.d.ts` 직접 검증) + 게이트 실측.

## 최종 verdict: **GO** — 8/8 영역 PASS, 치명 FAIL 0건. 비차단 관찰 2건(기존 누적·외부 의존).

게이트 실측: `pnpm test` 7 PASS · `pnpm typecheck` exit 0 · `pnpm lint` 0 errors (router.gen.ts 누적 무해 warning 1건, 사전 존재).

---

## 검증 매트릭스 요약

| # | 영역 | 결과 |
|---|------|------|
| 1 | 백엔드 응답 shape ↔ zod ↔ 소비 (목록 {data,meta}·단건 .data·삭제 {id}) | **PASS** |
| 2 | api-client 메서드 ↔ 훅 시그니처 ↔ 페이지 호출 (특히 useDeleteCookingLog(id)/remove()) | **PASS** |
| 3 | 라우팅 정합 (createRoute ↔ router.gen ↔ navigate / BottomTabBar 3탭) | **PASS** |
| 4 | TDS 매핑 실재성 (Rating 판별 유니온 D79 + 6종) | **PASS** |
| 5 | 인증 헤더 (보호 4종 tossUserId+refresh / 평문 노출 0) | **PASS** |
| 6 | 미디어 어댑터 (SDK 격리 1곳 + base64 정규화 → request) | **PASS** |
| 7 | 검수 정책 (권한 선언↔사용 / hex 0 / privacy 고지 / AI 면책) | **PASS** |
| 8 | 스냅샷 무결성 (GeneratedRecipe 필드만 전송 / id·isFavorite·createdAt 제외) | **PASS** |

---

## 영역별 결과 (증거: 파일:라인)

### 1. 응답 shape ↔ zod ↔ 소비 — PASS

- 03 §3.8b.1 `CookingLog={id,photoUrl,recipe:GeneratedRecipe,rating(1..5),review,createdAt}`(내부 식별자 비노출) ↔ `src/lib/zod/cooking-log.ts:14-21` `cookingLogSchema`(필드·타입·`rating.int().min(1).max(5)` 일치, `user_id/photo_path/source_recipe_id` 부재 = 비노출 정합) ↔ `src/types/cooking-log.ts:13-20` `CookingLog` interface 1:1.
- **래핑 unwrap 위치 일관(03 §3.10 #1)**:
  - 생성 `createCookingLog`(`cooking-logs.ts:37-48`) → `apiResponseSchema(cookingLogSchema)` 검증 후 `wrapped.data` unwrap → `CookingLog`. 03 §3.8b.2 `201 {data:CookingLog}` 정합.
  - 목록 `listCookingLogs`(`:54-67`) → `apiListResponseSchema(cookingLogSchema)` → **raw `{data,meta}` 보존**(unwrap 안 함). 03 §3.8b.3 `{data:[],meta}` + ADR-006 `meta.pageSize` 신뢰 정합. `useCookingFeed.ts:92-96`이 `res.data`/`res.meta` 분리 소비.
  - 상세 `getCookingLog`(`:72-86`) → `.data` unwrap → `CookingLog`. 03 §3.8b.4 정합.
  - 삭제 `deleteCookingLog`(`:91-105`) → `deleteResponseSchema=apiResponseSchema(z.object({id:z.string()}))`(`:27`) → `wrapped.data` = `{id}`. 03 §3.8b.5 `200 {data:{id}}`(204 아님) 정합.
- zod 검증은 raw 응답에 적용(`api-client.ts:124-132`) — 래핑 위반·snake 누출 모두 차단. `as`/`any` 우회 없음(api-client는 zod `safeParse` 결과만 반환).

### 2. api-client 메서드 ↔ 훅 ↔ 페이지 호출 — PASS

- 4 메서드 모두 `services/index.ts`에서 named export. 소비 훅 시그니처 교차:
  - `useCookingFeed(query)` → `listCookingLogs(query, {tossUserId,refreshTossUserId})` (`useCookingFeed.ts:87-90`). `pages/index.tsx:37` `useCookingFeed({page,pageSize:10})`.
  - `useCreateCookingLog().create(req)` → `createCookingLog(req, auth)` (`useCreateCookingLog.ts:82-85`). `pages/cooking-log/new.tsx:57` `create(req)`.
  - `useCookingLogDetail(id)` → `getCookingLog(id, auth)` (`useCookingLogDetail.ts:85`). `pages/cooking-log/[id].tsx:49` `useCookingLogDetail(params.id)`.
  - **`useDeleteCookingLog(id).remove()` — 핵심 검증 PASS**: 훅이 `id`를 **인자**로 받음(`useDeleteCookingLog.ts:34`), `remove`는 **무인자** `():Promise<boolean>`(`:52`). 페이지 `[id].tsx:50-51` `useDeleteCookingLog(params.id ?? '')` + `:58` `await remove()`. D82 시그니처 정확.
  - 404 멱등 정규화: `remove()`가 `NOT_FOUND` → `invalidate()` + `return true`(`:73-76`). 03 §3.8b.5 멱등 정합. 상세 404는 `notFound:true`(`useCookingLogDetail.ts:98-104`, ADR-005 통일).
- 직접 `fetch(`/`XMLHttpRequest` — pages/components/hooks 0건(grep). 모든 보호 호출은 api-client 단일 경로.

### 3. 라우팅 정합 — PASS

- `createRoute` ↔ `router.gen.ts` ↔ navigate 3자 일치:
  - `/cooking-log/:id`(`[id].tsx:38` `createRoute('/cooking-log/:id')`) ↔ `router.gen.ts:20,33` ↔ `index.tsx:45` `navigate('/cooking-log/:id',{id})`.
  - `/cooking-log/new`(`new.tsx:34`) ↔ `router.gen.ts:21,34` ↔ `index.tsx:40`·`new.tsx:59`·`generate.tsx:227` navigate.
  - `/recipe`(`recipe/index.tsx:22`) ↔ `router.gen.ts:23,37`.
- 동적 `:id`: `[id].tsx:39-43` `validateParams`가 `{id: string|undefined}` 정규화 → `Route.useParams()`(`:47`). 전달측 `navigate('/cooking-log/:id',{id})` 객체 일치.
- **BottomTabBar 3탭(D75)**: `TabKey='feed'|'recipe'|'my'`(`BottomTabBar.tsx:35`), path `'/'|'/recipe'|'/my-recipes'`(`:48-52`). active prop 전수: feed(index)·recipe(recipe/index)·my(my-recipes ×2)·none(generate/recommend×2/[id]×3/cooking-log new/[id]×4/terms/privacy/_404). **잔여 `'home'` 참조 0건**(grep 전역). 모든 active 값이 유효 유니온(`TabKey|'none'`) — typecheck가 보증.

### 4. TDS 매핑 실재성 — PASS (설치 패키지 `.d.ts` 직접 검증)

> AppsInToss MCP는 본 환경 미제공 → 스킬 폴백: 설치된 `@toss/tds-react-native` `.d.ts` + `pnpm typecheck` 실측으로 검증(설치본=실 빌드 대상이므로 MCP 문서보다 강한 실재 증거).

- **`Rating` 판별 유니온 (D79 — 정정의 정정 검증) PASS**: `dist/cjs/components/rating/index.d.ts`는 `export { Rating }` + `export type { RatingProps }`만 — **`EditableRating`/`ReadOnlyRating` named *값* export 부재**(타입만 내부 존재). D79 채택이 실 export와 정확히 일치. `Rating.d.ts`: `RatingProps = ({readonly:false}&EditableRatingProps) | ({readonly:true}&ReadOnlyRatingProps)`.
  - `StarRatingInput.tsx:33-41`: `readonly={false}`+`value`+`onValueChange`+`size="large"`+`max=5` → EditableRating 분기(`EditableRatingProps`: `value/onValueChange?/size:'medium'|'large'|'big'/max?`). `size` 필수·"large" 유효.
  - `CookingLogCard.tsx:41`: `readonly`+`value`+`variant="compact"`+`size="small"` → ReadOnlyRating 분기(`variant:'full'|'compact'|'iconOnly'`, `size:'tiny'|'small'|'medium'|'large'|'big'`). 유효.
  - `[id].tsx:119`: `readonly`+`variant="full"`+`size="medium"` → ReadOnlyRating 유효.
- `Button`(type/style/display/size/loading/disabled)·`TextField`(variant/value/onChangeText/placeholder/hasError; maxLength=RN TextInput passthrough)·`ErrorPage`(statusCode/title/subtitle/onPressLeftButton/onPressRightButton — `NotFoundScreen.tsx` 정확 일치)·`PageNavbar.Title`(`extensions/page-navbar`)·`Badge`/`List`/`ListRow`(`RecipeDisplay`) 전부 barrel 재export 실재.
- `colors.*` 토큰 — 본 차 사용분(`red700`/`orange500`/`white`/`grey100`/`grey200`/`grey500`/`grey600`/`grey700`/`grey800`/`grey900`/`blue500`/`red50`) 전수: `pnpm typecheck` exit 0이 멤버 접근 실재를 보증(부재 시 TS2339 — BottomTabBar JSDoc이 `colors.primary` 부재를 TS2339로 기록한 선례와 동일 메커니즘). 별도 TS 프로브에서도 토큰 접근 무에러 확인.
- **`RecipeDisplay`가 GeneratedRecipe 수용 PASS**: props `recipe: GeneratedRecipe`(`RecipeDisplay.tsx:30`), 읽는 필드(`dishName/description/difficulty/servings/cookTimeMinutes/ingredients/steps/tips`)가 `generatedRecipeSchema`(`recipe.ts:32-42`) 전 필드 포함. 상세 화면 `data.recipe`(= `cookingLogSchema.recipe = generatedRecipeSchema`) 그대로 전달(`[id].tsx:124`) — id/createdAt/isFavorite 미참조(불변식 06 §6.7 준수).
- `EmptyState`(FeedEmptyState가 위임)는 **로컬** `src/components/EmptyState.tsx` — TDS 아님(혼동 주의). 정상.

### 5. 인증 헤더 — PASS

- 보호 4종 모두 `{tossUserId, refreshTossUserId}` 전달: create/list/get/delete(`cooking-logs.ts:43-44,64-65,81-82,100-101`). api-client가 `X-Toss-User-Id` 자동 주입(`api-client.ts:82-83`) + 401 시 `refreshTossUserId()` 재발급 1회 재시도(`:110-118`).
- 훅 4종 모두 `useTossUserId()`로 `{tossUserId, refresh}` 취득 → auth 주입. `tossUserId===undefined` 시 보호 호출 보류(feed: 로딩 표시 `index.tsx:56`; create: 즉시 한국어 에러 `useCreateCookingLog.ts:69-72`; detail/delete 동일).
- `useTossUserId`가 `getAnonymousKey()` SDK 1회 + 메모리 캐시(`useTossUserId.tsx:42,96,106`) + hash zod 검증(`:38,61`). **평문 노출 0**: pages/components에서 `tossUserId`는 `=== undefined` 가드에만 사용, 렌더·로그 평문 0건(grep). 마스킹 헬퍼 `formatTossUserIdMask` 별도 제공.
- 404/네트워크 에러 UI 한국어 통일: 4 훅 모두 동일 `ERROR_CODE_MESSAGES` 한국어 매핑(예 NOT_FOUND "기록을 찾을 수 없어요"), 네트워크 실패는 api-client에서 `INTERNAL_ERROR` "네트워크에 연결할 수 없어요"로 정규화(`api-client.ts:107`).

### 6. 미디어 어댑터 — PASS

- SDK 직접 접근 격리: `AppsInToss.fetchAlbumPhotos/openCamera`는 `adapter.appsintoss.ts:11,33`(`AppsInToss as unknown as MediaBridges` 로컬 타입) **단일 위치**. `PhotoPickerButton.tsx:18,27`은 `../lib/media`의 `media` 객체만 사용(SDK import 0).
- base64 정규화: `normalizePicked`(`normalize.ts:11-20`)가 data URI/raw base64 모두 흡수 → `{dataUri, mimeType}`. `PhotoPickerButton` `onPick` → `CookingLogForm.tsx:93-94` `image: photo.dataUri`, `mimeType: photo.mimeType` → `CreateCookingLogRequest`. 03 §3.8b.2 `image:data:image/...`+`mimeType:^image/` 정합(zod `createCookingLogRequestSchema:24-25` 정규식 일치).
- 환경 분기: `index.ts:15-17` `APP_ENV==='local'` → noop, 미지원 → noop 폴백.

### 7. 검수 정책 — PASS

- 권한 선언 ↔ 사용: `granite.config.ts:19-24` `{name:'photos',access:'read'}`+`{name:'camera',access:'access'}`(D80) ↔ 어댑터 `fetchAlbumPhotos`(앨범=photos)+`openCamera`(카메라). 최소권한 정합.
- hex 0건: 본 차 신규/수정 9파일 전수 grep 0(색은 `colors` 토큰만, D83/ADR-015 D39).
- 사진=개인정보 고지: `pages/privacy.tsx:39,56` — 첨부 사진 수집 + "비공개 클라우드 스토리지·만료 서명 URL·기록 삭제 시 사진 동반 삭제" 명시. 03 §3.8b.8 PENDING(개인정보처리방침 사진 1줄) 충족.
- AI 면책: 기록 자체엔 불필요(요리명/사진/소감 사용자 입력). 레시피 생성·추천 화면 기존 면책 유지(범위 외, 무변경).
- SDK 직접 import는 `_app.tsx`(Granite 컨테이너, 기존)·`useTossUserId`·`adapter.toss`·`adapter.appsintoss` 4곳만 — 신규 격리 정책 준수.

### 8. 스냅샷 무결성 — PASS

- `toGeneratedRecipe`(`CookingLogForm.tsx:41-53`)가 `dishName/description/servings/cookTimeMinutes/difficulty/ingredients/steps/tips/nutrition` 9필드만 추출 → **id/isFavorite/createdAt 비전송**(GeneratedRecipe 필드만). 제출 `recipe: toGeneratedRecipe(recipeSel.recipe)`(`:95`).
- `RecipeSnapshotPicker`: 저장본 선택 시 `onSelect(r, r.id)`(`:67`) — `Recipe`(extends GeneratedRecipe)를 상위호환 전달 + `sourceRecipeId=r.id`. 미저장(생성 결과)은 `new.tsx:52` `sourceRecipeId: null`. D78 정합(저장본=r.id / 미저장=null). 런타임 잔여 extra 필드는 제출 직전 `toGeneratedRecipe`가 제거 → 백엔드로 GeneratedRecipe 순수 shape 전송.
- 생성→기록 진입: `generate.tsx:227` `navigate('/cooking-log/new', { recipe })`(미저장 GeneratedRecipe, id 없음) → `new.tsx:51-53` `initialRecipe={recipe, sourceRecipeId: null}`. id 누출 0.

---

## 비차단 관찰 (정보성 — 수정 불요)

1. **router.gen.ts lint warning 1건** (`1:1 Unused eslint-disable directive`) — Granite 자동 생성 파일, `granite build` 시 재생성. 사전 누적·무해(0 errors). 차단 아님.
2. **디바이스 사진 선택 반환형 실증 PENDING** (ADR-021 외부 작업) — `adapter.appsintoss.ts`의 브리지 반환 `{id?,dataUri?}`은 가정. `normalizePicked`가 dataUri/raw 모두 흡수해 방어적이나, 실 디바이스 반환 형태(`base64:false`일 때 dataUri 제공 여부)는 미검증. 백엔드 cooking-logs·R2 미배포와 함께 출시 전 e2e 실증 필요. **코드 경계면 정합과 무관** — 외부 의존, architect 인계.

## 미검증 (환경 제약)

- **AppsInToss MCP**(`search_tds_rn_docs`/`get_tds_rn_doc`) 본 세션 미제공 → 설치 패키지 `.d.ts` + `pnpm typecheck` 실측으로 폴백(영역 4). 설치본은 실 빌드 대상이므로 MCP 문서보다 강한 실재 증거 — TDS 매핑 PASS 확정.

## 통지

- 치명 FAIL 0 → frontend/api-client 수정 요청 없음.
- 외부 작업 PENDING(디바이스 사진 실증·백엔드 R2 배포·권한 콘솔 등록)은 architect 인계(코드 경계면 외부).
