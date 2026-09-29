"use client";

import { useState } from "react";
import { useWardrobe, type GarmentDraft } from "@/components/wardrobe/wardrobe-store";
import { importImageFile, importImageUrl } from "@/lib/import/client";

export type HeldDraft = Pick<GarmentDraft, "categoryId" | "subcategoryId" | "brand" | "productName" | "sizeLabel" | "productUrl" | "measurements"> &
  Partial<Pick<GarmentDraft, "purchasePrice" | "currency" | "fitCheckId">>;

/**
 * 구매 판단 결과·VS 비교에서 "구매 보류 옷에 추가". 폼 없이 바로 저장하고, 링크로 분석한 옷이면 첫 상품 사진을 함께 올린다.
 * 같은 링크·같은 사이즈가 이미 보류 목록에 있으면 다시 담지 않는다.
 */
export function useAddHeld() {
  const { addGarment, heldGarments, showToast } = useWardrobe();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const isHeld = (d: Pick<HeldDraft, "productUrl" | "sizeLabel" | "brand" | "productName">) =>
    heldGarments.some((g) =>
      d.productUrl
        ? g.productUrl === d.productUrl && (g.sizeLabel ?? "") === (d.sizeLabel ?? "")
        : g.brand === d.brand && g.productName === d.productName && (g.sizeLabel ?? "") === (d.sizeLabel ?? ""),
    );

  const addHeld = async (key: string, d: HeldDraft, importId: string | null) => {
    if (busyKey) return;
    if (isHeld(d)) {
      showToast("이미 구매 보류 옷에 있어요");
      return;
    }
    setBusyKey(key);
    const image = importId ? await importImageFile(importImageUrl(importId, 0)) : undefined;
    const result = await addGarment(
      {
        categoryId: d.categoryId,
        subcategoryId: d.subcategoryId,
        brand: d.brand,
        productName: d.productName || "이름 없는 옷",
        sizeLabel: d.sizeLabel,
        colorName: null,
        seasons: [],
        purchasedOn: null,
        purchasePrice: d.purchasePrice ?? null,
        currency: d.currency ?? "KRW",
        productUrl: d.productUrl,
        imageUrl: null,
        measurements: d.measurements,
        fitReview: null,
        shoeFit: null,
        userFit: null,
        held: true,
        fitCheckId: d.fitCheckId ?? null,
      },
      image,
      importId,
    );
    setBusyKey(null);
    showToast(result.ok ? (result.warning ?? "구매 보류 옷에 추가했어요 · 구매 판단기 아래에서 볼 수 있어요") : result.error);
  };

  return { addHeld, isHeld, busyKey };
}
