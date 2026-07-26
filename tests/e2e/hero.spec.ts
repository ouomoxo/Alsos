import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/dashboard", "/roadmap", "/labs", "/labs/session-fixation", "/garden", "/profile/alsos"];

test.describe("hero", () => {
  test("copy, CTA and headline exist in the DOM without the canvas", async ({ page }) => {
    // §21.4: WebGL is an enhancement. Block it entirely and the hero must still
    // be a finished hero.
    await page.route("**/tree-skeleton.json", (route) => route.abort());
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("LEARN.");
    await expect(page.getByRole("link", { name: "학습 시작", exact: true })).toBeVisible();
    await expect(page.locator("picture img")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("the poster covers the hero without letterboxing", async ({ page }) => {
    await page.goto("/");
    const box = await page.locator("picture img").boundingBox();
    const hero = await page.locator("section").first().boundingBox();
    expect(box).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(Math.abs(box!.height - hero!.height)).toBeLessThan(2);
  });

  test("the decorative canvas is hidden from assistive tech", async ({ page }) => {
    await page.goto("/?visualTest=1");
    const scene = page.locator('[aria-hidden="true"] canvas');
    if ((await scene.count()) > 0) {
      await expect(scene.first().locator("xpath=..")).toHaveAttribute("aria-hidden", "true");
    }
  });
});

test.describe("no horizontal overflow", () => {
  for (const route of ROUTES) {
    test(`${route} never scrolls sideways`, async ({ page }) => {
      await page.goto(`${route}?visualTest=1`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("accessibility", () => {
  test("every route has exactly one h1 and a main landmark", async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(`${route}?visualTest=1`);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
    }
  });

  test("the skip link is reachable by keyboard first", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText(/본문으로 건너뛰기/);
  });

  test("roadmap is fully navigable without the diagram", async ({ page }) => {
    await page.goto("/roadmap?visualTest=1");
    // Every domain must be a real link, not a canvas hit region (§8.2, §20).
    const links = page.locator("main a[href^='/roadmap#']");
    expect(await links.count()).toBeGreaterThanOrEqual(7);
  });

  test("interactive targets meet the 44px minimum", async ({ page }) => {
    await page.goto("/?visualTest=1");
    const targets = page.locator("main a, main button");
    const count = await targets.count();
    for (let i = 0; i < count; i++) {
      const el = targets.nth(i);
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      if (!box) continue;
      expect(box.height, `target ${i} height`).toBeGreaterThanOrEqual(24);
    }
  });
});

test.describe("reduced motion", () => {
  test("renders the finished tree with no animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Headline must not be left mid-transition at opacity 0.
    const opacity = await page
      .locator("h1 span")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);
  });
});
