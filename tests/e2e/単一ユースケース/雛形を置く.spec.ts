import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { validateConfig } from "../../../src/cli/config.ts";
import { normalizeIndex } from "../../../src/knowledge/index-shape.ts";
import { expect, linesOf, runCli, test, writeFiles } from "../cli.ts";

// TypeScript の雛形を置く順
const TYPESCRIPT_FILES = [
  "mdmark.config.yaml",
  "theme.css",
  "index.yaml",
  "extensions/example.ts",
  "tsconfig.json",
  "package.json",
];

// 空のフォルダに TypeScript の雛形を置き、置いたファイルの一覧を出す（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  // 実行
  const result = await runCli(builtRoot, ["init"], dir);
  // 検証
  expect(result.code).toBe(0);
  for (const path of TYPESCRIPT_FILES) {
    expect(existsSync(join(dir, path))).toBe(true);
  }
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(validateConfig(config, "mdmark.config.yaml").issues).toEqual([]);
  const index = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  expect(normalizeIndex(index).problems).toEqual([]);
  expect(linesOf(result.stdout)).toEqual(
    TYPESCRIPT_FILES.map((path) => `置いた: ${path}`),
  );
});

// JavaScript の拡張の雛形を置き、TypeScript の雛形と tsconfig は置かない（正常シナリオ（JavaScript の雛形を置く））
test("test_normal_when_javascript", async ({ builtRoot, tempDir }) => {
  // 準備
  const typescript = await tempDir();
  await runCli(builtRoot, ["init"], typescript);
  const dir = await tempDir();
  // 実行
  const result = await runCli(builtRoot, ["init", "--js"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "extensions", "example.js"))).toBe(true);
  for (const path of [
    "extensions/example.ts",
    "tsconfig.json",
    "package.json",
  ]) {
    expect(existsSync(join(dir, path))).toBe(false);
  }
  for (const path of ["mdmark.config.yaml", "theme.css", "index.yaml"]) {
    expect(await readFile(join(dir, path), "utf8")).toBe(
      await readFile(join(typescript, path), "utf8"),
    );
  }
});

// 既にあるファイルを上書きせず、置かなかったファイルとして一覧に出す（正常シナリオ（既にあるファイルがある））
test("test_normal_when_file_exists", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: false\n",
  });
  // 実行
  const result = await runCli(builtRoot, ["init"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(await readFile(join(dir, "mdmark.config.yaml"), "utf8")).toBe(
    "features:\n  print: false\n",
  );
  for (const path of ["theme.css", "index.yaml", "extensions/example.ts"]) {
    expect(existsSync(join(dir, path))).toBe(true);
  }
  expect(linesOf(result.stdout)).toContain(
    "置かなかった（既にある）: mdmark.config.yaml",
  );
});
