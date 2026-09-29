-- 테스터 계정: 관리자가 관리자 페이지에서 지정·해제하고, 지정된 계정은 관리자처럼
-- 링크 분석·구매 판단·AI 요약 하루 한도를 받지 않는다.
--
-- admins와 같은 이유로 profiles의 칸이 아니라 별도 테이블로 둔다(본인이 스스로 지정할 수 없게).
-- 사용자는 본인 행이 있는지만 읽을 수 있고, 추가·삭제는 관리자 확인을 마친 서버 코드(service role)만 한다.

create table if not exists public.testers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid,
  created_at timestamptz not null default now()
);
alter table public.testers enable row level security;
revoke all on public.testers from anon, authenticated;
grant select on public.testers to authenticated;
grant select, insert, delete on public.testers to service_role;
drop policy if exists "testers_select_self" on public.testers;
create policy "testers_select_self" on public.testers for select to authenticated
  using ((select auth.uid()) = user_id);

-- 관리자 작업 기록에 테스터 지정·해제를 더한다.
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check
  check (action in ('view_admin', 'ban_user', 'unban_user', 'delete_user', 'grant_tester', 'revoke_tester'));
