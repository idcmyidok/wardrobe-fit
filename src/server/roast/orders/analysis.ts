import "server-only";
import type { Garment } from "@/lib/types/domain";
import { analyze, type Analysis } from "../analyze";
import type { ScoreRules } from "../score-deltas";
import type { OrderContext } from "./context";
import { ORDER_SKIP_PATTERNS } from "./texts";

/** 주문내역 옷으로 분석: 무지 티도 빼지 않고, 주문내역과 안 맞는 패턴은 뺀 뒤 주문내역 정보를 붙인다. */
export function analyzeOrders(garments: Garment[], ctx: OrderContext, usdRate: number, now = new Date(), rules?: Partial<ScoreRules>): Analysis {
  const a = analyze(garments, null, usdRate, now, rules, { keepBasics: true });
  a.patterns = a.patterns.filter((p) => !ORDER_SKIP_PATTERNS.has(p.id));
  a.orders = ctx;
  return a;
}
