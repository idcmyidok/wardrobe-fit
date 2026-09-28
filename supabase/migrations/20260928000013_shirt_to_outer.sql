-- 셔츠/블라우스를 상의에서 아우터로 옮긴다(top.shirt → outer.shirt). src/lib/constants/categories.ts와 같아야 한다.
-- 여러 번 실행해도 결과가 같다.

insert into public.subcategories (id, category_id, name_ko, sort_order) values
  ('outer.shirt', 'outer', '셔츠/블라우스', 22),
  ('outer.etc', 'outer', '기타 아우터', 23)
on conflict (id) do update set category_id = excluded.category_id, name_ko = excluded.name_ko, sort_order = excluded.sort_order;

-- 셔츠를 쓰던 옷(삭제한 옷 포함)을 아우터로 옮긴다. 상의와 아우터는 실측 항목이 같아 값은 그대로 둔다.
update public.garments set category_id = 'outer', subcategory_id = 'outer.shirt' where subcategory_id = 'top.shirt';

delete from public.subcategories where id = 'top.shirt';

-- 상의 순서 다시 매기기(셔츠가 빠진 자리)
update public.subcategories set sort_order = case id
  when 'top.long_tee' then 1
  when 'top.sweatshirt' then 2
  when 'top.hoodie' then 3
  when 'top.short_tee' then 4
  when 'top.polo' then 5
  when 'top.knit' then 6
  when 'top.sleeveless' then 7
  when 'top.etc' then 8
  else sort_order end
where category_id = 'top';
