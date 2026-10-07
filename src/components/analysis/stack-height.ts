import { CATEGORIES } from "@/lib/constants/categories";
import type { CategoryId, Garment } from "@/lib/types/domain";

/** 접어서 쌓았을 때 한 벌의 평균 두께(cm). 세부분류별이고, 없으면 대분류 평균을 쓴다. */
const THICKNESS: Record<string, number> = {
  "outer.hood_zip": 6, "outer.blouson": 6, "outer.leather": 6, "outer.blazer": 5, "outer.cardigan": 3,
  "outer.light_padding": 5, "outer.safari": 4, "outer.trucker": 4, "outer.stadium": 5, "outer.coach": 2.5,
  "outer.training": 3, "outer.anorak": 3, "outer.fleece": 5, "outer.transition_coat": 6, "outer.vest": 3,
  "outer.mustang": 10, "outer.single_coat": 7, "outer.double_coat": 8, "outer.winter_coat": 7,
  "outer.short_padding": 12, "outer.long_padding": 15, "outer.shirt": 2, "outer.etc": 5,
  "top.long_tee": 1.5, "top.sweatshirt": 3, "top.hoodie": 5, "top.short_tee": 1, "top.polo": 1.5,
  "top.knit": 4, "top.sleeveless": 0.8, "top.etc": 2,
  "bottom.denim": 4, "bottom.chino": 3, "bottom.slacks": 3, "bottom.sweatpants": 3.5, "bottom.shorts": 2,
  "bottom.leggings": 1, "bottom.jumpsuit": 5, "bottom.etc": 3,
  "hat.cap": 8, "hat.beanie": 4, "hat.etc": 6,
  "shoes.sneakers": 12, "shoes.sports": 12, "shoes.dress": 11, "shoes.boots": 15, "shoes.sandals": 6, "shoes.etc": 12,
};
const CATEGORY_THICKNESS: Record<CategoryId, number> = { outer: 6, top: 2, bottom: 3, hat: 6, shoes: 12 };

/** 구간별로 비슷한 높이의 것. 오름차순. art는 stack-art.tsx의 그림 이름. */
export const LANDMARKS: { cm: number; art: string; name: string; desc: string }[] = [
  { cm: 7, art: "baseball", name: "야구공", desc: "야구공 하나 정도 높이입니다. 한 손에 쏙 들어오는 크기입니다." },
  { cm: 12, art: "can", name: "캔 음료", desc: "캔 음료 하나를 세워 놓은 높이입니다. 책상 위에 올려 둔 컵 정도입니다." },
  { cm: 21, art: "bottle", name: "500mL 생수병", desc: "500mL 생수병을 세운 높이입니다. 가방 옆 주머니에 꽂아 두는 그 병입니다." },
  { cm: 30, art: "ruler", name: "30cm 자", desc: "학교에서 쓰던 30cm 자 하나를 세운 높이입니다." },
  { cm: 38, art: "shiba", name: "시바견", desc: "시바견이 네 발로 섰을 때 어깨 높이와 비슷합니다." },
  { cm: 50, art: "baby", name: "신생아", desc: "갓 태어난 아기의 키와 비슷한 높이입니다." },
  { cm: 58, art: "retriever", name: "골든리트리버", desc: "다 자란 골든리트리버의 어깨 높이와 비슷합니다." },
  { cm: 73, art: "desk", name: "책상", desc: "일반 책상 높이입니다. 옷 더미 위에 노트북을 올려 쓸 수 있을 정도입니다." },
  { cm: 95, art: "toddler", name: "세 살 아이", desc: "세 살 아이의 키와 비슷한 높이입니다." },
  { cm: 120, art: "kid", name: "초등학교 1학년", desc: "초등학교 1학년 아이의 키와 비슷한 높이입니다." },
  { cm: 165, art: "adult", name: "성인 평균 키", desc: "성인 평균 키와 비슷한 높이입니다. 옷 더미와 나란히 서면 눈높이가 비슷합니다." },
  { cm: 207, art: "tall", name: "서장훈 선수", desc: "농구선수 서장훈 선수의 키(약 207cm)와 비슷한 높이입니다." },
  { cm: 250, art: "ceiling", name: "아파트 천장", desc: "아파트 천장 높이(약 2.3~2.5m)와 비슷합니다. 방 천장에 닿을 만큼 쌓였습니다." },
  { cm: 305, art: "hoop", name: "농구 골대", desc: "농구 골대 높이(305cm)와 같습니다. 덩크를 할 수 있는 높이입니다." },
  { cm: 400, art: "bus", name: "2층 버스", desc: "2층 버스 높이(약 4m)와 비슷합니다." },
  { cm: 500, art: "giraffe", name: "기린", desc: "기린의 키(약 5m)와 비슷한 높이입니다." },
  { cm: 700, art: "house", name: "2층 주택", desc: "2층 주택의 지붕 높이(약 7m)와 비슷합니다." },
  { cm: 1000, art: "building", name: "3층 건물", desc: "3층 건물 높이(약 10m)와 비슷합니다." },
  { cm: 2000, art: "apartment", name: "6~7층 아파트", desc: "6~7층 아파트 높이(약 20m)와 비슷합니다." },
];

export function thicknessOf(g: Pick<Garment, "categoryId" | "subcategoryId">) {
  return (g.subcategoryId && THICKNESS[g.subcategoryId]) || CATEGORY_THICKNESS[g.categoryId] || 3;
}

/** 두께는 접는 방식에 따라 달라지므로 ±15%를 범위로 보여 준다. */
export function formatHeight(cm: number) {
  if (cm < 100) return `${Math.round(cm)}cm`;
  const m = cm / 100;
  return `${m >= 10 ? Math.round(m) : m.toFixed(1)}m`;
}

export function stackSummary(G: Garment[]) {
  const byCategory = CATEGORIES.map((c) => {
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
