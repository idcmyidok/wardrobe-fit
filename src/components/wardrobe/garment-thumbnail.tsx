import { cn } from "@/lib/cn";
import type { Garment } from "@/lib/types/domain";

/** 옷 사진 자리. 이미지가 없으면 중립 배경 + 브랜드 이니셜 (PROJECT_SPEC.md 20장). */
export function GarmentThumbnail({ item, className }: { item: Pick<Garment, "brand" | "imageUrl">; className?: string }) {
  if (item.imageUrl) {
    // 4~5단계에서 Supabase Storage signed URL + next/image로 교체한다.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.imageUrl} alt="" className={cn("h-24 w-full object-cover", className)} />;
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-24 w-full items-end bg-neutral-200 px-1.25 py-1 text-2xs font-semibold text-neutral-600",
        className,
      )}
    >
      {item.brand.slice(0, 1)}
    </div>
  );
}
