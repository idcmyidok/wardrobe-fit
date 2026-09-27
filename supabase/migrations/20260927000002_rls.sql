-- 4단계: RLS (PROJECT_SPEC.md 11장). 모든 사용자 테이블은 본인 행만 읽고 쓸 수 있다.

alter table public.categories             enable row level security;
alter table public.subcategories          enable row level security;
alter table public.profiles               enable row level security;
alter table public.product_imports        enable row level security;
alter table public.garments               enable row level security;
alter table public.garment_review_signals enable row level security;
alter table public.fit_checks             enable row level security;
alter table public.fit_check_comparables  enable row level security;

-- anon에는 어떤 테이블 권한도 주지 않는다.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- 참조 테이블: 로그인 사용자 읽기 전용
revoke insert, update, delete, truncate on public.categories, public.subcategories from authenticated;
create policy "categories_select" on public.categories for select to authenticated using (true);
create policy "subcategories_select" on public.subcategories for select to authenticated using (true);

-- profiles: 가입 trigger가 만들고, 본인은 읽기·수정만
create policy "profiles_select_own" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 본인 소유 4개 정책을 반복한다.
do $$
declare t text;
begin
  foreach t in array array['product_imports', 'garments', 'garment_review_signals', 'fit_checks', 'fit_check_comparables'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- insert: 본인 행이고, 참조하는 행도 본인 것이어야 한다.
create policy "product_imports_insert_own" on public.product_imports for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "garments_insert_own" on public.garments for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "garment_review_signals_insert_own" on public.garment_review_signals for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.garments g where g.id = garment_id and g.user_id = (select auth.uid()))
  );

create policy "fit_checks_insert_own" on public.fit_checks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (import_id is null or exists (
      select 1 from public.product_imports p where p.id = import_id and p.user_id = (select auth.uid())))
  );

create policy "fit_check_comparables_insert_own" on public.fit_check_comparables for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.fit_checks f where f.id = fit_check_id and f.user_id = (select auth.uid()))
    and exists (select 1 from public.garments g where g.id = garment_id and g.user_id = (select auth.uid()))
  );

-- update로 다른 사용자의 행을 가리키게 바꾸는 것도 막는다.
drop policy "garment_review_signals_update_own" on public.garment_review_signals;
create policy "garment_review_signals_update_own" on public.garment_review_signals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.garments g where g.id = garment_id and g.user_id = (select auth.uid()))
  );

drop policy "fit_checks_update_own" on public.fit_checks;
create policy "fit_checks_update_own" on public.fit_checks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (import_id is null or exists (
      select 1 from public.product_imports p where p.id = import_id and p.user_id = (select auth.uid())))
  );

drop policy "fit_check_comparables_update_own" on public.fit_check_comparables;
create policy "fit_check_comparables_update_own" on public.fit_check_comparables for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.fit_checks f where f.id = fit_check_id and f.user_id = (select auth.uid()))
    and exists (select 1 from public.garments g where g.id = garment_id and g.user_id = (select auth.uid()))
  );

-- trigger 전용 함수는 API(RPC)로 부를 수 없게 한다.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_garment_refs() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
