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

/** 영어 색 단어 → 한글 표기. 표기는 COLOR_HEX 이름을 따른다(yellow → 옐로, light → 라이트). */
const COLOR_WORD: Record<string, string> = {
  black: "블랙", white: "화이트", ivory: "아이보리", cream: "크림", ecru: "에크루", natural: "내추럴", beige: "베이지",
  sand: "샌드", stone: "스톤", oatmeal: "오트밀", taupe: "토프", camel: "카멜", tan: "탄", cognac: "코냑", mocha: "모카",
  chocolate: "초콜릿", brown: "브라운", espresso: "에스프레소", terracotta: "테라코타", rust: "러스트", caramel: "카라멜",
  khaki: "카키", olive: "올리브", sage: "세이지", mint: "민트", forest: "포레스트", hunter: "헌터", bottle: "보틀",
  green: "그린", pistachio: "피스타치오", moss: "모스", emerald: "에메랄드", lime: "라임", navy: "네이비",
  midnight: "미드나잇", indigo: "인디고", royal: "로얄", blue: "블루", cobalt: "코발트", sky: "스카이", powder: "파우더",
  baby: "베이비", denim: "데님", steel: "스틸", teal: "틸", slate: "슬레이트", turquoise: "터콰이즈", aqua: "아쿠아",
  marine: "마린", red: "레드", burgundy: "버건디", wine: "와인", maroon: "마룬", oxblood: "옥스블러드", brick: "브릭",
  cherry: "체리", berry: "베리", coral: "코랄", peach: "피치", pink: "핑크", hot: "핫", dusty: "더스티", rose: "로즈",
  blush: "블러시", lavender: "라벤더", lilac: "라일락", violet: "바이올렛", purple: "퍼플", plum: "플럼", mauve: "모브",
  yellow: "옐로", mustard: "머스타드", butter: "버터", lemon: "레몬", orange: "오렌지", tangerine: "탠저린",
  gold: "골드", ochre: "오커", ocher: "오커", grey: "그레이", gray: "그레이", charcoal: "차콜", silver: "실버",
  ash: "애쉬", melange: "멜란지", heather: "헤더", smoke: "스모크", neon: "네온", multi: "멀티",
  light: "라이트", dark: "다크", deep: "딥", pale: "페일", medium: "미디엄", mid: "미드", off: "오프", jet: "제트",
  washed: "워시드", vintage: "빈티지", raw: "로우", stripe: "스트라이프", check: "체크", camo: "카모",
};

/** 한 덩어리로 봐야 하는 표기(공백·대소문자 무시) → 한글 표기 */
const COLOR_PHRASE: Record<string, string> = {
  navyblue: "네이비", bk: "블랙", blk: "블랙", wh: "화이트", wht: "화이트", nv: "네이비", nvy: "네이비", iv: "아이보리",
  "검정": "블랙", "검은": "블랙", "검은색": "블랙", "까만색": "블랙", "까망": "블랙",
  "흰": "화이트", "흰색": "화이트", "하얀색": "화이트", "하양": "화이트", "화이트색": "화이트",
  "회색": "그레이", "쥐색": "그레이", "진회색": "다크 그레이", "연회색": "라이트 그레이", "그래이": "그레이", "챠콜": "차콜",
  "남색": "네이비", "곤색": "네이비", "네이비블루": "네이비",
  "빨강": "레드", "빨간색": "레드", "빨강색": "레드", "적색": "레드",
  "파랑": "블루", "파란색": "블루", "파랑색": "블루", "청색": "블루", "하늘색": "스카이 블루", "소라색": "스카이 블루",
  "노랑": "옐로", "노란색": "옐로", "노랑색": "옐로", "옐로우": "옐로", "겨자색": "머스타드", "머스터드": "머스타드",
  "초록": "그린", "초록색": "그린", "녹색": "그린", "연두": "라이트 그린", "연두색": "라이트 그린", "청록": "틸", "청록색": "틸",
  "갈색": "브라운", "밤색": "브라운", "고동색": "다크 브라운", "초콜렛": "초콜릿",
  "분홍": "핑크", "분홍색": "핑크", "연분홍": "라이트 핑크", "코럴": "코랄",
  "보라": "퍼플", "보라색": "퍼플", "연보라": "라벤더", "라벤다": "라벤더", "버간디": "버건디",
  "주황": "오렌지", "주황색": "오렌지", "금색": "골드", "은색": "실버", "애크루": "에크루", "베이지색": "베이지",
};

const compact = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
const HANGUL = /[가-힣]/;

/** 공백만 다른 한글 표기("라이트블루")도 COLOR_HEX 이름으로 맞춘다. */
const PHRASE: Record<string, string> = { ...COLOR_PHRASE };
for (const k of Object.keys(COLOR_HEX)) PHRASE[compact(k)] = k;

/** 한글 한 단어 표기(붙여 쓴 한글을 나눌 때 쓴다) */
const KOREAN_WORD: Record<string, string> = {};
for (const w of [...Object.values(COLOR_WORD), ...Object.keys(COLOR_HEX).filter((k) => !k.includes(" "))]) KOREAN_WORD[w] = w;

/** 단어 하나를 한글로: 사전 → "~색" 떼기 → 붙여 쓴 영어("lightblue") 두 단어로 나누기. 모르면 null */
function wordToKorean(token: string): string | null {
  const c = compact(token);
  if (PHRASE[c]) return PHRASE[c];
  if (COLOR_WORD[c]) return COLOR_WORD[c];
  if (HANGUL.test(c) && c.length > 1 && c.endsWith("색")) {
    const base = c.slice(0, -1);
    if (PHRASE[base]) return PHRASE[base];
  }
  // 붙여 쓴 두 단어: "lightblue" → "라이트 블루", "아쿠아블루" → "아쿠아 블루"
  const words: Record<string, string> = /^[a-z]+$/.test(c) ? COLOR_WORD : HANGUL.test(c) ? KOREAN_WORD : {};
  for (let i = 1; i < c.length; i++) {
    const a = words[c.slice(0, i)];
    const b = words[c.slice(i)];
    if (a && b) return fixPhrase(`${a} ${b}`);
  }
  return null;
}

const fixPhrase = (s: string) => PHRASE[compact(s)] ?? s;

/** 띄어 쓴 여러 단어: 앞에서부터 가장 긴 덩어리를 사전에서 찾고, 모르는 단어는 입력 그대로 둔다. */
function phraseToKorean(text: string): string {
  const whole = PHRASE[compact(text)];
  if (whole) return whole;
  const tokens = text.split(/[\s_-]+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    let matched = false;
    for (let j = Math.min(tokens.length, i + 3); j > i + 1; j--) {
      const hit = PHRASE[compact(tokens.slice(i, j).join(""))];
      if (hit) {
        out.push(hit);
        i = j;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    out.push(wordToKorean(tokens[i]) ?? tokens[i]);
    i++;
  }
  const deduped = out.filter((w, i) => w !== out[i - 1]);
  return fixPhrase(deduped.join(" "));
}

/** "블랙(BLACK)"처럼 괄호로 같은 색을 두 번 적은 경우는 하나로 줄인다. */
function segmentToKorean(text: string): string {
  const m = text.match(/^(.*?)\s*[([]\s*(.*?)\s*[)\]]\s*$/);
  if (m && m[1] && m[2]) {
    const a = phraseToKorean(m[1]);
    const b = phraseToKorean(m[2]);
    return a === b ? a : `${a}(${b})`;
  }
  return phraseToKorean(text);
}

/**
 * 컬러명을 한글 표기로 통일한다: "black"·"BLACK"·"검정" → "블랙", "light blue" → "라이트 블루".
 * 대소문자·띄어쓰기를 무시하고, "/"로 나뉜 색은 각각 바꾼다. 사전에 없는 단어는 입력 그대로 둔다.
 */
export function normalizeColorName(name: string | null | undefined): string | null {
  const text = name?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const parts = text.split(/\s*\/\s*/).filter(Boolean).map(segmentToKorean);
  return [...new Set(parts)].join("/");
}

/** 컬러명에서 대표 색을 찾는다. 한글 표기로 바꾼 뒤 정확히 같은 이름 → 이름에 포함된 색 순서. */
export function findColorHex(name: string | null): string | null {
  const n = normalizeColorName(name);
  if (!n) return null;
  if (COLOR_HEX[n]) return COLOR_HEX[n];
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
