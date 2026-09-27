-- 관리자 페이지(/admin): 관리자 목록과 통계용 함수.
--
-- 관리자는 profiles의 칸이 아니라 별도 테이블로 둔다. profiles는 본인이 수정할 수 있어서
-- 거기에 is_admin을 두면 누구나 스스로 관리자가 될 수 있다.
-- admins는 본인 행이 있는지만 읽을 수 있고, 추가·삭제는 SQL Editor(운영자)에서만 한다:
--   insert into public.admins (user_id) select id from auth.users where email = '관리자 이메일';
--
-- 다른 사용자의 데이터는 RLS가 막으므로, 관리자 화면은 관리자 확인을 마친 서버 코드에서만
-- service role로 아래 함수를 부른다. 함수는 service_role만 실행할 수 있다.

create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
create policy "admins_select_self" on public.admins for select to authenticated
  using ((select auth.uid()) = user_id);

-- 전체 통계. 기간은 최근 24시간·7일(하루 제한과 같은 기준).
create or replace function public.admin_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'users_total',        (select count(*) from auth.users),
    'users_7d',           (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_banned',       (select count(*) from auth.users where banned_until > now()),
    'garments_total',     (select count(*) from public.garments where deleted_at is null),
    'garments_7d',        (select count(*) from public.garments where deleted_at is null and created_at > now() - interval '7 days'),
    'fit_checks_24h',     (select count(*) from public.fit_checks where created_at > now() - interval '24 hours'),
    'fit_checks_7d',      (select count(*) from public.fit_checks where created_at > now() - interval '7 days'),
    'ai_calls_24h',       (select count(*) from public.fit_checks where created_at > now() - interval '24 hours'
                             and ai_model is not null and ai_model not like '%:cache'),
    'ai_calls_7d',        (select count(*) from public.fit_checks where created_at > now() - interval '7 days'
                             and ai_model is not null and ai_model not like '%:cache'),
    'ai_limited_7d',      (select count(*) from public.fit_checks where created_at > now() - interval '7 days'
                             and error_code = 'ai_limited'),
    'imports_7d',         (select count(*) from public.product_imports where created_at > now() - interval '7 days'),
    'imports_failed_7d',  (select count(*) from public.product_imports where created_at > now() - interval '7 days'
                             and status = 'failed')
  );
$$;

-- 최근 7일 링크 분석 실패를 쇼핑몰·원인별로 묶는다.
create or replace function public.admin_import_failures()
returns table (domain text, error_code text, failures bigint, last_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.domain, coalesce(p.error_code, 'unknown'), count(*), max(p.created_at)
  from public.product_imports p
  where p.status = 'failed' and p.created_at > now() - interval '7 days'
  group by 1, 2
  order by 3 desc, 4 desc
  limit 20;
$$;

-- 사용자 목록 한 페이지에 붙일 사용자별 숫자.
create or replace function public.admin_user_counts(p_user_ids uuid[])
returns table (user_id uuid, garments bigint, fit_checks bigint, imports bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
    (select count(*) from public.garments g where g.user_id = u.id and g.deleted_at is null),
    (select count(*) from public.fit_checks f where f.user_id = u.id),
    (select count(*) from public.product_imports p where p.user_id = u.id)
  from unnest(p_user_ids) as u(id);
$$;

revoke execute on function public.admin_stats() from public, anon, authenticated;
revoke execute on function public.admin_import_failures() from public, anon, authenticated;
revoke execute on function public.admin_user_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;
grant execute on function public.admin_import_failures() to service_role;
grant execute on function public.admin_user_counts(uuid[]) to service_role;
