export type AuthMode = "signin" | "signup" | "reset";

export function parseAuthMode(value: string | string[] | undefined): AuthMode {
  return value === "signup" || value === "reset" ? value : "signin";
}
