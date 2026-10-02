// LLM 분류 결과(out-NNN.txt)와 무신사 좋아요를 data/brands/brand-master.csv 에 반영한다.
//  - 기존 행: 값은 바꾸지 않고 "무신사 ID"/"무신사 좋아요" 칸만 채운다(이름·별칭이 무신사 브랜드와 일치할 때).
//  - 새 브랜드: out 파일의 정상 행을 뒤에 추가(이미 있으면 건너뜀). 허용값이 아니면 그 행은 건너뛰고 보고한다.
// 사용: node scripts/musinsa/merge-brands.mjs <배치폴더>   → 그 뒤 node scripts/build-brands.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = process.argv[2];
const MASTER = 'data/brands/brand-master.csv';
const H = ['브랜드명', '브랜드 별칭', '브랜드 국가', '설립 연도', '시장 포지션', '실제 가격 레벨', '주요 스타일 태그', '브랜드 유형', '대표 제품군', '유행 성향', '포멀도', '기능성 성향', '헤리티지 성향', '대중성', '접근성', '하이프 성향', '기타 태그'];
const EXTRA = ['무신사 ID', '무신사 좋아요'];
const LEVEL = ['매우 낮음', '낮음', '중간', '높음', '매우 높음'];
const ENUM = {
  price: ['저가', '중저가', '중가', '중고가', '고가', '초고가'],
  trend: ['매우 타임리스', '타임리스', '중간', '트렌드 지향', '매우 트렌드 지향'],
  formal: ['매우 캐주얼', '캐주얼', '캐주얼/포멀 혼합', '포멀', '매우 포멀'],
  pop: ['컬트', '마니아 중심', '패션 관심층 중심', '대중적', '매우 대중적'],
  pos: ['스트릿', '디자이너', '컨템포러리', '전문 브랜드', '프리미엄 캐주얼', '매스마켓', '스포츠', '아웃도어', '럭셔리', '프리미엄', '헤리티지 럭셔리', 'SPA', '하이엔드 디자이너', '캐주얼', '굿즈'],
  tags: ['스트릿', '클래식', '미니멀', '페미닌', '베이직', '컨템포러리', '스포츠', '레트로', '아웃도어', '테일러링', '로고플레이', '로맨틱', '아메카지', '아방가르드', '데님', '빈티지', '럭셔리', '워크웨어', '스케이트', 'Y2K', '조용한 럭셔리', '프레피', '기능성', '펑크', '고프코어', '아이비', '애슬레저', '유틸리티', '밀리터리', '다크웨어', '서프', '테크웨어', '해체주의', '골프', '웨스턴', '젠더리스', '모드', '그런지', '고딕'],
  types: ['스트릿웨어', '디자이너 레이블', '캐주얼 브랜드', '슈즈 전문', '컨템포러리 브랜드', '헤리티지', '스포츠웨어', '아웃도어', '패션 하우스', '데님 전문', '테일러링', '서브컬처', '라이프스타일', '테크니컬', 'SPA', '니트웨어', '워크웨어'],
  prods: ['티셔츠', '후드/스웨트', '셔츠', '니트', '아우터', '재킷', '팬츠', '데님', '스니커즈', '스포츠웨어', '신발', '코트', '아웃도어웨어', '모자', '부츠', '가방', '로퍼/더비', '슈트', '가죽', '테일러링', '액세서리', '카고'],
};

function parseCsv(t) {
  const rows = []; let r = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { r.push(c); c = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); rows.push(r); r = []; c = ''; }
    else c += ch;
  }
  if (c || r.length) { r.push(c); rows.push(r); }
  return rows.filter((x) => x.some((v) => v.trim()));
}
const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const readCsv = (p) => parseCsv(readFileSync(p, 'utf8').replace(/^﻿/, ''));

const [head, ...rows] = readCsv(MASTER);
for (const e of EXTRA) if (!head.includes(e)) head.push(e);
const iId = head.indexOf(EXTRA[0]), iLk = head.indexOf(EXTRA[1]);
for (const r of rows) while (r.length < head.length) r.push('');

// 무신사 브랜드 색인 (영문명·한글명 정규화 → 브랜드)
const ms = readCsv('data/brands/musinsa-brands.csv').slice(1).map((r) => ({ id: r[0], en: r[1], ko: r[2], likes: r[3] }));
const byName = new Map();
for (const b of ms) for (const k of [norm(b.en), norm(b.ko)]) if (k && !byName.has(k)) byName.set(k, b);

// 1) 기존 행에 좋아요 채우기
let filled = 0;
for (const r of rows) {
  if (r[iId]) continue;
  const keys = [r[0], ...(r[1] || '').split(',')].map(norm).filter(Boolean);
  const hit = keys.map((k) => byName.get(k)).find(Boolean);
  if (hit) { r[iId] = hit.id; r[iLk] = hit.likes; filled++; }
}

// 2) 새 브랜드 추가
const existingIds = new Set(rows.map((r) => r[iId]).filter(Boolean));
const existingNames = new Set(rows.map((r) => norm(r[0])));
const byId = new Map(ms.map((b) => [b.id, b]));
const problems = []; let added = 0, excluded = 0;
// LLM이 허용값에서 살짝 벗어난 표현(오타·유사어)을 쓴 경우 가장 가까운 허용값으로 바꾼다. 못 맞추면 그 값만 버린다.
const ALIAS = {
  pos: { '캐주얼 브랜드': '프리미엄 캐주얼', 캐주얼: '프리미엄 캐주얼', 프리미엘: '프리미엄', '프리미엠 캐주얼': '프리미엄 캐주얼', '라이프스타일': '전문 브랜드', '슈즈 전문': '전문 브랜드', '데님 전문': '전문 브랜드', 헤리티지: '프리미엄', 페미닌: '컨템포러리' },
  tags: { 캐주얼: '베이직' },
  types: {},
  prods: { 자켓: '재킷', 롱슬리브: '티셔츠', 악세서리: '액세서리', 티셨츠: '티셔츠', 맨투맨: '후드/스웨트', 반팔티: '티셔츠', 상의: '티셔츠', 블라우스: '셔츠', 탑: '티셔츠', 후드: '후드/스웨트', 카디건: '니트' },
};
const fix = (v, key) => [...new Set(v.split(',').map((x) => x.trim()).filter(Boolean).map((x) => ALIAS[key][x] ?? x).filter((x) => ENUM[key].includes(x)))].join(', ');
const oneOf = (v, list) => list.includes(v);
const many = (v, list, min, max) => { const a = v.split(',').map((s) => s.trim()).filter(Boolean); return a.length >= min && a.length <= max && a.every((x) => list.includes(x)); };
for (const f of readdirSync(dir).filter((x) => /^out-\d+\.txt$/.test(x)).sort()) {
  for (const line of readFileSync(`${dir}/${f}`, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const p = line.split('|').map((s) => s.trim());
    const b = byId.get(p[0]);
    if (!b) { problems.push(`${f}: unknown id ${p[0]}`); continue; }
    if (p[1] === 'EXCLUDE') { excluded++; continue; }
    if (existingIds.has(b.id) || existingNames.has(norm(b.en))) continue;
    if (p.length !== 15) { problems.push(`${b.id}: ${p.length} fields`); continue; }
    const [, country, founded, pos0, price, tags0, types0, prods0, trend0, formal0, func, heritage, pop0, access, hype] = p;
    // 드물게 벗어난 단일 값은 가장 가까운 값으로 보정한다(없으면 '중간').
    const trend = ENUM.trend.includes(trend0) ? trend0 : '중간';
    const formal = formal0 === '포멀/캐주얼 혼합' ? '캐주얼/포멀 혼합' : formal0;
    const pop = pop0 === '매니아 중심' ? '마니아 중심' : pop0;
    const pos = fix(pos0, 'pos'), tags = fix(tags0, 'tags'), types = fix(types0, 'types'), prods = fix(prods0, 'prods');
    const bad =
      !many(pos, ENUM.pos, 1, 3) ? '시장 포지션' : !oneOf(price, ENUM.price) ? '가격 레벨' : !many(tags, ENUM.tags, 1, 4) ? '스타일 태그' :
      !many(types, ENUM.types, 1, 3) ? '브랜드 유형' : !many(prods, ENUM.prods, 1, 4) ? '대표 제품군' : !oneOf(trend, ENUM.trend) ? '유행 성향' :
      !oneOf(formal, ENUM.formal) ? '포멀도' : ![func, heritage, access, hype].every((v) => oneOf(v, LEVEL)) ? '기능성/헤리티지/접근성/하이프' :
      !oneOf(pop, ENUM.pop) ? '대중성' : !country ? '국가' : (founded && !/^\d{4}$/.test(founded)) ? '설립 연도' : '';
    if (bad) { problems.push(`${b.id}: 잘못된 ${bad}`); continue; }
    const alias = b.ko && norm(b.ko) !== norm(b.en) ? b.ko : '';
    const row = [b.en, alias, country, founded, pos, price, tags, types, prods, trend, formal, func, heritage, pop, access, hype, '', b.id, b.likes];
    rows.push(row.map((v) => v)); existingIds.add(b.id); existingNames.add(norm(b.en)); added++;
  }
}
writeFileSync(MASTER, '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n');
console.log({ 기존_좋아요_채움: filled, 신규_추가: added, 제외: excluded, 문제: problems.length });
if (problems.length) console.log(problems.slice(0, 20).join('\n'));
