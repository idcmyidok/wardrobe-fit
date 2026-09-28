import type { CategoryId } from "@/lib/types/domain";
import { cleanText } from "./text";

/**
 * breadcrumb·카테고리 텍스트·제품명 → 대분류/세부분류(PROJECT_SPEC.md 14.2).
 * 앞에 둔 규칙이 먼저 걸린다(예: "데님 자켓"은 트러커 재킷). 못 찾으면 null로 두고 사용자가 고른다.
 */
const RULES: Array<[RegExp, CategoryId, string]> = [
  // 모자·신발을 먼저 본다("트러커 캡"은 트러커 재킷이 아니라 캡). "부츠컷"은 바지라 부츠가 아니다.
  [/비니|beanie|watch\s*cap/i, "hat", "hat.beanie"],
  [/볼\s*캡|야구\s*모자|스냅\s*백|트러커\s*캡|캠프\s*캡|(?<![a-z])cap(?![a-z])|snapback|캡(?!틴|슐)/i, "hat", "hat.cap"],
  [/버킷|벙거지|페도라|베레|헌팅\s*캡|모자(?!\s*(탈부착|분리|달린|포함))|bucket|fedora|beret|(?<![a-z])hats?(?![a-z])/i, "hat", "hat.etc"],
  [/러닝화|런닝화|트레이닝화|축구화|농구화|테니스화|등산화|트레일\s*러닝|스포츠화|running\s*shoes?|trail\s*running|football\s*boots/i, "shoes", "shoes.sports"],
  [/구두|로퍼|더비|옥스[퍼포]드(?!\s*셔츠)|몽크|드레스\s*슈즈|loafer|derby|oxford(?!\s*shirt)|monk\s*strap|dress\s*shoes?/i, "shoes", "shoes.dress"],
  [/부츠(?!\s*컷)|워커|첼시|(?<![a-z])boots?(?!\s*cut)(?![a-z])/i, "shoes", "shoes.boots"],
  [/샌들|슬리퍼|쪼리|sandal|slipper|flip[\s-]*flop/i, "shoes", "shoes.sandals"],
  [/스니커즈|운동화|sneakers?/i, "shoes", "shoes.sneakers"],
  [/신발|슈즈|(?<![a-z])shoes?(?![a-z])|footwear/i, "shoes", "shoes.etc"],
  [/경량\s*패딩|라이트\s*패딩|패딩\s*(베스트|조끼)|다운\s*(베스트|조끼)|light\s*(down|padding)|(down|padded|puffer)\s*vest/i, "outer", "outer.light_padding"],
  [/롱\s*패딩|롱\s*다운|벤치\s*파카|long\s*(padding|down|puffer)/i, "outer", "outer.long_padding"],
  [/패딩|다운|푸퍼|헤비\s*아우터|padding|down\s*jacket|puffer|parka/i, "outer", "outer.short_padding"],
  [/무스탕|시어링|페이크\s*퍼|퍼\s*(자켓|재킷|코트)|shearling|mustang|\bfur\b/i, "outer", "outer.mustang"],
  [/블레이저|blazer|[수슈]트\s*(자켓|재킷)|suit\s*jacket|테일러드/i, "outer", "outer.blazer"],
  [/더블.*코트|double.*coat/i, "outer", "outer.double_coat"],
  [/싱글.*코트|single.*coat/i, "outer", "outer.single_coat"],
  [/트렌치|맥\s*코트|발마칸|스프링\s*코트|환절기\s*코트|trench|mac\s*coat|balmacaan/i, "outer", "outer.transition_coat"],
  [/코트|coat/i, "outer", "outer.winter_coat"],
  [/가디건|카디건|cardigan/i, "outer", "outer.cardigan"],
  [/후드\s*(집업|짚업|지퍼)|후디\s*집업|zip[\s-]*up\s*hood|hood(ie)?\s*zip|zip\s*hood/i, "outer", "outer.hood_zip"],
  [/플리스|후리스|뽀글이|보아|fleece|sherpa|\bboa\b/i, "outer", "outer.fleece"],
  [/베스트|조끼|vest|gilet/i, "outer", "outer.vest"],
  [/(레더|가죽)\s*(자켓|재킷)|라이더스|leather\s*jacket|rider|biker/i, "outer", "outer.leather"],
  [/스타디움|바시티|varsity|stadium/i, "outer", "outer.stadium"],
  [/트러커|데님\s*(자켓|재킷)|청\s*자켓|trucker|denim\s*jacket/i, "outer", "outer.trucker"],
  [/사파리|헌팅|필드\s*(자켓|재킷)|safari|hunting|field\s*jacket|m-?65/i, "outer", "outer.safari"],
  [/아노락|anorak/i, "outer", "outer.anorak"],
  [/코치|나일론\s*(자켓|재킷)|바람막이|윈드\s*브레이커|coach|windbreaker|nylon\s*jacket/i, "outer", "outer.coach"],
  [/트레이닝\s*(자켓|재킷|집업)|트랙\s*(자켓|재킷|탑)|track\s*(jacket|top)|training\s*jacket/i, "outer", "outer.training"],
  [/블루종|점퍼|항공|봄버|ma-?1|bomber|blouson|jumper/i, "outer", "outer.blouson"],
  [/자켓|재킷|jacket|아우터|outer/i, "outer", "outer.etc"],
  [/후드|후디|hood/i, "top", "top.hoodie"],
  [/맨투맨|스웨트\s*셔츠|스웻\s*셔츠|sweat\s*shirt|crewneck/i, "top", "top.sweatshirt"],
  [/니트|스웨터|knit|sweater|pullover/i, "top", "top.knit"],
  [/피케|폴로|카라\s*티|polo|pique/i, "top", "top.polo"],
  // "티셔츠"·"t-shirt"는 셔츠가 아니다.
  [/(?<!티\s*)셔츠|남방|블라우스|(?<!t-?)shirt|blouse/i, "outer", "outer.shirt"],
  [/민소매|나시|슬리브리스|탱크\s*탑|sleeveless|tank/i, "top", "top.sleeveless"],
  [/반팔|반소매|short\s*sleeve|t-?shirt.*short|tee.*short/i, "top", "top.short_tee"],
  [/긴팔|긴소매|롱\s*슬리브|long\s*sleeve/i, "top", "top.long_tee"],
  [/티셔츠|티$|t-?shirt|tee/i, "top", "top.short_tee"],
  [/상의|top/i, "top", "top.etc"],
  [/점프\s*[수슈]트|오버올|멜빵|jump\s*suit|overall/i, "bottom", "bottom.jumpsuit"],
  [/레깅스|legging/i, "bottom", "bottom.leggings"],
  [/반바지|쇼츠|숏\s*팬츠|하프\s*팬츠|shorts/i, "bottom", "bottom.shorts"],
  [/조거|트레이닝|스웨트\s*팬츠|트랙\s*팬츠|jogger|sweat\s*pants|track\s*pants/i, "bottom", "bottom.sweatpants"],
  [/데님|청바지|진$|jeans|denim/i, "bottom", "bottom.denim"],
  [/슬랙스|[수슈]트\s*팬츠|slacks|trousers/i, "bottom", "bottom.slacks"],
  [/치노|면바지|코튼\s*팬츠|카고|chino|cotton\s*pants|cargo/i, "bottom", "bottom.chino"],
  [/바지|팬츠|하의|pants|bottom/i, "bottom", "bottom.etc"],
];

/** 카테고리 힌트를 앞에서부터, 없으면 제품명으로 찾는다. */
export function mapCategory(hints: string[], productName?: string): { categoryId: CategoryId; subcategoryId: string; fromName: boolean } | null {
  // breadcrumb는 보통 넓은 것 → 좁은 것 순서라 뒤(좁은 쪽)부터 본다.
  // "기타"(…etc)로만 걸리면 다른 힌트에서 더 구체적인 분류를 찾아 본다(예: 태그 "bottom" + 종류 "Chino Pants").
  let broad: { categoryId: CategoryId; subcategoryId: string } | null = null;
  for (const hint of [...hints].reverse()) {
    const text = cleanText(hint);
    const rule = RULES.find(([re]) => re.test(text));
    if (!rule) continue;
    const [, categoryId, subcategoryId] = rule;
    if (!subcategoryId.endsWith(".etc")) return { categoryId, subcategoryId, fromName: false };
    broad ??= { categoryId, subcategoryId };
  }
  if (broad) return { ...broad, fromName: false };
  const name = cleanText(productName);
  if (name) for (const [re, categoryId, subcategoryId] of RULES) if (re.test(name)) return { categoryId, subcategoryId, fromName: true };
  return null;
}
