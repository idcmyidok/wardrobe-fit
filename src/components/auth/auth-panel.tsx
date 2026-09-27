import Link from "next/link";
import type { AuthMode } from "./auth-mode";
import { ResetRequestForm } from "./reset-request-form";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";

const COPY: Record<AuthMode, { title: string; description: string }> = {
  signin: { title: "로그인", description: "내 옷장으로 이동합니다." },
  signup: { title: "회원가입", description: "이메일로 계정을 만듭니다." },
  reset: { title: "비밀번호 재설정", description: "재설정 링크를 받을 이메일을 입력해 주세요." },
};

/** 로그인 / 회원가입 / 재설정을 같은 패널 안에서 `?mode=`로 전환한다. */
export function AuthPanel({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode];

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg text-text">{copy.title}</h2>
        <p className="text-sm text-text-muted">{copy.description}</p>
      </div>

      {mode === "signin" && <SignInForm key="signin" />}
      {mode === "signup" && <SignUpForm key="signup" />}
      {mode === "reset" && <ResetRequestForm key="reset" />}

      <p className="border-t border-border pt-5 text-sm text-text-muted">
        {mode === "signin" ? (
          <>
            계정이 없으신가요?{" "}
            <Link href="/?mode=signup" className="font-medium text-accent hover:underline">
              회원가입
            </Link>
          </>
        ) : (
          <>
            {mode === "signup" ? "이미 계정이 있으신가요? " : "비밀번호가 기억나셨나요? "}
            <Link href="/" className="font-medium text-accent hover:underline">
              로그인
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
