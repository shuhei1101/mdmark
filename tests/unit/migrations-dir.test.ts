import { join } from "node:path";
import { expect, test } from "vitest";
import { latestMigrationsDir } from "../migrations-dir.ts";
import { useTempDirs, writeFiles } from "./helpers/cli.ts";

const createTempDir = useTempDirs();

// `next/` が有れば、バージョンのフォルダが有っても `next/` を返却する（正常系）
test("test_latest_migrations_dir_when_next", async () => {
  // 準備
  const root = await createTempDir();
  await writeFiles(root, {
    "next/steps.yaml": "",
    "v0.9.0/steps.yaml": "",
  });
  // 実行
  const result = latestMigrationsDir(root);
  // 検証
  expect(result).toBe(join(root, "next"));
});

// `next/` が無ければ、バージョンを数値で比べて最も新しいフォルダを返却する（正常系）
test("test_latest_migrations_dir_when_versions", async () => {
  // 準備
  const root = await createTempDir();
  await writeFiles(root, {
    "files.yaml": "",
    "v0.2.0/steps.yaml": "",
    "v0.10.0/steps.yaml": "",
    "v0.9.0/steps.yaml": "",
  });
  // 実行
  const result = latestMigrationsDir(root);
  // 検証
  expect(result).toBe(join(root, "v0.10.0"));
});

// `next/` もバージョンのフォルダも無ければ例外を投げる（異常系）
test("test_latest_migrations_dir_without_folder", async () => {
  // 準備
  const root = await createTempDir();
  await writeFiles(root, { "no-steps.yaml": "" });
  // 実行・検証
  expect(() => latestMigrationsDir(root)).toThrow(root);
});
