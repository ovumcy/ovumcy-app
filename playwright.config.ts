import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 4173);
const retainDebugArtifacts = !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["web-smoke.spec.ts"],
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["github"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: retainDebugArtifacts ? "only-on-failure" : "off",
    trace: retainDebugArtifacts ? "retain-on-failure" : "off",
    video: retainDebugArtifacts ? "retain-on-failure" : "off",
  },
  webServer: {
    command: "npm run export:web && node ./scripts/serve-dist.mjs",
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}`,
  },
});
