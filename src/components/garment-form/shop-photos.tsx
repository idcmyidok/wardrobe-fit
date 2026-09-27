"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageChange } from "@/components/wardrobe/wardrobe-store";
import { importImageFile, importImageUrl, streamImport } from "@/lib/import/client";
import { importFailure } from "@/lib/import/messages";
import { PageImageGrid } from "./page-image-grid";

/**
 * 옷 정보 사진 수정의 "쇼핑몰 사진 불러오기": 저장된 상품 링크를 다시 분석해 사진 목록만 보여주고, 고른 사진을 새 사진으로 넘긴다.
 * 링크 분석 한 번으로 센다(하루 한도 포함, 10분 안의 같은 링크는 이전 결과를 다시 쓴다). 실측 AI 추출은 하지 않는다.
 */
export function ShopPhotos({ productUrl, value, onPick }: { productUrl: string; value: ImageChange; onPick: (file: File) => void }) {
  const [state, setState] = useState<{ loading: boolean; importId: string | null; count: number; message: string | null }>({
    loading: false,
    importId: null,
    count: 0,
    message: null,
  });
  const [bad, setBad] = useState<number[]>([]);
  const [picked, setPicked] = useState<{ i: number; file: File } | null>(null);
  const [fetching, setFetching] = useState<number | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const url = productUrl.trim();
  const load = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ loading: true, importId: null, count: 0, message: null });
    setBad([]);
    setPicked(null);
    try {
      const outcome = await streamImport(url, { signal: controller.signal, photosOnly: true });
      if (controller.signal.aborted) return;
      const count = outcome.product?.imageUrls.length ?? 0;
      if (outcome.status === "failed" || !outcome.importId) {
        setState({ loading: false, importId: null, count: 0, message: importFailure(outcome.errorCode).title });
      } else {
        setState({ loading: false, importId: outcome.importId, count, message: count ? null : "이 페이지에서 사진을 찾지 못했습니다." });
      }
    } catch {
      if (!controller.signal.aborted) setState({ loading: false, importId: null, count: 0, message: importFailure("network_error").title });
    }
  };

  const importId = state.importId;
  const images = importId
    ? Array.from({ length: state.count }, (_, i) => ({ src: importImageUrl(importId, i), i })).filter(({ i }) => !bad.includes(i))
    : [];
  const noneLeft = importId && state.count > 0 && images.length === 0;

  const pick = async (i: number) => {
    if (!importId || fetching != null) return;
    setFetching(i);
    const file = await importImageFile(importImageUrl(importId, i));
    setFetching(null);
    if (!file) {
      setBad((b) => [...b, i]);
      return;
    }
    setPicked({ i, file });
    onPick(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary text-sm" disabled={!url || state.loading} onClick={load}>
          {state.loading ? "불러오는 중…" : "쇼핑몰 사진 불러오기"}
        </button>
        {!url && <span className="text-label text-neutral-700">상품 링크가 있어야 불러올 수 있습니다</span>}
        {fetching != null && <span className="text-label text-neutral-700">사진 받는 중…</span>}
      </div>
      {(state.message || noneLeft) && (
        <p role="status" className="text-sm text-neutral-700">
          {state.message ?? "이 페이지에서 쓸 수 있는 사진을 찾지 못했습니다."}
        </p>
      )}
      <PageImageGrid
        images={images}
        selected={picked && value === picked.file ? picked.i : -1}
        onSelect={pick}
        onBroken={(i) => setBad((b) => (b.includes(i) ? b : [...b, i]))}
      />
    </div>
  );
}
