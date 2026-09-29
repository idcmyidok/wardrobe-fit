/**
 * Supabase 없이 migration과 RLS를 검증한다: PGlite(WASM Postgres)에 migration을 적용하고
 * 사용자 A/B로 교차 접근을 시도한다. `npm run test:db`
 */
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const db = new PGlite();
await db.exec(await readFile(join(root, "scripts/db/supabase-stub.sql"), "utf8"));

const dir = join(root, "supabase/migrations");
for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await db.exec(await readFile(join(dir, file), "utf8"));
  } catch (e) {
    console.error(`migration 실패: ${file}\n${e.message}`);
    process.exit(1);
  }
}

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@test.local'), ('${B}', 'b@test.local')`);

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` ${detail}`}`);
  if (!ok) failed++;
};

/** 해당 사용자로 쿼리를 실행한다. 오류면 error를 돌려준다. */
async function as(user, sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try {
    return await db.query(sql, params);
  } catch (error) {
    return { error, rows: [], affectedRows: 0 };
  } finally {
    await db.exec("reset role");
  }
}

check("가입 시 profile 자동 생성", (await db.query("select count(*)::int n from public.profiles")).rows[0].n === 2);

const ins = await as(
  A,
  `insert into public.garments (category_id, subcategory_id, product_name, seasons, m_length, m_shoulder)
   values ('outer', 'outer.etc', '워크 자켓', '{fall,winter}', 70, 46) returning id, user_id`,
);
check("A가 자기 옷 등록", !ins.error && ins.rows[0]?.user_id === A, ins.error?.message);
const gid = ins.rows[0]?.id;

check("A는 자기 옷을 조회", (await as(A, "select id from public.garments")).rows.length === 1);
const none = (r) => !r.error && (r.affectedRows ?? 0) === 0 && r.rows.length === 0;
check("B는 A의 옷을 볼 수 없음", none(await as(B, "select id from public.garments where id = $1", [gid])));
check("B가 A의 옷을 수정 못 함", none(await as(B, "update public.garments set product_name = 'x' where id = $1", [gid])));
check("B가 A의 옷을 삭제 못 함", none(await as(B, "delete from public.garments where id = $1", [gid])));
check("A의 옷은 그대로 남아 있음", (await db.query("select product_name from public.garments where id = $1", [gid])).rows[0]?.product_name === "워크 자켓");
check("B가 A 명의로 등록 못 함", Boolean((await as(B, `insert into public.garments (user_id, category_id, product_name) values ('${A}', 'top', 'x')`)).error));
check("비로그인은 옷 테이블 접근 불가", Boolean((await as(null, "select 1 from public.garments")).error));
check("비로그인은 분류도 못 읽음", Boolean((await as(null, "select 1 from public.categories")).error));
check("로그인하면 분류를 읽음", (await as(A, "select id from public.subcategories")).rows.length === 48);
check("모자는 모자 실측만 저장", !(await as(A, `insert into public.garments (category_id, subcategory_id, product_name, m_head, m_brim) values ('hat', 'hat.cap', '볼캡', 58, 7)`)).error);
check("신발에 옷 실측은 못 넣음", Boolean((await as(A, `insert into public.garments (category_id, product_name, m_length) values ('shoes', 'x', 28)`)).error));
check("착용감은 신발만", Boolean((await as(A, `insert into public.garments (category_id, product_name, shoe_fit_width) values ('top', 'x', 'tight')`)).error));
check("신발 착용감 저장", !(await as(A, `insert into public.garments (category_id, subcategory_id, product_name, size_label, shoe_fit_width) values ('shoes', 'shoes.sneakers', '척 70', '270', 'tight')`)).error);
check("분류는 수정 불가", Boolean((await as(A, "update public.categories set name_ko = 'x'")).error));

check(
  "B가 A의 옷으로 후기 신호를 만들 수 없음",
  Boolean((await as(B, `insert into public.garment_review_signals (garment_id, review_hash, dimension, direction, evidence_text, extractor) values ($1, 'h', 'length', 'long', '길다', 'rule:v1')`, [gid])).error),
);
const fc = await as(B, `insert into public.fit_checks (candidate) values ('{}') returning id`);
check(
  "B가 A의 옷을 비교 대상으로 넣을 수 없음",
  Boolean((await as(B, `insert into public.fit_check_comparables (fit_check_id, garment_id, match_level) values ($1, $2, 'category')`, [fc.rows[0]?.id, gid])).error),
);
const fcId = fc.rows[0]?.id;
await as(B, "update public.fit_checks set created_at = now() - interval '2 days', ai_model = null where id = $1", [fcId]);
await as(B, "delete from public.fit_checks where id = $1", [fcId]);
check(
  "본인 판단 기록도 고치거나 지울 수 없음(하루 제한 초기화 방지)",
  (await db.query("select count(*)::int as n from public.fit_checks where id = $1 and created_at > now() - interval '1 hour'", [fcId])).rows[0]?.n === 1,
);
const imp = await as(A, `insert into public.product_imports (purpose, source_url, normalized_url, domain) values ('wardrobe', 'https://a', 'https://a', 'a') returning id`);
check(
  "B가 A의 URL 분석 기록을 출처로 쓸 수 없음",
  Boolean((await as(B, `insert into public.garments (category_id, product_name, source_import_id) values ('top', 'x', $1)`, [imp.rows[0]?.id])).error),
);

check("사계절과 다른 계절을 같이 저장 불가", Boolean((await as(A, `insert into public.garments (category_id, product_name, seasons) values ('top', 'x', '{all,summer}')`)).error));
check("하의에 어깨 실측 저장 불가", Boolean((await as(A, `insert into public.garments (category_id, product_name, m_shoulder) values ('bottom', 'x', 40)`)).error));
check("다른 대분류의 세부분류 저장 불가", Boolean((await as(A, `insert into public.garments (category_id, subcategory_id, product_name) values ('top', 'bottom.denim', 'x')`)).error));

const path = `${A}/${gid}/photo.webp`;
check("A가 자기 폴더에 사진 업로드", !(await as(A, `insert into storage.objects (bucket_id, name) values ('garment-images', $1)`, [path])).error);
check("B가 A 폴더에 업로드 못 함", Boolean((await as(B, `insert into storage.objects (bucket_id, name) values ('garment-images', $1)`, [`${A}/x/y.webp`])).error));
check("B는 A의 사진을 볼 수 없음", none(await as(B, "select 1 from storage.objects where name = $1", [path])));
check("B가 A의 사진을 삭제 못 함", none(await as(B, "delete from storage.objects where name = $1", [path])));
check("B는 A의 사진 경로를 바꿀 수 없음", none(await as(B, "update storage.objects set name = $2 where name = $1", [path, `${B}/x.webp`])));
check("사진 bucket은 비공개", (await db.query("select public from storage.buckets where id = 'garment-images'")).rows[0]?.public === false);

// 관리자: 스스로 관리자가 될 수 없고, 통계 함수는 service role만 부른다.
check("사용자가 스스로 관리자 등록 불가", Boolean((await as(A, `insert into public.admins (user_id) values ('${A}')`)).error));
await db.query("insert into public.admins (user_id) values ($1)", [A]);
check("관리자는 자기 관리자 행을 읽음", (await as(A, "select user_id from public.admins")).rows.length === 1);
check("다른 사용자는 관리자 목록을 볼 수 없음", none(await as(B, "select user_id from public.admins")));
check("관리자도 관리자 행을 지울 수 없음", Boolean((await as(A, "delete from public.admins")).error));
// 테스터(마이그레이션 17): 스스로 지정·해제할 수 없고, 자기 행만 읽는다.
check("사용자가 스스로 테스터 지정 불가", Boolean((await as(B, `insert into public.testers (user_id) values ('${B}')`)).error));
await db.query("insert into public.testers (user_id, granted_by) values ($1, $2)", [B, A]);
check("테스터는 자기 테스터 행을 읽음", (await as(B, "select user_id from public.testers")).rows.length === 1);
check("다른 사용자는 테스터 목록을 볼 수 없음", none(await as(A, "select user_id from public.testers")));
check("테스터도 테스터 행을 지울 수 없음", Boolean((await as(B, "delete from public.testers")).error));
await db.query("delete from public.testers");
check("관리자도 세션으로는 다른 사용자의 기록을 볼 수 없음(RLS 유지)", none(await as(A, "select id from public.fit_checks where id = $1", [fcId])));
for (const fn of ["public.admin_stats()", "public.admin_import_failures()", `public.admin_user_counts(array['${A}']::uuid[])`]) {
  check(`로그인 사용자는 ${fn.split("(")[0]} 호출 불가`, Boolean((await as(A, `select * from ${fn}`)).error));
}
await db.exec("set role service_role");
const stats = await db.query("select public.admin_stats() as s").catch((error) => ({ error, rows: [] }));
await db.exec("reset role");
check("service role은 통계를 읽음", stats.rows[0]?.s?.users_total === 2, stats.error?.message);

// 사용자당 개수 상한(마이그레이션 8): 옷 2,000벌(삭제 포함), 사진 파일 5,000개
await db.query(
  "insert into public.garments (user_id, category_id, product_name, deleted_at) select $1, 'top', 'q', now() from generate_series(1, 2000)",
  [B],
);
check("옷 2,000벌이 차면 더 등록 불가", Boolean((await as(B, "insert into public.garments (category_id, product_name) values ('top', 'x')")).error));
check("다른 사용자는 상한과 무관하게 등록", !(await as(A, "insert into public.garments (category_id, product_name) values ('top', 'q2')")).error);
await db.query("insert into storage.objects (bucket_id, name) select 'garment-images', $1 || '/g/' || i || '.webp' from generate_series(1, 5000) i", [B]);
check("사진 5,000개가 차면 더 업로드 불가", Boolean((await as(B, "insert into storage.objects (bucket_id, name) values ('garment-images', $1)", [`${B}/g/over.webp`])).error));
check("A는 계속 사진 업로드", !(await as(A, "insert into storage.objects (bucket_id, name) values ('garment-images', $1)", [`${A}/g/more.webp`])).error);
check("상한 함수는 비로그인이 호출 불가", Boolean((await as(null, "select public.garment_image_quota_ok()")).error));
check("옷 상한 trigger 함수는 API로 호출 불가", Boolean((await as(A, "select public.enforce_garment_quota()")).error));

// 내 치수(migration 14): 본인만 읽고 쓰고, 동의 버전 없이는 저장 불가
check("A가 내 치수 저장", !(await as(A, "insert into public.body_profiles (height_cm, chest_cm, consent_version) values (175, 94, '2026-09-28')")).error);
check("동의 버전 없이 내 치수 저장 불가", Boolean((await as(B, "insert into public.body_profiles (height_cm) values (170)")).error));
check("B는 A의 치수를 볼 수 없음", none(await as(B, "select user_id from public.body_profiles")));
check("B가 A의 치수를 고칠 수 없음", none(await as(B, "update public.body_profiles set chest_cm = 90 where user_id = $1", [A])));
check("비로그인은 치수를 볼 수 없음", (await as(null, "select user_id from public.body_profiles")).rows.length === 0);
check("범위 밖 치수는 저장 불가", Boolean((await as(A, "update public.body_profiles set height_cm = 20")).error));
check("팔길이·다리길이 열은 없음", Boolean((await as(A, "select arm_cm from public.body_profiles")).error) && Boolean((await as(A, "select leg_cm from public.body_profiles")).error));
check("정확하지 않아요에 팔길이는 못 넣음", Boolean((await as(A, "update public.body_profiles set uncertain = array['arm']")).error));
check("모자에는 내 핏 표기 불가", Boolean((await as(A, "insert into public.garments (category_id, product_name, user_fit) values ('hat', 'cap', 'regular')")).error));
check("A가 내 치수 삭제", (await as(A, "delete from public.body_profiles")).affectedRows === 1);

check("trigger 함수는 API로 호출 불가", Boolean((await as(A, "select public.handle_new_user()")).error));
check("A가 자기 옷 삭제", (await as(A, "delete from public.garments where id = $1", [gid])).affectedRows === 1);

console.log(failed ? `\n${failed}개 실패` : "\n모두 통과");
process.exit(failed ? 1 : 0);
