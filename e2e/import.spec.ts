import { expect, login, samplePhoto, test } from "./support";

/**
 * 링크 등록. CI는 외부 쇼핑몰에 나갈 수 없어서 분석 응답(/api/imports)과 이미지 프록시만 흉내 낸다.
 * 분석 기록(product_imports)은 실제 DB에 두어 등록 시 연결까지 확인한다. 파서 자체는 fixture 단위 테스트가 맡는다.
 */
const PRODUCT = {
  brand: { value: "테스트랩", source: "json_ld", confidence: "high" },
  productName: { value: "옥스포드 셔츠", source: "json_ld", confidence: "high" },
  categoryId: { value: "top", source: "keyword", confidence: "medium" },
  subcategoryId: { value: "top.shirt", source: "keyword", confidence: "low" },
  imageUrls: ["https://shop.example/a.jpg", "https://shop.example/b.jpg"],
  price: { value: 59000, source: "json_ld", confidence: "high" },
  colorOptions: ["화이트", "블루"],
  colorCandidate: null,
  sizeOptions: ["S", "M", "L"],
  sizeChart: {
    measurementGroup: "top",
    unmappedColumns: ["암홀"],
    rows: [
      { sizeLabel: "S", measurements: { length: 70, shoulder: 45, chest: 52, sleeve: 60 } },
      { sizeLabel: "M", measurements: { length: 72, shoulder: 47, chest: 55, sleeve: 61.5 } },
      { sizeLabel: "L", measurements: { length: 74, shoulder: 49, chest: 58, sleeve: 63 } },
    ],
  },
  warnings: [
    { code: "size_chart_unmapped_columns", message: "옷장에서 쓰지 않는 항목은 뺐습니다: 암홀" },
    { code: "circumference_converted", message: "둘레로 보이는 값을 단면(÷2)으로 바꿨습니다. 확인해 주세요." },
  ],
};

test("링크 분석 → 검토(사이즈 고르면 실측 채움) → 등록, 분석 기록과 페이지 사진 연결", async ({ page, browser, admin, makeUser }) => {
  const user = await makeUser("import");
  const sourceUrl = "https://shop.example/p/9";
  const { data: imp, error } = await admin
    .from("product_imports")
    .insert({
      user_id: user.id,
      purpose: "wardrobe",
      source_url: sourceUrl,
      normalized_url: sourceUrl,
      domain: "shop.example",
      parser_id: "generic",
      parser_version: "v1",
      status: "succeeded",
      result: PRODUCT,
      warnings: PRODUCT.warnings,
      duration_ms: 900,
    })
    .select("id")
    .single();
  if (error) throw error;

  const photo = await samplePhoto(browser, "#4a6fa5");
  await page.route("**/api/imports", async (route) => {
    const lines = [
      { type: "stage", stage: "fetching" },
      { type: "stage", stage: "parsing" },
      { type: "stage", stage: "normalizing" },
      { type: "result", importId: imp.id, status: "succeeded", reused: false, domain: "shop.example", sourceUrl, parserId: "generic", durationMs: 900, product: PRODUCT, errorCode: null, errorDetail: null },
    ];
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: lines.map((l) => JSON.stringify(l)).join("\n") + "\n" });
  });
  await page.route("**/api/imports/*/image*", (route) => route.fulfill({ status: 200, contentType: "image/png", body: photo.buffer }));

  await login(page, user, "/wardrobe/new");
  await page.fill("#new-url", sourceUrl);
  await page.getByRole("button", { name: "분석", exact: true }).click();
  await expect(page.getByText("구매한 사이즈와 컬러를 고른 뒤 등록하세요.")).toBeVisible();
  await expect(page.getByText("단면(÷2)으로 바꿨습니다")).toBeVisible();
  // 항목별 "자동"·"확인 필요" 배지와 뺀 항목 안내는 보이지 않는다.
  await expect(page.getByText("뺐습니다")).toHaveCount(0);
  await expect(page.getByText("확인 필요")).toHaveCount(0);
  await expect(page.getByText("자동", { exact: true })).toHaveCount(0);
  await expect(page.locator("#f-brand")).toHaveValue("테스트랩");
  await expect(page.locator("#f-price")).toHaveValue("59000");
  await expect(page.locator("#f-sub")).toHaveValue("top.shirt");

  // 자동 추출만으로는 저장되지 않는다(사이즈를 고르기 전 상태 표시).
  await expect(page.getByText("구매한 사이즈를 선택하세요.")).toBeVisible();
  await page.getByRole("radiogroup", { name: "사이즈" }).locator("label", { hasText: /^M$/ }).click();
  await expect(page.locator("#f-m-chest")).toHaveValue("55");
  await expect(page.locator("#f-m-sleeve")).toHaveValue("61.5");
  await page.getByRole("radiogroup", { name: "컬러 옵션" }).locator("label", { hasText: "블루" }).click();
  await page.fill("#f-m-chest", "55.5");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page).toHaveURL(/\/wardrobe\?item=/);

  await expect
    .poll(async () => (await admin.from("garments").select("image_path").eq("user_id", user.id).single()).data?.image_path)
    .toBeTruthy();
  const { data: g } = await admin.from("garments").select("*").eq("user_id", user.id).single();
  expect(g).toMatchObject({ product_name: "옥스포드 셔츠", size_label: "M", color_name: "블루", m_chest: 55.5, m_sleeve: 61.5, product_url: sourceUrl, source_import_id: imp.id });
});

test("분석 실패 → 원인 문구 → 직접 입력으로 계속(링크 유지)", async ({ page, makeUser }) => {
  const user = await makeUser("import-fail");
  await page.route("**/api/imports", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({ type: "stage", stage: "fetching" }) +
        "\n" +
        JSON.stringify({ type: "result", importId: null, status: "failed", reused: false, domain: "blocked.example", sourceUrl: "https://blocked.example/p/1", parserId: null, durationMs: 400, product: null, errorCode: "http_error", errorDetail: "http_error: 403" }) +
        "\n",
    }),
  );
  await login(page, user, "/wardrobe/new");
  await page.fill("#new-url", "https://blocked.example/p/1");
  await page.getByRole("button", { name: "분석", exact: true }).click();
  const alert = page.getByRole("alert").filter({ hasText: "분석 실패" });
  await expect(alert).toContainText("페이지에 접근할 수 없습니다");
  await alert.getByRole("button", { name: "자세히" }).click();
  await expect(alert).toContainText("403");
  await alert.getByRole("button", { name: "직접 입력으로 계속" }).click();
  await expect(page.locator("#f-url")).toHaveValue("https://blocked.example/p/1");
});

test("분석 API는 로그인하지 않으면 거절하고, 사설 주소는 분석하지 않는다", async ({ page, request, makeUser }) => {
  const anonymous = await request.post("/api/imports", { data: { url: "https://example.com" }, headers: { origin: "http://localhost:3100" } });
  expect(anonymous.status()).toBe(401);

  const user = await makeUser("ssrf");
  await login(page, user);
  await expect(page).toHaveURL(/\/wardrobe$/);
  const res = await page.request.post("/api/imports", { data: { url: "http://127.0.0.1:54321/" }, headers: { origin: "http://localhost:3100" } });
  const body = await res.text();
  const result = JSON.parse(body.trim().split("\n").at(-1)!);
  expect(result.status).toBe("failed");
  expect(["blocked_host", "blocked_port"]).toContain(result.errorCode);
});

test("옷 정보 수정: 쇼핑몰 사진 불러오기로 상품 링크의 사진 중 하나를 골라 바꾼다", async ({ page, browser, admin, makeUser, seedGarments }) => {
  const user = await makeUser("shop-photo");
  const sourceUrl = "https://shop.example/p/10";
  await seedGarments(user, [{ category_id: "top", product_name: "링크 있는 셔츠", product_url: sourceUrl }]);
  const { data: imp, error } = await admin
    .from("product_imports")
    .insert({ user_id: user.id, purpose: "wardrobe", source_url: sourceUrl, normalized_url: sourceUrl, domain: "shop.example", parser_id: "generic", parser_version: "v1", status: "partial", result: PRODUCT, warnings: [], duration_ms: 500 })
    .select("id")
    .single();
  if (error) throw error;

  const photo = await samplePhoto(browser, "#a54a4a");
  let requestBody: Record<string, unknown> = {};
  await page.route("**/api/imports", async (route) => {
    requestBody = route.request().postDataJSON();
    const result = { type: "result", importId: imp.id, status: "partial", reused: false, domain: "shop.example", sourceUrl, parserId: "generic", durationMs: 500, product: PRODUCT, errorCode: null, errorDetail: null };
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: JSON.stringify(result) + "\n" });
  });
  await page.route("**/api/imports/*/image*", (route) => route.fulfill({ status: 200, contentType: "image/png", body: photo.buffer }));

  await login(page, user, "/wardrobe");
  await page.locator("table:visible").getByRole("button", { name: "링크 있는 셔츠" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "옷 정보 수정" }).click();
  await dialog.getByRole("button", { name: "쇼핑몰 사진 불러오기" }).click();
  await expect(dialog.getByText("페이지 사진 2장")).toBeVisible();
  expect(requestBody).toMatchObject({ url: sourceUrl, photosOnly: true });
  await dialog.getByRole("button", { name: "페이지 사진 2" }).click();
  await expect(dialog.getByRole("button", { name: "페이지 사진 2 (옷 사진으로 선택됨)" })).toBeVisible();
  await dialog.getByRole("button", { name: "저장" }).click();

  await expect
    .poll(async () => (await admin.from("garments").select("image_path").eq("user_id", user.id).single()).data?.image_path ?? null)
    .not.toBeNull();
});
