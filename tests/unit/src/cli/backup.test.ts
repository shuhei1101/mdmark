import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 写しの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/backup.ts");

/** CLI の誤りを読み込む */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

// 写しのフォルダ名に使う時刻（手元の時刻）
const NOW = new Date(2026, 9, 17, 12, 0, 0);

// 相対パスを保って写し、.gitignore を置く（正常系）
test("test_take_backup", async () => {
  // 準備
  const { takeBackup } = await loadModule();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "version: v0.3.0\n",
    "docs/a.md": "# A\n",
  });
  // 実行
  const backupDir = await takeBackup({
    dir,
    files: [join(dir, "mdmark.config.yaml"), join(dir, "docs", "a.md")],
    now: NOW,
  });
  // 検証
  expect(backupDir).toBe(join(dir, ".mdmark", "backup", "20261017120000"));
  expect(await readFile(join(backupDir, "mdmark.config.yaml"), "utf8")).toBe(
    "version: v0.3.0\n",
  );
  expect(await readFile(join(backupDir, "docs", "a.md"), "utf8")).toBe("# A\n");
  const ignore = await readFile(join(dir, ".mdmark", ".gitignore"), "utf8");
  expect(ignore.trim()).toBe("*");
});

// 同じ日時の写しがあれば別の名前にする（正常系）
test("test_take_backup_when_same_time", async () => {
  // 準備
  const { takeBackup } = await loadModule();
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": "version: v0.3.0\n" });
  const files = [join(dir, "mdmark.config.yaml")];
  // 実行
  const first = await takeBackup({ dir, files, now: NOW });
  const second = await takeBackup({ dir, files, now: NOW });
  // 検証
  expect(first).toBe(join(dir, ".mdmark", "backup", "20261017120000"));
  expect(second).toBe(join(dir, ".mdmark", "backup", "20261017120000-2"));
});

// 設定ファイルのフォルダの外のファイルは拒む（異常系）
test("test_take_backup_when_outside", async () => {
  // 準備
  const { takeBackup } = await loadModule();
  const { CliError } = await loadMain();
  const root = await createTempDir();
  const dir = join(root, "work");
  await writeFiles(root, {
    "work/mdmark.config.yaml": "version: v0.3.0\n",
    "outside.md": "# 外\n",
  });
  // 実行
  const result = takeBackup({
    dir,
    files: [join(dir, "mdmark.config.yaml"), join(root, "outside.md")],
    now: NOW,
  });
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  const backups = join(dir, ".mdmark", "backup");
  if (existsSync(backups)) {
    const entries = await readdir(backups, {
      recursive: true,
      withFileTypes: true,
    });
    expect(entries.filter((entry) => entry.isFile())).toEqual([]);
  }
});

// 書き換えたファイルを写しの中身に戻す（正常系）
test("test_restore_backup", async () => {
  // 準備
  const { takeBackup, restoreBackup } = await loadModule();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "version: v0.3.0\n",
    "docs/a.md": "# A\n",
  });
  const backupDir = await takeBackup({
    dir,
    files: [join(dir, "mdmark.config.yaml"), join(dir, "docs", "a.md")],
    now: NOW,
  });
  await writeFile(join(dir, "mdmark.config.yaml"), "version: v0.5.0\n");
  await writeFile(join(dir, "docs", "a.md"), "# 書き換えた\n");
  // 実行
  await restoreBackup({ dir, backupDir });
  // 検証
  expect(await readFile(join(dir, "mdmark.config.yaml"), "utf8")).toBe(
    "version: v0.3.0\n",
  );
  expect(await readFile(join(dir, "docs", "a.md"), "utf8")).toBe("# A\n");
});
