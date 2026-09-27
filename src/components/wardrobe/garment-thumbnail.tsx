import type { GarmentListItem } from "@/lib/types/domain";

/** 표 이미지 칸을 채우는 썸네일. 이미지가 없으면 중립 배경 + 브랜드 이니셜 (PROJECT_SPEC.md 20장). */
export function GarmentThumbnail({ item }: { item: GarmentListItem }) {
  if (item.imageUrl) {
    // 4~5단계에서 Supabase Storage signed URL + next/image로 교체한다.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.imageUrl} alt="" className="h-24 w-full object-cover" />;
  }
  return (
    <div aria-hidden className="flex h-24 w-full items-end bg-surface-muted px-1.5 py-1 text-xs font-semibold text-text-subtle">
      {item.brand.slice(0, 1)}
    </div>
  );
}
