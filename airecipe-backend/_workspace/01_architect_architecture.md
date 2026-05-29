# 01. 아키텍처 설계 — 레이어/모듈/패턴 결정

> 패턴 선택의 상세 근거는 `docs/adr/`의 ADR 참조. 이 문서는 전체 레이어 지도.

## 1. 레이어드 아키텍처

```
[UI 컴포넌트]  (src/components, src/app/**/page.tsx)
     │  사용자 상호작용
[훅]          (src/hooks/use-*.ts)  ← 공유 타입 import
     │  HTTP (fetch)
─────────────────── 네트워크 경계 ───────────────────
[Route Handler] (src/app/api/**/route.ts)  — 얇게: I/O·검증·인증만
     │
[Service]      (src/services/*.ts)  — 비즈니스 로직 (프레임워크 독립)
     ├──────────────┐
[Repository]   (src/repositories/*.ts)   [AI Provider 추상] (src/lib/ai/ai-recipe-provider.ts)
     │                                          ▲
[Supabase]                              [Claude 어댑터] (src/lib/ai/claude-recipe-provider.ts)
                                                │
                                          [Anthropic SDK]
```

의존성 방향: 항상 안쪽(도메인)을 향한다. Service는 구체 Supabase 클라이언트나 Anthropic SDK가 아니라 **추상(Repository 인터페이스, AIRecipeProvider 인터페이스)** 에 의존한다 (DIP).

## 2. 모듈 경계와 책임 (SRP)

| 디렉토리 | 책임 | 의존 가능 대상 |
|---------|------|--------------|
| `src/app/api/**/route.ts` | HTTP I/O, 입력 검증(zod), 인증 확인, Service 호출 | Service, types, lib/auth |
| `src/services/` | 비즈니스 로직·유스케이스 조합 | Repository 추상, AIProvider 추상, mappers, types |
| `src/repositories/` | 데이터 접근 (Supabase CRUD) | Supabase 클라이언트, mappers, types |
| `src/lib/ai/` | Claude 어댑터 (생성/영양 분석, 프롬프트, 파싱) | Anthropic SDK, types |
| `src/mappers/` | DB row(snake) ↔ DTO(camel) 변환 | types |
| `src/types/` | 공유 타입 (SSOT) | (없음 — 순수 타입) |
| `src/hooks/` | 데이터 페칭/상태 | types, (fetch) |
| `src/components/` | 표현 (presentational) | types, hooks |
| `src/lib/supabase/` | Supabase 클라이언트 팩토리 (server/client) | @supabase/ssr |

## 3. 디자인 패턴 결정 (근거 요약 → 상세는 ADR)

| 패턴 | 적용 위치 | 해결하는 문제 | ADR |
|------|----------|-------------|-----|
| **Repository** | `RecipeRepository` 인터페이스 + `SupabaseRecipeRepository` | 데이터 접근을 Service에서 분리, Supabase 결합 격리, 테스트 시 목 주입 | ADR-001 |
| **Adapter** | `AIRecipeProvider` + `ClaudeRecipeProvider` | Anthropic SDK를 도메인 인터페이스로 격리 (DIP), 모델 교체·테스트 목 주입 | ADR-002 |
| **Facade** | `RecipeGenerationService.generate()` | "레시피 생성" = AI 생성 + 영양 분석을 단일 진입점으로 묶음 | ADR-002 |
| **Factory** | `prompt-factory.ts` `buildRecipePrompt()` | 캐싱 고정부/변수부 분리한 프롬프트 생성 | ADR-002 |
| **DTO/Mapper** | `recipe-mapper.ts` | DB snake_case ↔ API camelCase 변환을 단일 위치로 (경계면 버그 예방) | ADR-001 |
| **Strategy** | (Sprint 1 보류) | 추천/영양 계산 알고리즘 교체 — Sprint 1엔 구현체 1개뿐 → 도입 보류, 확장 지점만 주석 표시 | ADR-002 |

> **오버엔지니어링 회피**: Strategy는 Sprint 1에서 영양 분석 경로가 LLM 추정 하나뿐이므로 도입하지 않는다(YAGNI). `AIRecipeProvider.analyzeNutrition`에 확장 지점만 남긴다. 두 번째 경로(재료 DB 계산)가 생기면 Strategy로 추상화 — Sprint 2 재검토.

## 4. AI 통합 설계 (요약)
- `ClaudeRecipeProvider`가 Anthropic SDK를 격리. Service는 SDK를 모름.
- tool use(`emit_recipe`)로 구조화 JSON 강제 → `input_schema` 필드명 = `GeneratedRecipe` 필드명.
- 시스템 프롬프트 고정부에 `cache_control: ephemeral` → 비용 절감 (Factory로 고정/변수부 분리).
- 재시도(429/5xx 지수 백오프 2~3회) + 타임아웃은 어댑터 계층에서.
- API 키는 서버 환경변수만. 스트리밍은 Provider가 청크 콜백으로 노출, Route가 SSE로 변환.

## 5. 데이터 모델 (Supabase)

### 테이블: `recipes`
```sql
create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_name text not null,
  description text not null default '',
  servings int not null default 2,
  cook_time_minutes int not null default 0,
  difficulty text not null default 'medium',  -- 'easy'|'medium'|'hard'
  ingredients jsonb not null default '[]',      -- Ingredient[]
  steps jsonb not null default '[]',            -- RecipeStep[]
  tips jsonb not null default '[]',             -- string[]
  nutrition jsonb not null default '{}',        -- NutritionInfo
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create index recipes_user_id_idx on recipes(user_id);
create index recipes_user_fav_idx on recipes(user_id, is_favorite);
```

### RLS (Row Level Security)
```sql
alter table recipes enable row level security;
-- 소유자만 select/insert/update/delete
create policy "owner_select" on recipes for select using (auth.uid() = user_id);
create policy "owner_insert" on recipes for insert with check (auth.uid() = user_id);
create policy "owner_update" on recipes for update using (auth.uid() = user_id);
create policy "owner_delete" on recipes for delete using (auth.uid() = user_id);
```

> 매핑: DB `dish_name`(snake) ↔ DTO `dishName`(camel). 이 변환은 `recipe-mapper.ts`에만 존재. jsonb 컬럼(ingredients/steps/nutrition)은 이미 camelCase로 저장하여 매핑 부담 최소화 — 단, 최상위 컬럼(dish_name, cook_time_minutes, is_favorite, created_at, user_id)은 snake이므로 Mapper 필수.

## 6. 인증 흐름
- `@supabase/ssr` 기반 서버 클라이언트로 세션 검증.
- `src/lib/supabase/server.ts` (Route/Server Component용), `src/lib/supabase/client.ts` (Client Component용).
- 보호된 Route Handler는 진입부에서 세션 확인 → 없으면 `401 UNAUTHORIZED`.
- 미들웨어(`middleware.ts`)로 `/my-recipes` 등 보호 페이지 가드(선택, frontend 협의).

## 7. 상태 관리 (요약 → ADR-003)
- 서버 상태(레시피 목록/저장): **SWR** — 캐싱·재검증·낙관적 업데이트 지원, 경량.
- 클라이언트 상태(생성 폼/스트리밍 진행): React `useState`/`useReducer`.
- 전역 상태 라이브러리(Redux 등) 미도입 — Sprint 1 규모에 과함(YAGNI).
