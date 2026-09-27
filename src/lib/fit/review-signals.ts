import type { MeasurementKey } from "@/lib/constants/measurements";
import type { Direction, ReviewSignal } from "./types";

/**
 * 착용 후기에서 치수별 느낌을 읽는 규칙 v1(PROJECT_SPEC.md 16.2). AI 없이 항상 돌고 결과가 매번 같다.
 * 문장을 절로 나눈 뒤 절마다 "치수 + 방향"을 찾는다. 치수 없이 방향만 있으면 overall.
 * 부정("안 길다", "답답하지 않다")은 반대 방향으로 뒤집지 않고 good으로 본다(보수적).
 */

const DIMENSIONS: Array<[MeasurementKey, RegExp]> = [
  ["shoulder", /어깨/],
  ["chest", /가슴|(?<![제상작])품/],
  ["length", /총장|기장|길이/],
  ["sleeve", /소매|(?<!반)팔/],
  ["waist", /허리/],
  ["hip", /엉덩이|힙/],
  ["thigh", /허벅지/],
  ["rise", /밑위/],
  ["legOpening", /밑단/],
];

const NEGATED = /안\s*(길|짧|끼|낀|크|커|작|좁|넓|타이트|답답)|(길|짧|끼|크|작|좁|넓|답답하|타이트하)지\s*않/;
/** 이 표현이 있으면 다른 방향 낱말이 있어도 good(예: "여유 적당") */
const STRONG_GOOD = /적당|딱\s*(좋|맞)|딱맞|잘\s*맞|잘맞|마음에\s*[들드]|만족/;
const GOOD = /좋|괜찮|편하|편해|편안/;

const DIRECTIONS: Array<[Exclude<Direction, "good">, RegExp]> = [
  ["long", /길(?!이)(다|어|고|게|었|음|며|지|은|네)?|긴(?!장)/],
  ["short", /짧/],
  ["tight", /타이트|끼(다|어|고|는|네|임|이|인)|낀다|낀|작(다|아|고|은|네|음)|좁(다|아|고|은|네|음)|답답|붙(는|다|어|음)/],
  ["loose", /크(다|고|네|게)|커(요|서|다)|큰|넉넉|여유|오버|헐렁|넓(다|어|고|은|네|음)|떨어지/],
];

/** 절 나누기: 는데·지만·문장부호·그리고, "…고 총장은"처럼 새 주어가 오는 "고" */
const CLAUSE_SPLIT = /는데|지만|[,.!?;\n·]|그리고|(?<=[가-힣])고\s+(?=[가-힣]+[은는이가도]\s)/;

function strengthOf(clause: string): 1 | 2 | 3 {
  if (/조금|살짝|약간|좀/.test(clause)) return 1;
  if (/많이|너무|엄청|매우|아주|꽤/.test(clause)) return 3;
  return 2;
}

function directionOf(clause: string): Direction | null {
  if (NEGATED.test(clause) || STRONG_GOOD.test(clause)) return "good";
  // 낱말이 절에서 먼저 나온 방향을 쓴다.
  let found: { dir: Direction; at: number } | null = null;
  for (const [dir, re] of DIRECTIONS) {
    const m = re.exec(clause);
    if (m && (!found || m.index < found.at)) found = { dir, at: m.index };
  }
  if (found) return found.dir;
  return GOOD.test(clause) ? "good" : null;
}

/**
 * @param allowed 그 옷의 대분류에 있는 치수만(상의 후기의 "엉덩이를 덮는다"는 치수로 보지 않는다)
 */
export function extractReviewSignals(review: string | null | undefined, allowed: readonly MeasurementKey[]): ReviewSignal[] {
  if (!review?.trim()) return [];
  const signals: ReviewSignal[] = [];
  for (const raw of review.split(CLAUSE_SPLIT)) {
    const clause = raw.trim();
    if (clause.length < 2) continue;
    const direction = directionOf(clause);
    if (!direction) continue;
    const dims = DIMENSIONS.filter(([key, re]) => allowed.includes(key) && re.test(clause)).map(([key]) => key);
    const mentionsOther = DIMENSIONS.some(([key, re]) => !allowed.includes(key) && re.test(clause));
    // 다른 대분류 치수만 말하는 절(예: 상의 후기의 "엉덩이를 덮어서 적당")은 총장 이야기인 경우가 많아 무시하지 않고 overall로도 쓰지 않는다.
    if (!dims.length && mentionsOther) continue;
    const strength = direction === "good" ? 2 : strengthOf(clause);
    const evidence = clause.slice(0, 200);
    for (const dimension of dims.length ? dims : (["overall"] as const)) signals.push({ dimension, direction, strength, evidence });
  }
  return signals;
}

/** 이 치수에 불만(길다·짧다·끼다·크다)이 적혀 있는지. overall 불만은 모든 치수에 걸친다. */
export function negativeSignalsFor(signals: ReviewSignal[], key: MeasurementKey) {
  return signals.filter((s) => s.direction !== "good" && (s.dimension === key || s.dimension === "overall"));
}
