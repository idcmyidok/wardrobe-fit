import { AppHeader } from "@/components/layout/app-header";

/** 로그인 후 화면 공통 레이아웃. 3단계에서 인증 확인을 추가한다. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-8 sm:px-8">{children}</main>
    </>
  );
}
