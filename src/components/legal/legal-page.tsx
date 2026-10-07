import Link from "next/link";
import { SiteFooter } from "./site-footer";

/** 개인정보처리방침·이용약관 공통 틀. 로그인하지 않아도 볼 수 있다. */
export function LegalPage({ title, effectiveDate, children }: { title: string; effectiveDate: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-190 flex-1 px-[clamp(16px,3vw,32px)] pt-6 pb-10">
        <Link href="/" className="btn btn-ghost mb-2 text-sm">
          ← 처음으로
        </Link>
        <div className="flex flex-col gap-1.5 border-b border-divider pb-4">
          <h1 className="text-title">{title}</h1>
          <p className="text-sm text-neutral-700">시행일 {effectiveDate}</p>
        </div>
        <div className="legal flex flex-col gap-8 py-7 text-base leading-relaxed text-neutral-800">{children}</div>
      </main>
      <SiteFooter className="mx-auto w-full max-w-190 border-t border-neutral-300 px-[clamp(16px,3vw,32px)] py-5" />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-md font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
