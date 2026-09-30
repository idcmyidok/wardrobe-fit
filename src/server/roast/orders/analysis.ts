import "server-only";
import type { Garment } from "@/lib/types/domain";
import { analyze, type Analysis } from "../analyze";
import type { ScoreRules } from "../score-deltas";
import type { OrderContext } from "./context";

/** 주문내역에서는 말이 안 되는 옷장 패턴(옷장 크기, 쇼핑몰 쏠림 = 전부 무신사, 계절·실측·핏 기반) */
const SKIP_PATTERNS = new Set(["count_small", "count_many", "count_huge", "shop_focus", "musinsa_kr", "season_bias", "measure_repeat", "fit_bias", "same_fit"]);

/** 주문내역 옷으로 분석: 무지 티도 빼지 않고, 주문내역과 안 맞는 패턴은 뺀 뒤 주문내역 정보를 붙인다. */
export function analyzeOrders(garments: Garment[], ctx: OrderContext, usdRate: number, now = new Date(), rules?: Partial<ScoreRules>): Analysis {
  const a = analyze(garments, null, usdRate, now, rules, { keepBasics: true });
  a.patterns = a.patterns.filter((p) => !SKIP_PATTERNS.has(p.id));
  a.orders = ctx;
  return a;
}
