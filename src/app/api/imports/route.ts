import { createSupabaseServerClient, getActiveUser } from "@/lib/supabase/server";
import { runImport } from "@/server/import/service";

/**
 * POST /api/imports { url, purpose?, photosOnly? } → NDJSON 스트림(PROJECT_SPEC.md 12.2)
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
  const user = supabase ? await getActiveUser(supabase) : null;
  if (!supabase || !user) return Response.json({ type: "result", status: "failed", errorCode: "signed_out" }, { status: 401 });

  let body: { url?: unknown; purpose?: unknown; photosOnly?: unknown; html?: unknown; json?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const url = typeof body.url === "string" ? body.url : "";
  const purpose = body.purpose === "fit_check" ? "fit_check" : "wardrobe";

  // 무신사처럼 서버 요청을 막는 곳은 사용자 브라우저가 읽어 보낸 페이지를 쓴다(북마크 버튼).
  const prefetched =
    typeof body.html === "string" && body.html.length <= 3_500_000
      ? {
          html: body.html,
          json: Object.fromEntries(
            Object.entries(typeof body.json === "object" && body.json ? body.json : {})
              .filter(([k, v]) => typeof v === "string" && v.length <= 1_000_000 && k.length <= 500)
              .slice(0, 8),
          ) as Record<string, string>,
        }
      : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      const outcome = await runImport(supabase, user.id, url, purpose, (stage) => send({ type: "stage", stage }), {
        photosOnly: body.photosOnly === true,
        prefetched,
      });
      send({ type: "result", ...outcome });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
