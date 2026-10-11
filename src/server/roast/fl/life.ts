import "server-only";
import type { Item } from "../analyze";
import type { Feat } from "./feat";

/**
 * 나이와 구매 시기로 보는 분석.
 * - 나이: 옷마다 "어려 보이는 옷"·"나이 들어 보이는 옷"을 가려 옷장 나이를 어림하고, 실제 나이와 크게 어긋나면 감점·질문.
 * - 구매 시기: 최근 1년에 산 옷과 2년 이상 앞서 산 옷을 비교하고, 가장 크게 바뀐 점을 짚는다.
 * 문장은 설계(FlConfig.life)에서 고친다.
 */

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const pct = (v: number) => Math.round(v * 100);

const YOUNG_TAGS = ["Y2K", "스케이트", "펑크", "그런지", "키치", "서브컬처", "영스트릿", "유스 스트릿", "유스", "레이브 스트릿", "사이버그런지", "클럽웨어", "키치 그래픽", "게임 그래픽"];
const OLD_TAGS = ["골프", "조용한 럭셔리", "트래디셔널", "비즈니스 캐주얼"];
const YOUNG_WORD = /캐릭터|크롭|y2k|레터링|빅 ?로고|스마일|곰돌이|키링|big ?logo|cartoon/i;
const OLD_WORD = /골프|등산|트레킹|정장|양복|수트|suit|golf/i;

/** 어려 보이는 옷: 서브컬처 태그, 하이프 스트릿, 로고 스트릿, 캐릭터·크롭 같은 이름 */
export function looksYoung(i: Item): boolean {
  if (YOUNG_WORD.test(i.g.productName)) return true;
  const b = i.brand;
  if (!b) return false;
  if (b.tags.some((t) => YOUNG_TAGS.includes(t))) return true;
  return i.groups.includes("street") && (b.hype >= 4 || b.tags.includes("로고플레이"));
}

/** 나이 들어 보이는 옷: 골프·정장·등산, 아주 포멀하고 유행을 안 타는 브랜드, 등산 위주 아웃도어 */
export function looksOld(i: Item): boolean {
  if (OLD_WORD.test(i.g.productName)) return true;
  const b = i.brand;
  if (!b) return false;
  if (b.tags.some((t) => OLD_TAGS.includes(t))) return true;
  if (b.formal >= 4 && b.trend <= 2) return true;
  return i.groups.includes("outdoor") && b.trend <= 2 && !b.tags.includes("고프코어");
}

export type AgeVerdict = "young" | "old" | "fits";
export interface AgeCheck {
  age: number;
  styleAge: number;
  verdict: AgeVerdict;
  /** 0~1: 어긋난 정도 */
  severity: number;
  young: number;
  old: number;
  youngIds: string[];
  oldIds: string[];
}

export function ageCheck(F: Feat, age: number | null | undefined): AgeCheck | null {
  if (age == null || !F.clothes.length) return null;
  const youngL = F.clothes.filter(looksYoung);
  const oldL = F.clothes.filter((i) => !looksYoung(i) && looksOld(i));
  const young = youngL.length / F.clothes.length;
  const old = oldL.length / F.clothes.length;
  const styleAge = Math.round(Math.max(16, Math.min(60, 25 + 32 * old - 16 * young)));
  let verdict: AgeVerdict = "fits";
  let severity = 0;
  if (age >= 29 && young >= 0.3) {
    verdict = "young";
    severity = clamp((young - 0.25) / 0.3) * clamp((age - 26) / 9);
  } else if (age <= 26 && old >= 0.2) {
    verdict = "old";
    severity = clamp((old - 0.15) / 0.3) * clamp((31 - age) / 9);
  }
  return { age, styleAge, verdict, severity, young, old, youngIds: youngL.map((i) => i.id), oldIds: oldL.map((i) => i.id) };
}

// ───────────── 구매 시기 ─────────────

const NEUTRAL = new Set(["블랙", "그레이", "화이트", "베이지", "브라운", "카키", "네이비", "데님"]);
const LOGO = /로고|그래픽|프린트|레터링|아트웍|캐릭터|graphic|logo|print|lettering/i;

interface Metric {
  id: string;
  /** 문장 {what}에 들어가는 이름 */
  name: string;
  /** 분모(이 옷들 중에서) */
  base: (i: Item) => boolean;
  hit: (i: Item) => boolean;
  /** 늘면 좋아지는 쪽(+1), 나빠지는 쪽(-1), 상관없음(0) */
  good: number;
}

const METRICS: Metric[] = [
  { id: "neutral", name: "무채색·기본색 옷", base: (i) => Boolean(i.color), hit: (i) => NEUTRAL.has(i.color!), good: 1 },
  { id: "logo", name: "로고·그래픽 옷", base: (i) => i.cat === "top", hit: (i) => LOGO.test(i.g.productName), good: -1 },
  { id: "street", name: "스트릿 브랜드", base: (i) => Boolean(i.brand), hit: (i) => i.groups.includes("street"), good: 0 },
  { id: "minimal", name: "미니멀·베이직 브랜드", base: (i) => Boolean(i.brand), hit: (i) => i.brand!.tags.some((t) => t === "미니멀" || t === "베이직"), good: 1 },
  { id: "spa", name: "SPA·대중 브랜드", base: (i) => Boolean(i.brand), hit: (i) => i.groups.includes("spa") || i.groups.includes("mass"), good: -1 },
  { id: "high", name: "중고가 이상 브랜드", base: (i) => Boolean(i.brand), hit: (i) => i.brand!.price >= 4, good: 1 },
  { id: "young", name: "어려 보이는 옷", base: () => true, hit: looksYoung, good: 0 },
];

export type ShiftVerdict = "grown" | "slipped" | "changed" | "steady";
export interface Shift {
  verdict: ShiftVerdict;
  then: string;
  now: string;
  /** 가장 크게 바뀐 점(steady면 없음) */
  what?: string;
  before?: number;
  after?: number;
  /** 최근 옷 중 바뀐 쪽을 보여 줄 옷 */
  ids: string[];
  /** 좋아진 정도(-1~1) */
  quality: number;
}

const period = (list: Item[]) => {
  const ys = list.map((i) => new Date(i.date!).getFullYear());
  const a = Math.min(...ys);
  const b = Math.max(...ys);
  return a === b ? `${a}년` : `${a}~${b}년`;
};

export function shiftOf(F: Feat): Shift | null {
  const dated = F.clothes.filter((i) => i.date && !Number.isNaN(Date.parse(i.date))).sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!));
  if (dated.length < 10) return null;
  // 최근 1년에 산 옷과 그보다 2년 이상 앞서 산 옷만 비교한다(사이에 최소 1년, 평균 2~3년 간격). 최근 몇 년만 입력했으면 비교하지 않는다.
  const last = Date.parse(dated.at(-1)!.date!);
  const YEAR = 365 * 86_400_000;
  const after = dated.filter((i) => Date.parse(i.date!) > last - YEAR);
  const before = dated.filter((i) => Date.parse(i.date!) <= last - 2 * YEAR);
  if (before.length < 5 || after.length < 5) return null;
  const shareIn = (list: Item[], m: Metric) => {
    const b = list.filter(m.base);
    return b.length >= 4 ? b.filter(m.hit).length / b.length : null;
  };
  const rows = METRICS.map((m) => ({ m, a: shareIn(before, m), b: shareIn(after, m) })).filter((x): x is { m: Metric; a: number; b: number } => x.a != null && x.b != null);
  if (!rows.length) return null;
  const quality = Math.max(-1, Math.min(1, rows.reduce((s, x) => s + x.m.good * (x.b - x.a), 0) / 2));
  const big = [...rows].sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a))[0];
  let then = period(before);
  let now = period(after);
  if (then === now) {
    then = "예전";
    now = "최근";
  }
  const changed = Math.abs(big.b - big.a) >= 0.2;
  const verdict: ShiftVerdict = quality >= 0.08 ? "grown" : quality <= -0.08 ? "slipped" : changed ? "changed" : "steady";
  const up = big.b >= big.a;
  return {
    verdict,
    then,
    now,
    quality,
    ...(verdict !== "steady" ? { what: big.m.name, before: pct(big.a), after: pct(big.b) } : {}),
    ids: verdict === "steady" ? [] : after.filter((i) => big.m.base(i) && big.m.hit(i) === up).map((i) => i.id),
  };
}

export const DEFAULT_LIFE_TEXT = {
  ageStatus: ["나이 얘기 좀 하죠. 물어본 데는 이유가 있습니다.", "{age}살이라고 하셨죠. 옷장이랑 맞춰 보겠습니다."],
  age: {
    young: [
      "{age}살이신데 옷장 나이는 {styleAge}살쯤입니다. 어려 보이는 옷이 {youngPct}%예요. 동안 소리 듣고 싶으신 건 알겠는데, 옷이 먼저 늙지 않는 법은 없습니다.",
      "{age}살 옷장에 어려 보이는 옷이 {youngPct}%입니다. 대학 축제 다시 가셔도 위화감이 없겠네요. 회사에서는 좀 있겠지만.",
    ],
    old: [
      "{age}살인데 옷장 나이는 {styleAge}살입니다. 나이 들어 보이는 옷이 {oldPct}%예요. 아버지 옷장이랑 합치신 건 아니죠?",
      "{age}살 옷장에 골프장·등산로·사무실 느낌 옷이 {oldPct}%입니다. 점잖은 건 좋은데 너무 일찍 철드셨네요.",
    ],
    fits: [
      "{age}살에 옷장 나이 {styleAge}살. 나이에 맞게 입으시네요. 재미는 없지만 안전합니다.",
      "나이랑 옷장이 크게 어긋나진 않습니다. 이 부분은 놀릴 게 없어서 아쉽네요.",
    ],
  },
  shiftStatus: ["산 시기별로 옷장을 나눠 봤습니다.", "언제 뭘 샀는지 보면 사람이 보이죠."],
  shift: {
    grown: [
      "{then}에 산 옷은 {what|이} {before}%였는데, {now}에 산 옷은 {after}%입니다. 최근 고르는 눈이 나아졌어요. 예전 옷은 흑역사로 묻어 두시죠.",
      "{then}보다 {now}에 산 옷이 낫습니다. {what} {before}% → {after}%. 늦게라도 배우셨네요.",
    ],
    slipped: [
      "{then}에 산 옷은 {what|이} {before}%였는데, {now}에 산 옷은 {after}%입니다. 예전이 더 나았어요. 요즘 무슨 일 있으셨어요?",
      "{now}에 산 옷이 {then} 옷보다 못합니다. {what} {before}% → {after}%. 감이 녹슬고 있네요.",
    ],
    changed: [
      "{then}에 산 옷은 {what|이} {before}%, {now}에는 {after}%입니다. 취향이 바뀐 건지 그냥 흔들린 건지는 본인만 아시겠죠.",
      "{then}과 {now} 사이에 {what} 비율이 {before}%에서 {after}%로 바뀌었습니다. 갈아타는 중이시군요.",
    ],
    steady: [
      "{then}이나 {now}이나 사는 옷이 거의 같습니다. 일관성이라고 해 드릴게요. 정체라는 말도 있지만.",
    ],
  },
};
export type LifeText = typeof DEFAULT_LIFE_TEXT;
export const AGE_VERDICTS = ["young", "old", "fits"] as const;
export const SHIFT_VERDICTS = ["grown", "slipped", "changed", "steady"] as const;
export const AGE_NAME: Record<AgeVerdict, string> = { young: "나이보다 어리게 입을 때(29살 이상, 어려 보이는 옷 30% 이상)", old: "나이보다 나이 들게 입을 때(26살 이하, 나이 들어 보이는 옷 20% 이상)", fits: "나이에 맞을 때" };
export const SHIFT_NAME: Record<ShiftVerdict, string> = { grown: "최근 산 옷이 더 나을 때", slipped: "최근 산 옷이 더 못할 때", changed: "크게 바뀌었지만 좋고 나쁨은 없을 때", steady: "거의 안 바뀌었을 때" };

/** 문장 자리 값 */
export function lifeVars(a: AgeCheck | null, s: Shift | null) {
  return {
    ...(a ? { age: a.age, styleAge: a.styleAge, youngPct: pct(a.young), oldPct: pct(a.old) } : {}),
    ...(s ? { then: s.then, now: s.now, ...(s.what ? { what: s.what, before: s.before!, after: s.after! } : {}) } : {}),
  };
}
