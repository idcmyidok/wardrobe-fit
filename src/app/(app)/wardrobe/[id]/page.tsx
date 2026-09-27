import { GarmentDetailView } from "@/components/wardrobe/garment-detail-view";

export const metadata = { title: "옷 정보 · Wardrobe Fit" };

/** 옷 정보 상세 페이지. 모바일에서 표의 행을 누르면 Drawer 대신 이곳으로 온다(PROJECT_SPEC.md 5.2). */
export default async function GarmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GarmentDetailView id={id} />;
}
