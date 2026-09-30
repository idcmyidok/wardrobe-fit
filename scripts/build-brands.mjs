#!/usr/bin/env node
/**
 * 브랜드 자료(data/brands/brand-master.csv) → 서버 전용 JSON(src/server/roast/brands.json).
 * 엑셀(data/brands/brand-master.xlsx)을 고쳤으면 "CSV UTF-8"로 다시 저장한 뒤 `node scripts/build-brands.mjs`만 다시 돌린다.
 * 값을 숫자로 바꾸는 표는 AI 옷장 분석 계획서 4-3과 같다. 모르는 값이 있으면 멈추고 알려 준다.
 * "기타 태그"(예: 무신사 인기)만 있고 나머지 칸이 빈 행은 partial로 넣는다(태그 확인에만 쓰고 분석에서는 뺀다).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const CSV = `${root}data/brands/brand-master.csv`;
const OUT = `${root}src/server/roast/brands.json`;

const PRICE = { 저가: 1, 중저가: 2, 중가: 3, 중고가: 4, 고가: 5, 초고가: 6 };
const LEVEL = { "매우 낮음": 1, 낮음: 2, 중간: 3, 높음: 4, "매우 높음": 5 };
const TREND = { "매우 타임리스": 1, 타임리스: 2, 중간: 3, "트렌드 지향": 4, "매우 트렌드 지향": 5 };
const FORMAL = { "매우 캐주얼": 1, 캐주얼: 2, "캐주얼/포멀 혼합": 3, 포멀: 4, "매우 포멀": 5 };
const POP = { 컬트: 1, "마니아 중심": 2, "패션 관심층 중심": 3, 대중적: 4, "매우 대중적": 5 };

/** 따옴표·쉼표·줄바꿈을 지원하는 작은 CSV 읽기 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((v) => v.trim()));
}

const list = (v) => v.split(",").map((s) => s.trim()).filter(Boolean);
const errors = [];
const num = (table, v, name, col) => {
  const n = table[v.trim()];
  if (!n) errors.push(`${name}: ${col} "${v}"`);
  return n ?? 3;
};

const [header, ...rows] = parseCsv(readFileSync(CSV, "utf8").replace(/^﻿/, ""));
const col = (key) => {
  const i = header.findIndex((h) => h.trim() === key);
  if (i < 0) throw new Error(`CSV에 "${key}" 칸이 없습니다.`);
  return i;
};
const C = Object.fromEntries(
  ["브랜드명", "브랜드 별칭", "브랜드 국가", "설립 연도", "시장 포지션", "실제 가격 레벨", "주요 스타일 태그", "브랜드 유형", "대표 제품군", "유행 성향", "포멀도", "기능성 성향", "헤리티지 성향", "대중성", "접근성", "하이프 성향", "기타 태그"].map((k) => [k, col(k)]),
);

const brands = rows.map((r) => {
  const name = r[C["브랜드명"]].trim();
  const labels = list(r[C["기타 태그"]] ?? "");
  if (!r[C["실제 가격 레벨"]].trim() && !r[C["대중성"]].trim())
    return { name, aliases: list(r[C["브랜드 별칭"]]), country: r[C["브랜드 국가"]].trim(), labels, partial: true };
  const founded = Number.parseInt(r[C["설립 연도"]], 10);
  return {
    name,
    aliases: list(r[C["브랜드 별칭"]]),
    country: r[C["브랜드 국가"]].trim(),
    founded: Number.isFinite(founded) ? founded : null,
    positions: list(r[C["시장 포지션"]]),
    price: num(PRICE, r[C["실제 가격 레벨"]], name, "실제 가격 레벨"),
    tags: list(r[C["주요 스타일 태그"]]),
    types: list(r[C["브랜드 유형"]]),
    products: list(r[C["대표 제품군"]]),
    trend: num(TREND, r[C["유행 성향"]], name, "유행 성향"),
    formal: num(FORMAL, r[C["포멀도"]], name, "포멀도"),
    func: num(LEVEL, r[C["기능성 성향"]], name, "기능성 성향"),
    heritage: num(LEVEL, r[C["헤리티지 성향"]], name, "헤리티지 성향"),
    pop: num(POP, r[C["대중성"]], name, "대중성"),
    access: num(LEVEL, r[C["접근성"]], name, "접근성"),
    hype: num(LEVEL, r[C["하이프 성향"]], name, "하이프 성향"),
    labels,
  };
});

if (errors.length) {
  console.error(`모르는 값 ${errors.length}개:\n${errors.slice(0, 30).join("\n")}`);
  process.exit(1);
}
writeFileSync(OUT, `${JSON.stringify(brands)}\n`);
console.log(`브랜드 ${brands.length}개 → ${OUT.replace(root, "")}`);
