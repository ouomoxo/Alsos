import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression runs against the deterministic mode described in §19:
 * `?visualTest=1` freezes uTime, growth, pointer and the particle seed, so two
 * runs of the same screen are comparable.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3299",
    trace: "on-first-retry",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? undefined,
    },
  },
  projects: [
    {
      name: "reference-1536x605",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1536, height: 605 } },
    },
  ],
});
