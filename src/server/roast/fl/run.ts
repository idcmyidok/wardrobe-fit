import "server-only";
import type { BodyProfile } from "@/lib/fit/body-fit";
import type { Garment } from "@/lib/types/domain";
import { prepare } from "../analyze";
import type { OrderContext } from "../orders/context";
import type { FlConfig } from "./config";
import { evaluate, type Evaluation } from "./engine";
import type { Mode } from "./feat";
import { buildPlan, buildReport, type Built, type Plan } from "./script";

/** 훈수를 받으려면 모자·신발을 뺀 옷이 이만큼 있어야 한다 */
export const MIN_CLOTHES = 30;

export interface Run {
  ev: Evaluation;
  /** 모자·신발을 뺀 옷 수 */
  clothes: number;
  brandNames: string[];
}

/** 옷 목록 → 평가. 옷장과 주문내역이 같이 쓴다. */
export function runEvaluation(garments: Garment[], body: BodyProfile | null, usdRate: number, mode: Mode, C: FlConfig, orders?: OrderContext): Run {
  const items = prepare(garments, body, usdRate);
  const ev = evaluate(items, body, mode, new Date(), C, orders);
  return {
    ev,
    clothes: items.filter((i) => !i.accessory).length,
    brandNames: [...new Set(items.flatMap((i) => (i.brand ? [i.brand.name] : [])))],
  };
}

export function planOf(run: Run, C: FlConfig, seed: number, name: string | null): Plan {
  return buildPlan(run.ev, C, seed, name, run.brandNames);
}

export function resultOf(run: Run, C: FlConfig, seed: number, name: string | null, answers: Record<string, string>, opts: { admin: boolean; partial: boolean }): { plan: Plan; built: Built } {
  const plan = planOf(run, C, seed, name);
  return { plan, built: buildReport(run.ev, C, seed, plan.asked, answers, opts) };
}
