-- 공개 가입 대비: 한 사용자가 DB·Storage 무료 한도를 혼자 채우지 못하게 개수 상한을 DB에서 강제한다.
-- 화면을 거치지 않고 anon 키로 API를 직접 불러도 같은 상한이 걸린다.
-- 옷: 삭제는 soft delete(deleted_at)라 지운 행도 공간을 차지하므로 삭제된 것까지 합쳐 센다.
-- 사진: 옷 한 벌에 원본+썸네일 2개. 교체 전 사진도 남아 있을 수 있어 넉넉히 잡는다.

create or replace function public.enforce_garment_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 같은 사용자의 동시 insert가 상한을 함께 넘지 않게 사용자 단위로 잠근다.
  perform pg_advisory_xact_lock(hashtext('garment_quota:' || new.user_id::text));
  if (select count(*) from public.garments g where g.user_id = new.user_id) >= 2000 then
    raise exception 'garment_quota_exceeded' using errcode = 'P0001', hint = 'garment_quota_exceeded';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_garment_quota() from public, anon, authenticated;

drop trigger if exists garments_quota on public.garments;
create trigger garments_quota before insert on public.garments
  for each row execute function public.enforce_garment_quota();

-- Storage 정책 안에서 부른다. 본인 폴더의 파일 수만 센다(security definer라 RLS와 무관하게 정확히 센다).
create or replace function public.garment_image_quota_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < 5000
  from storage.objects o
  where o.bucket_id = 'garment-images'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;

revoke execute on function public.garment_image_quota_ok() from public, anon;
grant execute on function public.garment_image_quota_ok() to authenticated;

drop policy if exists "garment_images_insert_own" on storage.objects;
create policy "garment_images_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'garment-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.garment_image_quota_ok()
  );
