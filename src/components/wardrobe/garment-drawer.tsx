"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImagePicker } from "@/components/garment-form/image-picker";
import { ShopPhotos } from "@/components/garment-form/shop-photos";
import { UnitInput } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { CATEGORY_NAME, SUBCATEGORIES, SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { formatCm, measurementFields } from "@/lib/constants/measurements";
import { SEASONS, SEASON_NAME, toggleSeason } from "@/lib/constants/seasons";
import { formatDate } from "@/lib/format/date";
import { formatPrice } from "@/lib/format/price";
import type { CategoryId, Garment, Measurements, Season } from "@/lib/types/domain";
import { useOpenGarmentId, useWardrobe, type ImageChange } from "./wardrobe-store";

/** Drawer 안 소제목. 시안의 모노 라벨 + 잉크 밑줄 */
function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between border-b border-text pb-2">
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
  productUrl: string;
  seasons: Season[];
  measurements: Record<string, string>;
  fitReview: string;
}

const toDraft = (g: Garment): InfoDraft => ({
  categoryId: g.categoryId,
  subcategoryId: g.subcategoryId ?? "",
  brand: g.brand,
  productName: g.productName,
  sizeLabel: g.sizeLabel ?? "",
  colorName: g.colorName ?? "",
  purchasedOn: g.purchasedOn ?? "",
  purchasePrice: g.purchasePrice == null ? "" : String(g.purchasePrice),
  productUrl: g.productUrl ?? "",
  seasons: g.seasons.slice(),
  measurements: Object.fromEntries(Object.entries(g.measurements).map(([k, v]) => [k, v == null ? "" : String(v)])),
  fitReview: g.fitReview ?? "",
});

/**
 * 옷 정보 Drawer: 상세 보기, 기본 정보·실측·후기 수정, 삭제(확인 Dialog + 실행 취소).
 * 주소의 ?item={id}로 열리고 닫힌다. useSearchParams를 쓰므로 Suspense 안에 둔다.
 */
export function GarmentDrawer() {
  const { garments, closeDrawer } = useWardrobe();
  const id = useOpenGarmentId();
  const garment = garments.find((g) => g.id === id);
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
  const { updateGarment, removeGarment, showToast } = useWardrobe();
  const router = useRouter();
  const [info, setInfo] = useState<InfoDraft | null>(null);
  const [reviewDraft, setReviewDraft] = useState<string | null>(null);
  const [image, setImage] = useState<ImageChange>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    const price = info.purchasePrice.replace(/\D/g, "");
    setSaving(true);
    setError(null);
    const result = await updateGarment(g.id, {
      categoryId: info.categoryId,
      subcategoryId: info.subcategoryId || null,
      brand: info.brand.trim(),
      productName: info.productName.trim(),
      sizeLabel: info.sizeLabel || null,
      colorName: info.colorName || null,
      purchasedOn: info.purchasedOn || null,
      purchasePrice: price ? Number(price) : null,
      productUrl: info.productUrl || null,
      seasons: info.seasons,
      measurements,
      fitReview: info.fitReview.trim() || null,
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
    showToast("착용 후기를 저장했습니다");
  };

  const details: [string, string][] = [
    ["시즌", g.seasons.map((s) => SEASON_NAME[s]).join(" · ") || "—"],
    ["구매일", formatDate(g.purchasedOn)],
    ["구매가", formatPrice(g.purchasePrice)],
    ["상품 링크", g.productUrl || "—"],
  ];

  return (
    <>
      <Frame variant={variant} onClose={onClose}>
          <div className={cn("flex items-start justify-between border-b border-text bg-bg px-6 py-3", variant === "drawer" && "sticky top-0 z-1")}>
            <div className="flex items-baseline gap-2.5">
              <span id="drawer-title" className="text-body font-semibold">
                옷 정보
              </span>
              <span className="text-sm text-neutral-700">
                {CATEGORY_NAME[g.categoryId]} / {g.subcategoryId ? SUBCATEGORY_NAME[g.subcategoryId] : "—"}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button type="button" className="btn btn-icon" aria-label={variant === "drawer" ? "닫기" : "내 옷장으로"} onClick={onClose}>
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
                    <div className="aspect-[4/5] w-full bg-neutral-200">
                      {/* 불러오지 못하면(서명 주소 만료 등) 깨진 그림 대신 빈 자리만 남긴다. */}
                      {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 bucket의 signed URL */}
                      <img src={g.imageUrl} alt="" onError={(e) => (e.currentTarget.style.opacity = "0")} className="size-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-[4/5] bg-neutral-200" />
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
                <section>
                  <SectionTitle aside={<span className="text-xs text-neutral-700">cm · 단면</span>}>실측</SectionTitle>
                  <div className={g.categoryId === "bottom" ? "grid grid-cols-3" : "grid grid-cols-2"}>
                    {measurementFields(g.categoryId).map((m) => (
                      <div key={m.key} className="flex flex-col gap-0.5 border-b border-neutral-300 py-2.5">
                        <span className="text-xs text-neutral-700">{m.label}</span>
                        <span className="font-mono text-lg font-semibold tabular-nums">{formatCm(g.measurements[m.key])}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <InfoEditor info={info} setField={setField} imageUrl={g.imageUrl} image={image} setImage={setImage} />
            )}

            <section>
              <SectionTitle
                aside={
                  reviewDraft == null && !info ? (
                    <button type="button" className="btn btn-ghost text-sm" onClick={() => setReviewDraft(g.fitReview ?? "")}>
                      {g.fitReview ? "후기 수정" : "후기 쓰기"}
                    </button>
                  ) : undefined
                }
              >
                착용 후기
              </SectionTitle>
              {reviewDraft == null ? (
                g.fitReview ? (
                  <p className="text-md leading-[1.7] text-pretty">{g.fitReview}</p>
                ) : (
                  <p className="text-base text-neutral-700">
                    아직 후기가 없습니다. 입어본 느낌을 한두 줄 남기면 구매 판단의 근거로 쓰입니다.
                  </p>
                )
              ) : (
                <>
                  <textarea
                    className="input text-body leading-relaxed"
                    rows={4}
                    aria-label="착용 후기"
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

          <div className="sticky bottom-0 flex gap-2 border-t border-text bg-bg px-6 py-3">
            {!info ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => router.push("/fit-check")}>
                  이 옷 기준으로 판단
                </button>
                <button type="button" className="btn btn-ghost ml-auto" onClick={() => setConfirmDelete(true)}>
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

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--n-900)_50%,transparent)] p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onKeyDown={(e) => e.key === "Escape" && setConfirmDelete(false)}
            className="flex w-[min(440px,100%)] flex-col gap-3 rounded-lg border border-text bg-bg p-4">
            <div id="delete-title" className="text-lg font-semibold">
              이 옷을 삭제할까요?
            </div>
            <div className="text-base text-neutral-800">
              {[g.brand, g.productName].filter(Boolean).join(" ")}의 실측과 착용 후기가 함께 삭제됩니다. 5초 안에는 실행 취소할 수 있습니다.
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" autoFocus onClick={() => setConfirmDelete(false)}>
                취소
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  setConfirmDelete(false);
                  if ((await removeGarment(g.id)) && variant === "page") router.replace("/wardrobe");
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
      // 삭제 확인 Dialog가 떠 있으면 Esc는 그 Dialog가 먼저 받는다.
      if (e.key === "Escape" && !document.querySelector('[role="alertdialog"]')) onClose();
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
        className="relative flex h-full w-[min(560px,100%)] flex-col overflow-y-auto border-l border-text bg-bg outline-none"
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
}: {
  info: InfoDraft;
  setField: <K extends keyof InfoDraft>(key: K, value: InfoDraft[K]) => void;
  imageUrl: string | null;
  image: ImageChange;
  setImage: (value: ImageChange) => void;
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
              <option value="outer">아우터</option>
              <option value="top">상의</option>
              <option value="bottom">하의</option>
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
          <div className="field">
            <label htmlFor="ie-date">구매일</label>
            <input id="ie-date" type="date" className="input font-mono" value={info.purchasedOn} onChange={(e) => setField("purchasedOn", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ie-price">구매가</label>
            <UnitInput id="ie-price" unit="원" inputMode="numeric" value={info.purchasePrice} onChange={(e) => setField("purchasePrice", e.target.value)} />
          </div>
          <div className="field col-span-full">
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
          </div>
          {text("productUrl", "상품 링크", true)}
        </div>
      </section>
      <section className="flex flex-col gap-3.5">
        <SectionTitle aside={<span className="text-xs text-neutral-700">cm · 단면</span>}>실측 수정</SectionTitle>
        <div className={info.categoryId === "bottom" ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
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
      <section className="flex flex-col gap-2.5">
        <SectionTitle>착용 후기 수정</SectionTitle>
        <textarea
          className="input text-body leading-relaxed"
          rows={4}
          aria-label="착용 후기"
          placeholder="예: 어깨와 가슴은 마음에 드는데 총장이 조금 길다."
          value={info.fitReview}
          onChange={(e) => setField("fitReview", e.target.value)}
        />
      </section>
    </>
  );
}
