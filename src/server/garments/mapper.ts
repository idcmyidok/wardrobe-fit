import type { Database } from "@/lib/supabase/database.types";
import type { CategoryId, Garment } from "@/lib/types/domain";
import type { GarmentInput } from "./schema";

export type GarmentRow = Database["public"]["Tables"]["garments"]["Row"];
type GarmentWrite = Database["public"]["Tables"]["garments"]["Update"];

/** 목록·상세에 필요한 열만 읽는다. */
export const GARMENT_COLUMNS =
  "id, category_id, subcategory_id, brand, product_name, size_label, color_name, material, seasons, purchased_on, purchase_price, product_url, image_path, thumb_path, m_length, m_shoulder, m_chest, m_sleeve, m_waist, m_hip, m_thigh, m_rise, m_leg_opening, fit_review, created_at";

export type GarmentListRow = Pick<
  GarmentRow,
  | "id"
  | "category_id"
  | "subcategory_id"
  | "brand"
  | "product_name"
  | "size_label"
  | "color_name"
  | "material"
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
  | "fit_review"
  | "created_at"
>;

const num = (v: number | string | null) => (v == null ? null : Number(v));

export function rowToGarment(row: GarmentListRow, urls: { imageUrl: string | null; thumbUrl: string | null }): Garment {
  const categoryId = row.category_id as CategoryId;
  const measurements: Garment["measurements"] =
    categoryId === "bottom"
      ? {
          length: num(row.m_length),
          waist: num(row.m_waist),
          hip: num(row.m_hip),
          thigh: num(row.m_thigh),
          rise: num(row.m_rise),
          legOpening: num(row.m_leg_opening),
        }
      : { length: num(row.m_length), shoulder: num(row.m_shoulder), chest: num(row.m_chest), sleeve: num(row.m_sleeve) };
  return {
    id: row.id,
    categoryId,
    subcategoryId: row.subcategory_id,
    brand: row.brand ?? "",
    productName: row.product_name,
    sizeLabel: row.size_label,
    colorName: row.color_name,
    material: row.material,
    seasons: row.seasons,
    purchasedOn: row.purchased_on,
    purchasePrice: row.purchase_price,
    productUrl: row.product_url,
    imageUrl: urls.imageUrl,
    thumbUrl: urls.thumbUrl,
    measurements,
    fitReview: row.fit_review,
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
    material: input.material,
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
    fit_review: input.fitReview,
  };
}
