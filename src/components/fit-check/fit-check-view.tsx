"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { UnitInput } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { CATEGORY_NAME, SUBCATEGORIES, SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { formatCm, measurementFields, type MeasurementKey } from "@/lib/constants/measurements";
import { FIT_ERROR_TEXT, streamFitCheck } from "@/lib/fit/client";
import { computeFit, type FitCandidate } from "@/lib/fit/compute";
import { MAX_FIT_SIZES, fitCandidateSchema } from "@/lib/fit/schema";
import { candidateKeys, selectComparables } from "@/lib/fit/select-comparables";
import type { FitComputed, FitInterpretation } from "@/lib/fit/types";
import { streamImport, type ImportOutcome } from "@/lib/import/client";
import { IMPORT_FAILURE } from "@/lib/import/messages";
import { goToSignIn } from "@/lib/session-expiry";
import type { CategoryId, Measurements } from "@/lib/types/domain";
import { FitResultView, type ResultAiStatus } from "./fit-result-view";

/**
 * AI 구매 판단기 입력(PROJECT_SPEC.md 5.5 Step 1~3).
 * 링크(사이즈표에서 최대 3개 사이즈) 또는 직접 입력 → 비교 대상 확인 → 판단.
 * 비교 대상 미리보기는 서버와 같은 선정 함수로 화면에서 바로 계산한다.
 */

interface ManualInput {
  categoryId: CategoryId;
  subcategoryId: string;
  brand: string;
  productName: string;
  size: string;
  m: Record<string, string>;
}

type Imported = ImportOutcome & { product: NonNullable<ImportOutcome["product"]>; importId: string };

interface Result {
  candidate: FitCandidate;
  computed: FitComputed;
  interpretation: FitInterpretation | null;
  aiStatus: ResultAiStatus;
  createdAt: string;
}

const firstSub = (categoryId: CategoryId) => SUBCATEGORIES.find((s) => s.categoryId === categoryId)!.id;

export function FitCheckView() {
  const { garments, signedIn } = useWardrobe();
  const [manual, setManual] = useState(false);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<Imported | null>(null);
  const [importError, setImportError] = useState<{ title: string; body: string } | null>(null);
  const [linkCat, setLinkCat] = useState<CategoryId>("outer");
  const [linkSub, setLinkSub] = useState<string>(firstSub("outer"));
  const [chosen, setChosen] = useState<string[]>([]);
  const [man, setMan] = useState<ManualInput>({ categoryId: "outer", subcategoryId: "outer.jacket", brand: "", productName: "", size: "", m: {} });
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const product = imported?.product ?? null;
  const chartRows = product?.sizeChart?.rows ?? [];

  // 지금 입력으로 만든 후보(검증 전)
  let candidate: FitCandidate;
  if (manual) {
    const m: Measurements = {};
    for (const [k, v] of Object.entries(man.m)) if (v.trim() !== "" && !isNaN(Number(v))) m[k as MeasurementKey] = Number(v);
    candidate = {
      categoryId: man.categoryId,
      subcategoryId: man.subcategoryId,
      brand: man.brand.trim() || null,
      productName: man.productName.trim() || null,
      sizes: [{ sizeLabel: man.size.trim() || "입력", measurements: m }],
    };
  } else {
    const keys = measurementFields(linkCat).map((f) => f.key);
    candidate = {
      categoryId: linkCat,
      subcategoryId: linkSub,
      brand: product?.brand?.value ?? null,
      productName: product?.productName?.value ?? null,
      sizes: chartRows
        .filter((r) => chosen.includes(r.sizeLabel))
        .map((r) => ({
          sizeLabel: r.sizeLabel,
          measurements: Object.fromEntries(keys.filter((k) => r.measurements[k] != null).map((k) => [k, r.measurements[k]])),
        })),
    };
  }
  const hasInput = manual ? candidateKeys(candidate.categoryId, candidate.sizes).length > 0 : candidate.sizes.length > 0;
  const { selected, lacking } = selectComparables(candidate, garments);
  const included = selected.filter((s) => !excluded.includes(s.garment.id));
  const levels = new Set(selected.map((s) => s.matchLevel));
  const refName = candidate.subcategoryId ? SUBCATEGORY_NAME[candidate.subcategoryId] : CATEGORY_NAME[candidate.categoryId];

  const analyze = async () => {
    const target = url.trim();
    if (!target) return document.getElementById("fit-url")?.focus();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setImporting(true);
    setImportError(null);
    setImported(null);
    setChosen([]);
    setExcluded([]);
    let outcome: ImportOutcome;
    try {
      outcome = await streamImport(target, { signal: controller.signal, purpose: "fit_check" });
    } catch {
      if (controller.signal.aborted) return;
      outcome = { importId: null, status: "failed", reused: false, domain: null, sourceUrl: target, parserId: null, durationMs: 0, product: null, errorCode: "network_error", errorDetail: null };
    }
    if (controller.signal.aborted) return;
    setImporting(false);
    if (outcome.errorCode === "signed_out") return goToSignIn();
    if (outcome.status === "failed" || !outcome.product || !outcome.importId) {
      setImportError(IMPORT_FAILURE[outcome.errorCode ?? "unknown"]);
      return;
    }
    const p = outcome.product;
    const cat = p.categoryId?.value ?? (p.sizeChart?.measurementGroup === "bottom" ? "bottom" : "outer");
    setLinkCat(cat);
    setLinkSub(p.subcategoryId?.value && SUBCATEGORIES.some((s) => s.id === p.subcategoryId!.value && s.categoryId === cat) ? p.subcategoryId.value : firstSub(cat));
    const rows = p.sizeChart?.rows ?? [];
    setChosen(rows.length ? [rows[Math.floor((rows.length - 1) / 2)].sizeLabel] : []);
    setImported(outcome as Imported);
  };

  /** 링크 결과를 직접 입력으로 옮긴다(사이즈표가 없을 때). */
  const toManual = (fromLink: boolean) => {
    if (fromLink && product) {
      setMan({ categoryId: linkCat, subcategoryId: linkSub, brand: product.brand?.value ?? "", productName: product.productName?.value ?? "", size: "", m: {} });
    }
    setManual(true);
    setExcluded([]);
    setError(null);
  };

  const toggleSize = (label: string) =>
    setChosen((c) => (c.includes(label) ? c.filter((x) => x !== label) : c.length >= MAX_FIT_SIZES ? c : [...c, label]));

  const run = async () => {
    setError(null);
    const parsed = fitCandidateSchema.safeParse(candidate);
    if (!parsed.success) return setError(FIT_ERROR_TEXT.invalid_input);
    const cand = parsed.data;
    const createdAt = new Date().toISOString();
    if (!signedIn) {
      // 미리보기(예시 데이터): 저장·AI 없이 화면에서 계산만
      setResult({ candidate: cand, computed: computeFit(cand, included, lacking.length), interpretation: null, aiStatus: "disabled", createdAt });
      window.scrollTo(0, 0);
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    let shown = false;
    const r = await streamFitCheck(
      { candidate: cand, importId: manual ? null : (imported?.importId ?? null), excludedGarmentIds: excluded },
      {
        signal: controller.signal,
        onComputed: (e) => {
          shown = true;
          setResult({ candidate: cand, computed: e.computed, interpretation: null, aiStatus: e.aiEnabled ? "pending" : "disabled", createdAt });
          window.scrollTo(0, 0);
        },
      },
    );
    if (controller.signal.aborted) return;
    setBusy(false);
    if (!r.ok) {
      if (r.error === "signed_out") return goToSignIn();
      if (shown) setResult((prev) => prev && { ...prev, aiStatus: "failed" });
      else setError(FIT_ERROR_TEXT[r.error]);
      return;
    }
    setResult((prev) => prev && { ...prev, interpretation: r.done.interpretation, aiStatus: r.done.aiStatus });
    if (r.done.saved) window.history.replaceState(null, "", `/fit-check/${r.done.id}`);
  };

  if (result) {
    return (
      <FitResultView
        {...result}
        productUrl={manual ? null : (imported?.sourceUrl ?? null)}
        onBack={() => {
          request.current?.abort();
          setBusy(false);
          setResult(null);
          window.history.replaceState(null, "", "/fit-check");
        }}
        onRetry={busy ? undefined : run}
      />
    );
  }

  const categoryFields = (cat: CategoryId, sub: string, onCat: (c: CategoryId) => void, onSub: (s: string) => void, prefix: string) => (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-cat`}>대분류</label>
        <select id={`${prefix}-cat`} className="input" value={cat} onChange={(e) => onCat(e.target.value as CategoryId)}>
          <option value="outer">아우터</option>
          <option value="top">상의</option>
          <option value="bottom">하의</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-sub`}>세부분류</label>
        <select id={`${prefix}-sub`} className="input" value={sub} onChange={(e) => onSub(e.target.value)}>
          {SUBCATEGORIES.filter((s) => s.categoryId === cat).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  const showCompare = manual || (product && chartRows.length > 0);

  return (
    <main className="mx-auto max-w-280 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <Link href="/wardrobe" className="btn btn-ghost mb-2 text-sm">
        ← 내 옷장
      </Link>
      <div className="flex flex-col gap-1.5 border-b border-text pb-4">
        <h1 className="text-title">AI 구매 판단기</h1>
        <p className="text-body text-neutral-800">사려는 옷의 링크와 고민 중인 사이즈를 넣으면, 옷장에 기록한 옷과 치수별로 비교합니다.</p>
      </div>

      {!manual ? (
        <section className="flex max-w-190 flex-col gap-3 py-7">
          <div className="field">
            <label htmlFor="fit-url" className="text-sm">
              상품 URL
            </label>
            <div className="flex gap-2">
              <input
                id="fit-url"
                className="input min-h-11 text-body"
                type="url"
                placeholder="https://"
                value={url}
                disabled={importing}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button type="button" className="btn btn-secondary min-h-11 min-w-26" disabled={importing} onClick={analyze}>
                {importing ? "분석 중…" : "상품 분석"}
              </button>
            </div>
          </div>
          {importError && (
            <div role="alert" className="flex flex-col gap-2 border border-accent p-4">
              <span className="text-md font-semibold">{importError.title}</span>
              <span className="text-base text-neutral-800">{importError.body}</span>
              <button type="button" className="btn btn-secondary self-start" onClick={() => toManual(false)}>
                실측 직접 입력으로 계속
              </button>
            </div>
          )}
          <button type="button" className="btn btn-ghost self-start text-sm" onClick={() => toManual(false)}>
            링크 없이 실측 직접 입력
          </button>
        </section>
      ) : (
        <section className="flex flex-col gap-5 border-b border-neutral-300 py-7">
          <div className="flex flex-col items-start gap-1.5">
            <h2 className="text-lg">사려는 옷 직접 입력</h2>
            <button type="button" className="btn btn-ghost pl-0 text-sm" onClick={() => { setManual(false); setExcluded([]); setError(null); }}>
              ← 상품 링크로 입력
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {categoryFields(
              man.categoryId,
              man.subcategoryId,
              (categoryId) => {
                setMan({ ...man, categoryId, subcategoryId: firstSub(categoryId), m: {} });
                setExcluded([]);
              },
              (subcategoryId) => setMan({ ...man, subcategoryId }),
              "fm",
            )}
            <div className="field">
              <label htmlFor="fm-brand">브랜드</label>
              <input id="fm-brand" className="input" placeholder="선택 입력" maxLength={100} value={man.brand} onChange={(e) => setMan({ ...man, brand: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="fm-name">제품명</label>
              <input id="fm-name" className="input" placeholder="선택 입력" maxLength={200} value={man.productName} onChange={(e) => setMan({ ...man, productName: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="fm-size">고민 중인 사이즈</label>
              <input id="fm-size" className="input" placeholder="예: M, 48, 32" maxLength={30} value={man.size} onChange={(e) => setMan({ ...man, size: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-md">실측</h3>
            <span className="text-sm text-neutral-700">cm · 단면 기준 · 사이즈표 값을 그대로 옮기세요. 비워 둔 치수는 판단하지 않습니다.</span>
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

      {!manual && product && (
        <>
          <section className="flex flex-col gap-4 border-t border-b border-t-text border-b-neutral-300 py-5">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-neutral-700">{imported?.domain}에서 읽은 상품</span>
              <span className="text-base font-semibold">{product.brand?.value ?? "브랜드 없음"}</span>
              <span className="text-lg">{product.productName?.value}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
              {categoryFields(
                linkCat,
                linkSub,
                (c) => {
                  setLinkCat(c);
                  setLinkSub(firstSub(c));
                  setExcluded([]);
                },
                setLinkSub,
                "fl",
              )}
            </div>
          </section>
          {chartRows.length ? (
            <section className="flex flex-col gap-3 border-b border-neutral-300 py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">고민 중인 사이즈</h2>
                <span className="text-sm text-neutral-700">최대 {MAX_FIT_SIZES}개까지 함께 비교할 수 있습니다.</span>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="비교 사이즈">
                {chartRows.map((r) => (
                  <label
                    key={r.sizeLabel}
                    className={cn(
                      "cursor-pointer border px-5 py-2 font-mono text-body tabular-nums has-focus-visible:outline-2 has-focus-visible:outline-accent",
                      chosen.includes(r.sizeLabel) ? "border-text bg-text text-bg" : "border-neutral-400 hover:border-text",
                    )}
                  >
                    <input type="checkbox" className="sr-only" checked={chosen.includes(r.sizeLabel)} onChange={() => toggleSize(r.sizeLabel)} />
                    {r.sizeLabel}
                  </label>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="table min-w-120 font-mono tabular-nums">
                  <thead>
                    <tr>
                      <th>사이즈</th>
                      {measurementFields(linkCat).map((f) => (
                        <th key={f.key} className="text-right">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartRows.map((r) => (
                      <tr key={r.sizeLabel} className={chosen.includes(r.sizeLabel) ? "bg-neutral-100" : undefined}>
                        <td className="font-semibold">{r.sizeLabel}</td>
                        {measurementFields(linkCat).map((f) => (
                          <td key={f.key} className="text-right">
                            {formatCm(r.measurements[f.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <div role="status" className="mt-4 flex flex-col gap-2 border border-accent p-4">
              <span className="text-md font-semibold">사이즈표를 찾지 못했습니다</span>
              <span className="text-base text-neutral-800">상품 페이지의 사이즈표 실측을 직접 입력하면 비교할 수 있습니다.</span>
              <button type="button" className="btn btn-primary self-start" onClick={() => toManual(true)}>
                실측 직접 입력
              </button>
            </div>
          )}
        </>
      )}

      {showCompare && (
        <section className="flex flex-col gap-3 py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg">비교할 옷</h2>
            <span className="text-sm text-neutral-700" data-testid="comparable-note">
              {selected.length
                ? `${levels.has("subcategory") && levels.size === 1 ? `동일 세부분류 ${refName}` : "같은 대분류·비슷한 분류 옷 포함"} ${selected.length}벌을 기준으로 비교합니다. 빼고 싶은 옷은 선택을 해제하세요.`
                : hasInput
                  ? "비교할 옷이 필요합니다. 같은 종류의 옷을 실측과 함께 먼저 등록하세요."
                  : "실측을 입력하면 비교할 옷을 찾습니다."}
              {lacking.length ? ` 실측이 겹치지 않는 옷 ${lacking.length}벌은 뺐습니다.` : ""}
            </span>
          </div>
          {selected.length > 0 && (
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
                    <th className="text-right">{measurementFields(candidate.categoryId).map((f) => f.label).join(" · ")}</th>
                    <th>후기</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map(({ garment: c }) => (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`${[c.brand, c.productName].filter(Boolean).join(" ")} 비교에 포함`}
                          checked={!excluded.includes(c.id)}
                          onChange={() => setExcluded((ex) => (ex.includes(c.id) ? ex.filter((x) => x !== c.id) : [...ex, c.id]))}
                          className="size-4 accent-accent"
                        />
                      </td>
                      <td className="font-semibold whitespace-nowrap">{c.brand || "—"}</td>
                      <td>{c.productName}</td>
                      <td className="font-mono tabular-nums">{c.sizeLabel}</td>
                      <td className="text-right font-mono whitespace-nowrap tabular-nums">
                        {measurementFields(candidate.categoryId).map((f) => formatCm(c.measurements[f.key])).join(" · ")}
                      </td>
                      <td className="text-sm text-neutral-700">{c.fitReview ? "있음" : "없음"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error && (
            <p role="alert" className="text-base text-accent-800">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="button" className="btn btn-primary min-h-11 min-w-45" disabled={busy || !hasInput || included.length === 0} onClick={run}>
              {busy ? "비교하는 중…" : "판단하기"}
            </button>
            <span className="text-sm text-neutral-700">구매가, 구매일, 링크는 AI에 보내지 않습니다.</span>
          </div>
        </section>
      )}
    </main>
  );
}

