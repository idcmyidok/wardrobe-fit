"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NotConnectedNotice } from "./not-connected-notice";

export function ResetRequestForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <Field label="이메일" htmlFor="reset-email" help="가입한 이메일로 비밀번호 재설정 링크를 보내드립니다.">
        <Input id="reset-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
      </Field>
      {submitted && <NotConnectedNotice />}
      <Button type="submit" variant="primary" size="lg" className="w-full">
        재설정 링크 보내기
      </Button>
    </form>
  );
}
