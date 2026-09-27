import type { CategoryId } from "@/lib/types/domain";
import { cleanText } from "./text";

/**
 * breadcrumb·카테고리 텍스트·제품명 → 대분류/세부분류(PROJECT_SPEC.md 14.2).
 * 앞에 둔 규칙이 먼저 걸린다(예: "데님 자켓"은 자켓). 못 찾으면 null로 두고 사용자가 고른다.
 */
const RULES: Array<[RegExp, CategoryId, string]> = [
  [/패딩|다운|푸퍼|padding|down\s*jacket|puffer/i, "outer", "outer.padding"],
  [/블레이저|blazer|수트\s*자켓|suit\s*jacket/i, "outer", "outer.blazer"],
  [/코트|coat|트렌치|trench/i, "outer", "outer.coat"],
  [/가디건|카디건|cardigan/i, "outer", "outer.cardigan"],
  [/베스트|조끼|vest|gilet/i, "outer", "outer.vest"],
  [/블루종|점퍼|항공|봄버|bomber|blouson|jumper|바람막이|윈드브레이커|windbreaker|아노락|anorak/i, "outer", "outer.blouson"],
  [/자켓|재킷|jacket/i, "outer", "outer.jacket"],
  [/아우터|outer/i, "outer", "outer.etc"],
  [/후드|후디|hood/i, "top", "top.hoodie"],
  [/맨투맨|스웨트\s*셔츠|스웻셔츠|sweat\s*shirt|crewneck/i, "top", "top.sweatshirt"],
  [/니트|스웨터|knit|sweater|pullover/i, "top", "top.knit"],
  [/폴로|카라\s*티|polo/i, "top", "top.polo"],
  [/셔츠|남방|블라우스|shirt|blouse/i, "top", "top.shirt"],
  [/반팔|반소매|short\s*sleeve|t-?shirt.*short|tee.*short/i, "top", "top.short_tee"],
  [/긴팔|롱\s*슬리브|long\s*sleeve/i, "top", "top.long_tee"],
  [/티셔츠|티$|t-?shirt|tee/i, "top", "top.short_tee"],
  [/상의|top/i, "top", "top.etc"],
  [/반바지|쇼츠|숏\s*팬츠|shorts/i, "bottom", "bottom.shorts"],
  [/카고|cargo/i, "bottom", "bottom.cargo"],
  [/조거|스웨트\s*팬츠|트레이닝|jogger|sweat\s*pants|track\s*pants/i, "bottom", "bottom.sweatpants"],
  [/데님|청바지|진$|jeans|denim/i, "bottom", "bottom.denim"],
  [/슬랙스|slacks|trousers/i, "bottom", "bottom.slacks"],
  [/치노|면바지|코튼\s*팬츠|chino/i, "bottom", "bottom.chino"],
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
