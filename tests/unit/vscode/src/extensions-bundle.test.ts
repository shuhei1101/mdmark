import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { beforeAll, expect, test, vi } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 拡張を束ねる処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../vscode/src/extensions-bundle.ts");

const createTempDir = useTempDirs();

/** `dist/esbuild.wasm` を置いた、拡張機能のフォルダの代わり */
let extensionPath: string;

beforeAll(async () => {
  // esbuild-wasm の browser.js は `self` を参照する（拡張機能ではビルドのプラグインが足す）
  Object.assign(globalThis, { self: globalThis });
  extensionPath = await createTempDir();
  await mkdir(join(extensionPath, "dist"));
  const require = createRequire(
    resolve(import.meta.dirname, "../../../../vscode/package.json"),
  );
  await copyFile(
    require.resolve("esbuild-wasm/esbuild.wasm"),
    join(extensionPath, "dist", "esbuild.wasm"),
  );
});

// .ts とその相対パス・URL の import を 1 つに束ねる（正常系）
test("test_bundle_extensions", async () => {
  // 準備
  const { bundleExtensions } = await loadModule();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "entry.ts": [
      'import { label } from "./lib.ts";',
      'import { suffix } from "https://cdn.example/a.js";',
      "type Extension = { name: string };",
      "const extension: Extension = { name: label + suffix };",
      "export default extension;",
      "",
    ].join("\n"),
    "lib.ts": 'export const label: string = "poc";\n',
  });
  const fetchText = vi.fn(async () => 'export const suffix = "-x";');
  // 実行
  const [result] = await bundleExtensions({
    paths: [join(dir, "entry.ts")],
    extensionPath,
    fetchText,
  });
  // 検証
  if (result === undefined || !("code" in result)) {
    throw new Error(`束ねられなかった: ${JSON.stringify(result)}`);
  }
  expect(result.path).toBe(join(dir, "entry.ts"));
  expect(result.code).not.toMatch(/\bimport\b/);
  expect(result.code).not.toContain("Extension");
  expect(result.code).toMatch(/\bexport\b/);
  expect(fetchText).toHaveBeenCalledWith("https://cdn.example/a.js");
});

// 束ねられない拡張は理由を返して次へ進む（異常系）
test("test_bundle_extensions_when_error", async () => {
  // 準備
  const { bundleExtensions } = await loadModule();
  const dir = await createTempDir();
  await writeFiles(dir, { "entry.ts": "export default { name: 'a' };\n" });
  // 実行
  const results = await bundleExtensions({
    paths: [join(dir, "missing.ts"), join(dir, "entry.ts")],
    extensionPath,
  });
  // 検証
  expect(results[0]).toHaveProperty("error");
  expect(results[1]).toHaveProperty("code");
});
