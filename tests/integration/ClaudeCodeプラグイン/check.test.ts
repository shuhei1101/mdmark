import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  BASE_TAG,
  createChangeTogetherDir,
  linesOf,
  runCli,
  useTempDirs,
  writeFiles,
} from "../cli.ts";
import { callTool, useMcpServers } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectHttp } = useMcpServers();

/** ずれの一覧の 1 件 */
type Issue = { file: string; where: string; kind: string; message: string };

/** ずれを `mdmark check` の出力の行にする */
function toLine(issue: Issue): string {
  const place =
    issue.where === "" ? issue.file : `${issue.file}:${issue.where}`;
  return `${place}: ${issue.kind}: ${issue.message}`;
}

/** フォルダの下のファイルの中身を、パスと並べて読む */
async function snapshot(dir: string, paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((path) => readFile(join(dir, path), "utf8")));
}

// ずれの無いフォルダで空の一覧を返す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  const files = {
    "mdmark.config.yaml": [
      "index: index.yaml",
      "build:",
      '  include: ["*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "",
    ].join("\n"),
    "a.md": "# A\n",
    "b.md": "# B\n",
  };
  await writeFiles(dir, files);
  const before = await snapshot(dir, Object.keys(files));
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "check", {});
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "")).toEqual({ issues: [] });
  expect(await snapshot(dir, Object.keys(files))).toEqual(before);
});

// CLI と同じずれを一覧で返す（正常系）
test("test_normal_when_drift", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "index: index.yaml",
      "build:",
      '  include: ["*.md"]',
      "",
    ].join("\n"),
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "  - id: old",
      "    path: old.md",
      "    title: Old",
      "",
    ].join("\n"),
    "a.md": "# A\n",
  });
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "check", {});
  // 検証
  expect(result.isError).toBe(false);
  const issues = JSON.parse(result.texts[0] ?? "").issues as Issue[];
  expect(
    issues.map((issue) => `${issue.file}:${issue.where}:${issue.kind}`),
  ).toEqual([
    "mdmark.config.yaml:build:schema",
    "index.yaml:docs[1].path:missing_doc",
  ]);
  const cli = await runCli(["check"], dir);
  expect(linesOf(cli.stdout).slice(0, -1)).toEqual(issues.map(toLine));
});

// 設定ファイルが見つからないと mdmark init で置けることを返す（異常系）
test("test_error_when_config_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, { "a.md": "# A\n" });
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "check", {});
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("mdmark.config.yaml");
  expect(result.texts[0]).toContain("mdmark init");
});

// base を渡すと、mdmark check --base と同じ直し忘れを返す（正常系（比べる基準を渡す））
test("test_normal_when_base_given", async () => {
  // 準備
  const dir = await createChangeTogetherDir(createTempDir);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "check", { base: BASE_TAG });
  // 検証
  expect(result.isError).toBe(false);
  const issues = JSON.parse(result.texts[0] ?? "").issues as Issue[];
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    file: "b.md",
    where: "",
    kind: "missed_change_together",
  });
  const cli = await runCli(["check", "--base", BASE_TAG], dir);
  expect(linesOf(cli.stdout).slice(0, -1)).toEqual(issues.map(toLine));
});

// project_dir を持たない呼び出しを、作業のフォルダを読まずにエラーにする（異常系）
test("test_error_when_project_dir_missing", async () => {
  // 準備
  const client = await connectHttp();
  // 実行
  const result = await callTool(client, "check", {});
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("project_dir");
  expect(result.texts[0]).toContain("プラグインを入れた");
});
