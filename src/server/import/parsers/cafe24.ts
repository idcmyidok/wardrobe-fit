import { cleanText, textOrUndefined } from "../normalize/text";
import type { ParseContext, ProductParser, RawProduct } from "../types";
import { absoluteUrl, blockText, findSizeTable, imagesIn, meta } from "./helpers";
import { sizeChartFromText, sizeTableInEmbeddedHtml } from "./size-text";

/**
 * Cafe24로 만든 자사몰. 공통 상품 정보 표(.infoArea / xans-product-detaildesign),
 * 옵션 select(option_title 속성), 상품 meta를 읽는다(PROJECT_SPEC.md 13.3).
 * 사진: 대표 사진 + 추가 사진(작은 썸네일은 큰 사진 주소로) + 상세 설명 사진.
 * 사이즈표는 상세 영역(#prdDetail 등)의 표 → 숨겨 둔 HTML의 표 → 글로 적힌 사이즈 순으로 찾는다. 이미지로만 된 사이즈표는 읽지 못한다.
 */

const DETAIL = "#prdDetail, .xans-product-additional, .detailArea, #prdInfo, .cont";

/** Cafe24 썸네일 주소(small/medium/tiny) → 큰 사진 주소 */
const bigImage = (u: string) => u.replace(/\/web\/product\/(extra\/)?(small|medium|tiny)\//, "/web/product/$1big/");

const COLOR = /색상|컬러|color|colour/i;
const SIZE = /사이즈|size|치수/i;

export const cafe24Parser: ProductParser = {
  id: "cafe24",
  version: "v1",
  kind: "platform",
  matches: (_url, html) => Boolean(html && /cafe24\.com|EC_FRONT_|\/ind-script\/|xans-product-detail/i.test(html)),
  async parse(ctx: ParseContext): Promise<RawProduct> {
    const { $, url } = ctx;

    // 상품 정보 표: <tr><th>판매가</th><td>...</td></tr>
    const info = new Map<string, string>();
    $(".xans-product-detaildesign tr, .infoArea tr, #span_product_price_text")
      .closest("tr")
      .each((_, tr) => {
        if ($(tr).find("select").length) return; // 옵션 선택 줄은 정보가 아니다.
        const key = cleanText($(tr).find("th").first().text(), 40).replace(/\s+/g, "");
        const value = cleanText($(tr).find("td").first().text(), 300);
        if (key && value && !info.has(key)) info.set(key, value);
      });
    const infoValue = (re: RegExp) => [...info.entries()].find(([k]) => re.test(k))?.[1];

    const options = (re: RegExp) =>
      $("select[option_title], select[id^='product_option_id']")
        .toArray()
        .filter((el) => re.test(`${$(el).attr("option_title") ?? ""} ${$(el).closest("tr").find("th").text()}`))
        .flatMap((el) =>
          $(el)
            .find("option")
            .toArray()
            .filter((o) => !/^\*+$|^\*\*$|^$/.test($(o).attr("value") ?? ""))
            .map((o) => cleanText($(o).text(), 60)),
        )
        .filter((t) => t && !/^-+/.test(t));

    const amountOf = (v?: string) => Number((v ?? "").replace(/[^\d.]/g, "")) || 0;
    const sale = amountOf(meta($, "product:sale_price:amount"));
    const regular = amountOf(meta($, "product:price:amount"));
    const infoPrice = Number((infoValue(/할인판매가|판매가|price/i) ?? "").replace(/[^\d]/g, ""));
    const amount = sale > 0 ? sale : regular > 0 ? regular : infoPrice > 0 ? infoPrice : undefined;

    const scriptName = ctx.html.match(/product_name\s*[:=]\s*['"]([^'"]{1,200})['"]/)?.[1];
    const mainImage = $(".keyImg img, .xans-product-image img.BigImage, #big_img_box img").first().attr("src");
    // 추가 사진 썸네일, 그리고 페이지 어디든 큰 상품 사진(/web/product/big, /extra/) 주소. 관련 상품 목록은 medium·small이라 빠진다.
    const gallery = [
      ...imagesIn($, ".xans-product-addimage, .xans-product-image, .keyImg, .thumbnail, .prdImgView", url).map(bigImage),
      ...imagesIn($, "body", url, 200).filter((u) => /\/web\/product\/(big|extra)\//.test(u)).map(bigImage),
    ];
    const detailImages = imagesIn($, DETAIL, url);

    return {
      productName: textOrUndefined(infoValue(/^(상품명|제품명|productname)$/i) ?? scriptName, 200),
      brand: textOrUndefined(infoValue(/브랜드|brand|제조사/i) ?? meta($, "product:brand"), 100),
      price: amount ? { amount, currency: meta($, "product:price:currency") ?? "KRW" } : undefined,
      colorFromDetail: textOrUndefined(infoValue(/^(색상|컬러|color)$/i), 50),
      colorOptions: options(COLOR),
      sizeOptions: options(SIZE),
      imageUrls: [...new Set([absoluteUrl(mainImage, url), ...gallery, ...detailImages].filter((u): u is string => Boolean(u)))],
      sizeChart:
        findSizeTable($, DETAIL) ?? findSizeTable($) ?? sizeTableInEmbeddedHtml(ctx.html) ?? sizeChartFromText(blockText($, $(DETAIL).length ? DETAIL : "body")),
      categoryHints: $(".xans-product-headcategory a, .path a")
        .toArray()
        .map((a) => cleanText($(a).text(), 40))
        .filter((t) => t && !/^(홈|home)$/i.test(t)),
    };
  },
};
