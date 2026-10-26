import { defineConfig, devices } from "@playwright/test";

// 検証ページを配信するポート
const PORT = 4789;
// 計測する画面の大きさ
const VIEWPORT = { width: 1280, height: 800 };

export default defineConfig({
  testDir: ".",
  testMatch: "poc.spec.ts",
  timeout: 120_000,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: "node server.mjs",
    cwd: import.meta.dirname,
    url: `http://127.0.0.1:${PORT}/tmp/poc/sticky-table-header/page.html`,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: VIEWPORT } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: VIEWPORT } },
  ],
});
