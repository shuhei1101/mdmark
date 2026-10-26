import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "vscode.spec.ts",
  // VS Code の取得を、ワーカーが並ぶ前の 1 回にする
  globalSetup: "../../../tests/e2e/global-setup.ts",
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
