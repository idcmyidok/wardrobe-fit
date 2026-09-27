import { cn } from "@/lib/cn";
import type { Garment } from "@/lib/types/domain";

/** 옷 사진 자리. 이미지가 없으면 중립 배경 + 브랜드 이니셜, 브랜드가 없으면 제품명 첫 글자 (PROJECT_SPEC.md 20장). */
export function GarmentThumbnail({ item, className }: { item: Pick<Garment, "brand" | "productName" | "imageUrl" | "thumbUrl">; className?: string }) {
  const src = item.thumbUrl ?? item.imageUrl;
  if (src) {
    // 비공개 bucket의 signed URL(1시간)이라 next/image 최적화 캐시를 거치지 않고 그대로 쓴다.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" className={cn("h-24 w-full object-cover", className)} />;
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-24 w-full items-end bg-neutral-200 px-1.25 py-1 text-2xs font-semibold text-neutral-600",
        className,
      )}
    >
      {(item.brand || item.productName).slice(0, 1)}
    </div>
  );
}
