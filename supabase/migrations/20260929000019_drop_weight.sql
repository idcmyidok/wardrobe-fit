-- 몸무게 삭제(2026-09-29 사용자 결정): 계산에 쓰지 않던 기록용 칸이라 더는 받지 않는다.
-- 1.2.6이 main(운영)에 올라간 "뒤에" 실행한다. 그 전 코드는 weight_kg를 읽고 쓴다.
-- 저장된 값을 먼저 비우고 열을 지운다. "정확하지 않아요" 표시에서도 뺀다. 마지막 수정일은 바꾸지 않는다.
-- 여러 번 실행해도 결과가 같다.

alter table public.body_profiles disable trigger body_profiles_updated_at;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'body_profiles' and column_name = 'weight_kg') then
    update public.body_profiles set weight_kg = null where weight_kg is not null;
  end if;
end $$;

update public.body_profiles
  set uncertain = array_remove(uncertain, 'weight')
  where 'weight' = any(uncertain);

alter table public.body_profiles enable trigger body_profiles_updated_at;

alter table public.body_profiles drop column if exists weight_kg;

alter table public.body_profiles drop constraint if exists body_profiles_uncertain_check;
alter table public.body_profiles add constraint body_profiles_uncertain_check
  check (uncertain <@ array['height','shoulder','chest','waist','hip','thigh']::text[]);
