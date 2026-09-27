export type WardrobeSort = "purchased_desc" | "purchased_asc" | "created_desc" | "price_desc" | "price_asc";

export const SORT_OPTIONS: { id: WardrobeSort; name: string }[] = [
  { id: "purchased_desc", name: "최근 구매순" },
  { id: "purchased_asc", name: "오래된 구매순" },
  { id: "created_desc", name: "최근 등록순" },
  { id: "price_desc", name: "구매가 높은순" },
  { id: "price_asc", name: "구매가 낮은순" },
];
