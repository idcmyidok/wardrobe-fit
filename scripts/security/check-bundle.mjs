// 브라우저로 가는 빌드 결과(.next/static)에 서버 전용 비밀 값이 섞이지 않았는지 검사한다(PROJECT_SPEC.md 19장 "번들 검사").
// CI는 가짜 값을 넣고 빌드한 뒤 이 스크립트를 돌린다. 값 자체는 출력하지 않는다.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SECRET_NAMES = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const root = path.resolve(".next/static");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const secrets = SECRET_NAMES.map((name) => ({ name, value: process.env[name] })).filter((s) => s.value && s.value.length >= 8);
if (!secrets.length) {
  console.error("검사할 비밀 값이 없습니다. 가짜 값을 환경 변수로 넣고 빌드한 뒤 실행하세요.");
  process.exit(1);
}

let files = 0;
const leaks = [];
try {
  for await (const file of walk(root)) {
    files++;
    const text = await readFile(file, "utf8");
    for (const s of secrets) {
      if (text.includes(s.value)) leaks.push(`${s.name} 값이 ${path.relative(process.cwd(), file)}에 있음`);
    }
  }
} catch (e) {
  console.error(`.next/static을 읽지 못했습니다. 먼저 npm run build를 하세요. (${e.code ?? e})`);
  process.exit(1);
}

if (leaks.length) {
  console.error(leaks.join("\n"));
  process.exit(1);
}
console.log(`번들 검사 통과: 파일 ${files}개, 비밀 ${secrets.map((s) => s.name).join(", ")} 없음`);
