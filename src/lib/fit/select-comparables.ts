import { SIMILAR_SUBCATEGORIES } from "@/lib/constants/categories";
import { MEASUREMENT_KEYS, type MeasurementKey } from "@/lib/constants/measurements";
import type { CategoryId, Garment, Measurements } from "@/lib/types/domain";
import { shoeSizeMm } from "./shoes";
import type { MatchLevel } from "./types";

/**
 * 비교 대상 고르기(PROJECT_SPEC.md 15장 [1]). 순수 함수라 화면(Step 2 미리보기)과 서버가 같이 쓴다.
 * 동일 세부분류 → (쓸 수 있는 옷이 3벌 미만이면) 같은 대분류 → (그래도 부족하면) 유사 세부분류.
 * 신규 상품과 실측이 2개 이상 겹치는 옷만 비교에 쓴다.
 */

export const MIN_COMPARABLES = 3;
export const MAX_COMPARABLES = 10;
export const MIN_SHARED_DIMS = 2;

export const measurementKeysFor = (categoryId: CategoryId): readonly MeasurementKey[] => MEASUREMENT_KEYS[categoryId];

/** 아우터·상의는 같은 치수 그룹이라 서로 비교한다. 모자·신발은 옷과 비교하지 않는다. */
const groupOf = (categoryId: CategoryId) => (categoryId === "outer" ? "top" : categoryId);

/** 후보 사이즈들 중 하나라도 값이 있는 치수 */
export function candidateKeys(categoryId: CategoryId, sizes: Array<{ measurements: Measurements }>): MeasurementKey[] {
  return measurementKeysFor(categoryId).filter((k) => sizes.some((s) => s.measurements[k] != null));
}

export interface SelectedComparable {
  garment: Garment;
  matchLevel: MatchLevel;
  sharedDims: number;
}

export interface Selection {
  /** 비교에 쓸 옷(최대 10벌, 가까운 분류 순) */
  selected: SelectedComparable[];
  /** 분류는 맞지만 실측이 겹치지 않아 뺀 옷 */
  lacking: Garment[];
}

export function selectComparables(
  candidate: { categoryId: CategoryId; subcategoryId: string | null; sizes: Array<{ measurements: Measurements }> },
  garments: Garment[],
): Selection {
  const keys = candidateKeys(candidate.categoryId, candidate.sizes);
  const group = groupOf(candidate.categoryId);
  // 신발은 실측 대신 사이즈(mm)를 읽을 수 있어야 비교한다.
  const shoes = candidate.categoryId === "shoes";
  const shared = (g: Garment) => (shoes ? (shoeSizeMm(g.sizeLabel) != null ? MIN_SHARED_DIMS : 0) : keys.filter((k) => g.measurements[k] != null).length);

  const levelOf = (g: Garment): MatchLevel | null => {
    if (groupOf(g.categoryId) !== group) return null;
    if (candidate.subcategoryId && g.subcategoryId === candidate.subcategoryId) return "subcategory";
    if (g.categoryId === candidate.categoryId) return "category";
    if (candidate.subcategoryId && g.subcategoryId && SIMILAR_SUBCATEGORIES[candidate.subcategoryId]?.includes(g.subcategoryId)) return "similar";
    return null;
  };

  const byLevel: Record<MatchLevel, SelectedComparable[]> = { subcategory: [], category: [], similar: [] };
  const lackingByLevel: Record<MatchLevel, Garment[]> = { subcategory: [], category: [], similar: [] };
  for (const g of garments) {
    const level = levelOf(g);
    if (!level) continue;
    const n = shared(g);
    if (n >= MIN_SHARED_DIMS) byLevel[level].push({ garment: g, matchLevel: level, sharedDims: n });
    else lackingByLevel[level].push(g);
  }

  const selected: SelectedComparable[] = [];
  const lacking: Garment[] = [];
  // 세부분류가 없으면 같은 대분류부터 본다.
  const order: MatchLevel[] = candidate.subcategoryId ? ["subcategory", "category", "similar"] : ["category", "similar"];
  for (const level of order) {
    if (selected.length >= MIN_COMPARABLES) break;
    selected.push(...byLevel[level].sort((a, b) => b.sharedDims - a.sharedDims));
    lacking.push(...lackingByLevel[level]);
  }
  return { selected: selected.slice(0, MAX_COMPARABLES), lacking };
}
