import { z } from "zod";
import { SUBCATEGORIES } from "@/lib/constants/categories";
import { ALL_MEASUREMENT_KEYS, MEASUREMENT_KEYS, type MeasurementKey } from "@/lib/constants/measurements";
import type { Measurements } from "@/lib/types/domain";

/** POST /api/fit-checks 입력(PROJECT_SPEC.md 18.3). 화면과 서버가 같은 규칙으로 검증한다. */

export const MAX_FIT_SIZES = 3;

const measurement = z.number().gt(0).lt(200).transform((v) => Math.round(v * 10) / 10);
const ALL_KEYS = ALL_MEASUREMENT_KEYS;
const measurements = z.object(Object.fromEntries(ALL_KEYS.map((k) => [k, measurement.nullish()]))).strict();

const text = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => v?.trim() || null);

export const fitCandidateSchema = z
  .object({
    categoryId: z.enum(["outer", "top", "bottom", "hat", "shoes"]),
    subcategoryId: z.string().max(40).nullish().transform((v) => v || null),
    brand: text(100),
    productName: text(200),
    sizes: z
      .array(z.object({ sizeLabel: z.string().trim().min(1).max(30), measurements }))
      .min(1)
      .max(MAX_FIT_SIZES),
  })
  .superRefine((c, ctx) => {
    if (c.subcategoryId && !SUBCATEGORIES.some((s) => s.id === c.subcategoryId && s.categoryId === c.categoryId))
      ctx.addIssue({ code: "custom", path: ["subcategoryId"], message: "세부분류가 대분류와 맞지 않습니다." });
    const allowed = MEASUREMENT_KEYS[c.categoryId];
    c.sizes.forEach((s, i) => {
      for (const [k, v] of Object.entries(s.measurements))
        if (v != null && !allowed.includes(k as MeasurementKey))
          ctx.addIssue({ code: "custom", path: ["sizes", i, "measurements", k], message: "대분류에 없는 실측입니다." });
    });
    const labels = c.sizes.map((s) => s.sizeLabel.toLowerCase());
    if (new Set(labels).size !== labels.length) ctx.addIssue({ code: "custom", path: ["sizes"], message: "같은 사이즈를 두 번 골랐습니다." });
  })
  .transform((c) => ({
    ...c,
    sizes: c.sizes.map((s) => ({
      sizeLabel: s.sizeLabel,
      measurements: Object.fromEntries(Object.entries(s.measurements).filter(([, v]) => v != null)) as Measurements,
    })),
  }));

export const fitRequestSchema = z.object({
  candidate: fitCandidateSchema,
  importId: z.uuid().nullish(),
  excludedGarmentIds: z.array(z.uuid()).max(200).default([]),
});

export type FitRequest = z.infer<typeof fitRequestSchema>;
