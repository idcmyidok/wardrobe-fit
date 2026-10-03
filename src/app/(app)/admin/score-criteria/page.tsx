import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/admin/guard";
import { fieldLabel, textGroups } from "@/server/roast/meta";
import { getRoastTextEdits } from "@/server/roast/queries";
import { Q_TEXT } from "@/server/roast/questions";
import { applyTextEdits, fromRows, groupOf, unitsOf } from "@/server/roast/texts";

export const metadata = { title: "점수 판정 기준 · 관리자", robots: { index: false } };

const head = "border-b border-neutral-300 bg-neutral-100 px-3 py-2 text-left font-medium";
const cell = "border-b border-neutral-300 px-3 py-2 align-middle";

/**
 * 옷장·주문내역 훈수 점수 판정 기준을 한눈에 보는 관리자 화면(읽기 전용).
 * 점수 계산 코드가 쓰는 값(score-deltas.ts, orders/rules.ts)과 항목 이름(meta.ts)을 그대로 읽어 그리므로,
 * 코드에 기준이 더해지거나 바뀌면 이 화면도 저절로 바뀐다. 관리자 "점수" 탭에서 DB로 고친 값이 있으면 그 값을 보여 주고 "수정됨"으로 표시한다.
 */
export default async function ScoreCriteriaPage() {
  await requireAdmin();
  const rows = await getRoastTextEdits(await createSupabaseServerClient());
  const edits = fromRows(rows);
  const live = applyTextEdits(rows).score as unknown as Record<string, Record<string, number>>;
  const num = (group: string, key: string) => Number(live[group]?.[key]);
  const units = unitsOf().filter((u) => u.key.startsWith("score.") && u.kind === "number");
  const live2 = applyTextEdits(rows);
  const qText = (qid: string, orders?: boolean) => (orders ? live2.orders?.questions?.[qid]?.text : undefined) || live2.questions[qid]?.text || Q_TEXT[qid]?.text;
  const groups = textGroups(qText).filter((g) => g.id.startsWith("score.") && (g.kind === "score" || g.kind === "orders"));

  const tables = (kind: "score" | "orders") =>
    groups
      .filter((g) => g.kind === kind)
      .map((g) => ({
        ...g,
        rows: units
          .filter((u) => groupOf(u.key) === g.id)
          .map((u) => {
            const saved = u.key in edits ? Number(edits[u.key]) : null;
            const code = Number(u.value);
            return { label: fieldLabel(u.key), code, value: saved ?? code, edited: saved != null && saved !== code };
          }),
      }))
      .filter((t) => t.rows.length);

  const closet = tables("score");
  const orders = tables("orders");
  const lift = `최종 점수는 합계 0점 → ${num("rules", "floor_min")}점, 50점 → ${num("rules", "floor_mid")}점, 100점 → 100점을 꺾은선으로 이은 값입니다.`;
  const liftOrders = `낮은 점수는 점수 + (100 − 점수) × ${num("rules", "lift")} 로 끌어올리고, 합계가 ${num("rules", "lift_floor")}점 미만이면 그 보정을 합계에 비례해 줄입니다.`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/admin" className="w-fit text-sm underline underline-offset-4">
          관리자 홈
        </Link>
        <h1 className="text-title font-semibold">점수 판정 기준</h1>
        <p className="text-sm text-neutral-700">
          점수 계산 코드가 지금 쓰는 값을 그대로 읽어 보여 줍니다. 코드가 바뀌면 이 화면도 저절로 바뀝니다. 값은{" "}
          <Link href="/admin/roast-texts" className="underline underline-offset-4">
            훈수 문장의 점수 탭
          </Link>
          에서 고칩니다. 고친 값은 &quot;수정됨&quot;으로 표시하고 코드 기본값을 옆에 적습니다.
        </p>
      </header>

      <Section title="옷장 훈수" intro={`기본 점수 ${num("rules", "base")}점에서 아래 기준대로 더하고 빼 0~100점으로 자릅니다. ${lift}`} tables={closet} />
      <Section
        title="주문내역 훈수"
        intro={`기본 점수 ${num("orules", "base")}점에서 아래 기준대로 더하고 빼 0~100점으로 자릅니다. ${liftOrders} 퀴즈·밥과 옷 질문 증감은 옷장의 값을 같이 씁니다.`}
        tables={orders}
      />
    </main>
  );
}

type Table = { id: string; title: string; when: string; rows: { label: string; code: number; value: number; edited: boolean }[] };

function Section({ title, intro, tables }: { title: string; intro: string; tables: Table[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-body font-semibold">{title}</h2>
      <p className="text-sm text-neutral-700">{intro}</p>
      {tables.map((t) => (
        <details key={t.id} className="border border-neutral-300" open={/rules$|age$/.test(t.id)}>
          <summary className="cursor-pointer bg-neutral-50 px-3 py-2 text-sm font-medium">
            {t.title} <span className="font-normal text-neutral-600">({t.rows.length}칸)</span>
          </summary>
          {t.when ? <p className="px-3 py-2 text-sm text-neutral-700">{t.when}</p> : null}
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={head}>항목</th>
                <th className={`${head} w-24 text-right`}>값</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={i}>
                  <td className={cell}>{r.label}</td>
                  <td className={`${cell} text-right font-mono tabular-nums`}>
                    {r.value}
                    {r.edited ? <span className="ml-2 text-xs text-[#7a1f2b]">수정됨 (코드 {r.code})</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </section>
  );
}
