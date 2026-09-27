/**
 * supabase/migrations/*.sql을 실제 Supabase 프로젝트에 순서대로 적용하고 DB 타입을 생성한다.
 * Supabase Management API를 쓰므로 DB 비밀번호가 필요 없다.
 *
 * 필요한 환경 변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN
 * 실행: npm run db:apply   (타입만: npm run db:types)
 *
 * 적용 기록은 Supabase CLI와 같은 supabase_migrations.schema_migrations 테이블에 남긴다.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const token = process.env.SUPABASE_ACCESS_TOKEN;
// 대시보드에서 /rest/v1/ 경로까지 복사해 넣은 값도 받도록 origin만 쓴다(src/lib/supabase/config.ts와 같은 규칙).
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const url = rawUrl ? new URL(rawUrl).origin : undefined;
if (!token || !url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_ACCESS_TOKEN이 필요합니다.");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
const api = `https://api.supabase.com/v1/projects/${ref}`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function query(sql) {
  const res = await fetch(`${api}/database/query`, { method: "POST", headers, body: JSON.stringify({ query: sql }) });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body}`);
  return JSON.parse(body);
}

const quote = (s) => `'${s.replaceAll("'", "''")}'`;

async function applyMigrations() {
  await query(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
  const applied = new Set((await query("select version from supabase_migrations.schema_migrations")).map((r) => r.version));

  const dir = join(root, "supabase/migrations");
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) {
      console.log(`- ${file} (이미 적용)`);
      continue;
    }
    const sql = await readFile(join(dir, file), "utf8");
    // 한 파일은 한 트랜잭션으로: 중간에 실패하면 아무것도 남기지 않는다.
    await query(`begin;
${sql}
insert into supabase_migrations.schema_migrations (version, name, statements) values (${quote(version)}, ${quote(rest.join("_"))}, array[${quote(sql)}]);
commit;`);
    console.log(`✓ ${file}`);
  }
}

async function generateTypes() {
  const res = await fetch(`${api}/types/typescript?included_schemas=public`, { headers });
  if (!res.ok) throw new Error(`타입 생성 실패: ${res.status} ${await res.text()}`);
  const { types } = await res.json();
  const out = join(root, "src/lib/supabase/database.types.ts");
  await writeFile(out, `// npm run db:types 로 생성한다. 직접 고치지 않는다.\n${types}`);
  console.log(`✓ 타입 생성: src/lib/supabase/database.types.ts`);
}

try {
  if (!process.argv.includes("--types-only")) await applyMigrations();
  await generateTypes();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
