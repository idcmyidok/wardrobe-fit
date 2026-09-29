import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { CURRENT_VERSION, RELEASE_NOTES, groupByMajor, majorOf, draftToContent, noteToDraft, parseEditBody, type ReleaseNote } from "./release-notes";

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

describe("업데이트 노트 수정", () => {
  const full: ReleaseNote = {
    version: "1.2.0",
    date: "2026-09-28",
    features: [{ title: "새 기능", description: "설명: 자세히" }, { title: "제목만", description: "" }],
    changes: ["바뀐 점"],
    fixes: ["고친 점", "또 고친 점"],
  };
  it("노트를 세 칸의 글로 옮기고 다시 읽으면 같다", () => {
    const draft = noteToDraft(full);
    expect(draft).toEqual({ features: "새 기능: 설명: 자세히\n제목만", changes: "바뀐 점", fixes: "고친 점\n또 고친 점" });
    expect(draftToContent(draft)).toEqual({ features: full.features, changes: full.changes, fixes: full.fixes });
  });
  it("빈 줄과 앞의 - · 는 버린다", () => {
    expect(draftToContent({ features: "", changes: "- 하나\n\n· 둘\r\n  ", fixes: "" })).toEqual({ features: [], changes: ["하나", "둘"], fixes: [] });
  });
  it("저장된 글을 읽고, 모양이 틀리면 null", () => {
    const content = { features: [], changes: ["a"], fixes: [] };
    expect(parseEditBody(JSON.stringify(content))).toEqual(content);
    expect(parseEditBody("그냥 글")).toBeNull();
    expect(parseEditBody(JSON.stringify({ features: [{ title: 1 }], changes: [], fixes: [] }))).toBeNull();
  });
});
