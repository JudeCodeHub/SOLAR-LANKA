import { defineConfig } from "@playwright/test";

/** Checks only the /design page, so it needs no database or API: it starts the web app alone on port 3100. Run it with `pnpm design-axe`. */
const RUNNING = process.env.DESIGN_URL;

export default defineConfig({
  testDir: "./e2e/design",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  outputDir: "./e2e/.tmp/design-results",
  use: { baseURL: RUNNING ?? "http://localhost:3100", channel: "chrome", trace: "off", viewport: { width: 1280, height: 800 } },
  // DESIGN_URL points at a web app that is already running (Next allows one dev server per folder), so none is started.
  webServer: RUNNING ? undefined : {
    command: "node_modules/.bin/next dev -p 3100",
    url: "http://localhost:3100/design",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { API_BASE_URL: "http://127.0.0.1:8000" },
  },
});
