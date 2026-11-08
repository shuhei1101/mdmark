import { join } from "node:path";
import { expect, test } from "vitest";
import { migrationsDirOf } from "../migrations-dir.ts";
import { useTempDirs, writeFiles } from "./helpers/cli.ts";

const createTempDir = useTempDirs();

// スクリプトを持つバージョンのフォルダを、別の手順を持つ `next/` があっても返却する（正常系）
test("test_migrations_dir_of", async () => {
  // 準備
  const root = await createTempDir();
  await writeFiles(root, {
    "files.yaml": "",
    "next/steps.yaml": "",
    "next/other.mjs": "",
    "v0.10.0/steps.yaml": "",
    "v0.10.0/target.mjs": "",
  });
  // 実行
  const result = migrationsDirOf("target.mjs", root);
  // 検証
  expect(result).toBe(join(root, "v0.10.0"));
});

// スクリプトを `next/` が持てば `next/` を返却する（正常系）
test("test_migrations_dir_of_when_next", async () => {
  // 準備
  const root = await createTempDir();
  await writeFiles(root, {
    "next/target.mjs": "",
    "v0.9.0/other.mjs": "",
  });
  // 実行
  const result = migrationsDirOf("target.mjs", root);
  // 検証
  expect(result).toBe(join(root, "next"));
});

// スクリプトを持つフォルダが無ければ例外を投げる（異常系）
test("test_migrations_dir_of_without_script", async () => {
  // 準備
  const root = await createTempDir();
  await writeFiles(root, { "v0.9.0/other.mjs": "" });
  // 実行・検証
  expect(() => migrationsDirOf("target.mjs", root)).toThrow("0 件");
});

// スクリプトを持つフォルダが 2 つ以上あれば例外を投げる（異常系）
test("test_migrations_dir_of_when_duplicated", async () => {
  // 準備
  const root = await createTempDir();
  await writeFiles(root, {
    "next/target.mjs": "",
    "v0.9.0/target.mjs": "",
  });
  // 実行・検証
  expect(() => migrationsDirOf("target.mjs", root)).toThrow("2 件");
});
