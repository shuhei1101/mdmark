// PoC: Webview の React のスクリプトと CSS を media/preview.js・media/preview.css に出力する
import { appendFileSync } from "node:fs";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** React Compiler の結果を 1 行ずつ書くファイル（環境変数があるときだけ） */
const compilerLog = process.env.MDMARK_POC_COMPILER_LOG;

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [
        reactCompilerPreset({
          logger: {
            logEvent: (
              filename: string | null,
              event: { kind: string; fnName?: string | null; detail?: unknown },
            ) => {
              if (compilerLog !== undefined) {
                appendFileSync(
                  compilerLog,
                  `${event.kind} ${filename ?? ""} ${event.fnName ?? ""} ${event.kind === "CompileError" ? JSON.stringify(event.detail).slice(0, 400) : ""}\n`,
                );
              }
            },
          },
        }),
      ],
    }),
    tailwindcss(),
  ],
  build: {
    outDir: "media",
    emptyOutDir: false,
    target: "es2022",
    cssCodeSplit: false,
    modulePreload: false,
    lib: {
      entry: "src/webview/react/main.tsx",
      formats: ["es"],
      fileName: () => "preview.js",
      cssFileName: "preview",
    },
    rolldownOptions: {
      output: { codeSplitting: false },
    },
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
