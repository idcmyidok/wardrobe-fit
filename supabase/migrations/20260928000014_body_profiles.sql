-- 내 치수(신체치수)와 옷별 "내 핏" 표기. src/lib/constants/body.ts, src/lib/fit/body-fit.ts와 같아야 한다.
-- 신체치수는 모두 선택 입력이고, 별도 동의(개인정보 보호법 제15조·제22조)를 받은 뒤에만 저장한다.
-- 본인만 읽고 쓸 수 있고, 관리 화면·AI·판단 기록에는 쓰지 않는다. 계정을 지우면 함께 지워진다.
-- 여러 번 실행해도 결과가 같다.

-- 1) 내 치수: 사용자당 한 행. cm(몸무게 kg), 소수 한 자리
create table if not exists public.body_profiles (
  user_id         uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  height_cm       numeric(4,1) check (height_cm   between 100 and 230),
  weight_kg       numeric(4,1) check (weight_kg   between 25  and 250),
  shoulder_cm     numeric(4,1) check (shoulder_cm between 25  and 70),
  chest_cm        numeric(4,1) check (chest_cm    between 50  and 180),
  arm_cm          numeric(4,1) check (arm_cm      between 35  and 90),
  waist_cm        numeric(4,1) check (waist_cm    between 40  and 180),
  hip_cm          numeric(4,1) check (hip_cm      between 50  and 180),
  thigh_cm        numeric(4,1) check (thigh_cm    between 25  and 100),
  leg_cm          numeric(4,1) check (leg_cm      between 50  and 130),
  -- "정확하지 않아요"로 표시한 항목(위 칸 이름에서 _cm/_kg을 뺀 키)
  uncertain       text[] not null default '{}'
    check (uncertain <@ array['height','weight','shoulder','chest','arm','waist','hip','thigh','leg']::text[]),
  -- 사용자가 고친 추천 치수. {"묶음": {"핏": {"치수": [최소, 최대]}}}
  fit_overrides   jsonb not null default '{}'::jsonb
    check (jsonb_typeof(fit_overrides) = 'object' and pg_column_size(fit_overrides) < 16384),
  consent_version text not null check (char_length(consent_version) <= 20),
  consented_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists body_profiles_updated_at on public.body_profiles;
create trigger body_profiles_updated_at before update on public.body_profiles
  for each row execute function public.set_updated_at();

alter table public.body_profiles enable row level security;

drop policy if exists "body_profiles_select_own" on public.body_profiles;
drop policy if exists "body_profiles_insert_own" on public.body_profiles;
drop policy if exists "body_profiles_update_own" on public.body_profiles;
drop policy if exists "body_profiles_delete_own" on public.body_profiles;
create policy "body_profiles_select_own" on public.body_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "body_profiles_insert_own" on public.body_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "body_profiles_update_own" on public.body_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "body_profiles_delete_own" on public.body_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.body_profiles from anon;

-- 2) 옷마다 "내 핏" 표기(모자·신발 제외). 없으면 화면이 예상 핏을 계산해 보여 준다.
alter table public.garments
  add column if not exists user_fit text
    check (user_fit in ('too_small', 'slim', 'regular', 'semi_over', 'over', 'too_big'));
alter table public.garments drop constraint if exists garments_user_fit_clothes_only;
alter table public.garments add constraint garments_user_fit_clothes_only
  check (user_fit is null or category_id in ('outer', 'top', 'bottom'));
