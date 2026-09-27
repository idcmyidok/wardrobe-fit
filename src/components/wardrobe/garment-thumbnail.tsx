import { CATEGORY_NAME } from "@/lib/constants/categories";
import type { GarmentListItem } from "@/lib/types/domain";

/** 40px 썸네일. 이미지가 없으면 중립 배경 + 대분류 이니셜 (PROJECT_SPEC.md 20장). */
export function GarmentThumbnail({ item }: { item: GarmentListItem }) {
  if (item.imageUrl) {
    // 4~5단계에서 Supabase Storage signed URL + next/image로 교체한다.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.imageUrl} alt="" className="size-10 rounded-sm object-cover" />;
  }
  return (
    <div
      aria-hidden
      className="flex size-10 items-center justify-center rounded-sm border border-border bg-surface-muted text-xs text-text-subtle"
    >
      {CATEGORY_NAME[item.categoryId].slice(0, 1)}
    </div>
  );
}
