"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWardrobe, type GarmentDraft } from "@/components/wardrobe/wardrobe-store";
import { UnitInput } from "@/components/ui/input";
import { SUBCATEGORIES } from "@/lib/constants/categories";
import { measurementFields } from "@/lib/constants/measurements";
import { SEASONS, toggleSeason } from "@/lib/constants/seasons";
import { cn } from "@/lib/cn";
import {
  ANALYZE_STEPS,
  EXTRACTED,
  EXTRACTED_COLORS,
  EXTRACTED_SIZE_CHART,
  FAILED_DETAIL,
  isSupportedUrl,
} from "@/lib/mock/product-import";
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

const TODAY = "2026-09-27";
const DEFAULT_URL = "https://www.musinsa.com/products/3920118";

const EMPTY_FORM: FormState = {
  categoryId: "outer",
  subcategoryId: "",
  brand: "",
  productName: "",
  material: "",
  seasons: [],
  price: "",
  url: "",
  date: TODAY,
  size: "",
  color: "",
  review: "",
  m: {},
};

const extractedForm = (url: string): FormState => ({
  ...EMPTY_FORM,
  categoryId: EXTRACTED.categoryId,
  subcategoryId: EXTRACTED.subcategoryId,
  brand: EXTRACTED.brand,
  productName: EXTRACTED.productName,
  material: EXTRACTED.material,
  seasons: EXTRACTED.seasons,
  price: EXTRACTED.price,
  date: EXTRACTED.date,
  url,
});

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
  const { addGarment, openDrawer, showToast, pendingDraft, setPendingDraft } = useWardrobe();

  const [phase, setPhase] = useState<Phase>(() => (pendingDraft ? "review" : params.get("mode") === "manual" ? "manual" : "url"));
  const [url, setUrl] = useState(DEFAULT_URL);
  const [step, setStep] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [form, setForm] = useState<FormState>(() => (pendingDraft ? draftToForm(pendingDraft) : EMPTY_FORM));
  const [edited, setEdited] = useState<Partial<Record<TagKey, boolean>>>({});
  const [imageIndex, setImageIndex] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 판단기에서 넘어온 값은 한 번만 쓴다.
  useEffect(() => {
    if (pendingDraft) setPendingDraft(null);
  }, [pendingDraft, setPendingDraft]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const analyze = () => {
    clearTimers();
    const target = url || DEFAULT_URL;
    setUrl(target);
    setPhase("analyzing");
    setStep(0);
    setShowDetail(false);
    [1, 2, 3].forEach((s) => timers.current.push(setTimeout(() => setStep(s), s * 900)));
    timers.current.push(
      setTimeout(() => {
        if (isSupportedUrl(target)) {
          setForm(extractedForm(target));
          setEdited({});
          setPhase("review");
        } else {
          setPhase("failed");
        }
      }, 3 * 900 + 500),
    );
  };

  const startManual = (keepUrl = false) => {
    clearTimers();
    setForm({ ...EMPTY_FORM, url: keepUrl ? url : "" });
    setEdited({});
    setPhase("manual");
  };

  const isReview = phase === "review";
  const showForm = phase === "review" || phase === "manual";
  const hasChart = isReview && form.categoryId === "top";

  const update = <K extends keyof FormState>(key: K, value: FormState[K], tag?: TagKey) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (tag) setEdited((e) => ({ ...e, [tag]: true }));
  };

  const tag = (k: TagKey): { label: string; className: string } => {
    if (edited[k]) return { label: "수정됨", className: "tag border border-text" };
    if (k === "size" && !form.size) return { label: "선택 필요", className: "tag tag-accent" };
    if (k === "color" && !form.color) return { label: "선택 필요", className: "tag tag-accent" };
    if (k === "seasons") return { label: "확인 필요", className: "tag tag-accent" };
    if (k === "date") return { label: "오늘", className: "tag tag-neutral" };
    if (k === "price") return { label: "판매가", className: "tag tag-neutral" };
    return { label: "자동", className: "tag tag-neutral" };
  };
  const label = (text: string, k: TagKey) => (
    <>
      {text}
      {isReview && <span className={cn(tag(k).className, "px-1.5 py-px text-2xs")}>{tag(k).label}</span>}
    </>
  );

  const register = () => {
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
    const garment = addGarment({
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
    });
    openDrawer(garment.id);
    showToast("옷장에 등록했습니다");
    router.push("/wardrobe");
  };

  const hint =
    !form.productName.trim()
      ? "제품명은 꼭 입력해야 합니다."
      : isReview && !form.size
        ? "구매한 사이즈를 선택하세요."
        : "등록 전까지 저장되지 않습니다.";

  const failDomain = url.match(/\/\/([^/]+)/)?.[1] ?? "";

  return (
    <main className="mx-auto max-w-280 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <Link href="/wardrobe" className="btn btn-ghost mb-2 text-sm">
        ← 내 옷장
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-text pb-4">
        <h1 className="text-title">새 옷 추가</h1>
        <div className="seg" role="radiogroup" aria-label="추가 방법">
          <label className="seg-opt px-4 py-2 text-base">
            <input type="radio" name="addmode" checked={phase !== "manual"} onChange={() => { clearTimers(); setPhase("url"); }} />
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
            무신사, 29CM 등 지원 쇼핑몰은 사이즈표까지 읽습니다. 그 외 사이트도 기본 정보 분석을 시도합니다.
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
                    key={s}
                    className={cn(
                      "grid grid-cols-[32px_1fr_auto] items-baseline gap-3 border-b border-neutral-300 py-3.5",
                      state === "대기" ? "text-neutral-600" : "text-text",
                    )}
                  >
                    <span className="font-mono text-sm text-neutral-600 tabular-nums">0{i + 1}</span>
                    <span className="text-body">{s}</span>
                    <span className="text-xs">{state}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-3">
                <span className="text-sm text-neutral-700">최대 20초 걸립니다. 페이지를 떠나도 입력한 URL은 남습니다.</span>
                <button type="button" className="btn btn-secondary" onClick={() => { clearTimers(); setPhase("url"); }}>
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
              <div className="text-lg font-semibold">상품 정보를 읽지 못했습니다</div>
              <p className="text-base text-pretty text-neutral-800">
                아직 지원하지 않는 쇼핑몰이거나 로그인이 필요한 페이지일 수 있습니다. 직접 입력하면 URL은 상품 링크 칸에
                그대로 남습니다.
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
                <div className="border-t border-divider pt-2.5 font-mono text-xs text-neutral-700 tabular-nums">{FAILED_DETAIL}</div>
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
                  {EXTRACTED.source}에서 {EXTRACTED.fieldCount}개 항목을 가져왔습니다
                </span>
                <span className="text-sm text-neutral-700">
                  구매한 사이즈와 컬러를 고르고, 값을 확인한 뒤 등록하세요. 등록 전에는 저장되지 않습니다.
                </span>
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
              <div className="flex aspect-[4/5] items-end rounded-md bg-neutral-200 p-2.5 text-xs text-neutral-700">
                {isReview ? (imageIndex === 0 ? "상품 페이지 대표 이미지" : `페이지 이미지 ${imageIndex + 1} 선택됨`) : "사진 끌어다 놓기"}
              </div>
              {isReview && (
                <>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs font-semibold">페이지 이미지 {EXTRACTED.imageCount}장</span>
                    <span className="text-label text-neutral-700">누르면 옷 정보 사진으로</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: EXTRACTED.imageCount }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={imageIndex === i}
                        aria-label={i === 0 ? "대표 이미지" : `이미지 ${i + 1}`}
                        onClick={() => setImageIndex(i)}
                        className={cn(
                          "flex aspect-[4/5] cursor-pointer items-end rounded-sm bg-neutral-200 px-1 py-0.5 font-mono text-2xs text-neutral-700",
                          imageIndex === i ? "ring-2 ring-text" : "ring-1 ring-neutral-300 ring-inset",
                        )}
                      >
                        {i === 0 ? "대표" : ""}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="flex gap-1">
                <button type="button" className="btn btn-ghost text-sm">
                  변경
                </button>
                <button type="button" className="btn btn-ghost text-sm text-neutral-700">
                  제거
                </button>
              </div>
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
                  <input id="f-brand" className="input" value={form.brand} onChange={(e) => update("brand", e.target.value, "brand")} />
                </div>
                <div className="field sm:col-span-2">
                  <label htmlFor="f-name" className="flex items-center justify-between">{label("제품명", "name")}</label>
                  <input id="f-name" className="input" value={form.productName} onChange={(e) => update("productName", e.target.value, "name")} />
                </div>
                <div className="field">
                  <label htmlFor="f-material" className="flex items-center justify-between">{label("소재", "material")}</label>
                  <input id="f-material" className="input" value={form.material} onChange={(e) => update("material", e.target.value, "material")} />
                </div>
                <div className="field">
                  <label htmlFor="f-date" className="flex items-center justify-between">{label("구매 날짜", "date")}</label>
                  <input id="f-date" type="date" className="input font-mono tabular-nums" value={form.date} onChange={(e) => update("date", e.target.value, "date")} />
                </div>
                <div className="field">
                  <label htmlFor="f-price" className="flex items-center justify-between">{label("구매가", "price")}</label>
                  <UnitInput id="f-price" unit="원" inputMode="numeric" value={form.price} onChange={(e) => update("price", e.target.value, "price")} />
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
                  <input id="f-url" className="input text-neutral-800" placeholder="선택 입력" value={form.url} onChange={(e) => update("url", e.target.value, "url")} />
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
                {hasChart ? (
                  <div className="seg self-start" role="radiogroup" aria-label="사이즈">
                    {Object.keys(EXTRACTED_SIZE_CHART).map((s) => (
                      <label key={s} className="seg-opt px-4.5 py-2 font-mono text-base tabular-nums">
                        <input
                          type="radio"
                          name="fsize"
                          checked={form.size === s}
                          onChange={() => setForm((f) => ({ ...f, size: s, m: { ...EXTRACTED_SIZE_CHART[s] } }))}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input id="f-size" className="input max-w-50" placeholder="예: M, 48, 32" value={form.size} onChange={(e) => update("size", e.target.value, "size")} />
                )}
              </div>
              <div className="field">
                <label htmlFor="f-color" className="flex items-center gap-2">{label("컬러", "color")}</label>
                <div className="flex flex-wrap items-center gap-2">
                  {hasChart && (
                    <div className="seg" role="radiogroup" aria-label="컬러 옵션">
                      {EXTRACTED_COLORS.map((c) => (
                        <label key={c} className="seg-opt px-3.5 py-2 text-base">
                          <input type="radio" name="fcolor" checked={form.color === c} onChange={() => update("color", c)} />
                          {c}
                        </label>
                      ))}
                    </div>
                  )}
                  <input id="f-color" className="input max-w-45" placeholder="컬러명 직접 입력" value={form.color} onChange={(e) => update("color", e.target.value, "color")} />
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-b border-text py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">실측</h2>
              <span className="text-sm text-neutral-700">cm · 단면 기준 · 직접 잰 값이 있으면 덮어쓰세요</span>
            </div>
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
                    onChange={(e) => setForm((f) => ({ ...f, m: { ...f.m, [m.key]: e.target.value } }))}
                  />
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
            <span className="text-sm text-neutral-700">{hint}</span>
            <div className="flex gap-2">
              <Link href="/wardrobe" className="btn btn-secondary min-h-10">
                취소
              </Link>
              <button type="button" className="btn btn-primary min-h-10 min-w-30" onClick={register}>
                등록
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
