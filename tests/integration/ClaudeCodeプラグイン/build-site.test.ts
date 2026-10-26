import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runCli, useTempDirs, writeFiles } from "../cli.ts";
import { callTool, useMcpServers } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectHttp } = useMcpServers();

/** 文書 2 つと、それをまとめる設定 */
const PROJECT_FILES = {
  "mdmark.config.yaml": [
    "build:",
    '  include: ["*.md"]',
    "  out: dist/docs.html",
    "",
  ].join("\n"),
  "a.md": "# A\n\n[B](b.md)\n",
  "b.md": "# B\n",
};

// 文書 2 つを 1 枚にまとめてパスと文書の数を返す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  const cliDir = await createTempDir();
  await writeFiles(dir, PROJECT_FILES);
  await writeFiles(cliDir, PROJECT_FILES);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "build_site", {});
  // 検証
  expect(result.isError).toBe(false);
  const json = JSON.parse(result.texts[0] ?? "");
  expect(json.out).toBe(join(dir, "dist", "docs.html"));
  expect(json.docs).toBe(2);
  expect(json.warnings).toEqual([]);
  // 同じフォルダで流した mdmark build の HTML と中身が同じ
  await runCli(["build"], cliDir);
  expect(await readFile(json.out, "utf8")).toBe(
    await readFile(join(cliDir, "dist", "docs.html"), "utf8"),
  );
});

// build の無い設定では何も書かずにエラーにする（異常系）
test("test_error_when_build_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "a.md": "# A\n",
  });
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "build_site", {});
  // 検証
  expect(result.isError).toBe(true);
  // mdmark build の標準エラーと同じ文
  const cli = await runCli(["build"], dir);
  expect(result.texts[0]).toBe(cli.stderr.trim());
  expect(existsSync(join(dir, "dist"))).toBe(false);
});

// project_dir を持たない呼び出しを、作業のフォルダを読まずにエラーにする（異常系）
test("test_error_when_project_dir_missing", async () => {
  // 準備
  const client = await connectHttp();
  // 実行
  const result = await callTool(client, "build_site", {});
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("project_dir");
  expect(result.texts[0]).toContain("プラグインを入れた");
});
