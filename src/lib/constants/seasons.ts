import type { Season } from "@/lib/types/domain";

export const SEASONS: { id: Season; name: string }[] = [
  { id: "spring", name: "봄" },
  { id: "summer", name: "여름" },
  { id: "fall", name: "가을" },
  { id: "winter", name: "겨울" },
  { id: "all", name: "사계절" },
];

/** 봄~겨울 네 계절. 계절별 통계처럼 "사계절"을 따로 세지 않을 때 쓴다. */
export const FOUR_SEASONS = SEASONS.filter((s) => s.id !== "all");

export const SEASON_NAME: Record<Season, string> = {
  spring: "봄",
  summer: "여름",
  fall: "가을",
  winter: "겨울",
  all: "사계절",
};

/**
 * 시즌 선택 토글. "사계절"과 개별 계절은 함께 고르지 않는다.
 * 네 계절을 모두 고르면 "사계절"로 바꾼다.
 */
export function toggleSeason(current: Season[], id: Season): Season[] {
  if (id === "all") return current.includes("all") ? [] : ["all"];
  const rest: Season[] = current.filter((s) => s !== "all");
  const next = rest.includes(id) ? rest.filter((s) => s !== id) : [...rest, id];
  return FOUR_SEASONS.every((s) => next.includes(s.id)) ? ["all"] : next;
}

/** 옷이 그 계절에 입는 옷인지. "사계절" 옷은 모든 계절에 포함된다. */
export function wearsInSeason(seasons: Season[], id: Season) {
  return seasons.includes(id) || (id !== "all" && seasons.includes("all"));
}
