import type { FitErrorCode, FitStreamEvent } from "@/server/fit/service";
import type { FitRequest } from "./schema";
import type { FitComputed } from "./types";

export type FitDone = Extract<FitStreamEvent, { type: "done" }>;
export type FitClientError = FitErrorCode | "signed_out" | "network_error";

export const FIT_ERROR_TEXT: Record<FitClientError, string> = {
  rate_limited: "오늘 판단 횟수(20회)를 모두 썼습니다. 내일 다시 시도해 주세요.",
  invalid_input: "입력값을 확인해 주세요. 실측은 0~200cm 숫자만, 사이즈는 3개까지 고를 수 있습니다.",
  save_failed: "결과를 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
  unknown: "판단하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
  signed_out: "로그인이 풀렸습니다. 다시 로그인해 주세요.",
  network_error: "연결이 불안정합니다. 입력한 내용은 유지됩니다.",
};

/**
 * POST /api/fit-checks를 부르고 NDJSON을 읽는다. 계산 결과(computed)가 오면 바로 화면에 넘기고,
 * AI 요약과 저장이 끝난 done을 돌려준다.
 */
export async function streamFitCheck(
  body: { candidate: FitRequest["candidate"]; importId?: string | null; excludedGarmentIds?: string[] },
  { onComputed, signal }: { onComputed: (e: { id: string; computed: FitComputed; aiEnabled: boolean }) => void; signal?: AbortSignal },
): Promise<{ ok: true; done: FitDone } | { ok: false; error: FitClientError }> {
  let res: Response;
  try {
    res = await fetch("/api/fit-checks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch {
    return { ok: false, error: "network_error" };
  }
  if (res.status === 401) return { ok: false, error: "signed_out" };
  if (!res.body) return { ok: false, error: "unknown" };
  if (!res.ok) {
    const e = (await res.json().catch(() => null)) as { code?: FitClientError } | null;
    return { ok: false, error: e?.code ?? "unknown" };
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line) as FitStreamEvent;
        if (msg.type === "computed") onComputed(msg);
        else if (msg.type === "done") return { ok: true, done: msg };
        else return { ok: false, error: msg.code };
      }
      if (done) break;
    }
  } catch {
    return { ok: false, error: "network_error" };
  }
  return { ok: false, error: "network_error" };
}
