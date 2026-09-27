import { describe, expect, it } from "vitest";
import { checkUrlShape, isBlockedIp } from "./url-guard";

describe("isBlockedIp", () => {
  it.each([
    "10.1.2.3",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a9fe:a9fe",
    "not-an-ip",
  ])("막는다: %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["8.8.8.8", "172.32.0.1", "211.43.12.8", "2606:4700::1111", "::ffff:8.8.8.8"])("허용한다: %s", (ip) =>
    expect(isBlockedIp(ip)).toBe(false),
  );
});

describe("checkUrlShape", () => {
  it.each([
    ["ftp://example.com/a", "invalid_url"],
    ["javascript:alert(1)", "invalid_url"],
    ["https://user:pw@example.com/", "invalid_url"],
    ["https://example.com:8443/", "blocked_port"],
    ["http://localhost/", "blocked_host"],
    ["http://metadata.google.internal/", "blocked_host"],
    ["http://127.0.0.1/", "blocked_host"],
    ["http://2130706433/", "blocked_host"], // 127.0.0.1의 10진수 표기
    ["http://0x7f000001/", "blocked_host"],
    ["http://[::1]/", "blocked_host"],
    ["http://[::ffff:169.254.169.254]/", "blocked_host"],
    ["http://169.254.169.254/latest/meta-data", "blocked_host"],
  ])("%s → %s", (url, reason) => expect(checkUrlShape(url)).toEqual({ ok: false, reason }));

  it("공개 쇼핑몰 주소는 통과", () => {
    expect(checkUrlShape("https://www.musinsa.com/products/1").ok).toBe(true);
    expect(checkUrlShape("http://shop.example.com:80/p").ok).toBe(true);
  });
});
