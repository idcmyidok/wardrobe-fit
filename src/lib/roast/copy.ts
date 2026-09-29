/** AI 옷장 분석 화면에 바로 쓰는 문구(시작·이름·안내). 분석 문구 틀은 서버(src/server/roast/lines.ts)에 있다. */

export const INTRO =
  "안녕하세요. Wardrobe Fit의 전문 옷장분석팀 AI 입니다. 저장된 옷장 정보를 바탕으로, 당신의 옷 취향이 얼마나 끔찍한지 알아보겠습니다.";
export const START_LABEL = "까짓거 한 번 해보죠";
export const DECLINE_LABEL = "쫄리네요. 다음에 하죠";
export const DECLINE = ["현명한 판단일지도 모르겠습니다.", "그것도 선택입니다. 옷장은 도망가지 않습니다.", "알겠습니다. 저는 여기서 기다리겠습니다."];
export const ASK_NAME = "시작하기 전에, 뭐라고 부르면 될까요?";
export const NAME_HINT = "이름은 입력하지 않아도 됩니다.";
export const tooFew = (n: number) => `모자·신발을 제외한 옷이 10개 이상일 때 분석할 수 있습니다. (지금 ${n}개)`;
export const WRITING = "결과를 쓰는 중입니다.";
export const DISCLAIMER = "AI가 작성한 글이라 부정확할 수 있고, 일부러 비꼬는 말투로 썼으니 가볍게 봐 주세요.";
export const CHANGED = "옷장이 바뀌었습니다. 다시 해볼까요?";
export const RETRY_LABEL = "다시 해보기";
export const NO_AI_LEFT = "오늘 AI 글쓰기 3회를 다 써서, 이번 결과는 정해 둔 문장으로 만듭니다.";
export const MIN_CLOTHES = 10;
