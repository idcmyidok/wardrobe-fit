import { z } from "zod";
import { BODY_FIELDS, BODY_KEYS, WEARABLE_LEVELS, type BodyKey } from "@/lib/constants/body";
import { FIT_GROUPS, type FitGroupId, type FitOverrides, type RecKey } from "@/lib/fit/body-fit";

/** 내 치수 입력 검증. 범위는 DB check(migration 14)와 같다. 모두 선택 입력. */
const bodyValue = (key: BodyKey) => {
  const f = BODY_FIELDS.find((x) => x.key === key)!;
  return z
    .number({ error: `${f.label}은(는) 숫자로 입력해 주세요.` })
    .min(f.min, `${f.label}은(는) ${f.min}${f.unit} 이상으로 입력해 주세요.`)
    .max(f.max, `${f.label}은(는) ${f.max}${f.unit} 이하로 입력해 주세요.`)
    .transform((v) => Math.round(v * 10) / 10)
    .nullish()
    .transform((v) => v ?? null);
};

export const bodyInputSchema = z.object({
  values: z.object(Object.fromEntries(BODY_KEYS.map((k) => [k, bodyValue(k)])) as Record<BodyKey, ReturnType<typeof bodyValue>>),
  uncertain: z.array(z.enum(BODY_KEYS)).max(BODY_KEYS.length).default([]).transform((v) => [...new Set(v)]),
  /** 처음 저장할 때 신체정보 수집·이용 동의(선택) */
  consent: z.boolean().default(false),
});
export type BodyInput = z.output<typeof bodyInputSchema>;

const REC_KEYS = ["shoulder", "chest", "waist", "hip", "thigh"] as const satisfies readonly RecKey[];
/** 예전에 저장된 총장·소매 수정값은 받아 두기만 하고 계산에는 쓰지 않는다. */
const LEGACY_REC_KEYS = ["length", "sleeve"] as const;
const GROUP_IDS = FIT_GROUPS.map((g) => g.id) as [FitGroupId, ...FitGroupId[]];

const band = z
  .tuple([z.number().gt(0).lt(200), z.number().gt(0).lt(200)])
  .transform(([a, b]) => [Math.round(Math.min(a, b) * 10) / 10, Math.round(Math.max(a, b) * 10) / 10] as [number, number]);

/** 사용자가 고친 추천 치수 */
export const overridesSchema = z.partialRecord(
  z.enum(GROUP_IDS),
  z.partialRecord(z.enum(WEARABLE_LEVELS), z.partialRecord(z.enum([...REC_KEYS, ...LEGACY_REC_KEYS]), band)),
) as unknown as z.ZodType<FitOverrides>;
