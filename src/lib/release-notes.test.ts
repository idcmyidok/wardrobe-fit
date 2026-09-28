import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { CURRENT_VERSION, RELEASE_NOTES, groupByMajor, majorOf, type ReleaseNote } from "./release-notes";

const note = (version: string): ReleaseNote => ({ version, date: "2026-09-28", features: [], changes: [], fixes: [] });

describe("업데이트 노트", () => {
  it("지금 버전은 맨 위 노트이고 package.json 버전과 같다", () => {
    expect(CURRENT_VERSION).toBe(RELEASE_NOTES[0].version);
    expect(CURRENT_VERSION).toBe(pkg.version);
  });
  it("첫째 자리별로 묶고, 최신 묶음과 최신 버전이 먼저", () => {
    const groups = groupByMajor([note("2.0.0"), note("1.2.1"), note("1.2.0"), note("1.1.0")]);
    expect(groups.map((g) => g.major)).toEqual(["2", "1"]);
    expect(groups[1].notes.map((n) => n.version)).toEqual(["1.2.1", "1.2.0", "1.1.0"]);
    expect(majorOf("1.1.0")).toBe("1");
  });
  it("신규 기능은 제목과 설명이 모두 있다", () => {
    for (const n of RELEASE_NOTES) for (const f of n.features) expect(f.title && f.description).toBeTruthy();
  });
  it("버전은 겹치지 않고 날짜 형식이 맞다", () => {
    const versions = RELEASE_NOTES.map((n) => n.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (const n of RELEASE_NOTES) {
      expect(n.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
