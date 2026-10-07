"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BodyFitPanel } from "@/components/body/body-fit-panel";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { CATEGORY_NAME, COUNT_UNIT, SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { MEASUREMENT_LABELS, formatCm, formatNum } from "@/lib/constants/measurements";
import { cn } from "@/lib/cn";
import type { FitCandidate } from "@/lib/fit/compute";
import { SHOE_FIT_FIELDS, shoeFitText } from "@/lib/constants/shoe-fit";
import { idealFrom, shoeSizeMm } from "@/lib/fit/shoes";
import type { AiStatus, ComparableSnapshot, Confidence, DimensionResult, DimensionTag, FitComputed, FitInterpretation, SizeReport } from "@/lib/fit/types";
import { formatDate } from "@/lib/format/date";
import type { Currency } from "@/lib/format/price";
import { useAddHeld } from "@/components/held/use-add-held";

/**
 * 구매 판단 결과(PROJECT_SPEC.md 5.5 Step 4). 표의 숫자와 판정은 서버 계산값을 그대로 쓰고,
 * 예상 핏 문장은 AI 요약이 있으면 그것을, 없으면 규칙 요약을 보여준다.
 */

export type ResultAiStatus = AiStatus | "pending";

const TAG: Record<DimensionTag, { text: string; className: string }> = {
  within: { text: "범위 내", className: "tag tag-neutral" },
  caution: { text: "주의", className: "tag tag-accent" },
  weak: { text: "근거 부족", className: "tag" },
  none: { text: "비교 불가", className: "tag" },
  excluded: { text: "판단 제외", className: "tag" },
};

const CONFIDENCE: Record<Confidence, { text: string; level: number }> = {
  insufficient: { text: "판단 불가", level: 1 },
  low: { text: "낮음", level: 2 },
  medium: { text: "보통", level: 3 },
  high: { text: "높음", level: 4 },
};

const MATCH_TEXT = { subcategory: "동일 세부분류", category: "같은 대분류", similar: "비슷한 분류" } as const;

const shortName = (c: ComparableSnapshot) => `${c.brand || c.productName} ${c.sizeLabel ?? ""}`.trim();

function Row({ d, comps, note }: { d: DimensionResult; comps: ComparableSnapshot[]; note?: string }) {
  const range = d.basis === "comfort" ? d.comfortRange : d.ownedRange;
  const values = [...comps.map((c) => c.measurements[d.key]), d.candidate].filter((v): v is number => v != null);
  const mn = (values.length ? Math.min(...values) : 0) - 1;
  const mx = (values.length ? Math.max(...values) : 0) + 1;
  const pc = (v: number) => `${(((v - mn) / (mx - mn)) * 100).toFixed(1)}%`;
  const warn = d.tag === "caution";
  const diff =
    d.distanceFromRange == null ? "—" : d.verdict === "within" ? "0" : `${d.distanceFromRange > 0 ? "+" : "−"}${formatNum(Math.abs(d.distanceFromRange))}`;
  return (
    <tr>
      <td className="font-semibold whitespace-nowrap">{MEASUREMENT_LABELS[d.key]}</td>
      <td className="bg-neutral-100 text-right text-md font-semibold">{formatCm(d.candidate)}</td>
      {comps.map((c) => (
        <td key={c.garmentId} className="text-right text-neutral-800">
          {formatCm(c.measurements[d.key])}
        </td>
      ))}
      <td className="text-right whitespace-nowrap">
        {range ? (range.min === range.max ? formatCm(range.min) : `${formatCm(range.min)} – ${formatCm(range.max)}`) : "—"}
        {range && <span className="ml-1 text-xs text-neutral-600">({range.n}벌{d.basis === "owned" ? "·참고" : ""})</span>}
      </td>
      <td>
        <div className="relative h-4.5 w-35" aria-hidden>
          <div className="absolute inset-x-0 top-2 h-px bg-neutral-400" />
          {range && (
            <div
              className={cn("absolute top-1 h-2.25 rounded-sm", d.basis === "comfort" ? "bg-accent-300" : "bg-neutral-300")}
              style={{ left: pc(range.min), width: `${Math.max(((range.max - range.min) / (mx - mn)) * 100, 1.5).toFixed(1)}%` }}
            />
          )}
          {d.candidate != null && (
            <div className={cn("absolute top-0 h-4.25 w-0.5", warn ? "bg-accent-700" : "bg-text")} style={{ left: pc(d.candidate) }} />
          )}
        </div>
      </td>
      <td className={cn("text-right font-semibold whitespace-nowrap", warn ? "text-accent-700" : "text-neutral-700")}>{diff}</td>
      <td className="pl-6">
        <div className="flex items-baseline gap-2 font-sans">
          <span className={cn(TAG[d.tag].className, "flex-none")}>{TAG[d.tag].text}</span>
          <span className="text-base">{d.judgement}</span>
        </div>
        {note && <p className="mt-1 font-sans text-sm text-neutral-700">{note}</p>}
      </td>
    </tr>
  );
}

/** 신발: 치수 대신 가진 신발의 사이즈·착용감과 비교한 표 */
function ShoeComparison({ size, comps }: { size: SizeReport; comps: ComparableSnapshot[] }) {
  const shoe = size.shoe;
  const diff = shoe?.diffMm == null ? "—" : shoe.diffMm === 0 ? "0" : `${shoe.diffMm > 0 ? "+" : "−"}${Math.abs(shoe.diffMm)}`;
  const facts: Array<[string, string]> = [
    ["신규 사이즈", shoe?.candidateMm != null ? `${shoe.candidateMm}mm` : "—"],
    ["평소 맞는 사이즈", shoe?.idealMm != null ? `${shoe.idealMm}mm` : "—"],
    ["차이", diff === "—" ? diff : `${diff}mm`],
    ["기준", shoe?.basis === "sameBrand" ? "같은 브랜드 신발" : shoe?.basis === "all" ? "가진 신발 전체" : "—"],
  ];
  return (
    <section className="flex flex-col gap-3 pt-8 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">사이즈·착용감 비교</h2>
        <span className="text-sm text-neutral-700">mm · 길이감이 작았던 신발은 +5mm, 컸던 신발은 −5mm를 맞는 사이즈로 봅니다</span>
      </div>
      <dl className="grid grid-cols-2 border-t border-divider sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 border-b border-neutral-300 py-2.5">
            <dt className="text-xs text-neutral-700">{k}</dt>
            <dd className={cn("font-mono text-lg font-semibold tabular-nums", k === "차이" && Boolean(shoe?.diffMm) && "text-accent-700")}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto">
        <table className="table min-w-160 tabular-nums">
          <thead>
            <tr>
              <th>신발</th>
              <th className="text-right">사이즈</th>
              {SHOE_FIT_FIELDS.map((f) => (
                <th key={f.key}>{f.label}</th>
              ))}
              <th className="text-right">맞았을 사이즈</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => {
              const mm = shoeSizeMm(c.sizeLabel);
              return (
                <tr key={c.garmentId}>
                  <td>
                    <span className="font-semibold">{c.brand || "—"}</span> {c.productName}
                  </td>
                  <td className="text-right font-mono">{c.sizeLabel ?? "—"}</td>
                  {SHOE_FIT_FIELDS.map((f) => (
                    <td key={f.key} className={cn(c.shoeFit?.[f.key] === "tight" && f.key !== "length" && "text-accent-700")}>
                      {shoeFitText(f.key, c.shoeFit?.[f.key])}
                    </td>
                  ))}
                  <td className="text-right font-mono">{mm != null ? `${idealFrom(mm, c.shoeFit)}mm` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FitResultView({
  candidate,
  computed,
  interpretation,
  aiStatus,
  createdAt,
  productUrl = null,
  onBack,
  onRetry,
  embedded = false,
  fitCheckId = null,
  importId = null,
  price = null,
}: {
  /** 저장된 판단 기록 id(보류 옷의 "판단 결과 보기") */
  fitCheckId?: string | null;
  /** 링크 분석 기록 id(보류 옷 사진) */
  importId?: string | null;
  /** 쇼핑몰 판매가(보류 옷의 "가격") */
  price?: { value: number; currency: Currency } | null;
  candidate: FitCandidate;
  computed: FitComputed;
  interpretation: FitInterpretation | null;
  aiStatus: ResultAiStatus;
  createdAt: string;
  productUrl?: string | null;
  onBack?: () => void;
  onRetry?: () => void;
  /** VS 비교 아래에 붙일 때: 바깥 main·뒤로 가기·다른 옷 판단 버튼 없이 */
  embedded?: boolean;
}) {
  const { garments, openDrawer, setPendingDraft } = useWardrobe();
  const { addHeld, isHeld, busyKey } = useAddHeld();
  const router = useRouter();
  const [sizeLabel, setSizeLabel] = useState(computed.sizes[0]?.sizeLabel ?? "");
  const size = computed.sizes.find((s) => s.sizeLabel === sizeLabel) ?? computed.sizes[0];
  const comps = computed.comparables;
  const ai = interpretation?.perSize.find((p) => p.sizeLabel === size.sizeLabel) ?? null;
  const aiNote = (key: string) => ai?.dimensionNotes.find((n) => n.dimension === key)?.note;
  const judged = size.dimensions.filter((d) => d.verdict !== "unknown").length;
  const reviewed = comps.filter((c) => c.review).length;
  const conf = CONFIDENCE[size.confidence];
  const shoes = computed.categoryId === "shoes";
  const unit = COUNT_UNIT[computed.categoryId];
  const noun = shoes ? "신발" : computed.categoryId === "hat" ? "모자" : "옷";
  const title = [candidate.brand, candidate.productName].filter(Boolean).join(" ") || `직접 입력한 ${noun}`;
  const sub = [
    CATEGORY_NAME[candidate.categoryId],
    candidate.subcategoryId ? SUBCATEGORY_NAME[candidate.subcategoryId] : null,
    shoes ? "가진 신발의 사이즈·착용감 기준" : "사이즈표 기준 실측",
  ]
    .filter(Boolean)
    .join(" · ");
  const weakDims = size.dimensions.filter((d) => d.tag === "weak" || d.tag === "none").map((d) => MEASUREMENT_LABELS[d.key]);
  const warning =
    size.confidence === "insufficient" || size.confidence === "low"
      ? (size.limitations[0] ?? "비교할 데이터가 적어 참고용입니다.")
      : weakDims.length
        ? `${weakDims.join(", ")}: 근거가 부족하거나 실측이 없어 참고용으로만 판단했습니다.`
        : null;

  // 근거: AI가 고른 인용이 있으면 그것, 없으면 규칙이 찾은 앵커와 후기 원문
  const anchorQuotes = size.dimensions.flatMap((d) =>
    d.anchors.map((a) => ({ key: `${d.key}-${a.garmentId}`, tag: MEASUREMENT_LABELS[d.key], garmentId: a.garmentId, quote: a.evidence, accent: true, note: d.judgement })),
  );
  const quotes = interpretation?.reviewEvidence.length
    ? interpretation.reviewEvidence.map((e, i) => ({ key: `ai-${i}`, tag: "후기", garmentId: e.garmentId, quote: e.quote, accent: false, note: e.relevance }))
    : [
        ...anchorQuotes,
        ...comps
          .filter((c) => c.review && !anchorQuotes.some((q) => q.garmentId === c.garmentId))
          .slice(0, 4)
          .map((c) => ({ key: c.garmentId, tag: "후기", garmentId: c.garmentId, quote: c.review!, accent: false, note: null as string | null })),
      ];

  // 규칙 계산의 사이즈 안내는 항상 보이고, AI 안내는 다를 때만 덧붙인다.
  const aiSizeNote = interpretation?.sizeRecommendationNote;
  const sizeNotes = [computed.sizeNote, aiSizeNote && aiSizeNote !== computed.sizeNote ? aiSizeNote : null].filter((n): n is string => Boolean(n));
  const exists = (id: string) => garments.some((g) => g.id === id);
  const bodyGarment = useMemo(
    () => ({ categoryId: candidate.categoryId, subcategoryId: candidate.subcategoryId, productName: candidate.productName, measurements: size.measurements }),
    [candidate.categoryId, candidate.subcategoryId, candidate.productName, size.measurements],
  );

  const heldDraft = {
    categoryId: candidate.categoryId,
    subcategoryId: candidate.subcategoryId,
    brand: candidate.brand ?? "",
    productName: candidate.productName ?? "",
    sizeLabel: size.sizeLabel,
    productUrl,
    measurements: size.measurements,
    purchasePrice: price?.value ?? null,
    currency: price?.currency ?? "KRW",
    fitCheckId,
  } as const;

  const Wrapper = embedded ? "div" : "main";
  return (
    <Wrapper className={embedded ? undefined : "mx-auto max-w-320 px-[clamp(16px,3vw,32px)] pt-6 pb-16"}>
      {embedded ? null : onBack ? (
        <button type="button" className="btn btn-ghost mb-2 text-sm" onClick={onBack}>
          ← 입력으로
        </button>
      ) : (
        <Link href="/fit-check" className="btn btn-ghost mb-2 text-sm">
          ← 구매 판단기
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-divider pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs font-medium tracking-[0.08em] text-accent-700">AI 구매 판단 · {formatDate(createdAt.slice(0, 10))}</span>
          <h1 className="text-title">{title}</h1>
          <span className="text-base text-neutral-700">{sub}</span>
        </div>
        {computed.sizes.length > 1 && (
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-neutral-700">비교 사이즈</span>
            <div className="seg" role="radiogroup" aria-label="결과 사이즈">
              {computed.sizes.map((s) => (
                <label key={s.sizeLabel} className="seg-opt px-5 py-2 font-mono text-body tabular-nums">
                  <input type="radio" name="fit-result-size" checked={s.sizeLabel === size.sizeLabel} onChange={() => setSizeLabel(s.sizeLabel)} />
                  {s.sizeLabel}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] border-b border-divider">
        <div className="flex flex-col gap-3 py-7 pr-8 md:col-span-2">
          <div className="flex items-end gap-4">
            <span className="font-display text-display-xl tracking-[-0.03em]">{size.sizeLabel}</span>
            <h2 className="mb-1.5 font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">예상 핏</h2>
            <span className="mb-1.5 tag tag-neutral" data-testid="summary-source">
              {ai ? "AI 요약" : "치수 비교 요약"}
            </span>
          </div>
          <p className="max-w-190 text-quote leading-normal text-pretty" data-testid="fit-summary">
            {ai?.overallFit ?? size.summary}
          </p>
          {aiStatus === "pending" && (
            <p className="flex items-center gap-2 text-sm text-neutral-700" aria-live="polite">
              <span className="inline-block size-2 animate-pulse rounded-full bg-accent" aria-hidden />
              기존 착용 후기와 비교해 AI 요약을 만드는 중입니다. 치수 비교는 아래 표에서 바로 볼 수 있습니다.
            </p>
          )}
          {aiStatus === "failed" && (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-accent-800">
              <span>AI 설명을 만들지 못했습니다. 치수 비교 결과는 아래 표에서 확인할 수 있습니다.</span>
              {onRetry && (
                <button type="button" className="btn btn-secondary" onClick={onRetry}>
                  다시 시도
                </button>
              )}
            </div>
          )}
          {aiStatus === "limited" && <p className="text-sm text-neutral-700">오늘 AI 요약 횟수를 모두 써서 치수 비교 요약만 보여 줍니다.</p>}
          {ai && interpretation!.cautions.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-neutral-800">
              {interpretation!.cautions.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          )}
          {sizeNotes.map((n) => (
            <p key={n} className="text-sm text-neutral-800">
              {n}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-divider py-7 md:border-l md:pl-6">
          <h2 className="font-mono text-sm font-medium tracking-[0.08em] text-neutral-700">판단 신뢰도</h2>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[28px] font-semibold" data-testid="confidence">
              {conf.text}
            </span>
            <span className="text-sm text-neutral-700">4단계 중 {conf.level}</span>
          </div>
          <div className="grid grid-cols-4 gap-0.75" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn("h-1.5", i < conf.level ? "bg-text" : "bg-neutral-300")} />
            ))}
          </div>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-base tabular-nums">
            <dt className="text-neutral-700">비교한 {noun}</dt>
            <dd>
              {comps.length}
              {unit}
            </dd>
            <dt className="text-neutral-700">후기 있는 {noun}</dt>
            <dd>
              {reviewed}
              {unit}
            </dd>
            {shoes ? (
              <>
                <dt className="text-neutral-700">착용감 기록</dt>
                <dd>{comps.filter((c) => c.shoeFit).length}켤레</dd>
              </>
            ) : (
              <>
                <dt className="text-neutral-700">판단한 치수</dt>
                <dd>
                  {size.dimensions.length}개 중 {judged}개
                </dd>
              </>
            )}
          </dl>
        </div>
      </section>

      {(computed.categoryId === "outer" || computed.categoryId === "top" || computed.categoryId === "bottom") && (
        <section className="flex flex-col gap-3 border-b border-divider py-7" aria-labelledby="body-fit-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="body-fit-title" className="text-lg">
              내 몸 기준 예상 핏 · {size.sizeLabel}
            </h2>
            <span className="text-sm text-neutral-700">내 치수와 이 사이즈 실측의 여유분으로 계산 · 기록에는 남기지 않습니다</span>
          </div>
          <BodyFitPanel garment={bodyGarment} silhouette />
        </section>
      )}

      {warning && (
        <div className="mt-6 flex flex-wrap items-start gap-3 border border-accent px-4 py-3.5">
          <span className="tag tag-accent font-semibold">데이터 부족</span>
          <span className="min-w-60 flex-1 text-base text-pretty text-accent-800">{warning}</span>
        </div>
      )}

      {shoes ? (
        <ShoeComparison size={size} comps={comps} />
      ) : (
        <section className="flex flex-col gap-3 pt-8 pb-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg">치수별 비교</h2>
            <span className="text-sm text-neutral-700">{computed.categoryId === "hat" ? "cm" : "cm · 단면"} · 만족 범위는 후기에 불만이 없는 {noun} 기준(후기가 부족하면 기존 {noun} 범위, 참고)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-240 font-mono tabular-nums">
              <thead>
                <tr>
                  <th>치수</th>
                  <th className="text-right text-text">신규 {size.sizeLabel}</th>
                  {comps.map((c) => (
                    <th key={c.garmentId} className="text-right">
                      {shortName(c)}
                    </th>
                  ))}
                  <th className="text-right">만족 범위</th>
                  <th className="w-40">위치</th>
                  <th className="text-right">차이</th>
                  <th className="pl-6">예상 핏</th>
                </tr>
              </thead>
              <tbody>
                {size.dimensions.map((d) => (
                  <Row key={d.key} d={d} comps={comps} note={aiNote(d.key)} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-x-12 pt-8">
        <div className="flex flex-col">
          <h2 className="mb-3 border-b border-divider pb-3 text-lg">착용 후기 근거</h2>
          {quotes.length ? (
            quotes.map((q) => {
              const c = comps.find((x) => x.garmentId === q.garmentId);
              return (
                <figure key={q.key} className="flex flex-col gap-2 border-b border-neutral-300 py-4">
                  <div className="flex items-center gap-2">
                    <span className={q.accent ? "tag tag-accent" : "tag tag-neutral"}>{q.tag}</span>
                    <span className="text-sm text-neutral-700">{c ? [c.brand, c.productName, c.sizeLabel].filter(Boolean).join(" ") : ""}</span>
                  </div>
                  <blockquote className="text-lead">“{q.quote}”</blockquote>
                  {q.note && <figcaption className="text-sm text-neutral-700">{q.note}</figcaption>}
                </figure>
              );
            })
          ) : (
            <p className="mt-3 text-base text-neutral-700">비교한 {noun}에 착용 후기가 없습니다. 후기를 남기면 판단 근거로 인용됩니다.</p>
          )}
        </div>
        <div className="flex flex-col">
          <h2 className="mb-3 border-b border-divider pb-3 text-lg">비교에 사용한 {noun} ({comps.length})</h2>
          {comps.map((c) => {
            const body = (
              <>
                <div className="flex min-w-0 flex-col">
                  <span className="text-base font-semibold">
                    {c.brand || "—"} <span className="font-normal">{c.sizeLabel}</span>
                  </span>
                  <span className="text-base">{c.productName}</span>
                  <span className="text-xs text-neutral-700">
                    {MATCH_TEXT[c.matchLevel]}
                    {c.subcategoryId ? ` · ${SUBCATEGORY_NAME[c.subcategoryId] ?? ""}` : ""}
                    {size.nearest[0]?.garmentId === c.garmentId ? ` · 가장 가까운 ${noun}` : ""}
                    {size.sameBrandSameSize.includes(c.garmentId) ? " · 같은 브랜드·사이즈" : ""}
                  </span>
                </div>
                {exists(c.garmentId) && <span className="text-sm text-accent-700">상세</span>}
              </>
            );
            return exists(c.garmentId) ? (
              <button
                key={c.garmentId}
                type="button"
                onClick={() => openDrawer(c.garmentId)}
                className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 border-b border-neutral-300 py-3 text-left hover:bg-neutral-100"
              >
                {body}
              </button>
            ) : (
              <div key={c.garmentId} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-neutral-300 py-3">
                {body}
              </div>
            );
          })}
          <h2 className="mt-8 mb-3 border-b border-divider pb-3 text-lg">데이터 한계</h2>
          {size.limitations.length ? (
            <ul className="flex flex-col text-base">
              {size.limitations.map((x) => (
                <li key={x} className="border-b border-neutral-300 py-2.5">
                  {x}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-neutral-700">눈에 띄는 한계가 없습니다.</p>
          )}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-divider pt-4">
        <button
          type="button"
          className="btn btn-primary min-h-11"
          onClick={() => {
            setPendingDraft({
              categoryId: candidate.categoryId,
              subcategoryId: candidate.subcategoryId,
              brand: candidate.brand ?? "",
              productName: candidate.productName ?? "",
              sizeLabel: size.sizeLabel,
              colorName: null,
              seasons: [],
              purchasedOn: null,
              purchasePrice: null,
              productUrl,
              imageUrl: null,
              measurements: size.measurements,
              fitReview: null,
              shoeFit: null,
              fitCheckId,
            });
            router.push("/wardrobe/new");
          }}
        >
          이 {noun}{noun === "모자" ? "를" : "을"} 구매했어요 — 옷장에 추가
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11"
          disabled={Boolean(busyKey) || isHeld(heldDraft)}
          onClick={() => addHeld("result", heldDraft, importId)}
        >
          {busyKey ? "담는 중…" : isHeld(heldDraft) ? "구매 보류 옷에 있어요" : "구매 보류 옷에 추가"}
        </button>
        {embedded ? null : onBack ? (
          <button type="button" className="btn btn-secondary min-h-11" onClick={onBack}>
            다른 옷 판단하기
          </button>
        ) : (
          <Link href="/fit-check" className="btn btn-secondary min-h-11">
            다른 옷 판단하기
          </Link>
        )}
        <span className="w-full text-sm text-neutral-700">구매가, 구매일, 링크는 AI에 보내지 않습니다.</span>
      </div>
    </Wrapper>
  );
}
