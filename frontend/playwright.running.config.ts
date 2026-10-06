import { defineConfig } from "@playwright/test";

/**
 * Runs the specs that need no database (signed-out pages) against a web app and API that are ALREADY running on ports 3000 and 8000,
 * for when those are in use and the full stack cannot start. Pick tests with -g, for example: pnpm exec playwright test -c playwright.running.config.ts -g "landing".
 */
export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  outputDir: "./e2e/.tmp/running-results",
  use: { baseURL: "http://localhost:3000", channel: "chrome", trace: "off", viewport: { width: 1280, height: 800 } },
  projects: [{ name: "desktop" }],
});
