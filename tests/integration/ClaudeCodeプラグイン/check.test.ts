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

/** フォルダの下のファイルの中身を、パスと並べて読み込む */
async function snapshot(dir: string, paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((path) => readFile(join(dir, path), "utf8")));
}

// ずれの無いフォルダで空の一覧を返却する（正常系）
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
      "schema: 2",
      "docs:",
      "  - id: a",
      "    path: a.mark.md",
      "    title: A",
      "  - id: b",
      "    path: b.mark.md",
      "    title: B",
      "",
    ].join("\n"),
    "a.mark.md": "# A\n",
    "b.mark.md": "# B\n",
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

// CLI と同じずれを一覧で返却する（正常系）
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
      "schema: 2",
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

// 設定ファイルが見つからないと mdmark init で配置できることを返却する（異常系）
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

// base を指定すると、mdmark check --base と同じ修正漏れを返却する（正常系（比べる基準を指定する））
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

// CLI と同じ拡張子の提案を返却する（正常系（記法を含む純粋な .md がある））
test("test_normal_when_plain_md_has_marks", async () => {
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
      "schema: 2",
      "docs:",
      "  - id: a",
      "    path: a.mark.md",
      "    title: A",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "",
    ].join("\n"),
    "a.mark.md": "# A\n",
    "b.md": [
      "# B",
      "",
      "",
      "",
      '<!-- table: {"kind": "data"} -->',
      "| a |",
      "| - |",
      "<!-- /table -->",
      "",
    ].join("\n"),
  };
  await writeFiles(dir, files);
  const before = await snapshot(dir, Object.keys(files));
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "check", {});
  // 検証
  expect(result.isError).toBe(false);
  const issues = JSON.parse(result.texts[0] ?? "").issues as Issue[];
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    file: "b.md",
    where: "5",
    kind: "plain_md_with_marks",
  });
  expect(issues[0]?.message).toContain("b.mark.md");
  const cli = await runCli(["check"], dir);
  expect(linesOf(cli.stdout).slice(0, -1)).toEqual(issues.map(toLine));
  expect(await snapshot(dir, Object.keys(files))).toEqual(before);
});

// project_dir を持たない呼び出しを、作業のフォルダを読み込まずにエラーにする（異常系）
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

// text と file・key を指定すると、mdmark check --text・--file --key と同じずれを返却する（正常系（文字列と YAML のキーを指定する））
test("test_normal_when_text_and_key", async () => {
  // 準備
  const dir = await createTempDir();
  const body = "# 見出し\n本文\n<!-- tabz -->\n";
  const files = {
    "mdmark.config.yaml": [
      "index: index.yaml",
      "build:",
      '  include: ["*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "",
    ].join("\n"),
    "a.md": "# A\n",
    "records.yaml": [
      "title: 記録",
      "items:",
      "  - id: a",
      "    name: 1 つ目",
      "    body: |",
      ...body
        .trimEnd()
        .split("\n")
        .map((line) => `      ${line}`),
      "",
    ].join("\n"),
  };
  await writeFiles(dir, files);
  const before = await snapshot(dir, Object.keys(files));
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const byText = await callTool(client, "check", { text: body });
  const byKey = await callTool(client, "check", {
    file: "records.yaml",
    key: "items[0].body",
  });
  // 検証
  expect(byText.isError).toBe(false);
  expect(byKey.isError).toBe(false);
  const textIssues = JSON.parse(byText.texts[0] ?? "").issues as Issue[];
  const keyIssues = JSON.parse(byKey.texts[0] ?? "").issues as Issue[];
  expect(
    textIssues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([{ file: "-", where: "3", kind: "unknown_mark" }]);
  expect(
    keyIssues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([{ file: "records.yaml", where: "8", kind: "unknown_mark" }]);
  const cliText = await runCli(["check", "--text", body], dir);
  const cliKey = await runCli(
    ["check", "--file", "records.yaml", "--key", "items[0].body"],
    dir,
  );
  expect(linesOf(cliText.stdout).slice(0, -1)).toEqual(textIssues.map(toLine));
  expect(linesOf(cliKey.stdout).slice(0, -1)).toEqual(keyIssues.map(toLine));
  expect(await snapshot(dir, Object.keys(files))).toEqual(before);
});

// CLI と同じ include_target_missing のずれを返却し、説明文で取り込み先も点検すると通知する（正常系（取り込み先が無い））
test("test_normal_when_include_targets_missing", async () => {
  // 準備
  const dir = await createTempDir();
  const files = {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["docs/*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "docs/a.mark.md": [
      "# A",
      "",
      '<!-- include: {"path": "missing.md"} -->',
      "",
      '<!-- include: {"path": "共通/手順.md", "heading": "実行"} -->',
      "",
    ].join("\n"),
    "docs/b.mark.md": [
      "# B",
      '<!-- include: {"path": "共通/手順.md", "heading": "無い見出し"} -->',
      "",
      '<!-- include: {"path": "../src/app.ts", "lines": {"from": 8, "to": 10}} -->',
      "",
    ].join("\n"),
    "docs/共通/手順.md": "## 実行\n\n実行の段落\n",
    "src/app.ts": "1\n2\n3\n4\n5\n",
  };
  await writeFiles(dir, files);
  const before = await snapshot(dir, Object.keys(files));
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const { tools } = await client.listTools();
  const result = await callTool(client, "check", {});
  // 検証
  const check = tools.find((tool) => tool.name === "check");
  expect(check?.description).toContain("include のマーカーの取り込み先");
  expect(result.isError).toBe(false);
  const issues = JSON.parse(result.texts[0] ?? "").issues as Issue[];
  expect(
    issues.filter((issue) => issue.kind === "include_target_missing"),
  ).toHaveLength(3);
  const cli = await runCli(["check"], dir);
  expect(linesOf(cli.stdout).slice(0, -1)).toEqual(issues.map(toLine));
  expect(await snapshot(dir, Object.keys(files))).toEqual(before);
});
