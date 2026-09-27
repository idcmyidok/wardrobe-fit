import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

/**
 * E2E 공용 준비물. 테스트 사용자는 service role로 만들고 테스트가 끝나면 사진·옷·분석 기록과 함께 지운다.
 * 실수로 운영 DB에 붙지 않도록 로컬 Supabase가 아니면 멈춘다(E2E_ALLOW_REMOTE=1로만 풀 수 있다).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function assertSafeTarget() {
  if (!supabaseUrl || !serviceKey || !anonKey) {
    throw new Error("E2E에는 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 필요합니다(e2e/README.md).");
  }
  const host = new URL(supabaseUrl).hostname;
  if (!["127.0.0.1", "localhost"].includes(host) && process.env.E2E_ALLOW_REMOTE !== "1") {
    throw new Error(`E2E는 로컬 Supabase에서만 돌립니다(지금: ${host}). 원격에서 돌리려면 E2E_ALLOW_REMOTE=1.`);
  }
}

const origin = () => new URL(supabaseUrl).origin;

export const BUCKET = "garment-images";

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

type GarmentInsert = Database["public"]["Tables"]["garments"]["Insert"];

export interface Fixtures {
  admin: SupabaseClient<Database>;
  /** 인증까지 끝난 테스트 사용자를 만든다. 테스트가 끝나면 지운다. */
  makeUser: (label?: string) => Promise<TestUser>;
  /** 가입 화면으로 만든 사용자처럼 정리 대상에만 올린다. */
  trackEmail: (email: string) => void;
  /** 옷을 DB에 바로 넣는다(준비 단계용). */
  seedGarments: (user: TestUser, rows: Omit<GarmentInsert, "user_id">[]) => Promise<string[]>;
}

export const test = base.extend<Fixtures>({
  admin: async ({}, use) => {
    assertSafeTarget();
    await use(createClient<Database>(origin(), serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }));
  },
  trackEmail: async ({ admin }, use) => {
    const emails: string[] = [];
    await use((email) => emails.push(email));
    for (const email of emails) {
      const id = await findUserId(admin, email);
      if (id) await removeUser(admin, id);
    }
  },
  makeUser: async ({ admin }, use) => {
    const ids: string[] = [];
    await use(async (label = "user") => {
      const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
      const password = `E2e-${crypto.randomUUID()}`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error ?? new Error("사용자를 만들지 못했습니다");
      ids.push(data.user.id);
      return { id: data.user.id, email, password };
    });
    for (const id of ids) await removeUser(admin, id);
  },
  seedGarments: async ({ admin }, use) => {
    await use(async (user, rows) => {
      const { data, error } = await admin
        .from("garments")
        .insert(rows.map((r) => ({ seasons: [], ...r, user_id: user.id })))
        .select("id");
      if (error) throw error;
      return data.map((r) => r.id);
    });
  },
});

export { expect };

/** 이 사용자의 anon 클라이언트(RLS가 걸린 상태로 직접 요청할 때) */
export async function userClient(user: TestUser) {
  const client = createClient<Database>(origin(), anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

export async function login(page: Page, user: TestUser, path = "/") {
  await page.goto(path);
  await page.fill("#signin-email", user.email);
  await page.fill("#signin-password", user.password);
  await page.locator("form:has(#signin-email) button[type=submit]").click();
}

/** 올릴 사진: 브라우저에서 색 상자를 그려 PNG로 만든다(저장소에 바이너리를 두지 않는다). */
export async function samplePhoto(browser: Browser, color = "#8a9a8f") {
  const page = await browser.newPage({ viewport: { width: 400, height: 500 } });
  await page.setContent(`<body style="margin:0"><div style="width:400px;height:500px;background:${color}"></div></body>`);
  const buffer = await page.screenshot({ type: "png" });
  await page.close();
  return { name: "photo.png", mimeType: "image/png", buffer };
}

async function findUserId(admin: SupabaseClient<Database>, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function removeUser(admin: SupabaseClient<Database>, id: string) {
  const { data: dirs } = await admin.storage.from(BUCKET).list(id, { limit: 1000 });
  for (const dir of dirs ?? []) {
    const { data: files } = await admin.storage.from(BUCKET).list(`${id}/${dir.name}`, { limit: 1000 });
    if (files?.length) await admin.storage.from(BUCKET).remove(files.map((f) => `${id}/${dir.name}/${f.name}`));
  }
  await admin.from("garments").delete().eq("user_id", id);
  await admin.from("product_imports").delete().eq("user_id", id);
  await admin.auth.admin.deleteUser(id);
}
