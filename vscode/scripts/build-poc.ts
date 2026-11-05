// PoC: 拡張機能を esbuild、Webview を Vite（--baseline のときは今の esbuild のまま）で出力し、
// PoC の結合テスト（index.ts と poc-react.test.ts）だけを out/test/ に出力する。axe は media/test/axe.js に複写する
import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";
import { build as viteBuild } from "vite";
import { buildExtension } from "./build.ts";

const root = join(import.meta.dirname, "..");
const baseline = process.argv.includes("--baseline");

await buildExtension({ root, tests: false });
if (!baseline) {
  await viteBuild({ root, configFile: join(root, "vite.config.ts") });
}
await rm(join(root, "out", "test"), { recursive: true, force: true });
await build({
  absWorkingDir: root,
  bundle: true,
  logLevel: "silent",
  entryPoints: [
    join("tests", "integration", "index.ts"),
    join("tests", "integration", "poc-react.test.ts"),
  ],
  outdir: "out/test",
  outExtension: { ".js": ".mjs" },
  format: "esm",
  platform: "node",
  target: "node22",
  external: ["vscode", "mocha", "playwright", "yaml"],
});
await mkdir(join(root, "media", "test"), { recursive: true });
await copyFile(
  join(root, "node_modules", "axe-core", "axe.min.js"),
  join(root, "media", "test", "axe.js"),
);
