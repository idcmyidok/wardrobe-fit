import "server-only";
import type { RoastQuestion, RoastReport, RoastScript, RoastStep } from "@/lib/roast/types";
import type { Item } from "../analyze";
import { fill, MissingVar, rng, type Rng, type Vars } from "../text";
import type { FlConfig } from "./config";
import { displayScore, type Evaluation } from "./engine";
import { buildSpecials, type AskedQuestion } from "./special";
import { AXIS_KEYS, AXIS_NAME, type AxisKey } from "./types";
import { typeVars } from "./vars";

/**
 * 평가 결과 → 대화(script)와 결과 페이지(report). 같은 seed면 같은 문장이 나온다.
 * 구조(순서·켜기)와 문장, 숫자는 모두 설계(FlConfig)에서 읽는다.
 */

/** 유형 이야기에 붙일 옷 사진 기준(없으면 사진 없음) */
const PHOTO_OF: Record<string, (i: Item) => boolean> = {
  spa: (i) => i.groups.includes("spa"),
  premium_seeker: (i) => (i.brand?.price ?? 0) >= 4,
  designer_maniac: (i) => i.groups.some((g) => g === "designer" || g === "contemporary" || g === "luxury"),
  indie_finder: (i) => (i.brand?.pop ?? 9) <= 2,
  heritage_vintage: (i) => i.groups.includes("heritage"),
  vintage_collector: (i) => i.shop === "후르츠패밀리" || i.shop === "번개장터" || i.brandKind === "vintage",
  allblack: (i) => i.achromatic,
  colorful: (i) => Boolean(i.color) && !i.achromatic && !i.denim,
  denim_maniac: (i) => i.denim,
  shoe_collector: (i) => i.cat === "shoes",
  outer_focus: (i) => i.cat === "outer",
  hat_acc: (i) => i.cat === "hat",
  street_hype: (i) => i.groups.includes("street"),
  workwear: (i) => i.groups.includes("jp_denim") || (i.brand?.tags ?? []).some((t) => ["워크웨어", "아메카지", "밀리터리"].includes(t)),
  outdoor_gorp: (i) => i.groups.includes("outdoor"),
  sports_daily: (i) => i.groups.includes("sports"),
};
const MAX_PHOTOS = 12;

/** 틀 중 채울 수 있는 것 하나 */
function tryFill(r: Rng, templates: readonly string[], vars: Vars): string | null {
  for (const t of r.shuffle(templates)) {
    try {
      return fill(t, vars);
    } catch (e) {
      if (!(e instanceof MissingVar)) throw e;
    }
  }
  return null;
}
/** 채울 수 있는 틀을 개수만큼(겹치지 않게) */
function fillN(r: Rng, templates: readonly string[], vars: Vars, n: number): string[] {
  const out: string[] = [];
  for (const t of r.shuffle(templates)) {
    if (out.length >= n) break;
    try {
      out.push(fill(t, vars));
    } catch (e) {
      if (!(e instanceof MissingVar)) throw e;
    }
  }
  return out;
}

export type Tier = "high" | "mid" | "low";
export const tierOf = (score: number, C: FlConfig): Tier => (score >= C.tune.tierHigh ? "high" : score < C.tune.tierLow ? "low" : "mid");

/** 항목 점수 구간 */
const bandOfAxis = (v: number): "low" | "mid" | "high" => (v < 0.45 ? "low" : v < 0.72 ? "mid" : "high");

/** 가장 높은/낮은 항목(자료 있는 것만) */
function extremes(ev: Evaluation): { best: AxisKey; worst: AxisKey } | null {
  const have = AXIS_KEYS.filter((k) => ev.axes[k].value != null);
  if (have.length < 2) return null;
  const sorted = [...have].sort((a, b) => ev.axes[b].value! - ev.axes[a].value!);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

const axisName = (ev: Evaluation, k: AxisKey) => AXIS_NAME[k][ev.mode];

export interface Plan {
  script: RoastScript;
  asked: AskedQuestion[];
}

export function buildPlan(ev: Evaluation, C: FlConfig, seed: number, name: string | null, brandNames: string[]): Plan {
  const r = rng(seed);
  const steps: RoastStep[] = [];
  const say = (text: string, photos?: string[], gap?: boolean) => steps.push({ t: "say", text, ...(photos?.length ? { photos } : {}), ...(gap ? { gap: true } : {}) });
  const tier = tierOf(ev.score, C);
  const asked = buildSpecials({ items: ev.F.items, brandNames }, r, C, tier);
  const V = typeVars(ev);
  const T = C.tune;

  for (const b of C.talk) {
    if (!b.on) continue;
    if (b.id === "greet") {
      if (name && r.next() < 0.6) {
        const t = tryFill(r, C.common.NAME_GREETING, { name });
        if (t) say(t);
      }
    } else if (b.id === "scan") {
      const t = tryFill(r, C.common.SCAN_OPEN, { n: ev.F.n });
      if (t) say(t);
    } else if (b.id === "types") {
      const talk = ev.types.slice(0, T.talkTypes);
      if (!talk.length) {
        const t = tryFill(r, C.common.NO_TYPE, V);
        if (t) say(t, undefined, true);
      }
      talk.forEach((ty, idx) => {
        const conf = C.types[ty.id];
        const status = tryFill(r, C.common.TYPE_STATUS, { type: conf.name });
        if (status) steps.push({ t: "status", text: status, gap: true });
        const lines = fillN(r, conf.lines.say, V, T.talkLines);
        const pic = PHOTO_OF[ty.id];
        const photos = pic ? ev.F.items.filter((i) => i.hasPhoto && pic(i)).slice(0, MAX_PHOTOS).map((i) => i.id) : [];
        lines.forEach((l, k) => say(l, k === 0 ? photos : undefined, status ? false : k === 0 && idx > 0));
      });
    } else if (b.id === "axes") {
      const ex = extremes(ev);
      if (ex) {
        const st = tryFill(r, C.common.AXIS_STATUS, V);
        if (st) steps.push({ t: "status", text: st, gap: true });
        const lines = (k: AxisKey, kind: "high" | "low") => {
          const g = C.axisLines[k];
          const band = bandOfAxis(ev.axes[k].value!);
          const main = tryFill(r, g[kind === "high" ? (band === "low" ? "mid" : band) : band === "high" ? "mid" : band], { axis: axisName(ev, k), score: Math.round(ev.axes[k].points) });
          const extra = tryFill(r, kind === "high" ? g.praise : g.tip, { axis: axisName(ev, k) });
          return [main, extra].filter((x): x is string => Boolean(x)).join(" ");
        };
        const best = lines(ex.best, "high");
        if (best) say(best);
        const worst = lines(ex.worst, "low");
        if (worst) say(worst);
      }
    } else if (b.id === "bonus") {
      if (ev.bonus.points >= 1) {
        const t = tryFill(r, C.common.BONUS_SAY, { grade: ev.bonus.grade, points: Math.round(ev.bonus.points) });
        if (t) say(t, undefined, true);
      }
    } else if (b.id === "questions") {
      asked.forEach((_, i) => {
        steps.push({ t: "think" });
        steps.push({ t: "ask", q: i });
      });
    } else if (b.id === "wrap") {
      steps.push({ t: "think" });
      const t = tryFill(r, C.common.WRAP_UP, V);
      if (t) say(t);
    }
  }

  const questions: RoastQuestion[] = asked.map((q) => ({
    id: q.id,
    lead: q.lead,
    text: q.text,
    options: q.options,
    reactions: q.reactions,
    photos: q.photos,
    ...(q.leadPhotos ? { leadPhotos: q.leadPhotos } : {}),
    ...(q.answer != null ? { answer: q.answer } : {}),
  }));
  return { script: { seed, steps, questions }, asked };
}

export interface Built {
  report: RoastReport;
  closing: string[];
  /** 퀴즈 답이 더한 점수 */
  quizDelta: number;
}

export function buildReport(ev: Evaluation, C: FlConfig, seed: number, asked: AskedQuestion[], answers: Record<string, string>, opts: { admin: boolean; partial: boolean }): Built {
  const r = rng(seed ^ 0x5bd1e995);
  const V = typeVars(ev);
  const T = C.tune;

  // 퀴즈 답이 원점수에 더하는 값
  let quizDelta = 0;
  for (const q of asked) {
    const a = answers[q.id];
    const key = a && q.scoreKey?.[a];
    if (key === "right") quizDelta += T.quizRight;
    else if (key === "wrong") quizDelta += T.quizWrong;
  }
  const raw = Math.max(0, Math.min(100, ev.raw + quizDelta));
  const score = displayScore(raw, T);

  const band = C.bands.find((b) => score <= b.max) ?? C.bands[C.bands.length - 1];
  const headline = tryFill(r, band.say, { score }) ?? `${score}점, ${band.name}입니다.`;

  // 패션 유형 목록
  const multi = ev.types.length > 1;
  const typeItems = ev.types.map((t) => `${C.types[t.id].name}${multi ? ` (${Math.round(t.share * 100)}%)` : ""}`);
  const lists = typeItems.length ? [{ title: "나의 패션 유형", items: typeItems }] : [];

  // 유형별 진단
  const points: RoastReport["points"] = [];
  const talkOrder = new Set<string>();
  for (const t of ev.types) {
    talkOrder.add(t.id);
    const conf = C.types[t.id];
    const text = [tryFill(r, conf.lines.say, V), tryFill(r, conf.lines.praise, V), tryFill(r, conf.lines.tip, V)].filter(Boolean).join(" ");
    const pic = PHOTO_OF[t.id];
    const photos = pic ? ev.F.items.filter((i) => i.hasPhoto && pic(i)).slice(0, 40).map((i) => i.id) : [];
    if (text) points.push({ id: `type-${t.id}`, lead: conf.name, text, ...(photos.length ? { photos } : {}) });
  }
  if (!points.length) {
    const t = tryFill(r, C.common.NO_TYPE, V);
    if (t) points.push({ id: "type-none", lead: "기본형", text: t });
  }
  // 질문 답 (퀴즈·특수 질문)
  for (const q of asked) {
    const a = answers[q.id];
    const pool = a ? q.roast[a] : undefined;
    if (!pool?.length) continue;
    points.push({ id: `ask-${q.id}`, lead: "", text: r.pick(pool) });
  }

  // 항목별 점수
  const ex = extremes(ev);
  const axes = AXIS_KEYS.filter((k) => ev.axes[k].value != null).map((k) => {
    const g = C.axisLines[k];
    const bd = bandOfAxis(ev.axes[k].value!);
    const base = tryFill(r, g[bd], { axis: axisName(ev, k), score: Math.round(ev.axes[k].points) }) ?? "";
    const extra = ex && ex.worst === k ? tryFill(r, g.tip, { axis: axisName(ev, k) }) : ex && ex.best === k ? tryFill(r, g.praise, { axis: axisName(ev, k) }) : null;
    return { label: axisName(ev, k), score: Math.round(ev.axes[k].points), max: Math.round(ev.axes[k].weight), text: [base, extra].filter(Boolean).join(" ") };
  });

  const notes: string[] = [];
  const known = ev.F.known.length;
  if (ev.F.n) notes.push(`브랜드 정보가 있는 옷 ${known}벌 기준으로 계산했습니다.`);
  if (ev.tasteHalved) notes.push("브랜드 정보가 있는 옷이 적어 안목 항목의 비중을 절반으로 줄였습니다.");
  if (ev.lowData) {
    const t = tryFill(r, C.common.LOW_DATA, V);
    if (t) notes.push(t);
  }
  if (ev.mode === "orders") {
    const t = tryFill(r, C.common.ORDERS_NOTE, V);
    if (t) notes.push(t);
  }
  if (opts.partial) notes.push("질문에 끝까지 답하지 않은 결과입니다.");

  const summaryType = ev.types.slice(0, 2).map((t) => C.types[t.id].name).join(" · ");
  const summary = ex ? `${summaryType || "특별히 한쪽으로 몰리지 않은 옷장"}. 가장 강한 항목은 ${axisName(ev, ex.best)}, 아쉬운 항목은 ${axisName(ev, ex.worst)}입니다.` : summaryType || undefined;

  const detail: RoastReport["scoreDetail"] | undefined = opts.admin
    ? {
        base: 0,
        items: [
          ...AXIS_KEYS.filter((k) => ev.axes[k].value != null).map((k) => ({ label: axisName(ev, k), why: `${ev.axes[k].why} · 비중 ${Math.round(ev.axes[k].weight)}`, delta: ev.axes[k].points })),
          ...(ev.bonus.points ? [{ label: `몰입 보너스 ${ev.bonus.grade} (${ev.bonus.by ? C.types[ev.bonus.by].name : ""})`, why: `상한 ${ev.bonus.max} · 신호 ${Math.round(ev.bonus.strength * 100)}% · 제동 ${Math.round(ev.bonus.brake * 100)}%`, delta: ev.bonus.points }] : []),
          ...ev.penalties.map((p) => ({ label: `감점: ${p.label}`, why: p.why, delta: -p.points })),
          ...(quizDelta ? [{ label: "퀴즈 답", why: "", delta: quizDelta }] : []),
          ...(() => {
            const plain = ev.sum + ev.bonus.points - ev.penalties.reduce((a, p) => a + p.points, 0) + quizDelta;
            return raw !== plain ? [{ label: raw > plain ? "0점 하한" : "100점 상한", why: "", delta: raw - plain }] : [];
          })(),
          { label: `표시 점수 환산 (${T.floor} + ${Math.round(100 * T.scale)} × (원점수/100)^${T.curve})`, why: `원점수 ${Math.round(raw * 10) / 10}`, delta: score - raw },
        ],
        total: score,
      }
    : undefined;

  const REPORT_KEY: Record<string, string> = { types: "lists", points: "points", axes: "axes", notes: "notes" };
  const order = C.report.filter((b) => b.on).map((b) => REPORT_KEY[b.id]).filter(Boolean);

  const report: RoastReport = {
    headline,
    lists,
    total: { score },
    points,
    axes,
    ...(summary ? { summary } : {}),
    notes,
    ...(detail ? { scoreDetail: detail } : {}),
    order,
  };
  const closing = r.shuffle(C.common.CLOSING).slice(0, 2 + Math.floor(r.next() * 2));
  return { report, closing, quizDelta };
}

void typeVars;
