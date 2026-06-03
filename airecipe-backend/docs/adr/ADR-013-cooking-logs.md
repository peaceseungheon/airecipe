# ADR-013 — 요리 기록 피드 (cooking_logs + Cloudflare R2, 백엔드 구현)

- 상태: Accepted
- 일자: 2026-06-03
- 결정자: recipe-architect / recipe-backend
- 관련 ADR: ADR-001(Supabase), ADR-005(소유권 위반 404 수렴), ADR-006(pageSize clamp), ADR-010(옵션 P Toss user 매핑·CORS), ADR-011(보호+서비스 레이어 패턴)
- 관련 코드: `src/app/api/cooking-logs/`, `src/services/cooking-log.service.ts`, `src/repositories/{cooking-log.repository,supabase-cooking-log.repository}.ts`, `src/lib/storage/`, `src/mappers/cooking-log-mapper.ts`, `supabase/migrations/0003_create_cooking_logs.sql`
- 설계 SSOT(상위): `docs/superpowers/specs/2026-06-03-cooking-log-feed-design.md` (§3 결정표, §5 데이터모델, §6 API 계약)
- 구현 계획: `docs/superpowers/plans/2026-06-03-cooking-log-feed-backend.md`

## 컨텍스트

사용자가 **만든 요리의 기록**(사진 1장 + 레시피 스냅샷 + 별 5점 + 소감)을 올리고, 미니앱 메인(홈)을 내 기록 피드로 전환하는 기능을 추가한다. 백엔드는 `cooking_logs` 테이블 + 비공개 Cloudflare R2 버킷 + 보호된 4 엔드포인트(생성/목록/상세/삭제)를 담당한다.

이번 단계는 **개인 중심 MVP**(owner-scoped, 본인 기록만)다. 공개 피드/타 사용자 노출/좋아요·댓글/다중 사진/기록 수정은 명시적 비범위이며, 비공개 버킷 + owner-scoped 설계가 다음 "공개 피드" 단계로의 확장 지점을 남긴다.

기존 백엔드는 보호+영속 라우트 패턴(`GET/POST /api/recipes` → `requireUser` → `getRecipeService(source)` → `RecipeService(Repository)` → Supabase)을 보유한다. 본 기능은 그 계층형을 그대로 복제하되, **신규로 R2 스토리지 어댑터**(`StoragePort` 추상 + S3 구현)를 추가하고 `CookingLogService`가 R2 업로드/presign과 `CookingLogRepository`를 조율한다.

## 결정 카탈로그 (스펙 §3 결정표 D1~D9 인용)

### D1 — 사회적 모델 범위: 개인(내 기록) 중심
- **결정**: owner-scoped. 본인 기록만 조회/생성/삭제. 공개/타 사용자 노출은 다음 단계.
- **근거**: MVP 단순화 + 프라이버시. 가시성 컬럼·공개 조회 쿼리·모더레이션은 별 단계 진화 대상.
- **시행**: 모든 쿼리에 `user_id` 스코프(RLS 쿠키 경로 + service-role `.eq('user_id', ...)` 헤더 경로).

### D2 — post↔recipe 관계: 스냅샷 내장
- **결정**: `recipe` 컬럼에 `GeneratedRecipe` 전체를 jsonb 스냅샷으로 저장한다. 원본 레시피 FK 참조가 아니다.
- **근거**: 원본 레시피의 수정/삭제와 무관하게 기록을 보존한다(기록의 불변성).
- **비고**: `source_recipe_id`(uuid, nullable)는 **참고용**으로만 둔다 — FK 미강제(생명주기 비결합). 저장본 출처면 채우고, 방금 생성한 미저장 레시피면 null.

### D3 — 앱 구조: 3탭(피드/레시피/마이)
- **결정**: 미니앱 메인을 피드(홈)로 전환, 생성·추천은 '레시피' 탭으로 이동. (미니앱 책임 — 백엔드는 4 엔드포인트 제공만.)
- **백엔드 영향**: 없음(API 계약만 제공).

### D4 — 필수 입력: 사진·레시피·별점·소감 모두 필수
- **결정**: 4개 필드 모두 필수. 서버 zod로 강제(`createCookingLogRequestSchema`).
- **시행**: `image`(base64 data URI 정규식), `mimeType`(`^image/`), `recipe`(`generatedRecipeSchema`), `rating`(int 1..5), `review`(trim 후 1..1000자). 누락/위반 → `VALIDATION_ERROR`(400).

### D5 — 평점 방식: 별 5점(★1~5)
- **결정**: `rating int CHECK (rating between 1 and 5)`. 서버 zod `.int().min(1).max(5)`.
- **시행**: rating 0/6 거부(400). DB CHECK 제약이 2차 방어.

### D6 — 업로드 아키텍처: A. 백엔드 경유(base64 JSON 단일 요청)
- **결정**: 미니앱이 사진을 base64 data URI로 인코딩해 JSON 본문에 담아 `POST /api/cooking-logs` 단일 요청. 백엔드가 디코드 후 R2에 `PutObject`. presigned 직접 업로드(클라이언트→R2) 아님.
- **근거**: R2 자격증명을 서버 전용으로 격리(미니앱 미포함). RN FormData multipart는 Android 회귀 이슈가 있어 base64-in-JSON이 안전 경로(스펙 §4).
- **비고(body 크기)**: 이미지 base64는 ~2–3MB. Next.js 16 App Router는 별도 bodyParser 설정 없이 `request.json()`으로 읽는다. 플랫폼(Vercel) 4.5MB 제한은 미니앱의 `maxWidth 1024` 다운스케일로 회피한다(추가 라우트 설정 불필요). 스펙 §6.1의 `PAYLOAD_TOO_LARGE`는 플랫폼/게이트웨이 레벨 응답이며, 본 코드의 `ApiErrorCode` 카탈로그에는 없다(D9 참조).

### D7 — 버킷 공개 범위: 비공개 버킷 + 서명(presigned) 조회 URL
- **결정**: 비공개(private) R2 버킷. 공개 도메인/공개 접근 비활성. 조회 시 서버가 **S3 presigned GET URL**(TTL 1h) 발급 → 응답 `photoUrl`.
- **근거**: 프라이버시(개인정보인 사진) + 다음 공개 단계와의 정합. 목록 응답마다 신선한 presign 발급(만료 후 재조회 시 URL 갱신).
- **시행**: `r2Storage.getSignedUrl(objectKey)` — `GetObjectCommand` + `getSignedUrl({ expiresIn: 3600 })`.

### D8 — 레시피 스냅샷 출처: 저장본 선택 + 미저장 레시피 첨부 둘 다
- **결정**: 저장된 레시피를 선택하거나, 방금 생성한 미저장 레시피를 첨부해 기록을 남길 수 있다. `sourceRecipeId`는 저장본 출처면 uuid, 미저장이면 null.
- **시행**: zod `sourceRecipeId: z.string().uuid().nullable().optional()`. 매퍼 `inputToInsertRow`가 `?? null` 폴백.

### D9 — 스토리지 공급자: Cloudflare R2(S3 호환)
- **결정**: Cloudflare R2. Supabase Storage **아님**. 백엔드가 S3 API(`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)로 업로드/presign/삭제.
- **근거**: 비용·S3 호환·presign 1급 지원. `S3Client({ region:"auto", endpoint:"https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com", credentials })`.
- **시행**: `runtime="nodejs"` 필수(AWS SDK — edge 불가). 자격증명 env 4키(`R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET`) 백엔드 전용.

## 추가 설계 결정 (구현 세부)

### D-CL1 — StoragePort 추상화(DIP, 어댑터 패턴)
- **결정**: R2 접근을 `StoragePort` 인터페이스(`upload`/`getSignedUrl`/`remove`)로 추상화하고 `r2Storage`(S3 구현)를 단일 모듈로 캡슐화한다. `CookingLogService`는 추상에만 의존.
- **근거**: SOLID DIP — 향후 공급자 교체(예: Supabase Storage 회귀, S3 직접)·테스트 모킹 용이. 서비스 단위 테스트는 `StoragePort` 모킹으로 외부 I/O 없이 검증(`cooking-log.service.test.ts`).
- **순수 함수 분리**: `decodeDataUri`(data URI → buffer+ext)·`buildObjectKey`(`{userId}/{logId}.{ext}`)는 순수 함수로 분리해 TDD(`r2-key.test.ts`). `jpeg`→`jpg` 확장자 정규화.

### D-CL2 — id 선발급으로 객체키-행 id 일치
- **결정**: `CookingLogService.create`가 `crypto.randomUUID()`로 `logId`를 선발급해 (a) R2 객체 키 `{userId}/{logId}.{ext}` 와 (b) `cooking_logs.id` 를 동일 값으로 맞춘다.
- **근거**: 객체 키와 행 id가 일치하면 삭제 시 키 회수가 단순하고 추적이 쉽다. `runtime="nodejs"`라 `crypto.randomUUID()` 가용. DB 기본값 `gen_random_uuid()`는 id 미전달 시 폴백.
- **시행**: 리포지토리 `create` 시그니처를 `Omit<CookingLogRow, "id"|"created_at"> & { id?: string }`로 두어 선택적 id 수용. Supabase `insert(row)`가 id 포함/미포함 모두 처리.

### D-CL3 — 소유 격리 404 정규화(ADR-005 재사용)
- **결정**: 상세 조회/삭제 시 미존재·타인 소유 모두 `ServiceError("NOT_FOUND")` → 404로 수렴. 삭제는 멱등(삭제 대상 없으면 404).
- **근거**: ADR-005와 동일. RLS + user_id 스코프상 타인 기록은 결과가 비어 "타인 소유"와 "없음"을 구분 불가 + 존재 은닉.

### D-CL4 — 에러 코드 매핑(기존 카탈로그 재사용, 신규 코드 0)
- **결정**: 신규 `ApiErrorCode` 0. 매핑:
  - 검증/JSON 파싱 실패 → `ServiceError("VALIDATION_ERROR")` → 400.
  - 인증 실패 → `requireUser`가 `ServiceError("UNAUTHORIZED")` → 401.
  - 미존재/비소유 → `ServiceError("NOT_FOUND")` → 404.
  - DB 실패 → `RepositoryError` → 서비스/`failFromError`에서 `INTERNAL_ERROR`(500)로 수렴(레시피와 동일 — `RepositoryError`는 `ServiceError`가 아니므로 INTERNAL_ERROR).
  - R2 실패(`StorageError`) → `ServiceError`가 아니므로 `failFromError`가 `INTERNAL_ERROR`(500). 업로드/presign 실패는 5xx로 노출.
- **중요(실측)**: `ServiceError(code, message, cause?)` — HTTP 상태는 생성자 인자가 아니라 `api-response.ts`의 `STATUS_BY_CODE`가 code로부터 도출. `PAYLOAD_TOO_LARGE`는 카탈로그에 없으며 플랫폼 레벨(D6 비고).

### D-CL5 — RLS 정책(update 생략)
- **결정**: `owner_select`/`owner_insert`/`owner_delete` 정책만. `owner_update`는 본 단계(기록 수정 비범위)에 불필요해 생략.
- **근거**: YAGNI. 수정 기능 추가 시 정책 추가.

## 테스트 전략

- 본 저장소 최초 테스트 러너(**vitest**) 도입. 순수 로직만 대상:
  - 매퍼(`cooking-log-mapper.test.ts`) — row↔도메인 매핑, 내부 식별자 비노출.
  - 검증(`validation.cooking-log.test.ts`) — rating/review/image/페이지네이션 경계.
  - 스토리지 키/디코드(`r2-key.test.ts`) — 객체 키 형식, data URI 디코드.
  - 서비스(`cooking-log.service.test.ts`) — `StoragePort`/`Repository` 모킹으로 업로드→행→presign 조율, 404 정규화, 삭제 시 객체 제거.
- 라우트·Supabase 구현·R2 호출(외부 I/O)은 typecheck + lint + 수동 스모크(B12)로 검증.

## 외부 작업(PENDING)

코드 외 작업은 `docs/api/cooking-logs.md`의 "PENDING(외부 작업)" 절에 체크리스트로 인계한다 — R2 버킷·토큰 발급, env 주입, 마이그레이션 적용, CORS origin 확인, 라이브 스모크.

## 롤백/확장 시나리오

- **R1 — 공개 피드**: D1 supersede. `visibility` 컬럼 추가 + 공개 조회 쿼리 + presigned URL 정책(또는 공개 CDN) 재검토 + 모더레이션. 별 ADR.
- **R2 — 다중 사진**: D-CL2/데이터모델 진화. `photo_path` → 배열 또는 별 테이블. 별 ADR.
- **R3 — 기록 수정**: `owner_update` 정책 추가 + PATCH 엔드포인트. 별 ADR.
- **R4 — 스토리지 공급자 교체**: `StoragePort`(D-CL1) 덕분에 어댑터 1개 교체로 격리. composition만 변경.

## 관련 문서

- 설계 스펙: `docs/superpowers/specs/2026-06-03-cooking-log-feed-design.md`
- 구현 계획: `docs/superpowers/plans/2026-06-03-cooking-log-feed-backend.md`
- API 문서: `docs/api/cooking-logs.md`
- 미니앱 계약 SSOT: `airecipe-miniapp/docs/appsintoss-port/03-API-CONTRACT.md` (cooking-logs §)
