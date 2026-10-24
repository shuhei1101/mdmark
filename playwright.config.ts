import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // VS Code の取得を、ワーカーが並ぶ前の 1 回にする
  globalSetup: "./tests/e2e/global-setup.ts",
  // 作業ツリーを一時フォルダに作って依存を入れるテストがあるため、時間を長く取る
  timeout: 300_000,
  // VS Code は起動直後に組み込みの拡張機能を読み込んで重く、書き出しなどの結果が出るまで 5 秒を超えることがある
  expect: { timeout: 30_000 },
  reporter: "list",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
