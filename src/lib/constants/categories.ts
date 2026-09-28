import type { CategoryId } from "@/lib/types/domain";

export const CATEGORIES: { id: CategoryId; name: string }[] = [
  { id: "outer", name: "아우터" },
  { id: "top", name: "상의" },
  { id: "bottom", name: "하의" },
];

export const CATEGORY_NAME: Record<CategoryId, string> = {
  outer: "아우터",
  top: "상의",
  bottom: "하의",
};

/**
 * PROJECT_SPEC.md 8.2 세부분류(무신사 분류 기준). supabase/migrations/…_musinsa_subcategories.sql과 같아야 한다.
 * id는 내부 값이라 이름이 바뀌어도 그대로 둔 것이 있다(예: bottom.chino = 코튼 팬츠).
 */
export const SUBCATEGORIES: { id: string; categoryId: CategoryId; name: string }[] = [
  { id: "outer.hood_zip", categoryId: "outer", name: "후드 집업" },
  { id: "outer.blouson", categoryId: "outer", name: "블루종/MA-1" },
  { id: "outer.leather", categoryId: "outer", name: "레더/라이더스 재킷" },
  { id: "outer.blazer", categoryId: "outer", name: "슈트/블레이저 재킷" },
  { id: "outer.cardigan", categoryId: "outer", name: "카디건" },
  { id: "outer.light_padding", categoryId: "outer", name: "경량 패딩/패딩 베스트" },
  { id: "outer.safari", categoryId: "outer", name: "사파리/헌팅 재킷" },
  { id: "outer.trucker", categoryId: "outer", name: "트러커 재킷" },
  { id: "outer.stadium", categoryId: "outer", name: "스타디움 재킷" },
  { id: "outer.coach", categoryId: "outer", name: "나일론/코치 재킷" },
  { id: "outer.training", categoryId: "outer", name: "트레이닝 재킷" },
  { id: "outer.anorak", categoryId: "outer", name: "아노락 재킷" },
  { id: "outer.fleece", categoryId: "outer", name: "플리스/뽀글이" },
  { id: "outer.transition_coat", categoryId: "outer", name: "환절기 코트" },
  { id: "outer.vest", categoryId: "outer", name: "베스트" },
  { id: "outer.mustang", categoryId: "outer", name: "무스탕/퍼" },
  { id: "outer.single_coat", categoryId: "outer", name: "겨울 싱글 코트" },
  { id: "outer.double_coat", categoryId: "outer", name: "겨울 더블 코트" },
  { id: "outer.winter_coat", categoryId: "outer", name: "겨울 기타 코트" },
  { id: "outer.short_padding", categoryId: "outer", name: "숏패딩/헤비 아우터" },
  { id: "outer.long_padding", categoryId: "outer", name: "롱패딩/헤비 아우터" },
  { id: "outer.shirt", categoryId: "outer", name: "셔츠/블라우스" },
  { id: "outer.etc", categoryId: "outer", name: "기타 아우터" },
  { id: "top.long_tee", categoryId: "top", name: "긴소매 티셔츠" },
  { id: "top.sweatshirt", categoryId: "top", name: "맨투맨/스웨트" },
  { id: "top.hoodie", categoryId: "top", name: "후드 티셔츠" },
  { id: "top.short_tee", categoryId: "top", name: "반소매 티셔츠" },
  { id: "top.polo", categoryId: "top", name: "피케/카라 티셔츠" },
  { id: "top.knit", categoryId: "top", name: "니트/스웨터" },
  { id: "top.sleeveless", categoryId: "top", name: "민소매 티셔츠" },
  { id: "top.etc", categoryId: "top", name: "기타 상의" },
  { id: "bottom.denim", categoryId: "bottom", name: "데님 팬츠" },
  { id: "bottom.chino", categoryId: "bottom", name: "코튼 팬츠" },
  { id: "bottom.slacks", categoryId: "bottom", name: "슈트 팬츠/슬랙스" },
  { id: "bottom.sweatpants", categoryId: "bottom", name: "트레이닝/조거 팬츠" },
  { id: "bottom.shorts", categoryId: "bottom", name: "숏 팬츠" },
  { id: "bottom.leggings", categoryId: "bottom", name: "레깅스" },
  { id: "bottom.jumpsuit", categoryId: "bottom", name: "점프 슈트/오버올" },
  { id: "bottom.etc", categoryId: "bottom", name: "기타 하의" },
];

/** 무신사 분류 전 세부분류와 아우터로 옮긴 셔츠. 옷은 마이그레이션으로 옮겼지만 예전 구매 판단 기록에 남아 있어 이름만 남긴다. */
const LEGACY_SUBCATEGORY_NAME: Record<string, string> = {
  "outer.jacket": "자켓",
  "outer.coat": "코트",
  "outer.padding": "패딩",
  "bottom.cargo": "카고",
  "top.shirt": "셔츠/블라우스",
};

export const SUBCATEGORY_NAME: Record<string, string> = {
  ...LEGACY_SUBCATEGORY_NAME,
  ...Object.fromEntries(SUBCATEGORIES.map((s) => [s.id, s.name])),
};

/** 유사 카테고리(구매 판단 비교 3순위). supabase/migrations/…_musinsa_subcategories.sql의 similar_to와 같아야 한다. */
export const SIMILAR_SUBCATEGORIES: Record<string, string[]> = {
  "outer.hood_zip": ["top.hoodie", "outer.training", "outer.fleece"],
  "outer.blouson": ["outer.stadium", "outer.coach", "outer.leather"],
  "outer.leather": ["outer.blouson", "outer.trucker", "outer.mustang"],
  "outer.blazer": ["outer.safari", "outer.trucker"],
  "outer.cardigan": ["top.knit"],
  "outer.light_padding": ["outer.short_padding", "outer.vest"],
  "outer.safari": ["outer.trucker", "outer.blouson", "outer.coach"],
  "outer.trucker": ["outer.safari", "outer.leather", "outer.blouson"],
  "outer.stadium": ["outer.blouson"],
  "outer.coach": ["outer.anorak", "outer.blouson", "outer.training"],
  "outer.training": ["outer.coach", "outer.hood_zip"],
  "outer.anorak": ["outer.coach"],
  "outer.fleece": ["outer.hood_zip", "outer.blouson"],
  "outer.transition_coat": ["outer.single_coat", "outer.winter_coat"],
  "outer.vest": ["outer.light_padding"],
  "outer.mustang": ["outer.leather"],
  "outer.single_coat": ["outer.double_coat", "outer.winter_coat", "outer.transition_coat"],
  "outer.double_coat": ["outer.single_coat", "outer.winter_coat"],
  "outer.winter_coat": ["outer.single_coat", "outer.double_coat"],
  "outer.short_padding": ["outer.light_padding", "outer.blouson"],
  "outer.long_padding": ["outer.winter_coat"],
  "outer.etc": ["outer.blouson", "outer.safari", "outer.trucker"],
  "top.knit": ["outer.cardigan", "top.sweatshirt"],
  "top.sweatshirt": ["top.hoodie", "top.long_tee"],
  "top.hoodie": ["top.sweatshirt", "outer.hood_zip"],
  "top.long_tee": ["top.short_tee", "top.sweatshirt"],
  "top.short_tee": ["top.long_tee", "top.polo", "top.sleeveless"],
  "top.polo": ["top.short_tee"],
  "top.sleeveless": ["top.short_tee"],
  "bottom.denim": ["bottom.chino"],
  "bottom.chino": ["bottom.slacks", "bottom.denim"],
  "bottom.slacks": ["bottom.chino"],
  "bottom.sweatpants": ["bottom.chino"],
};
