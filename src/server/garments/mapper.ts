import type { Database } from "@/lib/supabase/database.types";
import { MEASUREMENT_KEYS, type MeasurementKey } from "@/lib/constants/measurements";
import { isFitLevel } from "@/lib/constants/body";
import { SHOE_FIT_LEVELS, shoeFitOrNull, type ShoeFitLevel } from "@/lib/constants/shoe-fit";
import type { CategoryId, Garment } from "@/lib/types/domain";
import type { GarmentInput } from "./schema";

export type GarmentRow = Database["public"]["Tables"]["garments"]["Row"];
type GarmentWrite = Database["public"]["Tables"]["garments"]["Update"];

/** 목록·상세에 필요한 열만 읽는다. */
export const GARMENT_COLUMNS =
  "id, category_id, subcategory_id, brand, product_name, size_label, color_name, seasons, purchased_on, purchase_price, product_url, image_path, thumb_path, m_length, m_shoulder, m_chest, m_sleeve, m_waist, m_hip, m_thigh, m_rise, m_leg_opening, m_head, m_depth, m_brim, shoe_fit_length, shoe_fit_width, shoe_fit_instep, user_fit, fit_review, created_at";

export type GarmentListRow = Pick<
  GarmentRow,
  | "id"
  | "category_id"
  | "subcategory_id"
  | "brand"
  | "product_name"
  | "size_label"
  | "color_name"
  | "seasons"
  | "purchased_on"
  | "purchase_price"
  | "product_url"
  | "image_path"
  | "thumb_path"
  | "m_length"
  | "m_shoulder"
  | "m_chest"
  | "m_sleeve"
  | "m_waist"
  | "m_hip"
  | "m_thigh"
  | "m_rise"
  | "m_leg_opening"
  | "m_head"
  | "m_depth"
  | "m_brim"
  | "shoe_fit_length"
  | "shoe_fit_width"
  | "shoe_fit_instep"
  | "user_fit"
  | "fit_review"
  | "created_at"
>;

const num = (v: number | string | null) => (v == null ? null : Number(v));
const level = (v: string | null) => (SHOE_FIT_LEVELS.includes(v as ShoeFitLevel) ? (v as ShoeFitLevel) : null);

/** 실측 키 → DB 열 */
const COLUMN: Record<MeasurementKey, keyof GarmentListRow & `m_${string}`> = {
  length: "m_length",
  shoulder: "m_shoulder",
  chest: "m_chest",
  sleeve: "m_sleeve",
  waist: "m_waist",
  hip: "m_hip",
  thigh: "m_thigh",
  rise: "m_rise",
  legOpening: "m_leg_opening",
  head: "m_head",
  depth: "m_depth",
  brim: "m_brim",
};

export function rowToGarment(row: GarmentListRow, urls: { imageUrl: string | null; thumbUrl: string | null }): Garment {
  const categoryId = row.category_id as CategoryId;
  const measurements: Garment["measurements"] = Object.fromEntries(
    MEASUREMENT_KEYS[categoryId].map((k) => [k, num(row[COLUMN[k]])]),
  );
  return {
    id: row.id,
    categoryId,
    subcategoryId: row.subcategory_id,
    brand: row.brand ?? "",
    productName: row.product_name,
    sizeLabel: row.size_label,
    colorName: row.color_name,
    seasons: row.seasons,
    purchasedOn: row.purchased_on,
    purchasePrice: row.purchase_price,
    productUrl: row.product_url,
    imageUrl: urls.imageUrl,
    thumbUrl: urls.thumbUrl,
    measurements,
    fitReview: row.fit_review,
    shoeFit:
      categoryId === "shoes"
        ? shoeFitOrNull({ length: level(row.shoe_fit_length), width: level(row.shoe_fit_width), instep: level(row.shoe_fit_instep) })
        : null,
    userFit: isFitLevel(row.user_fit) ? row.user_fit : null,
  };
}

/** 검증된 입력을 DB 열로 바꾼다. 대분류에 없는 실측 열은 null로 비운다. */
export function inputToRow(input: GarmentInput): GarmentWrite {
  const m = input.measurements;
  return {
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    brand: input.brand,
    product_name: input.productName,
    size_label: input.sizeLabel,
    color_name: input.colorName,
    color_source: input.colorName ? "manual" : null,
    seasons: input.seasons,
    purchased_on: input.purchasedOn,
    purchase_price: input.purchasePrice,
    product_url: input.productUrl,
    m_length: m.length ?? null,
    m_shoulder: m.shoulder ?? null,
    m_chest: m.chest ?? null,
    m_sleeve: m.sleeve ?? null,
    m_waist: m.waist ?? null,
    m_hip: m.hip ?? null,
    m_thigh: m.thigh ?? null,
    m_rise: m.rise ?? null,
    m_leg_opening: m.legOpening ?? null,
    m_head: m.head ?? null,
    m_depth: m.depth ?? null,
    m_brim: m.brim ?? null,
    shoe_fit_length: input.shoeFit?.length ?? null,
    shoe_fit_width: input.shoeFit?.width ?? null,
    shoe_fit_instep: input.shoeFit?.instep ?? null,
    user_fit: input.userFit,
    fit_review: input.fitReview,
  };
}
