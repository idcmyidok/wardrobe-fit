import { describe, expect, it } from "vitest";
import { mapCategory } from "./normalize/category";
import { splitColorOption } from "./normalize/color";
import { cleanProductName } from "./normalize";
import { mapHeader, normalizeSizeChart } from "./normalize/size-chart";
import { normalizeProductUrl } from "./url";

describe("사이즈표 헤더", () => {
  it.each([
    ["어깨너비", "shoulder"],
    ["가슴 단면", "chest"],
    ["총기장", "length"],
    ["소매길이", "sleeve"],
    ["허리단면", "waist"],
    ["힙", "hip"],
    ["허벅지단면", "thigh"],
    ["밑위", "rise"],
    ["밑단단면", "legOpening"],
    ["Pit to Pit", "chest"],
  ])("%s → %s", (h, key) => expect(mapHeader(h)).toBe(key));

  it.each(["암홀", "인심", "소매통", "소매단면", "목너비", "Armhole", "Inseam", "Sleeve Opening", "비고"])("버린다: %s", (h) =>
    expect(mapHeader(h)).toBeNull(),
  );

  it("상의 표의 밑단은 버리고 하의 표의 밑단은 남긴다", () => {
    const raw = { headers: ["사이즈", "총장", "밑단"], rows: [["M", "70", "50"]] };
    expect(normalizeSizeChart(raw, "top").chart?.rows[0].measurements).toEqual({ length: 70 });
    expect(normalizeSizeChart(raw, "bottom").chart?.rows[0].measurements).toEqual({ length: 70, legOpening: 50 });
  });

  it("모자 표는 머리둘레를 둘레 그대로 두고 깊이·챙길이를 읽는다", () => {
    const raw = { headers: ["사이즈", "머리둘레", "깊이", "챙길이"], rows: [["FREE", "58", "15.5", "7"]] };
    const { chart } = normalizeSizeChart(raw, null);
    expect(chart?.measurementGroup).toBe("hat");
    expect(chart?.rows[0].measurements).toEqual({ head: 58, depth: 15.5, brim: 7 });
  });

  it("0 이하·200 초과 값은 비우고 경고한다", () => {
    const { chart, warnings } = normalizeSizeChart({ headers: ["사이즈", "총장", "어깨"], rows: [["M", "0", "250"], ["L", "72", "47"]] }, "top");
    expect(chart?.rows).toEqual([{ sizeLabel: "L", measurements: { length: 72, shoulder: 47 } }]);
    expect(warnings.map((w) => w.code)).toContain("invalid_measurement_dropped");
  });
});

describe("제품명·컬러·분류", () => {
  it("브랜드 접두어와 쇼핑몰 접미어를 뗀다", () => {
    expect(cleanProductName("[ARKET] 헤비 코튼 오버셔츠 - 무신사 스토어", "ARKET")).toBe("헤비 코튼 오버셔츠");
    expect(cleanProductName("A.P.C. 울 자켓 | 공식 온라인 스토어", "A.P.C.")).toBe("울 자켓");
    expect(cleanProductName("셔츠 - 네이비", null)).toBe("셔츠 - 네이비");
  });

  it("옵션에서 사이즈·품절 표시를 뗀다", () => {
    expect(splitColorOption("BLACK / M")).toBe("BLACK");
    expect(splitColorOption("네이비 - L (품절)")).toBe("네이비");
  });

  it("breadcrumb의 좁은 분류를 우선하고, 없으면 제품명으로 찾는다", () => {
    expect(mapCategory(["남성", "아우터", "블레이저"])?.subcategoryId).toBe("outer.blazer");
    expect(mapCategory([], "데님 트러커 자켓")).toEqual({ categoryId: "outer", subcategoryId: "outer.trucker", fromName: true });
    expect(mapCategory(["bottom", "Wide Slacks"])?.subcategoryId).toBe("bottom.slacks");
  });

  it("무신사 세부분류로 나눈다", () => {
    const sub = (name: string) => mapCategory([], name)?.subcategoryId;
    expect(sub("오버핏 반팔 티셔츠")).toBe("top.short_tee");
    expect(sub("그래픽 티셔츠")).toBe("top.short_tee");
    expect(sub("옥스포드 셔츠")).toBe("top.shirt");
    expect(sub("후드 집업")).toBe("outer.hood_zip");
    expect(sub("스웨트 후디")).toBe("top.hoodie");
    expect(sub("경량 패딩 베스트")).toBe("outer.light_padding");
    expect(sub("구스 다운 롱패딩")).toBe("outer.long_padding");
    expect(sub("캐시미어 더블 코트")).toBe("outer.double_coat");
    expect(sub("코튼 트렌치 코트")).toBe("outer.transition_coat");
    expect(sub("MA-1 봄버")).toBe("outer.blouson");
    expect(sub("나일론 코치 자켓")).toBe("outer.coach");
    expect(sub("레더 자켓")).toBe("outer.leather");
    expect(sub("레더 팬츠")).toBe("bottom.etc");
    expect(sub("트레이닝 팬츠")).toBe("bottom.sweatpants");
    expect(sub("카고 팬츠")).toBe("bottom.chino");
    expect(sub("데님 오버올")).toBe("bottom.jumpsuit");
    expect(sub("워크 자켓")).toBe("outer.etc");
  });

  it("모자·신발을 나눈다", () => {
    const sub = (name: string) => mapCategory([], name)?.subcategoryId;
    expect(mapCategory(["모자", "캡/야구 모자"])).toEqual({ categoryId: "hat", subcategoryId: "hat.cap", fromName: false });
    expect(mapCategory(["모자", "버킷/사파리햇"])?.subcategoryId).toBe("hat.etc");
    expect(mapCategory(["신발", "스니커즈", "캔버스/단화"])?.subcategoryId).toBe("shoes.sneakers");
    expect(mapCategory(["신발", "부츠/워커", "첼시 부츠"])?.subcategoryId).toBe("shoes.boots");
    expect(sub("트러커 캡")).toBe("hat.cap");
    expect(sub("울 비니")).toBe("hat.beanie");
    expect(sub("Classic Logo Cap")).toBe("hat.cap");
    expect(sub("페니 로퍼")).toBe("shoes.dress");
    expect(sub("레더 샌들")).toBe("shoes.sandals");
    expect(sub("러닝화 젤 카야노")).toBe("shoes.sports");
    expect(sub("척 70 하이 스니커즈")).toBe("shoes.sneakers");
    // 옷 이름에 섞인 말은 모자·신발이 아니다.
    expect(sub("부츠컷 데님 팬츠")).toBe("bottom.denim");
    expect(sub("옥스포드 셔츠")).toBe("top.shirt");
    expect(sub("Oxford Shirt")).toBe("top.shirt");
    expect(sub("모자 탈부착 패딩")).toBe("outer.short_padding");
    expect(sub("캡슐 컬렉션 후디")).toBe("top.hoodie");
  });
});

describe("URL 정리", () => {
  it("추적 파라미터와 #을 지우고 스킴을 붙인다", () => {
    expect(normalizeProductUrl("shop.example.com/p/1?utm_source=ig&color=black&fbclid=x#reviews").toString()).toBe(
      "https://shop.example.com/p/1?color=black",
    );
  });
  it("사설 주소·이상한 스킴은 거부한다", () => {
    expect(() => normalizeProductUrl("http://192.168.0.1/admin")).toThrow("blocked_host");
    expect(() => normalizeProductUrl("file:///etc/passwd")).toThrow("invalid_url");
  });
});
