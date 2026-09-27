import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createParseContext } from "./context";
import { normalizeProduct } from "./normalize";
import { runParsers, selectParsers } from "./registry";

/** fixture HTML을 실제 분석 순서(registry)대로 돌리고 정규화까지 확인한다. */
const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

async function analyze(pageUrl: string, html: string, json: Record<string, unknown> = {}) {
  const url = new URL(pageUrl);
  const ctx = createParseContext(url, html, async (target) => {
    if (!(target in json)) throw new Error(`unexpected fetch ${target}`);
    return json[target];
  });
  const run = await runParsers(ctx);
  const siteName = ctx.$('meta[property="og:site_name"]').attr("content");
  return { run, product: normalizeProduct(run.product, run.sources, { siteName }) };
}

describe("generic parser: JSON-LD", () => {
  it("브랜드·제품명·가격·이미지·사이즈표를 읽는다", async () => {
    const { run, product: p } = await analyze("https://shop.example.com/p/1", fixture("generic-jsonld.html"));
    expect(run.used[0].id).toBe("generic");
    expect(p.brand).toEqual({ value: "ARKET", source: "json_ld", confidence: "high" });
    expect(p.productName?.value).toBe("헤비 코튼 오버셔츠");
    expect(p.price?.value).toBe(119000);
    expect(p.imageUrls).toEqual(["https://shop.example.com/images/main.jpg", "https://cdn.example.com/2.jpg"]);
    expect(p.categoryId?.value).toBe("top");
    expect(p.subcategoryId?.value).toBe("top.shirt");
    expect(p.sizeOptions).toEqual(["S", "M", "L"]);
    expect(p.colorCandidate?.value).toBe("다크 네이비");
    expect(p.sizeChart?.measurementGroup).toBe("top");
    expect(p.sizeChart?.rows[1]).toEqual({ sizeLabel: "M", measurements: { length: 75, shoulder: 46, chest: 57.5, sleeve: 62.5 } });
    // 옷장 표에 없는 항목(암홀, 상의 밑단)은 버린다.
    expect(p.sizeChart?.unmappedColumns).toEqual(["암홀", "밑단단면"]);
  });
});

describe("generic parser: OpenGraph + 휴리스틱", () => {
  it("OG 정보, 옵션 select, 세로로 놓인 하의 사이즈표를 읽는다", async () => {
    const { product: p } = await analyze("https://sample.co.kr/goods/9", fixture("generic-og.html"));
    expect(p.productName).toMatchObject({ value: "와이드 데님 팬츠", source: "open_graph", confidence: "medium" });
    expect(p.brand?.value).toBe("샘플진");
    expect(p.price?.value).toBe(59000);
    expect(p.imageUrls).toEqual(["https://img.sample.co.kr/denim-1.jpg", "https://img.sample.co.kr/denim-2.jpg"]);
    expect(p.subcategoryId?.value).toBe("bottom.denim");
    expect(p.colorOptions).toEqual(["인디고", "블랙"]);
    expect(p.colorCandidate).toBeNull(); // 옵션이 여러 개면 사용자가 고른다.
    expect(p.sizeOptions).toEqual(["28", "30", "32"]);
    expect(p.sizeChart?.rows[0]).toEqual({
      sizeLabel: "28",
      measurements: { length: 102, waist: 38, hip: 50.5, thigh: 32, rise: 30, legOpening: 24 },
    });
    expect(p.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(["circumference_converted", "range_value_averaged", "size_chart_unmapped_columns"]),
    );
  });
});

describe("platform parser: Shopify", () => {
  it("상품 JSON에서 옵션·가격·인치 사이즈표를 읽는다", async () => {
    const pageUrl = "https://sample-brand.com/products/relaxed-chino?variant=1";
    const html = fixture("shopify.html");
    expect(selectParsers(new URL(pageUrl), html).map((p) => p.id)).toEqual(["shopify", "generic"]);
    const { run, product: p } = await analyze(pageUrl, html, {
      "https://sample-brand.com/products/relaxed-chino.js": JSON.parse(fixture("shopify-product.json")),
    });
    expect(run.used[0].id).toBe("shopify");
    expect(p.brand).toEqual({ value: "Sample Brand", source: "platform", confidence: "high" });
    expect(p.productName?.value).toBe("Relaxed Chino");
    expect(p.price?.value).toBe(129000);
    expect(p.imageUrls[0]).toBe("https://cdn.shopify.com/s/files/1/chino-1.jpg");
    expect(p.subcategoryId?.value).toBe("bottom.chino");
    expect(p.colorOptions).toEqual(["Beige", "Navy"]);
    expect(p.sizeOptions).toEqual(["30", "32"]);
    expect(p.sizeChart?.rows[0]).toEqual({
      sizeLabel: "30",
      measurements: { length: 104.1, waist: 38.1, hip: 52.1, thigh: 33, rise: 29.2, legOpening: 21.6 },
    });
    expect(p.warnings.map((w) => w.code)).toContain("size_chart_unit_converted");
  });
});

describe("platform parser: Cafe24", () => {
  it("상품 정보 표, 옵션, 상세 사이즈표(둘레→단면)를 읽는다", async () => {
    const pageUrl = "https://cafemall.com/product/detail.html?product_no=12";
    const html = fixture("cafe24.html");
    expect(selectParsers(new URL(pageUrl), html).map((p) => p.id)).toEqual(["cafe24", "generic"]);
    const { run, product: p } = await analyze(pageUrl, html);
    expect(run.used[0].id).toBe("cafe24");
    expect(p.productName?.value).toBe("울 블렌드 워크 자켓");
    expect(p.brand?.value).toBe("A.P.C.");
    expect(p.price?.value).toBe(489000); // 할인가가 있으면 할인가
    expect(p.colorOptions).toEqual(["네이비", "차콜"]);
    expect(p.sizeOptions).toEqual(["S", "M"]);
    expect(p.imageUrls).toEqual(["https://cafemall.com/web/product/big/jacket.jpg"]);
    expect(p.subcategoryId?.value).toBe("outer.jacket");
    expect(p.sizeChart?.rows).toEqual([
      { sizeLabel: "S", measurements: { length: 68, shoulder: 44, chest: 56, sleeve: 61 } },
      { sizeLabel: "M", measurements: { length: 70, shoulder: 46, chest: 58, sleeve: 63 } },
    ]);
    expect(p.sizeChart?.unmappedColumns).toEqual(["소매통"]);
  });
});

describe("site parser: 무신사", () => {
  const actualSize = {
    data: {
      sizes: [
        { name: "M", items: [{ name: "총장", value: 72 }, { name: "어깨너비", value: 46 }, { name: "가슴단면", value: 58 }, { name: "소매길이", value: 63 }] },
        { name: "L", items: [{ name: "총장", value: 74 }, { name: "어깨너비", value: 48 }, { name: "가슴단면", value: 60 }, { name: "소매길이", value: 64 }] },
      ],
    },
  };

  it("상품 상태 JSON에서 제품명·브랜드·사진 여러 장을, 별도 JSON에서 실측을 읽는다", async () => {
    const { run, product: p } = await analyze("https://www.musinsa.com/products/6081265", fixture("musinsa.html"), {
      "https://goods-detail.musinsa.com/api2/goods/6081265/actual-size": actualSize,
    });
    expect(run.used[0].id).toBe("musinsa");
    expect(p.productName?.value).toBe("Rolled up check shirt BLACK");
    expect(p.brand?.value).toBe("미세키서울");
    // 같은 사진의 크기별 주소는 하나로, 다른 상품 추천 사진은 빼고, 대표 사진이 먼저
    expect(p.imageUrls).toEqual([
      "https://image.msscdn.net/images/goods_img/20240312/6081265/6081265_17102345678901_500.jpg",
      "https://image.msscdn.net/images/prd_img/20240312/6081265/detail_6081265_17102345678902_500.jpg",
      "https://image.msscdn.net/images/prd_img/20240312/6081265/detail_6081265_17102345678903_500.jpg",
    ]);
    expect(p.sizeOptions).toEqual(["M", "L"]);
    expect(p.sizeChart?.rows[0]).toEqual({ sizeLabel: "M", measurements: { length: 72, shoulder: 46, chest: 58, sleeve: 63 } });
    expect(run.diagnostics.musinsa).toMatchObject({ goodsNo: "6081265", images: 3 });
  });

  it("상태 JSON이 없어도 제목 꼬리를 떼고 페이지의 이 상품 사진을 모은다", async () => {
    const html = fixture("musinsa.html").replace(/<script>window\.__MSS__[\s\S]*?<\/script>/, "");
    const { product: p } = await analyze("https://www.musinsa.com/products/6081265", html, {
      "https://goods-detail.musinsa.com/api2/goods/6081265/actual-size": { data: { header: ["사이즈", "총장", "가슴단면"], rows: [["M", "72", "58"]] } },
    });
    expect(p.productName?.value).toBe("(MISEKISEOUL MEN) Rolled up check shirt BLACK");
    expect(p.imageUrls).toEqual(["https://image.msscdn.net/thumbnails/images/goods_img/20240312/6081265/6081265_17102345678901_big.jpg"]);
    expect(p.sizeChart?.rows[0]).toEqual({ sizeLabel: "M", measurements: { length: 72, chest: 58 } });
  });

  it("실측 JSON을 못 받아도 나머지는 채우고 어디서 실패했는지 남긴다", async () => {
    const { run, product: p } = await analyze("https://www.musinsa.com/products/6081265", fixture("musinsa.html"));
    expect(p.productName?.value).toBe("Rolled up check shirt BLACK");
    expect(p.sizeChart).toBeNull();
    const tried = (run.diagnostics.musinsa as { actualSize: Array<{ ok: boolean }> }).actualSize;
    expect(tried).toHaveLength(2);
    expect(tried.every((t) => !t.ok)).toBe(true);
  });
});
