# src/repositories/ — 데이터 접근 (Repository 패턴)

Supabase CRUD를 추상 인터페이스 뒤로 격리하는 계층 (ADR-001).

## 책임
recipes 테이블 접근. Service는 `RecipeRepository` 인터페이스에만 의존하고 Supabase를 모른다(DIP). 테스트에서 Fake 주입 가능.

## 핵심 규약
- **snake_case ↔ camelCase 변환은 직접 하지 않고 `src/mappers/recipe-mapper.ts`에 위임.** Repository는 row를 받아 Mapper로 DTO 변환.
- **소유자 격리(이중 방어)**: 모든 쿼리에 `.eq("user_id", userId)` + DB의 RLS 정책.
- **Supabase 오류는 `RepositoryError`로 변환.** Service가 `DB_ERROR`로 매핑.
- API DTO에 `user_id`를 노출하지 않는다(Mapper의 `rowToRecipe`가 제외).

## 진입점/주요 파일
| 파일 | 역할 |
|------|------|
| `recipe.repository.ts` | `RecipeRepository` 인터페이스 + `RepositoryError` + 입출력 타입 |
| `supabase-recipe.repository.ts` | Supabase 구현체 |

## 주의
- 클라이언트는 요청별 세션 클라이언트(`src/lib/supabase/server.ts`)를 주입받아 RLS가 `auth.uid()`를 인식하게 한다 — 조립은 `src/lib/composition.ts`.
- 목록은 `range()`로 페이지네이션 + `count: "exact"`로 total 산출.
