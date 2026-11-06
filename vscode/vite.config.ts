import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Webview を `media/preview.js`（ES モジュール 1 ファイル）と `media/preview.css` に書く */
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: { alias: { "@": new URL("./src/webview", import.meta.url).pathname } },
  build: {
    lib: {
      entry: "src/webview/main.tsx",
      formats: ["es"],
      fileName: () => "preview.js",
      cssFileName: "preview",
    },
    outDir: "media",
    // 結合テストのビルドが `media/test/` に置く axe を残す
    emptyOutDir: false,
    target: "es2022",
    cssCodeSplit: false,
    modulePreload: false,
    // CSS に `data:` を埋めず、CSP の `img-src` を広げない
    assetsInlineLimit: 0,
    rolldownOptions: {
      // Webview のリソースの範囲の外へチャンクを読みに行かない
      output: { codeSplitting: false },
    },
  },
  // ライブラリの形で書くと `process.env.NODE_ENV` が残るため、本番の React にする
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
