"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { UnitInput } from "@/components/ui/input";
import { CATEGORY_NAME, SUBCATEGORIES, SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { formatCm, measurementFields, type MeasurementKey } from "@/lib/constants/measurements";
import { cn } from "@/lib/cn";
import {
  FIT_BY_SIZE,
  FIT_COMPARABLE_IDS,
  FIT_LIMITS,
  FIT_PRODUCT,
  FIT_QUOTES,
  FIT_WARNING,
  REVIEW_SIGNALS,
  type FitTag,
} from "@/lib/mock/fit-check";
import type { CategoryId, Garment } from "@/lib/types/domain";

interface ManualInput {
  categoryId: CategoryId;
  subcategoryId: string;
  brand: string;
  productName: string;
  size: string;
  m: Record<string, string>;
}

const TAG_CLASS: Record<FitTag, string> = {
  "범위 내": "tag tag-neutral",
  주의: "tag tag-accent",
  "근거 부족": "tag",
  "비교 불가": "tag",
};

interface FitRow {
  label: string;
  cand: string;
  comps: string[];
  range: string;
  diff: string;
  warn: boolean;
  tag: FitTag;
  judge: string;
  bandLeft: string;
  bandWidth: string;
  tickLeft: string;
  hasCand: boolean;
}

/** 치수 하나의 비교 행. 만족 범위는 후기에서 "좋다"로 읽힌 옷의 실측으로 정한다. */
function buildRow(
  key: MeasurementKey,
  label: string,
  cand: number | null | undefined,
  included: Garment[],
  judged: [FitTag, string] | null,
): FitRow {
  const good = included
    .filter((c) => REVIEW_SIGNALS[c.id]?.[key] === "good")
    .map((c) => c.measurements[key])
    .filter((v): v is number => v != null);
  const lo = good.length ? Math.min(...good) : null;
  const hi = good.length ? Math.max(...good) : null;

  let diff = "—";
  let warn = false;
  if (cand != null && lo != null && hi != null) {
    if (cand >= lo && cand <= hi) diff = "0.0";
    else {
      const dv = cand > hi ? cand - hi : cand - lo;
      diff = `${dv > 0 ? "+" : "−"}${Math.abs(dv).toFixed(1)}`;
      warn = true;
    }
  }

  let tag: FitTag;
  let judge: string;
  if (judged) [tag, judge] = judged;
  else if (cand == null) [tag, judge] = ["비교 불가", "신규 실측 없음"];
  else if (lo == null)
    [tag, judge] = ["근거 부족", included.some((c) => c.measurements[key] != null) ? "만족 후기가 없어 수치만 표시" : "기존 옷 실측 없음"];
  else if (warn) [tag, judge] = ["주의", diff.startsWith("+") ? `만족 범위보다 ${diff.slice(1)} 큼` : `만족 범위보다 ${diff.slice(1)} 작음`];
  else [tag, judge] = ["범위 내", "만족했던 옷들과 비슷함"];

  const scale = [...included.map((c) => c.measurements[key]), cand].filter((v): v is number => v != null);
  const mn = (scale.length ? Math.min(...scale) : 0) - 1;
  const mx = (scale.length ? Math.max(...scale) : 0) + 1;
  const pc = (v: number) => `${(((v - mn) / (mx - mn)) * 100).toFixed(1)}%`;

  return {
    label,
    cand: formatCm(cand),
    comps: included.map((c) => formatCm(c.measurements[key])),
    range: lo == null || hi == null ? "—" : lo === hi ? formatCm(lo) : `${formatCm(lo)} – ${formatCm(hi)}`,
    diff,
    warn,
    tag,
    judge,
    bandLeft: lo == null ? "0%" : pc(lo),
    bandWidth: lo == null || hi == null ? "0%" : `${(((hi - lo) / (mx - mn)) * 100 || 1.5).toFixed(1)}%`,
    tickLeft: cand == null ? "0%" : pc(cand),
    hasCand: cand != null,
  };
}

export function FitCheckView() {
  const { garments, openDrawer, setPendingDraft } = useWardrobe();
  const router = useRouter();
  const [phase, setPhase] = useState<"input" | "result">("input");
  const [manual, setManual] = useState(false);
  const [url, setUrl] = useState(FIT_PRODUCT.url);
  const [parsed, setParsed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState("48");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [man, setMan] = useState<ManualInput>({ categoryId: "outer", subcategoryId: "outer.jacket", brand: "", productName: "", size: "", m: {} });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // 비교할 옷: 링크는 시안의 자켓 3벌, 직접 입력은 동일 세부분류(없으면 같은 대분류)에서 최대 4벌
  let comps: Garment[];
  if (manual) {
    const same = garments.filter((g) => g.subcategoryId === man.subcategoryId);
    comps = (same.length ? same : garments.filter((g) => g.categoryId === man.categoryId)).slice(0, 4);
  } else {
    comps = FIT_COMPARABLE_IDS.map((id) => garments.find((g) => g.id === id)).filter((g): g is Garment => Boolean(g));
  }
  const sameSub = manual ? comps.every((c) => c.subcategoryId === man.subcategoryId) : true;
  const included = comps.filter((c) => !excluded.includes(c.id));

  const manualNumbers: Partial<Record<MeasurementKey, number>> = {};
  Object.entries(man.m).forEach(([k, v]) => {
    if (v !== "" && !isNaN(Number(v))) manualNumbers[k as MeasurementKey] = Number(v);
  });
  const fit = FIT_BY_SIZE[size];
  const dims = measurementFields(manual ? man.categoryId : FIT_PRODUCT.categoryId);
  const rows = dims.map(({ key, label }) =>
    buildRow(
      key,
      label,
      manual ? manualNumbers[key] : fit.m[key],
      included,
      manual ? null : (fit.judge[key] ?? null),
    ),
  );

  const cantJudge = included.length === 0 || (manual && Object.keys(manualNumbers).length === 0);
  const sizeLabel = manual ? man.size || "—" : size;

  const summary = manual
    ? (() => {
        const w = rows.filter((r) => r.tag === "주의").map((r) => r.label);
        const ok = rows.filter((r) => r.tag === "범위 내").map((r) => r.label);
        if (!ok.length && !w.length)
          return "만족 후기가 있는 치수가 없어 수치 비교만 표시했습니다. 비교한 옷에 착용 후기를 남기면 예상 핏을 설명할 수 있습니다.";
        return (
          (ok.length ? `${ok.join("·")}은(는) 만족했던 옷들의 범위 안에 있습니다. ` : "") +
          (w.length ? `${w.join("·")}은(는) 범위를 벗어나 다르게 느껴질 수 있습니다.` : "벗어나는 치수는 없습니다.")
        );
      })()
    : fit.summary;

  const analyze = () => {
    setBusy(true);
    setParsed(false);
    timer.current = setTimeout(() => {
      setBusy(false);
      setParsed(true);
    }, 1100);
  };

  const sizeOptions = manual ? [man.size || "입력"] : FIT_PRODUCT.sizes;
  const sizeSeg = (name: string) => (
    <div className="seg" role="radiogroup" aria-label="비교 사이즈">
      {sizeOptions.map((s) => (
        <label key={s} className="seg-opt px-5 py-2 font-mono text-body tabular-nums">
          <input type="radio" name={name} checked={manual || size === s} onChange={() => !manual && setSize(s)} />
          {s}
        </label>
      ))}
    </div>
  );

  const toggleMode = (toManual: boolean) => {
    setManual(toManual);
    setExcluded([]);
  };

  if (phase === "result") {
    const title = manual ? [man.brand, man.productName].filter(Boolean).join(" ") || "직접 입력한 옷" : `${FIT_PRODUCT.brand} ${FIT_PRODUCT.productName}`;
    const sub = manual
      ? `${CATEGORY_NAME[man.categoryId]} · ${SUBCATEGORY_NAME[man.subcategoryId] ?? ""} · 직접 입력한 실측`
      : "아우터 · 자켓 · 사이즈표 기준 실측";
    const judgedCount = manual
      ? `${dims.length}개 중 ${rows.filter((r) => r.tag === "범위 내" || r.tag === "주의").length}개`
      : "6개 중 4개";
    const warning = manual
      ? `${rows.filter((r) => r.tag === "근거 부족" || r.tag === "비교 불가").map((r) => r.label).join(", ") || "없음"} — 근거가 부족하거나 실측이 없어 판단하지 않았습니다.`
      : FIT_WARNING;
    const limits = manual
      ? [
          ...rows.filter((r) => r.tag === "비교 불가").map((r) => `${r.label}: 신규 실측을 입력하지 않아 비교하지 않았습니다.`),
          ...rows.filter((r) => r.tag === "근거 부족").map((r) => `${r.label}: 만족 후기가 없어 수치만 표시했습니다.`),
          "직접 입력한 실측은 사이즈표 오차를 확인할 수 없습니다.",
        ]
      : FIT_LIMITS;
    const refSub = manual ? man.subcategoryId : FIT_PRODUCT.subcategoryId;

    return (
      <main className="mx-auto max-w-320 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
        <button type="button" className="btn btn-ghost mb-2 text-sm" onClick={() => setPhase("input")}>
          ← 입력으로
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-text pb-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-xs font-medium tracking-[0.08em] text-accent-700">AI 구매 판단 · 2026.09.27</span>
            <h1 className="text-title">{title}</h1>
            <span className="text-base text-neutral-700">{sub}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-neutral-700">비교 사이즈</span>
            {sizeSeg("fitsz2")}
          </div>
        </div>

        <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] border-b border-text">
          <div className="flex flex-col gap-3 py-7 pr-8 md:col-span-2">
            <div className="flex items-end gap-4">
              <span className="font-display text-display-xl tracking-[-0.03em]">{sizeLabel}</span>
              <h2 className="mb-1.5 font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">예상 핏</h2>
            </div>
            <p className="max-w-190 text-quote leading-normal text-pretty">{summary}</p>
          </div>
          <div className="flex flex-col gap-3 border-divider py-7 md:border-l md:pl-6">
            <h2 className="font-mono text-sm font-medium tracking-[0.08em] text-neutral-700">판단 신뢰도</h2>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[28px] font-semibold">보통</span>
              <span className="text-sm text-neutral-700">4단계 중 3</span>
            </div>
            <div className="grid grid-cols-4 gap-0.75" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={cn("h-1.5", i < 3 ? "bg-text" : "bg-neutral-300")} />
              ))}
            </div>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-base tabular-nums">
              <dt className="text-neutral-700">비교한 옷</dt>
              <dd>
                {manual ? SUBCATEGORY_NAME[man.subcategoryId] ?? CATEGORY_NAME[man.categoryId] : "자켓"} {included.length}벌
              </dd>
              <dt className="text-neutral-700">인용한 후기</dt>
              <dd>{manual ? `${included.filter((c) => c.fitReview).length}개` : "3개"}</dd>
              <dt className="text-neutral-700">판단한 치수</dt>
              <dd>{judgedCount}</dd>
            </dl>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-start gap-3 border border-accent px-4 py-3.5">
          <span className="tag tag-accent font-semibold">데이터 부족</span>
          <span className="min-w-60 flex-1 text-base text-pretty text-accent-800">{warning}</span>
        </div>

        <section className="flex flex-col gap-3 pt-8 pb-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg">치수별 비교</h2>
            <span className="text-sm text-neutral-700">cm · 단면 · 만족 범위는 해당 치수를 좋다고 기록한 옷 기준</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-240 font-mono tabular-nums">
              <thead>
                <tr>
                  <th>치수</th>
                  <th className="text-right text-text">신규 {sizeLabel === "—" ? "" : sizeLabel}</th>
                  {included.map((c) => (
                    <th key={c.id} className="text-right">
                      {c.brand === "Engineered Garments" ? "EG" : c.brand} {c.sizeLabel}
                    </th>
                  ))}
                  <th className="text-right">만족 범위</th>
                  <th className="w-40">위치</th>
                  <th className="text-right">차이</th>
                  <th className="pl-6">예상 핏</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td className="font-semibold whitespace-nowrap">{r.label}</td>
                    <td className="bg-neutral-100 text-right text-md font-semibold">{r.cand}</td>
                    {r.comps.map((v, i) => (
                      <td key={i} className="text-right text-neutral-800">
                        {v}
                      </td>
                    ))}
                    <td className="text-right whitespace-nowrap">{r.range}</td>
                    <td>
                      <div className="relative h-4.5 w-35" aria-hidden>
                        <div className="absolute inset-x-0 top-2 h-px bg-neutral-400" />
                        <div className="absolute top-1 h-2.25 rounded-sm bg-accent-300" style={{ left: r.bandLeft, width: r.bandWidth }} />
                        <div
                          className={cn("absolute top-0 h-4.25 w-0.5", r.warn ? "bg-accent-700" : "bg-text", !r.hasCand && "opacity-0")}
                          style={{ left: r.tickLeft }}
                        />
                      </div>
                    </td>
                    <td className={cn("text-right font-semibold whitespace-nowrap", r.warn ? "text-accent-700" : "text-neutral-700")}>{r.diff}</td>
                    <td className="pl-6">
                      <div className="flex items-baseline gap-2 font-sans">
                        <span className={cn(TAG_CLASS[r.tag], "flex-none")}>{r.tag}</span>
                        <span className="text-base">{r.judge}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-x-12 pt-8">
          <div className="flex flex-col">
            <h2 className="mb-3 border-b border-text pb-3 text-lg">착용 후기 근거</h2>
            {!manual ? (
              FIT_QUOTES.map((q) => (
                <figure key={q.source} className="flex flex-col gap-2 border-b border-neutral-300 py-4">
                  <div className="flex items-center gap-2">
                    <span className={q.accent ? "tag tag-accent" : "tag tag-neutral"}>{q.tag}</span>
                    <span className="text-sm text-neutral-700">{q.source}</span>
                  </div>
                  <blockquote className="text-lead">“{q.text}”</blockquote>
                  {q.note && <figcaption className="text-sm text-neutral-700">{q.note}</figcaption>}
                </figure>
              ))
            ) : included.some((c) => c.fitReview) ? (
              included
                .filter((c) => c.fitReview)
                .map((c) => (
                  <figure key={c.id} className="flex flex-col gap-2 border-b border-neutral-300 py-4">
                    <span className="text-sm text-neutral-700">
                      {c.brand} {c.productName} {c.sizeLabel ?? ""}
                    </span>
                    <blockquote className="text-lead">“{c.fitReview}”</blockquote>
                  </figure>
                ))
            ) : (
              <p className="mt-3 text-base text-neutral-700">비교한 옷에 착용 후기가 없습니다. 후기를 남기면 판단 근거로 인용됩니다.</p>
            )}
          </div>
          <div className="flex flex-col">
            <h2 className="mb-3 border-b border-text pb-3 text-lg">비교에 사용한 옷</h2>
            {included.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openDrawer(c.id)}
                className="grid cursor-pointer grid-cols-[40px_1fr_auto] items-center gap-3 border-b border-neutral-300 py-3 text-left hover:bg-neutral-100"
              >
                <div className="h-12.5 w-10 bg-neutral-200" />
                <div className="flex min-w-0 flex-col">
                  <span className="text-base font-semibold">
                    {c.brand} <span className="font-normal">{c.sizeLabel}</span>
                  </span>
                  <span className="text-base">{c.productName}</span>
                  <span className="text-xs text-neutral-700">
                    {c.subcategoryId === refSub
                      ? `동일 세부분류 · ${c.subcategoryId ? SUBCATEGORY_NAME[c.subcategoryId] : ""}`
                      : `같은 대분류 · ${CATEGORY_NAME[c.categoryId]}`}
                  </span>
                </div>
                <span className="text-sm text-accent-700">상세</span>
              </button>
            ))}
            <h2 className="mt-8 mb-3 border-b border-text pb-3 text-lg">데이터 한계</h2>
            <ul className="flex flex-col text-base">
              {limits.map((x) => (
                <li key={x} className="border-b border-neutral-300 py-2.5">
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-2 border-t border-text pt-4">
          {!manual && (
            <button
              type="button"
              className="btn btn-primary min-h-11"
              onClick={() => {
                setPendingDraft({
                  categoryId: FIT_PRODUCT.categoryId,
                  subcategoryId: FIT_PRODUCT.subcategoryId,
                  brand: FIT_PRODUCT.brand,
                  productName: FIT_PRODUCT.productName,
                  sizeLabel: size,
                  colorName: null,
                  material: FIT_PRODUCT.material,
                  seasons: [],
                  purchasedOn: null,
                  purchasePrice: null,
                  productUrl: url,
                  imageUrl: null,
                  measurements: fit.m,
                  fitReview: null,
                });
                router.push("/wardrobe/new");
              }}
            >
              이 옷을 구매했어요 — 옷장에 추가
            </button>
          )}
          <button type="button" className="btn btn-secondary min-h-11" onClick={() => setPhase("input")}>
            다른 옷 판단하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-280 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <Link href="/wardrobe" className="btn btn-ghost mb-2 text-sm">
        ← 내 옷장
      </Link>
      <div className="flex flex-col gap-1.5 border-b border-text pb-4">
        <h1 className="text-title">AI 구매 판단기</h1>
        <p className="text-body text-neutral-800">
          사려는 옷의 링크와 고민 중인 사이즈를 넣으면, 옷장에 기록한 옷과 치수별로 비교합니다.
        </p>
      </div>

      {!manual ? (
        <section className="flex max-w-190 flex-col gap-3 py-7">
          <div className="field">
            <label htmlFor="fit-url" className="text-sm">
              상품 URL
            </label>
            <div className="flex gap-2">
              <input id="fit-url" className="input min-h-11 text-body" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button type="button" className="btn btn-secondary min-h-11 min-w-26" onClick={analyze}>
                {busy ? "분석 중…" : "상품 분석"}
              </button>
            </div>
          </div>
          <button type="button" className="btn btn-ghost self-start text-sm" onClick={() => toggleMode(true)}>
            링크 없이 실측 직접 입력
          </button>
        </section>
      ) : (
        <section className="flex flex-col gap-5 border-b border-neutral-300 py-7">
          <div className="flex flex-col items-start gap-1.5">
            <h2 className="text-lg">사려는 옷 직접 입력</h2>
            <button type="button" className="btn btn-ghost pl-0 text-sm" onClick={() => toggleMode(false)}>
              ← 상품 링크로 입력
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            <div className="field">
              <label htmlFor="fm-cat">대분류</label>
              <select
                id="fm-cat"
                className="input"
                value={man.categoryId}
                onChange={(e) => {
                  const categoryId = e.target.value as CategoryId;
                  const first = SUBCATEGORIES.find((s) => s.categoryId === categoryId)!;
                  setMan({ ...man, categoryId, subcategoryId: first.id, m: {} });
                  setExcluded([]);
                }}
              >
                <option value="outer">아우터</option>
                <option value="top">상의</option>
                <option value="bottom">하의</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="fm-sub">세부분류</label>
              <select id="fm-sub" className="input" value={man.subcategoryId} onChange={(e) => setMan({ ...man, subcategoryId: e.target.value })}>
                {SUBCATEGORIES.filter((s) => s.categoryId === man.categoryId).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fm-brand">브랜드</label>
              <input id="fm-brand" className="input" placeholder="선택 입력" value={man.brand} onChange={(e) => setMan({ ...man, brand: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="fm-name">제품명</label>
              <input id="fm-name" className="input" placeholder="선택 입력" value={man.productName} onChange={(e) => setMan({ ...man, productName: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="fm-size">고민 중인 사이즈</label>
              <input id="fm-size" className="input" placeholder="예: M, 48, 32" value={man.size} onChange={(e) => setMan({ ...man, size: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-md">실측</h3>
            <span className="text-sm text-neutral-700">
              cm · 단면 기준 · 사이즈표 값을 그대로 옮기세요. 비워 둔 치수는 판단하지 않습니다.
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {measurementFields(man.categoryId).map((m) => (
              <div key={m.key} className="field">
                <label htmlFor={`fm-m-${m.key}`}>{m.label}</label>
                <UnitInput
                  id={`fm-m-${m.key}`}
                  unit="cm"
                  inputMode="decimal"
                  className="text-body"
                  value={man.m[m.key] ?? ""}
                  onChange={(e) => setMan({ ...man, m: { ...man.m, [m.key]: e.target.value } })}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {(manual || parsed) && (
        <>
          {!manual && (
            <>
              <section className="grid grid-cols-[72px_1fr] gap-4 border-t border-b border-t-text border-b-neutral-300 py-5">
                <div className="h-22.5 w-18 bg-neutral-200" />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs text-neutral-700">아우터 · 자켓 · {FIT_PRODUCT.source}</span>
                  <span className="text-base font-semibold">{FIT_PRODUCT.brand}</span>
                  <span className="text-lg">{FIT_PRODUCT.productName}</span>
                  <span className="text-sm text-neutral-700">
                    사이즈표 {FIT_PRODUCT.sizes.join(" · ")} · 소재 {FIT_PRODUCT.material}
                  </span>
                </div>
              </section>
              <section className="flex flex-col gap-3 border-b border-neutral-300 py-6">
                <h2 className="text-lg">고민 중인 사이즈</h2>
                {sizeSeg("fitsz")}
                <span className="text-sm text-neutral-700">결과 화면에서 다른 사이즈로 바꿔 볼 수 있습니다.</span>
              </section>
            </>
          )}
          <section className="flex flex-col gap-3 py-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">비교할 옷</h2>
              <span className="text-sm text-neutral-700">
                {manual
                  ? comps.length
                    ? `${sameSub ? "동일 세부분류" : "같은 대분류"} ${comps.length}벌을 찾았습니다. 빼고 싶은 옷은 선택을 해제하세요.`
                    : "비교할 옷이 없습니다. 같은 대분류의 옷을 먼저 등록하세요."
                  : "동일 세부분류 자켓 3벌을 찾았습니다. 빼고 싶은 옷은 선택을 해제하세요."}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="table min-w-160">
                <thead>
                  <tr>
                    <th className="w-10">
                      <span className="sr-only">포함</span>
                    </th>
                    <th>브랜드</th>
                    <th>제품명</th>
                    <th>사이즈</th>
                    <th className="text-right">{manual && man.categoryId === "bottom" ? "총장 · 허리 · 허벅지 · 밑위" : "총장 · 어깨 · 가슴 · 소매"}</th>
                    <th>후기</th>
                  </tr>
                </thead>
                <tbody>
                  {comps.map((c) => {
                    const keys: MeasurementKey[] = c.categoryId === "bottom" ? ["length", "waist", "thigh", "rise"] : ["length", "shoulder", "chest", "sleeve"];
                    return (
                      <tr key={c.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${c.brand} ${c.productName} 비교에 포함`}
                            checked={!excluded.includes(c.id)}
                            onChange={() => setExcluded((ex) => (ex.includes(c.id) ? ex.filter((x) => x !== c.id) : [...ex, c.id]))}
                            className="size-4 accent-accent"
                          />
                        </td>
                        <td className="font-semibold whitespace-nowrap">{c.brand}</td>
                        <td>{c.productName}</td>
                        <td className="font-mono tabular-nums">{c.sizeLabel}</td>
                        <td className="text-right font-mono whitespace-nowrap tabular-nums">
                          {keys.map((k) => formatCm(c.measurements[k])).join(" · ")}
                        </td>
                        <td className="text-sm text-neutral-700">{c.fitReview ? "있음" : "없음"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                className="btn btn-primary min-h-11 min-w-45"
                disabled={cantJudge}
                onClick={() => {
                  setPhase("result");
                  window.scrollTo(0, 0);
                }}
              >
                판단하기
              </button>
              <span className="text-sm text-neutral-700">구매가, 구매일, 링크는 AI에 보내지 않습니다.</span>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
