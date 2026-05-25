-- 0002_profiles_toss_mapping — 옵션 P (ADR-010) 적용
-- 변경:
--   1) public.profiles 신설 (미니앱 Toss userId hash → internal_user_id uuid 매핑)
--   2) public.recipes.user_id 의 FK(auth.users) 제거 — 두 출처 uuid 공존을 위함 (ADR-010 D2)
--   3) profiles RLS — 클라이언트(anon/authenticated) 전면 차단, service-role 만 허용
--
-- 적용:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_profiles_toss_mapping.sql
--   또는 Supabase Studio SQL Editor 에 붙여넣기.
--
-- idempotent 보장: 모든 DDL 에 if (not) exists / if exists 사용.

-- ── 1) profiles 테이블 ─────────────────────────────────────────────
create table if not exists public.profiles (
  internal_user_id uuid primary key default gen_random_uuid(),
  toss_user_id     text unique not null,
  created_at       timestamptz not null default now()
);

create index if not exists profiles_toss_user_id_idx
  on public.profiles(toss_user_id);

-- ── 2) recipes.user_id FK 제거 (ADR-010 D2) ────────────────────────
-- auth.users(id) 참조를 끊어 미니앱 사용자(profiles.internal_user_id) 도
-- 같은 컬럼에 담을 수 있게 한다. cascade delete 손실은 ADR-010 D2 트레이드오프.
alter table public.recipes
  drop constraint if exists recipes_user_id_fkey;

-- ── 3) profiles RLS — service-role 만 접근 가능 ────────────────────
-- 클라이언트(anon / authenticated) 는 정책이 없으므로 RLS 활성화만으로
-- 모든 접근이 거부된다(deny-by-default). service-role 은 RLS 우회.
alter table public.profiles enable row level security;

-- 명시적 deny 정책은 불필요(정책 0개 + RLS on = 전면 차단). 다만 의도를
-- 코드 리뷰에서 즉시 읽히도록 빈 정책 자리만 주석으로 남긴다.
-- (no policies on purpose — service-role bypasses RLS, clients are denied)
