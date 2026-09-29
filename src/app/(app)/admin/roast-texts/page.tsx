import { RoastTextEditor, type EditorGroup } from "@/components/admin/roast-text-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/admin/guard";
import { fieldLabel, textGroups, varLabel } from "@/server/roast/meta";
import { getRoastTextEdits } from "@/server/roast/queries";
import { Q_TEXT } from "@/server/roast/questions";
import { allowedVars, flattenTexts, groupOf } from "@/server/roast/texts";

export const metadata = { title: "훈수 문장 · 관리자", robots: { index: false } };

/** 내 옷장 훈수의 모든 문장을 모아 보고 고치는 관리자 화면. 관리자가 아니면 404. */
export default async function RoastTextsPage() {
  await requireAdmin();
  const edits = await getRoastTextEdits(await createSupabaseServerClient());
  const entries = flattenTexts();
  const optionLabel = (qid: string, opt: string) => Q_TEXT[qid]?.options[opt];
  const groups: EditorGroup[] = textGroups().map((g) => {
    const vars = allowedVars(`${g.id}.x`);
    return {
      ...g,
      vars: vars.map((v) => ({ key: v, label: varLabel(g.id, v) })),
      fields: entries
        .filter((e) => groupOf(e.key) === g.id)
        .map((e) => ({ key: e.key, label: fieldLabel(e.key, optionLabel), base: e.value, edited: edits[e.key] ?? null })),
    };
  });
  return <RoastTextEditor groups={groups.filter((g) => g.fields.length)} />;
}
