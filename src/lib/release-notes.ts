/**
 * 업데이트 노트(사용자 메뉴 → 업데이트 노트). 최신 버전을 맨 위에 둔다.
 *
 * 버전 규칙: 주.부·수정. 신규 기능이 생기면 둘째 자리(1.10 → 1.20), 변경·수정만 있으면 셋째 자리(1.10 → 1.11).
 * 크게 바뀌면 첫째 자리(2.xx)를 올리고, 화면에서 "1.x", "2.x" 탭으로 나뉜다.
 * - features: 새로 생긴 기능(짧게)
 * - changes: 바뀐 내용
 * - fixes: 고친 문제(소제목 없이 한 줄씩)
 */
export interface ReleaseNote {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  features: string[];
  changes: string[];
  fixes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.10",
    date: "2026-09-28",
    features: [],
    changes: [],
    fixes: [],
  },
];

/** 지금 버전(맨 위 노트) */
export const CURRENT_VERSION = RELEASE_NOTES[0]?.version ?? "";

/** "1.10" → "1" */
export const majorOf = (version: string) => version.split(".")[0];

/** 첫째 자리별로 묶는다. 최신 묶음이 먼저 */
export function groupByMajor(notes: ReleaseNote[] = RELEASE_NOTES): { major: string; notes: ReleaseNote[] }[] {
  const groups: { major: string; notes: ReleaseNote[] }[] = [];
  for (const note of notes) {
    const major = majorOf(note.version);
    const group = groups.find((g) => g.major === major);
    if (group) group.notes.push(note);
    else groups.push({ major, notes: [note] });
  }
  return groups;
}
