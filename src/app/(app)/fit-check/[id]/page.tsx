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
    .select("candidate, computed, interpretation, ai_model, error_code, created_at")
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

  return <FitResultView candidate={candidate.data} computed={computed} interpretation={interpretation} aiStatus={aiStatus} createdAt={data.created_at} />;
}
