# 02. 데이터 모델 — Supabase 스키마·RLS·옵션 P 사용자 식별 매핑

> **이 챕터 전에 알아야 할 것**: [00-OVERVIEW.md](./00-OVERVIEW.md), [01-FEATURES.md](./01-FEATURES.md), [ADR-009](../adr/ADR-009-appsintoss-port-architecture.md).
>
> **이 챕터 완료 후 다음 챕터**: [03-API-CONTRACT.md](./03-API-CONTRACT.md) — 6개 엔드포인트 shape와 인증 헤더.

---

## 2.0 개요

본 챕터는 현재 백엔드의 데이터 모델(`recipes` 테이블 + RLS)을 신규 LLM이 그대로 이해할 수 있도록 인용하고, **앱인토스 포팅의 핵심 변경점**인 **사용자 식별 옵션 P**(profiles 매핑 테이블) 결정을 명시한다.

- 현재 코드는 절대 수정하지 않음 (ADR-009 D4). 본 챕터의 마이그레이션 SQL은 **백엔드 후속 ADR**에서 적용된다.
- 미니앱은 DB에 직접 접근하지 않는다. 모든 접근은 백엔드 6개 엔드포인트 경유 (RLS는 백엔드 컨텍스트).
- 본 챕터는 **백엔드 LLM**(또는 backend 에이전트)이 옵션 P를 구현할 때 사양으로 사용한다.

## 2.1 현재 스키마 (recipes 테이블) — 인용

출처: `supabase/schema.sql` 전문.

```sql
-- ── 테이블: recipes ──────────────────────────────────────────────
create table if not exists public.recipes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  dish_name         text not null,
  description       text not null default '',
  servings          int  not null default 2,
  cook_time_minutes int  not null default 0,
  difficulty        text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  ingredients       jsonb not null default '[]'::jsonb, -- Ingredient[]  (camelCase 저장)
  steps             jsonb not null default '[]'::jsonb, -- RecipeStep[]  (camelCase 저장)
  tips              jsonb not null default '[]'::jsonb, -- string[]
  nutrition         jsonb not null default '{}'::jsonb, -- NutritionInfo (camelCase 저장)
  is_favorite       boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists recipes_user_id_idx  on public.recipes(user_id);
create index if not exists recipes_user_fav_idx on public.recipes(user_id, is_favorite);

-- ── RLS (Row Level Security) — 소유자 격리 (심층 방어) ────────────
alter table public.recipes enable row level security;

create policy "owner_select" on public.recipes for select using (auth.uid() = user_id);
create policy "owner_insert" on public.recipes for insert with check (auth.uid() = user_id);
create policy "owner_update" on public.recipes for update using (auth.uid() = user_id);
create policy "owner_delete" on public.recipes for delete using (auth.uid() = user_id);
```

### 핵심 사실

- `recipes.user_id` 컬럼은 **uuid**이며 `auth.users(id)`를 외래키로 참조한다 — 현재 Supabase Auth 사용자.
- RLS 정책은 `auth.uid() = user_id`로 격리한다 — 현재 Supabase 세션 컨텍스트에서 작동.
- jsonb 컬럼은 내부 키를 camelCase로 저장하여 Mapper 부담을 최소화한다 (ADR-001).

### 컬럼 ↔ DTO 매핑 (ADR-001 인용)

| DB 컬럼 (snake_case) | DTO 필드 (camelCase) | 비고 |
|----------------------|----------------------|------|
| `id` | `id` | 동일 |
| `user_id` | (없음) | **DTO 노출 금지** — 서버 내부 격리용 |
| `dish_name` | `dishName` | 변환 |
| `description` | `description` | 동일 |
| `servings` | `servings` | 동일 |
| `cook_time_minutes` | `cookTimeMinutes` | 변환 |
| `difficulty` | `difficulty` | 동일 |
| `ingredients` (jsonb) | `ingredients` | camelCase 저장됨, 그대로 |
| `steps` (jsonb) | `steps` | camelCase 저장됨, 그대로 |
| `tips` (jsonb) | `tips` | string[], 그대로 |
| `nutrition` (jsonb) | `nutrition` | camelCase 저장됨, 그대로 |
| `is_favorite` | `isFavorite` | 변환 |
| `created_at` | `createdAt` | 변환 (ISO8601 문자열) |

> 매핑은 `src/mappers/recipe-mapper.ts`의 `rowToRecipe()` 단일 함수가 책임진다. 본 포팅에서도 이 함수는 **변경하지 않는다**.

## 2.2 포팅 시 핵심 결정 — 사용자 식별

현재 `recipes.user_id`는 Supabase Auth의 uuid다. 앱인토스 미니앱은 `getAnonymousKey()`로 미니앱별 고유 **hash 문자열**을 받는다. 이 둘을 어떻게 잇는가?

### 옵션 비교

#### 옵션 P — `profiles` 매핑 테이블 추가 (채택)

`profiles` 테이블을 새로 추가하여 `toss_user_id text`(=hash) → `internal_user_id uuid` 매핑을 별도로 관리한다. `recipes.user_id`는 기존 uuid 그대로 유지한다.

```sql
-- 후속 마이그레이션 (백엔드 후속 ADR에서 적용)
create table if not exists public.profiles (
  internal_user_id  uuid primary key default gen_random_uuid(),
  toss_user_id      text unique not null,        -- getAnonymousKey() hash
  created_at        timestamptz not null default now()
);

create index if not exists profiles_toss_user_id_idx on public.profiles(toss_user_id);
```

장점:
- `recipes.user_id` 컬럼·외래키·RLS·인덱스 **무변경**. ADR-001 자산 보존.
- 옵션 Q 대비 모든 ADR(001/005/006/008)이 그대로 살아남는다.
- 웹/미니앱 사용자가 향후 통합되어도 매핑 테이블이 그 다리 역할.
- 새 사용자 첫 호출 시 한 번만 upsert. 이후 호출은 단일 SELECT.

단점:
- 첫 호출마다 매핑 SELECT 1회 추가 (인덱스로 O(log n)).
- 매핑 행을 만들 책임이 백엔드 미들웨어로 이동.

#### 옵션 Q — `recipes.user_id` 컬럼 타입을 text로 마이그레이션

`recipes.user_id`를 uuid → text로 바꾸고 `auth.users` 외래키를 제거. Toss userId(hash)를 그대로 저장.

장점:
- 매핑 테이블 불필요. 한 단계 단순.

단점:
- **ADR-001의 컬럼 매핑 표·`auth.uid() = user_id` RLS 정책이 모두 깨진다**. RLS를 다시 짜야 하며, `auth.uid()`는 Supabase Auth 컨텍스트가 없으면 NULL이라 미니앱 호출에 RLS가 무용지물이 된다.
- 외래키 제거 → `on delete cascade` 보장 상실.
- 마이그레이션 시 기존 웹 사용자 데이터 호환 불가(uuid → text 강제 변환의 의미가 없음).
- `recipes_user_id_idx`·`recipes_user_fav_idx`는 재생성 가능하지만 ADR-001의 매핑 표·QA 단언 모두 수정 필요.

### 채택: 옵션 P

ADR-009 D5에 명시. 사유 요약:

> 옵션 Q는 현재 ADR-001의 RLS·외래키·매핑 표 전체를 무너뜨린다. 옵션 P는 **추가만** 한다(매핑 테이블 + 백엔드 식별자 변환 미들웨어 + 새 RLS for `profiles`). ADR-001/005/006/008 모두 살아남는다.

## 2.3 옵션 P 적용 — 마이그레이션 SQL 스케치

> **주의**: 본 SQL은 **백엔드 후속 ADR**(예: ADR-010)에서 적용된다. 현재 코드 수정은 본 포팅 작업의 범위 외다(ADR-009 D4).

### 2.3.1 새 테이블

```sql
-- supabase/migrations/{timestamp}_add_profiles.sql (가칭)

create table if not exists public.profiles (
  internal_user_id  uuid primary key default gen_random_uuid(),
  toss_user_id      text unique not null,
  created_at        timestamptz not null default now()
);

create index if not exists profiles_toss_user_id_idx on public.profiles(toss_user_id);

-- RLS: profiles는 백엔드 service role만 접근 (미니앱은 직접 접근 안 함)
alter table public.profiles enable row level security;

-- 기본은 모두 거부. service role(server-side)만 우회.
-- (anon/authenticated 클라이언트의 직접 접근을 차단)
create policy "deny_all_select_profiles" on public.profiles for select using (false);
create policy "deny_all_insert_profiles" on public.profiles for insert with check (false);
create policy "deny_all_update_profiles" on public.profiles for update using (false);
create policy "deny_all_delete_profiles" on public.profiles for delete using (false);
```

### 2.3.2 기존 recipes RLS는 그대로 유지

옵션 P는 `recipes.user_id`(uuid)와 RLS를 건드리지 않는다. **단**, 미니앱 호출은 Supabase Auth 세션이 없으므로 `auth.uid()`가 NULL이 되어 기존 RLS만으로는 통과하지 못한다. 이를 해결하는 두 가지 방법:

#### 방법 A — 백엔드가 service role 클라이언트로 우회 (권장)

미니앱 호출 경로의 백엔드는 service role Supabase 클라이언트를 사용해 RLS를 우회하고, **애플리케이션 레벨에서 `user_id` 스코프**를 강제한다.

- 웹 경로(현재 — Supabase Auth 세션): RLS + 애플리케이션 user_id 스코프 = 이중 방어 (ADR-001 그대로).
- 미니앱 경로(신규 — Toss 식별): service role + **애플리케이션 user_id 스코프 필수** (RLS는 통과하지만 격리는 코드가 책임).

이 방법은 ADR-001의 "RLS 이중 방어"가 미니앱 경로에서는 "단일 방어(애플리케이션)"로 약화된다. 트레이드오프이며, 백엔드 후속 ADR에서 보강 방안을 함께 결정한다.

#### 방법 B — Supabase Auth에 익명 사용자 생성 (대안)

미니앱 첫 호출 시 백엔드가 Supabase `auth.admin.createUser({ email: synthetic })`로 익명 사용자를 만들고, 그 uuid를 `internal_user_id`로 사용. 이후 호출 시 해당 사용자로 sign-in JWT를 생성해 RLS 컨텍스트를 활성화.

- 장점: RLS 이중 방어 유지.
- 단점: 가짜 이메일/익명 사용자가 `auth.users`에 누적. Supabase 익명 인증 정책 의존. 토큰 발급 라이프사이클 추가.

> 백엔드 후속 ADR에서 A/B 중 채택을 확정한다. 본 챕터는 **옵션 P 매핑 자체**가 결정이며, A/B는 옵션 P의 구현 디테일이다. 미니앱 LLM은 자세히 알 필요 없음 — "백엔드가 알아서 처리, 미니앱은 `X-Toss-User-Id` 헤더만 보내라"가 미니앱 LLM의 시야다.

### 2.3.3 백엔드 미들웨어 (의사 코드)

```ts
// src/lib/auth/toss-user.ts (가칭, 백엔드 후속 ADR에서 추가)

import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';

const HEADER_NAME = 'x-toss-user-id';
const tossUserIdSchema = z.string().min(8).max(256);

export async function resolveInternalUserId(req: Request): Promise<string | null> {
  const tossUserId = req.headers.get(HEADER_NAME);
  if (!tossUserId) return null;

  const parsed = tossUserIdSchema.safeParse(tossUserId);
  if (!parsed.success) return null;

  const supabase = createServiceRoleClient();

  // upsert: 존재하면 기존 internal_user_id 반환, 없으면 새로 생성.
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { toss_user_id: parsed.data },
      { onConflict: 'toss_user_id', ignoreDuplicates: false }
    )
    .select('internal_user_id')
    .single();

  if (error) throw error;
  return data.internal_user_id;
}
```

보호된 엔드포인트(GET/POST/PATCH/DELETE /api/recipes*)는 진입부에서:

1. Supabase Auth 세션 확인 (현재 웹 경로) → 있으면 uuid 사용.
2. 없으면 `X-Toss-User-Id` 헤더 → `resolveInternalUserId()` → uuid 획득.
3. 둘 다 없으면 401.

이 미들웨어 결과인 `internal_user_id`는 기존 코드가 사용하는 `user.id`(uuid) 자리에 그대로 들어간다 → **Repository·Service·Mapper 무변경**.

상세 흐름은 [05-AUTH.md](./05-AUTH.md).

## 2.4 미니앱이 알아야 하는 것 (요약 한 화면)

미니앱 LLM은 DB·RLS·옵션 P 디테일을 알 필요가 없다. 미니앱이 따라야 할 규칙은:

| 규칙 | 내용 |
|------|------|
| 식별자 획득 | 진입 시 `getAnonymousKey()` 호출하여 hash 보관 (메모리 또는 SecureStore) |
| 호출 헤더 | 보호 엔드포인트 모든 호출에 `X-Toss-User-Id: <hash>` 추가 |
| 공개 엔드포인트 | `POST /api/recipes/generate`(비스트림/스트림)는 헤더 생략 가능 |
| 401 시 | 식별자 재발급(`getAnonymousKey()` 재호출) 후 1회 재시도 |
| 사용자 식별 노출 | 미니앱 UI에는 hash를 표시하지 않음 (사용자에겐 의미 없는 값) |

## 2.5 RLS 정책 재설계 가이드 (백엔드 후속 ADR용 체크리스트)

옵션 P 채택 시 백엔드가 점검해야 할 항목:

- [ ] `profiles` 테이블 추가 + 인덱스 + RLS 거부 정책 (위 2.3.1).
- [ ] service role 클라이언트 사용 경로(방법 A) 또는 익명 Auth 사용자(방법 B) 결정.
- [ ] 미들웨어 `resolveInternalUserId()` 추가 — 헤더 우선순위와 zod 검증.
- [ ] 모든 보호 라우트 핸들러가 미들웨어 통과 후 `user_id`(internal uuid) 사용하도록 통일.
- [ ] **애플리케이션 레벨 `user_id` 스코프는 반드시 유지** — 방법 A 채택 시 service role이 RLS를 우회하므로 코드가 격리의 단일 책임.
- [ ] QA: 두 명의 서로 다른 Toss 식별자로 동일 API 호출 시 데이터가 섞이지 않는지 통합 테스트.
- [ ] ADR-005(소유권 위반 404 수렴) 정책은 그대로 — 본인 것 아니면 404.

## 2.6 SSOT 참조

- 스키마: `supabase/schema.sql`
- 마이그레이션 디렉토리: `supabase/migrations/` (옵션 P 마이그레이션은 백엔드 후속 ADR에서 추가)
- ADR-001 (Supabase + RLS + Mapper)
- ADR-005 (소유권 404)
- ADR-009 (포팅 아키텍처, D5 옵션 P 채택 확정)
- Mapper: `src/mappers/recipe-mapper.ts` — 본 포팅에서 무변경
- 본 챕터의 후속 인증 흐름 디테일: [05-AUTH.md](./05-AUTH.md)
