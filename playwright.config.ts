import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["web-smoke.spec.ts"],
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run export:web && node ./scripts/serve-dist.mjs",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}`,
  },
});
