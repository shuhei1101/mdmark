import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runCli, useTempDirs, writeFiles } from "../cli.ts";
import { callTool, useMcpServers } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectHttp } = useMcpServers();

/** 表と注意書きを持つ文書と設定 */
const PROJECT_FILES = {
  "mdmark.config.yaml": "features:\n  print: true\n",
  "guide.md": [
    "# ガイド",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "> [!NOTE]",
    "> 注意書き",
    "",
  ].join("\n"),
};

// 文書を 1 枚の HTML に書き出してパスを返す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  const cliDir = await createTempDir();
  await writeFiles(dir, PROJECT_FILES);
  await writeFiles(cliDir, PROJECT_FILES);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "export_html", { file: "guide.md" });
  // 検証
  expect(result.isError).toBe(false);
  const json = JSON.parse(result.texts[0] ?? "");
  expect(json.out).toBe(join(dir, "guide.html"));
  expect(json.warnings).toEqual([]);
  expect(existsSync(json.out)).toBe(true);
  // 同じ文書で流した mdmark export の HTML と中身が同じ
  await runCli(["export", "guide.md"], cliDir);
  expect(await readFile(json.out, "utf8")).toBe(
    await readFile(join(cliDir, "guide.html"), "utf8"),
  );
});

// 無い文書は何も書かずにエラーにする（異常系）
test("test_error_when_file_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, PROJECT_FILES);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "export_html", { file: "missing.md" });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("missing.md");
  expect(existsSync(join(dir, "missing.html"))).toBe(false);
});

// project_dir を持たない呼び出しを、作業のフォルダを読まずにエラーにする（異常系）
test("test_error_when_project_dir_missing", async () => {
  // 準備
  const client = await connectHttp();
  // 実行
  const result = await callTool(client, "export_html", { file: "guide.md" });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("project_dir");
  expect(result.texts[0]).toContain("プラグインを入れた");
});
