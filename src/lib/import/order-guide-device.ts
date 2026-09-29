/**
 * 주문내역 가져오기 안내를 기기에 맞게 하나만 보여 주려고 접속 환경을 가른다.
 * 휴대폰에서는 북마크 버튼이 크롬·사파리에서만 동작한다(앱 안 브라우저·삼성 인터넷 등은 북마크 실행이 안 되거나 확인하지 못했다).
 */
export type GuideDevice =
  | "pc"
  | "ios-safari"
  | "ios-chrome"
  | "android-chrome"
  | "mobile-other";

const IN_APP =
  /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|; wv\)/i;

export function guideDevice(ua: string, maxTouchPoints = 0): GuideDevice {
  // iPadOS 사파리는 맥처럼 보이므로 터치 지점 수로 가른다.
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const android = /Android/.test(ua);
  if (!ios && !android) return "pc";
  if (IN_APP.test(ua)) return "mobile-other";
  if (ios) {
    if (/CriOS\//.test(ua)) return "ios-chrome";
    if (/FxiOS|EdgiOS|OPiOS|Whale|YaBrowser/.test(ua)) return "mobile-other";
    return /Safari\//.test(ua) ? "ios-safari" : "mobile-other";
  }
  if (
    /SamsungBrowser|Whale|EdgA|OPR\/|Firefox|YaBrowser|MiuiBrowser|UCBrowser/.test(
      ua,
    )
  )
    return "mobile-other";
  return /Chrome\//.test(ua) ? "android-chrome" : "mobile-other";
}
