import type { Season } from "@/lib/types/domain";

export const SEASONS: { id: Season; name: string }[] = [
  { id: "spring", name: "봄" },
  { id: "summer", name: "여름" },
  { id: "fall", name: "가을" },
  { id: "winter", name: "겨울" },
];

export const SEASON_NAME: Record<Season, string> = {
  spring: "봄",
  summer: "여름",
  fall: "가을",
  winter: "겨울",
};
