import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { CURRENT_VERSION, RELEASE_NOTES, groupByMajor, majorOf, noteToText, parseNoteText, splitFeatureLine, type ReleaseNote } from "./release-notes";

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

describe("업데이트 노트 수정 글", () => {
  const full: ReleaseNote = {
    version: "1.2.0",
    date: "2026-09-28",
    features: [{ title: "새 기능", description: "설명" }],
    changes: ["바뀐 점"],
    fixes: ["고친 점"],
  };
  it("코드의 노트를 글로 옮기고 다시 읽으면 제목·목록이 된다", () => {
    const text = noteToText(full);
    expect(text).toBe("신규 기능\n- 새 기능: 설명\n\n변경 내용\n- 바뀐 점\n\n수정사항\n- 고친 점");
    expect(parseNoteText(text)).toEqual([
      { kind: "heading", text: "신규 기능" },
      { kind: "item", text: "새 기능: 설명" },
      { kind: "heading", text: "변경 내용" },
      { kind: "item", text: "바뀐 점" },
      { kind: "heading", text: "수정사항" },
      { kind: "item", text: "고친 점" },
    ]);
  });
  it("빈 섹션은 쓰지 않고, 자유 문단과 # 제목도 읽는다", () => {
    expect(noteToText(note("1.0.1"))).toBe("");
    expect(parseNoteText("# 안내\n\n그냥 문단\n· 점 목록\r\n")).toEqual([
      { kind: "heading", text: "안내" },
      { kind: "text", text: "그냥 문단" },
      { kind: "item", text: "점 목록" },
    ]);
  });
});

describe("신규 기능 줄 나누기", () => {
  it("첫 \":\"에서 제목과 설명으로 나눈다", () => {
    expect(splitFeatureLine("내 치수: 신체치수를 저장: 추천")).toEqual({ title: "내 치수", description: "신체치수를 저장: 추천" });
    expect(splitFeatureLine("제목만")).toEqual({ title: "제목만", description: "" });
  });
});
