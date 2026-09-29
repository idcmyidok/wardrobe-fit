import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { BodyKeyMissingError, decryptBodyValues, encryptBodyValues } from "./crypto";

const saved = process.env.BODY_ENCRYPTION_KEY;
afterEach(() => {
  process.env.BODY_ENCRYPTION_KEY = saved;
});

describe("신체치수 암호화", () => {
  it("암호화한 값에는 숫자가 보이지 않고, 같은 키로 되살린다", () => {
    process.env.BODY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const text = encryptBodyValues({ height: 175.5, chest: 94, waist: null });
    expect(text.startsWith("v1.")).toBe(true);
    expect(text).not.toContain("175");
    expect(decryptBodyValues(text)).toEqual({ height: 175.5, chest: 94 });
    // 같은 값도 매번 다른 암호문
    expect(encryptBodyValues({ height: 175.5 })).not.toBe(encryptBodyValues({ height: 175.5 }));
  });

  it("키가 없거나 다르면 풀지 못한다", () => {
    process.env.BODY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const text = encryptBodyValues({ height: 170 });
    process.env.BODY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptBodyValues(text)).toThrow();
    delete process.env.BODY_ENCRYPTION_KEY;
    expect(() => encryptBodyValues({ height: 170 })).toThrow(BodyKeyMissingError);
  });
});
