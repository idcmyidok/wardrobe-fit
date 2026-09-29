-- 몸무게 삭제 + 평문 신체치수 칸 삭제(2026-09-29 사용자 결정, 1.2.6).
-- 순서: 1.2.6이 main(운영)에 올라가고, 관리자 화면에서 "암호화로 바꾸기"를 누른 "뒤에" 실행한다.
-- 아직 평문으로 남은 치수가 있으면 아무것도 지우지 않고 멈춘다(데이터를 잃지 않게).
-- 여러 번 실행해도 결과가 같다.

do $$
declare
  remaining int;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'body_profiles' and column_name = 'height_cm') then
    execute 'select count(*) from public.body_profiles
             where coalesce(height_cm, shoulder_cm, chest_cm, waist_cm, hip_cm, thigh_cm) is not null'
      into remaining;
    if remaining > 0 then
      raise exception '아직 암호화하지 않은 신체치수가 %건 있습니다. 관리자 화면의 "암호화로 바꾸기"를 먼저 눌러 주세요.', remaining;
    end if;
  end if;
end $$;

-- "정확하지 않아요" 표시에서 몸무게를 뺀다. 마지막 수정일은 바꾸지 않는다.
alter table public.body_profiles disable trigger body_profiles_updated_at;
update public.body_profiles set uncertain = array_remove(uncertain, 'weight') where 'weight' = any(uncertain);
alter table public.body_profiles enable trigger body_profiles_updated_at;

alter table public.body_profiles drop column if exists weight_kg;
alter table public.body_profiles drop column if exists height_cm;
alter table public.body_profiles drop column if exists shoulder_cm;
alter table public.body_profiles drop column if exists chest_cm;
alter table public.body_profiles drop column if exists waist_cm;
alter table public.body_profiles drop column if exists hip_cm;
alter table public.body_profiles drop column if exists thigh_cm;

alter table public.body_profiles drop constraint if exists body_profiles_uncertain_check;
alter table public.body_profiles add constraint body_profiles_uncertain_check
  check (uncertain <@ array['height','shoulder','chest','waist','hip','thigh']::text[]);
