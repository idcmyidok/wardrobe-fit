"use client";

import { useEffect, useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import type { OrderItemResult } from "@/app/api/order-imports/item/route";
import { OrderGuide } from "@/components/garment-form/order-guide";
import { MIN_CLOTHES } from "@/lib/roast/copy";
import { beginOrderRoast, commitOrderRoast } from "@/server/roast/order-actions";
import { importImageUrl } from "@/lib/import/client";
import { lookupOf, saveOrderHandoff, type OrderLookup } from "@/lib/import/order-handoff";
import { matchSizeRow, parseOrdersForRoast } from "@/server/import/musinsa-orders";
import type { NormalizedSizeChart } from "@/server/import/types";
import type { OrderRoastItem } from "@/server/roast/orders/input";
import type { ORDER_SCREEN } from "@/server/roast/fl/screen";

/**
 * 주문내역 훈수의 붙여넣기와 상품 읽기(숨은 주소 /roast/orders).
 * 1) 붙여 넣은 글을 주문 가져오기와 같은 규칙으로 나눈다(반품·취소·교환도 분석용으로 남긴다).
 * 2) 구매 확정·교환한 주문마다 상품 페이지를 읽어 분류·사진·하트·후기 수를 붙인다. 하루 분석 한도에는 세지 않는다.
 *    읽는 동안에는 목록 대신 기다려 달라는 안내, 점 여섯 개와 번갈아 바뀌는 문장, 진행 %만 보여 준다(사용자 요청).
 * 붙여 넣은 글과 목록은 이 화면에만 있고 저장하지 않는다.
 */

export type OrderCopy = Record<keyof typeof ORDER_SCREEN, string | string[]>;

/** 주문 사이에 쉬는 시간(무신사에 요청이 몰리지 않게) */
const PAUSE_MS = 500;
/** 로딩 문장이 바뀌는 간격 */
const LINE_MS = 2400;

const text = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 산 사이즈의 실측(사이즈표에서 찾은 값)을 "chest:55|length:70"처럼 짧게. 같은 옷 반복 판단에만 쓴다. */
function measureOf(chart: NormalizedSizeChart | null | undefined, size: string | null): string | null {
  const row = chart ? matchSizeRow(chart.rows, size) : null;
  if (!row) return null;
  const parts = Object.entries(row.measurements)
    .filter((e): e is [string, number] => typeof e[1] === "number" && e[1] > 0 && e[1] < 1000)
    .sort(([x], [y]) => x.localeCompare(y))
    .slice(0, 10)
    .map(([k, v]) => `${k}:${Math.round(v * 10) / 10}`);
  return parts.length ? parts.join("|") : null;
}
/** 상품 페이지에서 브랜드를 못 읽어 "undefined" 같은 글자가 오면 주문내역의 브랜드를 쓴다 */
const brandOf = (v: string | null | undefined) => (v && !/^(undefined|null|none|-)$/i.test(v.trim()) ? v.trim() : null);

export function OrderPaste({ copy, onReady }: { copy: OrderCopy; onReady: (items: OrderRoastItem[], note: string | null) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function run() {
    const parsed = parseOrdersForRoast(value);
    if (!parsed.garments.length) {
      setError(text(copy.PASTE_EMPTY));
      return;
    }
    setError(null);
    setProgress(0);
    // 하루 한 번: 오늘 이미 했으면 여기서 막는다. 횟수는 읽은 옷이 30벌 이상일 때 쓴다(아래 commitOrderRoast).
    const begun = await beginOrderRoast();
    if (!begun.ok) {
      setError(begun.used ? text(copy.DAILY_USED) : begun.message);
      setProgress(null);
      return;
    }
    const orderIndex = new Map(parsed.orders.map((o, i) => [o, i]));
    const items: OrderRoastItem[] = parsed.garments.map((g) => ({
      order: orderIndex.get(g.order) ?? 0,
      status: g.status,
      brand: brandOf(g.order.brand) ?? "",
      name: g.order.name,
      categoryId: g.categoryId,
      subcategoryId: g.subcategoryId,
      color: g.color,
      size: g.size,
      price: g.price,
      date: g.order.date,
      goodsNo: g.order.goodsNo,
      likes: null,
      reviews: null,
      image: null,
      measure: null,
    }));
    /** 팩·셋업을 나눈 옷("1/2 · 상의")은 상품 카테고리로 분류를 덮지 않는다 */
    const split = parsed.garments.map((g) => Boolean(g.part));

    // 가진 옷(구매 확정·교환)의 주문만 상품 페이지를 읽는다. 반품·취소는 주문내역 글만으로 본다.
    const targets = [...new Set(items.filter((x) => x.status === "kept" || x.status === "exchanged").map((x) => x.order))];
    const dropped = new Set<number>();
    /** 상품 페이지를 읽었고 옷으로 확인된 주문 */
    const found = new Set<number>();
    /** "주문내역으로 추가" 화면에 넘길 읽은 결과(주문 순서별) */
    const lookups: Record<number, OrderLookup> = {};
    let failed = 0;
    let stop = false;
    for (const [n, order] of targets.entries()) {
      if (stop) break;
      if (n > 0) await sleep(PAUSE_MS);
      const first = items.find((x) => x.order === order)!;
      let result: OrderItemResult | null = null;
      try {
        const res = await fetch("/api/order-imports/item", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brand: first.brand, name: first.name, goodsNo: first.goodsNo, roast: true }),
        });
        if (res.status === 401) {
          setError("로그인이 풀렸습니다. 다시 로그인한 뒤 처음부터 해 주세요.");
          setProgress(null);
          return;
        }
        if (res.ok) result = (await res.json()) as OrderItemResult;
      } catch {
        result = null;
      }
      if (result?.outcome?.errorCode === "rate_limited") stop = true;
      const lookup = lookupOf(result);
      if (lookup) lookups[order] = lookup;
      const product = result?.outcome?.product ?? null;
      if (!product) failed++;
      else if (result?.verdict === "not_garment") dropped.add(order);
      else {
        found.add(order);
        // 사진은 무신사 주소를 바로 쓰면 사이트 보안 정책(CSP)에 막혀 깨진다. 분석 기록의 이미지 프록시로 받는다.
        const at = product.imageUrls.findIndex((u) => u.startsWith("https://image.msscdn.net/"));
        const image = result?.outcome?.importId && at >= 0 ? importImageUrl(result.outcome.importId, at) : null;
        items.forEach((x, k) => {
          if (x.order !== order) return;
          // 셋업·팩은 주문에서 나눈 분류를 그대로 두고, 한 벌짜리는 상품 카테고리를 따른다.
          const verdict = result?.verdict && typeof result.verdict === "object" && !split[k] ? result.verdict : null;
          if (verdict) {
            x.categoryId = verdict.categoryId as OrderRoastItem["categoryId"];
            x.subcategoryId = verdict.subcategoryId;
          }
          x.brand = brandOf(product.brand?.value) ?? brandOf(x.brand) ?? "";
          x.name = product.productName?.value ?? x.name;
          x.goodsNo = result?.goodsNo ?? x.goodsNo;
          x.color = x.color || product.colorCandidate?.value || null;
          x.likes = product.popularity?.likes ?? null;
          x.reviews = product.popularity?.reviews ?? null;
          x.image = image;
          x.measure = measureOf(product.sizeChart, x.size);
        });
      }
      setProgress(Math.round(((n + 1) / Math.max(targets.length, 1)) * 100));
    }
    setProgress(100);
    saveOrderHandoff({ text: value, lookups });
    // 훈수는 읽은 옷(가진 것만, 모자·신발·못 찾은 상품·옷이 아닌 상품 제외)이 30벌 이상일 때만. 모자라면 횟수를 쓰지 않고 안내한다(1년치만 복사했을 수 있어서).
    const real = items.filter((x) => (x.status === "kept" || x.status === "exchanged") && found.has(x.order) && !dropped.has(x.order) && x.categoryId !== "hat" && x.categoryId !== "shoes").length;
    if (real < MIN_CLOTHES) {
      setError(text(copy.TOO_FEW).replace(/\{n\}/g, String(real)));
      setProgress(null);
      return;
    }
    const committed = await commitOrderRoast();
    if (!committed.ok) {
      setError(committed.used ? text(copy.DAILY_USED) : committed.message);
      setProgress(null);
      return;
    }
    await sleep(300);
    onReady(items.filter((x) => !dropped.has(x.order)), failed || stop ? text(copy.LOADING_FAIL) : null);
  }

  if (progress != null) return <OrderLoading wait={text(copy.LOADING_WAIT)} lines={list(copy.LOADING)} percent={progress} />;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <p className="roast-ai">{text(copy.PASTE_ASK)}</p>
      <OrderGuide startLabel={text(copy.PASTE_LABEL)} />
      <span className="text-sm text-neutral-700">{text(copy.PASTE_GUIDE)}</span>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        aria-label="무신사 주문내역"
        placeholder="주문내역 전체를 붙여 넣어 주세요"
        className="w-full border border-border bg-surface p-3 text-body"
      />
      {error && (
        <p className="roast-ai" role="alert">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className={buttonClassName({ variant: "primary", size: "lg" })} disabled={!value.trim()}>
          {text(copy.PASTE_LABEL)}
        </button>
      </div>
    </form>
  );
}

/** 상품을 읽는 동안: 기다려 달라는 안내, 점 여섯 개(훈수 대화와 같은 움직임), 번갈아 바뀌는 문장, 진행 % */
function OrderLoading({ wait, lines, percent }: { wait: string; lines: string[]; percent: number }) {
  // 첫 문장은 무작위로 고르고 그다음부터 차례로 바꾼다.
  const [i, setI] = useState(() => Math.floor(Math.random() * Math.max(lines.length, 1)));
  useEffect(() => {
    if (lines.length < 2) return;
    const t = setInterval(() => setI((x) => x + 1), LINE_MS);
    return () => clearInterval(t);
  }, [lines.length]);
  const line = lines.length ? lines[i % lines.length] : "";
  return (
    <div className="roast-order-loading" role="status" aria-live="polite">
      {wait && <p className="roast-order-wait">{wait}</p>}
      <span className="roast-dots" aria-hidden>
        {Array.from({ length: 6 }, (_, k) => (
          <span key={k} style={{ animationDelay: `${k * 0.12}s` }}>
            .
          </span>
        ))}
      </span>
      <p key={i} className="roast-order-line">
        {line}
      </p>
      <p className="roast-order-percent">{percent}%</p>
    </div>
  );
}
