import { defineConfig } from "@playwright/test";

/**
 * A separate, opt-in check against a real Clerk development instance: no sign-in bypass and no test database.
 * It starts the web app with the Clerk keys from frontend/.env. Run it with `pnpm exec playwright test -c playwright.live.config.ts`.
 * The tests that sign in need a test user you created yourself; see "Try it with a real Clerk instance" in the README.
 */
export default defineConfig({
  testDir: "./e2e/live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"]],
  outputDir: "./e2e/.tmp/live-results",
  use: { baseURL: "http://localhost:3000", channel: "chrome", trace: "off" },
  webServer: {
    command: "node_modules/.bin/next dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { API_BASE_URL: "http://127.0.0.1:8000" },
  },
});
