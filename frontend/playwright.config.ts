import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests run against a known database (the demo fixtures plus the E2E identities), the real API,
 * and the real web app. They use the Chrome installed on the machine, so no browser download is needed.
 * One worker: the signed-in person is a single shared setting.
 */
export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"]],
  outputDir: "./e2e/.tmp/results",
  use: { baseURL: "http://localhost:3000", channel: "chrome", trace: "off" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"], channel: "chrome", defaultBrowserType: "chromium" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: [
    { command: "node e2e/support/stack.ts", url: "http://127.0.0.1:8000/health", reuseExistingServer: false, timeout: 120_000, stdout: "ignore", stderr: "pipe" },
    {
      command: "node_modules/.bin/next dev",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 180_000,
      env: { API_BASE_URL: "http://127.0.0.1:8000", E2E_AUTH: "1" },
    },
  ],
});
