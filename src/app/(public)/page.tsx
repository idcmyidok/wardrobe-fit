import { parseAuthMode } from "@/components/auth/auth-mode";
import { AuthPanel } from "@/components/auth/auth-panel";
import { PromoBanner } from "@/components/landing/promo-banner";
import { ServiceIntro } from "@/components/landing/service-intro";
import { SiteFooter } from "@/components/legal/site-footer";
import { cookies } from "next/headers";
import { isAuthConfigured, LAST_EMAIL_COOKIE, safeNextPath } from "@/lib/supabase/config";
import { AUTH_MESSAGES } from "@/server/auth/messages";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const mode = parseAuthMode(params.mode);
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const notice =
    params.error === "link"
      ? AUTH_MESSAGES.expiredLink
      : params.error === "suspended"
        ? AUTH_MESSAGES.suspended
        : params.deleted === "1"
          ? AUTH_MESSAGES.deleted
          : undefined;
  const savedEmail = (await cookies()).get(LAST_EMAIL_COOKIE)?.value;

  return (
    <main className="grid min-h-dvh grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))]">
      {/* 한 줄로 쌓이는 좁은 화면(두 칸 440px 미만)에서는 로그인 패널이 먼저 온다(PROJECT_SPEC.md 5.1).
          HTML에서도 먼저 둬야 느린 회선에서 소개가 먼저 그려졌다가 아래로 밀려나지 않는다. 넓은 화면에서만 오른쪽으로 보낸다. */}
      <section className="relative flex items-center p-[clamp(24px,5vw,64px)] min-[880px]:order-last">
        <div className="glass mx-auto flex w-full max-w-130 flex-col gap-8 rounded-lg p-[clamp(20px,4vw,40px)]">
          <AuthPanel mode={mode} next={next} notice={notice} savedEmail={savedEmail} configured={isAuthConfigured()} />
          {(mode === "signin" || mode === "signup") && <PromoBanner />}
        </div>
      </section>
      <section className="flex flex-col justify-between gap-10 border-neutral-300 p-[clamp(24px,5vw,64px)] md:border-r">
        <ServiceIntro />
        <SiteFooter />
      </section>
    </main>
  );
}
