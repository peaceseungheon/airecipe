# API: Cooking Logs (요리 기록 피드) — 구현 문서

> 설계 SSOT: `docs/superpowers/specs/2026-06-03-cooking-log-feed-design.md` (§5 데이터모델, §6 API 계약). 결정: ADR-013. 타입: `@/types/cooking-log`(`CookingLog`).
> 이 문서는 **실제 구현된** 응답 shape을 기록한다. 문서·타입·실제 응답 세 가지가 일치해야 한다.

## 공통 규약

- **성공(단건)**: `{ "data": <T> }` (`ApiResponse<T>`)
- **성공(목록)**: `{ "data": <T[]>, "meta": { total, page, pageSize } }` (`ApiListResponse<T>`)
- **에러**: `{ "error": { "code": ApiErrorCode, "message": string } }` (`ApiError`)
- **경계는 camelCase.** snake_case(`user_id`/`photo_path`)가 응답에 새면 Mapper 버그.
- 소비자(미니앱)는 항상 `.data`를 unwrap한다.
- `runtime="nodejs"` (AWS SDK 동작 — edge 불가, 스펙 §5.3).

## 인증 (ADR-010)

4 엔드포인트 모두 **보호**(인증 필수) — `requireUser(request)`로 두 경로 병존:
- **쿠키 (웹앱)** — Supabase Auth 세션 쿠키. RLS `auth.uid() = user_id`로 격리.
- **헤더 (미니앱)** — `X-Toss-User-Id: <hex hash>`. 백엔드가 `profiles` 매핑으로 internal_user_id 해석. service-role + Repository `.eq('user_id', ...)` 단일 방어로 격리.
- **우선순위**: 헤더 우선 · 쿠키 fallback.
- **둘 다 없음** → `401 UNAUTHORIZED`.

## CORS · OPTIONS (ADR-010 D5)

모든 라우트에 적용(기존 화이트리스트 자동 적용 — origin 기반, path 무관):
- `Access-Control-Allow-Origin`: `APPSINTOSS_ALLOWED_ORIGINS` 환경변수 화이트리스트 echo.
- `Access-Control-Allow-Headers: Content-Type, X-Toss-User-Id, Accept`
- `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Max-Age: 600`, `Vary: Origin`
- **`OPTIONS` preflight**: 모든 라우트에서 `204 No Content` + 위 헤더(화이트리스트만).

### 에러 코드 → HTTP 상태
| code | HTTP |
|------|------|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `NOT_FOUND` | 404 |
| `INTERNAL_ERROR` | 500 |

> R2 업로드/presign 실패(`StorageError`)와 DB 실패(`RepositoryError`)는 `ServiceError`가 아니므로 `failFromError`가 `INTERNAL_ERROR`(500)로 수렴한다(ADR-013 D-CL4). 스펙 §6.1의 `PAYLOAD_TOO_LARGE`는 플랫폼/게이트웨이 레벨 응답이며 본 코드의 `ApiErrorCode` 카탈로그에는 없다(미니앱 `maxWidth 1024` 다운스케일로 회피, ADR-013 D6).

### 응답 shape `CookingLog`
```jsonc
{
  "id": "uuid",
  "photoUrl": "https://...r2-presigned...",  // R2 presigned GET URL(TTL 1h, 만료 있음)
  "recipe": { /* GeneratedRecipe 스냅샷 */ },
  "rating": 5,
  "review": "...",
  "createdAt": "ISO8601"
}
```
- `user_id`/`photo_path`/`source_recipe_id` 등 내부 식별자 **비노출**.

---

## POST /api/cooking-logs — 기록 생성 (인증)

사진 1장 + 레시피 스냅샷 + 별점 + 소감을 현재 사용자 소유로 저장.

### 요청 (`CreateCookingLogRequest`, JSON)
```jsonc
{
  "image": "data:image/jpeg;base64,...",   // 필수, base64 data URI(정규식 검증)
  "mimeType": "image/jpeg",                  // 필수, ^image/
  "recipe": { /* GeneratedRecipe 스냅샷 */ }, // 필수(generatedRecipeSchema)
  "sourceRecipeId": "uuid | null",           // 선택(저장본 출처면 채움, 미저장이면 생략/null)
  "rating": 5,                                // 필수, 정수 1..5
  "review": "국물이 끝내줘요"                 // 필수, trim 후 1..1000자
}
```

### 동작
입력 검증 → base64 디코드 → R2 업로드(`PutObject`, 키 `{userId}/{logId}.{ext}`) → `cooking_logs` 행 insert(`photo_path`=R2 키, `id`=선발급 logId) → presigned GET URL 발급 → 생성 결과 반환.

### 응답 201 (`{ data: CookingLog }`)
```json
{
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "photoUrl": "https://<account>.r2.cloudflarestorage.com/...signed...",
    "recipe": { "dishName": "김치찌개", "...": "..." },
    "rating": 5,
    "review": "국물이 끝내줘요",
    "createdAt": "2026-06-03T00:00:00.000Z"
  }
}
```

### 에러
`400 VALIDATION_ERROR`(필드/mime/이미지 형식/rating·review 범위/JSON 파싱 실패), `401 UNAUTHORIZED`, `500 INTERNAL_ERROR`(R2 업로드 실패/DB 실패).

---

## GET /api/cooking-logs?page&pageSize — 내 기록 목록 (인증)

owner-scoped, `created_at` 역순(피드 정렬). 각 항목 `photoUrl`은 신선한 presigned URL.

### 요청 (query)
- `?page=number` (선택, 기본 1) — 비숫자/0/음수는 400.
- `?pageSize=number` (선택, 기본 20, 최대 50) — 50 초과는 거부하지 않고 **50으로 clamp**(ADR-006). `meta.pageSize`에 실제 적용값 반환.

### 응답 200 (`{ data: CookingLog[], meta: { total, page, pageSize } }`)
```json
{ "data": [ { "id": "...", "photoUrl": "https://...", "recipe": { }, "rating": 5, "review": "...", "createdAt": "..." } ],
  "meta": { "total": 3, "page": 1, "pageSize": 20 } }
```
- 빈 목록도 200: `{ "data": [], "meta": { "total": 0, "page": 1, "pageSize": 20 } }`.

### 에러
`401 UNAUTHORIZED`, `400 VALIDATION_ERROR`(잘못된 쿼리), `500 INTERNAL_ERROR`.

---

## GET /api/cooking-logs/[id] — 기록 상세 (인증)

기록 1건 조회. 본문 없음. `photoUrl`은 신선한 presigned URL.

### 응답 200 (`{ data: CookingLog }`)
`{ data: CookingLog }` — 목록 항목과 동일 shape.

### 에러
`401 UNAUTHORIZED`, `404 NOT_FOUND`(없거나 타인 소유 — 구분 안 함, ADR-005), `500 INTERNAL_ERROR`.

---

## DELETE /api/cooking-logs/[id] — 기록 삭제 (인증)

행 삭제 + **R2 객체 삭제**(`DeleteObject`, 멱등). 본문 없음.

### 응답 200 (`{ data: { id } }`)
`{ "data": { "id": "<삭제된 id>" } }` — 소비자 캐시 무효화용.

### 에러
`401 UNAUTHORIZED`, `404 NOT_FOUND`(미존재/타인 소유 — 멱등 정규화), `500 INTERNAL_ERROR`.

---

## PENDING (외부 작업 — 코드 아님, 수행/인계)

다음은 코드로 해결되지 않는 외부 작업이다. 본 구현은 코드/문서만 완료했고 아래는 미수행이다.

- [ ] Cloudflare R2 버킷 `cooking-photos` 생성(**비공개** — 공개 도메인/공개 접근 비활성).
- [ ] R2 API 토큰 발급 → `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` 을 로컬 `.env.local` + 배포(Vercel staging/prod)에 주입.
- [ ] Supabase에 `supabase/migrations/0003_create_cooking_logs.sql` 적용(마이그레이션 또는 SQL 에디터). RLS 정책 3종 활성 확인.
- [ ] `APPSINTOSS_ALLOWED_ORIGINS`에 미니앱 origin 포함 확인(이미 있으면 무변경 — origin 기반이라 신규 라우트 자동 적용).
- [ ] **라이브 스모크(자격증명 필요)**: env 주입 + 마이그레이션 적용 후 `pnpm dev`에서 4 엔드포인트 curl 검증(계획 B12 Step1):
  - 생성(201) → `photoUrl`(https://...r2...) 브라우저로 열어 이미지 표시 확인.
  - 목록(200) → 역순·meta 확인.
  - 상세(200) → 동일 shape.
  - 삭제(200) → 목록에서 사라지고 R2 객체 제거.
  - CORS preflight(OPTIONS) + 실제 cross-origin 호출 검증.
- [ ] **개인정보**: 사진은 개인정보 → 개인정보처리방침(ADR-020)에 사진 저장·보관 1줄 추가(미니앱 검수 항목).
