"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { CATEGORIES, SUBCATEGORIES, SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { MEASUREMENT_KEYS, MEASUREMENT_LABELS, formatNum } from "@/lib/constants/measurements";
import { cn } from "@/lib/cn";
import { importImageFile, importImageUrl } from "@/lib/import/client";
import { OrderGuide } from "./order-guide";
import { lookupOf, takeOrderHandoff, type OrderHandoff, type OrderLookup } from "@/lib/import/order-handoff";
import { findDuplicates, type ExistingGarment } from "@/lib/import/order-duplicates";
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
  /** 이미 옷장에 있는 옷인데 사용자가 그래도 추가하기로 했다 */
  keepDup: boolean;
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

/** 옷장에 넣을 옷: 체크했고, 이미 옷장에 있는 옷이면 사용자가 그래도 추가하기로 한 것만 */
const isWanted = (it: Item, duplicates: Map<string, string>) =>
  it.include && Boolean(it.categoryId) && it.saved !== "yes" && (!duplicates.has(it.key) || it.keepDup);

function duplicatesOf(items: Item[], existing: ExistingGarment[]) {
  return findDuplicates(
    items.map((it) => ({
      key: it.key,
      brand: it.brand,
      productName: it.productName,
      size: it.size,
      color: it.color,
      productUrl: it.productUrl ?? (it.order.goodsNo ? `https://www.musinsa.com/products/${it.order.goodsNo}` : null),
    })),
    existing,
  );
}

/** 주문 사이에 쉬는 시간. 무신사에 요청이 몰리지 않게 한다. */
const PAUSE_MS = 800;
/** 등록을 마친 뒤 완료 팝업을 보여 주고 옷장으로 가기까지의 시간 */
const DONE_POPUP_MS = 3000;

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
  const router = useRouter();
  const { addGarment, signedIn, garments } = useWardrobe();
  /** 가져오기를 시작한 때의 옷장. 가져온 옷이 등록되며 옷장이 바뀌어도 중복 판정은 이걸 기준으로 한다. */
  const [existing, setExisting] = useState<ExistingGarment[]>([]);
  const stop = useRef(false);
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
  const [phase, setPhase] = useState<"input" | "finding" | "review" | "saving" | "done">("input");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  /** 모두 등록한 벌 수. 값이 있으면 완료 팝업을 띄운다. */
  const [finished, setFinished] = useState<number | null>(null);

  // 주문내역 훈수에서 "옷장에 넣기"로 넘어오면 이미 읽은 결과로 바로 확인 화면을 연다.
  const taken = useRef(false);
  useEffect(() => {
    if (taken.current || !signedIn || !new URLSearchParams(window.location.search).has("from")) return;
    taken.current = true;
    const handoff = takeOrderHandoff();
    if (handoff) void start(handoff);
  });

  const patch = (keys: (k: string) => boolean, change: (item: Item) => Partial<Item>) =>
    setItems((prev) => prev?.map((it) => (keys(it.key) ? { ...it, ...change(it) } : it)) ?? prev);

  async function start(handoff?: OrderHandoff) {
    const parsed = parseOrdersToGarments(handoff?.text ?? text);
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
      keepDup: false,
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
    setExisting(garments);
    setItems(next);
    setDropped([...parsed.droppedByCategory.map((o) => o.name)]);
    setNotice(null);
    setPhase("finding");
    setProgress({ done: 0, total: orders.length });
    stop.current = false;

    // 주문내역 훈수에서 넘어왔으면 이미 읽은 결과를 그대로 쓴다(주문 순서는 같은 글을 나눈 순서).
    if (handoff) {
      for (const [n, order] of orders.entries()) {
        applyLookup((key) => key.startsWith(`${n}-`), handoff.lookups[parsed.orders.indexOf(order)] ?? null, "not_found");
      }
      setItems((prev) => prev?.map((it) => (it.status === "waiting" ? { ...it, status: "not_found" } : it)) ?? prev);
      setProgress({ done: orders.length, total: orders.length });
      setPhase("review");
      return;
    }

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
      applyLookup(mine, lookupOf(result), "failed");
      if (result?.outcome?.errorCode === "rate_limited") {
        setNotice("하루에 너무 많이 가져와서 일시적으로 막혔어요. 잠시 뒤에 다시 해 주세요. 찾은 옷까지만 확인해서 등록할 수 있어요.");
        break;
      }
      setProgress({ done: n + 1, total: orders.length });
    }
    // 멈추거나 한도로 끊긴 나머지는 찾지 않은 채로 둔다(이름·사이즈·가격만으로 등록 가능).
    setItems((prev) => prev?.map((it) => (it.status === "waiting" || it.status === "finding" ? { ...it, status: "not_found" } : it)) ?? prev);
    notifyUsageChanged();
    setPhase("review");
  }

  /** 조회 결과를 목록에 반영한다. lookup이 없으면 missing 상태로 둔다(이름·사이즈·가격만으로 등록 가능). */
  function applyLookup(mine: (key: string) => boolean, lookup: OrderLookup | null, missing: "failed" | "not_found") {
    if (!lookup) return patch(mine, () => ({ status: missing }));
    if (!lookup.goodsNo) return patch(mine, () => ({ status: "not_found" }));
    const goodsNo = lookup.goodsNo;
    if (!lookup.importId) return patch(mine, () => ({ status: "failed", productUrl: `https://www.musinsa.com/products/${goodsNo}` }));
    if (lookup.verdict === "not_garment") return patch(mine, () => ({ status: "not_garment", include: false }));
    const importId = lookup.importId;
    const rows = lookup.sizeRows;
    patch(mine, (it) => {
      // 셋업·팩은 주문에서 나눈 분류를 그대로 두고, 한 벌짜리는 상품 카테고리를 따른다.
      const fromProduct = lookup.verdict && typeof lookup.verdict === "object" && !it.part ? lookup.verdict : null;
      const categoryId = (fromProduct?.categoryId as CategoryId | undefined) ?? it.categoryId;
      const subcategoryId = fromProduct?.subcategoryId ?? it.subcategoryId;
      const row = matchSizeRow(rows, it.size || null);
      return {
        status: "found",
        // 브랜드·제품명은 상품 페이지 값을 쓴다(주문내역 글은 복사 방법에 따라 줄 순서가 달라진다).
        brand: lookup.brand ?? it.brand,
        productName: lookup.productName ?? it.productName,
        include: Boolean(categoryId),
        categoryId,
        subcategoryId,
        size: it.size || row?.sizeLabel || "",
        color: it.color || lookup.color || "",
        measurements: chartMeasurements(rows, it.size, categoryId),
        importId,
        productUrl: `https://www.musinsa.com/products/${goodsNo}`,
        hasImage: lookup.hasImage,
        sizeRows: rows,
      };
    });
  }

  async function save() {
    if (!items) return;
    setPhase("saving");
    const targets = items.filter((it) => isWanted(it, duplicates));
    let saved = 0;
    let failed = 0;
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
      if (result.ok) saved++;
      else failed++;
      patch((k) => k === it.key, () => (result.ok ? { saved: "yes" } : { saved: "error", error: result.error }));
    }
    setPhase("done");
    // 모두 등록되면 끝났다는 팝업을 잠깐 보여 주고 옷장으로 간다. 실패한 옷이 있으면 이 화면에 남아 다시 시도할 수 있게 한다.
    if (!failed) {
      setFinished(saved);
      setTimeout(() => router.push("/wardrobe"), DONE_POPUP_MS);
    } else {
      setNotice(`${saved}벌을 등록했고 ${failed}벌은 등록하지 못했어요. 표시된 옷을 확인한 뒤 다시 추가해 주세요.`);
    }
  }

  const list = items ?? [];
  const duplicates = duplicatesOf(list, existing);
  const counts = {
    include: list.filter((it) => isWanted(it, duplicates)).length,
    duplicate: list.filter((it) => duplicates.has(it.key) && !it.keepDup && it.saved !== "yes").length,
    saved: list.filter((it) => it.saved === "yes").length,
    failed: list.filter((it) => it.saved === "error").length,
    found: list.filter((it) => it.status === "found").length,
    withMeasure: list.filter((it) => Object.keys(it.measurements).length > 0).length,
  };

  const busy = phase === "finding" || phase === "saving";

  return (
    <main className="mx-auto max-w-280 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <Link href="/wardrobe/new" className="btn btn-ghost mb-2 text-sm">
        ← 새 옷 추가
      </Link>
      <div className="rise flex flex-col pb-2">
        <h1 className="large-title">무신사 주문내역으로 추가</h1>
        <p className="page-sub">
          주문내역에서 구매 확정된 옷만 골라 무신사 상품 정보(사진·실측)를 찾아요. 한 벌씩 확인한 뒤 고른 것만 옷장에 넣어요.
        </p>
      </div>

      {phase === "input" && (
        <section className="app-card rise mt-5 flex max-w-190 flex-col gap-4 p-5 md:p-8">
          <OrderGuide />
          <textarea
            className="input font-mono text-sm"
            rows={8}
            aria-label="무신사 주문내역"
            placeholder="주문내역을 붙여 넣으세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {notice && <p className="text-sm text-accent-700">{notice}</p>}
          <button type="button" className="btn btn-primary min-h-11 self-start" disabled={!text.trim() || !signedIn} onClick={() => start()}>
            옷만 골라서 찾기 시작
          </button>
          {!signedIn && <p className="text-sm text-neutral-700">로그인해야 쓸 수 있어요.</p>}
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-700">
            <li>지금은 무신사 주문내역만 가져올 수 있어요.</li>
            <li>이미 옷장에 있는 옷(같은 상품·사이즈)은 자동으로 빼고, 원하면 체크해서 다시 추가할 수 있어요.</li>
            <li>하루에 너무 많이 가져오면 일시적으로 막힐 수 있어요.</li>
          </ul>
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
                {counts.duplicate > 0 && ` · 이미 옷장에 있어 제외 ${counts.duplicate}`}
                {counts.saved > 0 && ` · 등록 ${counts.saved}`}
                {counts.failed > 0 && ` · 실패 ${counts.failed}`}
              </span>
            )}
          </div>
          {notice && <p className="text-sm text-accent-700">{notice}</p>}

          <ul className="flex flex-col border-t border-neutral-300">
            {items.map((it) => (
              <ItemRow key={it.key} item={it} duplicate={duplicates.has(it.key)} disabled={busy || it.saved === "yes"} onChange={(change) => patch((k) => k === it.key, change)} />
            ))}
          </ul>

          {dropped.length > 0 && (
            <details className="text-sm text-neutral-700">
              <summary>옷이 아니라서 뺀 주문 {dropped.length}건</summary>
              <p className="pt-2">{dropped.join(" · ")}</p>
            </details>
          )}

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-divider bg-bg py-3">
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
      {finished !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-2 border border-border bg-bg px-8 py-6 text-center shadow-lg">
            <span className="text-lg">{finished}벌을 옷장에 등록했어요</span>
            <span className="text-sm text-neutral-700">잠시 후 내 옷장으로 이동해요</span>
          </div>
        </div>
      )}
    </main>
  );
}

function ItemRow({
  item: it,
  duplicate,
  disabled,
  onChange,
}: {
  item: Item;
  duplicate: boolean;
  disabled: boolean;
  onChange: (change: (it: Item) => Partial<Item>) => void;
}) {
  const checked = duplicate ? it.keepDup : it.include;
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
    <li className={cn("flex gap-3 border-b border-neutral-300 py-3", !checked && "opacity-60")}>
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0"
        aria-label={`${it.productName} 등록`}
        checked={checked}
        disabled={disabled || !it.categoryId}
        onChange={(e) => onChange(() => (duplicate ? { keepDup: e.target.checked, include: e.target.checked || it.include } : { include: e.target.checked }))}
      />
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden">
        {it.hasImage && it.importId && (
          // eslint-disable-next-line @next/next/no-img-element -- 분석 이미지 프록시(로그인 필요)라 next/image 최적화를 쓰지 않는다.
          <img src={importImageUrl(it.importId, 0)} alt="" className="h-auto max-h-full w-auto max-w-full rounded-xs" loading="lazy" />
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
          {duplicate && it.saved !== "yes" && (
            <span className="text-accent-700">{it.keepDup ? "이미 옷장에 있어요 · 그래도 추가" : "이미 옷장에 있어요 · 추가하지 않아요"}</span>
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
