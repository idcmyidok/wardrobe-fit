import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeProductUrl } from "./analyze";

const html = readFileSync(join(__dirname, "__fixtures__", "musinsa.html"), "utf8");

describe("analyzeProductUrl prefetched", () => {
  it("쇼핑몰에 요청하지 않고 보내 준 페이지로 분석한다", async () => {
    const r = await analyzeProductUrl("https://www.musinsa.com/products/6081265", { prefetched: { html, json: {} } });
    expect(r.product.productName).toBeTruthy();
    expect(r.parserId).toBe("musinsa");
  });
});
