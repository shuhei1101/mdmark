import { availableParallelism, tmpdir } from "node:os";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import manifest from "./package.json" with { type: "json" };
import { clearGitLocalEnv } from "./tests/git-env.ts";
import { fixturesPlugin } from "./tests/integration/fixtures-plugin.ts";

/** Webview の部品（vscode/）とテストの道具（直下）が同じものを使用する依存 */
const WEBVIEW_DEPENDENCIES = [
  "react",
  "react-dom",
  "msw",
  "lucide-react",
  "react-error-boundary",
  "@radix-ui/react-slot",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
];

/** 結合テストが同時に実行するファイルの数（CPU 数の半分。ほかの作業と重なってもメモリを使い切らない）。Vitest は同じ groupOrder のプロジェクトに同じ maxWorkers を求め、Node のプール（integration-node・integration-storybook）とブラウザのプール（integration-browser）のそれぞれの上限にする */
const INTEGRATION_MAX_WORKERS = Math.max(
  1,
  Math.floor(availableParallelism() / 2),
);
// 結合テストのプロジェクトを unit・unit-browser と別のグループにする（maxWorkers が違うプロジェクトは同じグループに置けない）
const INTEGRATION_GROUP_ORDER = 1;

// Git のフックなど GIT_DIR を持つ環境から呼んでも、一時のフォルダで git を呼ぶテストが作業中のリポジトリへ書き込まないようにする
clearGitLocalEnv();

export default defineConfig({
  // バンドルしていないアイコンを読み込む URL のバージョン（ビルドと同じく依存の lucide のバージョンを埋める）
  define: {
    __MDMARK_LUCIDE_VERSION__: JSON.stringify(manifest.dependencies.lucide),
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          exclude: ["tests/unit/**/*.browser.test.ts"],
          // 全ファイルを並列に実行すると、最初の import で CLI のビルドの負荷に重なり 5 秒を超えることがある
          testTimeout: 30_000,
        },
      },
      {
        // DOM を使用する単体テストは Chromium の中で実行する。MSW の Service Worker を Storybook と同じフォルダから配る
        publicDir: ".storybook/public",
        // Webview の部品（vscode/）とテストの道具（直下）が同じ React を使用する
        resolve: { dedupe: WEBVIEW_DEPENDENCIES },
        // テストの途中で依存を見つけて再読み込みしないよう、Webview の依存を先に事前バンドルする
        optimizeDeps: {
          include: [
            ...WEBVIEW_DEPENDENCIES,
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom/client",
            "msw/browser",
            "@testing-library/react",
          ],
        },
        test: {
          name: "unit-browser",
          include: ["tests/unit/**/*.browser.test.{ts,tsx}"],
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
          // CLI を子プロセスで実行し、書き出した HTML をブラウザで開くテストを含む
          testTimeout: 60_000,
          include: ["tests/integration/**/*.test.ts"],
          exclude: [
            "tests/integration/**/*.browser.test.ts",
            "tests/integration/**/*.story.test.ts",
          ],
          globalSetup: ["tests/integration/global-setup.ts"],
          maxWorkers: INTEGRATION_MAX_WORKERS,
          sequence: { groupOrder: INTEGRATION_GROUP_ORDER },
        },
      },
      {
        // 部品のストーリーを Playwright で開くため、Storybook の開発サーバーを起動する
        test: {
          name: "integration-storybook",
          environment: "node",
          include: ["tests/integration/**/*.story.test.ts"],
          globalSetup: ["tests/integration/storybook-setup.ts"],
          testTimeout: 60_000,
          // 各ファイルの beforeAll が共有の Chromium に接続する。接続の上限（tests/integration/storybook-setup.ts の CONNECT_TIMEOUT_MS の 50 ミリ秒）に、その 50% の余裕を足した
          hookTimeout: 75,
          maxWorkers: INTEGRATION_MAX_WORKERS,
          sequence: { groupOrder: INTEGRATION_GROUP_ORDER },
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
          maxWorkers: INTEGRATION_MAX_WORKERS,
          sequence: { groupOrder: INTEGRATION_GROUP_ORDER },
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
