import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/server/admin/guard";
import { textGroups } from "@/server/roast/meta";
import { getRoastTextEdits } from "@/server/roast/queries";
import { applyTextEdits, fromRows, groupOf, unitsOf } from "@/server/roast/texts";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const items = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [String(v)]);

/** GET /admin/roast-texts/export → 지금 쓰이는 훈수 문장 전체(코드 기본값, DB 저장값, 실제로 나오는 값)를 CSV로. 관리자만, 읽기만 한다. */
export async function GET() {
  if (!(await getAdminUser())) return new Response("Not found", { status: 404 });
  const rows = await getRoastTextEdits(await createSupabaseServerClient());
  const edits = fromRows(rows);
  const live = new Map(unitsOf(applyTextEdits(rows)).map((u) => [u.key, u.value]));
  const title = new Map(textGroups().map((g) => [g.id, g.title]));

  const out = [["옷장/주문내역", "키", "블록 이름", "번호", "코드 기본값", "DB 저장값", "지금 나오는 값"].map(cell).join(",")];
  for (const u of unitsOf()) {
    if (u.kind === "number" || u.key.startsWith("report.layout.") || u.key.startsWith("orders.report.layout.")) continue;
    const base = items(u.value);
    const saved = u.key in edits ? items(edits[u.key]) : null;
    const now = items(live.get(u.key) ?? u.value);
    const n = Math.max(base.length, saved?.length ?? 0, now.length);
    for (let i = 0; i < n; i++) {
      const group = groupOf(u.key);
      out.push(
        [u.key.startsWith("orders.") ? "주문내역" : "옷장", u.key, title.get(group) ?? group, u.kind === "list" ? i + 1 : "", base[i] ?? "", saved ? (saved[i] ?? "") : "", now[i] ?? ""]
          .map(cell)
          .join(","),
      );
    }
  }
  return new Response(`﻿${out.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="roast-texts.csv"',
      "cache-control": "no-store",
    },
  });
}
