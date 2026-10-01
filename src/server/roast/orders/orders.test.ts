import { describe, expect, it } from "vitest";
import { parseOrdersForRoast } from "@/server/import/musinsa-orders";
import { buildScript, composeResult } from "../compose";
import { buildReport } from "../report";
import { DEFAULT_TEXTS } from "../texts";
import { analyzeOrders } from "./analysis";
import { orderItemSchema, toGarments, type OrderRoastItem } from "./input";
import { busiestMonth, isRanking, isStandard, returnStats } from "./metrics";
import { orderOverride } from "./report";
import { ORDER_RULES } from "./rules";
import { ORDER_PART_NAME, ORDER_RULE_NAME } from "./texts";
import { scoreOrders } from "./score";

const now = new Date("2026-09-30T12:00:00+09:00");

let seq = 0;
const item = (over: Partial<OrderRoastItem> = {}): OrderRoastItem => ({
  order: seq++,
  status: "kept",
  brand: "무신사 스탠다드",
  name: `상품 ${seq}`,
  categoryId: "top",
  subcategoryId: "top.short_tee",
  color: "블랙",
  size: "L",
  price: 29_000,
  date: "2025-11-11",
  goodsNo: String(1000 + seq),
  likes: 20_000,
  reviews: 5_000,
  image: `/api/imports/00000000-0000-4000-8000-${String(seq).padStart(12, "0")}/image?i=0`,
  ...over,
});

function sample(): OrderRoastItem[] {
  seq = 0;
  const months = ["2023-03-02", "2023-06-20", "2023-11-11", "2024-06-21", "2024-11-12", "2025-06-22", "2025-11-13", "2026-06-23", "2026-08-10", "2026-09-01"];
  return [
    ...Array.from({ length: 8 }, (_, k) => item({ name: `릴렉스 핏 크루 넥 반팔 티셔츠 ${k}`, date: months[k % months.length] })),
    ...Array.from({ length: 5 }, (_, k) => item({ brand: "커버낫", name: `C 로고 후드 ${k}`, subcategoryId: "top.hoodie", color: "그레이", price: 79_000, date: months[(k + 3) % months.length] })),
    ...Array.from({ length: 4 }, (_, k) => item({ brand: "아더에러", name: `오버사이즈 셔츠 ${k}`, categoryId: "outer", subcategoryId: "outer.shirt", color: "블루", price: 290_000, likes: 300, reviews: 20, date: months[(k + 6) % months.length] })),
    item({ brand: "나이키", name: "에어포스 1", categoryId: "shoes", subcategoryId: "shoes.sneakers", color: "화이트", price: 139_000 }),
    item({ status: "returned", brand: "커버낫", name: "반품한 후드" }),
    item({ status: "returned", brand: "커버낫", name: "반품한 후드 2" }),
    item({ status: "exchanged", brand: "디스이즈네버댓", name: "교환한 팬츠", categoryId: "bottom", subcategoryId: "bottom.denim", color: "데님" }),
    item({ status: "cancelled", brand: "나이키", name: "취소한 신발", categoryId: "shoes" }),
    item({ status: "cancelled", brand: "나이키", name: "취소한 신발 2", categoryId: "shoes" }),
    item({ status: "cancelled", brand: "나이키", name: "취소한 신발 3", categoryId: "shoes" }),
  ];
}

function run() {
  const { garments, ctx } = toGarments(sample());
  return analyzeOrders(garments, ctx, 1360, now);
}

describe("주문내역 훈수 목록 검사", () => {
  it("사진은 이미지 프록시 주소만 받는다(무신사 주소는 화면 CSP에 막힌다)", () => {
    expect(orderItemSchema.safeParse(item()).success).toBe(true);
    expect(orderItemSchema.safeParse(item({ image: "https://image.msscdn.net/images/goods_img/1.jpg" })).success).toBe(false);
  });
  it('브랜드가 "undefined"로 오면 브랜드 없음으로 본다', () => {
    expect(orderItemSchema.parse(item({ brand: "undefined" })).brand).toBe("");
    expect(orderItemSchema.parse(item({ brand: " 커버낫 " })).brand).toBe("커버낫");
  });
});

describe("주문내역 붙여넣기(훈수용)", () => {
  it("반품·취소·교환도 상태를 붙여 남긴다", () => {
    const text = [
      "25.11.11(화)",
      "구매 확정",
      "무신사 스탠다드",
      "릴렉스 핏 티셔츠",
      "블랙 / L / 1개",
      "19,900원",
      "반품 완료",
      "커버낫",
      "로고 후드",
      "그레이 / L / 1개",
      "79,000원",
      "취소 완료",
      "나이키",
      "에어포스",
      "270 / 1개",
      "139,000원",
      "교환 완료",
      "디스이즈네버댓",
      "데님 팬츠",
      "M / 1개",
      "89,000원",
      "구매 확정",
      "무신사 스탠다드",
      "드로즈 3팩",
      "M / 1개",
      "19,900원",
    ].join("\n");
    const { garments } = parseOrdersForRoast(text);
    expect(garments.map((g) => g.status)).toEqual(["kept", "returned", "cancelled", "exchanged"]);
  });
});

describe("주문내역 훈수 목록 → 분석", () => {
  it("반품·취소는 옷이 아니라 사건으로, 교환은 옷과 교환 수로 센다", () => {
    const { garments, ctx } = toGarments(sample());
    expect(garments.length).toBe(19);
    expect(ctx.events.filter((e) => e.status === "returned").length).toBe(2);
    expect(ctx.events.filter((e) => e.status === "cancelled").length).toBe(3);
    expect(ctx.exchanged).toBe(1);
    expect(ctx.orders).toBe(24);
  });

  it("랭킹템·스탠다드·세일 달·반품 수치", () => {
    const a = run();
    const rank = a.items.filter((i) => isRanking(a, i, ORDER_RULES));
    expect(rank.length).toBeGreaterThanOrEqual(13);
    expect(a.items.filter(isStandard).length).toBeGreaterThan(0);
    expect(busiestMonth(a)?.month).toBe(a.patterns.find((p) => p.id === "month_binge")?.stats.month ?? 6);
    const rs = returnStats(a);
    expect(rs).toMatchObject({ returned: 2, cancelled: 3, exchanged: 1, topBrand: "커버낫", topBrandN: 2 });
  });

  it("하트를 못 읽으면 브랜드 무신사 좋아요로 랭킹템을 판단한다", () => {
    const { garments, ctx } = toGarments([item({ likes: null, reviews: null })]);
    const a = analyzeOrders(garments, ctx, 1360, now);
    const brandLikes = a.items[0].brand?.likes ?? 0;
    expect(isRanking(a, a.items[0], ORDER_RULES)).toBe(brandLikes >= ORDER_RULES.rank_brand_10k * 10_000);
  });

  it("점수: 랭킹템 쏠림·스탠다드 감점, 나이 기준이 들어간다", () => {
    const a = run();
    const s = scoreOrders(a, { age: 38 });
    const ids = s.parts.map((p) => p.id);
    expect(ids).toContain("rank");
    expect(ids).toContain("standard");
    expect(ids.some((id) => id.startsWith("age_"))).toBe(true);
    expect(s.age).not.toBeNull();
    // 나이를 안 적으면 나이 기준은 없다
    expect(scoreOrders(a, { age: null }).parts.some((p) => p.id.startsWith("age_"))).toBe(false);
  });

  it("점수 기준과 항목마다 관리자 화면 이름이 있다", () => {
    for (const k of Object.keys(ORDER_RULES)) expect(ORDER_RULE_NAME[k], k).toBeDefined();
    const s = scoreOrders(run(), { age: 38 });
    for (const p of s.parts) expect(ORDER_PART_NAME[p.id], p.id).toBeDefined();
  });

  it("같은 옷 반복: 같은 상품·같은 실측(없으면 사이즈)을 다른 주문에서 또 산 것만 센다", () => {
    const dup = (list: OrderRoastItem[]) => {
      const { garments, ctx } = toGarments(list);
      return scoreOrders(analyzeOrders(garments, ctx, 1360, now), { age: null }).parts.find((p) => p.id === "dup")?.delta ?? 0;
    };
    seq = 0;
    const base = Array.from({ length: 10 }, (_, k) => item({ brand: "커버낫", name: `다른 옷 ${k}`, likes: 100, reviews: 1 }));
    const tee = (over: Partial<OrderRoastItem>) => item({ brand: "아더에러", name: "같은 셔츠", categoryId: "outer", subcategoryId: "outer.shirt", likes: 100, reviews: 1, ...over });
    // 실측이 같으면 반복(색은 달라도)
    expect(dup([...base, tee({ measure: "chest:60|length:72", color: "블루" }), tee({ measure: "chest:60|length:72", color: "블랙" })])).toBe(-ORDER_RULES.dup_each);
    // 사이즈가 달라 실측이 다르면 반복이 아니다
    expect(dup([...base, tee({ measure: "chest:60|length:72", size: "M" }), tee({ measure: "chest:63|length:74", size: "L" })])).toBe(0);
    // 실측을 못 찾으면 사이즈로 본다
    expect(dup([...base, tee({ size: "L" }), tee({ size: "L" })])).toBe(-ORDER_RULES.dup_each);
    // 한 주문의 팩(같은 주문 번호)은 반복이 아니다
    const pack = tee({ size: "L" });
    expect(dup([...base, pack, { ...pack }])).toBe(0);
  });

  it("석 달 평균 구매액 기준은 25·15·10만 원", () => {
    expect([ORDER_RULES.spend_top_won, ORDER_RULES.spend_a_won, ORDER_RULES.spend_b_won]).toEqual([25, 15, 10]);
  });

  it("새 감점: 몰아 사기 날, 반품하고 또 사는 브랜드", () => {
    seq = 0;
    const list = [
      ...Array.from({ length: 6 }, (_, k) => item({ brand: "커버낫", name: `후드 ${k}`, subcategoryId: "top.hoodie", date: "2026-03-02" })),
      ...Array.from({ length: 6 }, (_, k) => item({ brand: "아더에러", name: `셔츠 ${k}`, categoryId: "outer", subcategoryId: "outer.shirt", date: `2026-0${(k % 6) + 1}-15` })),
      item({ status: "returned", brand: "커버낫", name: "반품 1" }),
      item({ status: "returned", brand: "커버낫", name: "반품 2" }),
    ];
    const { garments, ctx } = toGarments(list);
    const ids = scoreOrders(analyzeOrders(garments, ctx, 1360, now), { age: null }).parts.map((p) => p.id);
    expect(ids).toContain("binge");
    expect(ids).toContain("return_brand");
  });

  it("대화는 주문내역 질문만(공통 퀴즈·밥과 옷·패셔너블 제외) 묻고, 옷장이라는 말을 쓰지 않는다", () => {
    const a = run();
    for (let seed = 1; seed < 30; seed++) {
      const plan = buildScript(a, seed, "세현", DEFAULT_TEXTS, 34);
      for (const q of plan.asked) expect(q.id.startsWith("o_") || ["quiz", "food_vs_clothes", "fashionable_q"].includes(q.id)).toBe(true);
      expect(plan.asked.at(-1)?.id).toBe("fashionable_q");
      const said = plan.script.steps.map((s) => ("text" in s ? s.text : "")).join(" ");
      expect(said).not.toContain("옷장");
      for (const q of plan.asked) expect([...q.lead, q.text, ...Object.values(q.reactions)].join(" ")).not.toContain("옷장");
    }
  });

  it("질문이 대화 끝에 몰리지 않고 분석 문장 사이에 섞인다", () => {
    const a = run();
    let early = 0;
    let total = 0;
    for (let seed = 1; seed < 30; seed++) {
      const steps = buildScript(a, seed, null, DEFAULT_TEXTS, 34).script.steps;
      const lastSay = steps.findLastIndex((s) => s.t === "say" && "photos" in s && Boolean(s.photos?.length));
      // 마지막 분석 문장(사진이 붙은 말)보다 앞에 나온 질문 수
      steps.forEach((s, k) => {
        if (s.t !== "ask") return;
        total++;
        if (k < lastSay) early++;
      });
    }
    expect(early / total).toBeGreaterThan(0.4);
  });

  it("결과: 주문내역 문단과 주문내역 점수를 쓴다", () => {
    const a = run();
    const seed = 7;
    const plan = buildScript(a, seed, "세현", DEFAULT_TEXTS, 38);
    const answers = Object.fromEntries(plan.asked.map((q) => [q.id, q.options[0].id]));
    composeResult(a, "세현", seed, DEFAULT_TEXTS, plan.asked, answers);
    const score = scoreOrders(a, { age: 38 });
    const report = buildReport(a, "세현", seed, DEFAULT_TEXTS.report, plan.asked, answers, DEFAULT_TEXTS.score, 38, orderOverride(a, seed, DEFAULT_TEXTS, score));
    const ids = report.points.map((p) => p.id);
    expect(ids).toContain("o_popularity");
    expect(ids).toContain("o_returns");
    expect(ids).toContain("o_cancel");
    expect(ids).toContain("o_age");
    expect(report.headline).toContain("주문내역");
    expect(report.scoreDetail?.items.some((x) => x.label === "랭킹템 쏠림")).toBe(true);
    if (process.env.PRINT_ORDER_ROAST) {
      console.log(plan.script.steps.map((s) => ("text" in s ? s.text : s.t === "ask" ? `[질문 ${plan.asked[s.q].text}]` : "")).filter(Boolean).join("\n"));
      console.log(JSON.stringify(report, null, 1));
    }
  });
});
