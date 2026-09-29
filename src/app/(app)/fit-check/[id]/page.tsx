import { notFound } from "next/navigation";
import { z } from "zod";
import { FitResultView, type ResultAiStatus } from "@/components/fit-check/fit-result-view";
import { fitCandidateSchema } from "@/lib/fit/schema";
import type { FitComputed, FitInterpretation } from "@/lib/fit/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "구매 판단 결과 · Wardrobe Fit" };

/** 저장한 구매 판단 결과(PROJECT_SPEC.md 5.5 Step 4 `/fit-check/[id]`). RLS로 본인 기록만 읽힌다. */
export default async function FitCheckResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data } = await supabase
    .from("fit_checks")
    .select("candidate, computed, interpretation, ai_model, error_code, created_at, import_id")
    .eq("id", id)
    .maybeSingle();
  const candidate = fitCandidateSchema.safeParse(data?.candidate);
  const computed = data?.computed as FitComputed | null | undefined;
  if (!data || !candidate.success || computed?.version !== 1 || !Array.isArray(computed.sizes) || !computed.sizes.length) notFound();

  const interpretation = data.interpretation as FitInterpretation | null;
  const aiStatus: ResultAiStatus = interpretation
    ? data.ai_model?.endsWith(":cache")
      ? "cached"
      : "ok"
    : data.error_code === "ai_failed"
      ? "failed"
      : data.error_code === "ai_limited"
        ? "limited"
        : "disabled";

  // 링크로 판단한 옷이면 그 분석 기록에서 링크·판매가를 읽는다(구매 보류 옷에 담을 때 쓴다).
  let productUrl: string | null = null;
  let price: { value: number; currency: "KRW" | "USD" } | null = null;
  if (data.import_id) {
    const { data: imp } = await supabase.from("product_imports").select("source_url, result").eq("id", data.import_id).maybeSingle();
    const product = imp?.result as { price?: { value?: unknown } | null; priceCurrency?: unknown } | null | undefined;
    productUrl = imp?.source_url ?? null;
    const value = product?.price?.value;
    if (typeof value === "number") price = { value, currency: product?.priceCurrency === "USD" ? "USD" : "KRW" };
  }

  return (
    <FitResultView
      candidate={candidate.data}
      computed={computed}
      interpretation={interpretation}
      aiStatus={aiStatus}
      createdAt={data.created_at}
      fitCheckId={id}
      importId={data.import_id}
      productUrl={productUrl}
      price={price}
    />
  );
}
