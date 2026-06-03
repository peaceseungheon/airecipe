# 설계 스펙 — 요리 기록 피드 (개인 중심 MVP)

- 날짜: 2026-06-03
- 범위: **cross-cutting** — 백엔드(`airecipe-backend/`) + 미니앱(`airecipe-miniapp/`)
- 진행 원칙(루트 CLAUDE.md): 백엔드 계약 먼저 확정 → 미니앱 정렬
- 상태: 설계 승인됨(브레인스토밍 합의). 본 문서는 구현 계획(writing-plans)의 입력.

---

## 1. 목표 / 한 줄 요약

사용자가 **만든 요리의 기록**(사진 1장 + 레시피 스냅샷 + 별 5점 + 소감)을 올리고,
미니앱 **메인(홈)을 내 기록 피드**로 전환한다. 앱 구조를 3탭 **[피드 · 레시피 · 마이]** 로 재편한다.

---

## 2. 범위 / 비범위

### 범위 (이번 단계)
- 요리 기록 업로드 폼: 사진(필수) · 레시피 스냅샷(필수) · 별점(필수) · 소감(필수).
- 메인(홈) = 내 기록 피드(역순), 우하단 FAB "올리기".
- 3탭 재편: 피드(`/`) · 레시피(`/recipe`) · 마이(`/my-recipes`).
- 기록 상세 화면(사진 + 레시피 스냅샷 + 별점 + 소감), 기록 삭제.
- 백엔드: `cooking_logs` 테이블 + 비공개 **Cloudflare R2** 버킷 + 4 엔드포인트.

### 비범위 (다음 단계 — 명시적 제외)
- **공개 피드 / 타 사용자 콘텐츠 노출**(이번엔 owner-scoped, 본인 기록만).
- 좋아요 · 댓글 · 팔로우 등 소셜 상호작용.
- 신고 · 모더레이션 · 관리자 도구.
- 다중 사진(MVP는 1장).
- 무한 스크롤(MVP는 기존 page/pageSize "더 보기" 패턴).
- 올린 기록의 **수정**(생성/삭제만).

> 비공개 버킷 + owner-scoped 설계는 다음 "공개 피드" 단계로의 확장 지점을 남긴다
> (가시성 컬럼 추가 + 공개 조회 쿼리 + 서명 URL 정책 재검토).

---

## 3. 확정된 설계 결정 (브레인스토밍 합의)

| # | 결정 | 선택 | 비고 |
|---|------|------|------|
| D1 | 사회적 모델 범위 | **개인(내 기록) 중심** | 공개/타 사용자는 다음 단계 |
| D2 | post↔recipe 관계 | **스냅샷 내장** | 원본 레시피 수정/삭제와 무관하게 기록 보존 |
| D3 | 앱 구조 | **3탭: 피드(홈)/레시피/마이** | 생성·추천은 '레시피' 탭으로 이동 |
| D4 | 필수 입력 | 사진(1장)·레시피·별점·소감 **모두 필수** | |
| D5 | 평점 방식 | **별 5점(★1~5)** | TDS 별 컴포넌트 실재성 검증 필요 |
| D6 | 업로드 아키텍처 | **A. 백엔드 경유** | base64 JSON 단일 요청 → 백엔드가 R2에 저장 |
| D7 | 버킷 공개 범위 | **비공개 버킷 + 서명(presigned) 조회 URL** | 프라이버시·다음 단계 정합 |
| D8 | 레시피 스냅샷 출처 | **저장본 선택 + 방금 생성한 미저장 레시피 첨부 둘 다** | `sourceRecipeId` 미저장 시 null |
| D9 | 스토리지 공급자 | **Cloudflare R2** (S3 호환) | Supabase Storage 아님. 백엔드가 S3 API로 업로드/presign/삭제 |

---

## 4. 이미지 처리 사실 (실증 확인)

- 앱인토스 프레임워크(`@apps-in-toss/framework@2.6.0`)에 **`AppsInToss.fetchAlbumPhotos`(앨범)·`AppsInToss.openCamera`(카메라)** 가 런타임에 실재함(`dist/index.js` L2700/2703에서 `AppsInToss` 객체 멤버로 확인).
- ⚠ **단, `.d.ts` 타입 정의에는 없음**(untyped 브리지) → **타입 어댑터로 감싸고 로컬 타입 선언 필요**. 기존 광고 어댑터 격리(ADR-014) 패턴과 동일.
- 두 API 모두 **base64 data URI**를 반환(`file://` URI 아님) → 업로드는 **base64-in-JSON**이 안전 경로(RN FormData multipart는 Android 회귀 이슈로 위험).
- `granite.config.ts`에 **권한 선언 필요**: `photos(read)`·`camera(access)`.
- 출처: 앱인토스 개발자센터 `bedrock/reference/framework/사진/fetchAlbumPhotos`, `.../카메라/openCamera`, `.../권한/permission`.

---

## 5. 데이터 모델 (백엔드, 신규)

### 5.1 테이블 `cooking_logs` (owner-scoped RLS — `recipes`와 동일 정책)

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| user_id | uuid | NOT NULL | profiles 매핑(옵션 P, 기존과 동일) |
| photo_path | text | NOT NULL | Storage 객체 경로 `{user_id}/{id}.jpg` |
| recipe | jsonb | NOT NULL | GeneratedRecipe 스냅샷(camelCase 저장, recipes 관례 동일) |
| source_recipe_id | uuid | NULL | 원본 레시피 참고용(생명주기 비결합, FK 미강제 가능) |
| rating | int | NOT NULL, CHECK 1..5 | |
| review | text | NOT NULL | |
| created_at | timestamptz | default now() | 피드 정렬 키(역순) |

- **RLS**: `user_id = 현재 사용자`(웹 Supabase Auth 쿠키 OR 미니앱 `X-Toss-User-Id` → internal uuid 매핑, 기존 dual-auth 재사용).
- 인덱스: `(user_id, created_at desc)`.

### 5.2 객체 스토리지 — Cloudflare R2 버킷 `cooking-photos`
- **공급자: Cloudflare R2**(S3 호환 API). Supabase Storage **아님**.
- **비공개(private) 버킷** — 공개 도메인/공개 접근 비활성.
- 객체 키: `{internal_user_id}/{log_id}.{ext}`.
- 조회 시 서버가 **S3 presigned GET URL**(예: TTL 1h) 발급 → 응답 `photoUrl`.
- 업로드(`PutObject`)/조회 presign/삭제(`DeleteObject`)는 **백엔드만** 수행(R2 자격증명 서버 전용). 미니앱은 R2를 직접 접근하지 않음.

### 5.3 R2 연동 (백엔드)
- **런타임:** 기존 API Route 관례대로 `export const runtime = "nodejs"`(AWS SDK 동작 — edge 불가).
- **클라이언트(권장):** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`(presign 1급 지원). 경량 대안 `aws4fetch` 가능하나 표준성·presign 편의로 AWS SDK v3 권장.
  - `S3Client({ region: "auto", endpoint: "https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com", credentials: { accessKeyId, secretAccessKey } })`.
- **신규 환경변수(백엔드 전용, 미니앱에 절대 미포함):**
  | 키 | 용도 |
  |---|---|
  | `R2_ACCOUNT_ID` | R2 엔드포인트 구성 |
  | `R2_ACCESS_KEY_ID` | R2 API 토큰 access key |
  | `R2_SECRET_ACCESS_KEY` | R2 API 토큰 secret |
  | `R2_BUCKET` | 버킷명(`cooking-photos`) |
- **격리:** R2 접근을 단일 모듈(예: `src/lib/storage/r2.ts` 또는 `StorageService`)로 캡슐화 — 업로드/presign/삭제만 노출. 어댑터 격리로 향후 공급자 교체·테스트 용이(레포지토리/어댑터 패턴).
- `.env.example` 갱신 + 배포 환경(Vercel staging/prod)에 R2 시크릿 주입(외부 작업 PENDING).

---

## 6. 백엔드 API 계약 (신규 4종 — 모두 보호 엔드포인트, `X-Toss-User-Id` 필수)

> SSOT: 백엔드 구현 후 `docs/appsintoss-port/03-API-CONTRACT.md`에 §추가 + 백엔드 측 계약 문서/ADR 동기.

### 6.1 `POST /api/cooking-logs` — 기록 생성
- Request body (JSON):
  ```jsonc
  {
    "image": "data:image/jpeg;base64,...",   // 필수, base64 data URI
    "mimeType": "image/jpeg",                  // 필수
    "recipe": { /* GeneratedRecipe 스냅샷 */ }, // 필수
    "sourceRecipeId": "uuid | null",           // 선택(저장본 출처면 채움)
    "rating": 5,                                // 필수 1..5
    "review": "국물이 끝내줘요"                 // 필수, 비어있지 않음
  }
  ```
- 동작: 입력 검증 → base64 디코드 → **R2 업로드(`PutObject`)** → `cooking_logs` 행 insert(`photo_path`=R2 키) → 생성 결과 반환.
- **Next.js 라우트 body 크기 한도 상향**(이미지 base64 ~2–3MB 고려).
- Response 201: `CookingLog`(아래 6.5).
- 에러: `VALIDATION_ERROR`(필드/크기/mime), `UNAUTHORIZED`, `PAYLOAD_TOO_LARGE`, AI 무관.

### 6.2 `GET /api/cooking-logs?page&pageSize` — 내 기록 목록
- owner-scoped, `created_at` 역순.
- Response 200: `{ data: CookingLog[], meta: { total, page, pageSize } }`.
- 각 항목 `photoUrl`은 신선한 서명 URL.

### 6.3 `GET /api/cooking-logs/[id]` — 기록 상세
- owner-scoped. Response 200: `CookingLog`. 미존재/비소유 → 404(구분 안 함, 기존 관례).

### 6.4 `DELETE /api/cooking-logs/[id]` — 기록 삭제
- owner-scoped. 행 삭제 + **R2 객체 삭제(`DeleteObject`)**. Response 200: `{ data: { id } }`. 404 멱등 정규화(기존 관례).

### 6.5 응답 shape `CookingLog`
```jsonc
{
  "id": "uuid",
  "photoUrl": "https://...r2-presigned...",  // R2 presigned GET URL(만료 있음)
  "recipe": { /* GeneratedRecipe 스냅샷 */ },
  "rating": 5,
  "review": "...",
  "createdAt": "ISO8601"
}
```
- `user_id`/`photo_path` 등 내부 식별자 **비노출**.

### 6.6 CORS
- 4 엔드포인트를 기존 미니앱 origin 화이트리스트에 추가.

---

## 7. 미니앱 아키텍처

### 7.1 이미지 어댑터 (신규) `src/lib/media/`
- `AppsInToss.fetchAlbumPhotos`/`openCamera` 격리 + 권한 흐름(`getPermission`/`openPermissionDialog`) + **로컬 타입 선언**(브리지 untyped).
- SDK 직접 import는 이 어댑터 1곳만(광고 어댑터와 동일 규약, grep 검증 대상).
- 노출: `pickPhoto(): Promise<{ base64DataUri, mimeType }>`(앨범/카메라 선택 + maxWidth 1024).

### 7.2 환경/설정
- `granite.config.ts`: `permissions`에 `photos(read)`·`camera(access)` 추가.

### 7.3 api-client / 검증 / 훅
- `src/services/cooking-logs.ts` — `createCookingLog`/`listCookingLogs`/`getCookingLog`/`deleteCookingLog`. 보호 호출 → `useTossUserId` 헤더 + 401 자동 재시도(기존 패턴 재사용). 직접 fetch 금지(api-client 단일 경로).
- `src/lib/zod/cooking-log.ts` — 요청/응답 zod 스키마(rating 1..5, review 비어있지 않음, recipe 스냅샷 shape).
- 훅: `useCookingFeed`(목록+페이지네이션), `useCreateCookingLog`(낙관적/진행상태), `useDeleteCookingLog`.

### 7.4 라우팅 재편 (3탭) — SSOT: `07-ROUTING`
| 라우트 | 파일 | 탭 | 변경 |
|---|---|---|---|
| `/` | `pages/index.tsx` | **피드** | 기존 생성 폼 제거 → 피드 리스트 + FAB |
| `/recipe` | `pages/recipe/index.tsx` (신규) | **레시피** | 기존 홈 콘텐츠(SearchForm + "오늘의 추천" CTA + 약관 푸터) 이동 |
| `/my-recipes` | `pages/my-recipes.tsx` | **마이** | 불변 |
| `/cooking-log/new` | `pages/cooking-log/new.tsx` (신규) | — | 업로드 폼 |
| `/cooking-log/[id]` | `pages/cooking-log/[id].tsx` (신규) | — | 기록 상세 |

- `BottomTabBar`: `TabKey`를 `'feed'|'recipe'|'my'`로 확장(현 `'home'|'my'`), `TABS` 3행, 전 화면 `active` prop 갱신(현 `active="home"` → `"feed"`). `'none'` 센티넬 유지.
- `src/router.gen.ts` 신규 라우트 수동 등록(빌드 시 자동 재생성).
- 기존 `/recipe/generate`·`/recipe/recommend`·`/recipe/[id]` 라우트는 유지(레시피 탭에서 진입).

### 7.5 컴포넌트 (신규)
- `FeedCard` — 사진 썸네일 + dishName + 별점 표시 + 소감 스니펫. 탭 → 상세.
- `FeedEmptyState` — 기록 0건.
- `StarRating` — 입력(폼) + 표시(카드/상세). ⚠ TDS 실재성 검증(7.6).
- `PhotoPickerButton` — 미디어 어댑터 호출 + 미리보기.
- `RecipeSnapshotPicker` — 저장 레시피 선택(listRecipes 재사용) + 생성 결과 화면에서 전달된 미저장 레시피 수용("이 레시피로 기록 남기기" 진입).

### 7.6 검증 필요 항목 (architect/QA 단계, 출시 전 실증)
- ⚠ **TDS 별점 컴포넌트 실재성** — 실재 시 사용, 없으면 검증된 프리미티브로 합성(★/☆ 글리프 + `colors` 토큰; ADR-017의 `Icon name` free-string 렌더 리스크 회피).
- ⚠ **이미지 브리지 untyped → 타입 어댑터** + 디바이스 실증(외부 작업 PENDING 관례, 광고 SDK 선례).
- Next.js body 크기 한도 / **R2 presigned URL TTL ↔ 피드 캐싱** 상호작용(만료 후 재조회 시 URL 갱신 필요 — 목록 응답마다 신선한 presign 발급).
- **R2 자격증명·SDK**: `runtime="nodejs"` 필수(edge 불가), 자격증명 백엔드 전용(미니앱 미포함), R2 엔드포인트/버킷 설정 검증.
- **검수/개인정보:** 신규 권한(photos/camera) 콘솔+config 선언 + 최소권한 정당화. **사진은 개인정보** → 개인정보처리방침(ADR-020)에 사진 저장·보관 1줄 추가. AI 콘텐츠 면책은 기존 패턴 유지(기록 자체는 AI 산출 아님).

---

## 8. 업로드 흐름(시퀀스)

```
[레시피 탭/생성결과] --"이 레시피로 기록 남기기"--> /cooking-log/new (recipe 전달)
   또는 [피드 FAB "올리기"] --> /cooking-log/new (RecipeSnapshotPicker로 저장본 선택)
        |
   PhotoPickerButton -> media adapter (fetchAlbumPhotos/openCamera, 권한) -> base64
        |
   별점(StarRating) + 소감(TextField) 입력
        |
   useCreateCookingLog -> api-client.createCookingLog(base64+recipe+rating+review)
        |  (단일 POST)
   backend: 검증 -> R2 업로드(PutObject) -> cooking_logs insert -> CookingLog(presigned photoUrl) 반환
        |
   성공 -> 피드(/)로 이동 + 캐시 무효화(새 기록 상단 노출)
```

---

## 9. 수용 기준 (Acceptance Criteria, 초안)

- AC1: 피드 탭에서 내 기록이 역순으로 보이고, 기록 0건이면 빈 상태가 보인다.
- AC2: 업로드 폼에서 사진·레시피·별점·소감을 모두 입력해야 제출 가능(누락 시 한국어 안내).
- AC3: 사진은 앨범/카메라에서 선택되고, 권한 거부 시 한국어 안내 + 재요청 경로.
- AC4: 제출 성공 시 피드 최상단에 새 기록이 즉시 보인다.
- AC5: 기록 상세에서 레시피 스냅샷 전체 + 별점 + 소감 + 사진을 본다.
- AC6: 기록 삭제 시 목록·Storage에서 제거된다.
- AC7: 레시피 탭에서 기존 생성/추천 진입이 정상 동작한다(회귀 없음).
- AC8: typecheck PASS · lint 0 errors · hex 0건 · SDK 직접 import는 어댑터 1곳 · 통합 정합성 QA GO.

---

## 10. 후속/오픈 항목

- 공개 피드(타 사용자) — 가시성 컬럼 + 공개 조회 쿼리 + 서명 URL/모더레이션 정책(별 단계).
- 무한 스크롤(현 누적 미해결과 통합).
- 다중 사진, 기록 수정, 좋아요/댓글.
- 닉네임/프로필(현재 익명 해시만) — 공개 단계 진입 시 필요.
