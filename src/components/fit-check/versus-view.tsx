"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBody } from "@/components/body/body-store";
import { FitMeter } from "@/components/body/fit-meter";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { WEARABLE_LEVELS, fitLevelName, type WearableLevel } from "@/lib/constants/body";
import { CATEGORIES, SUBCATEGORIES } from "@/lib/constants/categories";
import { BOTTOM_MEASUREMENTS, MEASUREMENT_LABELS, TOP_MEASUREMENTS, formatCm, formatNum, type MeasurementKey } from "@/lib/constants/measurements";
import { cn } from "@/lib/cn";
import { FIT_GROUPS, computeBodyFit, fitGroupKind, fitGroupOf, garmentRange, type Band, type FitGroupId, type RecKey } from "@/lib/fit/body-fit";
import { FIT_ERROR_TEXT, streamFitCheck } from "@/lib/fit/client";
import { computeFit, type FitCandidate } from "@/lib/fit/compute";
import { fitCandidateSchema } from "@/lib/fit/schema";
import { selectComparables } from "@/lib/fit/select-comparables";
import type { FitComputed, FitInterpretation } from "@/lib/fit/types";
import { bodyScore, pickSize, rankVersus, versusSummary, wardrobeScore, type VersusEntry } from "@/lib/fit/versus";
import { formatPrice } from "@/lib/format/price";
import { useAddHeld, type HeldDraft } from "@/components/held/use-add-held";
import { importImageUrl, streamImport, type ImportOutcome } from "@/lib/import/client";
import { IMPORT_FAILURE } from "@/lib/import/messages";
import { goToSignIn } from "@/lib/session-expiry";
import type { CategoryId, Measurements } from "@/lib/types/domain";
import { notifyUsageChanged } from "@/lib/usage";
import { FitResultView, type ResultAiStatus } from "./fit-result-view";

/**
 * 구매 판단 VS 비교: 링크 2~3개 → 옷마다 세로 열로 나란히(사진·가격·사이즈·실측·예상 핏),
 * 오른쪽 끝 열은 고른 옷 종류·핏의 추천 실측. 아래에 규칙으로 고른 추천, 그 아래에 AI 판단(1위 옷부터, 탭으로 다른 옷).
 * 아우터·상의·하의만 비교한다(모자·신발은 한 벌 판단으로).
 */

export const MAX_VERSUS = 3;

type Product = NonNullable<ImportOutcome["product"]>;

interface Item {
  key: string;
  url: string;
  importId: string;
  domain: string | null;
  product: Product;
  categoryId: CategoryId;
  subcategoryId: string;
  rows: Array<{ sizeLabel: string; measurements: Measurements }>;
  /** 사용자가 고른 사이즈(없으면 자동) */
  size: string | null;
  manualSize: boolean;
}

interface AiResult {
  sizeLabel: string;
  candidate: FitCandidate;
  computed: FitComputed | null;
  interpretation: FitInterpretation | null;
  aiStatus: ResultAiStatus;
  createdAt: string;
  error: string | null;
  /** 저장된 판단 기록 id */
  fitCheckId?: string | null;
}

const CLOTHES = CATEGORIES.filter((c) => c.id === "outer" || c.id === "top" || c.id === "bottom");
const firstSub = (c: CategoryId) => SUBCATEGORIES.find((s) => s.categoryId === c)!.id;
const REC_OF: Partial<Record<MeasurementKey, RecKey>> = {
  shoulder: "shoulder",
  chest: "chest",
  waist: "waist",
  hip: "hip",
  thigh: "thigh",
};
const fmtBand = (b: Band) => (b[0] === b[1] ? formatNum(b[0]) : `${formatNum(b[0])}–${formatNum(b[1])}`);

export function VersusView() {
  const { garments, signedIn } = useWardrobe();
  const { profile } = useBody();
  const held = useAddHeld();
  const [urls, setUrls] = useState<string[]>(["", ""]);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [target, setTarget] = useState<WearableLevel>("regular");
  const [groupId, setGroupId] = useState<FitGroupId | null>(null);
  const [ai, setAi] = useState<Record<string, AiResult>>({});
  const [tab, setTab] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const name = (it: Item) => [it.product.brand?.value, it.product.productName?.value].filter(Boolean).join(" ") || it.domain || "상품";

  /** 옷장 비교(사이즈 전부): 사이즈 자동 선택과 내 치수가 없을 때 순위에 쓴다. */
  const wardrobeOf = useMemo(() => {
    const map: Record<string, FitComputed | null> = {};
    for (const it of items) {
      const cand: FitCandidate = { categoryId: it.categoryId, subcategoryId: it.subcategoryId, brand: null, productName: null, sizes: it.rows };
      const { selected, lacking } = selectComparables(cand, garments);
      map[it.key] = selected.length ? computeFit(cand, selected, lacking.length) : null;
    }
    return map;
  }, [items, garments]);

  const sizeOf = (it: Item) =>
    it.manualSize && it.size
      ? it.size
      : pickSize(
          { categoryId: it.categoryId, subcategoryId: it.subcategoryId, productName: it.product.productName?.value ?? null },
          it.rows,
          target,
          profile,
          wardrobeOf[it.key]?.sizes,
        );

  const entries: VersusEntry[] = items.map((it) => {
    const size = sizeOf(it);
    const row = it.rows.find((r) => r.sizeLabel === size);
    const garment = { categoryId: it.categoryId, subcategoryId: it.subcategoryId, productName: it.product.productName?.value ?? null, measurements: row?.measurements ?? {} };
    return {
      key: it.key,
      name: name(it),
      garment,
      body: profile ? computeBodyFit(garment, profile) : null,
      wardrobe: wardrobeOf[it.key]?.sizes.find((s) => s.sizeLabel === size),
    };
  });
  const ranks = rankVersus(entries, target);
  const top = ranks[0]?.score != null ? ranks[0].key : null;
  const group: FitGroupId | null = groupId ?? (items[0] ? fitGroupOf(items[0].categoryId, items[0].subcategoryId) : null);
  const kind = group ? fitGroupKind(group) : "top";

  const analyze = async () => {
    const list = urls.map((u) => u.trim()).filter(Boolean);
    if (list.length < 2) {
      setErrors(["비교할 링크를 2개 이상 넣어 주세요."]);
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setImporting(true);
    setErrors([]);
    setItems([]);
    setAi({});
    setTab(null);
    setGroupId(null);
    const outcomes = await Promise.all(
      list.map((u) => streamImport(u, { signal: controller.signal, purpose: "fit_check" }).catch(() => null)),
    );
    if (controller.signal.aborted) return;
    setImporting(false);
    notifyUsageChanged();
    if (outcomes.some((o) => o?.errorCode === "signed_out")) return goToSignIn();
    const next: Item[] = [];
    const errs: string[] = [];
    outcomes.forEach((o, i) => {
      const label = `${i + 1}번 링크`;
      if (!o || o.status === "failed" || !o.product || !o.importId) {
        errs.push(`${label}: ${IMPORT_FAILURE[o?.errorCode ?? "network_error"].title}`);
        return;
      }
      const p = o.product;
      const g = p.sizeChart?.measurementGroup;
      const cat: CategoryId = p.categoryId?.value ?? (g === "bottom" ? "bottom" : "outer");
      if (cat === "hat" || cat === "shoes" || g === "hat") {
        errs.push(`${label}: 모자·신발은 VS 비교를 하지 않아요. 한 벌 판단으로 봐 주세요.`);
        return;
      }
      const rows = p.sizeChart?.rows ?? [];
      if (!rows.length) {
        errs.push(`${label}: 사이즈표를 찾지 못해 비교에서 뺐어요.`);
        return;
      }
      const sub = p.subcategoryId?.value && SUBCATEGORIES.some((s) => s.id === p.subcategoryId!.value && s.categoryId === cat) ? p.subcategoryId.value : firstSub(cat);
      next.push({ key: `${i}-${o.importId}`, url: list[i], importId: o.importId, domain: o.domain, product: p, categoryId: cat, subcategoryId: sub, rows, size: null, manualSize: false });
    });
    if (next.length === 1) errs.push("비교할 수 있는 옷이 1벌뿐이에요. 다른 링크를 넣어 주세요.");
    setErrors(errs);
    setItems(next.length >= 2 ? next : []);
  };

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  /** 한 벌의 AI 판단(기존 구매 판단과 같다. 판단 한도 1회) */
  const judge = async (key: string) => {
    const it = items.find((x) => x.key === key);
    const size = it ? sizeOf(it) : null;
    const row = it?.rows.find((r) => r.sizeLabel === size);
    if (!it || !row) return;
    setTab(key);
    const candidate: FitCandidate = {
      categoryId: it.categoryId,
      subcategoryId: it.subcategoryId,
      brand: it.product.brand?.value ?? null,
      productName: it.product.productName?.value ?? null,
      sizes: [{ sizeLabel: row.sizeLabel, measurements: row.measurements }],
    };
    const createdAt = new Date().toISOString();
    const base: AiResult = { sizeLabel: row.sizeLabel, candidate, computed: null, interpretation: null, aiStatus: "pending", createdAt, error: null };
    const parsed = fitCandidateSchema.safeParse(candidate);
    const { selected, lacking } = selectComparables(candidate, garments);
    if (!parsed.success || selected.length === 0) {
      setAi((a) => ({ ...a, [key]: { ...base, error: "비교할 옷이 옷장에 없어 AI 판단을 할 수 없어요. 같은 종류 옷을 실측과 함께 등록해 주세요." } }));
      return;
    }
    if (!signedIn) {
      setAi((a) => ({ ...a, [key]: { ...base, candidate: parsed.data, computed: computeFit(parsed.data, selected, lacking.length), aiStatus: "disabled" } }));
      return;
    }
    setBusyKey(key);
    setAi((a) => ({ ...a, [key]: base }));
    const r = await streamFitCheck(
      { candidate: parsed.data, importId: it.importId, excludedGarmentIds: [] },
      { onComputed: (e) => setAi((a) => ({ ...a, [key]: { ...base, candidate: parsed.data, computed: e.computed, aiStatus: e.aiEnabled ? "pending" : "disabled" } })) },
    );
    setBusyKey(null);
    notifyUsageChanged();
    if (!r.ok) {
      if (r.error === "signed_out") return goToSignIn();
      setAi((a) => ({ ...a, [key]: a[key]?.computed ? { ...a[key], aiStatus: "failed" } : { ...base, error: FIT_ERROR_TEXT[r.error] } }));
      return;
    }
    setAi((a) => ({ ...a, [key]: { ...a[key], interpretation: r.done.interpretation, aiStatus: r.done.aiStatus, fitCheckId: r.done.saved ? r.done.id : null } }));
  };

  // 비교가 뜨면 1위 옷만 먼저 AI 판단한다(판단 한도를 아끼려고).
  const autoJudged = useRef(false);
  useEffect(() => {
    if (items.length < 2 || autoJudged.current) return;
    const first = top ?? items[0].key;
    autoJudged.current = true;
    void judge(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 비교가 처음 뜰 때 한 번만
  }, [items.length]);
  useEffect(() => {
    if (items.length === 0) autoJudged.current = false;
  }, [items.length]);

  // 비교하는 옷들의 실측 칸(상의·하의가 섞이면 합친다)
  const measureKeys: MeasurementKey[] = [
    ...new Set<MeasurementKey>([
      ...(items.some((i) => i.categoryId !== "bottom") ? TOP_MEASUREMENTS : []),
      ...(items.some((i) => i.categoryId === "bottom") ? BOTTOM_MEASUREMENTS : []),
    ]),
  ];
  const recRange = (key: MeasurementKey): Band | null => {
    const rk = REC_OF[key];
    return profile && group && rk ? garmentRange(group, target, rk, profile) : null;
  };
  const cols = items.length + 1;
  const grid = { gridTemplateColumns: `repeat(${cols}, minmax(190px, 1fr))` };

  if (items.length < 2) {
    return (
      <section className="flex max-w-190 flex-col gap-3 py-7" aria-label="VS 비교 입력">
        <p className="text-sm text-neutral-700">
          고민 중인 옷의 링크를 2~3개 넣으면 나란히 비교하고, 내 치수와 옷장 기준으로 어떤 옷이 더 맞을지 추천해요. 링크마다 분석 1회가 쓰이고, AI 판단은 1위 옷만 먼저 합니다.
        </p>
        {urls.map((u, i) => (
          <div key={i} className="field">
            <label htmlFor={`vs-url-${i}`} className="text-sm">
              {i + 1}번 상품 URL{i === 2 ? " (선택)" : ""}
            </label>
            <div className="flex gap-2">
              <input
                id={`vs-url-${i}`}
                className="input min-h-11 text-body"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://…"
                value={u}
                disabled={importing}
                onChange={(e) => setUrls((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {i === 2 && (
                <button type="button" className="btn btn-ghost min-h-11" aria-label="3번 링크 빼기" disabled={importing} onClick={() => setUrls((l) => l.slice(0, 2))}>
                  빼기
                </button>
              )}
            </div>
          </div>
        ))}
        {urls.length < MAX_VERSUS && (
          <button type="button" className="btn btn-ghost self-start text-sm" disabled={importing} onClick={() => setUrls((l) => [...l, ""])}>
            + 링크 추가
          </button>
        )}
        {errors.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 border border-accent p-4 text-base text-accent-800">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-primary min-h-11 min-w-45 self-start" disabled={importing} onClick={analyze}>
          {importing ? "분석하는 중…" : "VS 비교하기"}
        </button>
      </section>
    );
  }

  const rowLabel = (text: string, sub?: string) => (
    <div className="col-span-full border-t border-neutral-300 pt-4 pb-1 text-center font-mono text-xs font-medium tracking-[0.08em] text-neutral-700">
      {text}
      {sub && <span className="ml-1 font-sans font-normal text-neutral-600">{sub}</span>}
    </div>
  );
  const rec = (children: React.ReactNode) => <div className="bg-neutral-100 px-3 py-2 text-center">{children}</div>;
  const cell = (children: React.ReactNode, key: string) => (
    <div key={key} className="px-3 py-2 text-center">
      {children}
    </div>
  );

  /** VS 표에서 바로 담는 보류 옷: 지금 고른 사이즈와 그 실측, 쇼핑몰 판매가 */
  const heldDraftOf = (it: Item): HeldDraft => {
    const size = sizeOf(it);
    const row = it.rows.find((r) => r.sizeLabel === size);
    return {
      categoryId: it.categoryId,
      subcategoryId: it.subcategoryId,
      brand: it.product.brand?.value ?? "",
      productName: it.product.productName?.value ?? it.domain ?? "",
      sizeLabel: size ?? null,
      productUrl: it.url,
      measurements: row?.measurements ?? {},
      purchasePrice: it.product.price?.value ?? null,
      currency: it.product.priceCurrency ?? "KRW",
      fitCheckId: ai[it.key]?.sizeLabel === size ? (ai[it.key]?.fitCheckId ?? null) : null,
    };
  };

  const summary = versusSummary(ranks, Object.fromEntries(entries.map((e) => [e.key, e.name])), target, kind);
  const activeTab = tab ?? top ?? items[0].key;
  const active = ai[activeTab];
  const activeItem = items.find((i) => i.key === activeTab);
  const activeSize = activeItem ? sizeOf(activeItem) : null;

  return (
    <div className="flex flex-col gap-8 py-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">VS 비교</h2>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => {
            request.current?.abort();
            setItems([]);
            setAi({});
          }}
        >
          ← 링크 다시 넣기
        </button>
      </div>
      {errors.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-accent-800">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto overscroll-x-contain">
        <div className="grid min-w-fit items-start gap-x-2" style={grid} data-testid="versus-grid">
          {/* 머리: 사진·이름·가격 / 추천 실측 설정 */}
          {items.map((it) => {
            const img = it.product.imageUrls.length ? importImageUrl(it.importId, 0) : null;
            const isTop = it.key === top;
            return (
              <div key={it.key} className="flex flex-col items-center gap-2 px-3 pb-4 text-center">
                <div className="grid aspect-[4/5] w-full max-w-44 place-items-center bg-neutral-200">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 분석 서버가 대신 받아 주는 상품 이미지 */}
                  {img && <img src={img} alt="" className="size-full object-contain" onError={(e) => (e.currentTarget.style.opacity = "0")} />}
                </div>
                <span className={cn("tag", isTop ? "tag-accent font-semibold" : "invisible")}>추천</span>
                <span className="text-sm font-semibold">{it.product.brand?.value ?? "—"}</span>
                <span className="line-clamp-2 text-base leading-snug">{it.product.productName?.value ?? it.domain}</span>
                <span className="font-mono text-sm tabular-nums">{it.product.price ? formatPrice(it.product.price.value, it.product.priceCurrency ?? "KRW") : "가격 정보 없음"}</span>
              </div>
            );
          })}
          <div className="flex flex-col gap-3 bg-neutral-100 px-3 pt-3 pb-4">
            <span className="text-center text-base font-semibold">추천 실측</span>
            <div className="field">
              <label htmlFor="vs-group" className="text-xs">
                옷 종류
              </label>
              <select id="vs-group" className="input text-sm" value={group ?? ""} onChange={(e) => setGroupId(e.target.value as FitGroupId)}>
                {FIT_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="vs-target" className="text-xs">
                원하는 핏
              </label>
              <select id="vs-target" className="input text-sm" value={target} onChange={(e) => setTarget(e.target.value as WearableLevel)}>
                {WEARABLE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {fitLevelName(l, kind)}
                  </option>
                ))}
              </select>
            </div>
            {!profile && (
              <p className="text-xs text-neutral-700">
                <Link href="/body" className="underline underline-offset-2">
                  내 치수
                </Link>
                를 입력하면 추천 실측이 보여요.
              </p>
            )}
          </div>

          {rowLabel("분류")}
          {items.map((it) =>
            cell(
              <div className="flex flex-col gap-1">
                <select
                  aria-label={`${name(it)} 대분류`}
                  className="input py-1 text-sm"
                  value={it.categoryId}
                  onChange={(e) => {
                    const c = e.target.value as CategoryId;
                    update(it.key, { categoryId: c, subcategoryId: firstSub(c) });
                  }}
                >
                  {CLOTHES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select aria-label={`${name(it)} 세부분류`} className="input py-1 text-sm" value={it.subcategoryId} onChange={(e) => update(it.key, { subcategoryId: e.target.value })}>
                  {SUBCATEGORIES.filter((s) => s.categoryId === it.categoryId).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>,
              `cat-${it.key}`,
            ),
          )}
          {rec(<span className="text-sm text-neutral-700">{group ? FIT_GROUPS.find((g) => g.id === group)?.name : "—"}</span>)}

          {rowLabel("사이즈", "원하는 핏에 가장 가까운 사이즈를 골라 두었어요")}
          {items.map((it) => {
            const size = sizeOf(it);
            return cell(
              <select
                aria-label={`${name(it)} 사이즈`}
                className="input mx-auto w-fit py-1 font-mono text-body tabular-nums"
                value={size ?? ""}
                onChange={(e) => update(it.key, { size: e.target.value, manualSize: true })}
              >
                {it.rows.map((r) => (
                  <option key={r.sizeLabel} value={r.sizeLabel}>
                    {r.sizeLabel}
                  </option>
                ))}
              </select>,
              `size-${it.key}`,
            );
          })}
          {rec(<span className="text-sm text-neutral-700">{fitLevelName(target, kind)} 기준</span>)}

          {rowLabel("예상 핏")}
          {entries.map((e) => {
            const r = e.body;
            const k = e.garment.categoryId === "bottom" ? "bottom" : "top";
            return cell(
              r?.status === "ok" ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-md font-semibold">
                    {fitLevelName(r.level, k)}
                  </span>
                  <FitMeter level={r.level} kind={k} size="lg" />
                </div>
              ) : (
                <span className="text-sm text-neutral-600">{profile ? "실측이 부족해요" : "내 치수 필요"}</span>
              ),
              `fit-${e.key}`,
            );
          })}
          {rec(
            <div className="flex flex-col gap-1.5">
              <span className="text-md font-semibold">
                {fitLevelName(target, kind)}
              </span>
            </div>,
          )}

          {rowLabel(`${fitLevelName(target, kind)} 점수`)}
          {entries.map((e) => {
            const s = profile ? bodyScore(e.body, target) : wardrobeScore(e.wardrobe);
            return cell(<span className="font-mono text-xl font-semibold tabular-nums">{s == null ? "—" : `${s}점`}</span>, `score-${e.key}`);
          })}
          {rec(<span className="text-xs text-neutral-700">{profile ? "내 치수 기준 · 문제 치수 감점" : "옷장에서 만족했던 범위 기준"}</span>)}

          {measureKeys.map((key) => {
            const band = recRange(key);
            return [
              <div key={`l-${key}`} className="contents">
                {rowLabel(MEASUREMENT_LABELS[key], "cm")}
              </div>,
              ...entries.map((e) => {
                const v = e.garment.measurements[key];
                const out = band && v != null && (v < band[0] || v > band[1]);
                return cell(
                  <span className={cn("font-mono text-lg tabular-nums", out ? "font-semibold text-accent-800" : undefined)}>
                    {formatCm(v)}
                    {out && <span className="ml-1 text-xs">{v! < band![0] ? "작음" : "큼"}</span>}
                  </span>,
                  `m-${key}-${e.key}`,
                );
              }),
              <div key={`r-${key}`} className="bg-neutral-100 px-3 py-2 text-center font-mono text-lg tabular-nums">
                {band ? fmtBand(band) : "—"}
              </div>,
            ];
          })}

          {rowLabel("맞지 않을 수 있는 곳")}
          {entries.map((e) =>
            cell(
              e.body?.status === "ok" && (e.body.issues.length || e.body.stretch) ? (
                <ul className="flex flex-col gap-1 text-left text-sm">
                  {e.body.issues.map((i) => (
                    <li key={i.key} className={i.severe ? "text-accent-800" : undefined}>
                      · {i.text}
                    </li>
                  ))}
                  {e.body.stretch && <li className="text-neutral-700">· 늘어나는 소재라 실제 핏과 다를 수 있어요.</li>}
                </ul>
              ) : (
                <span className="text-sm text-neutral-600">{e.body?.status === "ok" ? "없음" : "—"}</span>
              ),
              `iss-${e.key}`,
            ),
          )}
          {rec(null)}

          {rowLabel("구매 보류", "고른 사이즈로 담아요")}
          {items.map((it) => {
            const d = heldDraftOf(it);
            const already = held.isHeld(d);
            return cell(
              <button
                type="button"
                className="btn btn-secondary min-h-9 px-3 text-sm"
                disabled={Boolean(held.busyKey) || already}
                aria-label={`${name(it)} 구매 보류 옷에 추가`}
                onClick={() => held.addHeld(it.key, d, it.importId)}
              >
                {held.busyKey === it.key ? "담는 중…" : already ? "보류 목록에 있어요" : "보류에 추가"}
              </button>,
              `held-${it.key}`,
            );
          })}
          {rec(null)}
        </div>
      </div>

      <section className="flex flex-col gap-3 border-t border-divider pt-6" aria-labelledby="vs-rec-title">
        <h2 id="vs-rec-title" className="text-lg">
          어떤 옷이 더 괜찮을까
        </h2>
        <p className="text-quote leading-normal text-pretty" data-testid="versus-summary">
          {summary}
        </p>
        <ol className="flex flex-col">
          {ranks.map((r, i) => {
            const e = entries.find((x) => x.key === r.key)!;
            const it = items.find((x) => x.key === r.key)!;
            return (
              <li key={r.key} className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-3 border-b border-neutral-300 py-3">
                <span className="font-mono text-lg font-semibold">{i + 1}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-base font-semibold">
                    {e.name} <span className="font-mono font-normal">{sizeOf(it)}</span>
                  </span>
                  {r.reasons.map((x) => (
                    <span key={x} className="text-sm text-neutral-800">
                      {x}
                    </span>
                  ))}
                </div>
                <span className="font-mono text-base tabular-nums">{r.score == null ? "—" : `${r.score}점`}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-4 border-t border-divider pt-6" aria-labelledby="vs-ai-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="vs-ai-title" className="text-lg">
            AI 구매 판단
          </h2>
          <span className="text-sm text-neutral-700">옷장 기록과 비교 · 옷마다 판단 한도 1회. 추천 1위 옷만 먼저 판단했어요.</span>
        </div>
        <div className="seg flex-wrap" role="tablist" aria-label="판단할 옷">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={it.key === activeTab}
              className={cn("seg-opt px-4 py-2 text-sm", it.key === activeTab && "bg-text text-bg")}
              onClick={() => setTab(it.key)}
            >
              {it.product.brand?.value ?? name(it)}
              {ai[it.key] ? "" : " · 판단 전"}
            </button>
          ))}
        </div>
        {activeItem && (!active || (active.sizeLabel !== activeSize && !busyKey)) && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" disabled={Boolean(busyKey)} onClick={() => judge(activeItem.key)}>
              {active ? `${activeSize}로 다시 판단` : `${activeSize} 사이즈 판단하기`}
            </button>
            <span className="text-sm text-neutral-700">{active ? `지금 결과는 ${active.sizeLabel} 사이즈 기준이에요.` : "판단 한도 1회가 쓰입니다."}</span>
          </div>
        )}
        {active?.error && (
          <p role="alert" className="text-base text-accent-800">
            {active.error}
          </p>
        )}
        {active && !active.computed && !active.error && <p className="text-sm text-neutral-700">비교하는 중…</p>}
        {active?.computed && (
          <FitResultView
            key={`${activeTab}-${active.sizeLabel}`}
            embedded
            candidate={active.candidate}
            computed={active.computed}
            interpretation={active.interpretation}
            aiStatus={active.aiStatus}
            createdAt={active.createdAt}
            productUrl={activeItem?.url ?? null}
            importId={activeItem?.importId ?? null}
            price={activeItem?.product.price ? { value: activeItem.product.price.value, currency: activeItem.product.priceCurrency ?? "KRW" } : null}
            fitCheckId={active.fitCheckId ?? null}
          />
        )}
      </section>
    </div>
  );
}
