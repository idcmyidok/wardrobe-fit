/**
 * 내 옷장 훈수 화면 문구(시작·이름·결과 화면 안내). 분석 문구 틀은 서버(src/server/roast/lines.ts)에 있다.
 * 관리자 화면에서 고칠 수 있고, 고친 문장은 서버가 페이지에 넘긴다(여기 값은 기본 문장).
 */
export const ROAST_COPY = {
  INTRO:
    "안녕하세요. Wardrobe Fit의 전문 옷장분석팀 AI 입니다. 저장된 옷장 정보를 바탕으로, 당신의 옷 취향이 얼마나 끔찍한지 알아보겠습니다.",
  START_LABEL: "까짓거 한 번 해보죠",
  DECLINE_LABEL: "쫄리네요. 다음에 하죠",
  DECLINE: ["현명한 판단일지도 모르겠습니다.", "그것도 선택입니다. 옷장은 도망가지 않습니다.", "알겠습니다. 저는 여기서 기다리겠습니다."],
  ASK_NAME: "시작하기 전에, 뭐라고 부르면 될까요?",
  NAME_HINT: "이름은 입력하지 않아도 됩니다.",
  TOO_FEW: "모자·신발을 제외한 옷이 10개 이상일 때 분석할 수 있습니다. (지금 {n}개)",
  WRITING: "결과를 쓰는 중입니다.",
  NO_AI_LEFT: "오늘 AI 글쓰기 3회를 다 써서, 이번 결과는 정해 둔 문장으로 만듭니다.",
  DISCLAIMER: "AI가 작성한 글이라 부정확할 수 있고, 일부러 비꼬는 말투로 썼으니 가볍게 봐 주세요.",
  CHANGED: "옷장이 바뀌었습니다. 다시 해볼까요?",
  RETRY_LABEL: "다시 해보기",
};
export type RoastCopy = typeof ROAST_COPY;

export const DISCLAIMER = ROAST_COPY.DISCLAIMER;
export const MIN_CLOTHES = 10;
export const tooFew = (copy: RoastCopy, n: number) => copy.TOO_FEW.replace(/\{n\}/g, String(n));
