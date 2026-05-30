# ADR-011 — `POST /api/recommendations` 테마 기반 요리 추천 (백엔드 구현)

- 상태: Accepted
- 일자: 2026-05-29
- 결정자: recipe-architect
- 관련 ADR: ADR-002(AI Adapter), ADR-008(Gemini 기본 + Claude 롤백/Factory), ADR-010(옵션 P Toss user 매핑·CORS)
- 관련 코드: `src/app/api/recommendations/`, `src/services/`, `src/lib/ai/`
- 계약 SSOT(상위): 미니앱 `airecipe-miniapp/src/lib/zod/recommendations.ts`, `docs/appsintoss-port/03-API-CONTRACT.md §3.8`, 미니앱 `docs/adr/ADR-016-recommendations.md` (D44~D52)

## 컨텍스트

미니앱(`airecipe-miniapp`)은 Phase 6에서 테마(상황·날씨) 기반 요리 5개 추천 기능을 **계약 소비 측까지 완성**했다 (zod 검증, api-client `getRecommendations`, `useRecommendations` 훅, `ThemePicker`/`RecommendationCard`, `/recipe/recommend` 페이지). 그러나 백엔드 `POST /api/recommendations` 라우트가 **미구현**이라 실제 호출 시 **404**가 발생한다.

미니앱 ADR-016은 이 백엔드 작업을 "외부 작업 PENDING"으로 명시했고, 본 ADR이 그 인계를 백엔드 측에서 이행한다. 계약(요청·응답 shape·에러·인증·CORS·비-stream)은 이미 미니앱 측에서 동결되었으므로 **백엔드는 그 계약에 정렬(contract-follow)**하며 shape을 새로 발명하지 않는다.

기존 백엔드는 두 라우트 패턴을 이미 보유한다:
- `POST /api/recipes/generate` — **공개**, AI 호출(Gemini/Claude 어댑터 + 구조화 출력).
- `GET/POST /api/recipes` — **보호**, 옵션 P 인증(`requireUser` → `X-Toss-User-Id` → internal uuid).

추천 라우트는 **이 둘의 교집합** — 보호 + AI 호출이다. 따라서 신규 패턴 발명 없이 기존 레이어(Route → Service → AIProvider 어댑터 → Prompt + 구조화 스키마 + zod 재검증)를 그대로 복제·치환한다.

## 결정 카탈로그 (D-R1 ~ D-R10)

### D-R1 — 계약 정렬 방향(미니앱 SSOT 추종)
- **결정**: 요청/응답 shape, enum 값·순서, 길이 제약, 에러 코드, 인증, CORS, 비-stream은 모두 미니앱 `recommendations.ts` + 03-API-CONTRACT §3.8 + ADR-016을 SSOT로 추종한다. 백엔드는 동일 제약의 **서버 측 zod 미러**를 둔다(두 저장소 간 코드 import 불가 → 의도적 복제 + ADR 상호 참조로 동기화 관리).
- **근거**: 미니앱이 이미 소비 완성. 경계면 일치가 최우선.
- **시행 검증**: 백엔드 zod 필드/제약이 미니앱 zod와 1:1 일치 (QA Q1).

### D-R2 — 레이어 분리(기존 패턴 재사용, SOLID)
- **결정**: `Route(app/api/recommendations/route.ts) → RecommendationService → AIRecommendationProvider(어댑터) → buildRecommendationPrompt + 구조화 스키마`. 라우트는 HTTP/CORS/인증/검증/응답 래핑만, 서비스는 유스케이스 위임 + 에러 매핑 + meta 조립, Provider는 AI SDK 호출 + 구조화 출력 + zod 파싱, Prompt는 문자열·스키마 빌드.
- **근거**: `recipes/generate/route.ts` + `RecipeGenerationService` + `Gemini/ClaudeRecipeProvider` 패턴의 직접 복제. SRP/DIP 유지. 신규 추상화 도입 0.
- **대안 기각**: 라우트에 AI 호출 직접(SRP 위반). generate 서비스에 메서드 추가(입출력·프롬프트 상이 → ISP 위반).

### D-R3 — AI Provider 어댑터 신규 인터페이스(`AIRecommendationProvider`)
- **결정**: 기존 `AIRecipeProvider`를 확장하지 않고 **별도 인터페이스** `AIRecommendationProvider { recommend(input): Promise<RecommendationItem[]> }`를 신설한다. Gemini/Claude 두 구현 + Factory(`AI_PROVIDER` 스위치, ADR-008 패턴)를 추천 전용으로 추가한다.
- **근거**: ISP — 추천(입력 theme·출력 items[5])과 레시피 생성(입력 dishName·출력 GeneratedRecipe)은 완전히 다르다. 한 인터페이스에 합치면 구현체가 불필요 메서드를 강제 구현해야 함.
- **대안 기각**: `AIRecipeProvider`에 `recommend` 추가(기존 generate 구현 2개 동시 수정·ISP 위반).

### D-R4 — 구조화 출력 방식(generate와 동일 — Gemini responseSchema + Claude tool use) + 서버 zod 재검증
- **결정**: Gemini는 `responseMimeType:'application/json' + responseSchema`(추천 전용 `RECOMMENDATIONS_RESPONSE_SCHEMA`, `@google/genai`의 `Type`/`Schema`), Claude는 `tools + tool_choice:{type:'tool', name:'emit_recommendations'}`(추천 전용 `emitRecommendationsTool`)로 items 배열을 강제한다. AI 응답은 받은 직후 **서버 측 zod로 재검증**(`parseRecommendationItems`)하여 **정확히 5개**·길이 제약 위반 시 어댑터가 `AIProviderError('provider_error', ...)`로 변환 → 서비스가 `ServiceError('AI_PROVIDER_ERROR')` → 502.
- **근거**: `gemini/claude-recipe-provider.ts` + `recipe-schema.ts`의 검증된 2단계(스키마 강제 + zod 재검증)를 그대로 복제. Gemini/Claude SchemaType에는 배열 고정 길이 강제가 없으므로 "정확히 5개"의 최종 보증은 **서버 zod `.length(5)`**가 한다(프롬프트 + 스키마는 보조 지시).
- **시행 검증**: 백엔드 zod `z.array(itemSchema).length(5)`, `dishName.max(60)`, `description.max(120)`, `tags.array(...max(16)).max(5)` (미니앱 zod 미러, ADR-016 D46).

### D-R5 — 인증(옵션 P 재사용 — `requireUser(request)` 그대로)
- **결정**: 보호 엔드포인트. 라우트 try 블록 최상단 `await requireUser(request)`로 `X-Toss-User-Id` → `profiles` 매핑(헤더 경로) 또는 쿠키 세션(웹앱 경로) → internal uuid. 미인증 시 `ServiceError('UNAUTHORIZED')` throw → `failFromError`가 401로 변환. **신규 인증 코드 0** — `@/lib/auth/require-user`의 `requireUser`를 `GET/POST /api/recipes`와 동일하게 호출.
- **근거**: ADR-010 옵션 P 매핑이 이미 존재·검증됨. 미니앱 ADR-016 D47이 보호+401 1회 재시도 요구(재시도는 미니앱 책임, 백엔드는 401만 정확히 반환).
- **비고**: 추천은 결과를 DB에 쓰지 않으므로(D-R8) `requireUser` 반환값(`{ id, source }`)은 **사용하지 않는다** — 인증 통과(401 차단) 자체가 목적. (`await requireUser(request);` 만 호출, 구조분해 불필요.)

### D-R6 — CORS(기존 화이트리스트 자동 적용 — `withCors(res, request)`)
- **결정**: `OPTIONS = corsPreflightResponse` + 모든 POST 응답을 `withCors(response, request)`로 감싼다. `src/lib/cors.ts`의 화이트리스트(env `APPSINTOSS_ALLOWED_ORIGINS`)를 **수정 없이** 재사용. cors.ts는 origin 기반이지 path 기반이 아니므로 신규 라우트가 자동으로 동일 정책을 받는다 — 추천 전용 등록 불필요.
- **근거**: 기존 generate/recipes 라우트와 동일. `Access-Control-Allow-Headers`에 이미 `X-Toss-User-Id` 포함. 미니앱 prod/staging origin은 배포 시 `APPSINTOSS_ALLOWED_ORIGINS` env로 추가(코드 무변경).
- **주의(미니앱 §3.8.5 보정):** 미니앱 §3.8.5는 "preflight 시 `Allow-Methods: POST, OPTIONS`"라 적었으나, 실제 백엔드 cors.ts는 SSOT로 `GET, POST, PATCH, DELETE, OPTIONS` 전체를 반환한다(엔드포인트별 분기 없음). POST/OPTIONS가 그 집합에 포함되므로 계약상 정상 — 백엔드는 cors.ts 무변경 유지(엔드포인트별 메서드 분기 도입 안 함, YAGNI).

### D-R7 — 비-stream JSON 단일 응답(`ok({ items, meta })`)
- **결정**: `Content-Type: application/json`, `ok(result)` 단일 응답(200). 스트리밍 없음. 응답 본문은 계약 래퍼 `{ data: { items, meta } }`(api-response.ts `ok()`).
- **근거**: ADR-016 D48 — 응답이 ~1KB로 작아 점진 표시 불필요. generate와 달리 SSE 미사용.
- **시행 검증**: 미니앱 api-client는 `.data`를 unwrap 후 `recommendationsResponseSchema.parse(json.data)` 검증 → 본 래퍼와 정합.
- **롤백 R2**: 응답 지연 체감 시 미니앱 ADR-016 R2(스트리밍) 연동 — 별 ADR.

### D-R8 — 추천 결과 DB 로깅 생략(서버 무상태)
- **결정**: 추천 결과를 DB에 저장/로깅하지 **않는다**. 서버는 무상태 — 매 요청마다 AI 호출 후 응답만 반환. 캐싱은 클라이언트(미니앱 `useRecommendations` 메모리 hash key) 책임.
- **근거**: (a) 추천 items는 ephemeral(미니앱 ADR-016 — id 없음, 저장 대상 아님). (b) 신규 테이블/리포지토리/마이그레이션 0 — YAGNI. (c) 개인화 추천(과거 데이터 기반)은 미니앱 ADR-016 D47 보조로 별 ADR 진화 대상이며 현 범위 밖.
- **대안 기각**: `recommendation_logs` 테이블 신설(현 요구사항에 분석/개인화 없음 → 과도한 인프라 부담).
- **시행 검증**: 신규 Supabase 마이그레이션 0건, 신규 리포지토리 0건. (Q13)

### D-R9 — 요청 검증 위치(validation.ts에 추천 요청 스키마 추가 + parseOrThrow 재사용)
- **결정**: 추천 전용 요청 zod 스키마(`recommendationsRequestSchema`)를 기존 `src/lib/validation.ts`에 추가하고(다른 요청 스키마 `generateRequestSchema` 등과 동일 위치), 라우트에서 `parseOrThrow(recommendationsRequestSchema, body)`로 검증한다. 검증 실패 시 `parseOrThrow`가 `ServiceError('VALIDATION_ERROR', firstMessage)` throw → `failFromError`가 400으로 변환.
- **근거**: validation.ts는 본 코드베이스의 **요청 검증 SSOT**(`generateRequestSchema`/`saveRecipeRequestSchema`/`listQuerySchema`가 모두 여기 거주) — 요청 스키마는 이 파일에 모으는 게 기존 컨벤션. 단, 추천 도메인 enum·item·응답 스키마(`recommendationItemSchema`, `recommendationsResponseSchema`, `parseRecommendationItems`)는 AI 어댑터가 import하므로 신규 도메인 파일 `src/lib/ai/recommendation-schema.ts`에 두고, validation.ts의 요청 스키마는 거기서 `recommendationThemeSchema`를 import해 조합한다(중복 정의 회피, 단일 enum SSOT).
- **enum SSOT**: `SITUATION_KEYS=['lunch','dinner','midnight','gathering','solo','special']`, `WEATHER_KEYS=['hot','cold','rainy','sunny','chilly']` — 미니앱 zod와 **정확히 동일 순서·값**. refine: `situation || weather` 최소 1개.

### D-R10 — 에러 코드 매핑(기존 ApiErrorCode 카탈로그 + ServiceError + failFromError 재사용)
- **결정**: 신규 에러 코드 0. 매핑(미니앱 §3.8.4와 1:1):
  - 검증 실패 → `ServiceError('VALIDATION_ERROR')` → 400.
  - 인증 실패 → `ServiceError('UNAUTHORIZED')` → 401.
  - AI 레이트 → `ServiceError('AI_RATE_LIMITED')` → 429.
  - AI Provider/shape 실패 → `ServiceError('AI_PROVIDER_ERROR')` → 502.
  - 기타 → `INTERNAL_ERROR` → 500.
  - (선택) 사용자 매핑 실패 → `ServiceError('INTERNAL_ERROR')`(현 resolver 동작) — DB_ERROR(503)는 미니앱 §3.8.4의 "선택적" 항목이라 백엔드는 현 resolver의 INTERNAL_ERROR를 유지.
- **중요(실측 정정):** `ServiceError` 생성자는 `(code: ApiErrorCode, message: string, cause?: unknown)`이다. **HTTP 상태 코드를 생성자 인자로 받지 않는다.** 상태는 `src/lib/api-response.ts`의 `STATUS_BY_CODE` 맵이 code로부터 도출한다. 따라서 `new ServiceError('AI_PROVIDER_ERROR', msg)`처럼 호출하고, AI 어댑터는 `AIProviderError(kind, msg)`를 throw하면 서비스의 `toServiceError`가 `kind→code`로 매핑한다(`recipe-generation.service.ts` 패턴 그대로). `'AI_ERROR'`라는 코드는 **존재하지 않는다**.
- **시행 검증**: 미니앱 `ApiClientError` 카탈로그가 이 코드들을 한국어로 매핑(미니앱 책임). 백엔드는 code·상태·shape만 정확히 반환.

## meta.generatedAt / meta.theme 생성 위치

- 응답 `data.meta.theme`는 **요청 theme를 그대로 echo**(검증 통과·정규화 값), `data.meta.generatedAt`은 **서버에서 `new Date().toISOString()`**으로 생성한다. AI는 items만 생성(meta 비관여).
- 조립 위치: `RecommendationService.recommend()` — Provider는 items만 반환, 서비스가 `{ items, meta: { theme, generatedAt } }`로 조립(SRP). 미니앱 `recommendationsMetaSchema`(`generatedAt: z.string()`)와 정합.

## 시행 결과 (백엔드 인계 — recipe-backend 구현 명세)

상세 파일별 명세·시그니처·프롬프트 지침은 `_workspace/01_architect_baseline.md` §3 참조.

| 산출 | 위치 | 신규/변경 |
|------|------|----------|
| 라우트 | `src/app/api/recommendations/route.ts` | 신규 |
| 서비스 | `src/services/recommendation.service.ts` | 신규 |
| Provider 인터페이스 + AIProviderError 재사용 | `src/lib/ai/ai-recommendation-provider.ts` | 신규 |
| Gemini 구현 | `src/lib/ai/gemini-recommendation-provider.ts` | 신규 |
| Claude 구현 | `src/lib/ai/claude-recommendation-provider.ts` | 신규 |
| Provider Factory | `src/lib/ai/ai-recommendation-provider.factory.ts` | 신규 |
| 프롬프트 빌더(system + user) | `src/lib/ai/prompts/recommendation-prompt-factory.ts` | 신규 |
| Gemini responseSchema | `src/lib/ai/prompts/recommendation-response-schema.ts` | 신규 |
| Claude tool 정의 | `src/lib/ai/prompts/recommendation-tool-schema.ts` | 신규 |
| 도메인 zod(enum·item·응답) + parse | `src/lib/ai/recommendation-schema.ts` | 신규 |
| 요청 zod(theme) | `src/lib/validation.ts` (확장) | 변경 |
| Composition Root | `src/lib/composition.ts` (확장) | 변경 |
| 공유 타입 re-export | `src/types/api.ts` (확장) | 변경 |
| 모듈 문서 | 관련 `AGENTS.md` 행 추가 | 변경 |
| API 문서 | `docs/api/recommendations.md` | 신규 |

## 롤백 시나리오

- **R1 — 인증 정책 변경(보호 → 공개)**: 미니앱 ADR-016 R1과 연동. D-R5 supersede + 라우트에서 `requireUser` 제거 + 03-API-CONTRACT §3.8 인증 표 갱신. 양 저장소 동시.
- **R2 — 스트리밍 추가**: D-R7 supersede. SSE 도입(`src/lib/sse.ts` 재사용) + 미니앱 R2 연동. 별 ADR.
- **R3 — 추천 개수 가변(5 → min/max)**: D-R4 supersede. 백엔드 zod `.length(5)` → `.min(n).max(m)` + Gemini/Claude 스키마 + 미니앱 zod 동시 완화. 별 ADR.
- **R4 — 추천 로깅/개인화 도입**: D-R8 supersede. `recommendation_logs` 테이블 + 리포지토리 + 마이그레이션 신설. 별 ADR.

## 관련 문서

- 입력: `_workspace/00_input/requirements.md` (Sprint 1 MVP — 추천은 Sprint 2 항목이나 미니앱 선행으로 백엔드 인계)
- baseline: `_workspace/01_architect_baseline.md`
- 미니앱 SSOT: `airecipe-miniapp/docs/adr/ADR-016-recommendations.md`, `airecipe-miniapp/docs/appsintoss-port/03-API-CONTRACT.md §3.8`, `airecipe-miniapp/src/lib/zod/recommendations.ts`
