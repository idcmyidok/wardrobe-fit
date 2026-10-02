// Musinsa 브랜드 목록 수집 스크립트 (데이터 수집 전용, 앱/DB 무관)
//
// 사용 엔드포인트
//   1) https://static.msscdn.net/static/assets/brand/brand-list.json   (전체 브랜드: id, 한글명, 영문명, 카테고리)
//   2) POST https://like.musinsa.com/like/api/v2/liketypes/brand/counts (브랜드 좋아요 수, 100개씩 배치)
//   3) GET  https://api.musinsa.com/api2/dp/v2/plp/goods?brand={id}&size=30 (상품 수 = pagination.totalCount,
//      인기순 상위 30개 상품 가격의 중앙값)
//
// 실행: node scripts/musinsa/fetch-brands.mjs [--limit N] [--skip-products]
// 요청은 순차 실행하며 요청 사이에 지연을 둔다. 중단 후 재실행하면 캐시(.cache)에서 이어서 진행한다.

import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT = 'data/brands/musinsa-brands.csv';
const CACHE = 'data/brands/.cache-products.jsonl';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://www.musinsa.com',
  Referer: 'https://www.musinsa.com/',
};
const DELAY_MS = 120;
const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const skipProducts = args.includes('--skip-products');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, init = {}, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) } });
      if (res.status === 403 || res.status === 429) {
        throw new Error(`blocked/rate-limited: HTTP ${res.status} ${url}`);
      }
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch (e) {
      if (String(e.message).startsWith('blocked')) {
        if (i === tries - 1) throw e;
      } else if (i === tries - 1) throw e;
    }
    await sleep(1500 * (i + 1));
  }
  return null;
}

const median = (xs) => {
  if (!xs.length) return '';
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  await mkdir('data/brands', { recursive: true });
  const list = await getJson('https://static.msscdn.net/static/assets/brand/brand-list.json');
  if (!Array.isArray(list)) throw new Error('brand list not available');
  const brands = list.slice(0, limit);
  console.log(`brands: ${brands.length}`);

  // 좋아요 수 (100개 배치)
  const likes = new Map();
  for (let i = 0; i < brands.length; i += 100) {
    const ids = brands.slice(i, i + 100).map((b) => b.id);
    const j = await getJson('https://like.musinsa.com/like/api/v2/liketypes/brand/counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationIds: ids }),
    });
    for (const it of j?.data?.contents?.items ?? []) likes.set(it.relationId, it.count);
    await sleep(DELAY_MS);
    if ((i / 100) % 20 === 0) console.log(`likes ${i}/${brands.length}`);
  }

  // 상품 수 / 가격 중앙값 (캐시로 이어하기)
  const prod = new Map();
  if (existsSync(CACHE)) {
    for (const line of (await readFile(CACHE, 'utf8')).split('\n')) {
      if (line) { const o = JSON.parse(line); prod.set(o.id, o); }
    }
  }
  if (!skipProducts) {
    let n = 0;
    for (const b of brands) {
      if (prod.has(b.id)) continue;
      const j = await getJson(
        `https://api.musinsa.com/api2/dp/v2/plp/goods?brand=${encodeURIComponent(b.id)}&sortCode=POPULAR&size=30&caller=FLAGSHIP&countryCode=KR&localeCode=ko-KR&gf=A`,
      );
      const goods = j?.data?.list ?? [];
      const o = {
        id: b.id,
        count: j?.data?.pagination?.totalCount ?? '',
        median: median(goods.map((g) => g.finalPrice ?? g.price).filter((p) => p > 0)),
      };
      prod.set(b.id, o);
      await appendFile(CACHE, JSON.stringify(o) + '\n');
      await sleep(DELAY_MS);
      if (++n % 200 === 0) console.log(`products ${prod.size}/${brands.length}`);
    }
  }

  const rows = ['musinsa_id,name_en,name_ko,likes,product_count,top_categories,median_price'];
  for (const b of brands) {
    const p = prod.get(b.id);
    rows.push(
      [
        b.id,
        b.englishName,
        b.name,
        likes.get(b.id) ?? '',
        p?.count ?? '',
        (b.categoryList ?? []).join('|'),
        p?.median ?? '',
      ].map(csvCell).join(','),
    );
  }
  await writeFile(OUT, '﻿' + rows.join('\n') + '\n');
  console.log(`wrote ${OUT} (${brands.length} rows)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
