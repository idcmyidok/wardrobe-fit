import "server-only";
import type { Item } from "../analyze";
import { findBand } from "../bands";
import { pickQuiz } from "../quiz";
import { fill, MissingVar, type Rng, type Vars } from "../text";
import type { FlConfig } from "./config";

/**
 * 남겨 둔 특수 질문(재미용). 조건이 맞으면 꼭 묻는다.
 * 브랜드 퀴즈(가진 브랜드 중 문제가 있는 브랜드), 밴드 퀴즈, 언더아머 "3대 500", 침착맨, 짱구(같은 옷 3벌 이상),
 * 그리고 마지막 "스스로 패셔너블한가요?". 그 밖의 옛 질문은 모두 없앴다.
 */

export interface AskedQuestion {
  id: string;
  lead: string[];
  text: string;
  options: { id: string; label: string; photoId?: string; photoIds?: string[]; amount?: string }[];
  reactions: Record<string, string>;
  /** 선택지 id별 결과 글 문단 후보(채운 문장) */
  roast: Record<string, string[]>;
  photos: string[];
  leadPhotos?: Record<number, string[]>;
  answer?: string;
  quizId?: string;
  /** 퀴즈 정답·오답 판정용(선택지 id → right/wrong) */
  scoreKey?: Record<string, string>;
}

export interface SpecialInput {
  items: Item[];
  brandNames: string[];
}

const photoIds = (items: Item[], ids: string[]) => items.filter((i) => ids.includes(i.id) && i.hasPhoto).map((i) => i.id);
const sameName = (s: string) => s.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");

/** 같은 옷(같은 분류·이름·색) 3벌 이상 */
export function twinsOf(items: Item[]): { name: string; color: string; list: Item[] } | null {
  const m = new Map<string, Item[]>();
  for (const i of items) {
    if (!i.color || sameName(i.g.productName).length < 2) continue;
    const k = `${i.cat}|${sameName(i.g.productName)}|${i.color}`;
    m.set(k, [...(m.get(k) ?? []), i]);
  }
  const top = [...m.values()].sort((a, b) => b.length - a.length)[0];
  return top && top.length >= 3 ? { name: top[0].g.productName, color: top[0].color!, list: top } : null;
}

const isChim = (i: Item) => i.brand?.name === "CHIMCHAKMAN" || i.brand?.name === "얼렁뚱땅 상점";

const fillAll = (list: string[] | undefined, v: Vars) =>
  (list ?? []).flatMap((t) => {
    try {
      return [fill(t, v)];
    } catch (e) {
      if (e instanceof MissingVar) return [];
      throw e;
    }
  });

/** 질문들(순서: 퀴즈, 밴드, 언더아머, 짱구, 침착맨, 패셔너블). 패셔너블은 항상 마지막. */
export function buildSpecials(inp: SpecialInput, r: Rng, C: FlConfig, tier: "high" | "mid" | "low"): AskedQuestion[] {
  const out: AskedQuestion[] = [];
  const TX = C.special;
  const items = inp.items;
  const roastMap = (pairs: [string, string[]][]) => Object.fromEntries(pairs.filter((x) => x[1].length));

  // 브랜드 퀴즈
  const quiz = TX.quiz && inp.brandNames.length ? pickQuiz({ brandNames: inp.brandNames }, r, C.quiz) : null;
  if (quiz) {
    const ids = quiz.options.map((_, i) => String(i));
    const brandLabel = items.find((i) => i.brand?.name === quiz.brand)?.brandLabel || quiz.brand;
    const brandPhotos = items.filter((i) => i.brand?.name === quiz.brand && i.hasPhoto).slice(0, 3).map((i) => i.id);
    const photoAt = TX.quiz.lead.findIndex((l) => l.includes("{brand"));
    out.push({
      id: "quiz",
      lead: TX.quiz.lead.map((l) => fill(l, { brand: brandLabel })),
      leadPhotos: brandPhotos.length && photoAt >= 0 ? { [photoAt]: brandPhotos } : undefined,
      quizId: quiz.id,
      text: quiz.question,
      options: r.shuffle(ids).map((id) => ({ id, label: quiz.options[Number(id)] })),
      answer: String(quiz.answer),
      reactions: Object.fromEntries(
        ids.map((id) => {
          const ok = Number(id) === quiz.answer;
          return [id, `${r.pick(ok ? C.common.QUIZ_CORRECT : C.common.QUIZ_WRONG) ?? ""}\n${r.pick(ok ? quiz.correct : quiz.wrong)}`.trim()];
        }),
      ),
      roast: roastMap(ids.map((id) => [id, fillAll(Number(id) === quiz.answer ? C.common.QUIZ_ROAST_RIGHT : C.common.QUIZ_ROAST_WRONG, { brand: brandLabel })])),
      scoreKey: Object.fromEntries(ids.map((id) => [id, Number(id) === quiz.answer ? "right" : "wrong"])),
      photos: [],
    });
  }

  // 밴드 퀴즈
  const found = findBand({ items });
  const bq = TX.band_quiz;
  if (found && bq) {
    const { band } = found;
    const v = { band: band.name, wrong: band.wrong, wrongBy: band.wrongBy };
    const labels = [...band.songs, band.wrong];
    const ids = labels.map((_, i) => String(i));
    const answer = String(labels.length - 1);
    const bandPhotos = photoIds(items, found.items.map((i) => i.id)).slice(0, 3);
    const photoAt = bq.lead.findIndex((l) => l.includes("{band"));
    out.push({
      id: "band_quiz",
      lead: bq.lead.map((l) => fill(l, v)),
      leadPhotos: bandPhotos.length && photoAt >= 0 ? { [photoAt]: bandPhotos } : undefined,
      text: fill(bq.text, v),
      options: r.shuffle(ids).map((id) => ({ id, label: labels[Number(id)] })),
      answer,
      reactions: Object.fromEntries(ids.map((id) => [id, fill(r.pick(bq.react[id === answer ? "right" : "wrong"]), v)])),
      roast: roastMap(ids.map((id) => [id, fillAll(bq.roast[id === answer ? "right" : "wrong"], v)])),
      scoreKey: Object.fromEntries(ids.map((id) => [id, id === answer ? "right" : "wrong"])),
      photos: [],
    });
  }

  const simple = (id: string, vars: Vars, photos: string[], reactKey = (k: string) => k): AskedQuestion | null => {
    const tx = TX[id];
    if (!tx) return null;
    try {
      const options = Object.keys(tx.options).map((k) => ({ id: k, label: tx.options[k] }));
      return {
        id,
        lead: tx.lead.map((l) => fill(l, vars)),
        text: tx.text ? fill(tx.text, vars) : "",
        options,
        reactions: Object.fromEntries(options.map((o) => [o.id, fill(r.pick(tx.react[reactKey(o.id)] ?? tx.react[o.id]), vars)])),
        roast: roastMap(options.map((o) => [o.id, fillAll(tx.roast[reactKey(o.id)], vars)])),
        photos,
      };
    } catch (e) {
      if (e instanceof MissingVar) return null;
      throw e;
    }
  };

  // 언더아머
  const ua = items.filter((i) => i.brand?.name === "Under Armour");
  if (ua.length) {
    const q = simple("three_500", { n: ua.length }, photoIds(items, ua.map((i) => i.id)).slice(0, 3));
    if (q) out.push(q);
  }
  // 짱구
  const tw = twinsOf(items);
  if (tw) {
    const q = simple("jjanggu_q", { name: tw.name, color: tw.color, n: tw.list.length }, photoIds(items, tw.list.map((i) => i.id)));
    if (q) out.push(q);
  }
  // 침착맨
  const chim = items.filter(isChim);
  if (chim.length) {
    const q = simple("chimchak_q", { n: chim.length }, photoIds(items, chim.map((i) => i.id)));
    if (q) out.push(q);
  }
  // 패셔너블(항상 마지막): 반응은 점수 구간 × 답
  const fq = simple("fashionable_q", {}, [], (k) => `${tier}_${k}`);
  if (fq) {
    fq.scoreKey = Object.fromEntries(fq.options.map((o) => [o.id, `${tier}_${o.id}`]));
    out.push(fq);
  }
  return out;
}
