"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AuthMode } from "./auth-mode";

const TITLE: Record<AuthMode, string> = {
  signin: "로그인",
  signup: "회원가입",
  reset: "비밀번호 재설정",
  sent: "메일을 확인하세요",
};

/**
 * 로그인 / 회원가입 / 재설정 / 메일 안내를 같은 패널 안에서 `?mode=`로 전환한다.
 * 인증은 3단계에서 연결한다. 지금은 로그인하면 내 옷장으로, 가입·재설정은 메일 안내로 넘어간다.
 */
export function AuthPanel({ mode }: { mode: AuthMode }) {
  const router = useRouter();

  return (
    <div className="flex w-full max-w-95 flex-col gap-5">
      <h2 className="border-b border-text pb-3 text-[25px]">{TITLE[mode]}</h2>

      {mode === "signin" && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/wardrobe");
          }}
        >
          <Field label="이메일" htmlFor="signin-email">
            <Input id="signin-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" defaultValue="minjun.k@gmail.com" />
          </Field>
          <Field label="비밀번호" htmlFor="signin-password">
            <Input id="signin-password" name="password" type="password" autoComplete="current-password" defaultValue="password12" />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-base">
              <input type="checkbox" name="remember" defaultChecked className="size-4 accent-accent" />
              로그인 상태 유지
            </label>
            <Link href="/?mode=reset" className="btn btn-ghost text-sm">
              비밀번호 찾기
            </Link>
          </div>
          <button type="submit" className="btn btn-primary mt-1 min-h-11 w-full justify-start">
            로그인
          </button>
          <SwitchLine text="계정이 없으신가요?" href="/?mode=signup" label="회원가입" />
        </form>
      )}

      {mode === "signup" && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/?mode=sent");
          }}
        >
          <Field label="이메일" htmlFor="signup-email">
            <Input id="signup-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" />
          </Field>
          <Field label="비밀번호" htmlFor="signup-password">
            <Input id="signup-password" name="password" type="password" autoComplete="new-password" placeholder="8자 이상" />
          </Field>
          <Field label="비밀번호 확인" htmlFor="signup-password-confirm">
            <Input id="signup-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" />
          </Field>
          <button type="submit" className="btn btn-primary min-h-11 w-full justify-start">
            가입하고 인증 메일 받기
          </button>
          <SwitchLine text="이미 계정이 있으신가요?" href="/" label="로그인" />
        </form>
      )}

      {mode === "reset" && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/?mode=sent");
          }}
        >
          <p className="text-base text-neutral-700">가입한 이메일로 재설정 링크를 보냅니다.</p>
          <Field label="이메일" htmlFor="reset-email">
            <Input id="reset-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" />
          </Field>
          <button type="submit" className="btn btn-primary min-h-11 w-full justify-start">
            재설정 링크 보내기
          </button>
          <BackLine />
        </form>
      )}

      {mode === "sent" && (
        <>
          <p className="text-body text-pretty">
            입력한 주소로 계정이 있다면 안내 메일을 보냈습니다. 메일의 링크를 열면 다음 단계로 이어집니다.
          </p>
          <BackLine />
        </>
      )}
    </div>
  );
}

function SwitchLine({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-divider pt-4 text-base text-neutral-700">
      {text}
      <Link href={href} className="btn btn-ghost">
        {label}
      </Link>
    </div>
  );
}

function BackLine() {
  return (
    <div className="border-t border-divider pt-4">
      <Link href="/" className="btn btn-ghost">
        ← 로그인으로
      </Link>
    </div>
  );
}
