import "server-only";
import type { Analysis } from "./analyze";

/**
 * 질문 답의 반응(1번·2번…)마다 붙이는 조건. 관리자 문장 편집에서 드롭다운으로 골라 붙이고,
 * 조건이 모두 맞는 반응이 있으면 그 반응과 그 반응의 결과 글이 나온다. 조건이 없거나 안 맞으면 원래 반응 중에서 고른다.
 * 조건은 분석이 이미 계산한 값만 쓴다(새 계산을 만들지 않는다).
 *
 * 저장 모양: questions.<질문>.when.<반응 종류> = 반응 목록과 같은 순서의 문자열 목록.
 * 한 칸은 "count_lte:30|pat:black_bias"처럼 조건을 |로 잇고, 숫자가 있는 조건은 ":숫자"로 경계를 적는다. 빈 칸은 조건 없음.
 */

export interface WhenDef {
  /** 관리자 화면 이름. {n}은 경계 숫자 */
  label: string;
  /** 경계 숫자 기본값(없으면 숫자 없는 조건) */
  n?: number;
  test: (a: Analysis, n: number) => boolean;
}

/** 주문 건수(주문내역 훈수) 또는 옷 벌 수(옷장 훈수) */
const size = (a: Analysis) => a.orders?.orders ?? a.clothesTotal;
const returns = (a: Analysis) => a.orders?.events.length ?? 0;

export const WHEN_DEFS: Record<string, WhenDef> = {
  count_lte: { label: "주문 건수(옷장 훈수는 옷 벌 수)가 {n}개 이하", n: 30, test: (a, n) => size(a) <= n },
  count_gt: { label: "주문 건수(옷장 훈수는 옷 벌 수)가 {n}개보다 많음", n: 30, test: (a, n) => size(a) > n },
  returns_gte: { label: "반품·취소가 {n}건 이상(주문내역 훈수)", n: 3, test: (a, n) => returns(a) >= n },
  returns_lt: { label: "반품·취소가 {n}건 미만(주문내역 훈수)", n: 3, test: (a, n) => returns(a) < n },
  brands_lte: { label: "브랜드가 {n}개 이하", n: 5, test: (a, n) => a.brandNames.length <= n },
  brands_gt: { label: "브랜드가 {n}개보다 많음", n: 5, test: (a, n) => a.brandNames.length > n },
};

/** 분석에서 그 패턴(패턴별 멘트 탭의 조건)이 잡혔을 때: "pat:<패턴 id>" */
const PAT_RE = /^pat:([a-z0-9_]+)$/;
const NUM_RE = /^([a-z0-9_]+):(\d{1,5})$/;

/** 조건 한 칸이 올바른지(빈 칸 허용). patterns는 쓸 수 있는 패턴 id */
export function checkWhen(cell: string, patterns: ReadonlySet<string>): boolean {
  if (!cell) return true;
  return cell.split("|").every((part) => {
    const p = part.match(PAT_RE);
    if (p) return patterns.has(p[1]);
    const m = part.match(NUM_RE);
    const def = m ? WHEN_DEFS[m[1]] : WHEN_DEFS[part];
    return Boolean(def) && (def.n != null) === Boolean(m);
  });
}

/** 조건 한 칸이 이 분석에서 모두 맞는지. 빈 칸·모르는 조건은 false */
export function whenMatches(cell: string, a: Analysis): boolean {
  if (!cell) return false;
  return cell.split("|").every((part) => {
    const p = part.match(PAT_RE);
    if (p) return a.patterns.some((x) => x.id === p[1]);
    const m = part.match(NUM_RE);
    const def = m ? WHEN_DEFS[m[1]] : WHEN_DEFS[part];
    return Boolean(def) && def.test(a, m ? Number(m[2]) : (def.n ?? 0));
  });
}

/**
 * 반응 목록에서 쓸 후보 번호: 조건이 맞는 반응이 있으면 그것들, 없으면 조건 없는 반응들.
 * 전부 조건이 있는데 하나도 안 맞으면 전부(예전처럼 아무거나). matched는 조건이 맞아 고른 것인지.
 */
export function reactPool(count: number, when: readonly string[] | undefined, a: Analysis): { pool: number[]; matched: boolean } {
  const all = Array.from({ length: count }, (_, i) => i);
  const hit = all.filter((i) => when?.[i] && whenMatches(when[i], a));
  if (hit.length) return { pool: hit, matched: true };
  const plain = all.filter((i) => !when?.[i]);
  return { pool: plain.length ? plain : all, matched: false };
}
