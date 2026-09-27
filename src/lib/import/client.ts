import type { ImportOutcome } from "@/server/import/service";
import type { AnalyzeStage } from "@/server/import/analyze";

export type { ImportOutcome, AnalyzeStage };

/** POST /api/imports를 부르고 NDJSON 진행 단계를 받는다. 마지막 줄이 결과다. */
export async function streamImport(
  url: string,
  { signal, onStage }: { signal?: AbortSignal; onStage?: (stage: AnalyzeStage) => void } = {},
): Promise<ImportOutcome> {
  const failed = (errorCode: ImportOutcome["errorCode"], errorDetail: string | null = null): ImportOutcome => ({
    importId: null,
    status: "failed",
    reused: false,
    domain: null,
    sourceUrl: url,
    parserId: null,
    durationMs: 0,
    product: null,
    errorCode,
    errorDetail,
  });

  const res = await fetch("/api/imports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, purpose: "wardrobe" }),
    signal,
  });
  if (res.status === 401) return failed("signed_out");
  if (!res.ok || !res.body) return failed("unknown", `HTTP ${res.status}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let result: ImportOutcome | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as { type: "stage"; stage: AnalyzeStage } | ({ type: "result" } & ImportOutcome);
      if (msg.type === "stage") onStage?.(msg.stage);
      else result = msg;
    }
    if (done) break;
  }
  return result ?? failed("unknown", "응답이 중간에 끊겼습니다");
}

/** 분석 결과의 i번째 이미지 미리보기 주소(서버가 대신 받아 준다) */
export const importImageUrl = (importId: string, index: number) => `/api/imports/${importId}/image?i=${index}`;
