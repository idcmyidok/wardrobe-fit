import { BOTTOM_MEASUREMENTS, TOP_MEASUREMENTS, type MeasurementKey } from "@/lib/constants/measurements";
import type { Measurements } from "@/lib/types/domain";
import type { ImportWarning, MeasurementGroup, NormalizedSizeChart, RawSizeChart } from "../types";
import { cleanText } from "./text";

/**
 * 쇼핑몰 사이즈표 → 옷장 실측(PROJECT_SPEC.md 14.2). 옷장 표에 있는 항목만 남긴다.
 * 상의·아우터: 총장·어깨·가슴·소매 / 하의: 총장·허리·엉덩이·허벅지·밑위·밑단. 암홀, 상의 밑단, 인심 등은 버린다.
 */

/** 먼저 걸러 버리는 헤더. "소매"가 들어가도 소매통·소매단면은 소매 길이가 아니다. */
const DROP = /암홀|인심|안쪽기장|소매통|소매단|소매폭|소매너비|팔통|팔꿈치|목너비|목둘레|넥|armhole|inseam|sleeve\s*(width|opening)|neck|bicep/i;

const SYNONYMS: Array<[RegExp, MeasurementKey]> = [
  [/어깨|shoulder/i, "shoulder"],
  [/가슴|chest|bust|pit\s*to\s*pit|p2p/i, "chest"],
  [/소매|sleeve/i, "sleeve"],
  [/허리|waist/i, "waist"],
  [/엉덩이|힙|hip/i, "hip"],
  [/허벅지|thigh/i, "thigh"],
  [/밑위|rise/i, "rise"],
  [/밑단|hem|leg\s*opening|bottom\s*width/i, "legOpening"],
  [/총장|총기장|기장|length/i, "length"],
];

const BOTTOM_ONLY = new Set<MeasurementKey>(["waist", "hip", "thigh", "rise"]);

/** 헤더 한 칸을 실측 키로. 모르는 헤더는 null */
export function mapHeader(header: string): MeasurementKey | null {
  const h = cleanText(header).replace(/\s+/g, "");
  if (!h || DROP.test(h)) return null;
  for (const [re, key] of SYNONYMS) if (re.test(h)) return key;
  return null;
}

const isSizeHeader = (h: string) => /^(사이즈|size|구분|옵션|호수)?$/i.test(cleanText(h).replace(/\s+/g, ""));

/** "58~60" → 59(경고), "58.5cm" → 58.5, 숫자가 없으면 null */
function parseValue(cell: string): { value: number | null; range: boolean } {
  const text = cleanText(cell).replace(/,/g, ".");
  const range = text.match(/(\d+(?:\.\d+)?)\s*[~\-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return { value: (Number(range[1]) + Number(range[2])) / 2, range: true };
  const num = text.match(/-?\d+(?:\.\d+)?/);
  return { value: num ? Number(num[0]) : null, range: false };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** 단면으로 보기엔 너무 큰 값(둘레로 적힌 표). 단면 상식 범위의 약 2배 */
const CIRCUMFERENCE_OVER: Partial<Record<MeasurementKey, number>> = { chest: 90, waist: 65, hip: 80, thigh: 50 };

/** 사이즈가 열로, 실측이 행으로 놓인 표를 알아보고 뒤집는다. */
function orient(raw: RawSizeChart): RawSizeChart {
  const headerHits = raw.headers.filter((h) => mapHeader(h)).length;
  const columnHits = raw.rows.filter((r) => r[0] && mapHeader(r[0])).length;
  if (columnHits <= headerHits) return raw;
  const sizes = raw.headers.slice(1);
  return {
    unitHint: raw.unitHint,
    headers: ["사이즈", ...raw.rows.map((r) => r[0])],
    rows: sizes.map((size, i) => [size, ...raw.rows.map((r) => r[i + 1] ?? "")]),
  };
}

export function normalizeSizeChart(
  input: RawSizeChart,
  groupHint: MeasurementGroup | null,
): { chart: NormalizedSizeChart | null; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const raw = orient(input);
  if (raw.headers.length < 2 || raw.rows.length === 0) return { chart: null, warnings };

  const keys = raw.headers.map((h, i) => (i === 0 && isSizeHeader(h) ? null : mapHeader(h)));
  const group: MeasurementGroup = groupHint ?? (keys.some((k) => k && BOTTOM_ONLY.has(k)) ? "bottom" : "top");
  const allowed = new Set<MeasurementKey>(group === "bottom" ? BOTTOM_MEASUREMENTS : TOP_MEASUREMENTS);

  const inch =
    raw.unitHint === "inch" || raw.headers.some((h) => /\binch(es)?\b|\(in\)|"/i.test(h)) ? true : false;
  const circumferenceHeader = raw.headers.map((h) => /둘레|circumference/i.test(h));

  const unmapped = raw.headers.filter((h, i) => i > 0 && (!keys[i] || !allowed.has(keys[i]!)) && cleanText(h));
  let converted = false;
  let averaged = false;
  let dropped = false;
  let halved = false;

  const rows = raw.rows
    .filter((r) => cleanText(r[0] ?? ""))
    .map((r) => {
      const measurements: Measurements = {};
      keys.forEach((key, i) => {
        if (!key || !allowed.has(key) || measurements[key] != null) return;
        const { value, range } = parseValue(r[i] ?? "");
        if (value == null) return;
        let v = value;
        if (range) averaged = true;
        if (inch) {
          v *= 2.54;
          converted = true;
        }
        const over = CIRCUMFERENCE_OVER[key];
        if (circumferenceHeader[i] || (over != null && v > over)) {
          v /= 2;
          halved = true;
        }
        if (!(v > 0 && v < 200)) {
          dropped = true;
          return;
        }
        measurements[key] = round1(v);
      });
      return { sizeLabel: cleanText(r[0], 30), measurements };
    })
    .filter((row) => Object.keys(row.measurements).length > 0);

  if (!rows.length) return { chart: null, warnings };
  if (converted) warnings.push({ code: "size_chart_unit_converted", message: "사이즈표가 인치로 적혀 있어 cm로 바꿨습니다." });
  if (halved) warnings.push({ code: "circumference_converted", message: "둘레로 보이는 값을 단면(÷2)으로 바꿨습니다. 확인해 주세요." });
  if (averaged) warnings.push({ code: "range_value_averaged", message: "범위로 적힌 값은 중간값을 넣었습니다." });
  if (dropped) warnings.push({ code: "invalid_measurement_dropped", message: "읽을 수 없는 실측 값은 비웠습니다." });
  if (unmapped.length) {
    warnings.push({ code: "size_chart_unmapped_columns", message: `옷장에서 쓰지 않는 항목은 뺐습니다: ${unmapped.map((h) => cleanText(h)).join(", ")}` });
  }
  return { chart: { measurementGroup: group, rows, unmappedColumns: unmapped.map((h) => cleanText(h)) }, warnings };
}
