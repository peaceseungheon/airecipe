-- 0003_create_cooking_logs — cooking_logs 테이블 + 인덱스 + RLS
-- 동일 내용을 supabase/schema.sql 에도 유지(전체 스키마 단일 뷰).
-- 마이그레이션 적용 순서: 파일명 prefix 번호 순.
--
-- 요리 기록(cooking_logs). 소유자 격리는 recipes 와 동일(ADR-010 옵션 P):
--   RLS(쿠키 경로 auth.uid()) + 헤더 경로 service-role + .eq('user_id', ...) 필터.
--   user_id 는 두 출처 uuid 공존(웹앱 auth.users.id / 미니앱 profiles.internal_user_id)
--   을 위해 FK 미강제(recipes 0002 선례 동일).
create table if not exists public.cooking_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,                 -- profiles.internal_user_id 또는 auth.users.id
  photo_path       text not null,                 -- R2 객체 키 {user_id}/{id}.{ext}
  recipe           jsonb not null,                -- GeneratedRecipe 스냅샷(camelCase)
  source_recipe_id uuid,                           -- 원본 레시피 참고(생명주기 비결합)
  rating           int not null check (rating between 1 and 5),
  review           text not null,
  created_at       timestamptz not null default now()
);

create index if not exists cooking_logs_user_created_idx
  on public.cooking_logs(user_id, created_at desc);

alter table public.cooking_logs enable row level security;

drop policy if exists "owner_select" on public.cooking_logs;
drop policy if exists "owner_insert" on public.cooking_logs;
drop policy if exists "owner_delete" on public.cooking_logs;

create policy "owner_select" on public.cooking_logs
  for select using (auth.uid() = user_id);
create policy "owner_insert" on public.cooking_logs
  for insert with check (auth.uid() = user_id);
create policy "owner_delete" on public.cooking_logs
  for delete using (auth.uid() = user_id);
-- update 정책은 본 단계 기능(수정 비범위)에 불필요해 생략.
