-- AIReceipe — Supabase 스키마 (Sprint 1)
-- 출처: _workspace/01_architect_architecture.md 5절
-- 매핑 규칙: 최상위 컬럼은 snake_case → API DTO는 camelCase (src/mappers/recipe-mapper.ts).
--           jsonb 컬럼(ingredients/steps/nutrition)은 camelCase로 저장하여 매핑 부담 최소화.
--
-- 적용:
--   psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--   또는 Supabase Studio SQL Editor에 붙여넣기.

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
