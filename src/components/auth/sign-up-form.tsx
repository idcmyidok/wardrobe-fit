"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NotConnectedNotice } from "./not-connected-notice";

export function SignUpForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <Field label="이메일" htmlFor="signup-email">
        <Input id="signup-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
      </Field>
      <Field label="비밀번호" htmlFor="signup-password" help="8자 이상, 영문과 숫자를 포함해 주세요.">
        <Input id="signup-password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="비밀번호 확인" htmlFor="signup-password-confirm">
        <Input id="signup-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" required />
      </Field>
      {submitted && <NotConnectedNotice />}
      <Button type="submit" variant="primary" size="lg" className="w-full">
        회원가입
      </Button>
    </form>
  );
}
