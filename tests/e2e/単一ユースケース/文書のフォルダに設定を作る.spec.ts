import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { writeFiles } from "../cli.ts";
import { checkIssuesOf, expect, runFolderSetup, test } from "../setup-skill.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

// 文書のフォルダの設定ファイル
const CONFIG_FILE = "mdmark.config.yaml";
// 文書のフォルダに置く Markdown
const DOCUMENT = { "a.md": "# A\n" };
// 設定のある文書のフォルダの設定（コメントの行と `features.table: false` を持つ）
const EXISTING_CONFIG = [
  "# 文書のフォルダの設定",
  "features:",
  "  table: false # 表は使わない",
  "",
].join("\n");

/** ビルドした作業ツリーの `plugin/` */
const pluginOf = (builtRoot: string) => join(builtRoot, "plugin");

// 設定の無い文書のフォルダに、答えた値で mdmark.config.yaml を作る（正常シナリオ）
test("test_normal", async ({ builtRoot, terminal, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, DOCUMENT);
  // 実行
  const report = await runFolderSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    dir,
    values: { "features.callout": "false" },
    approveWrite: true,
  });
  // 検証
  const path = join(dir, CONFIG_FILE);
  expect(report.askedKeys).toContain("features.callout");
  expect(report.askedKeys).not.toContain("serve.tmuxSession");
  expect(parse(await readFile(path, "utf8")).features.callout).toBe(false);
  expect(await checkIssuesOf({ builtRoot, terminal, cwd: dir, path })).toEqual(
    [],
  );
  // 最後の報告の材料
  expect(report.written?.written).toEqual([path]);
  expect(report.written?.keys).toEqual(["features.callout"]);
});

// 設定のある文書のフォルダでは、変えるキーの行だけを書き換える（正常シナリオ（設定がある））
test("test_normal_when_config_exists", async ({
  builtRoot,
  terminal,
  tempDir,
}) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, { ...DOCUMENT, [CONFIG_FILE]: EXISTING_CONFIG });
  // 実行
  await runFolderSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    dir,
    values: { "features.callout": "false" },
    approveWrite: true,
  });
  // 検証
  const after = await readFile(join(dir, CONFIG_FILE), "utf8");
  const config = parse(after);
  expect(config.features.callout).toBe(false);
  expect(config.features.table).toBe(false);
  for (const line of EXISTING_CONFIG.split("\n").filter(Boolean)) {
    expect(after).toContain(line);
  }
});

// 書くことを断ると mdmark.config.yaml を作らない（異常シナリオ（書くことを断る））
test("test_error_when_write_declined", async ({
  builtRoot,
  terminal,
  tempDir,
}) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, DOCUMENT);
  // 実行
  const report = await runFolderSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    dir,
    values: { "features.callout": "false" },
    approveWrite: false,
  });
  // 検証
  expect(existsSync(join(dir, CONFIG_FILE))).toBe(false);
  // 最後の報告の材料
  expect(report.written).toBeUndefined();
});
