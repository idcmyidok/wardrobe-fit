import { expect, login, test, userClient, BUCKET } from "./support";

test("다른 사용자의 옷·사진·분석 기록에 접근할 수 없다", async ({ page, admin, makeUser, seedGarments }) => {
  const a = await makeUser("owner");
  const b = await makeUser("other");
  const path = `${a.id}/${crypto.randomUUID()}/a.webp`;
  const [aGarment] = await seedGarments(a, [{ category_id: "top", brand: "A브랜드", product_name: "A의 셔츠", image_path: path }]);
  await admin.storage.from(BUCKET).upload(path, new Blob([new Uint8Array([1, 2, 3])]), { contentType: "image/webp" });
  const { data: imp } = await admin
    .from("product_imports")
    .insert({ user_id: a.id, purpose: "wardrobe", source_url: "https://shop.example/a", normalized_url: "https://shop.example/a", domain: "shop.example", status: "succeeded", result: { imageUrls: ["https://shop.example/a.jpg"] } })
    .select("id")
    .single();

  // 화면: B로 로그인하면 A의 옷이 보이지 않고, 주소로 열어도 없는 옷과 같다.
  await login(page, b);
  await expect(page.getByText("아직 등록한 옷이 없습니다")).toBeVisible();
  await page.goto(`/wardrobe/${aGarment}`);
  await expect(page.getByText("옷을 찾을 수 없습니다")).toBeVisible();
  const image = await page.request.get(`/api/imports/${imp!.id}/image?i=0`);
  expect(image.status()).toBe(404);

  // API 직접 요청: RLS가 막는다.
  const client = await userClient(b);
  expect((await client.from("garments").select("id").eq("id", aGarment)).data).toEqual([]);
  await client.from("garments").update({ product_name: "바꿈" }).eq("id", aGarment);
  await client.from("garments").delete().eq("id", aGarment);
  const { data: still } = await admin.from("garments").select("product_name, deleted_at").eq("id", aGarment).single();
  expect(still).toEqual({ product_name: "A의 셔츠", deleted_at: null });
  const insert = await client.from("garments").insert({ user_id: a.id, category_id: "top", product_name: "끼워 넣기", seasons: [] });
  expect(insert.error).not.toBeNull();
  expect((await client.storage.from(BUCKET).download(path)).error).not.toBeNull();
  expect((await client.storage.from(BUCKET).upload(`${a.id}/x/b.webp`, new Blob([new Uint8Array([1])]), { contentType: "image/webp" })).error).not.toBeNull();
  expect((await client.from("product_imports").select("id").eq("id", imp!.id)).data).toEqual([]);
});

test("세션이 끝나면 로그인 화면으로 가고, 다시 로그인하면 쓰던 값이 돌아온다", async ({ page, context, admin, makeUser }) => {
  const user = await makeUser("expire");
  await login(page, user, "/wardrobe/new?mode=manual");
  await page.fill("#f-name", "쓰던 셔츠");
  await page.fill("#f-brand", "브랜드B");
  await context.clearCookies();
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page).toHaveURL(/\/\?next=%2Fwardrobe%2Fnew/);
  await page.fill("#signin-email", user.email);
  await page.fill("#signin-password", user.password);
  await page.locator("form:has(#signin-email) button[type=submit]").click();
  await expect(page).toHaveURL(/\/wardrobe\/new/);
  await expect(page.locator("#f-name")).toHaveValue("쓰던 셔츠");
  await expect(page.locator("#f-brand")).toHaveValue("브랜드B");
  const { count } = await admin.from("garments").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  expect(count).toBe(0);
});

test("오프라인이면 안내하고 입력은 지우지 않는다", async ({ page, context, makeUser }) => {
  const user = await makeUser("offline");
  await login(page, user, "/wardrobe/new?mode=manual");
  await page.fill("#f-name", "오프라인 셔츠");
  await context.setOffline(true);
  await expect(page.getByText("인터넷 연결이 끊겼습니다")).toBeVisible();
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page.getByText("연결이 불안정합니다")).toBeVisible();
  await expect(page.locator("#f-name")).toHaveValue("오프라인 셔츠");
  await context.setOffline(false);
});
