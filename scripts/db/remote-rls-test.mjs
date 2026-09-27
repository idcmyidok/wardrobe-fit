/**
 * 실제 Supabase에서 사용자 A/B 교차 접근이 막히는지 확인한다(PROJECT_SPEC.md 11.4, 4단계 완료 조건).
 * 테스트 사용자 두 명을 만들고, 끝나면 옷·사진·사용자를 모두 지운다.
 *
 * 필요한 환경 변수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * 실행: npm run test:rls
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opts);
const stamp = Date.now();
const password = `Rls-${crypto.randomUUID()}`;
const users = [];

async function signedInClient(label) {
  const email = `rls-${label}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, id: data.user.id };
}

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` ${detail}`}`);
  if (!ok) failed++;
};

try {
  const A = await signedInClient("a");
  const B = await signedInClient("b");
  const anon = createClient(url, anonKey, opts);

  const ins = await A.client
    .from("garments")
    .insert({ category_id: "outer", subcategory_id: "outer.jacket", product_name: "RLS 테스트 자켓", m_length: 70 })
    .select("id, user_id")
    .single();
  check("A가 자기 옷 등록", !ins.error && ins.data.user_id === A.id, ins.error?.message);
  const gid = ins.data?.id;

  const readB = await B.client.from("garments").select("id").eq("id", gid);
  check("B는 A의 옷을 볼 수 없음", !readB.error && readB.data.length === 0, readB.error?.message);
  const updB = await B.client.from("garments").update({ product_name: "x" }).eq("id", gid).select("id");
  check("B가 A의 옷을 수정 못 함", !updB.error && updB.data.length === 0, updB.error?.message);
  const delB = await B.client.from("garments").delete().eq("id", gid).select("id");
  check("B가 A의 옷을 삭제 못 함", !delB.error && delB.data.length === 0, delB.error?.message);
  const still = await admin.from("garments").select("product_name").eq("id", gid).single();
  check("A의 옷은 그대로", still.data?.product_name === "RLS 테스트 자켓");
  const spoof = await B.client.from("garments").insert({ user_id: A.id, category_id: "top", product_name: "x" });
  check("B가 A 명의로 등록 못 함", Boolean(spoof.error));
  const anonRead = await anon.from("garments").select("id");
  check("비로그인은 옷을 볼 수 없음", Boolean(anonRead.error) || anonRead.data.length === 0);

  const path = `${A.id}/${gid}/rls.webp`;
  const png = new Blob([new Uint8Array([82, 73, 70, 70])], { type: "image/webp" });
  const up = await A.client.storage.from("garment-images").upload(path, png, { contentType: "image/webp" });
  check("A가 자기 폴더에 사진 업로드", !up.error, up.error?.message);
  const upB = await B.client.storage.from("garment-images").upload(`${A.id}/${gid}/b.webp`, png, { contentType: "image/webp" });
  check("B가 A 폴더에 업로드 못 함", Boolean(upB.error));
  const dlB = await B.client.storage.from("garment-images").download(path);
  check("B는 A의 사진을 받을 수 없음", Boolean(dlB.error));
  const signB = await B.client.storage.from("garment-images").createSignedUrl(path, 60);
  check("B는 A의 사진 링크를 만들 수 없음", Boolean(signB.error));
  await B.client.storage.from("garment-images").remove([path]);
  const stillFile = await A.client.storage.from("garment-images").download(path);
  check("B가 지우려 해도 A의 사진은 남아 있음", !stillFile.error, stillFile.error?.message);
  const pub = await anon.storage.from("garment-images").download(path);
  check("비로그인은 사진을 받을 수 없음", Boolean(pub.error));

  await A.client.storage.from("garment-images").remove([path]);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

console.log(failed ? `\n${failed}개 실패` : "\n모두 통과");
process.exit(failed ? 1 : 0);
