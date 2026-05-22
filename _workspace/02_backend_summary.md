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
