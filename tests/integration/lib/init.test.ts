import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, inject, test } from "vitest";
import { parse } from "yaml";
import { validateConfig } from "../../../src/cli/config.ts";
import { normalizeIndex } from "../../../src/knowledge/index-shape.ts";
import { linesOf, runCli, useTempDirs, writeFiles } from "../cli.ts";

const createTempDir = useTempDirs();

// TypeScript の雛形を置く順
const TYPESCRIPT_FILES = [
  "mdmark.config.yaml",
  "theme.css",
  "index.yaml",
  "extensions/example.ts",
  "tsconfig.json",
  "package.json",
];

/** 置いた設定と索引が、設定と索引の形に合うことを確かめる */
async function expectShapes(dir: string): Promise<void> {
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(validateConfig(config, "mdmark.config.yaml").issues).toEqual([]);
  const index = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  expect(normalizeIndex(index).problems).toEqual([]);
}

// 空のフォルダに TypeScript の雛形を置く（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  // 実行
  const result = await runCli(["init", dir], dir);
  // 検証
  expect(result.code).toBe(0);
  for (const path of TYPESCRIPT_FILES) {
    expect(existsSync(join(dir, path))).toBe(true);
  }
  await expectShapes(dir);
  expect(linesOf(result.stdout)).toEqual(
    TYPESCRIPT_FILES.map((path) => `置いた: ${path}`),
  );
  // 置いた設定の version は、ビルドした CLI に埋めた版
  const builtVersion = (
    await readFile(join(inject("builtRoot"), "version.ini"), "utf8")
  ).trim();
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(config.version).toBe(builtVersion);
});

// --js で JavaScript の拡張の雛形を置く（正常系）
test("test_normal_when_javascript", async () => {
  // 準備
  const typescript = await createTempDir();
  await runCli(["init", typescript], typescript);
  const dir = await createTempDir();
  // 実行
  const result = await runCli(["init", dir, "--js"], dir);
  // 検証
  expect(result.code).toBe(0);
  for (const path of ["extensions/example.js", "tsconfig.json"]) {
    expect(existsSync(join(dir, path))).toBe(true);
  }
  for (const path of ["extensions/example.ts", "package.json"]) {
    expect(existsSync(join(dir, path))).toBe(false);
  }
  for (const path of ["mdmark.config.yaml", "theme.css", "index.yaml"]) {
    expect(await readFile(join(dir, path), "utf8")).toBe(
      await readFile(join(typescript, path), "utf8"),
    );
  }
  expect(linesOf(result.stdout)).toHaveLength(5);
});

// 既にあるファイルを上書きせず、無いものだけを置く（正常系）
test("test_normal_when_file_exists", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: false\n",
  });
  // 実行
  const result = await runCli(["init", dir], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(await readFile(join(dir, "mdmark.config.yaml"), "utf8")).toBe(
    "features:\n  print: false\n",
  );
  const lines = linesOf(result.stdout);
  expect(lines[0]).toBe("置かなかった（既にある）: mdmark.config.yaml");
  expect(lines.filter((line) => line.startsWith("置いた:"))).toHaveLength(5);
});

// 置く先のフォルダを作れないと、書けないパスと直し方を示して終わる（異常系）
test("test_error_when_unwritable", async () => {
  // 準備
  const dir = await createTempDir();
  const target = join(dir, "target");
  await writeFiles(dir, { target: "ファイル\n" });
  // 実行
  const result = await runCli(["init", target], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain(target);
  expect(result.stderr).toContain("確かめて");
  expect(await readFile(target, "utf8")).toBe("ファイル\n");
});
