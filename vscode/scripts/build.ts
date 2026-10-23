import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

/** 拡張機能と Webview のスクリプトを束ね、`tests` が `true` のときは結合テストも `out/test/` に束ねる */
export async function buildExtension(options: {
  /** `vscode/` の場所 */
  root: string;
  /** 結合テストも束ねるか */
  tests: boolean;
}): Promise<void> {
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
  });
  // Webview の中で動くスクリプトと CSS: mdmark の配布物は束ねず、実行時に読む
  await build({
    ...common,
    entryPoints: ["src/webview/preview.ts"],
    outfile: "media/preview.js",
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  await build({
    ...common,
    entryPoints: ["src/webview/preview.css"],
    outfile: "media/preview.css",
    target: ["chrome120"],
  });
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
    external: ["vscode", "mocha"],
  });
}

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
