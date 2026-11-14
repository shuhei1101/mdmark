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

// 文書を 1 枚の HTML に書き出してパスを返却する（正常系）
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
  // 同じ文書で実行した mdmark export の HTML と中身が同じ
  await runCli(["export", "guide.md"], cliDir);
  expect(await readFile(json.out, "utf8")).toBe(
    await readFile(join(cliDir, "guide.html"), "utf8"),
  );
});

// keep_traces が true のとき、CLI の --keep-traces と同じ HTML を書き込む（正常系（隠さない書き出しを指定する））
test("test_normal_when_traces_kept", async () => {
  // 準備
  const dir = await createTempDir();
  const plainDir = await createTempDir();
  const cliDir = await createTempDir();
  for (const target of [dir, plainDir, cliDir]) {
    await writeFiles(target, PROJECT_FILES);
  }
  const client = await connectHttp({ projectDir: dir });
  const plainClient = await connectHttp({ projectDir: plainDir });
  // 実行
  const result = await callTool(client, "export_html", {
    file: "guide.md",
    keep_traces: true,
  });
  const plain = await callTool(plainClient, "export_html", {
    file: "guide.md",
  });
  // 検証
  expect(result.isError).toBe(false);
  const html = await readFile(JSON.parse(result.texts[0] ?? "").out, "utf8");
  await runCli(["export", "guide.md", "--keep-traces"], cliDir);
  expect(html).toBe(await readFile(join(cliDir, "guide.html"), "utf8"));
  expect(html).toContain('class="mdmark"');
  expect(html).toContain(":root{--mdmark-version:");
  const plainHtml = await readFile(
    JSON.parse(plain.texts[0] ?? "").out,
    "utf8",
  );
  expect(plainHtml).not.toContain('class="mdmark"');
  expect(plainHtml).not.toContain(":root{--mdmark-version:");
});

// 無い文書は何も書き込まずにエラーにする（異常系）
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

// project_dir を持たない呼び出しを、作業のフォルダを読み込まずにエラーにする（異常系）
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
