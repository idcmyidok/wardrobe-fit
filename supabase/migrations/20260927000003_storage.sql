-- 4단계: 제품 사진 Storage (PROJECT_SPEC.md 11.3)
-- 사진은 브라우저에서 WebP(긴 변 약 1600px, 품질 0.8)와 약 300px 썸네일로 바꾸고 EXIF를 뺀 뒤 올린다. 원본은 올리지 않는다.
-- 경로: {user_id}/{garment_id}/{uuid}.webp, 썸네일 {uuid}-thumb.webp

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('garment-images', 'garment-images', false, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "garment_images_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'garment-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "garment_images_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'garment-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "garment_images_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'garment-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'garment-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "garment_images_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'garment-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
