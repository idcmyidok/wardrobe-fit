import "server-only";
import type { BodyProfile } from "@/lib/fit/body-fit";
import type { Item } from "../analyze";
import type { OrderContext } from "../orders/context";
import { computeAxes, styling, type AxisOut } from "./axes";
import type { FlConfig } from "./config";
import { features, type Feat, type Mode } from "./feat";
import { ageCheck, shiftOf, type AgeCheck, type Shift } from "./life";
import { AXIS_KEYS, FITNESS, TYPE_DEFS, type AxisKey, type RuleId } from "./types";

/**
 * 패션 수준 평가 계산. 유형 판정 → 항목 비중·기준 조정 → 항목 점수 → 몰입 보너스 → 31~100점.
 * 같은 입력이면 같은 결과(난수 없음).
 */

export interface ActiveType {
  id: string;
  fitness: number;
  /** 섞는 비율(합 1) */
  share: number;
}

export interface Bonus {
  grade: "A" | "B" | "-";
  /** 보너스 상한 / 실제 점수 */
  max: number;
  points: number;
  /** 신호 세기, 제동(항목 받침) */
  strength: number;
  brake: number;
  by: string | null;
}

export interface Penalty {
  id: "common" | "fit" | "age";
  label: string;
  why: string;
  /** 깎는 점수(양수) */
  points: number;
}

export interface Evaluation {
  mode: Mode;
  F: Feat;
  types: ActiveType[];
  /** 모든 유형의 적합도(디버깅·관리자 확인용) */
  all: { id: string; fitness: number }[];
  weights: Record<AxisKey, number>;
  axes: Record<AxisKey, AxisOut & { points: number; weight: number }>;
  bonus: Bonus;
  penalties: Penalty[];
  /** 나이와 스타일(나이를 받았을 때) */
  age: AgeCheck | null;
  /** 구매 시기에 따른 변화(날짜 있는 옷이 충분할 때) */
  shift: Shift | null;
  /** 구매 흐름 가감점(최근 산 옷이 나아졌으면 +, 나빠졌으면 -) */
  shiftPoints: number;
  /** 항목 합계(0~100) */
  sum: number;
  /** 퀴즈 등을 더하기 전 원점수 */
  raw: number;
  score: number;
  lowData: boolean;
  /** 안목 비중을 절반으로 줄였는지 */
  tasteHalved: boolean;
}

/** 보너스를 받으려면 추가로 맞아야 하는 조건(마니아 브랜드일 때만 등) */
const BONUS_GATE: Record<string, (F: Feat) => boolean> = {
  street_hype: (F) => F.cult >= 0.2 || F.level(4, 6) >= 0.3,
  shoe_collector: (F) => F.cult >= 0.2 || F.level(4, 6) >= 0.3,
  one_brand: (F) => (F.topBrand ? (F.known.find((i) => i.brand!.name && F.topBrand!.ids.includes(i.id))?.brand!.pop ?? 5) <= 4 : false),
};

/** 표시 점수: floor + 100×scale×(원점수/100)^curve. 곡선이 1보다 크면 중간 점수가 내려가고 위쪽은 덜 내려간다. */
export const displayScore = (raw: number, T: { floor: number; scale: number; curve: number }) =>
  Math.round(T.floor + 100 * T.scale * Math.pow(Math.max(0, Math.min(100, raw)) / 100, T.curve));

export function evaluate(items: Item[], body: BodyProfile | null, mode: Mode, now: Date, C: FlConfig, orders?: OrderContext, age?: number | null): Evaluation {
  const F = features(items, body, mode, now, orders);
  const T = C.tune;

  // 1) 유형 판정
  const all = TYPE_DEFS.filter((d) => (d.mode === "both" || d.mode === mode) && C.types[d.id]?.enabled)
    .map((d) => ({ id: d.id, fitness: Math.max(0, Math.min(1, FITNESS[d.id]?.(F) ?? 0)) }))
    .sort((a, b) => b.fitness - a.fitness);
  const priority = new Map(TYPE_DEFS.map((d) => [d.id, d.priority]));
  // 같은 묶음(가격·브랜드/스타일/핏/습관)에서는 2개까지만: 한 사람을 여러 각도로 설명하게
  const groupOf = new Map(TYPE_DEFS.map((d) => [d.id, d.group]));
  const rank = (t: { id: string; fitness: number }) => t.fitness + (priority.get(t.id) ?? 0) * 0.03;
  const perGroup = new Map<string, number>();
  const picked: { id: string; fitness: number }[] = [];
  for (const t of all.filter((t) => t.fitness >= (C.types[t.id].threshold ?? T.threshold)).sort((a, b) => rank(b) - rank(a))) {
    const g = groupOf.get(t.id)!;
    if ((perGroup.get(g) ?? 0) >= 2) continue;
    perGroup.set(g, (perGroup.get(g) ?? 0) + 1);
    picked.push(t);
    if (picked.length >= T.maxTypes) break;
  }
  const bl = T.blend.slice(0, picked.length);
  const blSum = bl.reduce((a, b) => a + b, 0) || 1;
  const types: ActiveType[] = picked.map((t, i) => ({ ...t, share: bl[i] / blSum }));

  // 2) 항목 비중: 기본 비중 + 유형 변화(섞는 비율 만큼) → 최소 2로 막고 100으로 다시 맞춤
  const base = T.weights[mode];
  const w: Record<AxisKey, number> = { ...base };
  for (const k of AXIS_KEYS) for (const t of types) w[k] += (C.types[t.id].w[k] ?? 0) * t.share;
  // 3) 평가 기준: 유형 적합도에 비례해 켜진 기준(비중 합 > 0.35인 기준만 켠다)
  const ruleWeight = new Map<RuleId, number>();
  for (const t of types) for (const r of C.types[t.id].rules) ruleWeight.set(r, (ruleWeight.get(r) ?? 0) + t.share);
  const has = (r: RuleId) => (ruleWeight.get(r) ?? 0) >= 0.3;

  const raw = computeAxes(F, has);

  // 자료가 부족한 항목 처리
  const tasteHalved = F.known.length / Math.max(F.n, 1) < T.knownMin;
  if (tasteHalved) w.t *= 0.5;
  const lowData = mode === "orders" && F.n < T.ordersMin;
  if (lowData) w.x *= 0.5;
  for (const k of AXIS_KEYS) w[k] = Math.max(2, w[k]);
  for (const k of AXIS_KEYS) if (raw[k].value == null) w[k] = 0;
  const wSum = AXIS_KEYS.reduce((a, k) => a + w[k], 0) || 1;
  for (const k of AXIS_KEYS) w[k] = (w[k] / wSum) * 100;

  // 4) 보너스
  const cV = raw.c.value ?? 0.6;
  // 핏 점수는 0.5~1로 완화돼 있어 제동에는 원래 크기(0~1)로 되돌려 쓴다
  const fV = raw.f.value == null ? 0.6 : Math.max(0, (raw.f.value - 0.5) * 2);
  // 일관성·핏 중 낮은 쪽이 0.4 이하면 보너스 0, 0.7 이상이면 전부
  const brake = Math.max(0, Math.min(1, (Math.min(cV, fV) - 0.4) / 0.3));
  const premium = types.find((t) => t.id === "premium_seeker");
  if (premium && brake < 1 && raw.t.value != null) raw.t.value = Math.max(0, raw.t.value - (1 - brake) * 0.3);
  const gradeOf = (g: string) => (g === "A" ? 2 : g === "B" ? 1 : 0);
  const best = types.filter((t) => gradeOf(C.types[t.id].grade) > 0 && (BONUS_GATE[t.id]?.(F) ?? true)).sort((a, b) => gradeOf(C.types[b.id].grade) - gradeOf(C.types[a.id].grade) || b.fitness - a.fitness)[0];
  const bonus: Bonus = { grade: "-", max: 0, points: 0, strength: 0, brake, by: null };
  if (best) {
    const g = C.types[best.id].grade as "A" | "B";
    const designer = F.group("designer") + F.group("luxury") + F.group("contemporary") * 0.6;
    const strength = Math.min(1, 0.35 * Math.min(1, designer / 0.5) + 0.2 * Math.min(1, F.level(5, 6) / 0.4) + 0.2 * Math.min(1, F.cult / 0.4) + 0.15 * Math.min(1, F.usedShop / 0.4) + 0.1 * Math.min(1, F.heritage / 0.4) + 0.1 * Math.min(1, F.topBrand ? F.topBrand.share / 0.6 : 0));
    const max = T.bonus[mode][g];
    // 유형 자체의 뚜렷함(0.6~1)과 신호 세기를 섞는다. 신호가 약해도 유형이 뚜렷하면 일부는 받는다.
    const mix = 0.45 * best.fitness + 0.55 * Math.max(strength, best.fitness * 0.6);
    bonus.grade = g;
    bonus.max = max;
    bonus.strength = strength;
    bonus.by = best.id;
    bonus.points = Math.round(max * Math.min(1, mix) * brake * 10) / 10;
  }

  // 5) 점수
  const axes = {} as Evaluation["axes"];
  let sum = 0;
  for (const k of AXIS_KEYS) {
    const v = raw[k].value;
    const points = v == null ? 0 : v * w[k];
    sum += points;
    axes[k] = { ...raw[k], points, weight: w[k] };
  }
  // 6) 감점
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const pct = (v: number) => Math.round(v * 100);
  const common = F.kshare((i) => i.groups.includes("spa") || i.groups.includes("mass") || i.brand!.trend >= 4 || i.brand!.labels.includes("무신사 인기"));
  const penalties: Penalty[] = [];
  // 흔한 브랜드여도 잘 골라 입으면(코디력 0.75 이상) 감점 없음
  const st = styling(F, has)?.value ?? 0.5;
  const pc = Math.round(T.penalty.common * clamp((common - 0.35) / 0.4) * clamp((0.75 - st) / 0.3) * (1 - bonus.points / Math.max(bonus.max, 1)) * 10) / 10;
  if (pc > 0) penalties.push({ id: "common", label: "흔한 옷장", why: `SPA·대중·인기 브랜드 ${pct(common)}% · 코디력 ${pct(st)}`, points: pc });
  const pf = Math.round(T.penalty.fit * clamp(F.fits.bad / 0.4) * 10) / 10;
  if (pf > 0) penalties.push({ id: "fit", label: "핏 실패", why: `너무 크거나 작은 옷 ${pct(F.fits.bad)}%`, points: pf });
  const ac = ageCheck(F, age);
  const pa = ac ? Math.round(T.penalty.age * ac.severity * 10) / 10 : 0;
  if (ac && pa > 0) penalties.push({ id: "age", label: "나이와 안 맞는 스타일", why: `${ac.age}살 · 옷장 나이 ${ac.styleAge}살 · 어려 보이는 옷 ${pct(ac.young)}% · 나이 들어 보이는 옷 ${pct(ac.old)}%`, points: pa });
  const minus = penalties.reduce((a, p) => a + p.points, 0);
  const shift = shiftOf(F);
  const shiftPoints = shift ? Math.round(T.shift * Math.max(-1, Math.min(1, shift.quality / 0.25)) * 10) / 10 : 0;

  const rawScore = Math.max(0, Math.min(100, sum + bonus.points - minus + shiftPoints));
  return { mode, F, types, all, weights: w, axes, bonus, penalties, age: ac, shift, shiftPoints, sum, raw: rawScore, score: displayScore(rawScore, T), lowData, tasteHalved };
}
