import Link from "next/link";
import { parseAuthMode } from "@/components/auth/auth-mode";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ServiceIntro } from "@/components/landing/service-intro";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mode = parseAuthMode((await searchParams).mode);

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="order-2 flex items-center px-4 py-12 sm:px-8 lg:order-1 lg:px-16 lg:py-16">
        <ServiceIntro />
      </section>

      <section className="order-1 flex flex-col items-center justify-center gap-8 border-b border-border bg-surface px-4 py-12 sm:px-8 lg:order-2 lg:border-b-0 lg:border-l lg:px-16">
        <AuthPanel mode={mode} />
        {/* 인증 연결 전 개발 확인용 진입점. 3단계에서 제거한다. */}
        <Link href="/wardrobe" className="text-xs text-text-muted underline decoration-border-strong underline-offset-4 hover:text-text">
          개발 확인용: 내 옷장 화면 보기
        </Link>
      </section>
    </main>
  );
}
