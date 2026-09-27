import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runImport } from "@/server/import/service";

/**
 * POST /api/imports { url, purpose? } → NDJSON 스트림(PROJECT_SPEC.md 12.2)
 *   {"type":"stage","stage":"fetching"} … {"type":"result", ...ImportOutcome}
 * 전체 20초 안에 끝나도록 fetcher가 10초에서 끊는다.
 */
export const maxDuration = 20;

export async function POST(request: Request) {
  // 다른 사이트가 사용자 쿠키로 이 API를 부르지 못하게 같은 출처 요청만 받는다.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return Response.json({ type: "result", status: "failed", errorCode: "unknown" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return Response.json({ type: "result", status: "failed", errorCode: "signed_out" }, { status: 401 });

  let body: { url?: unknown; purpose?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const url = typeof body.url === "string" ? body.url : "";
  const purpose = body.purpose === "fit_check" ? "fit_check" : "wardrobe";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      const outcome = await runImport(supabase, user.id, url, purpose, (stage) => send({ type: "stage", stage }));
      send({ type: "result", ...outcome });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
