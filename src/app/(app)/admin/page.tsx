import { AdminView } from "@/components/admin/admin-view";
import { requireAdmin } from "@/server/admin/guard";
import { getAdminOverview } from "@/server/admin/queries";

export const metadata = { title: "관리자 · Wardrobe Fit", robots: { index: false } };

/** 관리자 페이지. 관리자가 아니면 404. 통계와 사용자 목록은 관리자 확인 뒤 service role로 읽는다. */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const me = await requireAdmin();
  const requested = Number((await searchParams).page);
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  return <AdminView overview={await getAdminOverview(page)} myId={me.id} />;
}
