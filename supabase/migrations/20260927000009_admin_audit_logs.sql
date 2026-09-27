-- 관리자 작업 기록(개인정보의 안전성 확보조치 기준: 개인정보처리시스템 접속기록 보관).
-- 관리 화면을 열거나 사용자를 정지·삭제할 때마다 서버(service role)가 한 줄씩 남긴다.
-- 사용자는 읽을 수도 쓸 수도 없고, 수정·삭제 경로도 두지 않는다(보관 기간: 최소 1년).
-- 계정이 지워져도 기록은 남도록 auth.users를 참조하지 않는다.

create table if not exists public.admin_audit_logs (
  id         bigint generated always as identity primary key,
  admin_id   uuid not null,
  action     text not null check (action in ('view_admin', 'ban_user', 'unban_user', 'delete_user')),
  target_id  uuid,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from anon, authenticated;
grant select, insert on public.admin_audit_logs to service_role;
