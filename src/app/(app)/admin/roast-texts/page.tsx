import { RoastDesigner } from "@/components/admin/roast-designer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/admin/guard";
import { designerData } from "@/server/roast/fl/admin-meta";
import { applyEdits, fromRows } from "@/server/roast/fl/store";
import { getRoastTextEdits } from "@/server/roast/queries";

export const metadata = { title: "훈수 설계 · 관리자", robots: { index: false } };

/** 내 패션 훈수의 구조·유형·점수·문장을 한곳에서 보고 고치는 관리자 화면. 관리자가 아니면 404. */
export default async function RoastDesignPage() {
  await requireAdmin();
  const rows = await getRoastTextEdits(await createSupabaseServerClient());
  return <RoastDesigner data={designerData(applyEdits(rows), Object.keys(fromRows(rows)))} />;
}
