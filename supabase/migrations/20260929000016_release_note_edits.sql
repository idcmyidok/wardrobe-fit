-- 업데이트 노트 수정(2026-09-29): 관리자가 화면에서 버전별 노트를 자유 글로 고쳐 쓴다.
-- 기본 노트는 코드(src/lib/release-notes.ts)에 있고, 고친 버전만 여기에 글 전체를 저장해 덮어쓴다.
-- 행을 지우면 코드의 원래 노트로 돌아간다. 읽기는 누구나, 쓰기는 admins에 있는 사람만.
-- 여러 번 실행해도 결과가 같다.

create table if not exists public.release_note_edits (
  version    text primary key check (version ~ '^\d+\.\d+\.\d+$'),
  body       text not null check (char_length(body) <= 20000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.release_note_edits enable row level security;
revoke all on public.release_note_edits from anon, authenticated;
grant select on public.release_note_edits to anon, authenticated;
grant insert, update, delete on public.release_note_edits to authenticated;

drop policy if exists "release_note_edits_select_all" on public.release_note_edits;
create policy "release_note_edits_select_all" on public.release_note_edits for select to anon, authenticated
  using (true);

drop policy if exists "release_note_edits_admin_insert" on public.release_note_edits;
create policy "release_note_edits_admin_insert" on public.release_note_edits for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "release_note_edits_admin_update" on public.release_note_edits;
create policy "release_note_edits_admin_update" on public.release_note_edits for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "release_note_edits_admin_delete" on public.release_note_edits;
create policy "release_note_edits_admin_delete" on public.release_note_edits for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
