"use server";

import type { AuthError } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { REMEMBER_COOKIE, REMEMBER_MAX_AGE, safeNextPath } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AUTH_MESSAGES } from "./messages";
import { fieldErrors, resetRequestSchema, signInSchema, signUpSchema, updatePasswordSchema } from "./schemas";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** 오류 후 다시 그릴 때 이메일 칸을 비우지 않기 위해 돌려준다. */
  email?: string;
};

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** 인증 메일 링크가 돌아올 주소. 배포 주소를 고정하려면 NEXT_PUBLIC_SITE_URL을 쓴다. */
async function siteOrigin() {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return fixed.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function messageFor(error: AuthError) {
  switch (error.code) {
    case "email_not_confirmed":
      return AUTH_MESSAGES.emailNotConfirmed;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return AUTH_MESSAGES.rateLimited;
    case "weak_password":
      return AUTH_MESSAGES.weakPassword;
    case "same_password":
      return AUTH_MESSAGES.samePassword;
    default:
      return AUTH_MESSAGES.unknown;
  }
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({ email: text(formData, "email"), password: text(formData, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email: text(formData, "email") };

  const remember = formData.get("remember") === "on";
  const supabase = await createSupabaseServerClient({ remember });
  if (!supabase) return { error: AUTH_MESSAGES.notConfigured, email: parsed.data.email };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // 계정 존재 여부가 드러나지 않도록 실패 문구를 하나로 통일한다(인증 미완료만 예외).
    // 서버 오류·네트워크 오류는 비밀번호 탓으로 보이지 않게 따로 알린다.
    const known = error.code === "email_not_confirmed" || error.status === 429 || !error.status || error.status >= 500;
    const message = known ? messageFor(error) : AUTH_MESSAGES.invalidCredentials;
    return { error: message, email: parsed.data.email };
  }

  (await cookies()).set(REMEMBER_COOKIE, remember ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_MAX_AGE } : {}),
  });
  redirect(safeNextPath(text(formData, "next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
    passwordConfirm: text(formData, "passwordConfirm"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email: text(formData, "email") };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: AUTH_MESSAGES.notConfigured, email: parsed.data.email };

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/wardrobe` },
  });
  // 이미 가입된 이메일도 같은 안내로 보낸다(계정 열거 방지). Supabase도 이 경우 오류를 주지 않는다.
  if (error) return { error: messageFor(error), email: parsed.data.email };
  redirect("/?mode=sent");
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetRequestSchema.safeParse({ email: text(formData, "email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email: text(formData, "email") };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: AUTH_MESSAGES.notConfigured, email: parsed.data.email };

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/auth/update-password`,
  });
  // 없는 이메일이어도 같은 안내를 보여준다. 요청 제한만 알린다.
  if (error && error.status === 429) return { error: AUTH_MESSAGES.rateLimited, email: parsed.data.email };
  redirect("/?mode=sent");
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = updatePasswordSchema.safeParse({
    password: text(formData, "password"),
    passwordConfirm: text(formData, "passwordConfirm"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: AUTH_MESSAGES.notConfigured };

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/?mode=reset&error=link");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: messageFor(error) };
  redirect("/wardrobe");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_COOKIE);
  redirect("/");
}
