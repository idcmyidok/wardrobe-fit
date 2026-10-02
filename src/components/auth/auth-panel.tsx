"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, signIn, signUp, type AuthFormState } from "@/server/auth/actions";
import type { AuthMode } from "./auth-mode";
import { HelpPopup } from "./help-popup";

const TITLE: Record<AuthMode, string> = {
  signin: "로그인",
  signup: "회원가입",
  reset: "비밀번호 재설정",
  sent: "메일을 확인하세요",
};

/**
 * 로그인 / 회원가입 / 재설정 / 메일 안내를 같은 패널 안에서 `?mode=`로 전환한다.
 * 실제 처리는 Server Action(`server/auth/actions.ts`)이 한다.
 */
export function AuthPanel({
  mode,
  next,
  notice,
  savedEmail,
  configured,
}: {
  mode: AuthMode;
  /** 로그인 후 돌아갈 경로(보호 경로에서 튕겨 온 경우) */
  next?: string;
  notice?: string;
  /** 이 기기에서 마지막으로 로그인한 이메일(상태 유지를 고른 경우) */
  savedEmail?: string;
  /** Supabase 키가 없으면 미리보기 안내를 보여준다. */
  configured: boolean;
}) {
  return (
    <div className="flex w-full max-w-95 flex-col gap-5">
      {mode === "signin" && (
        <HelpPopup label="비밀번호 입력 시 사기 사이트라고 뜨는 문제">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/dolphin.jpg" alt="" className="w-full" />
          <p>
            만든 지 얼마 안 된 소규모 사이트라서 구글이 위험 사이트로 판단하는 경우가 있어요.
            아이디·비밀번호·개인정보는 모두 암호화해서 저장하니 안심해 주세요.
          </p>
        </HelpPopup>
      )}
      {mode === "signup" && (
        <HelpPopup label="인증 메일이 안 와요">
          <p>인증 메일이 보이지 않으면 스팸메일함을 확인해 주세요.</p>
        </HelpPopup>
      )}
      <h2 className="border-b border-text pb-3 text-[25px]">{TITLE[mode]}</h2>

      {!configured && <PreviewNotice />}
      {notice && <FormMessage message={notice} />}

      {mode === "signin" && <SignInForm next={next} savedEmail={savedEmail} />}
      {mode === "signup" && <SignUpForm />}
      {mode === "reset" && <ResetForm />}
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

function SignInForm({ next, savedEmail }: { next?: string; savedEmail?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage message={state.error} />
      <Field label="이메일" htmlFor="signin-email" error={state.fieldErrors?.email}>
        <Input id="signin-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" defaultValue={state.email ?? savedEmail} required />
      </Field>
      <Field label="비밀번호" htmlFor="signin-password" error={state.fieldErrors?.password}>
        <Input id="signin-password" name="password" type="password" autoComplete="current-password" required />
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
      <SubmitButton label="로그인" pendingLabel="로그인하는 중…" className="mt-1" />
      <SwitchLine text="계정이 없으신가요?" href="/?mode=signup" label="회원가입" />
    </form>
  );
}

function SignUpForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage message={state.error} />
      <Field label="이메일" htmlFor="signup-email" error={state.fieldErrors?.email}>
        <Input id="signup-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" defaultValue={state.email} required />
      </Field>
      <Field label="비밀번호" htmlFor="signup-password" error={state.fieldErrors?.password}>
        <Input id="signup-password" name="password" type="password" autoComplete="new-password" placeholder="8자 이상" minLength={8} required />
      </Field>
      <Field label="비밀번호 확인" htmlFor="signup-password-confirm" error={state.fieldErrors?.passwordConfirm}>
        <Input id="signup-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" required />
      </Field>
      <SignUpNotice errors={state.fieldErrors} />
      <SubmitButton label="가입하고 인증 메일 받기" pendingLabel="메일 보내는 중…" />
      <SwitchLine text="이미 계정이 있으신가요?" href="/" label="로그인" />
    </form>
  );
}

/**
 * 가입 동의(개인정보 보호법 제15조·제22조). 만 14세 미만은 법정대리인 동의가 필요해 받지 않으므로
 * 나이는 본인 확인 체크로 받는다. 약관·처리방침은 새 탭에서, 수집 항목은 펼쳐서 볼 수 있다.
 */
const CONSENTS = [
  { name: "age", label: "만 14세 이상입니다" },
  { name: "terms", label: "이용약관에 동의합니다", href: "/terms" },
  { name: "privacy", label: "개인정보 수집·이용에 동의합니다", href: "/privacy" },
] as const;

function SignUpNotice({ errors }: { errors?: Record<string, string> }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const all = CONSENTS.every((c) => checked[c.name]);
  const error = CONSENTS.map((c) => errors?.[c.name]).find(Boolean);
  return (
    <div className="flex flex-col gap-2.5 border border-neutral-300 p-3.5 text-base">
      <label className="flex cursor-pointer items-center gap-2 border-b border-neutral-300 pb-2.5 font-medium">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => setChecked(Object.fromEntries(CONSENTS.map((c) => [c.name, e.target.checked])))}
          className="size-4 shrink-0 accent-accent"
        />
        모두 동의
      </label>
      {CONSENTS.map((c) => (
        <div key={c.name} className="flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name={c.name}
              checked={Boolean(checked[c.name])}
              onChange={(e) => setChecked((v) => ({ ...v, [c.name]: e.target.checked }))}
              aria-invalid={Boolean(errors?.[c.name])}
              aria-describedby={error ? "signup-consent-error" : undefined}
              className="size-4 shrink-0 accent-accent"
            />
            <span>
              {c.label} <span className="text-sm text-neutral-600">(필수)</span>
            </span>
          </label>
          {"href" in c && (
            <Link href={c.href} target="_blank" className="shrink-0 text-sm text-neutral-700 underline underline-offset-2">
              보기
            </Link>
          )}
        </div>
      ))}
      <details className="text-sm text-neutral-700">
        <summary className="cursor-pointer">수집 항목 요약</summary>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 leading-relaxed">
          <dt>수집 항목</dt>
          <dd>이메일, 비밀번호(암호화 저장)</dd>
          <dt>이용 목적</dt>
          <dd>회원 식별, 로그인, 이메일 인증과 비밀번호 재설정</dd>
          <dt>보유 기간</dt>
          <dd>회원 탈퇴 시까지(탈퇴하면 바로 삭제)</dd>
        </dl>
      </details>
      {error && (
        <p id="signup-consent-error" role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

function ResetForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <p className="text-base text-neutral-700">가입한 이메일로 재설정 링크를 보냅니다.</p>
      <FormMessage message={state.error} />
      <Field label="이메일" htmlFor="reset-email" error={state.fieldErrors?.email}>
        <Input id="reset-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" defaultValue={state.email} required />
      </Field>
      <SubmitButton label="재설정 링크 보내기" pendingLabel="메일 보내는 중…" />
      <BackLine />
    </form>
  );
}

export function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`btn btn-primary min-h-11 w-full justify-start disabled:opacity-60 ${className ?? ""}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function FormMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="border-l-2 border-negative pl-3 text-base text-negative">
      {message}
    </p>
  );
}

function PreviewNotice() {
  return (
    <div className="flex flex-col gap-2 border border-divider bg-bg p-4 text-base">
      <p className="text-pretty text-neutral-700">
        인증 서버가 아직 연결되지 않은 미리보기입니다. 로그인 없이 예시 데이터로 화면을 둘러볼 수 있습니다.
      </p>
      <Link href="/wardrobe" className="btn btn-ghost self-start">
        내 옷장 둘러보기 →
      </Link>
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
