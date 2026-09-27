/** 컬러명 → 대표 색. 표의 컬러 칸과 옷장 분석 그래프 표시용이다(이미지에서 색을 뽑지 않는다). */
export const COLOR_HEX: Record<string, string> = {
  "블랙": "#161616",
  "오프 블랙": "#232221",
  "제트 블랙": "#0e0e0e",
  "차콜": "#3b3c3e",
  "다크 그레이": "#4f5052",
  "그레이": "#8f8f8f",
  "미디엄 그레이": "#8a8a8a",
  "멜란지 그레이": "#a3a3a1",
  "라이트 그레이": "#c9c9c7",
  "실버": "#bfc1c2",
  "애쉬": "#b2b0aa",
  "화이트": "#f7f6f2",
  "오프 화이트": "#efeadf",
  "아이보리": "#f1ebd9",
  "크림": "#efe4c8",
  "에크루": "#e6dcc3",
  "내추럴": "#e2d6bd",
  "베이지": "#d9c7a8",
  "라이트 베이지": "#e6d9c0",
  "샌드": "#d5c29f",
  "스톤": "#cfc7b8",
  "오트밀": "#e4d9c5",
  "토프": "#8b7d6b",
  "카멜": "#b5854b",
  "탄": "#c19a6b",
  "코냑": "#8e4f2a",
  "모카": "#6f4e37",
  "초콜릿": "#4b2e21",
  "브라운": "#6b4430",
  "다크 브라운": "#4a3326",
  "에스프레소": "#3a2a20",
  "테라코타": "#b35a3c",
  "러스트": "#9c4a26",
  "카라멜": "#a86b32",
  "카키": "#7a7652",
  "올리브": "#6b6b3f",
  "다크 올리브": "#4b4a2d",
  "세이지": "#a7ae8e",
  "민트": "#bfe3d0",
  "포레스트 그린": "#2f4a34",
  "헌터 그린": "#2c4a3a",
  "보틀 그린": "#1f3b2d",
  "그린": "#3f7a4f",
  "피스타치오": "#c3cf98",
  "모스": "#6a6e44",
  "에메랄드": "#1f6b52",
  "네이비": "#1f2a44",
  "다크 네이비": "#18213a",
  "미드나잇": "#161c2e",
  "인디고": "#2e3a63",
  "로얄 블루": "#2c4aa0",
  "블루": "#3a62a8",
  "코발트": "#2350a8",
  "스카이 블루": "#a9c8e6",
  "라이트 블루": "#b9cfe4",
  "파우더 블루": "#c7d6e6",
  "데님": "#4a6388",
  "라이트 데님": "#8ea6c4",
  "미드 데님": "#5c7699",
  "다크 데님": "#2c3a55",
  "스틸 블루": "#5d7892",
  "틸": "#2f6f73",
  "슬레이트": "#5a6570",
  "레드": "#b3261e",
  "버건디": "#6a1f2b",
  "와인": "#5c1f2a",
  "마룬": "#5a2027",
  "옥스블러드": "#4f1c1f",
  "브릭": "#9a4436",
  "코랄": "#e27d64",
  "핑크": "#e6a9b5",
  "더스티 핑크": "#c9a0a0",
  "로즈": "#c07a82",
  "라벤더": "#b7a8cf",
  "퍼플": "#5b3f7a",
  "플럼": "#5a3450",
  "모브": "#9b7a8c",
  "옐로": "#e8c547",
  "머스타드": "#c9a032",
  "버터": "#f0e2a3",
  "레몬": "#efe07a",
  "오렌지": "#d8702f",
  "탠저린": "#e58a3a",
  "골드": "#b89545",
  "오커": "#b8893a",
};

const COLOR_ALIAS: Record<string, string> = {
  black: "블랙",
  white: "화이트",
  navy: "네이비",
  grey: "그레이",
  gray: "그레이",
  charcoal: "차콜",
  beige: "베이지",
  khaki: "카키",
  olive: "올리브",
  brown: "브라운",
  cream: "크림",
  ivory: "아이보리",
  ecru: "에크루",
  indigo: "인디고",
  camel: "카멜",
  burgundy: "버건디",
  green: "그린",
  blue: "블루",
  red: "레드",
  sand: "샌드",
  stone: "스톤",
};

/** 컬러명에서 대표 색을 찾는다. 정확히 같은 이름 → 공백 무시 → 영문 별칭 → 이름에 포함된 색 순서. */
export function findColorHex(name: string | null): string | null {
  if (!name) return null;
  const n = name.trim();
  if (COLOR_HEX[n]) return COLOR_HEX[n];
  const compact = n.replace(/\s+/g, "");
  const same = Object.keys(COLOR_HEX).find((k) => k.replace(/\s+/g, "") === compact);
  if (same) return COLOR_HEX[same];
  const alias = COLOR_ALIAS[n.toLowerCase()];
  if (alias) return COLOR_HEX[alias];
  const part = Object.keys(COLOR_HEX)
    .sort((a, b) => b.length - a.length)
    .find((k) => n.includes(k));
  return part ? COLOR_HEX[part] : null;
}

/** 상대 휘도(WCAG). 색 칸 위 글자를 밝게 할지 어둡게 할지 고를 때 쓴다. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 표의 컬러 칩: 대표 색 배경 + 읽히는 글자색. 색을 모르면 배경 없이 둔다. */
export function colorChip(name: string | null): { background: string; color: string } {
  const hex = findColorHex(name);
  if (!hex) return { background: "transparent", color: "var(--n-700)" };
  return { background: hex, color: luminance(hex) > 0.35 ? "#1c1b19" : "#f4f2ee" };
}
