import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { BODY_KEYS, type BodyKey } from "@/lib/constants/body";

/**
 * 신체치수 암호화(AES-256-GCM). 값은 서버에서만 암호화·복호화하고, DB(body_profiles.values_enc)에는
 * "v1.<base64url(iv 12바이트 | tag 16바이트 | 암호문)>"만 남는다(마이그레이션 18).
 * 키는 BODY_ENCRYPTION_KEY(base64로 적은 32바이트) 환경 변수에만 둔다. 키를 잃으면 저장된 치수를 되살릴 수 없다.
 */

export type BodyValues = Partial<Record<BodyKey, number>>;

const PREFIX = "v1.";

export class BodyKeyMissingError extends Error {
  constructor() {
    super("BODY_ENCRYPTION_KEY가 없거나 32바이트가 아닙니다.");
  }
}

function key(): Buffer {
  const raw = process.env.BODY_ENCRYPTION_KEY?.trim();
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) throw new BodyKeyMissingError();
  return buf;
}

export const hasBodyKey = () => {
  try {
    key();
    return true;
  } catch {
    return false;
  }
};

/** 입력한 치수만 담아 암호화한다. 빈 값은 넣지 않는다. */
export function encryptBodyValues(values: Partial<Record<BodyKey, number | null>>): string {
  const clean: BodyValues = {};
  for (const k of BODY_KEYS) {
    const v = values[k];
    if (typeof v === "number" && Number.isFinite(v)) clean[k] = v;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(clean), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** 복호화. 키가 없으면 BodyKeyMissingError, 값이 망가졌거나 키가 다르면 Error */
export function decryptBodyValues(text: string): BodyValues {
  if (!text.startsWith(PREFIX)) throw new Error("알 수 없는 암호화 형식");
  const buf = Buffer.from(text.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const json = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const out: BodyValues = {};
  for (const k of BODY_KEYS) if (typeof parsed[k] === "number") out[k] = parsed[k] as number;
  return out;
}
