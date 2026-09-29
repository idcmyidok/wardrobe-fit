/**
 * 업데이트 노트(사용자 메뉴 → 업데이트 노트). 최신 버전을 맨 위에 둔다.
 *
 * 버전 규칙(package.json version과 맨 위 노트가 같아야 한다):
 * - 신규 기능이 생기면 가운데 자리(1.1.0 → 1.2.0)
 * - 한 흐름의 변경·수정이면 끝자리(1.1.0 → 1.1.1)
 * - 크게 바뀌면 첫째 자리(2.0.0)를 올리고, 화면에서 "1.x", "2.x" 탭으로 나뉜다.
 * - features: 새로 생긴 기능. 한 줄 제목(무엇이 생겼는지) + 자세한 설명
 * - changes: 바뀐 내용
 * - fixes: 고친 문제(소제목 없이 한 줄씩)
 */
export interface ReleaseFeature {
  title: string;
  description: string;
}

export interface ReleaseNote {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  features: ReleaseFeature[];
  changes: string[];
  fixes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.2.3",
    date: "2026-09-29",
    features: [
      {
        title: "옷장에서 여러 벌 한꺼번에 삭제",
        description:
          "내 옷장의 \"옷 삭제\"를 누르면 간략하게 목록에 체크박스가 생겨요. 지울 옷을 고르고 오른쪽 아래 \"선택 삭제하기\"를 누르면 한 번에 삭제되고, 5초 안에는 실행 취소할 수 있어요.",
      },
    ],
    changes: [
      "휴대폰의 크롬·사파리에서도 무신사 주문내역을 가져올 수 있어요.",
      "주문내역 가져오기 안내가 접속한 기기(PC·휴대폰)에 맞는 방법 하나만 보여 줘요.",
      "내 옷장의 세부분류·브랜드·시즌·컬러 필터는 검색창 옆 \"필터\"를 눌러 펼쳐요.",
    ],
    fixes: [],
  },
  {
    version: "1.2.2",
    date: "2026-09-29",
    features: [],
    changes: ["업데이트 노트의 수정사항은 접혀 있고, 눌러서 펼쳐 볼 수 있어요."],
    fixes: [],
  },
  {
    version: "1.2.1",
    date: "2026-09-28",
    features: [],
    changes: [
      "주문내역으로 추가하는 화면에 지원 쇼핑몰과 하루 분석 횟수, 많은 옷을 한꺼번에 넣을 때의 안내를 넣었어요.",
      "새 옷 추가 화면의 주문내역 추가를 아래쪽 버튼으로 옮겼어요.",
      "주문내역으로 옷을 모두 넣으면 완료를 알려 주고 내 옷장으로 이동해요.",
      "개인정보처리방침·이용약관 링크가 항상 화면 맨 아래에 있어요.",
    ],
    fixes: ["주문내역으로 넣은 옷의 브랜드와 제품명이 뒤바뀌어 저장되던 문제"],
  },
  {
    version: "1.2.0",
    date: "2026-09-28",
    features: [
      {
        title: "무신사 주문내역으로 여러 벌 추가",
        description:
          "무신사 주문내역을 붙여 넣으면 구매 확정된 옷·신발·모자만 골라 상품 사진과 실측을 찾아 줍니다. 2팩·셋업은 한 벌씩 나누고, 한 벌씩 확인한 뒤 고른 옷만 옷장에 넣어요.",
      },
    ],
    changes: ["상품 링크 분석을 하루 100번까지 할 수 있어요."],
    fixes: [],
  },
  {
    version: "1.1.0",
    date: "2026-09-28",
    features: [
      {
        title: "내 치수",
        description: "신체치수를 저장하면 옷 종류·핏별로 추천 실측을 알려 줍니다. 추천 범위는 직접 고쳐서 쓸 수도 있어요.",
      },
      {
        title: "예상 핏 표시",
        description: "옷장 표와 구매 판단 결과에 내 몸 대비 핏을 6단계 미터기로 보여 줍니다. 입어 본 옷에는 \"내 핏\"을 직접 표기할 수 있어요.",
      },
      {
        title: "모자·신발 카테고리",
        description: "모자와 신발을 따로 등록하고, 구매 판단(핏체크)도 할 수 있어요. 신발은 가진 신발의 사이즈·착용감으로 평소 사이즈를 알려 줍니다.",
      },
      {
        title: "구매 판단 VS 비교",
        description: "사려는 옷 링크 2~3개를 나란히 비교해 핏 점수와 추천 순위를 보여 줍니다.",
      },
      {
        title: "옷장 간략하게/자세하게 보기",
        description: "사진·요약 목록과 실측까지 보이는 표를 전환할 수 있어요. 모바일은 간략하게, PC는 자세하게가 기본입니다.",
      },
      {
        title: "옷장 대분류 표 접기",
        description: "아우터·상의·하의 등 대분류 제목 옆 화살표로 표를 접고 펼칠 수 있어요.",
      },
      {
        title: "옷 사진 크게 보기",
        description: "옷 정보에서 사진을 누르면 화면 가득 크게 보여 줍니다.",
      },
      {
        title: "업데이트 노트",
        description: "사용자 메뉴에서 버전별 새 기능과 바뀐 점을 확인할 수 있어요.",
      },
    ],
    changes: [
      "세부분류를 무신사 기준으로 전면 개편, 셔츠/블라우스를 아우터로 이동",
      "예상 핏 판정을 옷 종류별 기준으로 새로 정리(가슴·어깨, 엉덩이·허벅지를 부위별로 판정한 뒤 종합)",
      "허리는 핏 단계와 관계없이 작음·적정·너무 큼으로만 판정",
      "\"내 핏\" 표기로 예상 핏 기준이 옮겨지던 보정 삭제",
      "구매 판단 결과에 핏 4종류별 점수, 안 맞는 치수, 내 치수와의 비교 근거 추가",
      "구매 판단 비교 목록에 세부분류 표시, 같은 세부분류 옷만 자동 체크",
      "옷장 표 사이즈 정렬을 알파벳순에서 S/M/L 순으로 변경",
      "옷장 표 시즌 정렬 삭제(시즌은 필터로만 분류)",
      "옷장 표 열 이름 \"예상핏\" → \"핏\", 직접 평가 표시 방식 정리",
      "옷장 분석 기준을 전체 누적 금액에서 최근 6개월 평균 소비로 변경, 6개월 이내 구매액 추가 표시",
      "월별 구매 그래프를 누르면 그 달 상세 정보 표시, 구매 없는 달은 생략",
      "브랜드 분석 10위까지 표시 + 더보기",
      "모바일 옷장 목록에 구매가 표시, 사진이 잘리지 않게 표시",
      "옷 정보 삭제 버튼을 빨간색으로 강조",
      "어깨너비 재는 법 안내를 직선 측정 기준으로 변경",
      "사이트 아이콘 변경",
    ],
    fixes: [
      "구매 판단 AI 설명이 항상 실패하던 문제(Gemini 응답 잘림)",
      "옷 총장·소매는 핏 판정에서 제외(길이는 별도 비교만 제공)",
      "사용하지 않는 팔길이·다리길이 입력 항목 삭제",
      "구매가 안내 문구를 한 줄로 축소",
      "모바일에서 월별 구매 그래프가 뻑뻑하게 넘어가던 문제",
      "옷 정보의 상품 링크가 눌리지 않던 문제",
      "추천 실측 표에서 옷 종류를 바꾸면 칸 위치가 달라지던 문제",
      "하단 개인정보처리방침 줄 정렬(모바일 가운데, PC 왼쪽)",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-27",
    features: [
      {
        title: "옷장 관리",
        description: "옷을 등록·수정·삭제하고, 브랜드·사이즈·실측 등 상세 정보를 기록합니다.",
      },
      {
        title: "링크로 옷 가져오기",
        description: "쇼핑몰 상품 링크만 붙여넣으면 상품 정보와 실측을 자동으로 채워 줍니다.",
      },
      {
        title: "AI 핏체크(구매 판단)",
        description: "사려는 옷을 가진 옷과 비교해 사이즈를 추천합니다. 규칙 기반 판정은 무료이고, AI가 결과를 요약해 줍니다.",
      },
      {
        title: "옷장 분석",
        description: "구매 금액, 브랜드, 색상 등 가진 옷의 통계를 보여 줍니다.",
      },
      {
        title: "회원가입·로그인",
        description: "이메일로 가입하고 로그인하며, 로그인 상태를 유지할 수 있어요.",
      },
    ],
    changes: [],
    fixes: [],
  },
];

/** 지금 버전(맨 위 노트) */
export const CURRENT_VERSION = RELEASE_NOTES[0]?.version ?? "";

/** "1.1.0" → "1" */
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

/**
 * 관리자가 화면에서 고친 노트. DB(release_note_edits.body)에 신규 기능·변경 내용·수정사항을 JSON으로 저장하고,
 * 있으면 코드의 노트 대신 같은 모양으로 보여 준다. 버전과 날짜는 코드의 노트를 따른다.
 */
export type ReleaseNoteContent = Pick<ReleaseNote, "features" | "changes" | "fixes">;
export type ReleaseNoteEdits = Record<string, ReleaseNoteContent>;

/** 수정 칸 세 개의 글. 한 줄이 한 항목이고, 신규 기능은 "제목: 설명"으로 쓴다. */
export interface ReleaseNoteDraft {
  features: string;
  changes: string;
  fixes: string;
}

export const RELEASE_NOTE_BODY_MAX = 20000;

export function noteToDraft(note: ReleaseNoteContent): ReleaseNoteDraft {
  return {
    features: note.features.map((f) => (f.description ? `${f.title}: ${f.description}` : f.title)).join("\n"),
    changes: note.changes.join("\n"),
    fixes: note.fixes.join("\n"),
  };
}

/** 줄마다 앞의 "-", "·", "•"와 빈칸을 떼고, 빈 줄은 버린다. */
const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-·•]\s*/, "").trim())
    .filter(Boolean);

/** 신규 기능 줄 "제목: 설명"을 나눈다. ":"가 없으면 제목만 있는 것으로 본다. */
export function splitFeatureLine(line: string): ReleaseFeature {
  const at = line.indexOf(":");
  if (at < 0) return { title: line.trim(), description: "" };
  return { title: line.slice(0, at).trim(), description: line.slice(at + 1).trim() };
}

export function draftToContent(draft: ReleaseNoteDraft): ReleaseNoteContent {
  return { features: lines(draft.features).map(splitFeatureLine), changes: lines(draft.changes), fixes: lines(draft.fixes) };
}

/** DB에 저장된 글을 읽는다. 모양이 맞지 않으면 null(코드의 노트를 보여 준다). */
export function parseEditBody(body: string): ReleaseNoteContent | null {
  try {
    const v = JSON.parse(body) as Partial<ReleaseNoteContent>;
    const strs = (a: unknown): a is string[] => Array.isArray(a) && a.every((x) => typeof x === "string");
    const feats = (a: unknown): a is ReleaseFeature[] =>
      Array.isArray(a) && a.every((x) => x && typeof x.title === "string" && typeof x.description === "string");
    if (!feats(v.features) || !strs(v.changes) || !strs(v.fixes)) return null;
    return { features: v.features, changes: v.changes, fixes: v.fixes };
  } catch {
    return null;
  }
}
