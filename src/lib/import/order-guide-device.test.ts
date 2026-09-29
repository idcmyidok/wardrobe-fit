import { describe, expect, it } from "vitest";
import { guideDevice } from "./order-guide-device";

const UA = {
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  winEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.46 Mobile/15E148 Safari/604.1",
  iphoneKakao:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0",
  ipadSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  androidNaver:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.8.2)",
};

describe("guideDevice", () => {
  it("PC는 브라우저와 상관없이 pc", () => {
    expect(guideDevice(UA.macChrome)).toBe("pc");
    expect(guideDevice(UA.winEdge)).toBe("pc");
  });
  it("아이폰 사파리·크롬", () => {
    expect(guideDevice(UA.iphoneSafari, 5)).toBe("ios-safari");
    expect(guideDevice(UA.iphoneChrome, 5)).toBe("ios-chrome");
  });
  it("아이패드 사파리는 맥처럼 보여도 터치로 가른다", () => {
    expect(guideDevice(UA.ipadSafari, 5)).toBe("ios-safari");
    expect(guideDevice(UA.ipadSafari, 0)).toBe("pc");
  });
  it("안드로이드 크롬", () =>
    expect(guideDevice(UA.androidChrome, 5)).toBe("android-chrome"));
  it("앱 안 브라우저·삼성 인터넷은 지원하지 않는다", () => {
    expect(guideDevice(UA.iphoneKakao, 5)).toBe("mobile-other");
    expect(guideDevice(UA.androidSamsung, 5)).toBe("mobile-other");
    expect(guideDevice(UA.androidNaver, 5)).toBe("mobile-other");
  });
});
