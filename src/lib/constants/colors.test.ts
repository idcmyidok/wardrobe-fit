import { describe, expect, it } from "vitest";
import { findColorHex, normalizeColorName } from "./colors";

describe("normalizeColorName", () => {
  it.each([
    ["black", "블랙"],
    ["BLACK", "블랙"],
    [" Black ", "블랙"],
    ["검정", "블랙"],
    ["검은색", "블랙"],
    ["흰색", "화이트"],
    ["light blue", "라이트 블루"],
    ["LIGHT-BLUE", "라이트 블루"],
    ["lightblue", "라이트 블루"],
    ["라이트블루", "라이트 블루"],
    ["red", "레드"],
    ["Navy Blue", "네이비"],
    ["navy", "네이비"],
    ["남색", "네이비"],
    ["sky blue", "스카이 블루"],
    ["하늘색", "스카이 블루"],
    ["Off White", "오프 화이트"],
    ["yellow", "옐로"],
    ["옐로우", "옐로"],
    ["Light Grey", "라이트 그레이"],
    ["light gray", "라이트 그레이"],
    ["회색", "그레이"],
    ["크림색", "크림"],
    ["블랙(BLACK)", "블랙"],
    ["BLACK (블랙)", "블랙"],
    ["black/white", "블랙/화이트"],
    ["Dusty Pink", "더스티 핑크"],
    ["BK", "블랙"],
    ["아쿠아블루", "아쿠아 블루"],
    ["GREEN", "그린"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeColorName(input)).toBe(expected);
  });

  it("사전에 없는 단어는 입력 그대로 둔다", () => {
    expect(normalizeColorName("Galaxy")).toBe("Galaxy");
    expect(normalizeColorName("연청")).toBe("연청");
    expect(normalizeColorName("블랙 01")).toBe("블랙 01");
    expect(normalizeColorName("Black 01")).toBe("블랙 01");
  });

  it("빈 값은 null", () => {
    expect(normalizeColorName("  ")).toBeNull();
    expect(normalizeColorName(null)).toBeNull();
  });

  it("영어·한글 표기 모두 같은 대표 색을 찾는다", () => {
    expect(findColorHex("black")).toBe(findColorHex("블랙"));
    expect(findColorHex("Light Blue")).toBe(findColorHex("라이트 블루"));
  });
});

describe("findColorHex", () => {
  it.each(["연청", "중청", "진청", "라이트 블루", "아쿠아 블루", "멜란지", "Light Blue", "라이트 올리브", "다크 카키", "연그레이"])(
    "%s에 대표 색이 있다",
    (name) => {
      expect(findColorHex(name)).toMatch(/^#[0-9a-f]{6}$/);
    },
  );

  it("수식어가 붙으면 밝게/어둡게 한다", () => {
    expect(findColorHex("라이트 올리브")).not.toBe(findColorHex("올리브"));
    expect(findColorHex("다크 카키")).not.toBe(findColorHex("카키"));
  });

  it("여러 색이면 첫 색", () => {
    expect(findColorHex("black/white")).toBe(findColorHex("블랙"));
  });

  it("모르는 이름은 null", () => {
    expect(findColorHex("Galaxy")).toBeNull();
  });
});
