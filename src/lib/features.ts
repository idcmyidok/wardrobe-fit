/**
 * 기능 켜기·끄기. false면 메뉴에서 빠지고 주소로 들어와도 404가 된다. 코드는 그대로 남겨 두어 true로만 바꾸면 되살아난다.
 */
export const FEATURES = {
  /** 오늘의 코디(/outfit). 추천 품질이 아직 부족해 숨겨 둔다. */
  outfit: false,
  /**
   * 무신사 주문내역 훈수(/roast/orders)를 메뉴에 붙였는지. 붙이기 전에는 숨은 주소로만 열리고(404 아님),
   * 업데이트 노트의 해당 문장도 보이지 않는다. 메뉴에 연결할 때 true로 바꾼다.
   */
  orderRoastMenu: false,
} as const;
