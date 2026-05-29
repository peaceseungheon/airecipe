-- AIReceipe — Supabase 스키마 (Sprint 1)
-- 출처: _workspace/01_architect_architecture.md 5절
-- 매핑 규칙: 최상위 컬럼은 snake_case → API DTO는 camelCase (src/mappers/recipe-mapper.ts).
--           jsonb 컬럼(ingredients/steps/nutrition)은 camelCase로 저장하여 매핑 부담 최소화.
--
-- 적용:
--   psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--   또는 Supabase Studio SQL Editor에 붙여넣기.

-- ── 테이블: recipes ──────────────────────────────────────────────
-- NOTE: user_id 의 FK(auth.users(id)) 는 ADR-010 D2(옵션 P) 채택에 따라
--       마이그레이션 0002 에서 제거되었다. 두 출처 uuid 공존(웹앱 auth.users.id /
--       미니앱 profiles.internal_user_id) 을 위함. 격리는 RLS(쿠키 경로) +
--       애플리케이션 .eq('user_id', internalUserId) 필터(헤더 경로) 가 보장한다.
create table if not exists public.recipes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,  -- ADR-010: FK 제거. auth.users.id 또는 profiles.internal_user_id.
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

drop policy if exists "owner_select" on public.recipes;
drop policy if exists "owner_insert" on public.recipes;
drop policy if exists "owner_update" on public.recipes;
drop policy if exists "owner_delete" on public.recipes;

create policy "owner_select" on public.recipes
  for select using (auth.uid() = user_id);

create policy "owner_insert" on public.recipes
  for insert with check (auth.uid() = user_id);

create policy "owner_update" on public.recipes
  for update using (auth.uid() = user_id);

create policy "owner_delete" on public.recipes
  for delete using (auth.uid() = user_id);

-- ── 테이블: profiles (ADR-010 옵션 P) ─────────────────────────────
-- 미니앱(Toss) 사용자의 hex hash 식별자 → 백엔드 내부 uuid 매핑.
-- 쿠키 경로(웹앱) 는 이 테이블을 사용하지 않는다.
-- 접근 모델: service-role 만 허용 (RLS on + 정책 0개 → 클라이언트 deny-by-default).
create table if not exists public.profiles (
  internal_user_id uuid primary key default gen_random_uuid(),
  toss_user_id     text unique not null,
  created_at       timestamptz not null default now()
);

create index if not exists profiles_toss_user_id_idx on public.profiles(toss_user_id);

alter table public.profiles enable row level security;
-- (no policies on purpose — service-role bypasses RLS, clients are denied)
