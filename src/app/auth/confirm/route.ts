import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * 가입 인증 / 비밀번호 재설정 메일 링크가 도착하는 곳.
 * - token_hash + type: 메일 템플릿을 `/auth/confirm?token_hash=...&type=...`로 바꾼 경우(다른 기기에서 열어도 동작).
 * - code: Supabase 기본 템플릿(PKCE). 요청한 브라우저에서 열어야 한다.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));
  const failed = next === "/auth/update-password" || type === "recovery" ? "/?mode=reset&error=link" : "/?error=link";

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/");

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(type === "recovery" ? "/auth/update-password" : next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect(failed);
}
