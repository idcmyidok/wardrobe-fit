"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updatePassword, type AuthFormState } from "@/server/auth/actions";
import { FormMessage, SubmitButton } from "./auth-panel";

export function UpdatePasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(updatePassword, {});
  return (
    <div className="flex w-full max-w-95 flex-col gap-5">
      <h2 className="border-b border-divider pb-3 text-[25px]">새 비밀번호</h2>
      <p className="text-base text-neutral-700">{email} 계정에서 사용할 새 비밀번호를 입력하세요.</p>
      <form action={action} className="flex flex-col gap-5" noValidate>
        {/* 비밀번호 관리자가 어느 계정의 비밀번호인지 알 수 있게 한다. */}
        <input type="hidden" name="username" autoComplete="username" value={email} />
        <FormMessage message={state.error} />
        <Field label="새 비밀번호" htmlFor="new-password" error={state.fieldErrors?.password}>
          <Input id="new-password" name="password" type="password" autoComplete="new-password" placeholder="8자 이상" minLength={8} required />
        </Field>
        <Field label="새 비밀번호 확인" htmlFor="new-password-confirm" error={state.fieldErrors?.passwordConfirm}>
          <Input id="new-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton label="비밀번호 변경" pendingLabel="변경하는 중…" />
      </form>
    </div>
  );
}
