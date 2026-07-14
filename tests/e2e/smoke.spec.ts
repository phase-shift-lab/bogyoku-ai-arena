import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  page.on("console", (message) =>
    console.log(`[browser:${message.type()}] ${message.text()}`),
  );
  page.on("pageerror", (error) =>
    console.error(`[pageerror] ${error.message}`),
  );
  page.on("requestfailed", (request) =>
    console.error(
      `[requestfailed] ${request.url()} ${request.failure()?.errorText ?? "unknown"}`,
    ),
  );
  await page.goto(
    testInfo.title.includes("initializes YaneuraOu") ? "/" : "/?engine=off",
  );

  await expect(
    page.getByRole("link", { name: "Bogyoku AI Arena ホーム" }),
  ).toBeVisible();
  await expect(page.getByLabel("対局用将棋盤")).toBeVisible();
});

test("switches between normal, specified, and automatic strategy modes", async ({
  page,
}) => {
  await expect(page.getByText("棒玉プリセット")).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "奇襲強度" })).toBeVisible();

  const modeSwitch = page.getByRole("group", { name: "戦法選択モード" });
  await expect(modeSwitch.getByRole("button")).toHaveCount(3);
  await expect(
    modeSwitch.getByRole("button", { name: "奇襲指定" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".strategy-card-list").first()).toBeVisible();
  await expect(
    page.locator(".strategy-card-list").first().getByRole("button"),
  ).toHaveCount(15);

  const layout = await page
    .locator(".strategy-card-list")
    .first()
    .evaluate((list) => ({
      clientWidth: list.clientWidth,
      scrollWidth: list.scrollWidth,
      rows: new Set(
        Array.from(list.children).map((child) =>
          Math.round(child.getBoundingClientRect().top),
        ),
      ).size,
    }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.rows).toBeGreaterThan(1);

  await modeSwitch.getByRole("button", { name: "通常" }).click();
  await expect(page.locator(".strategy-card-list").first()).toBeVisible();
  await expect(
    page.locator(".strategy-card-list").first().getByRole("button"),
  ).toHaveCount(15);
  await expect(page.getByText("評価値を優先して指します")).toBeVisible();

  const oniKoroshi = page
    .locator(".strategy-card-list")
    .first()
    .locator('[data-strategy-id="oni-koroshi"]');
  await oniKoroshi.click();
  await expect(
    modeSwitch.getByRole("button", { name: "奇襲指定" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(oniKoroshi).toHaveAttribute("aria-pressed", "true");

  await modeSwitch.getByRole("button", { name: "奇襲おまかせ" }).click();
  await expect(page.locator(".strategy-card-list").first()).toBeVisible();
  await expect(page.getByText(/対局開始時に奇襲戦法を1つ選び/)).toBeVisible();
});

test("shows only the supported game modes", async ({ page }) => {
  const modeList = page.getByLabel("対局モード");

  await expect(modeList.getByRole("button")).toHaveCount(3);
  await expect(
    modeList.getByRole("button", { name: /人間 vs 人間/ }),
  ).toHaveCount(0);
});

test("selects the human side and a handicap preset", async ({ page }) => {
  await test.step("selects gote", async () => {
    await page.getByLabel("あなたの手番").selectOption("gote");
    await expect(page.getByLabel("あなたの手番")).toHaveValue("gote");
  });

  await test.step("selects the two-piece handicap", async () => {
    await page.getByLabel("開始局面").selectOption("two-piece");
    await expect(page.getByLabel("開始局面")).toHaveValue("two-piece");
  });

  await test.step("removes the gote rook and bishop", async () => {
    await expect(page.locator('[data-square="8b"] .piece')).toHaveCount(0);
    await expect(page.locator('[data-square="2b"] .piece')).toHaveCount(0);
  });
});

test("keeps the arena inside the viewport", async ({ page }) => {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const geometry = await page.evaluate(() => {
    const board = document
      .querySelector<HTMLElement>('[aria-label="対局用将棋盤"]')
      ?.getBoundingClientRect();
    const startButton = Array.from(document.querySelectorAll("button"))
      .find((button) =>
        /対局を始める|エンジン準備中/.test(button.textContent ?? ""),
      )
      ?.getBoundingClientRect();

    return {
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      board: board ? { left: board.left, right: board.right } : null,
      startButton: startButton
        ? { top: startButton.top, bottom: startButton.bottom }
        : null,
    };
  });

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.board).toBeTruthy();
  expect(geometry.board!.left).toBeGreaterThanOrEqual(0);
  expect(geometry.board!.right).toBeLessThanOrEqual(geometry.clientWidth + 1);
  if (geometry.clientWidth >= 1060) {
    expect(geometry.startButton).toBeTruthy();
    expect(geometry.startButton!.top).toBeGreaterThanOrEqual(0);
    expect(geometry.startButton!.bottom).toBeLessThanOrEqual(
      geometry.clientHeight + 1,
    );
  }
});

test("initializes YaneuraOu and analyzes the current position", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== "chromium" || testInfo.project.name !== "chromium",
    "Core engine startup is exercised once in Chromium.",
  );
  test.setTimeout(90_000);

  await expect(page.getByText(/YaneuraOu 準備完了/)).toBeVisible({
    timeout: 70_000,
  });
  await expect(page.locator(".runtime-badge")).toHaveAttribute(
    "data-runtime",
    "threaded",
  );
  await page.getByRole("button", { name: "現在局面を解析" }).click();
  await expect(page.getByText(/推奨手/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("MultiPV変化ツリー")).toBeVisible();
});
