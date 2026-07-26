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
    await page.route("**/canopy-*.png", (route) => route.abort());
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
    const sprite = page.locator('[data-layer="growth"]');
    const held = await sprite.evaluate((el) => {
      const s = getComputedStyle(el);
      return { animationName: s.animationName, position: s.backgroundPositionY };
    });
    expect(held.animationName).toBe("none");
    // Not merely stopped — stopped at the end, which is the grown canopy.
    expect(held.position).toBe("100%");
  });

  test("the vault is already open", async ({ page }) => {
    // The reveal is shade that lifts. Under reduced motion there is nothing to
    // lift, and — since its resting state is transparent — nothing to see.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const veil = page.locator("section > div").nth(1);
    const state = await veil.evaluate((el) => {
      const s = getComputedStyle(el);
      return { animationName: s.animationName, opacity: s.opacity };
    });
    expect(state.animationName).toBe("none");
    expect(Number(state.opacity)).toBe(0);
  });

  test("the motes stop drifting", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const names = await page
      .locator('[data-layer="far"], [data-layer="mid"], [data-layer="near"]')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
    expect(names).toEqual(["none", "none", "none"]);
  });
});

test.describe("legibility", () => {
  /**
   * The plate is regenerated from a seed, so its luminance is not a constant a
   * designer signed off on once — a change to exposure, to a safe area or to the
   * palette can put type back onto bright foliage without anyone noticing.
   * This measures the composited backdrop under each run of text and holds it to
   * WCAG AA, which is the only way that stays true across re-renders.
   */
  const CONTRAST_AA = 4.5;

  test("every run of hero type clears AA against the artwork", async ({ page }) => {
    await page.goto("/?visualTest=1");
    await page.waitForLoadState("networkidle");

    const targets = await page.evaluate(() => {
      const pick = (label: string, el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return null;
        return { label, colour: getComputedStyle(el).color, rect: [r.x, r.y, r.width, r.height] };
      };
      return [
        pick("headline", document.querySelector("h1")),
        pick("body copy", document.querySelector("section p")),
        pick("product rail", document.querySelector("section ol")),
        pick("navigation", document.querySelector("header nav")),
        pick("microcopy", document.querySelector("section > p")),
      ].filter((t): t is NonNullable<typeof t> => t !== null);
    });
    expect(targets.length).toBe(5);

    // Hide the type so the screenshot is the backdrop it will be read against.
    await page.addStyleTag({ content: "h1,p,ol,header{visibility:hidden!important}" });
    const plate = await page.screenshot();

    for (const target of targets) {
      const [x, y, w, h] = target.rect as [number, number, number, number];
      const backdrop = await sampleLuminance(plate, x, y, w, h);
      const text = relativeLuminance(parseColour(target.colour));
      const ratio =
        (Math.max(text, backdrop) + 0.05) / (Math.min(text, backdrop) + 0.05);
      expect(ratio, `${target.label} contrast`).toBeGreaterThanOrEqual(CONTRAST_AA);
    }
  });
});

/** sRGB channel to linear light. */
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function parseColour(css: string): [number, number, number] {
  const parts = css.match(/[\d.]+/g);
  if (!parts || parts.length < 3) throw new Error(`Unparsable colour: ${css}`);
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

/**
 * The 95th-percentile luminance under a rectangle — the brightest the backdrop
 * gets rather than its average, because a mean hides the bright patch that
 * actually swallows a word.
 */
async function sampleLuminance(
  png: Buffer,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<number> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(png)
    .extract({
      left: Math.max(0, Math.round(x)),
      top: Math.max(0, Math.round(y)),
      width: Math.max(1, Math.round(w)),
      height: Math.max(1, Math.round(h)),
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const values: number[] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    values.push(relativeLuminance([data[i]!, data[i + 1]!, data[i + 2]!]));
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length * 0.95)]!;
}
