-- 4단계: 기본 스키마 (PROJECT_SPEC.md 8장)
-- 실측은 옷장 표에 보이는 항목만 둔다. 상의·아우터: 총장·어깨·가슴·소매 / 하의: 총장·허리·엉덩이·허벅지·밑위·밑단

create type public.measurement_group as enum ('top', 'bottom');
-- all = 사계절. 다른 값과 함께 저장하지 않는다(garments check 참고).
create type public.season as enum ('spring', 'summer', 'fall', 'winter', 'all');
create type public.color_source as enum ('selected_option', 'page_option', 'product_name', 'detail_field', 'manual');
create type public.import_status as enum ('pending', 'succeeded', 'partial', 'failed');
create type public.fit_check_status as enum ('computing', 'interpreting', 'completed', 'failed');

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 참조 테이블 ─────────────────────────────────────────────

create table public.categories (
  id                text primary key,
  name_ko           text not null,
  measurement_group public.measurement_group not null,
  sort_order        int not null
);

create table public.subcategories (
  id          text primary key,
  category_id text not null references public.categories(id),
  name_ko     text not null,
  sort_order  int not null,
  similar_to  text[] not null default '{}'
);
create index subcategories_category_idx on public.subcategories (category_id);

-- ── profiles ───────────────────────────────────────────────

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- 가입 시 profile 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── product_imports (URL 분석 기록) ─────────────────────────

create table public.product_imports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  purpose        text not null check (purpose in ('wardrobe', 'fit_check')),
  source_url     text not null check (char_length(source_url) <= 2048),
  normalized_url text not null check (char_length(normalized_url) <= 2048),
  domain         text not null check (char_length(domain) <= 255),
  parser_id      text,
  parser_version text,
  status         public.import_status not null default 'pending',
  result         jsonb,
  warnings       jsonb not null default '[]',
  error_code     text,
  duration_ms    int,
  created_at     timestamptz not null default now()
);
create index product_imports_user_created_idx on public.product_imports (user_id, created_at desc);

-- ── garments ───────────────────────────────────────────────

create table public.garments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,

  category_id     text not null references public.categories(id),
  subcategory_id  text references public.subcategories(id),
  brand           text check (char_length(brand) <= 100),              -- 선택 입력
  product_name    text not null check (char_length(btrim(product_name)) between 1 and 200),
  size_label      text check (char_length(size_label) <= 30),
  color_name      text check (char_length(color_name) <= 50),
  color_source    public.color_source,
  material        text check (char_length(material) <= 300),
  seasons         public.season[] not null default '{}',
  purchased_on    date,
  purchase_price  integer check (purchase_price >= 0),
  currency        char(3) not null default 'KRW',
  product_url     text check (char_length(product_url) <= 2048),
  image_path      text check (char_length(image_path) <= 512),        -- Storage: {user_id}/{garment_id}/{uuid}.webp
  thumb_path      text check (char_length(thumb_path) <= 512),        -- 약 300px 썸네일

  -- 실측 (cm, 단면 기준, 소수 1자리)
  m_length        numeric(5,1) check (m_length      > 0 and m_length      < 200),
  m_shoulder      numeric(5,1) check (m_shoulder    > 0 and m_shoulder    < 200),
  m_chest         numeric(5,1) check (m_chest       > 0 and m_chest       < 200),
  m_sleeve        numeric(5,1) check (m_sleeve      > 0 and m_sleeve      < 200),
  m_waist         numeric(5,1) check (m_waist       > 0 and m_waist       < 200),
  m_hip           numeric(5,1) check (m_hip         > 0 and m_hip         < 200),
  m_thigh         numeric(5,1) check (m_thigh       > 0 and m_thigh       < 200),
  m_rise          numeric(5,1) check (m_rise        > 0 and m_rise        < 200),
  m_leg_opening   numeric(5,1) check (m_leg_opening > 0 and m_leg_opening < 200),

  fit_review      text check (char_length(fit_review) <= 2000),
  source_import_id uuid references public.product_imports(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  -- 사계절은 단독으로만
  constraint garments_seasons_all_alone check (not ('all' = any(seasons)) or cardinality(seasons) = 1),
  -- 대분류에 맞는 실측만
  constraint garments_measurements_match_category check (
    (category_id = 'bottom' and m_shoulder is null and m_chest is null and m_sleeve is null)
    or (category_id in ('outer', 'top') and m_waist is null and m_hip is null and m_thigh is null
        and m_rise is null and m_leg_opening is null)
  )
);
create index garments_user_list_idx    on public.garments (user_id, purchased_on desc nulls last) where deleted_at is null;
create index garments_user_created_idx on public.garments (user_id, created_at desc) where deleted_at is null;
create index garments_user_cat_idx     on public.garments (user_id, category_id, subcategory_id) where deleted_at is null;
create index garments_source_import_idx on public.garments (source_import_id);
create trigger garments_updated_at before update on public.garments
  for each row execute function public.set_updated_at();

-- 세부분류가 대분류에 속하는지, 출처 import가 본인 것인지 확인
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
  return new;
end;
$$;
create trigger garments_check_refs before insert or update on public.garments
  for each row execute function public.check_garment_refs();

-- ── garment_review_signals (후기 파생 신호, 내부용) ─────────

create table public.garment_review_signals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  garment_id    uuid not null references public.garments(id) on delete cascade,
  review_hash   text not null,
  dimension     text not null check (dimension in
                  ('length','shoulder','chest','sleeve','waist','hip','thigh','rise','legOpening','overall')),
  direction     text not null check (direction in ('long','short','tight','loose','good','mixed')),
  strength      smallint not null default 1 check (strength between 1 and 3),
  evidence_text text not null check (char_length(evidence_text) <= 500),
  extractor     text not null,
  created_at    timestamptz not null default now()
);
create index garment_review_signals_user_garment_idx on public.garment_review_signals (user_id, garment_id);
create index garment_review_signals_garment_idx on public.garment_review_signals (garment_id);

-- ── fit_checks / fit_check_comparables ──────────────────────

create table public.fit_checks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  import_id      uuid references public.product_imports(id) on delete set null,
  candidate      jsonb not null,
  computed       jsonb,
  interpretation jsonb,
  confidence     text check (confidence in ('insufficient','low','medium','high')),
  status         public.fit_check_status not null default 'computing',
  ai_model       text,
  error_code     text,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index fit_checks_user_created_idx on public.fit_checks (user_id, created_at desc);
create index fit_checks_import_idx on public.fit_checks (import_id);

create table public.fit_check_comparables (
  fit_check_id uuid not null references public.fit_checks(id) on delete cascade,
  garment_id   uuid not null references public.garments(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  match_level  text not null check (match_level in ('subcategory','category','similar')),
  included     boolean not null default true,
  primary key (fit_check_id, garment_id)
);
create index fit_check_comparables_user_idx on public.fit_check_comparables (user_id);
create index fit_check_comparables_garment_idx on public.fit_check_comparables (garment_id);
