-- 팔길이·다리길이 삭제(2026-09-28 사용자 결정): 총장·소매를 예상 핏에서 빼면서 쓰지 않게 되어 더는 받지 않는다.
-- 저장된 값을 먼저 비우고 열을 지운다. "정확하지 않아요" 표시에서도 뺀다. 마지막 수정일은 바꾸지 않는다.
-- 여러 번 실행해도 결과가 같다.

alter table public.body_profiles disable trigger body_profiles_updated_at;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'body_profiles' and column_name = 'arm_cm') then
    update public.body_profiles set arm_cm = null, leg_cm = null where arm_cm is not null or leg_cm is not null;
  end if;
end $$;

update public.body_profiles
  set uncertain = array_remove(array_remove(uncertain, 'arm'), 'leg')
  where uncertain && array['arm', 'leg']::text[];

alter table public.body_profiles enable trigger body_profiles_updated_at;

alter table public.body_profiles drop column if exists arm_cm;
alter table public.body_profiles drop column if exists leg_cm;

alter table public.body_profiles drop constraint if exists body_profiles_uncertain_check;
alter table public.body_profiles add constraint body_profiles_uncertain_check
  check (uncertain <@ array['height','weight','shoulder','chest','waist','hip','thigh']::text[]);
