import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { createIo, useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 雛形を置く処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadInit = () => import("../../../../src/cli/init.ts");

// 雛形の正本は作業ツリーの templates/
const TEMPLATES_DIR = join(process.cwd(), "templates");

const createTempDir = useTempDirs();

// 空のフォルダに 6 つの雛形を置く（正常系）
test("test_run_init", async () => {
  // 準備
  const { runInit } = await loadInit();
  const dir = await createTempDir();
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runInit(
    { dir, js: false, templatesDir: TEMPLATES_DIR, version: "v0.5.0" },
    io,
  );
  // 検証
  expect(code).toBe(0);
  const placed = [
    "mdmark.config.yaml",
    "theme.css",
    "index.yaml",
    "extensions/example.ts",
    "tsconfig.json",
    "package.json",
  ];
  for (const path of placed) {
    expect(existsSync(join(dir, path))).toBe(true);
  }
  expect(stdout).toEqual(placed.map((path) => `置いた: ${path}`));
});

// --js では JavaScript の拡張だけを置く（正常系）
test("test_run_init_when_javascript", async () => {
  // 準備
  const { runInit } = await loadInit();
  const dir = await createTempDir();
  const { io } = createIo(dir);
  // 実行
  await runInit(
    { dir, js: true, templatesDir: TEMPLATES_DIR, version: "v0.5.0" },
    io,
  );
  // 検証
  expect(existsSync(join(dir, "extensions", "example.js"))).toBe(true);
  expect(existsSync(join(dir, "extensions", "example.ts"))).toBe(false);
  expect(existsSync(join(dir, "tsconfig.json"))).toBe(false);
  expect(existsSync(join(dir, "package.json"))).toBe(false);
});

// 既にあるファイルを上書きしない（正常系）
test("test_run_init_when_file_exists", async () => {
  // 準備
  const { runInit } = await loadInit();
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": "x: 1\n" });
  const { io, stdout } = createIo(dir);
  // 実行
  await runInit(
    { dir, js: false, templatesDir: TEMPLATES_DIR, version: "v0.5.0" },
    io,
  );
  // 検証
  expect(await readFile(join(dir, "mdmark.config.yaml"), "utf8")).toBe(
    "x: 1\n",
  );
  expect(stdout).toContain("置かなかった（既にある）: mdmark.config.yaml");
});

// 置く設定の version を呼んだ CLI の版にする（正常系）
test("test_run_init_writes_version", async () => {
  // 準備
  const { runInit } = await loadInit();
  const dir = await createTempDir();
  const { io } = createIo(dir);
  const template = await readFile(
    join(TEMPLATES_DIR, "mdmark.config.yaml"),
    "utf8",
  );
  // 実行
  await runInit(
    { dir, js: false, templatesDir: TEMPLATES_DIR, version: "v0.5.0" },
    io,
  );
  // 検証
  const placed = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  expect(parse(placed).version).toBe("v0.5.0");
  expect(placed).toBe(template.replace(/^version: .*$/m, "version: v0.5.0"));
});
