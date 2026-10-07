"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePicker } from "@/components/garment-form/image-picker";
import { ShopPhotos } from "@/components/garment-form/shop-photos";
import { UnitInput } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { ShoeFitPicker } from "@/components/garment-form/shoe-fit-picker";
import { CATEGORIES, CATEGORY_NAME, SUBCATEGORIES, SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { formatCm, measurementFields } from "@/lib/constants/measurements";
import { SEASONS, SEASON_NAME, toggleSeason } from "@/lib/constants/seasons";
import { EMPTY_SHOE_FIT, SHOE_FIT_FIELDS, shoeFitOrNull, shoeFitText, type ShoeFit } from "@/lib/constants/shoe-fit";
import { formatDate } from "@/lib/format/date";
import { DateLabel } from "@/components/garment-form/date-label";
import { formatPrice, krwHint, parsePriceInput, priceInputText, type Currency } from "@/lib/format/price";
import { PriceInput } from "@/components/ui/price-input";
import Link from "next/link";
import type { CategoryId, Garment, Measurements, Season } from "@/lib/types/domain";
import { useOpenGarmentId, useWardrobe, type ImageChange } from "./wardrobe-store";
import { BodyFitPanel } from "@/components/body/body-fit-panel";
import { UserFitPicker } from "@/components/body/user-fit-picker";
import type { FitLevel } from "@/lib/constants/body";

/** Drawer 안 소제목. 시안의 모노 라벨 + 잉크 밑줄 */
function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between border-b border-divider pb-2">
      <h3 className="font-mono text-sm font-medium tracking-[0.08em] text-neutral-700">{children}</h3>
      {aside}
    </div>
  );
}

interface InfoDraft {
  categoryId: CategoryId;
  subcategoryId: string;
  brand: string;
  productName: string;
  sizeLabel: string;
  colorName: string;
  purchasedOn: string;
  purchasePrice: string;
  currency: Currency;
  productUrl: string;
  seasons: Season[];
  measurements: Record<string, string>;
  fitReview: string;
  shoeFit: ShoeFit;
}

const toDraft = (g: Garment): InfoDraft => ({
  categoryId: g.categoryId,
  subcategoryId: g.subcategoryId ?? "",
  brand: g.brand,
  productName: g.productName,
  sizeLabel: g.sizeLabel ?? "",
  colorName: g.colorName ?? "",
  purchasedOn: g.purchasedOn ?? "",
  purchasePrice: priceInputText(g.purchasePrice, g.currency ?? "KRW"),
  currency: g.currency ?? "KRW",
  productUrl: g.productUrl ?? "",
  seasons: g.seasons.slice(),
  measurements: Object.fromEntries(Object.entries(g.measurements).map(([k, v]) => [k, v == null ? "" : String(v)])),
  fitReview: g.fitReview ?? "",
  shoeFit: g.shoeFit ?? EMPTY_SHOE_FIT,
});

/** 실측 칸 수에 맞춘 열 수(상의·아우터 4칸은 2열, 하의 6칸·모자 3칸은 3열) */
const measureCols = (categoryId: CategoryId) => (measurementFields(categoryId).length === 4 ? "grid-cols-2" : "grid-cols-3");

/**
 * 옷 정보 Drawer: 상세 보기, 기본 정보·실측·후기 수정, 삭제(확인 Dialog + 실행 취소).
 * 주소의 ?item={id}로 열리고 닫힌다. useSearchParams를 쓰므로 Suspense 안에 둔다.
 */
export function GarmentDrawer() {
  const { allGarments, closeDrawer } = useWardrobe();
  const id = useOpenGarmentId();
  const garment = allGarments.find((g) => g.id === id);
  if (!garment) return null;
  // key로 옷이 바뀔 때마다 편집 상태를 새로 시작한다.
  return <GarmentDetail key={garment.id} garment={garment} variant="drawer" onClose={closeDrawer} />;
}

/**
 * 옷 정보 본문. 넓은 화면은 Drawer(variant="drawer"), 모바일은 상세 페이지(variant="page")로 보여준다.
 */
export function GarmentDetail({
  garment: g,
  variant,
  onClose,
}: {
  garment: Garment;
  variant: "drawer" | "page";
  onClose: () => void;
}) {
  const { updateGarment, removeGarment, showToast, setPendingDraft, usdRate } = useWardrobe();
  // 구매 보류 옷: 구매일·시즌·내 핏이 없고, "구매했어요 → 옷장으로"로 옷장에 옮긴다.
  const held = Boolean(g.held);
  const router = useRouter();
  const [info, setInfo] = useState<InfoDraft | null>(null);
  const [reviewDraft, setReviewDraft] = useState<string | null>(null);
  const [image, setImage] = useState<ImageChange>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof InfoDraft>(key: K, value: InfoDraft[K]) => setInfo((d) => (d ? { ...d, [key]: value } : d));

  const startEdit = () => {
    setReviewDraft(null);
    setImage(undefined);
    setError(null);
    setInfo(toDraft(g));
  };

  const saveInfo = async () => {
    if (!info || saving) return;
    if (!info.productName.trim()) {
      setError("제품명은 꼭 입력해야 합니다.");
      document.getElementById("ie-productName")?.focus();
      return;
    }
    const measurements: Measurements = {};
    for (const { key } of measurementFields(info.categoryId)) {
      const v = info.measurements[key];
      measurements[key] = v == null || v === "" || isNaN(Number(v)) ? null : Number(v);
    }
    setSaving(true);
    setError(null);
    const result = await updateGarment(g.id, {
      categoryId: info.categoryId,
      subcategoryId: info.subcategoryId || null,
      brand: info.brand.trim(),
      productName: info.productName.trim(),
      sizeLabel: info.sizeLabel || null,
      colorName: info.colorName || null,
      purchasedOn: held ? null : info.purchasedOn || null,
      purchasePrice: parsePriceInput(info.purchasePrice, info.currency),
      currency: info.currency,
      productUrl: info.productUrl || null,
      seasons: held ? [] : info.seasons,
      measurements,
      fitReview: info.fitReview.trim() || null,
      shoeFit: info.categoryId === "shoes" ? shoeFitOrNull(info.shoeFit) : null,
    }, image);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInfo(null);
    showToast("옷 정보를 저장했습니다");
  };

  const saveReview = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await updateGarment(g.id, { fitReview: reviewDraft?.trim() || null });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReviewDraft(null);
    showToast(held ? "메모를 저장했습니다" : "착용 후기를 저장했습니다");
  };

  const saveUserFit = async (userFit: FitLevel | null) => {
    if (saving) return;
    setSaving(true);
    const result = await updateGarment(g.id, { userFit });
    setSaving(false);
    showToast(result.ok ? (userFit ? "내 핏을 표기했습니다" : "내 핏 표기를 지웠습니다") : result.error);
  };

  /** 구매 보류 옷 → 옷장: 내용을 채운 옷장 추가 화면에서 구매일·시즌·실제 구매가를 넣고 저장하면 옷장 옷이 된다. */
  const moveToWardrobe = () => {
    const { id, ...rest } = g;
    setPendingDraft({ ...rest, held: false, heldId: id });
    router.push("/wardrobe/new");
  };

  const productHref = safeHttpUrl(g.productUrl);
  const hint = krwHint(g.purchasePrice, g.currency, usdRate);
  const priceText = (
    <>
      {formatPrice(g.purchasePrice, g.currency)}
      {hint && <span className="ml-1.5 text-xs text-neutral-700">{hint}</span>}
    </>
  );
  const details: [string, ReactNode][] = [
    ...(held
      ? ([["가격", priceText]] as [string, ReactNode][])
      : ([
          ["시즌", g.seasons.map((s) => SEASON_NAME[s]).join(" · ") || "—"],
          ["구매일", formatDate(g.purchasedOn)],
          ["구매가", priceText],
        ] as [string, ReactNode][])),
    ...(g.fitCheckId
      ? ([
          [
            "구매 판단",
            <Link key="fc" href={`/fit-check/${g.fitCheckId}`} className="underline underline-offset-2 hover:text-accent-700">
              판단 결과 보기
            </Link>,
          ],
        ] as [string, ReactNode][])
      : []),
    [
      "상품 링크",
      productHref ? (
        <a href={productHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent-700">
          {g.productUrl}
        </a>
      ) : (
        g.productUrl || "—"
      ),
    ],
  ];

  return (
    <>
      <Frame variant={variant} onClose={onClose}>
          <div className={cn("flex items-start justify-between border-b border-divider bg-bg px-6 py-3", variant === "drawer" && "sticky top-0 z-1")}>
            <div className="flex items-baseline gap-2.5">
              <span id="drawer-title" className="text-body font-semibold">
                {held ? "구매 보류 옷" : "옷 정보"}
              </span>
              <span className="text-sm text-neutral-700">
                {CATEGORY_NAME[g.categoryId]} / {g.subcategoryId ? SUBCATEGORY_NAME[g.subcategoryId] : "—"}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button type="button" className="btn btn-icon" aria-label={variant === "drawer" ? "닫기" : held ? "구매 판단기로" : "내 옷장으로"} onClick={onClose}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              {!info && (
                <button
                  type="button"
                  className="btn btn-primary min-h-0 px-3 py-1.5 text-sm"
                  onClick={startEdit}
                >
                  옷 정보 수정
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-8 p-6">
            {!info ? (
              <>
                <div className="grid grid-cols-[112px_1fr] gap-5">
                  {g.imageUrl ? (
                    <button
                      type="button"
                      aria-label="사진 크게 보기"
                      onClick={() => setZoomed(true)}
                      className="flex w-full cursor-zoom-in items-start justify-center"
                    >
                      {/* 불러오지 못하면(서명 주소 만료 등) 깨진 그림 대신 빈 자리만 남긴다. */}
                      {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 bucket의 signed URL */}
                      <img src={g.imageUrl} alt="" onError={(e) => (e.currentTarget.style.opacity = "0")} className="h-auto max-h-50 w-auto max-w-full rounded-sm" />
                    </button>
                  ) : (
                    <div className="aspect-4/5 rounded-sm bg-neutral-200" />
                  )}
                  <div className="flex min-w-0 flex-col gap-1.5">
                    {g.brand && <span className="text-base font-semibold">{g.brand}</span>}
                    <h2 className="text-xl leading-tight">{g.productName}</h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="tag tag-neutral tabular-nums">사이즈 {g.sizeLabel || "—"}</span>
                      <span className="tag tag-neutral">{g.colorName || "컬러 미입력"}</span>
                    </div>
                  </div>
                </div>
                <section>
                  <SectionTitle>기본 정보</SectionTitle>
                  <dl className="grid grid-cols-[96px_1fr] text-base">
                    {details.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="border-b border-neutral-300 py-2 text-neutral-700">{k}</dt>
                        <dd className="border-b border-neutral-300 py-2 font-mono tabular-nums [overflow-wrap:anywhere]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                {g.categoryId === "shoes" ? (
                  <section>
                    <SectionTitle>착용감</SectionTitle>
                    <div className="grid grid-cols-3">
                      {SHOE_FIT_FIELDS.map((f) => (
                        <div key={f.key} className="flex flex-col gap-0.5 border-b border-neutral-300 py-2.5">
                          <span className="text-xs text-neutral-700">{f.label}</span>
                          <span className="text-lg font-semibold">{shoeFitText(f.key, g.shoeFit?.[f.key])}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                  <section>
                    <SectionTitle aside={<span className="text-xs text-neutral-700">{g.categoryId === "hat" ? "cm" : "cm · 단면"}</span>}>실측</SectionTitle>
                    <div className={cn("grid", measureCols(g.categoryId))}>
                      {measurementFields(g.categoryId).map((m) => (
                        <div key={m.key} className="flex flex-col gap-0.5 border-b border-neutral-300 py-2.5">
                          <span className="text-xs text-neutral-700">{m.label}</span>
                          <span className="font-mono text-lg font-semibold tabular-nums">{formatCm(g.measurements[m.key])}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {(g.categoryId === "outer" || g.categoryId === "top" || g.categoryId === "bottom") && (
                  <section>
                    <SectionTitle aside={<span className="text-xs text-neutral-700">내 치수 기준</span>}>핏</SectionTitle>
                    <div className="flex flex-col gap-4 pt-1">
                      <BodyFitPanel garment={g} userFit={g.userFit ?? null} collapseReasons />
                      {!held && <div className="flex flex-col gap-2">
                        <span id={`uf-${g.id}`} className="text-xs text-neutral-700">
                          내 핏 표기 · 입어 보고 고르면 예상 핏 대신 보이고, 다시 누르면 지워져 예상 핏으로 돌아갑니다
                        </span>
                        <UserFitPicker
                          labelledBy={`uf-${g.id}`}
                          kind={g.categoryId === "bottom" ? "bottom" : "top"}
                          value={g.userFit ?? null}
                          disabled={saving}
                          onChange={saveUserFit}
                        />
                      </div>}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <InfoEditor info={info} setField={setField} imageUrl={g.imageUrl} image={image} setImage={setImage} held={held} />
            )}

            <section>
              <SectionTitle
                aside={
                  reviewDraft == null && !info ? (
                    <button type="button" className="btn btn-ghost text-sm" onClick={() => setReviewDraft(g.fitReview ?? "")}>
                      {held ? (g.fitReview ? "메모 수정" : "메모 쓰기") : g.fitReview ? "후기 수정" : "후기 쓰기"}
                    </button>
                  ) : undefined
                }
              >
                {held ? "메모" : "착용 후기"}
              </SectionTitle>
              {reviewDraft == null ? (
                g.fitReview ? (
                  <p className="text-md leading-[1.7] text-pretty">{g.fitReview}</p>
                ) : (
                  <p className="text-base text-neutral-700">
                    {held ? "아직 메모가 없습니다. 고민하는 이유나 비교할 점을 남겨 두세요." : "아직 후기가 없습니다. 입어본 느낌을 한두 줄 남기면 구매 판단의 근거로 쓰입니다."}
                  </p>
                )
              ) : (
                <>
                  <textarea
                    className="input text-body leading-relaxed"
                    rows={4}
                    aria-label={held ? "메모" : "착용 후기"}
                    value={reviewDraft}
                    onChange={(e) => setReviewDraft(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="btn btn-secondary" onClick={() => { setReviewDraft(null); setError(null); }}>
                      취소
                    </button>
                    <button type="button" className="btn btn-primary" disabled={saving} onClick={saveReview}>
                      {saving ? "저장 중…" : "저장"}
                    </button>
                  </div>
                  {error && (
                    <p role="alert" className="mt-2 text-right text-xs text-accent-700">
                      {error}
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          <div className="sticky bottom-0 flex gap-2 border-t border-divider bg-bg px-6 py-3">
            {!info ? (
              <>
                {held ? (
                  <button type="button" className="btn btn-primary" onClick={moveToWardrobe}>
                    구매했어요 → 옷장으로
                  </button>
                ) : (
                  <Link href="/fit-check" className="btn btn-secondary">
                    이 옷 기준으로 판단
                  </Link>
                )}
                <button type="button" className="btn btn-danger ml-auto" onClick={() => setConfirmDelete(true)}>
                  삭제
                </button>
              </>
            ) : (
              <>
                <span role={error ? "alert" : undefined} className={error ? "mr-auto self-center text-xs text-accent-700" : "mr-auto self-center text-xs text-neutral-700"}>
                  {error ?? "빈 칸은 —로 저장됩니다"}
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => { setInfo(null); setError(null); }}>
                  취소
                </button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={saveInfo}>
                  {saving ? "저장 중…" : "저장"}
                </button>
              </>
            )}
          </div>
      </Frame>

      {zoomed && g.imageUrl && <PhotoViewer src={g.imageUrl} onClose={() => setZoomed(false)} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--n-900)_50%,transparent)] p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onKeyDown={(e) => e.key === "Escape" && setConfirmDelete(false)}
            className="flex w-[min(440px,100%)] flex-col gap-3 rounded-lg border border-border bg-bg p-4">
            <div id="delete-title" className="text-lg font-semibold">
              이 옷을 삭제할까요?
            </div>
            <div className="text-base text-neutral-800">
              {[g.brand, g.productName].filter(Boolean).join(" ")}의 실측과 {held ? "메모" : "착용 후기"}가 함께 삭제됩니다. 5초 안에는 실행 취소할 수 있습니다.
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" autoFocus onClick={() => setConfirmDelete(false)}>
                취소
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  setConfirmDelete(false);
                  if ((await removeGarment(g.id)) && variant === "page") router.replace(held ? "/fit-check" : "/wardrobe");
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 옷 사진 크게 보기. 오른쪽 위 X·Esc·배경 클릭으로 닫는다. */
function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      data-photo-viewer
      onClick={onClose}
      // 닫기 버튼 하나뿐이라 Tab이 뒤쪽 화면으로 빠지지 않게 막는다.
      onKeyDown={(e) => e.key === "Tab" && e.preventDefault()}
      className="fixed inset-0 z-50 grid place-items-center overscroll-contain bg-[color-mix(in_srgb,var(--n-900)_88%,transparent)] p-4 pt-16"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 bucket의 signed URL */}
      <img src={src} alt="" onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full object-contain" />
      <button
        type="button"
        autoFocus
        aria-label="크게 보기 닫기"
        onClick={onClose}
        className="absolute top-[max(12px,env(safe-area-inset-top))] right-3 grid size-11 cursor-pointer place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Drawer: 오른쪽 패널 + 배경. Esc·배경 클릭으로 닫고, 열려 있는 동안 Tab 초점이 패널 안에서만 돈다.
 * 닫히면 연 자리(표의 제품명 버튼 등)로 초점을 돌려준다.
 * Page: 모바일 상세 페이지용 일반 본문.
 */
function Frame({ variant, onClose, children }: { variant: "drawer" | "page"; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (variant !== "drawer") return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => opener?.focus();
  }, [variant]);

  useEffect(() => {
    if (variant !== "drawer") return;
    const onKey = (e: KeyboardEvent) => {
      // 삭제 확인 Dialog나 사진 크게 보기가 떠 있으면 Esc는 그쪽이 먼저 받는다.
      if (e.key === "Escape" && !document.querySelector('[role="alertdialog"], [data-photo-viewer]')) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [variant, onClose]);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, label[for]")].filter(
      (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (variant === "page") {
    return (
      <main aria-labelledby="drawer-title" className="mx-auto flex min-h-[calc(100dvh-56px)] w-full max-w-140 flex-col bg-bg">
        {children}
      </main>
    );
  }
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-[var(--overlay)]" />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        onKeyDown={trapTab}
        className="relative flex h-full w-[min(560px,100%)] flex-col overflow-y-auto border-l border-divider bg-bg outline-none"
      >
        {children}
      </aside>
    </div>
  );
}

function InfoEditor({
  info,
  setField,
  imageUrl,
  image,
  setImage,
  held,
}: {
  info: InfoDraft;
  setField: <K extends keyof InfoDraft>(key: K, value: InfoDraft[K]) => void;
  imageUrl: string | null;
  image: ImageChange;
  setImage: (value: ImageChange) => void;
  /** 구매 보류 옷: 구매일·시즌 없이 "가격" */
  held: boolean;
}) {
  const text = (key: "brand" | "productName" | "sizeLabel" | "colorName" | "productUrl", label: string, span = false) => (
    <div className={span ? "field col-span-full" : "field"}>
      <label htmlFor={`ie-${key}`}>{label}</label>
      <input id={`ie-${key}`} className="input" value={info[key]} onChange={(e) => setField(key, e.target.value)} />
    </div>
  );

  return (
    <>
      <section className="flex flex-col gap-3.5">
        <SectionTitle>기본 정보 수정</SectionTitle>
        <ImagePicker currentUrl={imageUrl} value={image} onChange={setImage} placeholder="사진 없음" className="w-40" />
        <ShopPhotos productUrl={info.productUrl} value={image} onPick={setImage} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="field">
            <label htmlFor="ie-cat">대분류</label>
            <select
              id="ie-cat"
              className="input"
              value={info.categoryId}
              onChange={(e) => {
                setField("categoryId", e.target.value as CategoryId);
                setField("subcategoryId", "");
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
            <label htmlFor="ie-sub">세부분류</label>
            <select id="ie-sub" className="input" value={info.subcategoryId} onChange={(e) => setField("subcategoryId", e.target.value)}>
              <option value="">선택</option>
              {SUBCATEGORIES.filter((s) => s.categoryId === info.categoryId).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {text("brand", "브랜드")}
          {text("sizeLabel", "표기 사이즈")}
          {text("productName", "제품명", true)}
          {text("colorName", "컬러")}
          {!held && (
            <div className="field">
              <DateLabel htmlFor="ie-date" label="구매일" filled={Boolean(info.purchasedOn)} onClear={() => setField("purchasedOn", "")} />
              <input id="ie-date" type="date" className="input font-mono" value={info.purchasedOn} onChange={(e) => setField("purchasedOn", e.target.value)} />
            </div>
          )}
          <div className={held ? "field col-span-full" : "field"}>
            <label htmlFor="ie-price">{held ? "가격" : "구매가"}</label>
            <PriceInput
              id="ie-price"
              value={info.purchasePrice}
              currency={info.currency}
              onChange={(v) => setField("purchasePrice", v)}
              onCurrencyChange={(c) => setField("currency", c)}
            />
          </div>
          {!held && <div className="field col-span-full">
            <label>시즌</label>
            <div className="seg self-start">
              {SEASONS.map((s) => (
                <label key={s.id} className="seg-opt px-3.5 py-1.5">
                  <input
                    type="checkbox"
                    checked={info.seasons.includes(s.id)}
                    onChange={() =>
                      setField(
                        "seasons",
                        toggleSeason(info.seasons, s.id),
                      )
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>}
          {text("productUrl", "상품 링크", true)}
        </div>
      </section>
      {info.categoryId === "shoes" ? (
        <section className="flex flex-col gap-3.5">
          <SectionTitle>착용감 수정</SectionTitle>
          <ShoeFitPicker idPrefix="ie-shoe" value={info.shoeFit} onChange={(v) => setField("shoeFit", v)} />
        </section>
      ) : (
        <section className="flex flex-col gap-3.5">
          <SectionTitle aside={<span className="text-xs text-neutral-700">{info.categoryId === "hat" ? "cm" : "cm · 단면"}</span>}>실측 수정</SectionTitle>
          <div className={cn("grid gap-3", measureCols(info.categoryId))}>
            {measurementFields(info.categoryId).map((m) => (
              <div key={m.key} className="field">
                <label htmlFor={`ie-m-${m.key}`}>{m.label}</label>
                <UnitInput
                  id={`ie-m-${m.key}`}
                  unit="cm"
                  inputMode="decimal"
                  className="text-body"
                  value={info.measurements[m.key] ?? ""}
                  onChange={(e) => setField("measurements", { ...info.measurements, [m.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="flex flex-col gap-2.5">
        <SectionTitle>{held ? "메모 수정" : "착용 후기 수정"}</SectionTitle>
        <textarea
          className="input text-body leading-relaxed"
          rows={4}
          aria-label={held ? "메모" : "착용 후기"}
          placeholder={held ? "예: 가격이 내려가면 살 생각. 비슷한 옷과 총장 비교해 보기." : "예: 어깨와 가슴은 마음에 드는데 총장이 조금 길다."}
          value={info.fitReview}
          onChange={(e) => setField("fitReview", e.target.value)}
        />
      </section>
    </>
  );
}

/** http·https 주소만 링크로 연다(javascript: 같은 주소는 글자로만 보인다). */
function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
