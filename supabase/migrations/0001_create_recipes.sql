-- 0001_create_recipes — recipes 테이블 + RLS 정책
-- 동일 내용을 supabase/schema.sql 에도 유지(전체 스키마 단일 뷰).
-- 마이그레이션 적용 순서: 파일명 prefix 번호 순.

create table if not exists public.recipes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  dish_name         text not null,
  description       text not null default '',
  servings          int  not null default 2,
  cook_time_minutes int  not null default 0,
  difficulty        text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  ingredients       jsonb not null default '[]'::jsonb,
  steps             jsonb not null default '[]'::jsonb,
  tips              jsonb not null default '[]'::jsonb,
  nutrition         jsonb not null default '{}'::jsonb,
  is_favorite       boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists recipes_user_id_idx  on public.recipes(user_id);
create index if not exists recipes_user_fav_idx on public.recipes(user_id, is_favorite);

alter table public.recipes enable row level security;

create policy "owner_select" on public.recipes
  for select using (auth.uid() = user_id);
create policy "owner_insert" on public.recipes
  for insert with check (auth.uid() = user_id);
create policy "owner_update" on public.recipes
  for update using (auth.uid() = user_id);
create policy "owner_delete" on public.recipes
  for delete using (auth.uid() = user_id);
