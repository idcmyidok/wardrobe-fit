-- 업데이트 노트 사진(2026-09-30): 관리자가 버전마다 사진 한 장을 넣을 수 있다.
-- 사진은 브라우저에서 WebP(긴 변 약 1600px)로 줄여 올린다. 공개 bucket(읽기는 누구나), 쓰기는 admins에 있는 사람만.
-- 경로: {version}/{uuid}.webp. release_note_images가 버전별로 지금 쓰는 사진 경로를 가진다(글 수정본과는 따로).
-- 여러 번 실행해도 결과가 같다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('release-note-images', 'release-note-images', true, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "release_note_images_select_all" on storage.objects;
create policy "release_note_images_select_all" on storage.objects for select to anon, authenticated
  using (bucket_id = 'release-note-images');

drop policy if exists "release_note_images_admin_insert" on storage.objects;
create policy "release_note_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'release-note-images' and exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "release_note_images_admin_delete" on storage.objects;
create policy "release_note_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'release-note-images' and exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create table if not exists public.release_note_images (
  version    text primary key check (version ~ '^\d+\.\d+\.\d+$'),
  path       text not null check (char_length(path) <= 200),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.release_note_images enable row level security;
revoke all on public.release_note_images from anon, authenticated;
grant select on public.release_note_images to anon, authenticated;
grant insert, update, delete on public.release_note_images to authenticated;

drop policy if exists "release_note_images_select_all" on public.release_note_images;
create policy "release_note_images_select_all" on public.release_note_images for select to anon, authenticated
  using (true);

drop policy if exists "release_note_images_admin_insert" on public.release_note_images;
create policy "release_note_images_admin_insert" on public.release_note_images for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "release_note_images_admin_update" on public.release_note_images;
create policy "release_note_images_admin_update" on public.release_note_images for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "release_note_images_admin_delete" on public.release_note_images;
create policy "release_note_images_admin_delete" on public.release_note_images for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
