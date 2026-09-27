import { parseAuthMode } from "@/components/auth/auth-mode";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ServiceIntro } from "@/components/landing/service-intro";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isAuthConfigured, safeNextPath } from "@/lib/supabase/config";
import { AUTH_MESSAGES } from "@/server/auth/messages";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const mode = parseAuthMode(params.mode);
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const notice = params.error === "link" ? AUTH_MESSAGES.expiredLink : undefined;

  return (
    <main className="grid min-h-dvh grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))]">
      <section className="flex flex-col justify-between gap-10 border-neutral-300 p-[clamp(24px,5vw,64px)] md:border-r">
        <ServiceIntro />
      </section>
      <section className="relative flex items-center bg-surface p-[clamp(24px,5vw,64px)]">
        <div className="absolute top-5 right-[clamp(16px,3vw,32px)]">
          <ThemeToggle />
        </div>
        <AuthPanel mode={mode} next={next} notice={notice} configured={isAuthConfigured()} />
      </section>
    </main>
  );
}
