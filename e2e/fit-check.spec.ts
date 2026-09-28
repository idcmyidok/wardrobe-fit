import { expect, login, test, userClient, type Fixtures, type TestUser } from "./support";

/**
 * AI 구매 판단기(PROJECT_SPEC.md 22장 10·13단계). 서버는 AI_PROVIDER=mock(모의 AI)으로 뜬다(playwright.config.ts).
 * 실제 DB에 옷을 넣고, 규칙 계산 → 모의 AI 요약 → 저장 → 결과 주소로 다시 보기까지 확인한다.
 */

const JACKETS = [
  { brand: "APC", product_name: "울 워크 자켓", size_label: "M", m_shoulder: 46, m_chest: 58, m_length: 69, m_sleeve: 63, fit_review: "어깨 딱 맞고 가슴도 여유 적당." },
  { brand: "Nanamica", product_name: "코치 자켓", size_label: "L", m_shoulder: 47, m_chest: 60, m_length: 70, m_sleeve: 64, fit_review: "어깨와 가슴은 딱 좋다. 소매는 조금 긴 편." },
  { brand: "EG", product_name: "베드포드 자켓", size_label: "M", m_shoulder: 46.5, m_chest: 59, m_length: 71.5, m_sleeve: 63.5, fit_review: "어깨와 가슴은 마음에 드는데 총장이 조금 길다." },
];

async function seedJackets(seedGarments: Fixtures["seedGarments"], user: TestUser) {
  return seedGarments(user, [
    ...JACKETS.map((j) => ({ category_id: "outer", subcategory_id: "outer.blouson", purchase_price: 289000, product_url: "https://secret-shop.example/p", ...j })),
    { category_id: "top", subcategory_id: "top.knit", brand: "니트", product_name: "램스울 니트", m_shoulder: 45, m_chest: 55 },
  ]);
}

async function fillManual(page: import("@playwright/test").Page, name = "워크 자켓") {
  await page.getByRole("button", { name: "링크 없이 실측 직접 입력" }).click();
  await page.fill("#fm-brand", "Our Legacy");
  await page.fill("#fm-name", name);
  await page.fill("#fm-size", "48");
  await page.fill("#fm-m-length", "72");
  await page.fill("#fm-m-shoulder", "46.5");
  await page.fill("#fm-m-chest", "59");
  await page.fill("#fm-m-sleeve", "64.5");
}

test("직접 입력 → 비교 대상 확인 → 규칙 계산과 AI 요약(모의) → 저장한 결과 다시 보기", async ({ page, admin, makeUser, seedGarments }) => {
  const user = await makeUser("fit");
  await seedJackets(seedGarments, user);

  await login(page, user, "/fit-check");
  await fillManual(page);
  await expect(page.getByTestId("comparable-note")).toContainText("동일 세부분류 블루종/MA-1 3벌");
  await expect(page.getByRole("checkbox", { name: /램스울 니트/ })).toHaveCount(0);
  await page.getByRole("button", { name: "판단하기" }).click();

  await expect(page.getByTestId("summary-source")).toHaveText("AI 요약");
  await expect(page.getByTestId("fit-summary")).toContainText("AI 요약: 어깨·가슴은 만족했던 옷들과 비슷하고, 총장은 만족 범위보다 2cm 길고");
  await expect(page.getByTestId("confidence")).toHaveText("보통");
  await expect(page.getByText("길다고 적은 EG(71.5)와 비슷")).toBeVisible();
  // 서버 검증이 모의 AI의 틀린 답(없는 숫자, 지어낸 인용)을 버린다.
  await expect(page.getByText("비교한 옷이 적으면 참고용으로 봐 주세요.")).toBeVisible();
  await expect(page.getByText("99.9")).toHaveCount(0);
  await expect(page.getByText("지어낸 후기")).toHaveCount(0);

  await expect(page).toHaveURL(/\/fit-check\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop()!;
  const { data: row } = await admin.from("fit_checks").select("candidate, computed, ai_model, interpretation, status").eq("id", id).single();
  expect(row?.status).toBe("completed");
  expect(row?.ai_model).toBe("mock-fit");
  expect(row?.interpretation).not.toBeNull();
  // 저장한 스냅샷에도 구매가·링크가 없다.
  expect(JSON.stringify(row)).not.toMatch(/289000|secret-shop/);
  const { count } = await admin.from("fit_check_comparables").select("*", { count: "exact", head: true }).eq("fit_check_id", id);
  expect(count).toBe(3);

  await page.reload();
  await expect(page.getByTestId("fit-summary")).toContainText("AI 요약: 어깨·가슴은");
  await page.getByRole("button", { name: /EG\s+M/ }).click();
  await expect(page).toHaveURL(/item=/);

  // 같은 입력은 AI를 다시 부르지 않고 저장한 요약을 쓴다.
  await page.goto("/fit-check");
  await fillManual(page);
  await page.getByRole("button", { name: "판단하기" }).click();
  await expect(page).toHaveURL(/\/fit-check\/[0-9a-f-]{36}$/);
  const { data: again } = await admin.from("fit_checks").select("ai_model").eq("id", page.url().split("/").pop()!).single();
  expect(again?.ai_model).toBe("mock-fit:cache");
});

test("링크 분석 결과에서 사이즈 2개를 골라 함께 비교", async ({ page, admin, makeUser, seedGarments }) => {
  const user = await makeUser("fit-link");
  await seedJackets(seedGarments, user);
  const sourceUrl = "https://shop.example/p/48";
  const product = {
    brand: { value: "Our Legacy", source: "json_ld", confidence: "high" },
    productName: { value: "에브리데이 워크 자켓", source: "json_ld", confidence: "high" },
    categoryId: { value: "outer", source: "heuristic", confidence: "medium" },
    subcategoryId: { value: "outer.blouson", source: "heuristic", confidence: "low" },
    imageUrls: [],
    price: { value: 459000, source: "json_ld", confidence: "high" },
    colorOptions: [],
    colorCandidate: null,
    sizeOptions: ["46", "48", "50"],
    sizeChart: {
      measurementGroup: "top",
      unmappedColumns: [],
      rows: [
        { sizeLabel: "46", measurements: { shoulder: 45, chest: 56.5, length: 70.5, sleeve: 63 } },
        { sizeLabel: "48", measurements: { shoulder: 46.5, chest: 59, length: 72, sleeve: 64.5 } },
        { sizeLabel: "50", measurements: { shoulder: 48, chest: 61, length: 73.5, sleeve: 65.5 } },
      ],
    },
    warnings: [],
  };
  const { data: imp } = await admin
    .from("product_imports")
    .insert({ user_id: user.id, purpose: "fit_check", source_url: sourceUrl, normalized_url: sourceUrl, domain: "shop.example", status: "succeeded", result: product })
    .select("id")
    .single();
  await page.route("**/api/imports", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "result", importId: imp!.id, status: "succeeded", reused: false, domain: "shop.example", sourceUrl, parserId: "generic", durationMs: 500, product, errorCode: null, errorDetail: null }) + "\n",
    }),
  );

  await login(page, user, "/fit-check");
  await page.fill("#fit-url", sourceUrl);
  await page.getByRole("button", { name: "상품 분석" }).click();
  await expect(page.getByText("에브리데이 워크 자켓")).toBeVisible();
  // 가운데 사이즈(48)가 먼저 골라져 있고, 50을 더한다.
  const sizes = page.getByRole("group", { name: "비교 사이즈" });
  await expect(sizes.getByRole("checkbox", { name: "48" })).toBeChecked();
  await sizes.getByText("50", { exact: true }).click();
  await page.getByRole("button", { name: "판단하기" }).click();

  await expect(page.getByText("비교한 사이즈 중 48이(가) 기존 옷과 가장 가깝습니다", { exact: false })).toBeVisible();
  const result = page.getByRole("radiogroup", { name: "결과 사이즈" });
  await result.getByText("50", { exact: true }).click();
  await expect(page.getByTestId("fit-summary")).toContainText("만족 범위보다");
  await expect(page).toHaveURL(/\/fit-check\/[0-9a-f-]{36}$/);
  const { data: row } = await admin.from("fit_checks").select("import_id").eq("id", page.url().split("/").pop()!).single();
  expect(row?.import_id).toBe(imp!.id);

  // 구매 전환: 고른 사이즈의 실측으로 새 옷 추가 폼을 채운다.
  await page.getByRole("button", { name: "이 옷을 구매했어요 — 옷장에 추가" }).click();
  await expect(page).toHaveURL(/\/wardrobe\/new/);
  await expect(page.locator("#f-m-shoulder")).toHaveValue("48");
});

test("AI가 실패해도 치수 비교표와 규칙 요약은 보인다", async ({ page, makeUser, seedGarments }) => {
  const user = await makeUser("fit-fail");
  await seedJackets(seedGarments, user);
  await login(page, user, "/fit-check");
  await fillManual(page, "AI실패 자켓");
  await page.getByRole("button", { name: "판단하기" }).click();
  await expect(page.getByText("AI 설명을 만들지 못했습니다")).toBeVisible();
  await expect(page.getByTestId("summary-source")).toHaveText("치수 비교 요약");
  await expect(page.getByTestId("fit-summary")).toContainText("총장은 만족 범위보다 2cm 길고");
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "총장", exact: true })).toBeVisible();
});

test("하루 제한: AI 요약 10회를 넘으면 규칙 요약만, 판단 20회를 넘으면 막는다", async ({ page, admin, makeUser, seedGarments }) => {
  const user = await makeUser("fit-limit");
  await seedJackets(seedGarments, user);
  const rows = (n: number, ai_model: string | null) =>
    Array.from({ length: n }, () => ({ user_id: user.id, candidate: {}, status: "completed" as const, ai_model }));
  await admin.from("fit_checks").insert(rows(10, "mock-fit"));

  await login(page, user, "/fit-check");
  await fillManual(page);
  await page.getByRole("button", { name: "판단하기" }).click();
  await expect(page.getByText("오늘 AI 요약 횟수를 모두 써서")).toBeVisible();
  await expect(page.getByTestId("summary-source")).toHaveText("치수 비교 요약");

  await admin.from("fit_checks").insert(rows(9, null));
  await page.goto("/fit-check");
  await fillManual(page);
  await page.getByRole("button", { name: "판단하기" }).click();
  await expect(page.getByText("오늘 판단 횟수(20회)를 모두 썼습니다")).toBeVisible();
});

test("다른 사용자의 판단 결과는 열 수 없고, 본인 기록도 지울 수 없으며, 브라우저 코드에 AI 키·SDK가 없다", async ({ page, admin, makeUser }) => {
  const a = await makeUser("fit-owner");
  const b = await makeUser("fit-other");
  const { data: fc } = await admin
    .from("fit_checks")
    .insert({ user_id: a.id, candidate: { categoryId: "top", sizes: [] }, status: "completed" })
    .select("id")
    .single();

  const scripts: string[] = [];
  page.on("response", async (res) => {
    if (res.request().resourceType() === "script") scripts.push(await res.text().catch(() => ""));
  });
  await login(page, b, "/fit-check");
  await expect(page.getByRole("heading", { name: "AI 구매 판단기" })).toBeVisible();
  await page.goto(`/fit-check/${fc!.id}`);
  await expect(page.getByText("페이지를 찾을 수 없습니다")).toBeVisible();

  const owner = await userClient(a);
  await owner.from("fit_checks").delete().eq("id", fc!.id);
  await owner.from("fit_checks").update({ created_at: "2020-01-01T00:00:00Z" }).eq("id", fc!.id);
  const { data: still } = await admin.from("fit_checks").select("created_at").eq("id", fc!.id).single();
  expect(still?.created_at.startsWith("2020")).toBe(false);

  expect(scripts.length).toBeGreaterThan(0);
  for (const js of scripts) {
    expect(js).not.toMatch(/ANTHROPIC_API_KEY|api\.anthropic\.com|sk-ant-/);
  }
});
