import { build } from "esbuild";

// 非機能要件の対応ブラウザの下限
const BROWSER_TARGETS = ["chrome94", "firefox93", "safari16.4"];

/** PoC の入口をブラウザ向けの ES モジュール 1 つに束ね、出力ごとのバイト数を出す */
async function main(): Promise<void> {
  const result = await build({
    absWorkingDir: import.meta.dirname,
    entryPoints: ["src/index.ts"],
    outdir: "dist",
    bundle: true,
    format: "esm",
    platform: "browser",
    target: BROWSER_TARGETS,
    metafile: true,
  });
  for (const [path, output] of Object.entries(result.metafile.outputs)) {
    console.log(`${path} ${output.bytes} バイト`);
  }
  const minified = await build({
    absWorkingDir: import.meta.dirname,
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.min.js",
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    target: BROWSER_TARGETS,
    metafile: true,
  });
  for (const [path, output] of Object.entries(minified.metafile.outputs)) {
    console.log(`${path} ${output.bytes} バイト`);
  }
}

await main();
