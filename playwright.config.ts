import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the real app in real browser engines, clicking through what a shop owner does.
 * Needs the local backend and database running (see trillopos-backend/README.md) and a fresh
 * `next build`; Playwright starts `next start` itself. Run: npm run test:e2e
 * Every run signs up new test shops, so never point it at the live site.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
if (/trillotech\.com/i.test(baseURL)) {
  throw new Error("The end-to-end tests create shops and sales: run them against a local stack, never the live site.");
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    baseURL,
    locale: "en-US",
    timezoneId: "Asia/Yangon",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // iPhone Safari's engine, as the pilot shop owner uses it
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "android", use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "laptop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next start --port 3100",
    url: `${baseURL}/en/login`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { TRILLOPOS_COOKIE_SECURE: "false" },
  },
});
