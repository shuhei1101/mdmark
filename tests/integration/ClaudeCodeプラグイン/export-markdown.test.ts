import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { INQUIRY_COUNT_TEXT } from "../../unit/helpers/charts.ts";
import { wrapDirective } from "../../unit/helpers/diagrams.ts";
import { runCli, useTempDirs, writeFiles } from "../cli.ts";
import { callTool, useMcpServers } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectHttp } = useMcpServers();

/** 目次のマーカーと chart を 1 つ持つ文書と設定 */
const PROJECT_FILES = {
  "mdmark.config.yaml": "features:\n  print: true\n",
  "guide.mark.md": [
    "# ガイド",
    "",
    "<!-- toc -->",
    "",
    "## 件数",
    "",
    wrapDirective("chart", INQUIRY_COUNT_TEXT),
  ].join("\n"),
};

// 文書を Markdown と SVG に書き出してパスを返却する（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  const cliDir = await createTempDir();
  await writeFiles(dir, PROJECT_FILES);
  await writeFiles(cliDir, PROJECT_FILES);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "export_markdown", {
    file: "guide.mark.md",
  });
  // 検証
  expect(result.isError).toBe(false);
  const json = JSON.parse(result.texts[0] ?? "");
  expect(json.out).toBe(join(dir, "guide-markdown", "guide.md"));
  expect(json.images).toEqual([
    join(dir, "guide-markdown", "images", "figure-1.svg"),
  ]);
  expect(existsSync(json.out)).toBe(true);
  // 同じ文書で実行した mdmark export-markdown の Markdown と SVG と中身が同じ
  await runCli(["export-markdown", "guide.mark.md"], cliDir);
  expect(await readFile(json.out, "utf8")).toBe(
    await readFile(join(cliDir, "guide-markdown", "guide.md"), "utf8"),
  );
  expect(await readFile(json.images[0], "utf8")).toBe(
    await readFile(
      join(cliDir, "guide-markdown", "images", "figure-1.svg"),
      "utf8",
    ),
  );
});

// 無い文書は何も書き込まずにエラーにする（異常系）
test("test_error_when_file_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, PROJECT_FILES);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "export_markdown", {
    file: "missing.md",
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("missing.md");
  expect(existsSync(join(dir, "missing-markdown"))).toBe(false);
});

// project_dir を持たない呼び出しを、作業のフォルダを読み込まずにエラーにする（異常系）
test("test_error_when_project_dir_missing", async () => {
  // 準備
  const client = await connectHttp();
  // 実行
  const result = await callTool(client, "export_markdown", {
    file: "guide.mark.md",
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("project_dir");
  expect(result.texts[0]).toContain("プラグインを入れた");
});
