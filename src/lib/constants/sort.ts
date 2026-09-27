export type WardrobeSort = "purchased_desc" | "purchased_asc" | "price_desc" | "price_asc";

export const SORT_OPTIONS: { id: WardrobeSort; name: string }[] = [
  { id: "purchased_desc", name: "최근 구매순" },
  { id: "purchased_asc", name: "오래된 구매순" },
  { id: "price_desc", name: "높은 가격순" },
  { id: "price_asc", name: "낮은 가격순" },
];
