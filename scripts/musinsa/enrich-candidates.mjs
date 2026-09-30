// brand-master에 없고 좋아요 >= 500이며 의류/모자/신발/스니커즈를 파는 무신사 브랜드 후보를 뽑고,
// 브랜드별 인기 상품 30개로 가격 중앙값과 대표 상품명 5개를 붙여 data/brands/musinsa-candidates.json 으로 저장한다.
// 실행: node scripts/musinsa/enrich-candidates.mjs   (순차 요청, 중단 후 재실행하면 이어서 진행)
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';

const MIN_LIKES = 3000;
const WEAR = new Set(['의류', '모자', '신발', '스니커즈']);
const OUT = 'data/brands/musinsa-candidates.json';
const CACHE = 'data/brands/.cache-enrich.jsonl';
const H = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', Origin: 'https://www.musinsa.com', Referer: 'https://www.musinsa.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  return rows;
}
const read = (p) => parseCsv(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); };

const master = read('data/brands/brand-master.csv').slice(1);
const known = new Set();
for (const r of master) { known.add(norm(r[0])); for (const a of (r[1] || '').split(',')) known.add(norm(a)); }

const cands = read('data/brands/musinsa-brands.csv').slice(1)
  .filter((r) => +r[3] >= MIN_LIKES && !known.has(norm(r[1])) && !known.has(norm(r[2])) && r[5].split('|').some((c) => WEAR.has(c)))
  .map((r) => ({ id: r[0], nameEn: r[1], nameKo: r[2], likes: +r[3], categories: r[5].split('|') }));
console.log('candidates', cands.length);

const done = new Map();
if (existsSync(CACHE)) for (const l of readFileSync(CACHE, 'utf8').split('\n')) if (l) { const o = JSON.parse(l); done.set(o.id, o); }
for (const b of cands) {
  if (done.has(b.id)) continue;
  let j = null;
  for (let t = 0; t < 4 && !j; t++) {
    try {
      const res = await fetch(`https://api.musinsa.com/api2/dp/v2/plp/goods?brand=${encodeURIComponent(b.id)}&sortCode=POPULAR&size=30&caller=FLAGSHIP&countryCode=KR&localeCode=ko-KR&gf=A`, { headers: H });
      if (res.status === 403 || res.status === 429) throw new Error(`blocked HTTP ${res.status}`);
      if (res.ok) j = await res.json(); else await sleep(1500);
    } catch (e) { if (String(e.message).startsWith('blocked')) throw e; await sleep(1500 * (t + 1)); }
  }
  const goods = j?.data?.list ?? [];
  const o = { id: b.id, productCount: j?.data?.pagination?.totalCount ?? null, medianPrice: median(goods.map((g) => g.finalPrice ?? g.price).filter((p) => p > 0)), sampleGoods: goods.slice(0, 5).map((g) => g.goodsName.slice(0, 40)) };
  done.set(b.id, o); appendFileSync(CACHE, JSON.stringify(o) + '\n');
  await sleep(120);
  if (done.size % 200 === 0) console.log(`enriched ${done.size}/${cands.length}`);
}
writeFileSync(OUT, JSON.stringify(cands.map((b) => ({ ...b, ...done.get(b.id) })), null, 1));
console.log('wrote', OUT);
