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

/** PROJECT_SPEC.md 8.2 세부분류 초기 시드 */
export const SUBCATEGORIES: { id: string; categoryId: CategoryId; name: string }[] = [
  { id: "outer.jacket", categoryId: "outer", name: "자켓" },
  { id: "outer.blazer", categoryId: "outer", name: "블레이저" },
  { id: "outer.coat", categoryId: "outer", name: "코트" },
  { id: "outer.padding", categoryId: "outer", name: "패딩" },
  { id: "outer.blouson", categoryId: "outer", name: "점퍼/블루종" },
  { id: "outer.cardigan", categoryId: "outer", name: "가디건" },
  { id: "outer.vest", categoryId: "outer", name: "베스트" },
  { id: "outer.etc", categoryId: "outer", name: "기타 아우터" },
  { id: "top.short_tee", categoryId: "top", name: "반팔 티셔츠" },
  { id: "top.long_tee", categoryId: "top", name: "긴팔 티셔츠" },
  { id: "top.shirt", categoryId: "top", name: "셔츠" },
  { id: "top.knit", categoryId: "top", name: "니트" },
  { id: "top.sweatshirt", categoryId: "top", name: "스웨트셔츠" },
  { id: "top.hoodie", categoryId: "top", name: "후드" },
  { id: "top.polo", categoryId: "top", name: "폴로" },
  { id: "top.etc", categoryId: "top", name: "기타 상의" },
  { id: "bottom.denim", categoryId: "bottom", name: "데님" },
  { id: "bottom.slacks", categoryId: "bottom", name: "슬랙스" },
  { id: "bottom.chino", categoryId: "bottom", name: "치노/면바지" },
  { id: "bottom.sweatpants", categoryId: "bottom", name: "스웨트팬츠" },
  { id: "bottom.shorts", categoryId: "bottom", name: "반바지" },
  { id: "bottom.cargo", categoryId: "bottom", name: "카고" },
  { id: "bottom.etc", categoryId: "bottom", name: "기타 하의" },
];

export const SUBCATEGORY_NAME: Record<string, string> = Object.fromEntries(
  SUBCATEGORIES.map((s) => [s.id, s.name]),
);
