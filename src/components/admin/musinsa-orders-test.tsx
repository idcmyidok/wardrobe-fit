"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { MUSINSA_BOOKMARKLET } from "@/lib/import/musinsa-bookmarklet";

type Order = { date: string | null; name: string; brand: string; option: string; price: number; goodsNo: string | null };
type Garment = { orderIndex: number; part: string | null; size: string | null; price: number; subcategoryId: string | null };
type Candidate = { goodsNo: string; name: string; brand: string; imageUrl: string | null; score: number };
type Probe = {
  index: number;
  goodsNo: string | null;
  via: "bookmark" | "search" | "none";
  search: { keyword: string; best: Candidate | null; candidates: Candidate[]; diagnostics: Array<{ source: string; status: number | string; found: number }> } | null;
  measure: { status: string; sizes: string[]; category: string | null; images: number; error?: string } | null;
};
type Result = {
  counts: Record<"orders" | "droppedByStatus" | "droppedByCategory" | "garments" | "keptOrders" | "withGoodsNo", number>;
  orders: Order[];
  garments: Garment[];
  droppedByCategory: string[];
  probes: Probe[];
};

/** 한 요청에 찾는 주문 수. 요청이 길어지지 않게 작게 나눈다. */
const BATCH = 4;
const cell = "border-b border-neutral-300 px-2 py-1.5 align-top";

/** 관리자 시험 화면. 붙여 넣은 주문내역을 분류하고, 남은 주문의 상품번호·실측을 끝까지 차례로 찾는다. 저장은 하지 않는다. */
export function MusinsaOrdersTest() {
  const bookmark = useRef<HTMLAnchorElement>(null);
  const [text, setText] = useState("");
  const [measure, setMeasure] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // React는 javascript: 주소를 href로 넣지 못하게 막아서 직접 넣는다.
  useEffect(() => {
    bookmark.current?.setAttribute("href", MUSINSA_BOOKMARKLET);
  }, []);

  async function call(offset: number, limit: number) {
    const res = await fetch("/api/admin/musinsa-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, offset, limit, measure }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Result;
  }

  /** 먼저 분류만 해서 표를 보여 주고, 남은 주문을 끝까지 차례로 찾는다. 요청 사이에 쉬어서 무신사에 몰리지 않게 한다. */
  async function start() {
    stop.current = false;
    setBusy(true);
    setError(null);
    setProbes([]);
    try {
      const first = await call(0, 0);
      setResult(first);
      for (let offset = 0; offset < first.counts.keptOrders && !stop.current; offset += BATCH) {
        if (offset > 0) await new Promise((r) => setTimeout(r, 1000));
        const data = await call(offset, BATCH);
        setProbes((prev) => [...prev, ...data.probes]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "실패");
    } finally {
      setBusy(false);
    }
  }

  const found = probes.filter((p) => p.goodsNo).length;
  const measured = probes.filter((p) => p.measure?.sizes.length).length;

  return (
    <main className="mx-auto flex max-w-320 flex-col gap-6 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <div className="flex flex-col gap-1 border-b border-text pb-4">
        <span className="font-mono text-label tracking-[0.08em] text-neutral-700 uppercase">Admin · 시험</span>
        <h1 className="text-title">무신사 주문 가져오기 시험</h1>
        <p className="text-sm text-neutral-700">옷장에는 저장하지 않아요. 상품번호를 얼마나 찾는지, 실측이 있는지만 봐요.</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">북마크 방식</h2>
        <p className="text-sm text-pretty">
          아래 버튼을 즐겨찾기 막대로 끌어다 놓으세요. 무신사 주문내역을 맨 아래까지 스크롤한 뒤 그 즐겨찾기를 누르면 상품번호가 붙은 글이
          복사돼요. 그 글을 아래 칸에 붙여 넣으면 돼요.
        </p>
        <a ref={bookmark} className="btn btn-secondary min-h-10 self-start" onClick={(e) => e.preventDefault()}>
          무신사 주문 복사
        </a>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">주문내역 붙여 넣기</h2>
        <p className="text-sm text-neutral-700">Ctrl+A로 복사한 글(검색 방식)이나 북마크 버튼으로 복사한 글을 넣으세요.</p>
        <textarea className="input font-mono text-sm" rows={8} aria-label="주문내역" value={text} onChange={(e) => setText(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={measure} onChange={(e) => setMeasure(e.target.checked)} />
          찾은 상품의 실측도 확인(느려요)
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={busy || !text} onClick={start}>
            분류하고 찾기
          </Button>
          {busy && (
            <Button onClick={() => (stop.current = true)}>
              멈추기
            </Button>
          )}
          {busy && (
            <span className="self-center text-sm text-neutral-700">
              찾는 중… {probes.length}/{result?.counts.keptOrders ?? "?"}
            </span>
          )}
          {error && <span className="self-center text-sm text-accent-700">{error}</span>}
        </div>
      </section>

      {result && (
        <section className="flex flex-col gap-3">
          <p className="text-sm">
            주문 {result.counts.orders}건 · 상태로 뺀 것 {result.counts.droppedByStatus} · 옷이 아니라 뺀 것 {result.counts.droppedByCategory} · 남은 주문{" "}
            {result.counts.keptOrders}건 → 옷 {result.counts.garments}벌 · 북마크 상품번호 {result.counts.withGoodsNo}건
            {probes.length > 0 && ` · 찾아 본 ${probes.length}건 중 번호 찾음 ${found}, 실측 있음 ${measured}`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className={cell}>#</th>
                  <th className={cell}>주문</th>
                  <th className={cell}>옷</th>
                  <th className={cell}>찾은 상품</th>
                  <th className={cell}>실측</th>
                </tr>
              </thead>
              <tbody>
                {result.orders.map((o, i) => {
                  const p = probes.find((x) => x.index === i);
                  const best = p?.search?.best ?? p?.search?.candidates[0];
                  return (
                    <tr key={i}>
                      <td className={cell}>{i + 1}</td>
                      <td className={cell}>
                        <div>{o.name}</div>
                        <div className="text-neutral-700">
                          {o.brand} · {o.option} · {o.price.toLocaleString("ko-KR")}원 · {o.date}
                        </div>
                      </td>
                      <td className={cell}>
                        {result.garments
                          .filter((g) => g.orderIndex === i)
                          .map((g, k) => (
                            <div key={k}>
                              {g.part ? `${g.part} · ` : ""}
                              {g.subcategoryId ? SUBCATEGORY_NAME[g.subcategoryId] : "분류 모름"} · {g.size ?? "사이즈 ?"}
                            </div>
                          ))}
                      </td>
                      <td className={cell}>
                        {!p ? (
                          "—"
                        ) : p.goodsNo ? (
                          <a href={`https://www.musinsa.com/products/${p.goodsNo}`} target="_blank" rel="noreferrer">
                            {p.via === "bookmark" ? "북마크" : `검색 ${Math.round((p.search?.best?.score ?? 0) * 100)}%`} · {p.goodsNo}
                            {p.via === "search" && best && <div className="text-neutral-700">{best.name}</div>}
                          </a>
                        ) : (
                          <div className="text-accent-700">
                            못 찾음{best && ` (가장 비슷한 것 ${Math.round(best.score * 100)}%: ${best.name})`}
                            <div className="text-neutral-700">
                              {p.search?.keyword} · {p.search?.diagnostics.map((d) => `${d.source} ${d.status}/${d.found}`).join(", ")}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className={cell}>
                        {p?.measure
                          ? p.measure.sizes.length
                            ? `있음: ${p.measure.sizes.join(", ")}`
                            : `없음 (${p.measure.error ?? p.measure.status})`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {result.droppedByCategory.length > 0 && (
            <p className="text-sm text-neutral-700">옷이 아니라 뺀 것: {result.droppedByCategory.join(" · ")}</p>
          )}
        </section>
      )}
    </main>
  );
}
