export type AuthMode = "signin" | "signup" | "reset" | "sent";

export function parseAuthMode(value: string | string[] | undefined): AuthMode {
  return value === "signup" || value === "reset" || value === "sent" ? value : "signin";
}
