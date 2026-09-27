"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NotConnectedNotice } from "./not-connected-notice";

export function SignInForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <Field label="이메일" htmlFor="signin-email">
        <Input id="signin-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
      </Field>
      <Field
        label="비밀번호"
        htmlFor="signin-password"
        action={
          <Link href="/?mode=reset" className="text-xs text-text-muted hover:text-text hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        }
      >
        <Input id="signin-password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Checkbox id="signin-remember" name="remember" label="로그인 상태 유지" defaultChecked />
      {submitted && <NotConnectedNotice />}
      <Button type="submit" variant="primary" size="lg" className="w-full">
        로그인
      </Button>
    </form>
  );
}
