import { z } from "zod";
import { SUBCATEGORIES } from "@/lib/constants/categories";
import { normalizeColorName } from "@/lib/constants/colors";
import { BOTTOM_MEASUREMENTS, TOP_MEASUREMENTS, type MeasurementKey } from "@/lib/constants/measurements";
import { FOUR_SEASONS } from "@/lib/constants/seasons";
import type { Measurements, Season } from "@/lib/types/domain";

/**
 * 옷 등록·수정 입력 검증(PROJECT_SPEC.md 22장 5단계: 서버 측 Zod 검증).
 * DB check 제약과 같은 규칙을 먼저 걸러서 사용자에게 알아볼 수 있는 문구로 돌려준다.
 */

/** 앞뒤 공백을 지우고 빈 값은 null로 저장하는 선택 입력 */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null)
    .refine((v) => v == null || v.length <= max, `${label}은(는) ${max}자 이하로 입력해 주세요.`);

const measurement = z
  .number({ error: "실측은 숫자로 입력해 주세요." })
  .gt(0, "실측은 0보다 커야 합니다.")
  .lt(200, "실측은 200cm보다 작아야 합니다.")
  .transform((v) => Math.round(v * 10) / 10)
  .nullish();

const ALL_KEYS = [...new Set<MeasurementKey>([...TOP_MEASUREMENTS, ...BOTTOM_MEASUREMENTS])];

const isValidDate = (v: string) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

export const garmentInputSchema = z
  .object({
    categoryId: z.enum(["outer", "top", "bottom"], { error: "대분류를 선택해 주세요." }),
    subcategoryId: z.string().nullish().transform((v) => v || null),
    brand: optionalText(100, "브랜드"),
    productName: z
      .string({ error: "제품명을 입력해 주세요." })
      .trim()
      .min(1, "제품명을 입력해 주세요.")
      .max(200, "제품명은 200자 이하로 입력해 주세요."),
    sizeLabel: optionalText(30, "사이즈"),
    /** 컬러는 어떻게 적든 한글 표기로 저장한다("black" → "블랙"). */
    colorName: optionalText(50, "컬러").transform(normalizeColorName),
    seasons: z.array(z.enum(["spring", "summer", "fall", "winter", "all"])).max(5).default([]),
    purchasedOn: z
      .string()
      .nullish()
      .transform((v) => v || null)
      .refine((v) => v == null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && isValidDate(v)), "구매 날짜를 확인해 주세요."),
    purchasePrice: z
      .number({ error: "구매가는 숫자로 입력해 주세요." })
      .int("구매가는 원 단위 정수로 입력해 주세요.")
      .min(0, "구매가는 0원 이상이어야 합니다.")
      .max(100_000_000, "구매가를 확인해 주세요.")
      .nullish()
      .transform((v) => v ?? null),
    productUrl: optionalText(2048, "상품 링크").refine((v) => {
      if (v == null) return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    }, "상품 링크는 http:// 또는 https://로 시작하는 주소여야 합니다."),
    measurements: z.partialRecord(z.enum(ALL_KEYS as [MeasurementKey, ...MeasurementKey[]]), measurement).default({}),
    fitReview: optionalText(2000, "착용 후기"),
    /** 링크 분석으로 등록할 때 그 분석 기록(product_imports) id. 등록할 때만 쓴다. */
    sourceImportId: z.uuid().nullish().transform((v) => v ?? null),
  })
  .superRefine((v, ctx) => {
    if (v.subcategoryId && !SUBCATEGORIES.some((s) => s.id === v.subcategoryId && s.categoryId === v.categoryId)) {
      ctx.addIssue({ code: "custom", path: ["subcategoryId"], message: "세부분류가 대분류와 맞지 않습니다." });
    }
    if (new Set(v.seasons).size !== v.seasons.length) {
      ctx.addIssue({ code: "custom", path: ["seasons"], message: "시즌이 중복되었습니다." });
    }
  })
  .transform((v) => {
    // 대분류에 없는 실측은 버린다(대분류를 바꾸고 저장해도 다른 분류 실측이 남지 않게).
    const allowed: readonly MeasurementKey[] = v.categoryId === "bottom" ? BOTTOM_MEASUREMENTS : TOP_MEASUREMENTS;
    const measurements: Measurements = {};
    for (const key of allowed) measurements[key] = v.measurements[key] ?? null;
    return { ...v, measurements, seasons: normalizeSeasons(v.seasons) };
  });

export type GarmentInput = z.output<typeof garmentInputSchema>;

/** 사계절은 단독으로만. 네 계절을 모두 고르면 사계절로 저장한다. */
function normalizeSeasons(seasons: Season[]): Season[] {
  if (seasons.includes("all")) return ["all"];
  if (FOUR_SEASONS.every((s) => seasons.includes(s.id))) return ["all"];
  return FOUR_SEASONS.map((s) => s.id).filter((id) => seasons.includes(id));
}

export const garmentIdSchema = z.uuid();
