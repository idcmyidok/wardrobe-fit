"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { ImagePicker } from "./image-picker";
import { PageImageGrid } from "./page-image-grid";
import { DateLabel } from "./date-label";
import { ShoeFitPicker } from "./shoe-fit-picker";
import { UnitInput } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { parsePriceInput, priceInputText, type Currency } from "@/lib/format/price";
import { CATEGORIES, SUBCATEGORIES } from "@/lib/constants/categories";
import { ALL_MEASUREMENT_KEYS, measurementFields } from "@/lib/constants/measurements";
import { EMPTY_SHOE_FIT, shoeFitOrNull, type ShoeFit } from "@/lib/constants/shoe-fit";
import { SEASONS, toggleSeason } from "@/lib/constants/seasons";
import { importImageUrl, type ImportOutcome } from "@/lib/import/client";
import { BodyFitPanel } from "@/components/body/body-fit-panel";
import { UserFitPicker } from "@/components/body/user-fit-picker";
import type { FitLevel } from "@/lib/constants/body";
import type { GarmentDraft, ImageChange } from "@/components/wardrobe/wardrobe-store";
import type { CategoryId, Measurements, Season } from "@/lib/types/domain";

export interface FormState {
  categoryId: CategoryId;
  subcategoryId: string;
  brand: string;
  productName: string;
  seasons: Season[];
  price: string;
  currency: Currency;
  url: string;
  date: string;
  size: string;
  color: string;
  review: string;
  m: Record<string, string>;
  shoeFit: ShoeFit;
  userFit: FitLevel | null;
}

export type Imported = ImportOutcome & { importId: string; product: NonNullable<ImportOutcome["product"]> };

export const EMPTY_FORM: FormState = {
  categoryId: "outer",
  subcategoryId: "",
  brand: "",
  productName: "",
  seasons: [],
  price: "",
  currency: "KRW",
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
export const importedForm = (url: string, p: Imported["product"]): FormState => {
  const size = p.sizeOptions.length === 1 ? p.sizeOptions[0] : "";
  return {
    ...EMPTY_FORM,
    categoryId: p.categoryId?.value ?? "outer",
    subcategoryId: p.subcategoryId?.value ?? "",
    brand: p.brand?.value ?? "",
    productName: p.productName?.value ?? "",
    price: p.price ? priceInputText(p.price.value, p.priceCurrency ?? "KRW") : "",
    currency: p.priceCurrency ?? "KRW",
    color: p.colorCandidate?.value ?? "",
    size,
    m: chartMeasurements(p, size),
    url,
  };
};

/** 사이즈표에서 고른 사이즈의 실측 */
export function chartMeasurements(p: Imported["product"] | undefined, size: string): Record<string, string> {
  const row = p?.sizeChart?.rows.find((r) => r.sizeLabel === size);
  return row ? Object.fromEntries(Object.entries(row.measurements).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) : {};
}

/** AI 구매 판단 결과·구매 보류 옷에서 넘어온 값(구매했어요)을 검토 폼 값으로 바꾼다. */
export const draftToForm = (d: GarmentDraft): FormState => ({
  ...EMPTY_FORM,
  categoryId: d.categoryId,
  subcategoryId: d.subcategoryId ?? "",
  brand: d.brand,
  productName: d.productName,
  size: d.sizeLabel ?? "",
  color: d.colorName ?? "",
  price: priceInputText(d.purchasePrice, d.currency ?? "KRW"),
  currency: d.currency ?? "KRW",
  date: d.purchasedOn ?? "",
  seasons: d.seasons,
  review: d.fitReview ?? "",
  url: d.productUrl ?? "",
  m: Object.fromEntries(Object.entries(d.measurements).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])),
  shoeFit: d.shoeFit ?? EMPTY_SHOE_FIT,
  userFit: d.userFit ?? null,
});

/** 옷 한 벌 폼의 입력 상태(사진 고르기 포함). 새 옷 추가 한 벌, 여러 링크 가져오기의 각 벌이 같은 것을 쓴다. */
export interface ItemState {
  form: FormState;
  image: ImageChange;
  imageIndex: number;
  /** 받지 못했거나 아이콘처럼 작은 페이지 사진(목록에서 숨긴다) */
  badImages: number[];
  /** 찾은 사이즈 대신 사이즈를 직접 적는다(사이즈표를 잘못 읽었을 때). 나머지 가져온 값은 그대로 둔다. */
  customSize: boolean;
}

export const newItemState = (form: FormState): ItemState => ({ form, image: undefined, imageIndex: 0, badImages: [], customSize: false });

/** 상태 + 분석 결과에서 화면에 쓰는 값들 */
export function itemView(state: ItemState, imported: Imported | null | undefined) {
  const product = imported?.product;
  const sizeChoices = product ? (product.sizeOptions.length ? product.sizeOptions : (product.sizeChart?.rows.map((r) => r.sizeLabel) ?? [])) : [];
  const colorChoices = product?.colorOptions ?? [];
  const pageImages = product && imported ? product.imageUrls.map((_, i) => importImageUrl(imported.importId, i)) : [];
  const shownImages = pageImages.map((src, i) => ({ src, i })).filter(({ i }) => !state.badImages.includes(i));
  // 고른 사진이 목록에서 빠졌으면 남은 첫 사진을 쓴다.
  const chosen = shownImages.some(({ i }) => i === state.imageIndex) ? state.imageIndex : (shownImages[0]?.i ?? -1);
  const chosenUrl = pageImages[chosen] as string | undefined;
  return { product, sizeChoices, colorChoices, shownImages, chosen, chosenUrl };
}

/** 폼 → 저장할 옷 값 */
export function formToDraft(form: FormState, held: boolean, fitCheckId: string | null): GarmentDraft {
  const measurements: Measurements = {};
  Object.entries(form.m).forEach(([k, v]) => {
    if (v !== "" && !isNaN(Number(v))) measurements[k as keyof Measurements] = Number(v);
  });
  return {
    categoryId: form.categoryId,
    subcategoryId: form.subcategoryId || null,
    brand: form.brand.trim(),
    productName: form.productName.trim(),
    sizeLabel: form.size || null,
    colorName: form.color || null,
    seasons: held ? [] : form.seasons,
    purchasedOn: held ? null : form.date || null,
    purchasePrice: parsePriceInput(form.price, form.currency),
    currency: form.currency,
    productUrl: form.url || null,
    imageUrl: null,
    measurements,
    fitReview: form.review || null,
    shoeFit: form.categoryId === "shoes" ? shoeFitOrNull(form.shoeFit) : null,
    userFit: !held && isClothes(form.categoryId) ? form.userFit : null,
    held,
    fitCheckId,
  } as GarmentDraft;
}

export function GarmentFields({
  idp = "",
  state,
  onChange,
  imported,
  held,
  fieldErrors,
  currentImageUrl,
}: {
  /** 한 화면에 폼이 여러 개일 때 칸 id가 겹치지 않게 붙이는 접두어 */
  idp?: string;
  state: ItemState;
  onChange: (fn: (s: ItemState) => ItemState) => void;
  imported?: Imported | null;
  held: boolean;
  fieldErrors: Record<string, string>;
  /** 이미 있는 옷 사진(구매 보류 옷을 옮길 때) */
  currentImageUrl?: string | null;
}) {
  const i = (s: string) => (idp ? `${idp}-${s}` : s);
  const { form, image, customSize } = state;
  const { product, sizeChoices, colorChoices, shownImages, chosen, chosenUrl } = itemView(state, imported);
  const isReview = Boolean(imported);
  const setForm: Dispatch<SetStateAction<FormState>> = (v) => onChange((s) => ({ ...s, form: typeof v === "function" ? v(s.form) : v }));
  const setImage = (v: ImageChange) => onChange((s) => ({ ...s, image: v }));
  const setImageIndex = (v: number) => onChange((s) => ({ ...s, imageIndex: v }));
  const setCustomSize = (v: boolean) => onChange((s) => ({ ...s, customSize: v }));
  const dropImage = (n: number) => onChange((s) => (s.badImages.includes(n) ? s : { ...s, badImages: [...s.badImages, n] }));
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const moving = currentImageUrl ? { imageUrl: currentImageUrl } : undefined;

  return (
    <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-6 border-b border-text py-7">
            <div className="flex max-w-60 flex-col gap-2">
              <ImagePicker
                currentUrl={chosenUrl ?? moving?.imageUrl ?? null}
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
                  <label htmlFor={i("f-cat")}>대분류</label>
                  <select
                    id={i("f-cat")}
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
                  <label htmlFor={i("f-sub")}>세부분류</label>
                  <select id={i("f-sub")} className="input" value={form.subcategoryId} onChange={(e) => update("subcategoryId", e.target.value)}>
                    <option value="">선택</option>
                    {SUBCATEGORIES.filter((s) => s.categoryId === form.categoryId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={i("f-brand")}>브랜드</label>
                  <input id={i("f-brand")} className="input" aria-invalid={Boolean(fieldErrors.brand)} aria-describedby={fieldErrors.brand ? i("e-brand") : undefined} value={form.brand} onChange={(e) => update("brand", e.target.value)} />
                  <FieldError id={i("e-brand")} message={fieldErrors.brand} />
                </div>
                <div className="field sm:col-span-2">
                  <label htmlFor={i("f-name")}>제품명</label>
                  <input id={i("f-name")} className="input" aria-invalid={Boolean(fieldErrors.productName)} aria-describedby={fieldErrors.productName ? i("e-productName") : undefined} value={form.productName} onChange={(e) => update("productName", e.target.value)} />
                  <FieldError id={i("e-productName")} message={fieldErrors.productName} />
                </div>
                {!held && (
                  <div className="field">
                    <DateLabel htmlFor={i("f-date")} label="구매 날짜" filled={Boolean(form.date)} onClear={() => update("date", "")} />
                    <input id={i("f-date")} type="date" className="input font-mono tabular-nums" aria-invalid={Boolean(fieldErrors.purchasedOn)} aria-describedby={fieldErrors.purchasedOn ? i("e-purchasedOn") : undefined} value={form.date} onChange={(e) => update("date", e.target.value)} />
                    <FieldError id={i("e-purchasedOn")} message={fieldErrors.purchasedOn} />
                  </div>
                )}
                <div className="field">
                  <label htmlFor={i("f-price")}>{held ? "가격" : "구매가"}</label>
                  <PriceInput
                    id={i("f-price")}
                    value={form.price}
                    currency={form.currency}
                    onChange={(v) => update("price", v)}
                    onCurrencyChange={(c) => update("currency", c)}
                    aria-invalid={Boolean(fieldErrors.purchasePrice)}
                    aria-describedby={[fieldErrors.purchasePrice && i("e-purchasePrice"), product?.price && !held && i("h-price")].filter(Boolean).join(" ") || undefined}
                  />
                  <FieldError id={i("e-purchasePrice")} message={fieldErrors.purchasePrice} />
                  {product?.price && !held && (
                    <span id={i("h-price")} className="whitespace-nowrap text-xs text-neutral-700">
                      쇼핑몰 현재 판매가예요. 실제 산 가격으로 고쳐 주세요.
                    </span>
                  )}
                </div>
                {!held && <div className="field col-span-full">
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
                </div>}
                <div className="field col-span-full">
                  <label htmlFor={i("f-url")}>상품 링크 <span className="text-xs font-normal text-neutral-700">(가능한 실제 구매 링크를 적어주세요. 옷장 훈수에서 정확한 분석에 도움이 됩니다)</span></label>
                  <input id={i("f-url")} className="input text-neutral-800" placeholder="선택 입력" aria-invalid={Boolean(fieldErrors.productUrl)} aria-describedby={fieldErrors.productUrl ? i("e-productUrl") : undefined} value={form.url} onChange={(e) => update("url", e.target.value)} />
                  <FieldError id={i("e-productUrl")} message={fieldErrors.productUrl} />
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-b border-text py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">{held ? "고민 중인 옵션" : "구매한 옵션"}</h2>
              <span className="text-sm text-neutral-700">사이즈를 고르면 사이즈표의 실측이 아래에 채워집니다. 맞는 사이즈가 없으면 직접 입력하세요</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
              <div className="field">
                <label htmlFor={i("f-size")}>사이즈</label>
                {sizeChoices.length > 0 ? (
                  <div className="seg flex-wrap self-start" role="radiogroup" aria-label="사이즈">
                    {sizeChoices.map((s) => (
                      <label key={s} className="seg-opt px-4.5 py-2 font-mono text-base tabular-nums">
                        <input
                          type="radio"
                          name={i("fsize")}
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
                        name={i("fsize")}
                        checked={customSize}
                        onChange={() => {
                          setCustomSize(true);
                          setForm((f) => ({ ...f, size: "" }));
                          requestAnimationFrame(() => document.getElementById(i("f-size"))?.focus());
                        }}
                      />
                      직접 입력
                    </label>
                  </div>
                ) : null}
                {(sizeChoices.length === 0 || customSize) && (
                  <input id={i("f-size")} className="input max-w-50" placeholder="예: M, 48, 32" aria-invalid={Boolean(fieldErrors.sizeLabel)} aria-describedby={fieldErrors.sizeLabel ? i("e-sizeLabel") : undefined} value={form.size} onChange={(e) => update("size", e.target.value)} />
                )}
                <FieldError id={i("e-sizeLabel")} message={fieldErrors.sizeLabel} />
              </div>
              <div className="field">
                <label htmlFor={i("f-color")}>컬러</label>
                <div className="flex flex-wrap items-center gap-2">
                  {colorChoices.length > 0 && (
                    <div className="seg flex-wrap" role="radiogroup" aria-label="컬러 옵션">
                      {colorChoices.map((c) => (
                        <label key={c} className="seg-opt px-3.5 py-2 text-base">
                          <input type="radio" name={i("fcolor")} checked={form.color === c} onChange={() => update("color", c)} />
                          {c}
                        </label>
                      ))}
                    </div>
                  )}
                  <input id={i("f-color")} className="input max-w-45" placeholder="컬러명 직접 입력" aria-invalid={Boolean(fieldErrors.colorName)} aria-describedby={fieldErrors.colorName ? i("e-colorName") : undefined} value={form.color} onChange={(e) => update("color", e.target.value)} />
                  <FieldError id={i("e-colorName")} message={fieldErrors.colorName} />
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
              <ShoeFitPicker idPrefix={i("f-shoe")} value={form.shoeFit} onChange={(v) => update("shoeFit", v)} />
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
                    <label htmlFor={i(`f-m-${m.key}`)}>{m.label}</label>
                    <UnitInput
                      id={i(`f-m-${m.key}`)}
                      unit="cm"
                      inputMode="decimal"
                      className="text-body"
                      value={form.m[m.key] ?? ""}
                      aria-invalid={Boolean(fieldErrors[`measurements.${m.key}`])}
                      aria-describedby={fieldErrors[`measurements.${m.key}`] ? i(`e-m-${m.key}`) : undefined}
                      onChange={(e) => setForm((f) => ({ ...f, m: { ...f.m, [m.key]: e.target.value } }))}
                    />
                    <FieldError id={i(`e-m-${m.key}`)} message={fieldErrors[`measurements.${m.key}`]} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {isClothes(form.categoryId) && !held && (
            <section className="flex flex-col gap-4 border-b border-text py-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={i("f-user-fit")} className="text-lg">
                  내 핏
                </h2>
                <span className="text-sm text-neutral-700">선택 입력 · 비워 두면 내 치수로 계산한 예상 핏을 보여 줍니다</span>
              </div>
              <UserFitPicker
                labelledBy={i("f-user-fit")}
                kind={form.categoryId === "bottom" ? "bottom" : "top"}
                value={form.userFit}
                onChange={(v) => update("userFit", v)}
              />
              <FormBodyFit form={form} />
            </section>
          )}

          <section className="flex flex-col gap-3 py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">{held ? "메모" : "착용 후기"}</h2>
              <span className="text-sm text-neutral-700">{held ? "선택 입력 · 고민하는 이유나 비교할 점" : "선택 입력 · 입어본 뒤에 써도 됩니다"}</span>
            </div>
            <textarea
              className="input text-body leading-relaxed"
              rows={4}
              aria-label={held ? "메모" : "착용 후기"}
              placeholder={form.categoryId === "shoes" ? "예: 발볼이 조금 좁아서 다음엔 반 치수 크게 사고 싶다." : "예: 어깨와 가슴은 마음에 드는데 총장이 조금 길다."}
              value={form.review}
              onChange={(e) => update("review", e.target.value)}
            />
            {!held && <span className="text-sm text-neutral-700">구매 판단기가 이 후기를 원문 그대로 근거로 인용합니다.</span>}
          </section>
    </>
  );
}

/** 서버 검증 오류 키 → 입력 칸 id(첫 오류 칸으로 포커스) */
export const FIELD_IDS: Record<string, string> = {
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

export const isClothes = (c: CategoryId) => c === "outer" || c === "top" || c === "bottom";

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
