import { CATEGORIES, SUBCATEGORIES } from "@/lib/constants/categories";
import type { CategoryId, Garment } from "@/lib/types/domain";

/** 접지 않고 펼친 그대로 포개 쌓았을 때 한 벌의 평균 두께(cm). 세부분류별이고, 없으면 대분류 평균을 쓴다. 모자·신발은 계산에 넣지 않는다. */
const THICKNESS: Record<string, number> = {
  "outer.hood_zip": 3, "outer.blouson": 3, "outer.leather": 3, "outer.blazer": 2.5, "outer.cardigan": 1.5,
  "outer.light_padding": 3, "outer.safari": 2, "outer.trucker": 2, "outer.stadium": 2.5, "outer.coach": 1,
  "outer.training": 1.5, "outer.anorak": 1.5, "outer.fleece": 2.5, "outer.transition_coat": 3, "outer.vest": 1.5,
  "outer.mustang": 5, "outer.single_coat": 3.5, "outer.double_coat": 4, "outer.winter_coat": 3.5,
  "outer.short_padding": 6, "outer.long_padding": 8, "outer.shirt": 0.8, "outer.etc": 2.5,
  "top.long_tee": 0.8, "top.sweatshirt": 1.5, "top.hoodie": 2.5, "top.short_tee": 0.5, "top.polo": 0.8,
  "top.knit": 2, "top.sleeveless": 0.4, "top.etc": 1,
  "bottom.denim": 1.5, "bottom.chino": 1, "bottom.slacks": 1, "bottom.sweatpants": 1.5, "bottom.shorts": 0.8,
  "bottom.leggings": 0.5, "bottom.jumpsuit": 2, "bottom.etc": 1,
};
const CATEGORY_THICKNESS: Partial<Record<CategoryId, number>> = { outer: 3, top: 1, bottom: 1.2 };
/** 쌓는 계산에 넣는 대분류(모자·신발 제외) */
const STACKED: CategoryId[] = ["outer", "top", "bottom"];

/** 구간별로 비슷한 높이의 것. 오름차순. art는 stack-art.tsx의 그림 이름. */
export const LANDMARKS: { cm: number; art: string; name: string; desc: string }[] = [
  { cm: 2, art: "coins", name: "500원 동전 10개", desc: "500원 동전 열 개를 포갠 높이입니다. 손톱 하나 두께쯤 됩니다." },
  { cm: 4, art: "pingpong", name: "탁구공", desc: "탁구공 하나의 지름과 비슷합니다." },
  { cm: 6, art: "tennis", name: "테니스공", desc: "테니스공 하나의 지름과 비슷합니다." },
  { cm: 7, art: "baseball", name: "야구공", desc: "야구공 하나 정도 높이입니다. 한 손에 쏙 들어오는 크기입니다." },
  { cm: 10, art: "mug", name: "머그컵", desc: "머그컵 하나를 세워 놓은 높이입니다." },
  { cm: 12, art: "can", name: "캔 음료", desc: "캔 음료 하나를 세워 놓은 높이입니다." },
  { cm: 15, art: "phone", name: "스마트폰", desc: "스마트폰을 세로로 세운 높이와 비슷합니다." },
  { cm: 18, art: "pencil", name: "연필", desc: "새 연필 한 자루 길이와 비슷합니다." },
  { cm: 21, art: "bottle", name: "500mL 생수병", desc: "500mL 생수병을 세운 높이입니다. 가방 옆 주머니에 꽂아 두는 그 병입니다." },
  { cm: 24, art: "basketball", name: "농구공", desc: "농구공 하나의 지름과 비슷합니다." },
  { cm: 30, art: "a4", name: "A4 용지", desc: "A4 용지의 긴 변(약 30cm)과 같은 높이입니다." },
  { cm: 38, art: "shiba", name: "시바견", desc: "시바견이 네 발로 섰을 때 어깨 높이와 비슷합니다." },
  { cm: 50, art: "baby", name: "신생아", desc: "갓 태어난 아기의 키와 비슷한 높이입니다." },
  { cm: 58, art: "retriever", name: "골든리트리버", desc: "다 자란 골든리트리버의 어깨 높이와 비슷합니다." },
  { cm: 73, art: "desk", name: "책상", desc: "일반 책상 높이입니다. 옷 더미 위에 노트북을 올려 쓸 수 있을 정도입니다." },
  { cm: 87, art: "counter", name: "싱크대 상판", desc: "주방 싱크대 상판 높이(약 85~90cm)와 비슷합니다." },
  { cm: 95, art: "toddler", name: "세 살 아이", desc: "세 살 아이의 키와 비슷한 높이입니다." },
  { cm: 120, art: "kid", name: "초등학교 1학년", desc: "초등학교 1학년 아이의 키와 비슷한 높이입니다." },
  { cm: 150, art: "schooler", name: "초등학교 6학년", desc: "초등학교 6학년 평균 키(약 150cm)와 비슷한 높이입니다." },
  { cm: 165, art: "adult", name: "성인 평균 키", desc: "성인 평균 키와 비슷한 높이입니다. 옷 더미와 나란히 서면 눈높이가 비슷합니다." },
  { cm: 180, art: "fridge", name: "양문형 냉장고", desc: "양문형 냉장고 높이(약 180cm)와 비슷합니다." },
  { cm: 207, art: "tall", name: "서장훈 선수", desc: "농구선수 서장훈 선수의 키(약 207cm)와 비슷한 높이입니다." },
  { cm: 230, art: "ceiling", name: "아파트 천장", desc: "아파트 천장 높이(약 2.3m)와 비슷합니다. 방 천장에 닿을 만큼 쌓였습니다." },
  { cm: 305, art: "hoop", name: "농구 골대", desc: "농구 골대 높이(305cm)와 같습니다. 덩크를 할 수 있는 높이입니다." },
  { cm: 400, art: "bus", name: "2층 버스", desc: "2층 버스 높이(약 4m)와 비슷합니다." },
  { cm: 500, art: "giraffe", name: "기린", desc: "기린의 키(약 5m)와 비슷한 높이입니다." },
  { cm: 700, art: "house", name: "2층 주택", desc: "2층 주택의 지붕 높이(약 7m)와 비슷합니다." },
  { cm: 1000, art: "building", name: "3층 건물", desc: "3층 건물 높이(약 10m)와 비슷합니다." },
  { cm: 2000, art: "apartment", name: "6~7층 아파트", desc: "6~7층 아파트 높이(약 20m)와 비슷합니다." },
];

/** 종류별 두께 표: 쌓는 대분류별로 세부분류마다 두께(cm)만 담는다. */
export function thicknessTable() {
  return CATEGORIES.filter((c) => STACKED.includes(c.id)).map((c) => ({
    id: c.id,
    name: c.name,
    rows: SUBCATEGORIES.filter((s) => s.categoryId === c.id).map((s) => ({
      id: s.id,
      name: s.name,
      cm: THICKNESS[s.id] ?? CATEGORY_THICKNESS[c.id] ?? 0,
    })),
  }));
}

export function thicknessOf(g: Pick<Garment, "categoryId" | "subcategoryId">) {
  return (g.subcategoryId && THICKNESS[g.subcategoryId]) || CATEGORY_THICKNESS[g.categoryId] || 0;
}

/** 100cm 미만은 cm, 이상은 m로 보여 준다. */
export function formatHeight(cm: number) {
  if (cm < 10) return `${Number(cm.toFixed(1))}cm`;
  if (cm < 100) return `${Math.round(cm)}cm`;
  const m = cm / 100;
  return `${m >= 10 ? Math.round(m) : m.toFixed(1)}m`;
}

export function stackSummary(all: Garment[]) {
  const G = all.filter((g) => STACKED.includes(g.categoryId));
  const byCategory = CATEGORIES.filter((c) => STACKED.includes(c.id)).map((c) => {
    const list = G.filter((g) => g.categoryId === c.id);
    return { id: c.id, name: c.name, count: list.length, cm: list.reduce((s, g) => s + thicknessOf(g), 0) };
  }).filter((x) => x.count > 0);
  const total = byCategory.reduce((s, x) => s + x.cm, 0);
  const low = total * 0.85;
  const high = total * 1.15;
  // 가운데 값과 가장 가까운 것을 비슷한 높이로 본다.
  const near = LANDMARKS.reduce((a, b) => (Math.abs(Math.log(b.cm / total)) < Math.abs(Math.log(a.cm / total)) ? b : a));
  return {
    total,
    range: G.length ? (formatHeight(low) === formatHeight(high) ? formatHeight(total) : `${formatHeight(low)}~${formatHeight(high)}`) : "—",
    near: G.length ? near : null,
    byCategory,
  };
}
