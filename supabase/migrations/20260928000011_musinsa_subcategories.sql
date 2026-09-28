-- 세부분류를 무신사 분류로 바꾼다. src/lib/constants/categories.ts와 같아야 한다.
-- 여러 번 실행해도 결과가 같다(upsert → 옛 id를 쓰던 옷 옮기기 → 옛 id 삭제).

-- 1) 새 세부분류(이름이 바뀐 기존 id 포함)
insert into public.subcategories (id, category_id, name_ko, sort_order) values
  ('outer.hood_zip', 'outer', '후드 집업', 1),
  ('outer.blouson', 'outer', '블루종/MA-1', 2),
  ('outer.leather', 'outer', '레더/라이더스 재킷', 3),
  ('outer.blazer', 'outer', '슈트/블레이저 재킷', 4),
  ('outer.cardigan', 'outer', '카디건', 5),
  ('outer.light_padding', 'outer', '경량 패딩/패딩 베스트', 6),
  ('outer.safari', 'outer', '사파리/헌팅 재킷', 7),
  ('outer.trucker', 'outer', '트러커 재킷', 8),
  ('outer.stadium', 'outer', '스타디움 재킷', 9),
  ('outer.coach', 'outer', '나일론/코치 재킷', 10),
  ('outer.training', 'outer', '트레이닝 재킷', 11),
  ('outer.anorak', 'outer', '아노락 재킷', 12),
  ('outer.fleece', 'outer', '플리스/뽀글이', 13),
  ('outer.transition_coat', 'outer', '환절기 코트', 14),
  ('outer.vest', 'outer', '베스트', 15),
  ('outer.mustang', 'outer', '무스탕/퍼', 16),
  ('outer.single_coat', 'outer', '겨울 싱글 코트', 17),
  ('outer.double_coat', 'outer', '겨울 더블 코트', 18),
  ('outer.winter_coat', 'outer', '겨울 기타 코트', 19),
  ('outer.short_padding', 'outer', '숏패딩/헤비 아우터', 20),
  ('outer.long_padding', 'outer', '롱패딩/헤비 아우터', 21),
  ('outer.etc', 'outer', '기타 아우터', 22),
  ('top.long_tee', 'top', '긴소매 티셔츠', 1),
  ('top.sweatshirt', 'top', '맨투맨/스웨트', 2),
  ('top.shirt', 'top', '셔츠/블라우스', 3),
  ('top.hoodie', 'top', '후드 티셔츠', 4),
  ('top.short_tee', 'top', '반소매 티셔츠', 5),
  ('top.polo', 'top', '피케/카라 티셔츠', 6),
  ('top.knit', 'top', '니트/스웨터', 7),
  ('top.sleeveless', 'top', '민소매 티셔츠', 8),
  ('top.etc', 'top', '기타 상의', 9),
  ('bottom.denim', 'bottom', '데님 팬츠', 1),
  ('bottom.chino', 'bottom', '코튼 팬츠', 2),
  ('bottom.slacks', 'bottom', '슈트 팬츠/슬랙스', 3),
  ('bottom.sweatpants', 'bottom', '트레이닝/조거 팬츠', 4),
  ('bottom.shorts', 'bottom', '숏 팬츠', 5),
  ('bottom.leggings', 'bottom', '레깅스', 6),
  ('bottom.jumpsuit', 'bottom', '점프 슈트/오버올', 7),
  ('bottom.etc', 'bottom', '기타 하의', 8)
on conflict (id) do update set category_id = excluded.category_id, name_ko = excluded.name_ko, sort_order = excluded.sort_order;

-- 2) 없어지는 세부분류(자켓, 코트, 패딩, 카고)를 쓰던 옷(삭제한 옷 포함)을 제품명으로 새 분류에 옮긴다.
update public.garments set subcategory_id = case
    when coalesce(product_name, '') ~* '(레더|가죽)\s*(자켓|재킷)|라이더스|leather|rider|biker' then 'outer.leather'
    when coalesce(product_name, '') ~* '트러커|데님|청\s*자켓|trucker|denim' then 'outer.trucker'
    when coalesce(product_name, '') ~* '스타디움|바시티|varsity|stadium' then 'outer.stadium'
    when coalesce(product_name, '') ~* '사파리|헌팅|필드|safari|hunting|field|m-?65' then 'outer.safari'
    when coalesce(product_name, '') ~* '아노락|anorak' then 'outer.anorak'
    when coalesce(product_name, '') ~* '코치|나일론|바람막이|윈드\s*브레이커|coach|nylon|windbreaker' then 'outer.coach'
    when coalesce(product_name, '') ~* '트레이닝|트랙|track|training' then 'outer.training'
    when coalesce(product_name, '') ~* '블루종|점퍼|항공|봄버|ma-?1|bomber|blouson|jumper' then 'outer.blouson'
    else 'outer.etc' end
  where subcategory_id = 'outer.jacket';

update public.garments set subcategory_id = case
    when coalesce(product_name, '') ~* '더블|double' then 'outer.double_coat'
    when coalesce(product_name, '') ~* '싱글|single' then 'outer.single_coat'
    when coalesce(product_name, '') ~* '트렌치|맥\s*코트|발마칸|스프링|환절기|trench|mac|balmacaan' then 'outer.transition_coat'
    else 'outer.winter_coat' end
  where subcategory_id = 'outer.coat';

update public.garments set subcategory_id = case
    when coalesce(product_name, '') ~* '경량|라이트|베스트|조끼|light|vest' then 'outer.light_padding'
    when coalesce(product_name, '') ~* '롱|long|벤치' then 'outer.long_padding'
    else 'outer.short_padding' end
  where subcategory_id = 'outer.padding';

update public.garments set subcategory_id = 'bottom.chino' where subcategory_id = 'bottom.cargo';

-- 3) 옛 세부분류 삭제
delete from public.subcategories where id in ('outer.jacket', 'outer.coat', 'outer.padding', 'bottom.cargo');

-- 4) 유사 카테고리(구매 판단 비교 3순위)
update public.subcategories set similar_to = case id
  when 'outer.hood_zip'        then array['top.hoodie', 'outer.training', 'outer.fleece']
  when 'outer.blouson'         then array['outer.stadium', 'outer.coach', 'outer.leather']
  when 'outer.leather'         then array['outer.blouson', 'outer.trucker', 'outer.mustang']
  when 'outer.blazer'          then array['outer.safari', 'outer.trucker']
  when 'outer.cardigan'        then array['top.knit']
  when 'outer.light_padding'   then array['outer.short_padding', 'outer.vest']
  when 'outer.safari'          then array['outer.trucker', 'outer.blouson', 'outer.coach']
  when 'outer.trucker'         then array['outer.safari', 'outer.leather', 'outer.blouson']
  when 'outer.stadium'         then array['outer.blouson']
  when 'outer.coach'           then array['outer.anorak', 'outer.blouson', 'outer.training']
  when 'outer.training'        then array['outer.coach', 'outer.hood_zip']
  when 'outer.anorak'          then array['outer.coach']
  when 'outer.fleece'          then array['outer.hood_zip', 'outer.blouson']
  when 'outer.transition_coat' then array['outer.single_coat', 'outer.winter_coat']
  when 'outer.vest'            then array['outer.light_padding']
  when 'outer.mustang'         then array['outer.leather']
  when 'outer.single_coat'     then array['outer.double_coat', 'outer.winter_coat', 'outer.transition_coat']
  when 'outer.double_coat'     then array['outer.single_coat', 'outer.winter_coat']
  when 'outer.winter_coat'     then array['outer.single_coat', 'outer.double_coat']
  when 'outer.short_padding'   then array['outer.light_padding', 'outer.blouson']
  when 'outer.long_padding'    then array['outer.winter_coat']
  when 'outer.etc'             then array['outer.blouson', 'outer.safari', 'outer.trucker']
  when 'top.knit'              then array['outer.cardigan', 'top.sweatshirt']
  when 'top.sweatshirt'        then array['top.hoodie', 'top.long_tee']
  when 'top.hoodie'            then array['top.sweatshirt', 'outer.hood_zip']
  when 'top.long_tee'          then array['top.short_tee', 'top.sweatshirt']
  when 'top.short_tee'         then array['top.long_tee', 'top.polo', 'top.sleeveless']
  when 'top.polo'              then array['top.short_tee']
  when 'top.sleeveless'        then array['top.short_tee']
  when 'bottom.denim'          then array['bottom.chino']
  when 'bottom.chino'          then array['bottom.slacks', 'bottom.denim']
  when 'bottom.slacks'         then array['bottom.chino']
  when 'bottom.sweatpants'     then array['bottom.chino']
  else '{}'::text[] end;
