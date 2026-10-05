import "server-only";
import nodemailer from "nodemailer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 새 가입자가 인증을 마치면 관리자에게 알림 메일을 보낸다(가입 시각·이메일·누적 가입자 수만).
 * ADMIN_NOTIFY_EMAIL, NOTIFY_SMTP_USER, NOTIFY_SMTP_PASS 중 하나라도 없으면 조용히 건너뛰고,
 * 어떤 오류도 가입 흐름에 영향을 주지 않는다.
 */
export async function notifyAdminOfSignup(user: { email?: string | null; email_confirmed_at?: string | null }) {
  try {
    const to = process.env.ADMIN_NOTIFY_EMAIL?.trim();
    const smtpUser = process.env.NOTIFY_SMTP_USER?.trim();
    const smtpPass = process.env.NOTIFY_SMTP_PASS?.trim();
    if (!to || !smtpUser || !smtpPass || !user.email) return;

    // 인증 직후(1분 이내)인 가입만 알린다. 로그인 링크 재사용 등은 건너뛴다.
    const confirmedAt = user.email_confirmed_at ? Date.parse(user.email_confirmed_at) : NaN;
    if (!Number.isFinite(confirmedAt) || Math.abs(Date.now() - confirmedAt) > 60_000) return;

    let total: number | null = null;
    const db = createSupabaseAdminClient();
    if (db) {
      const list = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
      if ("total" in list.data && typeof list.data.total === "number") total = list.data.total;
    }

    const when = new Date(confirmedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const transport = nodemailer.createTransport({
      host: process.env.NOTIFY_SMTP_HOST?.trim() || "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transport.sendMail({
      from: `Wardrobe Fit <${smtpUser}>`,
      to,
      subject: "[Wardrobe Fit] 새 가입자가 있습니다",
      text: [`가입 시각: ${when} (KST)`, `가입 이메일: ${user.email}`, `누적 가입자 수: ${total ?? "확인 불가"}명`].join("\n"),
    });
  } catch {
    // 알림 실패는 무시한다.
  }
}
