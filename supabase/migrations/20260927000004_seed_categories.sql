-- 4단계: 참조 데이터(첫 시드). 세부분류는 20260928000011_musinsa_subcategories.sql에서 무신사 분류로 바뀌었다.
insert into public.categories (id, name_ko, measurement_group, sort_order) values
  ('outer', '아우터', 'top', 1),
  ('top', '상의', 'top', 2),
  ('bottom', '하의', 'bottom', 3)
on conflict (id) do update set name_ko = excluded.name_ko, measurement_group = excluded.measurement_group, sort_order = excluded.sort_order;

insert into public.subcategories (id, category_id, name_ko, sort_order) values
  ('outer.jacket', 'outer', '자켓', 1),
  ('outer.blazer', 'outer', '블레이저', 2),
  ('outer.coat', 'outer', '코트', 3),
  ('outer.padding', 'outer', '패딩', 4),
  ('outer.blouson', 'outer', '점퍼/블루종', 5),
  ('outer.cardigan', 'outer', '가디건', 6),
  ('outer.vest', 'outer', '베스트', 7),
  ('outer.etc', 'outer', '기타 아우터', 8),
  ('top.short_tee', 'top', '반팔 티셔츠', 1),
  ('top.long_tee', 'top', '긴팔 티셔츠', 2),
  ('top.shirt', 'top', '셔츠', 3),
  ('top.knit', 'top', '니트', 4),
  ('top.sweatshirt', 'top', '스웨트셔츠', 5),
  ('top.hoodie', 'top', '후드', 6),
  ('top.polo', 'top', '폴로', 7),
  ('top.etc', 'top', '기타 상의', 8),
  ('bottom.denim', 'bottom', '데님', 1),
  ('bottom.slacks', 'bottom', '슬랙스', 2),
  ('bottom.chino', 'bottom', '치노/면바지', 3),
  ('bottom.sweatpants', 'bottom', '스웨트팬츠', 4),
  ('bottom.shorts', 'bottom', '반바지', 5),
  ('bottom.cargo', 'bottom', '카고', 6),
  ('bottom.etc', 'bottom', '기타 하의', 7)
on conflict (id) do update set category_id = excluded.category_id, name_ko = excluded.name_ko, sort_order = excluded.sort_order;

-- 유사 카테고리(구매 판단 비교 3순위)
update public.subcategories set similar_to = case id
  when 'outer.jacket'   then array['outer.blazer', 'outer.blouson']
  when 'outer.blazer'   then array['outer.jacket']
  when 'outer.blouson'  then array['outer.jacket', 'outer.padding']
  when 'outer.padding'  then array['outer.blouson']
  when 'outer.cardigan' then array['top.knit']
  when 'top.knit'       then array['outer.cardigan', 'top.sweatshirt']
  when 'top.sweatshirt' then array['top.hoodie', 'top.long_tee']
  when 'top.hoodie'     then array['top.sweatshirt']
  when 'top.long_tee'   then array['top.short_tee', 'top.sweatshirt']
  when 'top.short_tee'  then array['top.long_tee', 'top.polo']
  when 'top.polo'       then array['top.short_tee']
  when 'bottom.denim'   then array['bottom.chino']
  when 'bottom.chino'   then array['bottom.slacks', 'bottom.denim', 'bottom.cargo']
  when 'bottom.slacks'  then array['bottom.chino']
  when 'bottom.cargo'   then array['bottom.chino']
  when 'bottom.sweatpants' then array['bottom.chino']
  else '{}'::text[] end;
