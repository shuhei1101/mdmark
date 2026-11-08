import { existsSync } from "node:fs";
import type { StorybookConfig } from "@storybook/react-vite";

// 環境変数 `STORYBOOK_ALLOWED_HOSTS` をカンマで区切ったもの（無ければ持たない）
const allowedHosts = process.env.STORYBOOK_ALLOWED_HOSTS?.split(",");

/** 部品の HTML を返す描画の口（scripts/storybook-render.ts）の origin */
const renderOrigin = process.env.RENDER_ORIGIN;
if (renderOrigin === undefined) {
  throw new Error("RENDER_ORIGIN が無い（描画の口の origin を渡す）");
}

/** vscode/ の部品が vscode/node_modules を引かないよう、直下の 1 つにする依存 */
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

/** Storybook の設定: 部品の HTML のストーリーと、VS Code 拡張機能の React の部品のストーリーを 1 つに並べる */
const config: StorybookConfig = {
  framework: { name: "@storybook/react-vite", options: {} },
  stories: ["../src/**/*.stories.ts", "../vscode/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  // パネルのストーリーが読むこのブランチの配布物は、ビルドしてあるときだけ配る
  staticDirs: [
    "./public",
    ...(existsSync(new URL("../dist/index.js", import.meta.url))
      ? [{ from: "../dist", to: "/mdmark-dist" }]
      : []),
  ],
  core: {
    disableTelemetry: true,
    ...(allowedHosts ? { allowedHosts } : {}),
  },
  viteFinal: async (viteConfig) => {
    const { mergeConfig } = await import("vite");
    const { default: tailwindcss } = await import("@tailwindcss/vite");
    return mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
      server: { proxy: { "/render": renderOrigin } },
      resolve: {
        alias: {
          "@": new URL("../vscode/src/webview", import.meta.url).pathname,
        },
        dedupe: WEBVIEW_DEPENDENCIES,
      },
      // ストーリーを開く途中で依存を見つけて読み直さないよう、先に束ねる
      optimizeDeps: {
        include: [
          ...WEBVIEW_DEPENDENCIES,
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom/client",
          "msw/browser",
          "msw-storybook-addon/csf3",
        ],
      },
    });
  },
};

export default config;
