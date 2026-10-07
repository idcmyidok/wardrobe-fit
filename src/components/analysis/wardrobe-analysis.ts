import { CATEGORIES, CATEGORY_NAME, COUNT_UNIT, SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { findColorFamily, findColorHex, luminance } from "@/lib/constants/colors";
import { FOUR_SEASONS, SEASON_NAME, wearsInSeason } from "@/lib/constants/seasons";
import type { CategoryId, Garment, Season } from "@/lib/types/domain";

/** 옷장 분석 화면의 계산. 서버 통계(PROJECT_SPEC.md 16장)로 옮기기 전까지 클라이언트에서 계산한다. */

export type CategoryTab = "all" | CategoryId;

/** 10000 → "1만", 1450000 → "145만" */
export const man = (v: number) =>
  v >= 10000 ? `${(v / 10000).toFixed(v >= 1000000 ? 0 : 1).replace(/\.0$/, "")}만` : v.toLocaleString("ko-KR");
export const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;

/** 받침이 있으면 a, 없으면 b를 붙인다. 예: 블랙을 / 네이비를 */
const josa = (w: string, a: string, b: string) => {
  const c = w.charCodeAt(w.length - 1);
  return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b);
};

const CATEGORY_FILL: Record<CategoryId, string> = {
  outer: "var(--chart-1)",
  top: "var(--chart-2)",
  bottom: "var(--chart-3)",
  hat: "var(--chart-4)",
  shoes: "var(--chart-5)",
};

/** 6개월 평균 구매액 구간별 제목. [상한(미만), 제목] */
const HALF_YEAR_TIERS: [number, string][] = [
  [50000, "이제 막 옷장을 채우기 시작했어요!"],
  [150000, "알뜰살뜰 실속파 패션 러버!"],
  [300000, "가성비를 즐기는 패션 러버!"],
  [500000, "옷 고르는 재미를 아는 패션 러버!"],
  [1000000, "패션에 돈을 좀 쓴 패션 러버!"],
  [2000000, "밥보다 패션이 중요한 패션 러버!"],
  [3500000, "옷장에 진심인 헤비 패션 러버!"],
  [6000000, "옷장이 곧 자산인 컬렉터!"],
  [Infinity, "패션 하우스급 옷장의 주인!"],
];

/** 한 벌 평균가 구간별 설명. [상한(미만), 문장] */
const AVG_TIERS: [number, string][] = [
  [20000, "저렴한 옷을 잘 찾아내는 알뜰한 쇼핑 스타일입니다."],
  [50000, "합리적인 가격대에서 알차게 고르는 옷장입니다."],
  [100000, "기본은 실속 있게, 마음에 드는 옷에는 아낌없이 쓰는 편입니다."],
  [200000, "한 벌 한 벌 품질을 따져 고르는 옷장입니다."],
  [400000, "한 벌 한 벌에 확실히 투자하는 옷장입니다. 그만큼 사이즈 실패는 아깝겠죠."],
  [Infinity, "고가의 옷이 옷장의 중심입니다. 구매 전 치수 비교가 꼭 필요한 타입이에요."],
];

/**
 * 옷장 총 가격 멘트. 제목은 6개월마다 평균 얼마를 썼는지, 설명은 한 벌 평균가로 고른다.
 * 가격 입력이 적을 때와 한 벌이 총액의 절반 이상일 때는 한 문장을 덧붙인다.
 */
export function priceComment(p: { count: number; total: number; avg: number; topPrice: number; perHalfYear: number }) {
  const { count, total, avg, topPrice, perHalfYear } = p;
  if (!count) return { title: "아직 가격 기록이 없는 옷장", body: "구매 가격을 입력하면 옷장 총액과 소비 성향을 알려 드릴게요." };
  const title = HALF_YEAR_TIERS.find(([max]) => perHalfYear < max)![1];
  let body = `${AVG_TIERS.find(([max]) => avg < max)![1]} 한 벌 평균 ${man(Math.round(avg))}원, 6개월마다 평균 ${man(Math.round(perHalfYear))}원을 옷에 씁니다.`;
  if (count >= 3 && topPrice / total >= 0.5) body += ` 가장 비싼 한 벌이 총액의 ${Math.round((topPrice / total) * 100)}%를 차지해요.`;
  if (count <= 2) body += ` 가격을 입력한 옷이 ${count}벌뿐이라, 더 입력할수록 분석이 정확해져요.`;
  return { title, body };
}

const monthIndex = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + m - 1;
};
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * 6개월 평균 구매액: 가장 이른 구매월부터 이번 달까지를 6개월씩 나눈 구간 수로 총액을 나눈다.
 * 구매일이 없는 옷도 금액에는 넣는다. 구매일이 하나도 없으면 한 구간으로 본다.
 */
export function halfYearAverage(G: Garment[], now = new Date()) {
  const priced = G.filter((g) => g.purchasePrice != null);
  const total = priced.reduce((a, g) => a + (g.purchasePrice ?? 0), 0);
  const dates = priced.map((g) => g.purchasedOn).filter((d): d is string => !!d).sort();
  const months = dates.length ? Math.max(1, monthIndex(dateKey(now)) - monthIndex(dates[0]) + 1) : 1;
  const periods = Math.ceil(months / 6);
  return { perHalfYear: total / periods, periods };
}

/** 최근 6개월(오늘 기준, 같은 날짜부터) 안에 산 옷의 구매가 합계 */
export function recentSixMonths(G: Garment[], now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const since = dateKey(from);
  return G.filter((g) => g.purchasePrice != null && g.purchasedOn && g.purchasedOn >= since).reduce(
    (a, g) => a + (g.purchasePrice ?? 0),
    0,
  );
}

export function priceSummary(G: Garment[], now = new Date()) {
  const priced = G.filter((g) => g.purchasePrice != null);
  const total = priced.reduce((a, g) => a + (g.purchasePrice ?? 0), 0);
  const cats = CATEGORIES.map(({ id: c }) => {
    const gs = priced.filter((g) => g.categoryId === c);
    const amount = gs.reduce((a, g) => a + (g.purchasePrice ?? 0), 0);
    const count = G.filter((g) => g.categoryId === c).length;
    return {
      id: c,
      label: CATEGORY_NAME[c],
      fill: CATEGORY_FILL[c],
      amount: won(amount),
      width: total ? `${((amount / total) * 100).toFixed(1)}%` : "0%",
      pct: total ? `${Math.round((amount / total) * 100)}%` : "—",
      meta: `${count}${COUNT_UNIT[c]}${gs.length ? ` · 평균 ${man(Math.round(amount / gs.length))}원` : ""}`,
    };
  });
  const avg = priced.length ? total / priced.length : 0;
  const top = priced.slice().sort((a, b) => (b.purchasePrice ?? 0) - (a.purchasePrice ?? 0))[0];
  const { perHalfYear } = halfYearAverage(G, now);
  const { title, body } = priceComment({ count: priced.length, total, avg, topPrice: top?.purchasePrice ?? 0, perHalfYear });
  return {
    totalShort: man(total),
    totalFull: `${total.toLocaleString("ko-KR")} ￦ · ${priced.length}벌 합산`,
    recentFull: `${recentSixMonths(G, now).toLocaleString("ko-KR")} ￦ · 최근 6개월 이내 구매`,
    tierTitle: title,
    tierBody: body,
    cats,
    avg: priced.length ? won(Math.round(avg)) : "—",
    topItem: top ? `${[top.brand, top.productName].filter(Boolean).join(" ")} · ${man(top.purchasePrice ?? 0)}원` : "—",
  };
}

/** 월별 구매 막대. 구매한 달만 보여 준다(빈 달은 건너뛴다). 막대마다 그 달의 설명을 담아 두어 누르면 바꿔 보여 준다. */
export function monthlySummary(G: Garment[]) {
  const dated = G.filter((g) => g.purchasedOn && g.purchasePrice != null);
  const byMonth = new Map<string, Garment[]>();
  dated.forEach((g) => {
    const k = g.purchasedOn!.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), g]);
  });
  const months = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, gs]) => {
      const [y, m] = k.split("-").map(Number);
      return { k, y, m, amt: gs.reduce((a, g) => a + (g.purchasePrice ?? 0), 0), n: gs.length, gs };
    })
    .filter((x) => x.amt > 0);
  const max = Math.max(1, ...months.map((x) => x.amt));
  const top = months.slice().sort((a, b) => b.amt - a.amt)[0];
  const span = months.length ? monthIndex(months[months.length - 1].k) - monthIndex(months[0].k) + 1 : 0;
  const detail = (x: (typeof months)[number]) => ({
    month: `${x.y}.${String(x.m).padStart(2, "0")}`,
    amount: `${won(x.amt)} · ${x.n}벌`,
    note: x.gs.map((g) => [g.brand, g.productName].filter(Boolean).join(" ")).join(", "),
  });
  return {
    bars: months.map((x, i) => ({
      key: x.k,
      label: `${x.m}월`,
      // 첫 막대와 해가 바뀌는 막대에만 연도를 적는다.
      year: i === 0 || months[i - 1].y !== x.y ? String(x.y) : "",
      short: man(x.amt),
      height: `${((x.amt / max) * 100).toFixed(1)}%`,
      isTop: top?.k === x.k,
      title: `${x.y}년 ${x.m}월 · ${won(x.amt)} · ${x.n}벌`,
      detail: detail(x),
    })),
    top: top ? detail(top) : { month: "—", amount: "", note: "구매일이 있는 옷이 없습니다." },
    span: months.length ? `${span}개월 중 ${months.length}개월 구매` : "",
    average: months.length
      ? `구매한 달 평균 ${won(Math.round(months.reduce((a, x) => a + x.amt, 0) / months.length))}`
      : "",
  };
}

export interface DonutSlice {
  name: string;
  count: number;
  amount: number;
  color: string;
  pct: string;
  dash: string;
  offset: string;
  /** 묶인 조각 안의 세부 항목(컬러 분석: 계열 안의 색별 벌 수, 많은 순) */
  members?: { name: string; count: number }[];
}

/** 도넛 조각: 반지름 80 원 둘레를 비율대로 나눈다. 조각 사이에 2px 틈을 둔다. */
const CIRCUMFERENCE = 2 * Math.PI * 80;
type SliceInput = Pick<DonutSlice, "name" | "count" | "amount" | "color" | "members">;
function toSlices(list: SliceInput[], total: number): DonutSlice[] {
  const n = total || 1;
  let acc = 0;
  return list.map((x) => {
    const len = (x.count / n) * CIRCUMFERENCE;
    const slice = {
      ...x,
      pct: `${Math.round((x.count / n) * 100)}%`,
      dash: `${Math.max(len - 2, 0.5).toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`,
      offset: (-acc).toFixed(2),
    };
    acc += len;
    return slice;
  });
}

const tabName = (tab: CategoryTab) => (tab === "all" ? "옷장" : CATEGORY_NAME[tab]);
const tabLabel = (tab: CategoryTab) => (tab === "all" ? "전체" : CATEGORY_NAME[tab]);

const BRAND_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  // 9·10위는 새 색을 만들지 않고 회색으로 둔다(범례 이름으로 구분).
  "var(--n-500)",
  "var(--n-400)",
];

export function brandSummary(G: Garment[], tab: CategoryTab) {
  const pool = G.filter((g) => tab === "all" || g.categoryId === tab);
  const map = new Map<string, { count: number; amount: number }>();
  pool.forEach((g) => {
    const key = g.brand || "미입력";
    const o = map.get(key) ?? { count: 0, amount: 0 };
    o.count++;
    o.amount += g.purchasePrice ?? 0;
    map.set(key, o);
  });
  const list = [...map.entries()].sort((a, b) => b[1].count - a[1].count || b[1].amount - a[1].amount);
  const slices = toSlices(
    list.map(([name, o], i) => ({ name, count: o.count, amount: o.amount, color: BRAND_PALETTE[i % BRAND_PALETTE.length] })),
    pool.length,
  );
  let message = "등록한 옷이 없습니다.";
  // 브랜드를 비워 둔 옷은 도넛에는 "미입력"으로 넣고, 문장에는 쓰지 않는다.
  const named = list.filter(([k]) => k !== "미입력");
  if (list.length && !named.length) message = "브랜드를 입력한 옷이 없습니다.";
  if (named.length) {
    const [b1, o1] = named[0];
    const byAmount = named.slice().sort((a, b) => b[1].amount - a[1].amount)[0];
    message =
      o1.count >= 2 && o1.count / (pool.length || 1) >= 0.25
        ? `${b1}의 팬이시군요. ${tabName(tab)}에서 ${o1.count}벌로 가장 많습니다.`
        : `${named.length}개 브랜드를 고르게 입는 편식 없는 옷장입니다.`;
    if (byAmount[1].amount && byAmount[0] !== b1) message += ` 가장 많이 쓴 브랜드는 ${byAmount[0]}(${man(byAmount[1].amount)}원)입니다.`;
  }
  return { message, slices, total: list.length, totalLabel: `${tabLabel(tab)} · ${pool.length}벌` };
}

/** 컬러 분석: 비슷한 색은 계열로 묶는다("아쿠아 블루"·"라이트 블루" → 블루). 계열 안의 색별 벌 수는 members에 둔다. */
export function colorSummary(G: Garment[], tab: CategoryTab) {
  const pool = G.filter((g) => tab === "all" || g.categoryId === tab);
  const map = new Map<string, Map<string, number>>();
  pool.forEach((g) => {
    const family = findColorFamily(g.colorName) ?? "미입력";
    const members = map.get(family) ?? new Map<string, number>();
    const name = g.colorName || "미입력";
    members.set(name, (members.get(name) ?? 0) + 1);
    map.set(family, members);
  });
  const byCount = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0], "ko");
  const list = [...map.entries()]
    .map(([name, m]) => [name, [...m.values()].reduce((a, c) => a + c, 0), [...m.entries()].sort(byCount)] as const)
    .sort((a, b) => byCount([a[0], a[1]], [b[0], b[1]]));
  const slices = toSlices(
    list.map(([name, count, members]) => ({
      name,
      count,
      amount: 0,
      color: findColorHex(name) ?? "var(--n-400)",
      members: members.map(([n, c]) => ({ name: n, count: c })),
    })),
    pool.length,
  );
  const n = pool.length || 1;
  const known = list.filter(([k]) => k !== "미입력");
  let message = "컬러를 입력한 옷이 없습니다.";
  if (known.length) {
    const [c1, c1n] = known[0];
    const share = c1n / n;
    const dark =
      pool.filter((g) => {
        const hex = findColorHex(g.colorName);
        return hex && luminance(hex) < 0.05;
      }).length / n;
    message =
      share >= 0.3
        ? `${josa(c1, "을", "를")} 사랑하시는군요. ${tabName(tab)}의 ${Math.round(share * 100)}%가 ${c1}입니다.`
        : known[1]
          ? `${c1}와 ${known[1][0]}을 중심으로 고르게 섞인 팔레트입니다.`
          : `${c1} 위주의 팔레트입니다.`;
    if (dark >= 0.4) message += ` 어두운 톤이 ${Math.round(dark * 100)}%로, 차분한 색을 즐겨 입으시네요.`;
  }
  return { message, slices, total: pool.length, totalLabel: `${tabLabel(tab)} · ${list.length}가지 컬러` };
}

export function seasonSummary(G: Garment[]) {
  // 사계절 옷은 네 계절에 모두 센다.
  const counts = FOUR_SEASONS.map((s) => ({ id: s.id, count: G.filter((g) => wearsInSeason(g.seasons, s.id)).length }));
  const max = Math.max(1, ...counts.map((x) => x.count));
  const least = counts.slice().sort((a, b) => a.count - b.count)[0];
  const most = counts.slice().sort((a, b) => b.count - a.count)[0];
  return {
    least: least.id,
    bars: counts.map((x) => ({
      id: x.id,
      label: SEASON_NAME[x.id],
      count: x.count,
      pct: G.length ? `${Math.round((x.count / G.length) * 100)}%` : "—",
      height: `${Math.max((x.count / max) * 100, 12).toFixed(1)}%`,
      isLeast: x.id === least.id,
    })),
    message: G.length
      ? `${SEASON_NAME[most.id]} 옷이 ${most.count}벌로 가장 많고, ${SEASON_NAME[least.id]} 옷은 ${least.count}벌로 가장 적습니다.`
      : "등록한 옷이 없습니다.",
  };
}

/** 종류별 기본 구성(세부분류, 기본 벌 수, 주로 입는 시즌) */
const ESSENTIALS: [string, number, Season][] = [
  ["outer.blouson", 1, "fall"],
  ["outer.transition_coat", 1, "fall"],
  ["outer.winter_coat", 1, "winter"],
  ["outer.short_padding", 1, "winter"],
  ["outer.cardigan", 1, "spring"],
  ["top.short_tee", 3, "summer"],
  ["top.long_tee", 2, "spring"],
  ["outer.shirt", 2, "spring"],
  ["top.knit", 2, "winter"],
  ["top.sweatshirt", 1, "fall"],
  ["bottom.denim", 2, "fall"],
  ["bottom.slacks", 2, "spring"],
  ["bottom.chino", 1, "spring"],
  ["bottom.shorts", 1, "summer"],
];

/** 기본 구성 대비 부족한 순으로 3개. 가장 적은 시즌의 옷은 우선순위를 높인다. */
export function recommendations(G: Garment[], leastSeason: Season) {
  return ESSENTIALS.map(([sub, target, season]) => {
    const have = G.filter((g) => g.subcategoryId === sub).length;
    const def = target - have;
    return { sub, target, have, season, def, score: def / target + (season === leastSeason ? 0.35 : 0) };
  })
    .filter((x) => x.def > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x, i) => ({
      rank: `0${i + 1}`,
      label: SUBCATEGORY_NAME[x.sub],
      category: CATEGORY_NAME[x.sub.split(".")[0] as CategoryId],
      have: `보유 ${x.have}벌 · 기본 ${x.target}벌`,
      dots: Array.from({ length: x.target }, (_, j) => j < x.have),
      reason:
        (x.have === 0 ? "아직 한 벌도 없습니다. " : `${x.def}벌 더 있으면 기본 구성이 채워집니다. `) +
        (x.season === leastSeason
          ? `${SEASON_NAME[x.season]} 옷이 가장 부족해 우선순위를 높였습니다.`
          : `${SEASON_NAME[x.season]}에 자주 입는 종류입니다.`),
    }));
}
