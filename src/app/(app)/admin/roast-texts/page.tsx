import { RoastTextEditor, type EditorGroup, type EditorQuiz } from "@/components/admin/roast-text-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/admin/guard";
import { BRANDS } from "@/server/roast/brands";
import { fieldLabel, LAYOUT_POINT, LAYOUT_SECTION, textGroups, varLabel } from "@/server/roast/meta";
import { getRoastTextEdits } from "@/server/roast/queries";
import { Q_TEXT } from "@/server/roast/questions";
import { allowedVars, applyTextEdits, CUSTOM_QUIZ_ID, DEFAULT_TEXTS, fromRows, groupOf, unitsOf } from "@/server/roast/texts";

export const metadata = { title: "훈수 문장 · 관리자", robots: { index: false } };

/** 내 옷장 훈수의 모든 문장을 모아 보고 고치는 관리자 화면. 관리자가 아니면 404. */
export default async function RoastTextsPage() {
  await requireAdmin();
  const rows = await getRoastTextEdits(await createSupabaseServerClient());
  const edits = fromRows(rows);
  const units = unitsOf().filter((u) => !u.key.startsWith("quiz."));
  const optionLabel = (qid: string, opt: string) => Q_TEXT[qid]?.options[opt];
  const groups: EditorGroup[] = textGroups()
    .map((g) => ({
      ...g,
      vars: allowedVars(`${g.id}.x`).map((v) => ({ key: v, label: varLabel(g.id, v) })),
      units: units
        .filter((u) => groupOf(u.key) === g.id)
        .map((u) => ({ key: u.key, kind: u.kind, label: fieldLabel(u.key, optionLabel), base: u.value, edited: edits[u.key] ?? null })),
    }))
    .filter((g) => g.units.length);

  const current = applyTextEdits(rows).quiz;
  const quizzes: EditorQuiz[] = [
    ...Object.entries(DEFAULT_TEXTS.quiz).map(([id, base]) => ({ id, builtIn: true, base, value: current[id] ?? base, deleted: !current[id] })),
    ...Object.entries(current)
      .filter(([id]) => CUSTOM_QUIZ_ID.test(id))
      .map(([id, value]) => ({ id, builtIn: false, base: null, value, deleted: false })),
  ].map((q) => ({ ...q, edited: q.builtIn ? JSON.stringify(q.value) !== JSON.stringify(q.base) || q.deleted : true }));
  const brands = BRANDS.map((b) => b.name).sort((a, b) => a.localeCompare(b));

  return <RoastTextEditor groups={groups} quizzes={quizzes} brands={brands} layout={{ sections: LAYOUT_SECTION, points: LAYOUT_POINT }} />;
}
