/**
 * 내 옷장 훈수 화면 문구(시작·이름·결과 화면 안내). 분석 문구 틀은 서버(src/server/roast/lines.ts)에 있다.
 * 관리자 화면에서 고칠 수 있고, 고친 문장은 서버가 페이지에 넘긴다(여기 값은 기본 문장).
 */
export const ROAST_COPY = {
  INTRO:
    "안녕하세요. Wardrobe Fit의 전문 옷장분석팀 AI입니다. 시간 조금만 내 보시죠, 당신의 옷 취향이 얼마나 끔찍한지 알아보죠.",
  CREDIT: "How Bad Is Your Spotify에서 영감을 받았죠.",
  START_LABEL: "까짓거 한 번 해보죠",
  PICK_ASK: "어떤 기준으로 평가해 드릴까요? 더 자신 있는 쪽으로 골라 보시죠.",
  PICK_CLOSET: "내 옷장 정보로 훈수받기",
  PICK_ORDERS: "무신사 주문내역으로 훈수받기",
  START_NOTE: "옷장에 넣어 둔 옷을 기준으로 판단하죠. 실제로 가진 옷을 다 넣을수록, 신체 치수를 입력할수록 결과가 정확해지죠.",
  ASK_NAME: "시작하기 전에, 뭐라고 부르면 될까요? 나이도 꼭 알려 주시죠. 나잇값 하는 옷장인지도 봐 드리죠.",
  NAME_HINT: "이름은 안 적어도 되지만, 나이는 꼭 적어 주시죠.",
  AGE_HINT: "나이는 만 나이 말고 한국식 나이로 적어 주시죠. 이번 결과 쓰는 데만 쓰고 저장은 안 하죠.",
  TOO_FEW: "모자·신발을 제외한 옷이 30개 이상이어야 분석할 수 있죠. (현재 {n}개)",
  OPENING: [
    "옷장 문을 열어보는 중이죠. 먼지가 많네요.",
    "옷장 문을 여는 중이죠. 뭔가 쏟아질 것 같은 예감이 드네요.",
    "옷걸이를 하나씩 넘겨 보는 중이죠. 생각보다 빽빽하네요.",
  ],
  WRITING: "결과를 쓰는 중이죠....",
  DISCLAIMER: "AI가 작성한 글이라 부정확할 수 있고, 일부러 비꼬는 말투로 썼으니 가볍게 봐 주시죠.",
  CHANGED: "옷장이 바뀌었죠. 이번엔 더 좋은 평가를 받을 수 있을까요?",
  RETRY_LABEL: "다시 해보기",
};
export type RoastCopy = typeof ROAST_COPY;

export const DISCLAIMER = ROAST_COPY.DISCLAIMER;
export const MIN_CLOTHES = 30;
export const tooFew = (copy: RoastCopy, n: number) => copy.TOO_FEW.replace(/\{n\}/g, String(n));
