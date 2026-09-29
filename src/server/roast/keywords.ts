import "server-only";

/** 제품명 → 제품군(계획서 5-3). 한 옷이 여러 제품군에 들 수 있다. */
export const FAMILIES = {
  cargo: { name: "카고", words: ["카고", "cargo"] },
  layered: { name: "레이어드", words: ["레이어드", "layered", "layer"] },
  hood: { name: "후드", words: ["후드", "후디", "hoodie", "hooded", "hood"] },
  zip: { name: "집업", words: ["집업", "지퍼", "zip-up", "zip up", "zipup", "full zip"] },
  wide: { name: "와이드", words: ["와이드", "wide"] },
  denim: { name: "데님", words: ["데님", "청바지", "연청", "중청", "진청", "흑청", "denim", "jean"] },
  straight: { name: "스트레이트", words: ["스트레이트", "straight"] },
  oversize: { name: "오버사이즈", words: ["오버사이즈", "오버핏", "빅사이즈", "oversize", "oversized", "over fit", "overfit"] },
  graphic: { name: "그래픽 티", words: ["그래픽", "프린트", "로고 티", "graphic", "printed", "logo tee"] },
  knit: { name: "니트", words: ["니트", "스웨터", "knit", "sweater"] },
  cardigan: { name: "카디건", words: ["카디건", "가디건", "cardigan"] },
  shirt: { name: "셔츠", words: ["셔츠", "shirt"] },
  flannel: { name: "플란넬", words: ["플란넬", "체크 셔츠", "flannel"] },
  runner: { name: "러너", words: ["러너", "러닝", "runner", "running"] },
  sneaker: { name: "스니커즈", words: ["스니커즈", "스니커", "sneaker"] },
  loafer: { name: "로퍼", words: ["로퍼", "loafer"] },
  derby: { name: "더비", words: ["더비", "derby"] },
  boot: { name: "부츠", words: ["부츠", "워커", "boot"] },
  leather: { name: "레더", words: ["레더", "가죽", "leather"] },
  nylon: { name: "나일론", words: ["나일론", "nylon"] },
  stripe: { name: "스트라이프", words: ["스트라이프", "줄무늬", "stripe"] },
  washed: { name: "워싱", words: ["워싱", "워시드", "피그먼트", "washed", "wash", "pigment"] },
  damaged: { name: "데미지", words: ["데미지", "디스트로이드", "damaged", "distressed", "destroyed"] },
  parachute: { name: "파라슈트", words: ["파라슈트", "parachute"] },
  track: { name: "트랙", words: ["트랙", "track"] },
  balloon: { name: "벌룬", words: ["벌룬", "balloon"] },
} as const;

export type FamilyId = keyof typeof FAMILIES;
export const FAMILY_IDS = Object.keys(FAMILIES) as FamilyId[];
export const familyName = (id: FamilyId) => FAMILIES[id].name;

/** "티셔츠"가 셔츠로 잡히지 않게 먼저 지운다. */
const NOT_SHIRT = /티셔츠|t-shirt|tshirt|t shirt|sweatshirt|스웨트셔츠|맨투맨/gi;

export function productFamilies(name: string | null | undefined): FamilyId[] {
  const text = (name ?? "").toLowerCase();
  if (!text.trim()) return [];
  const out: FamilyId[] = [];
  for (const id of FAMILY_IDS) {
    const target = id === "shirt" ? text.replace(NOT_SHIRT, " ") : text;
    if (FAMILIES[id].words.some((w) => target.includes(w))) out.push(id);
  }
  return out;
}
