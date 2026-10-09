import { describe, expect, it } from "vitest";
import { normalizeSizeChart } from "./normalize/size-chart";
import { sizeChartFromText, sizeSnippet, sizeTableInEmbeddedHtml } from "./parsers/size-text";

const rowsOf = (text: string, group: "top" | "bottom" = "top") => {
  const raw = sizeChartFromText(text);
  return raw ? normalizeSizeChart(raw, group).chart?.rows : undefined;
};

describe("글로 적힌 사이즈 정보", () => {
  it("한 줄에 사이즈 하나", () => {
    expect(rowsOf("SIZE INFO\nM : 총장 70 / 어깨 50 / 가슴 55 / 소매 61 / 암홀 25\nL : 총장 72 / 어깨 52 / 가슴 57.5 / 소매 62cm")).toEqual([
      { sizeLabel: "M", measurements: { length: 70, shoulder: 50, chest: 55, sleeve: 61 } },
      { sizeLabel: "L", measurements: { length: 72, shoulder: 52, chest: 57.5, sleeve: 62 } },
    ]);
  });

  it("사이즈 줄 아래 항목 줄", () => {
    expect(rowsOf("[S]\n허리단면 38cm\n엉덩이단면 50\n밑위 30\n\n[M]\n허리단면 40cm\n엉덩이단면 52\n밑위 31", "bottom")).toEqual([
      { sizeLabel: "S", measurements: { waist: 38, hip: 50, rise: 30 } },
      { sizeLabel: "M", measurements: { waist: 40, hip: 52, rise: 31 } },
    ]);
  });

  it("글자로 된 표(헤더 칸 꼬리말 '너비'는 무시)", () => {
    expect(rowsOf("단위: cm\n사이즈 총장 어깨 너비 가슴 소매\nS 68 44 52 60\nM 70 46 54 61")).toEqual([
      { sizeLabel: "S", measurements: { length: 68, shoulder: 44, chest: 52, sleeve: 60 } },
      { sizeLabel: "M", measurements: { length: 70, shoulder: 46, chest: 54, sleeve: 61 } },
    ]);
  });

  it("사이즈가 열인 표", () => {
    expect(rowsOf("사이즈 1 2 3\n총장 68 70 72\n가슴 52 54 56\n어깨 44 46 48")).toEqual([
      { sizeLabel: "1", measurements: { length: 68, chest: 52, shoulder: 44 } },
      { sizeLabel: "2", measurements: { length: 70, chest: 54, shoulder: 46 } },
      { sizeLabel: "3", measurements: { length: 72, chest: 56, shoulder: 48 } },
    ]);
  });

  it("사이즈 없는 원사이즈, 모델 정보 줄은 빼고", () => {
    expect(rowsOf("MODEL 182cm 70kg 가슴 100 L 착용\n총장 75cm\n어깨 55cm\n가슴 62cm")).toEqual([
      { sizeLabel: "FREE", measurements: { length: 75, shoulder: 55, chest: 62 } },
    ]);
  });

  it("항목명과 값이 줄마다 따로 적힌 실측(후르츠패밀리 모양)", () => {
    expect(rowsOf("실측\n\n측정 방법에 따라 ±1~3cm 오차가 있을 수 있어요.\n\n총장(상의)\n69 cm\n어깨 너비\n47 cm\n가슴 단면\n55 cm\n소매 길이\n66 cm")).toEqual([
      { sizeLabel: "FREE", measurements: { length: 69, shoulder: 47, chest: 55, sleeve: 66 } },
    ]);
  });

  it("사이즈 정보가 없으면 없음", () => {
    expect(sizeChartFromText("부드러운 코튼 소재\n세탁은 단독 손세탁\n배송 2~3일")).toBeUndefined();
  });

  it("AI에 보낼 부분은 사이즈 관련 줄만", () => {
    const text = ["브랜드 소개 긴 글", "배송 안내", "실측 사이즈", "M 총장칠십 어깨 50 가슴 55", "교환 안내"].join("\n");
    expect(sizeSnippet(text)).toContain("M 총장칠십 어깨 50 가슴 55");
    expect(sizeSnippet("배송 3일\n가격 59000")).toBeUndefined();
  });
});

describe("숨겨 둔 HTML 속 사이즈표", () => {
  it("<template>이나 스크립트 문자열 안의 표를 읽는다", () => {
    const html = `<script>var sizeHtml = "<table><tr><th>사이즈</th><th>총장</th><th>가슴</th></tr><tr><td>M</td><td>70</td><td>55</td></tr></table>";</script>`;
    expect(sizeTableInEmbeddedHtml(html)).toEqual({ headers: ["사이즈", "총장", "가슴"], rows: [["M", "70", "55"]], unitHint: undefined });
  });
});
