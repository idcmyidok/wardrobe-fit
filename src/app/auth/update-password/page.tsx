import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isAuthConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "새 비밀번호 · Wardrobe Fit" };

/** 재설정 메일 링크로 로그인된 상태에서 새 비밀번호를 정한다. */
export default async function UpdatePasswordPage() {
  if (!isAuthConfigured()) redirect("/");
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=reset&error=link");

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-surface p-[clamp(24px,5vw,64px)]">
      <div className="absolute top-5 right-[clamp(16px,3vw,32px)]">
        <ThemeToggle />
      </div>
      <UpdatePasswordForm email={user.email ?? ""} />
    </main>
  );
}
