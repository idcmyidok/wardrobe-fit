-- 구매 보류 옷 + 달러 가격 + 환율 설정 + 신체치수 암호화 칸(1.2.6). develop에 올리기 "전에" 실행한다(새 코드가 이 칸들을 읽는다).
-- 여러 번 실행해도 결과가 같다.

-- 1) 구매 보류 옷: 옷장과 같은 garments 행에 held 표시를 둔다.
--    보류 옷은 옷장 목록·분석·구매 판단 비교에서 빠지고, "구매했어요 → 옷장으로"는 held를 false로 바꾼다(사진은 그대로).
--    보류 옷에는 구매일·시즌·내 핏을 두지 않는다.
alter table public.garments add column if not exists held boolean not null default false;
alter table public.garments drop constraint if exists garments_held_no_purchase;
alter table public.garments add constraint garments_held_no_purchase
  check (not held or (purchased_on is null and cardinality(seasons) = 0 and user_fit is null));

-- 구매 판단기에서 담은 옷은 그 판단 결과로 돌아갈 수 있게 판단 기록 id를 남긴다(기록이 지워지면 비운다).
alter table public.garments
  add column if not exists fit_check_id uuid references public.fit_checks(id) on delete set null;
create index if not exists garments_fit_check_idx on public.garments (fit_check_id);

-- 판단 기록도 본인 것이어야 한다(세부분류·출처 import 확인에 더한다).
create or replace function public.check_garment_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subcategory_id is not null and not exists (
    select 1 from public.subcategories s where s.id = new.subcategory_id and s.category_id = new.category_id
  ) then
    raise exception 'subcategory % does not belong to category %', new.subcategory_id, new.category_id
      using errcode = '23514';
  end if;
  if new.source_import_id is not null and not exists (
    select 1 from public.product_imports p where p.id = new.source_import_id and p.user_id = new.user_id
  ) then
    raise exception 'source import not owned by user' using errcode = '42501';
  end if;
  if new.fit_check_id is not null and not exists (
    select 1 from public.fit_checks f where f.id = new.fit_check_id and f.user_id = new.user_id
  ) then
    raise exception 'fit check not owned by user' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 2) 달러 가격: currency 칸은 처음부터 있었다(기본 KRW). 원과 달러만 받는다.
--    purchase_price는 원이면 원, 달러면 센트(49.99달러 → 4999) 정수로 저장한다.
update public.garments set currency = 'KRW' where currency is distinct from 'KRW' and currency is distinct from 'USD';
alter table public.garments drop constraint if exists garments_currency_check;
alter table public.garments add constraint garments_currency_check check (currency in ('KRW', 'USD'));

-- 3) 사이트 설정(관리자가 바꾸는 값). 지금은 달러 환율(1달러 = N원)만 둔다.
--    로그인한 사용자는 읽기만 하고, 바꾸기는 관리자 확인을 마친 서버 코드(service role)만 한다.
create table if not exists public.app_settings (
  key        text primary key check (key in ('usd_krw')),
  value      numeric not null check (value > 0 and value < 100000),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to authenticated;
grant select, insert, update on public.app_settings to service_role;
drop policy if exists "app_settings_select_all" on public.app_settings;
create policy "app_settings_select_all" on public.app_settings for select to authenticated using (true);

insert into public.app_settings (key, value) values ('usd_krw', 1360) on conflict (key) do nothing;

-- 관리자 작업 기록에 환율 변경·신체치수 암호화 변환을 더한다.
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check
  check (action in ('view_admin', 'ban_user', 'unban_user', 'delete_user', 'grant_tester', 'revoke_tester', 'set_usd_rate', 'encrypt_body'));

-- 4) 신체치수 암호화: 서버가 BODY_ENCRYPTION_KEY로 암호화한 값(AES-256-GCM, "v1."로 시작)만 둔다.
--    예전 평문 칸(height_cm 등)은 관리자 화면 "암호화로 바꾸기"로 옮긴 뒤 마이그레이션 19에서 지운다.
alter table public.body_profiles add column if not exists values_enc text
  check (values_enc is null or (values_enc like 'v1.%' and char_length(values_enc) <= 2000));
