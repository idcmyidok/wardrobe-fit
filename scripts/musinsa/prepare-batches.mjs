// musinsa-candidates.json 중 좋아요 >= MIN 인 브랜드를 LLM 분류용 입력 파일(batch-NNN.txt, 100개씩)로 나눈다.
// 사용: node scripts/musinsa/prepare-batches.mjs <출력폴더> [MIN_LIKES=3000]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [dir, min = '3000'] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const list = JSON.parse(readFileSync('data/brands/musinsa-candidates.json', 'utf8'))
  .filter((b) => b.likes >= +min).sort((a, b) => b.likes - a.likes);
const SIZE = 100;
for (let i = 0; i < list.length; i += SIZE) {
  const lines = list.slice(i, i + SIZE).map((b) =>
    [b.id, b.nameEn, b.nameKo, b.categories.join('/'), b.medianPrice ?? '', b.sampleGoods.slice(0, 4).join(' ; ')].join(' | '));
  writeFileSync(`${dir}/batch-${String(i / SIZE + 1).padStart(3, '0')}.txt`, lines.join('\n') + '\n');
}
console.log(list.length, 'brands ->', Math.ceil(list.length / SIZE), 'batches');
