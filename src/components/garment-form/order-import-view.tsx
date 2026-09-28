"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { CATEGORIES, SUBCATEGORIES, SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { MEASUREMENT_KEYS, MEASUREMENT_LABELS, formatNum } from "@/lib/constants/measurements";
import { cn } from "@/lib/cn";
import { importImageFile, importImageUrl } from "@/lib/import/client";
import { MUSINSA_BOOKMARKLET } from "@/lib/import/musinsa-bookmarklet";
import { notifyUsageChanged } from "@/lib/usage";
import type { CategoryId, Measurements } from "@/lib/types/domain";
import type { OrderItemResult } from "@/app/api/order-imports/item/route";
import { matchSizeRow, parseOrdersToGarments, type MusinsaOrder } from "@/server/import/musinsa-orders";
import type { NormalizedProduct } from "@/server/import/types";

/**
 * 무신사 주문내역으로 옷 여러 벌 추가(PROJECT_SPEC.md 12장 링크 분석을 주문마다 차례로 쓴다).
 * 1) 붙여 넣은 글에서 구매 확정·오프라인 구매 중 옷만 고르고 팩·셋업을 한 벌씩 나눈다(무신사에 묻지 않음).
 * 2) 주문마다 상품번호를 찾아(북마크 버튼이 붙인 번호, 없으면 검색) 사진·사이즈표를 읽는다. 상품 카테고리가 옷이 아니면 뺀다.
 * 3) 사용자가 한 벌씩 확인·수정하고 고른 것만 옷장에 등록한다.
 */

type Status = "waiting" | "finding" | "found" | "not_found" | "not_garment" | "failed";

interface Item {
  key: string;
  order: MusinsaOrder;
  part: string | null;
  status: Status;
  include: boolean;
  categoryId: CategoryId | "";
  subcategoryId: string;
  productName: string;
  brand: string;
  size: string;
  color: string;
  price: number;
  date: string;
  measurements: Measurements;
  importId: string | null;
  productUrl: string | null;
  hasImage: boolean;
  sizeRows: NonNullable<NormalizedProduct["sizeChart"]>["rows"];
  saved: "no" | "saving" | "yes" | "error";
  error?: string;
}

/** 주문 사이에 쉬는 시간. 무신사에 요청이 몰리지 않게 한다. */
const PAUSE_MS = 800;

const STATUS_TEXT: Record<Status, string> = {
  waiting: "대기",
  finding: "찾는 중",
  found: "찾음",
  not_found: "못 찾음",
  not_garment: "옷 아님",
  failed: "읽기 실패",
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function chartMeasurements(rows: Item["sizeRows"], size: string, categoryId: CategoryId | ""): Measurements {
  const row = matchSizeRow(rows, size || null);
  if (!row || !categoryId) return {};
  const m: Measurements = {};
  for (const k of MEASUREMENT_KEYS[categoryId]) if (row.measurements[k] != null) m[k] = row.measurements[k];
  return m;
}

export function OrderImportView() {
  const { addGarment, signedIn } = useWardrobe();
  const bookmark = useRef<HTMLAnchorElement>(null);
  const stop = useRef(false);
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
  const [phase, setPhase] = useState<"input" | "finding" | "review" | "saving" | "done">("input");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [notice, setNotice] = useState<string | null>(null);

  // React는 javascript: 주소를 href로 넣지 못하게 막아서 직접 넣는다.
  useEffect(() => {
    bookmark.current?.setAttribute("href", MUSINSA_BOOKMARKLET);
  }, [phase]);

  const patch = (keys: (k: string) => boolean, change: (item: Item) => Partial<Item>) =>
    setItems((prev) => prev?.map((it) => (keys(it.key) ? { ...it, ...change(it) } : it)) ?? prev);

  async function start() {
    const parsed = parseOrdersToGarments(text);
    if (!parsed.orders.length) {
      setNotice("주문을 찾지 못했어요. 무신사 주문내역 화면 전체를 복사해 붙여 넣어 주세요.");
      return;
    }
    const orders = [...new Set(parsed.garments.map((g) => g.order))];
    const next: Item[] = parsed.garments.map((g, i) => ({
      key: `${orders.indexOf(g.order)}-${i}`,
      order: g.order,
      part: g.part,
      status: "waiting",
      include: Boolean(g.categoryId),
      categoryId: g.categoryId ?? "",
      subcategoryId: g.subcategoryId ?? "",
      productName: g.order.name,
      brand: g.order.brand,
      size: g.size ?? "",
      color: g.color ?? "",
      price: g.price,
      date: g.order.date ?? "",
      measurements: {},
      importId: null,
      productUrl: null,
      hasImage: false,
      sizeRows: [],
      saved: "no",
    }));
    setItems(next);
    setDropped([...parsed.droppedByCategory.map((o) => o.name)]);
    setNotice(null);
    setPhase("finding");
    setProgress({ done: 0, total: orders.length });
    stop.current = false;

    for (const [n, order] of orders.entries()) {
      if (stop.current) break;
      if (n > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
      const mine = (key: string) => key.startsWith(`${n}-`);
      patch(mine, () => ({ status: "finding" }));
      let result: OrderItemResult | null = null;
      try {
        const res = await fetch("/api/order-imports/item", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brand: order.brand, name: order.name, goodsNo: order.goodsNo }),
        });
        if (res.status === 401) {
          setNotice("로그인이 풀렸어요. 다시 로그인한 뒤 처음부터 해 주세요.");
          break;
        }
        if (res.ok) result = (await res.json()) as OrderItemResult;
      } catch {
        result = null;
      }
      applyResult(mine, result);
      if (result?.outcome?.errorCode === "rate_limited") {
        setNotice("오늘 가져오기 한도(100번)를 다 써서 멈췄어요. 찾은 옷까지만 확인해서 등록할 수 있어요.");
        break;
      }
      setProgress({ done: n + 1, total: orders.length });
    }
    // 멈추거나 한도로 끊긴 나머지는 찾지 않은 채로 둔다(이름·사이즈·가격만으로 등록 가능).
    setItems((prev) => prev?.map((it) => (it.status === "waiting" || it.status === "finding" ? { ...it, status: "not_found" } : it)) ?? prev);
    notifyUsageChanged();
    setPhase("review");
  }

  function applyResult(mine: (key: string) => boolean, result: OrderItemResult | null) {
    const product = result?.outcome?.product ?? null;
    const importId = result?.outcome?.importId ?? null;
    if (!result || !result.goodsNo) return patch(mine, () => ({ status: result ? "not_found" : "failed" }));
    if (!product || !importId) return patch(mine, () => ({ status: "failed", productUrl: `https://www.musinsa.com/products/${result.goodsNo}` }));
    if (result.verdict === "not_garment") return patch(mine, () => ({ status: "not_garment", include: false }));
    const rows = product.sizeChart?.rows ?? [];
    patch(mine, (it) => {
      // 셋업·팩은 주문에서 나눈 분류를 그대로 두고, 한 벌짜리는 상품 카테고리를 따른다.
      const fromProduct = result.verdict && typeof result.verdict === "object" && !it.part ? result.verdict : null;
      const categoryId = (fromProduct?.categoryId as CategoryId | undefined) ?? it.categoryId;
      const subcategoryId = fromProduct?.subcategoryId ?? it.subcategoryId;
      const row = matchSizeRow(rows, it.size || null);
      return {
        status: "found",
        include: Boolean(categoryId),
        categoryId,
        subcategoryId,
        size: it.size || row?.sizeLabel || "",
        color: it.color || product.colorCandidate?.value || "",
        measurements: chartMeasurements(rows, it.size, categoryId),
        importId,
        productUrl: `https://www.musinsa.com/products/${result.goodsNo}`,
        hasImage: product.imageUrls.length > 0,
        sizeRows: rows,
      };
    });
  }

  async function save() {
    if (!items) return;
    setPhase("saving");
    const targets = items.filter((it) => it.include && it.categoryId && it.saved !== "yes");
    for (const it of targets) {
      patch((k) => k === it.key, () => ({ saved: "saving", error: undefined }));
      const file = it.hasImage && it.importId ? await importImageFile(importImageUrl(it.importId, 0)) : undefined;
      const result = await addGarment(
        {
          categoryId: it.categoryId as CategoryId,
          subcategoryId: it.subcategoryId || null,
          brand: it.brand.trim(),
          productName: it.productName.trim(),
          sizeLabel: it.size.trim() || null,
          colorName: it.color.trim() || null,
          seasons: [],
          purchasedOn: it.date || null,
          purchasePrice: it.price || null,
          productUrl: it.productUrl,
          imageUrl: null,
          measurements: it.measurements,
          fitReview: null,
          shoeFit: null,
          userFit: null,
        },
        file,
        it.importId,
      );
      patch((k) => k === it.key, () => (result.ok ? { saved: "yes" } : { saved: "error", error: result.error }));
    }
    setPhase("done");
  }

  const counts = useMemo(() => {
    const list = items ?? [];
    return {
      include: list.filter((it) => it.include && it.categoryId && it.saved !== "yes").length,
      saved: list.filter((it) => it.saved === "yes").length,
      failed: list.filter((it) => it.saved === "error").length,
      found: list.filter((it) => it.status === "found").length,
      withMeasure: list.filter((it) => Object.keys(it.measurements).length > 0).length,
    };
  }, [items]);

  const busy = phase === "finding" || phase === "saving";

  return (
    <main className="mx-auto max-w-280 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <Link href="/wardrobe/new" className="btn btn-ghost mb-2 text-sm">
        ← 새 옷 추가
      </Link>
      <div className="flex flex-col gap-1 border-b border-text pb-4">
        <h1 className="text-title">무신사 주문내역으로 추가</h1>
        <p className="text-sm text-neutral-700 text-pretty">
          주문내역에서 구매 확정된 옷만 골라 무신사 상품 정보(사진·실측)를 찾아요. 한 벌씩 확인한 뒤 고른 것만 옷장에 넣어요.
        </p>
      </div>

      {phase === "input" && (
        <section className="flex max-w-190 flex-col gap-4 py-8">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-base text-pretty">
            <li>PC에서 무신사 마이페이지의 주문내역을 열고 맨 아래까지 스크롤해요.</li>
            <li>
              아래 <b>무신사 주문 복사</b> 버튼을 즐겨찾기 막대로 끌어다 놓은 뒤, 주문내역 화면에서 그 즐겨찾기를 눌러요. 상품번호까지 함께 복사돼서
              더 정확해요. 휴대폰이라면 주문내역 화면을 전체 선택해서 복사해도 돼요.
            </li>
            <li>복사한 글을 아래 칸에 붙여 넣고 시작을 눌러요.</li>
          </ol>
          <a ref={bookmark} className="btn btn-secondary min-h-10 self-start" onClick={(e) => e.preventDefault()}>
            무신사 주문 복사
          </a>
          <textarea
            className="input font-mono text-sm"
            rows={8}
            aria-label="무신사 주문내역"
            placeholder="주문내역을 붙여 넣으세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {notice && <p className="text-sm text-accent-700">{notice}</p>}
          <button type="button" className="btn btn-primary min-h-11 self-start" disabled={!text.trim() || !signedIn} onClick={start}>
            옷만 골라서 찾기 시작
          </button>
          {!signedIn && <p className="text-sm text-neutral-700">로그인해야 쓸 수 있어요.</p>}
          <p className="text-sm text-neutral-700">상품 하나를 찾을 때마다 하루 가져오기 한도(100번)에서 1번씩 써요.</p>
        </section>
      )}

      {items && phase !== "input" && (
        <section className="flex flex-col gap-4 py-6">
          <div className="flex flex-wrap items-center gap-3">
            {phase === "finding" ? (
              <>
                <span className="text-base">
                  찾는 중… {progress.done}/{progress.total}
                </span>
                <button type="button" className="btn btn-secondary min-h-9 text-sm" onClick={() => (stop.current = true)}>
                  멈추기
                </button>
              </>
            ) : (
              <span className="text-base">
                옷 {items.length}벌 · 상품 찾음 {counts.found} · 실측 있음 {counts.withMeasure}
                {counts.saved > 0 && ` · 등록 ${counts.saved}`}
                {counts.failed > 0 && ` · 실패 ${counts.failed}`}
              </span>
            )}
          </div>
          {notice && <p className="text-sm text-accent-700">{notice}</p>}

          <ul className="flex flex-col border-t border-neutral-300">
            {items.map((it) => (
              <ItemRow key={it.key} item={it} disabled={busy || it.saved === "yes"} onChange={(change) => patch((k) => k === it.key, change)} />
            ))}
          </ul>

          {dropped.length > 0 && (
            <details className="text-sm text-neutral-700">
              <summary>옷이 아니라서 뺀 주문 {dropped.length}건</summary>
              <p className="pt-2">{dropped.join(" · ")}</p>
            </details>
          )}

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-text bg-bg py-3">
            <span className="text-sm text-neutral-700">
              {phase === "done" ? `${counts.saved}벌을 옷장에 등록했어요.` : "체크한 옷만 등록돼요. 실측이 없는 옷은 나중에 옷장에서 채울 수 있어요."}
            </span>
            <div className="flex gap-2">
              {phase === "done" && (
                <Link href="/wardrobe" className="btn btn-secondary min-h-11">
                  옷장 보기
                </Link>
              )}
              <button type="button" className="btn btn-primary min-h-11" disabled={busy || counts.include === 0} onClick={save}>
                {phase === "saving" ? "등록 중…" : `${counts.include}벌 옷장에 추가`}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function ItemRow({ item: it, disabled, onChange }: { item: Item; disabled: boolean; onChange: (change: (it: Item) => Partial<Item>) => void }) {
  const measured = it.categoryId
    ? MEASUREMENT_KEYS[it.categoryId].filter((k) => it.measurements[k] != null).map((k) => `${MEASUREMENT_LABELS[k]} ${formatNum(it.measurements[k]!)}`)
    : [];
  const sizeOptions = [...new Set([it.size, ...it.sizeRows.map((r) => r.sizeLabel)].filter(Boolean))];
  const setCategory = (subId: string) => {
    const sub = SUBCATEGORIES.find((s) => s.id === subId);
    onChange((cur) => {
      const categoryId = sub?.categoryId ?? "";
      return { subcategoryId: subId, categoryId, include: Boolean(categoryId) && cur.include, measurements: chartMeasurements(cur.sizeRows, cur.size, categoryId) };
    });
  };

  return (
    <li className={cn("flex gap-3 border-b border-neutral-300 py-3", !it.include && "opacity-60")}>
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0"
        aria-label={`${it.productName} 등록`}
        checked={it.include}
        disabled={disabled || !it.categoryId}
        onChange={(e) => onChange(() => ({ include: e.target.checked }))}
      />
      <div className="size-20 shrink-0 overflow-hidden bg-neutral-100">
        {it.hasImage && it.importId && (
          // eslint-disable-next-line @next/next/no-img-element -- 분석 이미지 프록시(로그인 필요)라 next/image 최적화를 쓰지 않는다.
          <img src={importImageUrl(it.importId, 0)} alt="" className="size-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm text-neutral-700">
          <span>{it.brand}</span>
          <span>{it.date}</span>
          <span>{won(it.price)}</span>
          {it.part && <span>{it.part}</span>}
          <span className={cn(it.status === "found" ? "text-neutral-700" : "text-accent-700")}>{STATUS_TEXT[it.status]}</span>
          {it.productUrl && (
            <a href={it.productUrl} target="_blank" rel="noreferrer">
              무신사에서 보기
            </a>
          )}
          {it.saved === "yes" && <span className="text-text">등록됨</span>}
          {it.saved === "error" && <span className="text-accent-700">{it.error}</span>}
        </div>
        <input
          className="input text-base"
          aria-label="제품명"
          value={it.productName}
          disabled={disabled}
          onChange={(e) => onChange(() => ({ productName: e.target.value }))}
        />
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" aria-label="분류" value={it.subcategoryId} disabled={disabled} onChange={(e) => setCategory(e.target.value)}>
            <option value="">분류 선택</option>
            {CATEGORIES.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {SUBCATEGORIES.filter((s) => s.categoryId === c.id).map((s) => (
                  <option key={s.id} value={s.id}>
                    {c.name} · {SUBCATEGORY_NAME[s.id]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            className="input w-auto"
            aria-label="사이즈"
            value={it.size}
            disabled={disabled}
            onChange={(e) => onChange((cur) => ({ size: e.target.value, measurements: chartMeasurements(cur.sizeRows, e.target.value, cur.categoryId) }))}
          >
            {!it.size && <option value="">사이즈</option>}
            {sizeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {it.color && <span className="self-center text-sm">{it.color}</span>}
        </div>
        <span className="text-sm text-neutral-700">{measured.length ? measured.join(" · ") : "실측 없음"}</span>
      </div>
    </li>
  );
}
