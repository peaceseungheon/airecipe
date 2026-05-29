# 02. 백엔드 구현 요약 (Sprint 1)

> 계약 SSOT: `_workspace/01_architect_api_contract.md`. 공유 타입: `@/types`. 패턴 근거: `docs/adr/`.
> 백엔드 파일 `tsc --noEmit` 통과(clean). 전체 `npm run build`는 프론트 deps 설치 후 가능.

## 1. 구현 엔드포인트 (6개)

| Method | Path | 인증 | 요청 | 응답 | 비고 |
|--------|------|------|------|------|------|
| POST | `/api/recipes/generate` | 공개 | `GenerateRecipeRequest` | JSON `{data: GeneratedRecipe}` 또는 SSE(`StreamChunk`) | stream 플래그로 분기 |
| GET | `/api/recipes` | 필요 | query(favorite/page/pageSize) | `{data: Recipe[], meta}` | 빈 목록 200 |
| GET | `/api/recipes/[id]` | 필요 | (none) | `{data: Recipe}` | ADR-004 추가 |
| POST | `/api/recipes` | 필요 | `SaveRecipeRequest` | 201 `{data: Recipe}` | |
| PATCH | `/api/recipes/[id]/favorite` | 필요 | `ToggleFavoriteRequest` | `{data: Recipe}` | 멱등(목표값 명시) |
| DELETE | `/api/recipes/[id]` | 필요 | (none) | `{data: {id}}` | 200+id |

모든 성공 응답 `{data, meta?}` 래핑, 에러 `{error:{code,message}}` (ApiErrorCode 8종 ↔ HTTP 상태).

## 2. 레이어/파일 (의존성: 안쪽 도메인 방향)

```
Route(HTTP I/O·검증·인증) → Service(로직) → Repository(데이터) → Supabase
                                  └→ AIRecipeProvider 추상 ← ClaudeRecipeProvider → Anthropic SDK
```

| 계층 | 파일 |
|------|------|
| Route | `src/app/api/recipes/{generate/route.ts, route.ts, [id]/route.ts, [id]/favorite/route.ts}` |
| Service | `src/services/{recipe-generation.service.ts (Facade), recipe.service.ts, service-error.ts}` |
| Repository | `src/repositories/{recipe.repository.ts (인터페이스), supabase-recipe.repository.ts}` |
| Mapper | `src/mappers/recipe-mapper.ts` (snake↔camel 단일 위치, user_id 제외) |
| AI | `src/lib/ai/{ai-recipe-provider.ts (인터페이스), claude-recipe-provider.ts (Adapter), recipe-schema.ts (zod 검증), prompts/{prompt-factory.ts (Factory+캐싱), recipe-tool-schema.ts (emit_recipe)}}` |
| 공통 lib | `src/lib/{api-response.ts (래핑/에러 매핑), auth.ts (requireUser), composition.ts (DI 조립), validation.ts (zod 경계), sse.ts}` |
| Supabase | `src/lib/supabase/{server.ts, client.ts, middleware.ts}` + `src/middleware.ts` |
| DB | `supabase/schema.sql`, `supabase/migrations/0001_create_recipes.sql` |
| 문서 | `docs/api/recipes.md`, 각 디렉토리 `AGENTS.md` |

## 3. 패턴 적용 (ADR 대응)

- **Repository** (ADR-001): `RecipeRepository` 인터페이스 + `SupabaseRecipeRepository`. Service는 추상에만 의존(DIP), Fake 주입 테스트 가능.
- **Adapter** (ADR-002): `AIRecipeProvider` + `ClaudeRecipeProvider`. Anthropic SDK는 어댑터에만 격리.
- **Facade** (ADR-002): `RecipeGenerationService.generate()` = AI 생성 + 영양 분석 단일 진입점.
- **Factory** (ADR-002): `prompt-factory.ts`가 시스템 고정부(캐싱)/사용자 변수부 분리.
- **DTO/Mapper** (ADR-001): `recipe-mapper.ts` 단일 위치 변환.
- **Strategy 보류** (YAGNI): 영양 계산 경로 단일 → 확장 지점만 주석.

## 4. AI 통합 방식

- 모델 기본값 `claude-haiku-4-5-20251001` (비용 최적화, 2026-05-22 변경). `ANTHROPIC_MODEL`로 sonnet/opus 오버라이드 가능.
- tool use(`emit_recipe`) 강제 → 구조화 JSON. input_schema 필드명 = `GeneratedRecipe`.
- AI 출력은 zod(`recipe-schema.ts`)로 경계 검증 — 스키마 불일치는 `AIProviderError(provider_error)`.
- 시스템 프롬프트 고정부 `cache_control: ephemeral` (비용 절감).
- 재시도(maxRetries=2, 429/5xx) + 타임아웃(60s)은 어댑터 계층. 429→`AI_RATE_LIMITED`, 그 외→`AI_PROVIDER_ERROR`.
- 스트리밍: Provider가 text 델타 콜백 노출 → Route가 SSE(meta→text*→recipe→done)로 변환. 에러는 HTTP 200 + error 청크.

## 5. 에러 핸들링 매핑

| 계층 오류 | → ApiErrorCode | HTTP |
|----------|---------------|------|
| `AIProviderError(rate_limited)` | `AI_RATE_LIMITED` | 429 |
| `AIProviderError(provider_error)` | `AI_PROVIDER_ERROR` | 502 |
| `RepositoryError` | `DB_ERROR` | 503 |
| 미인증 | `UNAUTHORIZED` | 401 |
| zod 검증 실패 | `VALIDATION_ERROR` | 400 |
| 미존재/타인 소유 | `NOT_FOUND` | 404 |
| 그 외 | `INTERNAL_ERROR` | 500 |

## 6. 주요 결정 (확정)

- **소유자 격리**: RLS(`auth.uid()=user_id`) + 애플리케이션 user_id 스코프 이중 방어.
- **소유권 위반 → 404 (ADR-005 확정)**: 단건 [id] 엔드포인트(GET/PATCH/DELETE)에서 미존재·타인 소유를 모두 `404 NOT_FOUND`로 수렴. RLS 격리상 타인 행이 빈 결과로 돌아와 403/404 구분 불가 + 존재 은닉(IDOR 정보 누설 방지). `403 FORBIDDEN`은 Sprint 1 미발생(ApiErrorCode 예약 유지). service-role 우회 경로 미도입.
- **pageSize clamp (ADR-006 확정)**: `pageSize>50`은 400 거부가 아니라 50으로 clamp(`Math.min(n,50)`), `meta.pageSize`에 적용값 반환. 비숫자/0/음수는 400. `favorite`는 `z.enum(["true","false"])`(z.coerce.boolean 금지 — "false"를 true로 오인).
- **인증 미들웨어**: `/my-recipes` 미인증 시 `/auth/login?redirectTo=` 리다이렉트. 보호 API는 401 반환.

## 7. 환경/실행

- 백엔드 deps 설치 완료: `@supabase/supabase-js`, `@supabase/ssr`, `@anthropic-ai/sdk`, `zod`.
- `.env.local.example` 제공 — 실제 값은 `.env.local`(NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY).
- DB 적용: `supabase/schema.sql`을 Supabase SQL Editor에 실행(또는 migrations).
- `npm run build` 완전 통과는 프론트의 swr/clsx/tailwind-merge 설치 후 가능(현재 백엔드 파일은 tsc clean).

---

## 8. AI Provider 전환 (세션 #3, 2026-05-22)

**변경 요약**: 기본 AI Provider를 Claude → Gemini로 전환. Claude는 비활성 보존(코드·SDK·환경변수 유지)하여 `AI_PROVIDER=claude`로 즉시 롤백 가능.

### 8.1 패턴
- **Factory(ADR-002 확장, ADR-008)**: `AI_PROVIDER` 환경변수로 구현체 선택 (`gemini` 기본 / `claude` 롤백). 그 외 값 → 명시적 `AIProviderError` throw.
- **DIP 유지**: Service는 여전히 `AIRecipeProvider` 추상에만 의존. Factory 도입은 composition 한 줄만 교체.
- **OCP**: 새 Provider 추가 시 Factory에 분기 한 줄만 추가.
- **SDK 격리**: `@google/genai` 런타임 import는 `gemini-recipe-provider.ts`(+ Gemini용 Schema 정의 `prompts/recipe-response-schema.ts`)에만. `@anthropic-ai/sdk` 런타임 import는 `claude-recipe-provider.ts`에만. `prompts/prompt-factory.ts`, `prompts/recipe-tool-schema.ts`의 Anthropic 참조는 `import type` (타입 전용, 런타임 영향 없음 — Claude 롤백 경로 보전).

### 8.2 신규 파일
| 파일 | 역할 |
|------|------|
| `src/lib/ai/gemini-recipe-provider.ts` | `AIRecipeProvider`의 `@google/genai` Adapter. responseMimeType+responseSchema로 JSON 강제, AbortController 60s 타임아웃, ApiError.status=429→`rate_limited`. |
| `src/lib/ai/prompts/recipe-response-schema.ts` | Gemini `responseSchema` (Type enum 기반 Schema). `GeneratedRecipe`/zod와 1:1 일치. |
| `src/lib/ai/ai-recipe-provider.factory.ts` | `AI_PROVIDER` 환경변수→Provider 인스턴스화. composition.ts에서만 호출. |

### 8.3 수정 파일
| 파일 | 변경 |
|------|------|
| `src/lib/composition.ts` | `new ClaudeRecipeProvider()` → `createAIRecipeProvider()`. 지연 싱글턴 게이트 유지. |
| `src/lib/ai/prompts/prompt-factory.ts` | `buildSystemText()` 추가 (Gemini용 평문). `RECIPE_SYSTEM_INSTRUCTIONS`는 두 Provider 공유 SSOT. `buildSystemBlocks()`(Claude 캐싱 블록)·`buildUserPrompt()` 그대로 유지. |
| `src/lib/ai/ai-recipe-provider.ts` | 헤더 주석 갱신 — 두 구현체와 Factory 위치 명시. 인터페이스 시그니처 불변. |
| `package.json` / `package-lock.json` | `@google/genai ^2.6.0` 추가. `@anthropic-ai/sdk ^0.97.1` 유지(롤백 경로). |

### 8.4 비변경 (의도적)
- `src/lib/ai/claude-recipe-provider.ts`, `src/lib/ai/prompts/recipe-tool-schema.ts`, `src/lib/ai/recipe-schema.ts` — Claude 롤백 경로 보전.
- `src/services/recipe-generation.service.ts`, Route Handlers, `service-error.ts` — Provider 추상에만 의존, 변경 불필요(DIP 검증).

### 8.5 환경변수 매트릭스
| 변수 | Gemini 모드 (기본) | Claude 모드 (롤백) |
|------|--------------------|---------------------|
| `AI_PROVIDER` | `gemini` 또는 미설정 | `claude` |
| `GEMINI_API_KEY` | **필수** | (불필요) |
| `GEMINI_MODEL` | 선택 (기본 `gemini-3.1-flash-lite`) | (무시) |
| `ANTHROPIC_API_KEY` | (불필요) | **필수** |
| `ANTHROPIC_MODEL` | (무시) | 선택 (기본 `claude-haiku-4-5-20251001`) |

### 8.6 진입점 / 롤백
- **Factory 진입점**: `src/lib/ai/ai-recipe-provider.factory.ts::createAIRecipeProvider()` — `composition.ts`에서만 호출.
- **롤백 절차**: 배포 환경의 `AI_PROVIDER=claude` 설정 + `ANTHROPIC_API_KEY` 존재 확인 → 재배포. 코드·SDK 변경 불필요.

### 8.7 AI 동작 차이 (운영 주의)
- **구조화 출력 강제 메커니즘 상이**: Claude는 tool use(`emit_recipe`) 강제, Gemini는 `responseMimeType:"application/json"` + `responseSchema`. 두 경로 모두 zod(`recipe-schema.ts`)로 동일 도메인 타입 검증 → 후처리 동일.
- **시스템 지침 SSOT 공유**: `RECIPE_SYSTEM_INSTRUCTIONS` 본문 1개를 두 빌더(`buildSystemBlocks`/`buildSystemText`)가 공유. 본문 변경은 두 Provider 행동을 동시에 바꿈.
- **스트리밍 텍스트 델타**: Gemini는 responseSchema 모드에서 부분 JSON 조각이 텍스트 델타로 흐른다. `onText`에 raw 전달, 최종 1회 파싱으로 안전성 확보. Route SSE 변환 로직은 기존(`text` 청크 그대로 전달) 변경 없음 — 단, 프론트 UX는 부분 JSON 표시가 어색할 수 있어 QA 관찰 필요(아래 8.8 참조).
- **캐싱**: Claude만 ephemeral 캐싱 적용 중. Gemini cachedContents 도입은 YAGNI 유보.
- **재시도**: Claude는 SDK 내장 maxRetries=2 사용. Gemini는 SDK 기본 동작에 의존(명시적 재시도 미설정).

### 8.8 QA 검증 포인트 (다음 단계)
1. `AI_PROVIDER` 미설정 / `gemini` / `claude` / `invalid` 4분기 동작: Factory 분기 + 잘못된 값에서 명시적 `AIProviderError("provider_error")` throw 확인.
2. `GEMINI_API_KEY` 미설정 시 Provider 인스턴스화 단계 throw → `getRecipeGenerationService` 첫 호출 시점에서만 발생(빌드·import는 통과).
3. `/api/recipes/generate` 비스트리밍: Gemini 응답이 `GeneratedRecipe` 필드명·타입과 정확히 일치하는지(zod parse 성공률), 응답 shape 래핑(`{data:...}`)이 기존과 동일한지.
4. `/api/recipes/generate?stream=1` SSE: Gemini 스트리밍 시 `text` 청크가 부분 JSON 조각으로 흐를 때 프론트 표시 UX(현재 Route는 raw 전달). 필요 시 후속 스프린트에서 onText 억제 토글 검토.
5. 에러 매핑: Gemini ApiError.status=429 → `AI_RATE_LIMITED`(429), 기타 SDK 오류 → `AI_PROVIDER_ERROR`(502), AbortController 타임아웃(60s 초과) → `AI_PROVIDER_ERROR`로 수렴되는지.

