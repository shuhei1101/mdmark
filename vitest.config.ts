import { tmpdir } from "node:os";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration-node",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          exclude: ["tests/integration/**/*.browser.test.ts"],
        },
      },
      {
        // ビルドした配布物を一時フォルダから配るため、開発サーバーの配信を許す
        server: { fs: { allow: [tmpdir(), "."] } },
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
