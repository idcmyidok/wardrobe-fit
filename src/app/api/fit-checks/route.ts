import { fitRequestSchema } from "@/lib/fit/schema";
import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { runFitCheck, type FitStreamEvent } from "@/server/fit/service";

/**
 * POST /api/fit-checks { candidate, importId?, excludedGarmentIds? } → NDJSON(PROJECT_SPEC.md 18.3)
 *   {"type":"computed", ...}  서버 계산(즉시)
 *   {"type":"done", ...}      AI 요약(켜져 있을 때)과 저장 결과
 */
export const maxDuration = 30;

const MAX_BODY = 20_000;

export async function POST(request: Request) {
  const json = (e: FitStreamEvent, status: number) => Response.json(e, { status });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return json({ type: "error", code: "unknown" }, 403);

  const supabase = await createSupabaseServerClient();
  const user = supabase ? await getActiveUser(supabase) : null;
  if (!supabase || !user) return Response.json({ type: "error", code: "signed_out" }, { status: 401 });

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ type: "error", code: "invalid_input" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const parsed = fitRequestSchema.safeParse(body);
  if (!parsed.success) return json({ type: "error", code: "invalid_input" }, 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: FitStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      try {
        await runFitCheck(supabase, user.id, parsed.data, send);
      } catch (e) {
        console.error("[fit-checks]", e instanceof Error ? e.name : "error");
        send({ type: "error", code: "unknown" });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
