import { expect, test } from "@playwright/test";

/**
 * PR1 acceptance: the static hero.
 *
 * The public site converts and nothing more, so these check the frame, the two
 * exits to the product app, and that nothing here depends on JavaScript.
 */

test.describe("hero", () => {
  test("headline, copy and CTA are real DOM", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("LEARN.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("DEFEND.");
    await expect(page.getByRole("link", { name: /학습 시작/ })).toBeVisible();
  });

  test("the CTA and login leave for the product app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /학습 시작/ })).toHaveAttribute(
      "href",
      /app\..*\/signup$/,
    );
    await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      /app\..*\/login$/,
    );
  });

  test("the product rail states principles, never invented statistics", async ({ page }) => {
    await page.goto("/");
    const rail = page.getByLabel("ALSOS 핵심 개념");
    await expect(rail).toContainText("STRUCTURED PATHS");
    await expect(rail).toContainText("HANDS-ON PRACTICE");
    await expect(rail).toContainText("LIVING PROFILE");
    // No learner counts, success rates or lab totals until they are real (§3).
    await expect(rail).not.toContainText(/[0-9]{3,}|%/);
  });

  test("the poster covers the hero without letterboxing", async ({ page }) => {
    await page.goto("/");
    const img = await page.locator("picture img").boundingBox();
    const hero = await page.locator("section").first().boundingBox();
    expect(img).not.toBeNull();
    expect(Math.abs(img!.height - hero!.height)).toBeLessThan(2);
  });

  test("the hero is complete with the tree sprite blocked", async ({ page }) => {
    // The growth sprite is an enhancement over a finished still (§19).
    await page.route("**/tree-growth-*.png", (route) => route.abort());
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /학습 시작/ })).toBeVisible();
    await expect(page.locator("picture img")).toBeVisible();
  });

  test("decorative layers are hidden from assistive tech", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("picture").locator("..")).toHaveAttribute("aria-hidden", "true");
  });
});

test.describe("page integrity", () => {
  test("one h1, one main, no sideways scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("the skip link is the first tab stop", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText(/본문으로 건너뛰기/);
  });

  test("no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
    });
    await page.goto("/");
    await page.waitForTimeout(1200);
    expect(errors).toEqual([]);
  });
});

test.describe("reduced motion", () => {
  test("the tree is held at its finished frame", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const name = await page
      .locator("section > div")
      .nth(1)
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("none");
  });
});
