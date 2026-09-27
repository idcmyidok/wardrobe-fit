"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWardrobe, type GarmentDraft, type ImageChange } from "@/components/wardrobe/wardrobe-store";
import { ImagePicker } from "./image-picker";
import { UnitInput } from "@/components/ui/input";
import { SUBCATEGORIES } from "@/lib/constants/categories";
import { BOTTOM_MEASUREMENTS, TOP_MEASUREMENTS, measurementFields } from "@/lib/constants/measurements";
import { SEASONS, toggleSeason } from "@/lib/constants/seasons";
import { cn } from "@/lib/cn";
import { importImageUrl, streamImport, type AnalyzeStage, type ImportOutcome } from "@/lib/import/client";
import { importFailure } from "@/lib/import/messages";
import { takeStashedDraft } from "@/lib/session-expiry";
import type { CategoryId, Measurements, Season } from "@/lib/types/domain";

type Phase = "url" | "analyzing" | "failed" | "review" | "manual";

interface FormState {
  categoryId: CategoryId;
  subcategoryId: string;
  brand: string;
  productName: string;
  material: string;
  seasons: Season[];
  price: string;
  url: string;
  date: string;
  size: string;
  color: string;
  review: string;
  m: Record<string, string>;
}

const ANALYZE_STEPS: { stage: AnalyzeStage; label: string }[] = [
  { stage: "fetching", label: "페이지 불러오는 중" },
  { stage: "parsing", label: "상품 정보 읽는 중" },
  { stage: "normalizing", label: "사이즈표·컬러 정리 중" },
];

/** 오늘 날짜(사용자 기기 기준, YYYY-MM-DD) */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Imported = ImportOutcome & { importId: string; product: NonNullable<ImportOutcome["product"]> };

const EMPTY_FORM: FormState = {
  categoryId: "outer",
  subcategoryId: "",
  brand: "",
  productName: "",
  material: "",
  seasons: [],
  price: "",
  url: "",
  date: "",
  size: "",
  color: "",
  review: "",
  m: {},
};

/** 분석 결과 → 검토 폼. 사이즈·컬러는 옵션이 하나뿐일 때만 미리 고른다. */
const importedForm = (url: string, p: Imported["product"]): FormState => {
  const size = p.sizeOptions.length === 1 ? p.sizeOptions[0] : "";
  return {
    ...EMPTY_FORM,
    date: today(),
    categoryId: p.categoryId?.value ?? "outer",
    subcategoryId: p.subcategoryId?.value ?? "",
    brand: p.brand?.value ?? "",
    productName: p.productName?.value ?? "",
    material: p.material?.value ?? "",
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
  material: d.material ?? "",
  size: d.sizeLabel ?? "",
  url: d.productUrl ?? "",
  m: Object.fromEntries(Object.entries(d.measurements).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])),
});

type TagKey = "cat" | "sub" | "brand" | "name" | "material" | "date" | "price" | "seasons" | "url" | "size" | "color";

/** 새 옷 추가: 상품 링크 분석(분석 중 / 실패) → 검토 폼, 또는 직접 입력 폼 */
export function NewGarmentView() {
  const router = useRouter();
  const params = useSearchParams();
  const { addGarment, garmentHref, showToast, pendingDraft, setPendingDraft } = useWardrobe();

  const [phase, setPhase] = useState<Phase>(() => (pendingDraft ? "review" : params.get("mode") === "manual" ? "manual" : "url"));
  const [url, setUrl] = useState("");
  const [step, setStep] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [form, setForm] = useState<FormState>(() => (pendingDraft ? draftToForm(pendingDraft) : { ...EMPTY_FORM, date: today() }));
  const [imported, setImported] = useState<Imported | null>(null);
  const [failure, setFailure] = useState<ImportOutcome | null>(null);
  const [edited, setEdited] = useState<Partial<Record<TagKey, boolean>>>({});
  const [imageIndex, setImageIndex] = useState(0);
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
    if (outcome.status !== "failed" && outcome.product && outcome.importId) {
      const result = outcome as Imported;
      setImported(result);
      setForm(importedForm(target, result.product));
      setEdited({});
      setImage(undefined);
      setImageIndex(0);
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
    setForm(partial ? importedForm(url.trim(), partial) : { ...EMPTY_FORM, date: today(), url: keepUrl ? url.trim() : "" });
    setImported(null);
    setEdited({});
    setImage(undefined);
    setPhase("manual");
  };

  const isReview = phase === "review";
  const showForm = phase === "review" || phase === "manual";
  const product = isReview ? imported?.product : undefined;
  const sizeChoices = product ? (product.sizeOptions.length ? product.sizeOptions : (product.sizeChart?.rows.map((r) => r.sizeLabel) ?? [])) : [];
  const colorChoices = product?.colorOptions ?? [];
  const pageImages = product && imported ? product.imageUrls.map((_, i) => importImageUrl(imported.importId, i)) : [];
  const extractedCount = product
    ? [product.brand, product.productName, product.categoryId, product.price, product.material, product.colorCandidate, product.sizeChart, pageImages[0]].filter(Boolean).length +
      (sizeChoices.length ? 1 : 0)
    : 0;
  const partial = imported?.status === "partial";

  const update = <K extends keyof FormState>(key: K, value: FormState[K], tag?: TagKey) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (tag) setEdited((e) => ({ ...e, [tag]: true }));
  };

  const NEEDS = "tag tag-accent";
  const AUTO = "tag tag-neutral";
  const confidenceOf: Partial<Record<TagKey, { confidence: string } | null | undefined>> = {
    cat: product?.categoryId,
    sub: product?.subcategoryId,
    brand: product?.brand,
    name: product?.productName,
    material: product?.material,
    price: product?.price,
    color: product?.colorCandidate,
  };
  const tag = (k: TagKey): { label: string; className: string } => {
    if (edited[k]) return { label: "수정됨", className: "tag border border-text" };
    if (k === "size") return form.size ? { label: "자동", className: AUTO } : { label: "선택 필요", className: NEEDS };
    if (k === "color") return form.color ? (confidenceOf.color?.confidence === "low" ? { label: "확인 필요", className: NEEDS } : { label: "자동", className: AUTO }) : { label: "선택 필요", className: NEEDS };
    if (k === "seasons") return { label: "확인 필요", className: NEEDS };
    if (k === "date") return { label: "오늘", className: AUTO };
    if (k === "url") return { label: "자동", className: AUTO };
    if (!product) return { label: "확인 필요", className: NEEDS };
    const found = confidenceOf[k];
    if (!found) return { label: "입력 필요", className: NEEDS };
    if (found.confidence === "low") return { label: "확인 필요", className: NEEDS };
    return { label: k === "price" ? "판매가" : "자동", className: AUTO };
  };
  const label = (text: string, k: TagKey) => (
    <>
      {text}
      {isReview && <span className={cn(tag(k).className, "px-1.5 py-px text-2xs")}>{tag(k).label}</span>}
    </>
  );

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
      material: form.material || null,
      seasons: form.seasons,
      purchasedOn: form.date || null,
      purchasePrice: price ? Number(price) : null,
      productUrl: form.url || null,
      imageUrl: null,
      measurements,
      fitReview: form.review || null,
    }, image === undefined && isReview && pageImages[imageIndex] ? await pageImageFile(pageImages[imageIndex]) : image, imported?.importId ?? null);
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
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-neutral-300 py-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-semibold">
                  {imported?.domain}에서 {extractedCount}개 항목을 가져왔습니다
                </span>
                <span className="text-sm text-neutral-700">
                  {partial
                    ? "일부 정보만 가져왔습니다. 비어 있는 항목을 입력해 주세요."
                    : "구매한 사이즈와 컬러를 고르고, 값을 확인한 뒤 등록하세요. 등록 전에는 저장되지 않습니다."}
                </span>
                {product && product.warnings.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
                    {product.warnings.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-700">
                <span className="tag tag-neutral">자동</span>
                <span className="tag border border-text">수정됨</span>
                <span className="tag tag-accent">확인 필요</span>
              </div>
            </div>
          )}

          <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-6 border-b border-text py-7">
            <div className="flex max-w-60 flex-col gap-2">
              <ImagePicker
                currentUrl={pageImages[imageIndex] ?? null}
                value={image}
                onChange={setImage}
                placeholder="사진 끌어다 놓기"
              />
              {pageImages.length > 1 && (
                <>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs font-semibold">페이지 이미지 {pageImages.length}장</span>
                    <span className="text-label text-neutral-700">누르면 옷 정보 사진으로</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {pageImages.map((src, i) => (
                      <button
                        key={src}
                        type="button"
                        aria-pressed={imageIndex === i && image === undefined}
                        aria-label={i === 0 ? "대표 이미지" : `이미지 ${i + 1}`}
                        onClick={() => {
                          setImageIndex(i);
                          setImage(undefined);
                        }}
                        className={cn(
                          "aspect-[4/5] cursor-pointer overflow-hidden rounded-sm bg-neutral-200",
                          imageIndex === i && image === undefined ? "ring-2 ring-text" : "ring-1 ring-neutral-300 ring-inset",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- 서버가 대신 받아 주는 미리보기 */}
                        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-4 sm:col-span-3">
              <h2 className="text-lg">기본 정보</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                <div className="field">
                  <label htmlFor="f-cat" className="flex items-center justify-between">{label("대분류", "cat")}</label>
                  <select
                    id="f-cat"
                    className="input"
                    value={form.categoryId}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, categoryId: e.target.value as CategoryId, subcategoryId: "", m: {} }));
                      setEdited((ed) => ({ ...ed, cat: true, sub: true }));
                    }}
                  >
                    <option value="outer">아우터</option>
                    <option value="top">상의</option>
                    <option value="bottom">하의</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-sub" className="flex items-center justify-between">{label("세부분류", "sub")}</label>
                  <select id="f-sub" className="input" value={form.subcategoryId} onChange={(e) => update("subcategoryId", e.target.value, "sub")}>
                    <option value="">선택</option>
                    {SUBCATEGORIES.filter((s) => s.categoryId === form.categoryId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-brand" className="flex items-center justify-between">{label("브랜드", "brand")}</label>
                  <input id="f-brand" className="input" aria-invalid={Boolean(fieldErrors.brand)} aria-describedby={fieldErrors.brand ? "e-brand" : undefined} value={form.brand} onChange={(e) => update("brand", e.target.value, "brand")} />
                  <FieldError id="e-brand" message={fieldErrors.brand} />
                </div>
                <div className="field sm:col-span-2">
                  <label htmlFor="f-name" className="flex items-center justify-between">{label("제품명", "name")}</label>
                  <input id="f-name" className="input" aria-invalid={Boolean(fieldErrors.productName)} aria-describedby={fieldErrors.productName ? "e-productName" : undefined} value={form.productName} onChange={(e) => update("productName", e.target.value, "name")} />
                  <FieldError id="e-productName" message={fieldErrors.productName} />
                </div>
                <div className="field">
                  <label htmlFor="f-material" className="flex items-center justify-between">{label("소재", "material")}</label>
                  <input id="f-material" className="input" aria-invalid={Boolean(fieldErrors.material)} aria-describedby={fieldErrors.material ? "e-material" : undefined} value={form.material} onChange={(e) => update("material", e.target.value, "material")} />
                  <FieldError id="e-material" message={fieldErrors.material} />
                </div>
                <div className="field">
                  <label htmlFor="f-date" className="flex items-center justify-between">{label("구매 날짜", "date")}</label>
                  <input id="f-date" type="date" className="input font-mono tabular-nums" aria-invalid={Boolean(fieldErrors.purchasedOn)} aria-describedby={fieldErrors.purchasedOn ? "e-purchasedOn" : undefined} value={form.date} onChange={(e) => update("date", e.target.value, "date")} />
                  <FieldError id="e-purchasedOn" message={fieldErrors.purchasedOn} />
                </div>
                <div className="field">
                  <label htmlFor="f-price" className="flex items-center justify-between">{label("구매가", "price")}</label>
                  <UnitInput id="f-price" unit="원" inputMode="numeric" aria-invalid={Boolean(fieldErrors.purchasePrice)} aria-describedby={fieldErrors.purchasePrice ? "e-purchasePrice" : undefined} value={form.price} onChange={(e) => update("price", e.target.value, "price")} />
                  <FieldError id="e-purchasePrice" message={fieldErrors.purchasePrice} />
                </div>
                <div className="field col-span-full">
                  <label className="flex items-center justify-between">{label("시즌", "seasons")}</label>
                  <div className="seg self-start">
                    {SEASONS.map((s) => (
                      <label key={s.id} className="seg-opt px-4 py-1.75">
                        <input
                          type="checkbox"
                          checked={form.seasons.includes(s.id)}
                          onChange={() =>
                            update(
                              "seasons",
                              toggleSeason(form.seasons, s.id),
                              "seasons",
                            )
                          }
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field col-span-full">
                  <label htmlFor="f-url" className="flex items-center justify-between">{label("상품 링크", "url")}</label>
                  <input id="f-url" className="input text-neutral-800" placeholder="선택 입력" aria-invalid={Boolean(fieldErrors.productUrl)} aria-describedby={fieldErrors.productUrl ? "e-productUrl" : undefined} value={form.url} onChange={(e) => update("url", e.target.value, "url")} />
                  <FieldError id="e-productUrl" message={fieldErrors.productUrl} />
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-b border-text py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">구매한 옵션</h2>
              <span className="text-sm text-neutral-700">사이즈를 고르면 사이즈표의 실측이 아래에 채워집니다</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
              <div className="field">
                <label htmlFor="f-size" className="flex items-center gap-2">{label("사이즈", "size")}</label>
                {sizeChoices.length > 0 ? (
                  <div className="seg flex-wrap self-start" role="radiogroup" aria-label="사이즈">
                    {sizeChoices.map((s) => (
                      <label key={s} className="seg-opt px-4.5 py-2 font-mono text-base tabular-nums">
                        <input
                          type="radio"
                          name="fsize"
                          checked={form.size === s}
                          onChange={() => setForm((f) => ({ ...f, size: s, m: { ...f.m, ...chartMeasurements(product, s) } }))}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input id="f-size" className="input max-w-50" placeholder="예: M, 48, 32" aria-invalid={Boolean(fieldErrors.sizeLabel)} aria-describedby={fieldErrors.sizeLabel ? "e-sizeLabel" : undefined} value={form.size} onChange={(e) => update("size", e.target.value, "size")} />
                )}
                <FieldError id="e-sizeLabel" message={fieldErrors.sizeLabel} />
              </div>
              <div className="field">
                <label htmlFor="f-color" className="flex items-center gap-2">{label("컬러", "color")}</label>
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
                  <input id="f-color" className="input max-w-45" placeholder="컬러명 직접 입력" aria-invalid={Boolean(fieldErrors.colorName)} aria-describedby={fieldErrors.colorName ? "e-colorName" : undefined} value={form.color} onChange={(e) => update("color", e.target.value, "color")} />
                  <FieldError id="e-colorName" message={fieldErrors.colorName} />
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-b border-text py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">실측</h2>
              <span className="text-sm text-neutral-700">cm · 단면 기준 · 직접 잰 값이 있으면 덮어쓰세요</span>
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

          <section className="flex flex-col gap-3 py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">착용 후기</h2>
              <span className="text-sm text-neutral-700">선택 입력 · 입어본 뒤에 써도 됩니다</span>
            </div>
            <textarea
              className="input text-body leading-relaxed"
              rows={4}
              aria-label="착용 후기"
              placeholder="예: 어깨와 가슴은 마음에 드는데 총장이 조금 길다."
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

/** 고른 페이지 이미지를 받아 등록할 사진 파일로. 실패하면 사진 없이 등록한다(PROJECT_SPEC.md 12.4). */
async function pageImageFile(src: string): Promise<File | undefined> {
  try {
    const res = await fetch(src);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return new File([blob], "product-image", { type: blob.type || "image/jpeg" });
  } catch {
    return undefined;
  }
}

/** 서버 검증 오류 키 → 입력 칸 id(첫 오류 칸으로 포커스) */
const FIELD_IDS: Record<string, string> = {
  productName: "f-name",
  brand: "f-brand",
  material: "f-material",
  purchasedOn: "f-date",
  purchasePrice: "f-price",
  productUrl: "f-url",
  sizeLabel: "f-size",
  colorName: "f-color",
  subcategoryId: "f-sub",
  ...Object.fromEntries([...new Set([...TOP_MEASUREMENTS, ...BOTTOM_MEASUREMENTS])].map((k) => [`measurements.${k}`, `f-m-${k}`])),
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="text-xs text-accent-700">
      {message}
    </span>
  );
}
