-- 내 옷장 훈수(/roast, 2026-09-29). 결과·AI 사용 기록·관리자가 고친 문장.
-- roast_results: 사용자당 가장 최근 결과 1개. 다시 해 보면 덮어쓴다. 입력한 이름(선택)과 결과 글, 관련 옷 정보(브랜드·제품명·사진 경로)를
--   복사해 두어 옷을 지워도 문장은 남는다. wardrobe_hash는 옷장이 바뀌었는지 비교하는 요약값.
-- roast_runs: 하루 AI 사용 횟수(최근 24시간 3회)를 세는 기록. 추가만 하고 고치거나 지울 수 없다(지우면 한도를 스스로 초기화할 수 있다).
-- 계정을 지우면 FK cascade로 함께 지워진다. 여러 번 실행해도 결과가 같다.

create table if not exists public.roast_results (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  name          text check (name is null or char_length(name) <= 20),
  garment_count integer not null check (garment_count >= 0),
  result        jsonb not null check (octet_length(result::text) <= 200000),
  wardrobe_hash text not null check (char_length(wardrobe_hash) <= 100),
  ai_used       boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.roast_results enable row level security;
revoke all on public.roast_results from anon, authenticated;
grant select, insert, update, delete on public.roast_results to authenticated;

drop policy if exists "roast_results_select_own" on public.roast_results;
create policy "roast_results_select_own" on public.roast_results for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "roast_results_insert_own" on public.roast_results;
create policy "roast_results_insert_own" on public.roast_results for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "roast_results_update_own" on public.roast_results;
create policy "roast_results_update_own" on public.roast_results for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "roast_results_delete_own" on public.roast_results;
create policy "roast_results_delete_own" on public.roast_results for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.roast_runs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  ai_used    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists roast_runs_user_created_idx on public.roast_runs (user_id, created_at desc);
alter table public.roast_runs enable row level security;
revoke all on public.roast_runs from anon, authenticated;
grant select, insert on public.roast_runs to authenticated;

drop policy if exists "roast_runs_select_own" on public.roast_runs;
create policy "roast_runs_select_own" on public.roast_runs for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "roast_runs_insert_own" on public.roast_runs;
create policy "roast_runs_insert_own" on public.roast_runs for insert to authenticated
  with check ((select auth.uid()) = user_id and created_at > now() - interval '1 minute');

-- roast_text_edits: 관리자가 화면에서 고친 훈수 문장(패턴별 멘트·질문·반응·퀴즈). 기본 문장은 코드에 있고,
--   고친 문장만 key(문장 위치, 예: lines.black_bias.say.0)별로 저장해 덮어쓴다. 행을 지우면 코드의 문장으로 돌아간다.
--   읽기는 로그인한 사용자 누구나(분석할 때 읽는다), 쓰기는 admins에 있는 사람만.
create table if not exists public.roast_text_edits (
  key        text primary key check (char_length(key) <= 200),
  body       text not null check (char_length(body) <= 1000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.roast_text_edits enable row level security;
revoke all on public.roast_text_edits from anon, authenticated;
grant select, insert, update, delete on public.roast_text_edits to authenticated;

drop policy if exists "roast_text_edits_select_all" on public.roast_text_edits;
create policy "roast_text_edits_select_all" on public.roast_text_edits for select to authenticated
  using (true);
drop policy if exists "roast_text_edits_admin_insert" on public.roast_text_edits;
create policy "roast_text_edits_admin_insert" on public.roast_text_edits for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
drop policy if exists "roast_text_edits_admin_update" on public.roast_text_edits;
create policy "roast_text_edits_admin_update" on public.roast_text_edits for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
drop policy if exists "roast_text_edits_admin_delete" on public.roast_text_edits;
create policy "roast_text_edits_admin_delete" on public.roast_text_edits for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
