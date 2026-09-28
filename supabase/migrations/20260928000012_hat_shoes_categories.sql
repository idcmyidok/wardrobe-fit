-- 대분류 모자·신발 추가. src/lib/constants/categories.ts, measurements.ts, shoe-fit.ts와 같아야 한다.
-- 모자: 사이즈 표기 + 실측(머리둘레·깊이·챙길이, cm). 신발: 사이즈 표기 + 착용감(길이감·발볼·발등)만.
-- 11(세부분류 무신사 기준) 다음에 실행한다. 여러 번 실행해도 결과가 같다.

-- 1) 치수 그룹을 enum에서 text로 바꾼다(enum 값 추가는 같은 트랜잭션에서 바로 쓸 수 없어서).
alter table public.categories alter column measurement_group type text using measurement_group::text;
drop type if exists public.measurement_group;
alter table public.categories drop constraint if exists categories_measurement_group_check;
alter table public.categories add constraint categories_measurement_group_check
  check (measurement_group in ('top', 'bottom', 'hat', 'shoes'));

-- 2) 대분류·세부분류
insert into public.categories (id, name_ko, measurement_group, sort_order) values
  ('hat', '모자', 'hat', 4),
  ('shoes', '신발', 'shoes', 5)
on conflict (id) do update set name_ko = excluded.name_ko, measurement_group = excluded.measurement_group, sort_order = excluded.sort_order;

insert into public.subcategories (id, category_id, name_ko, sort_order) values
  ('hat.cap', 'hat', '캡', 1),
  ('hat.beanie', 'hat', '비니', 2),
  ('hat.etc', 'hat', '기타 모자', 3),
  ('shoes.sneakers', 'shoes', '스니커즈', 1),
  ('shoes.sports', 'shoes', '스포츠화', 2),
  ('shoes.dress', 'shoes', '구두', 3),
  ('shoes.boots', 'shoes', '부츠', 4),
  ('shoes.sandals', 'shoes', '샌들', 5),
  ('shoes.etc', 'shoes', '기타 신발', 6)
on conflict (id) do update set category_id = excluded.category_id, name_ko = excluded.name_ko, sort_order = excluded.sort_order;

-- 3) 모자 실측(cm, 머리둘레는 둘레 그대로)과 신발 착용감
alter table public.garments
  add column if not exists m_head  numeric(5,1) check (m_head  > 0 and m_head  < 200),
  add column if not exists m_depth numeric(5,1) check (m_depth > 0 and m_depth < 200),
  add column if not exists m_brim  numeric(5,1) check (m_brim  > 0 and m_brim  < 200),
  add column if not exists shoe_fit_length text check (shoe_fit_length in ('tight', 'good', 'loose')),
  add column if not exists shoe_fit_width  text check (shoe_fit_width  in ('tight', 'good', 'loose')),
  add column if not exists shoe_fit_instep text check (shoe_fit_instep in ('tight', 'good', 'loose'));

-- 4) 대분류에 맞는 실측·착용감만
alter table public.garments drop constraint if exists garments_measurements_match_category;
alter table public.garments add constraint garments_measurements_match_category check (
  (category_id = 'bottom'
    and m_shoulder is null and m_chest is null and m_sleeve is null
    and m_head is null and m_depth is null and m_brim is null)
  or (category_id in ('outer', 'top')
    and m_waist is null and m_hip is null and m_thigh is null and m_rise is null and m_leg_opening is null
    and m_head is null and m_depth is null and m_brim is null)
  or (category_id = 'hat'
    and m_length is null and m_shoulder is null and m_chest is null and m_sleeve is null
    and m_waist is null and m_hip is null and m_thigh is null and m_rise is null and m_leg_opening is null)
  or (category_id = 'shoes'
    and m_length is null and m_shoulder is null and m_chest is null and m_sleeve is null
    and m_waist is null and m_hip is null and m_thigh is null and m_rise is null and m_leg_opening is null
    and m_head is null and m_depth is null and m_brim is null)
);
alter table public.garments drop constraint if exists garments_shoe_fit_only_shoes;
alter table public.garments add constraint garments_shoe_fit_only_shoes check (
  category_id = 'shoes' or (shoe_fit_length is null and shoe_fit_width is null and shoe_fit_instep is null)
);
