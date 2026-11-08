import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build, type Plugin } from "esbuild";
import { build as buildWebview } from "vite";

/** esbuild-wasm のブラウザ向けの入口は `self` を参照するため、拡張機能ホスト（Node）では先頭で `self` を `globalThis` にする */
const esbuildWasmSelfPlugin: Plugin = {
  name: "esbuild-wasm-self",
  setup(pluginBuild) {
    pluginBuild.onLoad(
      { filter: /esbuild-wasm[\\/]lib[\\/]browser\.js$/ },
      async (args) => ({
        contents: `var self = globalThis;\n${await readFile(args.path, "utf8")}`,
        loader: "js",
      }),
    );
  },
};

/** 拡張機能と Webview のスクリプトを束ね、`tests` が `true` のときは結合テストも `out/test/` に束ねる */
export const buildExtension = async (options: {
  /** `vscode/` の場所 */
  root: string;
  /** 結合テストも束ねるか */
  tests: boolean;
}): Promise<void> => {
  const { root, tests } = options;
  const common = {
    absWorkingDir: root,
    bundle: true,
    logLevel: "silent",
  } as const;
  // 拡張機能ホストで動く本体: `vscode` は束ねない
  await build({
    ...common,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.cjs",
    format: "cjs",
    platform: "node",
    target: "node22",
    external: ["vscode"],
    plugins: [esbuildWasmSelfPlugin],
  });
  // 拡張機能ホストの esbuild-wasm が読む WebAssembly
  const require = createRequire(join(root, "package.json"));
  await copyFile(
    require.resolve("esbuild-wasm/esbuild.wasm"),
    join(root, "dist", "esbuild.wasm"),
  );
  // Webview の中で動く React の画面と CSS: mdmark の配布物は束ねず、実行時に読む
  await buildWebview({ root, logLevel: "silent" });
  if (!tests) {
    return;
  }
  const directory = join(root, "tests", "integration");
  const names = (await readdir(directory)).filter(
    (name) => name === "index.ts" || name.endsWith(".test.ts"),
  );
  await build({
    ...common,
    entryPoints: names.map((name) => join("tests", "integration", name)),
    outdir: "out/test",
    outExtension: { ".js": ".mjs" },
    format: "esm",
    platform: "node",
    target: "node22",
    external: ["vscode", "mocha", "playwright", "yaml"],
  });
  // 結合テストの axe: Webview が `axe` を受けたときだけ読む（本番の `preview.js` には束ねない）
  await mkdir(join(root, "media", "test"), { recursive: true });
  await copyFile(
    require.resolve("axe-core/axe.min.js"),
    join(root, "media", "test", "axe.js"),
  );
};

// `node scripts/build.ts [--tests]` で入口として実行されたときだけ流す
if (import.meta.main) {
  buildExtension({
    root: join(import.meta.dirname, ".."),
    tests: process.argv.includes("--tests"),
  }).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
