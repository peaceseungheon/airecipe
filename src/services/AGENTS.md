# src/services/ — 비즈니스 로직 (유스케이스)

프레임워크·SDK에 독립적인 도메인 로직 계층. Route Handler가 호출하고, Repository/AIProvider 추상에 의존한다(DIP).

## 책임
- `RecipeGenerationService` (Facade, ADR-002): "레시피 생성" = AI 생성 + 영양 분석을 단일 진입점으로. `AIRecipeProvider`에만 의존.
- `RecipeService`: 영속성 유스케이스(목록/저장/즐겨찾기/삭제). `RecipeRepository`에만 의존.

## 핵심 규약
- **Next.js/Supabase/Anthropic을 직접 import하지 않는다.** 추상(Repository/AIProvider 인터페이스)에만 의존.
- **하위 계층 오류를 `ServiceError(ApiErrorCode)`로 변환한다.** Route는 ServiceError의 code로 HTTP 상태를 결정(`src/lib/api-response.ts`).
  - `AIProviderError(rate_limited)` → `AI_RATE_LIMITED`, `(provider_error)` → `AI_PROVIDER_ERROR`
  - `RepositoryError` → `DB_ERROR`
  - 미존재/타인 소유 → `NOT_FOUND` (RLS + user_id 스코프로 존재 은닉)
- **소유자 격리**: 즐겨찾기/삭제 전 `findById(userId, id)`로 확인. 없으면 NOT_FOUND.

## 진입점/주요 파일
| 파일 | 역할 |
|------|------|
| `recipe-generation.service.ts` | AI 생성 Facade (generate / generateStream) |
| `recipe.service.ts` | 영속성 (list / save / setFavorite / delete) |
| `service-error.ts` | `ServiceError`(code: ApiErrorCode) |

## 주의
- Service는 응답 래핑(`{data}`)을 모른다 — 래핑은 Route(`api-response.ts`) 책임.
- 의존성 조립은 `src/lib/composition.ts`에서. Service는 생성자 주입만 받는다.
