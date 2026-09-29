import "server-only";

/**
 * 문구 틀 채우기. "{brand}", "{n}"처럼 자리를 쓰고, 조사는 "{brand|을}"처럼 붙이면 받침에 맞춰 고른다.
 * 받을 수 있는 조사: 을/를, 이/가, 은/는, 과/와, 으로/로, 이라/라, 이에요/예요, 이나/나
 */

const PAIRS: Record<string, [string, string]> = {
  을: ["을", "를"],
  를: ["을", "를"],
  이: ["이", "가"],
  가: ["이", "가"],
  은: ["은", "는"],
  는: ["은", "는"],
  과: ["과", "와"],
  와: ["과", "와"],
  으로: ["으로", "로"],
  로: ["으로", "로"],
  이라: ["이라", "라"],
  라: ["이라", "라"],
  이에요: ["이에요", "예요"],
  예요: ["이에요", "예요"],
  이나: ["이나", "나"],
  나: ["이나", "나"],
};

/** 한 자리 숫자 읽기에서 받침이 있는 것: 0(영) 1(일) 3(삼) 6(육) 7(칠) 8(팔). ㄹ 받침은 1·7·8 */
const DIGIT_BATCHIM = new Set(["0", "1", "3", "6", "7", "8"]);
const DIGIT_RIEUL = new Set(["1", "7", "8"]);

/** 마지막 글자 받침: null(없음), "ㄹ", "other" */
function batchim(word: string): null | "ㄹ" | "other" {
  const w = word.trim().replace(/[)\]'"’”.!?%\s]+$/u, "");
  const last = w[w.length - 1];
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    if (!jong) return null;
    return jong === 8 ? "ㄹ" : "other";
  }
  if (/\d/.test(last)) {
    // 10·100·1000은 "십·백·천"
    if (/[1-9]0$/.test(w) && !/00$/.test(w)) return "other"; // 십
    if (/[1-9]00$/.test(w) && !/000$/.test(w)) return "other"; // 백
    if (/000$/.test(w)) return null; // 천(만은 여기서 드묾)
    return DIGIT_BATCHIM.has(last) ? (DIGIT_RIEUL.has(last) ? "ㄹ" : "other") : null;
  }
  const l = last.toLowerCase();
  // 영어 이름은 읽는 소리로 대충: l(ㄹ), m·n·ng(받침), 나머지는 받침 없음으로 본다.
  if (l === "l") return "ㄹ";
  if (l === "m" || l === "n" || l === "g" && /ng$/i.test(w)) return "other";
  return null;
}

export function josa(word: string, particle: string): string {
  const pair = PAIRS[particle];
  if (!pair) return word + particle;
  const b = batchim(word);
  // "으로"는 ㄹ 받침 뒤에서 "로"
  if (pair[0] === "으로") return word + (b && b !== "ㄹ" ? "으로" : "로");
  return word + (b ? pair[0] : pair[1]);
}

/** 1240000 → "124만 원", 85000 → "8만 5천 원", 9900 → "9,900원" */
export function won(v: number): string {
  const n = Math.round(v);
  if (n < 10_000) return `${n.toLocaleString("ko-KR")}원`;
  const man = Math.floor(n / 10_000);
  const chun = Math.round((n % 10_000) / 1000);
  if (chun === 10) return `${(man + 1).toLocaleString("ko-KR")}만 원`;
  return chun && man < 100 ? `${man}만 ${chun}천 원` : `${man.toLocaleString("ko-KR")}만 원`;
}

export type Vars = Record<string, string | number>;

/** 모르는 자리가 있으면 오류(문장에 없는 값을 지어내지 않게). */
export class MissingVar extends Error {}

export function fill(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)(?:\|([^}]+))?\}/g, (_, key: string, particle?: string) => {
    const v = vars[key];
    // "…Phrase" 자리는 비어 있어도 된다(예: 핏을 모르면 핏 문구를 뺀다).
    if (v == null || (v === "" && !key.endsWith("Phrase"))) throw new MissingVar(key);
    const s = String(v);
    return particle ? josa(s, particle) : s;
  });
}

/** 틀에 쓰인 자리 이름 */
export const varsOf = (template: string) => [...template.matchAll(/\{(\w+)(?:\|[^}]+)?\}/g)].map((m) => m[1]);

/** 시드가 같으면 같은 순서로 나오는 난수(같은 분석을 서버에서 다시 만들 때 결과가 같게) */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick<T>(list: readonly T[]): T {
      return list[Math.floor(next() * list.length)];
    },
    shuffle<T>(list: readonly T[]): T[] {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
export type Rng = ReturnType<typeof rng>;
