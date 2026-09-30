/**
 * 대화 문장의 말풍선 나누기. 문장 안의 줄바꿈("\n")마다 말풍선을 따로 띄운다.
 * 기본 문장은 문장마다 줄을 바꿔 두고, 관리자 화면에서 나누거나 합칠 수 있다.
 */

/** 문장 끝(. ? !) 뒤에서 줄을 바꾼다. "..."(말줄임)와 괄호 덧말 앞은 나누지 않는다. */
export const splitSentences = (s: string) => s.replace(/([^.][.?!])[ \t]+(?=[^\s(])/g, "$1\n");

/** 줄바꿈을 없애 한 말풍선으로 합친다. */
export const joinBubbles = (s: string) => s.replace(/[ \t]*\n+[ \t]*/g, " ").trim();

/** 말풍선 목록 */
export const bubblesOf = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/** 대화에 말풍선으로 나오는 문장(결과 글·질문 문장·선택지는 아니다) */
export function isBubbleKey(key: string): boolean {
  return (
    /^lines\.[^.]+\.say$/.test(key) ||
    /^questions\.[^.]+\.(lead|react\.[^.]+)$/.test(key) ||
    /^quiz\.[^.]+\.(correct|wrong)$/.test(key) ||
    key === "screen.OPENING" ||
    key === "orders.screen.OPENING" ||
    /^orders\.common\.(SCAN_OPEN|WRAP_UP)$/.test(key) ||
    /^common\.(SCAN_OPEN|NAME_GREETING|THINKING|MID_REMARKS|FEW_PATTERNS|WRAP_UP|QUIZ_CORRECT|QUIZ_WRONG)$/.test(key)
  );
}
