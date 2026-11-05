// PoC: @storybook/react-vite の 1 つの Storybook で、部品の HTML と React のコンポーネントのストーリーを並べる
import type { StorybookConfig } from "@storybook/react-vite";

/** 部品の HTML を返却する描画のインターフェース（scripts/storybook-render.ts） */
const renderOrigin = process.env.RENDER_ORIGIN;
if (renderOrigin === undefined) {
  throw new Error("RENDER_ORIGIN が無い");
}

const config: StorybookConfig = {
  framework: { name: "@storybook/react-vite", options: {} },
  stories: ["../poc-stories/*.stories.tsx"],
  addons: ["@storybook/addon-a11y"],
  core: { disableTelemetry: true },
  viteFinal: async (viteConfig) => {
    const { mergeConfig } = await import("vite");
    const { default: tailwindcss } = await import("@tailwindcss/vite");
    return mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
      server: { proxy: { "/render": renderOrigin } },
      // vscode/ の部品が vscode/node_modules の React を引かないよう、直下の 1 つにする
      resolve: { dedupe: ["react", "react-dom"] },
    });
  },
};

export default config;
