import { z } from "zod";

const email = z.string().trim().min(1, "이메일을 입력해 주세요.").email("이메일 형식을 확인해 주세요.");
const newPassword = z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(72, "비밀번호는 72자 이하여야 합니다.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const signUpSchema = z
  .object({ email, password: newPassword, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 서로 다릅니다.",
  });

export const resetRequestSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({ password: newPassword, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 서로 다릅니다.",
  });

/** 필드별 첫 번째 오류만 모은다. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
