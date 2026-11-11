import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 設定を読み込む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/config.ts");

/** CLI の誤りを読み込む */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

// 上のフォルダの設定ファイルを見つける（正常系）
test("test_find_config_file", async () => {
  // 準備
  const { findConfigFile } = await loadModule();
  const root = await createTempDir();
  await writeFiles(root, { "mdmark.config.yaml": "features: {}\n" });
  const cwd = join(root, "a", "b");
  await mkdir(cwd, { recursive: true });
  // 実行
  const found = await findConfigFile(cwd, undefined);
  // 検証
  expect(found).toBe(join(root, "mdmark.config.yaml"));
});

// --config のパスを優先する（正常系）
test("test_find_config_file_when_explicit", async () => {
  // 準備
  const { findConfigFile } = await loadModule();
  const root = await createTempDir();
  await writeFiles(root, {
    "mdmark.config.yaml": "features: {}\n",
    "docs/mdmark.config.yaml": "features: {}\n",
  });
  // 実行
  const found = await findConfigFile(root, "docs/mdmark.config.yaml");
  // 検証
  expect(found).toBe(join(root, "docs", "mdmark.config.yaml"));
});

// 見つからないと CliError を投げる（異常系）
test("test_find_config_file_when_missing", async () => {
  // 準備
  const { findConfigFile } = await loadModule();
  const { CliError } = await loadMain();
  const cwd = await createTempDir();
  // 実行
  const result = findConfigFile(cwd, undefined);
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("mdmark init");
});

// 読み込んだ値とフォルダを返却する（正常系）
test("test_load_config", async () => {
  // 準備
  const { loadConfig } = await loadModule();
  const root = await createTempDir();
  await writeFiles(root, {
    "mdmark.config.yaml": 'build:\n  include: ["*.md"]\n  out: a.html\n',
  });
  // 実行
  const loaded = await loadConfig(join(root, "mdmark.config.yaml"));
  // 検証
  expect(loaded.dir).toBe(root);
  expect(loaded.raw).toMatchObject({ build: { out: "a.html" } });
});

// 読み込めない行を示す CliError を投げる（異常系）
test("test_load_config_when_yaml_broken", async () => {
  // 準備
  const { loadConfig } = await loadModule();
  const { CliError } = await loadMain();
  const root = await createTempDir();
  await writeFiles(root, {
    "mdmark.config.yaml": "features:\n  print: true\n table: false\n",
  });
  // 実行
  const result = loadConfig(join(root, "mdmark.config.yaml"));
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("3 行目");
});

// 構造が合わないと mdmark check を添えた CliError を投げる（異常系）
test("test_require_config_when_invalid", async () => {
  // 準備
  const { requireConfig } = await loadModule();
  const { CliError } = await loadMain();
  const root = await createTempDir();
  await writeFiles(root, { "mdmark.config.yaml": "libraries: chart.js\n" });
  // 実行
  const result = requireConfig(root, undefined);
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("libraries");
  await expect(result).rejects.toThrow("mdmark check");
});
