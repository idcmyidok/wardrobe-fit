-- 14단계 보안 검토: 링크 분석 기록(product_imports)은 사용자가 고치거나 지울 수 없게 한다.
-- 지울 수 있으면 하루 30회 제한을 스스로 초기화할 수 있고, 고칠 수 있으면 이미지 미리보기가 받아 올 주소를 바꿀 수 있다.
-- 기록은 서버(/api/imports)가 사용자 세션으로 insert만 한다. 계정을 지우면 FK cascade로 함께 지워진다.

drop policy if exists "product_imports_update_own" on public.product_imports;
drop policy if exists "product_imports_delete_own" on public.product_imports;

-- Security Advisor 경고: 대시보드의 "RLS 자동 켜기"가 만든 event trigger 함수가 /rest/v1/rpc로 노출된다.
-- 마이그레이션이 만든 함수가 아니어서 있을 때만 막는다(로컬 스택에는 없다).
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
