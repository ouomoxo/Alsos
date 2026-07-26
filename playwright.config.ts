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
  // The §18 QA matrix.
  projects: [
    { name: "1920x1080", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "1440x900", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "1280x800", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "1024x768", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
    { name: "768x1024", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "430x932", use: { ...devices["Desktop Chrome"], viewport: { width: 430, height: 932 } } },
    { name: "390x844", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "360x800", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
  ],
});
