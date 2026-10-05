import { defineConfig } from "@playwright/test";

/**
 * Not a test run: this takes design review screenshots of the real app (pages, light and dark, three widths) into e2e/.tmp/screens.
 * It starts the same stack as the browser tests, so E2E_DATABASE_URL must point at a disposable database (see the README). Run it with `pnpm screens`.
 * SCREENS_LABEL names the set (default current), SCREENS_WIDTHS and SCREENS_THEMES narrow it, and -g public (or customer, company, technician, admin, records) picks a group.
 */
export default defineConfig({
  testDir: "./e2e/screens",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 900_000,
  reporter: [["list"]],
  outputDir: "./e2e/.tmp/screens-results",
  use: { baseURL: "http://localhost:3000", channel: "chrome", trace: "off", viewport: { width: 1280, height: 800 } },
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
