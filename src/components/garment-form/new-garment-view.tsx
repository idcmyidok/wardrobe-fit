"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWardrobe, type GarmentDraft, type ImageChange } from "@/components/wardrobe/wardrobe-store";
import { DateLabel } from "./date-label";
import { ImagePicker } from "./image-picker";
import { PageImageGrid } from "./page-image-grid";
import { UnitInput } from "@/components/ui/input";
import { CATEGORIES, SUBCATEGORIES } from "@/lib/constants/categories";
import { ALL_MEASUREMENT_KEYS, measurementFields } from "@/lib/constants/measurements";
import { EMPTY_SHOE_FIT, shoeFitOrNull, type ShoeFit } from "@/lib/constants/shoe-fit";
import { SEASONS, toggleSeason } from "@/lib/constants/seasons";
import { cn } from "@/lib/cn";
import { importImageFile, importImageUrl, streamImport, type AnalyzeStage, type ImportOutcome } from "@/lib/import/client";
import { importFailure } from "@/lib/import/messages";
import { takeStashedDraft } from "@/lib/session-expiry";
import { notifyUsageChanged } from "@/lib/usage";
import { UsageNote } from "@/components/usage/usage-note";
import { ShoeFitPicker } from "./shoe-fit-picker";
import { BodyFitPanel } from "@/components/body/body-fit-panel";
import { UserFitPicker } from "@/components/body/user-fit-picker";
import type { FitLevel } from "@/lib/constants/body";
import type { CategoryId, Measurements, Season } from "@/lib/types/domain";

type Phase = "url" | "analyzing" | "failed" | "review" | "manual";

interface FormState {
  categoryId: CategoryId;
  subcategoryId: string;
  brand: string;
  productName: string;
  seasons: Season[];
  price: string;
  url: string;
  date: string;
  size: string;
  color: string;
  review: string;
  m: Record<string, string>;
  shoeFit: ShoeFit;
  userFit: FitLevel | null;
}

const ANALYZE_STEPS: { stage: AnalyzeStage; label: string }[] = [
  { stage: "fetching", label: "페이지 불러오는 중" },
  { stage: "parsing", label: "상품 정보 읽는 중" },
  { stage: "normalizing", label: "사이즈표·컬러 정리 중" },
];

type Imported = ImportOutcome & { importId: string; product: NonNullable<ImportOutcome["product"]> };

const EMPTY_FORM: FormState = {
  categoryId: "outer",
  subcategoryId: "",
  brand: "",
  productName: "",
  seasons: [],
  price: "",
  url: "",
  date: "",
  size: "",
  color: "",
  review: "",
  m: {},
  shoeFit: EMPTY_SHOE_FIT,
  userFit: null,
};

/** 분석 결과 → 검토 폼. 사이즈·컬러는 옵션이 하나뿐일 때만 미리 고른다. */
const importedForm = (url: string, p: Imported["product"]): FormState => {
  const size = p.sizeOptions.length === 1 ? p.sizeOptions[0] : "";
  return {
    ...EMPTY_FORM,
    categoryId: p.categoryId?.value ?? "outer",
    subcategoryId: p.subcategoryId?.value ?? "",
    brand: p.brand?.value ?? "",
    productName: p.productName?.value ?? "",
    price: p.price ? String(p.price.value) : "",
    color: p.colorCandidate?.value ?? "",
    size,
    m: chartMeasurements(p, size),
    url,
  };
};

/** 사이즈표에서 고른 사이즈의 실측 */
function chartMeasurements(p: Imported["product"] | undefined, size: string): Record<string, string> {
  const row = p?.sizeChart?.rows.find((r) => r.sizeLabel === size);
  return row ? Object.fromEntries(Object.entries(row.measurements).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) : {};
}

/** AI 구매 판단 결과에서 넘어온 값(구매했어요)을 검토 폼 값으로 바꾼다. */
const draftToForm = (d: GarmentDraft): FormState => ({
  ...EMPTY_FORM,
  categoryId: d.categoryId,
  subcategoryId: d.subcategoryId ?? "",
  brand: d.brand,
  productName: d.productName,
  size: d.sizeLabel ?? "",
  url: d.productUrl ?? "",
  m: Object.fromEntries(Object.entries(d.measurements).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])),
  shoeFit: d.shoeFit ?? EMPTY_SHOE_FIT,
  userFit: d.userFit ?? null,
});

/** 새 옷 추가: 상품 링크 분석(분석 중 / 실패) → 검토 폼, 또는 직접 입력 폼 */
export function NewGarmentView() {
  const router = useRouter();
  const params = useSearchParams();
  const { addGarment, garmentHref, showToast, pendingDraft, setPendingDraft } = useWardrobe();

  const [phase, setPhase] = useState<Phase>(() => (pendingDraft ? "review" : params.get("mode") === "manual" ? "manual" : "url"));
  const [url, setUrl] = useState("");
  const [step, setStep] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [form, setForm] = useState<FormState>(() => (pendingDraft ? draftToForm(pendingDraft) : EMPTY_FORM));
  const [imported, setImported] = useState<Imported | null>(null);
  const [failure, setFailure] = useState<ImportOutcome | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  /** 받지 못했거나 아이콘처럼 작은 페이지 사진(목록에서 숨긴다) */
  const [badImages, setBadImages] = useState<number[]>([]);
  /** 찾은 사이즈 대신 사이즈를 직접 적는다(사이즈표를 잘못 읽었을 때). 나머지 가져온 값은 그대로 둔다. */
  const [customSize, setCustomSize] = useState(false);
  const [image, setImage] = useState<ImageChange>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const request = useRef<AbortController | null>(null);

  // 판단기에서 넘어온 값은 한 번만 쓴다.
  useEffect(() => {
    if (pendingDraft) setPendingDraft(null);
  }, [pendingDraft, setPendingDraft]);

  // 로그인이 풀려 다시 로그인하고 돌아온 경우, 작성하던 값을 되살린다.
  useEffect(() => {
    const stashed = takeStashedDraft();
    if (!stashed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage는 hydration 뒤에만 읽을 수 있다
    setForm(draftToForm(stashed));
    setPhase("manual");
  }, []);

  // 분석 경과 시간(초)
  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));

  /** 진행 중인 분석을 멈춘다(취소, 화면 이동). */
  const cancelRequest = () => {
    request.current?.abort();
    request.current = null;
  };
  useEffect(() => cancelRequest, []);

  const analyze = async () => {
    const target = url.trim();
    if (!target) {
      document.getElementById("new-url")?.focus();
      return;
    }
    cancelRequest();
    const controller = new AbortController();
    request.current = controller;
    setPhase("analyzing");
    setStartedAt(Date.now());
    setNow(Date.now());
    setStep(0);
    setShowDetail(false);
    setFailure(null);
    let outcome: ImportOutcome;
    try {
      outcome = await streamImport(target, {
        signal: controller.signal,
        onStage: (stage) => setStep(ANALYZE_STEPS.findIndex((s) => s.stage === stage)),
      });
    } catch {
      if (controller.signal.aborted) return;
      outcome = { importId: null, status: "failed", reused: false, domain: null, sourceUrl: target, parserId: null, durationMs: 0, product: null, errorCode: "network_error", errorDetail: null };
    }
    if (controller.signal.aborted) return;
    request.current = null;
    notifyUsageChanged();
    if (outcome.status !== "failed" && outcome.product && outcome.importId) {
      const result = outcome as Imported;
      setImported(result);
      setForm(importedForm(target, result.product));
      setImage(undefined);
      setImageIndex(0);
      setBadImages([]);
      setCustomSize(false);
      setPhase("review");
    } else {
      setFailure(outcome);
      setPhase("failed");
    }
  };

  /** 직접 입력으로. 실패했어도 분석에서 얻은 값(부분 결과)과 링크는 채워 넘긴다. */
  const startManual = (keepUrl = false) => {
    cancelRequest();
    const partial = keepUrl ? failure?.product : null;
    setForm(partial ? importedForm(url.trim(), partial) : { ...EMPTY_FORM, url: keepUrl ? url.trim() : "" });
    setImported(null);
    setImage(undefined);
    setPhase("manual");
  };

  const isReview = phase === "review";
  const showForm = phase === "review" || phase === "manual";
  const product = isReview ? imported?.product : undefined;
  const sizeChoices = product ? (product.sizeOptions.length ? product.sizeOptions : (product.sizeChart?.rows.map((r) => r.sizeLabel) ?? [])) : [];
  const colorChoices = product?.colorOptions ?? [];
  const pageImages = product && imported ? product.imageUrls.map((_, i) => importImageUrl(imported.importId, i)) : [];
  const shownImages = pageImages.map((src, i) => ({ src, i })).filter(({ i }) => !badImages.includes(i));
  const dropImage = (i: number) => setBadImages((bad) => (bad.includes(i) ? bad : [...bad, i]));
  // 고른 사진이 목록에서 빠졌으면 남은 첫 사진을 쓴다.
  const chosen = shownImages.some(({ i }) => i === imageIndex) ? imageIndex : (shownImages[0]?.i ?? -1);
  const chosenUrl = pageImages[chosen] as string | undefined;
  const partial = imported?.status === "partial";
  // 옷장에서 쓰지 않는 열을 뺐다는 안내는 보이지 않는다(예전 분석 결과에 남아 있을 수 있다).
  const notices = product?.warnings.filter((w) => w.code !== "size_chart_unmapped_columns") ?? [];

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const register = async () => {
    if (saving) return;
    // 제품명은 필수(브랜드는 비워도 된다): 비어 있으면 등록하지 않고 제품명 칸으로 보낸다.
    if (!form.productName.trim()) {
      document.getElementById("f-name")?.focus();
      return;
    }
    const measurements: Measurements = {};
    Object.entries(form.m).forEach(([k, v]) => {
      if (v !== "" && !isNaN(Number(v))) measurements[k as keyof Measurements] = Number(v);
    });
    const price = form.price.replace(/\D/g, "");
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const result = await addGarment({
      categoryId: form.categoryId,
      subcategoryId: form.subcategoryId || null,
      brand: form.brand.trim(),
      productName: form.productName.trim(),
      sizeLabel: form.size || null,
      colorName: form.color || null,
      seasons: form.seasons,
      purchasedOn: form.date || null,
      purchasePrice: price ? Number(price) : null,
      productUrl: form.url || null,
      imageUrl: null,
      measurements,
      fitReview: form.review || null,
      shoeFit: form.categoryId === "shoes" ? shoeFitOrNull(form.shoeFit) : null,
      userFit: isClothes(form.categoryId) ? form.userFit : null,
    }, image === undefined && isReview && chosenUrl ? await importImageFile(chosenUrl) : image, imported?.importId ?? null);
    setSaving(false);
    if (!result.ok) {
      const fields = result.fieldErrors ?? {};
      setError(Object.keys(fields).some((k) => FIELD_IDS[k]) ? "표시한 칸을 확인해 주세요." : result.error);
      setFieldErrors(fields);
      const first = Object.keys(result.fieldErrors ?? {})[0];
      if (first) document.getElementById(FIELD_IDS[first] ?? "")?.focus();
      return;
    }
    showToast(result.warning ?? "옷장에 등록했습니다");
    router.push(garmentHref(result.garment.id));
  };

  const hint = error
    ? error
    : !form.productName.trim()
      ? "제품명은 꼭 입력해야 합니다."
      : isReview && !form.size
        ? "구매한 사이즈를 선택하세요."
        : "등록 전까지 저장되지 않습니다.";

  const failDomain = failure?.domain ?? url.match(/\/\/([^/]+)/)?.[1] ?? "";
  const failText = importFailure(failure?.errorCode);
  const failDetail = failure
    ? [failure.errorCode, failure.errorDetail?.replace(`${failure.errorCode}: `, ""), `${(failure.durationMs / 1000).toFixed(1)}초`, failure.parserId && `parser: ${failure.parserId}`].filter(Boolean).join(" · ")
    : "";

  return (
    <main className="mx-auto max-w-280 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <Link href="/wardrobe" className="btn btn-ghost mb-2 text-sm">
        ← 내 옷장
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-text pb-4">
        <h1 className="text-title">새 옷 추가</h1>
        <div className="seg" role="radiogroup" aria-label="추가 방법">
          <label className="seg-opt px-4 py-2 text-base">
            <input type="radio" name="addmode" checked={phase !== "manual"} onChange={() => { cancelRequest(); setPhase("url"); }} />
            상품 링크로 추가
          </label>
          <label className="seg-opt px-4 py-2 text-base">
            <input type="radio" name="addmode" checked={phase === "manual"} onChange={() => startManual()} />
            직접 입력
          </label>
        </div>
      </div>

      {(phase === "url" || phase === "analyzing" || phase === "failed") && (
        <section className="flex max-w-190 flex-col gap-3 py-8">
          <div className="field">
            <label htmlFor="new-url" className="text-sm">
              상품 URL
            </label>
            <div className="flex gap-2">
              <input
                id="new-url"
                className="input min-h-11 text-body"
                type="url"
                placeholder="https://"
                value={url}
                disabled={phase === "analyzing"}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button type="button" className="btn btn-primary min-h-11 min-w-26" disabled={phase === "analyzing"} onClick={analyze}>
                {phase === "analyzing" ? "분석 중…" : "분석"}
              </button>
            </div>
          </div>
          <div className="text-sm text-neutral-700">
            상품 페이지 주소를 붙여 넣으면 제품명·가격·사진·사이즈표를 읽어 옵니다. 읽지 못한 항목은 직접 채우면 됩니다.
          </div>
          <UsageNote kind="import" />
          <Link href="/wardrobe/import-orders" className="btn btn-secondary mt-8 min-h-11 self-start">
            무신사 주문내역으로 여러 벌 한꺼번에 추가
          </Link>
          <p className="max-w-140 text-sm text-neutral-700 text-pretty">
            무신사 로그인 정보나 개인정보는 수집하지 않아요. 붙여 넣은 주문내역
            원문은 서버로 보내거나 저장하지 않고, 이 기기에서 옷 정보만
            골라내요. 옷 정보를 찾을 때는 주문 한 건마다 브랜드와 상품명만
            쓰고, 가격·주문일·주문번호는 보내지 않아요.
          </p>

          {phase === "analyzing" && (
            <div className="mt-4 border-t border-text" aria-live="polite">
              <div className="relative h-0.5 bg-neutral-300">
                <div
                  className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-600 ease-standard"
                  style={{ width: `${Math.round(((step + 0.5) / 3) * 100)}%` }}
                />
              </div>
              {ANALYZE_STEPS.map((s, i) => {
                const state = i < step ? "완료" : i === step ? "진행 중" : "대기";
                return (
                  <div
                    key={s.stage}
                    className={cn(
                      "grid grid-cols-[32px_1fr_auto] items-baseline gap-3 border-b border-neutral-300 py-3.5",
                      state === "대기" ? "text-neutral-600" : "text-text",
                    )}
                  >
                    <span className="font-mono text-sm text-neutral-600 tabular-nums">0{i + 1}</span>
                    <span className="text-body">{s.label}</span>
                    <span className="text-xs">{state}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-3">
                <span className="text-sm text-neutral-700">
                  <span className="font-mono tabular-nums">{elapsed}초</span> 경과 · 최대 20초 걸립니다.
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => { cancelRequest(); setPhase("url"); }}>
                  취소
                </button>
              </div>
            </div>
          )}

          {phase === "failed" && (
            <div role="alert" className="mt-4 flex flex-col gap-2.5 border border-accent p-5">
              <div className="flex items-center gap-2">
                <span className="tag tag-accent">분석 실패</span>
                <span className="text-sm text-neutral-700">{failDomain}</span>
              </div>
              <div className="text-lg font-semibold">{failText.title}</div>
              <p className="text-base text-pretty text-neutral-800">
                {failText.body} {failure?.product ? "읽은 항목은 직접 입력 화면에 채워 둡니다." : ""}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => startManual(true)}>
                  직접 입력으로 계속
                </button>
                <button type="button" className="btn btn-secondary" onClick={analyze}>
                  다시 시도
                </button>
                <button type="button" className="btn btn-ghost" aria-expanded={showDetail} onClick={() => setShowDetail((v) => !v)}>
                  {showDetail ? "자세히 닫기" : "자세히"}
                </button>
              </div>
              {showDetail && (
                <div className="border-t border-divider pt-2.5 font-mono text-xs text-neutral-700 tabular-nums">{failDetail}</div>
              )}
            </div>
          )}
        </section>
      )}

      {showForm && (
        <>
          {isReview && (
            <div className="flex flex-col gap-0.5 border-b border-neutral-300 py-4">
              <span className="text-base">
                {partial ? "읽지 못한 칸은 직접 채워 주세요." : "구매한 사이즈와 컬러를 고른 뒤 등록하세요."}
              </span>
              {notices.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
                  {notices.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-6 border-b border-text py-7">
            <div className="flex max-w-60 flex-col gap-2">
              <ImagePicker
                currentUrl={chosenUrl ?? null}
                value={image}
                onChange={setImage}
                placeholder="사진 끌어다 놓기"
              />
              {shownImages.length > 0 && (
                <p className="text-label text-neutral-700" aria-live="polite">
                  {image === undefined && chosenUrl
                    ? `페이지 사진 ${shownImages.findIndex(({ i }) => i === chosen) + 1}번을 옷 사진으로 씁니다`
                    : image
                      ? "직접 올린 사진을 씁니다"
                      : "사진 없이 저장합니다"}
                </p>
              )}
              <PageImageGrid
                images={shownImages}
                selected={image === undefined ? chosen : -1}
                onSelect={(i) => {
                  setImageIndex(i);
                  setImage(undefined);
                }}
                onBroken={dropImage}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-4 sm:col-span-3">
              <h2 className="text-lg">기본 정보</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                <div className="field">
                  <label htmlFor="f-cat">대분류</label>
                  <select
                    id="f-cat"
                    className="input"
                    value={form.categoryId}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, categoryId: e.target.value as CategoryId, subcategoryId: "", m: {}, shoeFit: EMPTY_SHOE_FIT, userFit: null }));
                    }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-sub">세부분류</label>
                  <select id="f-sub" className="input" value={form.subcategoryId} onChange={(e) => update("subcategoryId", e.target.value)}>
                    <option value="">선택</option>
                    {SUBCATEGORIES.filter((s) => s.categoryId === form.categoryId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-brand">브랜드</label>
                  <input id="f-brand" className="input" aria-invalid={Boolean(fieldErrors.brand)} aria-describedby={fieldErrors.brand ? "e-brand" : undefined} value={form.brand} onChange={(e) => update("brand", e.target.value)} />
                  <FieldError id="e-brand" message={fieldErrors.brand} />
                </div>
                <div className="field sm:col-span-2">
                  <label htmlFor="f-name">제품명</label>
                  <input id="f-name" className="input" aria-invalid={Boolean(fieldErrors.productName)} aria-describedby={fieldErrors.productName ? "e-productName" : undefined} value={form.productName} onChange={(e) => update("productName", e.target.value)} />
                  <FieldError id="e-productName" message={fieldErrors.productName} />
                </div>
                <div className="field">
                  <DateLabel htmlFor="f-date" label="구매 날짜" filled={Boolean(form.date)} onClear={() => update("date", "")} />
                  <input id="f-date" type="date" className="input font-mono tabular-nums" aria-invalid={Boolean(fieldErrors.purchasedOn)} aria-describedby={fieldErrors.purchasedOn ? "e-purchasedOn" : undefined} value={form.date} onChange={(e) => update("date", e.target.value)} />
                  <FieldError id="e-purchasedOn" message={fieldErrors.purchasedOn} />
                </div>
                <div className="field">
                  <label htmlFor="f-price">구매가</label>
                  <UnitInput id="f-price" unit="원" inputMode="numeric" aria-invalid={Boolean(fieldErrors.purchasePrice)} aria-describedby={[fieldErrors.purchasePrice && "e-purchasePrice", product?.price && "h-price"].filter(Boolean).join(" ") || undefined} value={form.price} onChange={(e) => update("price", e.target.value)} />
                  <FieldError id="e-purchasePrice" message={fieldErrors.purchasePrice} />
                  {product?.price && (
                    <span id="h-price" className="whitespace-nowrap text-xs text-neutral-700">
                      쇼핑몰 현재 판매가예요. 실제 산 가격으로 고쳐 주세요.
                    </span>
                  )}
                </div>
                <div className="field col-span-full">
                  <label>시즌</label>
                  <div className="seg self-start">
                    {SEASONS.map((s) => (
                      <label key={s.id} className="seg-opt px-4 py-1.75">
                        <input
                          type="checkbox"
                          checked={form.seasons.includes(s.id)}
                          onChange={() =>
                            update("seasons", toggleSeason(form.seasons, s.id))
                          }
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field col-span-full">
                  <label htmlFor="f-url">상품 링크</label>
                  <input id="f-url" className="input text-neutral-800" placeholder="선택 입력" aria-invalid={Boolean(fieldErrors.productUrl)} aria-describedby={fieldErrors.productUrl ? "e-productUrl" : undefined} value={form.url} onChange={(e) => update("url", e.target.value)} />
                  <FieldError id="e-productUrl" message={fieldErrors.productUrl} />
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-b border-text py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">구매한 옵션</h2>
              <span className="text-sm text-neutral-700">사이즈를 고르면 사이즈표의 실측이 아래에 채워집니다. 맞는 사이즈가 없으면 직접 입력하세요</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
              <div className="field">
                <label htmlFor="f-size">사이즈</label>
                {sizeChoices.length > 0 ? (
                  <div className="seg flex-wrap self-start" role="radiogroup" aria-label="사이즈">
                    {sizeChoices.map((s) => (
                      <label key={s} className="seg-opt px-4.5 py-2 font-mono text-base tabular-nums">
                        <input
                          type="radio"
                          name="fsize"
                          checked={!customSize && form.size === s}
                          onChange={() => {
                            setCustomSize(false);
                            setForm((f) => ({ ...f, size: s, m: { ...f.m, ...chartMeasurements(product, s) } }));
                          }}
                        />
                        {s}
                      </label>
                    ))}
                    <label className="seg-opt px-4 py-2 text-base text-accent-700 ring-1 ring-accent-300 ring-inset has-[input:checked]:bg-accent-700 has-[input:checked]:text-bg has-[input:checked]:ring-0">
                      <input
                        type="radio"
                        name="fsize"
                        checked={customSize}
                        onChange={() => {
                          setCustomSize(true);
                          setForm((f) => ({ ...f, size: "" }));
                          requestAnimationFrame(() => document.getElementById("f-size")?.focus());
                        }}
                      />
                      직접 입력
                    </label>
                  </div>
                ) : null}
                {(sizeChoices.length === 0 || customSize) && (
                  <input id="f-size" className="input max-w-50" placeholder="예: M, 48, 32" aria-invalid={Boolean(fieldErrors.sizeLabel)} aria-describedby={fieldErrors.sizeLabel ? "e-sizeLabel" : undefined} value={form.size} onChange={(e) => update("size", e.target.value)} />
                )}
                <FieldError id="e-sizeLabel" message={fieldErrors.sizeLabel} />
              </div>
              <div className="field">
                <label htmlFor="f-color">컬러</label>
                <div className="flex flex-wrap items-center gap-2">
                  {colorChoices.length > 0 && (
                    <div className="seg flex-wrap" role="radiogroup" aria-label="컬러 옵션">
                      {colorChoices.map((c) => (
                        <label key={c} className="seg-opt px-3.5 py-2 text-base">
                          <input type="radio" name="fcolor" checked={form.color === c} onChange={() => update("color", c)} />
                          {c}
                        </label>
                      ))}
                    </div>
                  )}
                  <input id="f-color" className="input max-w-45" placeholder="컬러명 직접 입력" aria-invalid={Boolean(fieldErrors.colorName)} aria-describedby={fieldErrors.colorName ? "e-colorName" : undefined} value={form.color} onChange={(e) => update("color", e.target.value)} />
                  <FieldError id="e-colorName" message={fieldErrors.colorName} />
                </div>
              </div>
            </div>
          </section>

          {form.categoryId === "shoes" ? (
            <section className="flex flex-col gap-4 border-b border-text py-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">착용감</h2>
                <span className="text-sm text-neutral-700">선택 입력 · 신어 본 느낌을 남기면 다음 신발 사이즈를 고를 때 씁니다</span>
              </div>
              <ShoeFitPicker idPrefix="f-shoe" value={form.shoeFit} onChange={(v) => update("shoeFit", v)} />
            </section>
          ) : (
            <section className="flex flex-col gap-4 border-b border-text py-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">실측</h2>
                <span className="text-sm text-neutral-700">
                  {form.categoryId === "hat" ? "cm · 머리둘레는 둘레 그대로" : "cm · 단면 기준"} · 직접 잰 값이 있으면 덮어쓰세요
                </span>
              </div>
              {isReview && product && !product.sizeChart && (
                <p className="text-sm text-neutral-800">
                  이 페이지에서 실측 정보를 찾지 못했습니다. 직접 잰 값이나 상품 페이지의 실측을 입력해 주세요.
                </p>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
                {measurementFields(form.categoryId).map((m) => (
                  <div key={m.key} className="field">
                    <label htmlFor={`f-m-${m.key}`}>{m.label}</label>
                    <UnitInput
                      id={`f-m-${m.key}`}
                      unit="cm"
                      inputMode="decimal"
                      className="text-body"
                      value={form.m[m.key] ?? ""}
                      aria-invalid={Boolean(fieldErrors[`measurements.${m.key}`])}
                      aria-describedby={fieldErrors[`measurements.${m.key}`] ? `e-m-${m.key}` : undefined}
                      onChange={(e) => setForm((f) => ({ ...f, m: { ...f.m, [m.key]: e.target.value } }))}
                    />
                    <FieldError id={`e-m-${m.key}`} message={fieldErrors[`measurements.${m.key}`]} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {isClothes(form.categoryId) && (
            <section className="flex flex-col gap-4 border-b border-text py-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="f-user-fit" className="text-lg">
                  내 핏
                </h2>
                <span className="text-sm text-neutral-700">선택 입력 · 비워 두면 내 치수로 계산한 예상 핏을 보여 줍니다</span>
              </div>
              <UserFitPicker
                labelledBy="f-user-fit"
                kind={form.categoryId === "bottom" ? "bottom" : "top"}
                value={form.userFit}
                onChange={(v) => update("userFit", v)}
              />
              <FormBodyFit form={form} />
            </section>
          )}

          <section className="flex flex-col gap-3 py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">착용 후기</h2>
              <span className="text-sm text-neutral-700">선택 입력 · 입어본 뒤에 써도 됩니다</span>
            </div>
            <textarea
              className="input text-body leading-relaxed"
              rows={4}
              aria-label="착용 후기"
              placeholder={form.categoryId === "shoes" ? "예: 발볼이 조금 좁아서 다음엔 반 치수 크게 사고 싶다." : "예: 어깨와 가슴은 마음에 드는데 총장이 조금 길다."}
              value={form.review}
              onChange={(e) => update("review", e.target.value)}
            />
            <span className="text-sm text-neutral-700">AI 구매 판단기가 이 후기를 원문 그대로 근거로 인용합니다.</span>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-text pt-4">
            <span role={error ? "alert" : undefined} className={cn("text-sm", error ? "text-accent-700" : "text-neutral-700")}>
              {hint}
            </span>
            <div className="flex gap-2">
              <Link href="/wardrobe" className="btn btn-secondary min-h-10">
                취소
              </Link>
              <button type="button" className="btn btn-primary min-h-10 min-w-30" disabled={saving} onClick={register}>
                {saving ? "등록 중…" : "등록"}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

/** 서버 검증 오류 키 → 입력 칸 id(첫 오류 칸으로 포커스) */
const FIELD_IDS: Record<string, string> = {
  productName: "f-name",
  brand: "f-brand",
  purchasedOn: "f-date",
  purchasePrice: "f-price",
  productUrl: "f-url",
  sizeLabel: "f-size",
  colorName: "f-color",
  subcategoryId: "f-sub",
  ...Object.fromEntries(ALL_MEASUREMENT_KEYS.map((k) => [`measurements.${k}`, `f-m-${k}`])),
};

const isClothes = (c: CategoryId) => c === "outer" || c === "top" || c === "bottom";

/** 폼에 입력한 실측으로 바로 계산한 예상 핏(점수는 옷 정보에서) */
function FormBodyFit({ form }: { form: FormState }) {
  const garment = useMemo(() => {
    const measurements: Measurements = {};
    for (const [k, v] of Object.entries(form.m)) if (v !== "" && !isNaN(Number(v))) measurements[k as keyof Measurements] = Number(v);
    return { categoryId: form.categoryId, subcategoryId: form.subcategoryId || null, productName: form.productName, measurements };
  }, [form.categoryId, form.subcategoryId, form.productName, form.m]);
  return <BodyFitPanel garment={garment} userFit={form.userFit} showScores={false} />;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="text-xs text-accent-700">
      {message}
    </span>
  );
}
