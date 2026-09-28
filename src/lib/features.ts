/**
 * 기능 켜기·끄기. false면 메뉴에서 빠지고 주소로 들어와도 404가 된다. 코드는 그대로 남겨 두어 true로만 바꾸면 되살아난다.
 */
export const FEATURES = {
  /** 오늘의 코디(/outfit). 추천 품질이 아직 부족해 숨겨 둔다. */
  outfit: false,
} as const;
