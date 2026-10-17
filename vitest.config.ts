import { tmpdir } from "node:os";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { fixturesPlugin } from "./tests/integration/fixtures-plugin.ts";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          exclude: ["tests/unit/**/*.browser.test.ts"],
          // 全ファイルを並列に流すと、最初の import で CLI のビルドの負荷に重なり 5 秒を超えることがある
          testTimeout: 30_000,
        },
      },
      {
        // DOM を使う単体テストは Chromium の中で流す
        test: {
          name: "unit-browser",
          include: ["tests/unit/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        test: {
          name: "integration-node",
          environment: "node",
          // CLI を子プロセスで流し、書き出した HTML をブラウザで開くテストを含む
          testTimeout: 60_000,
          include: ["tests/integration/**/*.test.ts"],
          exclude: [
            "tests/integration/**/*.browser.test.ts",
            "tests/integration/**/*.story.test.ts",
          ],
          globalSetup: ["tests/integration/global-setup.ts"],
        },
      },
      {
        // 部品のストーリーを Playwright で開くため、Storybook の開発サーバーを立てる
        test: {
          name: "integration-storybook",
          environment: "node",
          include: ["tests/integration/**/*.story.test.ts"],
          globalSetup: ["tests/integration/storybook-setup.ts"],
          testTimeout: 60_000,
        },
      },
      {
        // ビルドした配布物を一時フォルダから配るため、開発サーバーの配信を許す
        server: { fs: { allow: [tmpdir(), "."] } },
        // 外部ライブラリの代役のモジュールを配る
        plugins: [fixturesPlugin()],
        test: {
          name: "integration-browser",
          include: ["tests/integration/**/*.browser.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
