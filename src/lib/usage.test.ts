import { describe, expect, it } from "vitest";
import { formatRemaining, resetHint, USAGE_WINDOW_MS } from "./usage";

describe("usage reset hint", () => {
  const now = Date.parse("2026-09-28T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("formats remaining time", () => {
    expect(formatRemaining(30_000)).toBe("1분 미만");
    expect(formatRemaining(8 * 60_000)).toBe("8분");
    expect(formatRemaining(3 * 3_600_000)).toBe("3시간");
    expect(formatRemaining(3 * 3_600_000 + 12 * 60_000)).toBe("3시간 12분");
  });

  it("shows nothing when unused", () => {
    expect(resetHint({ used: 0, limit: 50, oldestAt: null, newestAt: null }, now)).toBeNull();
  });

  it("under the limit: time until everything resets (newest + 24h)", () => {
    const c = { used: 3, limit: 50, oldestAt: ago(23 * 3_600_000), newestAt: ago(USAGE_WINDOW_MS - 2 * 3_600_000) };
    expect(resetHint(c, now)).toBe("2시간 뒤 초기화");
  });

  it("at the limit: time until one use comes back (oldest + 24h)", () => {
    const c = { used: 50, limit: 50, oldestAt: ago(USAGE_WINDOW_MS - 45 * 60_000), newestAt: ago(60_000) };
    expect(resetHint(c, now)).toBe("45분 뒤 1회 가능");
  });
});
