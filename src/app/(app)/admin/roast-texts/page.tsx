import { RoastTextEditor, type EditorGroup, type EditorQuiz, type WhenOption } from "@/components/admin/roast-text-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/admin/guard";
import { BRANDS } from "@/server/roast/brands";
import { LINE_SECTION } from "@/server/roast/lines";
import { fieldLabel, LAYOUT_POINT, LAYOUT_SECTION, PATTERN_COND, SECTION_NAME, textGroups, varLabel } from "@/server/roast/meta";
import { getRoastTextEdits } from "@/server/roast/queries";
import { WHEN_DEFS } from "@/server/roast/react-when";
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
        .map((u) => ({ key: u.key, kind: u.kind, label: fieldLabel(u.key, optionLabel), value: edits[u.key] ?? u.value, base: u.value })),
    }))
    .filter((g) => g.units.length);

  const current = applyTextEdits(rows).quiz;
  const quizzes: EditorQuiz[] = [
    ...Object.entries(DEFAULT_TEXTS.quiz).map(([id, base]) => ({ id, builtIn: true, value: current[id] ?? base, deleted: !current[id] })),
    ...Object.entries(current)
      .filter(([id]) => CUSTOM_QUIZ_ID.test(id))
      .map(([id, value]) => ({ id, builtIn: false, value, deleted: false })),
  ];
  const brands = BRANDS.map((b) => b.name).sort((a, b) => a.localeCompare(b));

  // 질문 반응마다 고르는 조건: 숫자 조건과 분석에서 잡힌 특징(패턴별 멘트 탭의 조건)
  const whenOptions: WhenOption[] = [
    ...Object.entries(WHEN_DEFS).map(([id, d]) => ({ id, label: d.label, n: d.n, group: "개수" })),
    ...Object.entries(LINE_SECTION).map(([id, sec]) => ({ id: `pat:${id}`, label: `${PATTERN_COND[id] ?? id}`, group: `분석에서 잡힘: ${SECTION_NAME[sec] ?? sec}` })),
  ];

  return <RoastTextEditor groups={groups} quizzes={quizzes} brands={brands} layout={{ sections: LAYOUT_SECTION, points: LAYOUT_POINT }} whenOptions={whenOptions} />;
}
