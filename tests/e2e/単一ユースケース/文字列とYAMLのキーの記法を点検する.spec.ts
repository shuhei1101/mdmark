import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CLEAN_FLOW,
  expect,
  flowLines,
  linesOf,
  runCli,
  test,
  writeFiles,
} from "../cli.ts";
import { mountDocument, openPage, renderInNode } from "../dist-page.ts";

// ブラウザを使用しないため、1 つのブラウザのプロジェクトだけで実行する
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 記載の警告を持つ文字列: 1 行目からノードの種類 `begin` のフロー図の定義、20 行目に `<!-- tabz -->`、22 行目に `<!-- code: highlight=9 -->` と 3 行のコードブロック */
const WARNINGS_MARKDOWN = (() => {
  const lines = flowLines({
    title: "判定",
    scope: "点検",
    updated: "2026-11-05",
    nodes: [{ id: "s", kind: "begin", name: "始める" }],
    wires: [],
  });
  while (lines.length < 18) {
    lines.push("");
  }
  lines.push("本文", "<!-- tabz -->", "", "<!-- code: highlight=9 -->");
  lines.push(
    "```ts",
    "const a = 1;",
    "const b = 2;",
    "const c = 3;",
    "```",
    "",
  );
  return lines.join("\n");
})();

/** `items[0].body` のブロックスカラーの 3 行目（ファイルの 8 行目）に `<!-- tabz -->` を持ち、`items[1].body` に正しい Markdown を持つ YAML */
const RECORDS_YAML = [
  "title: 記録",
  "items:",
  "  - id: a",
  "    name: 1 つ目",
  "    body: |",
  "      # 見出し",
  "      本文",
  "      <!-- tabz -->",
  "  - id: b",
  "    body: |",
  "      正しい本文",
  "",
].join("\n");

/** `mdmark init` を実行したフォルダを作る */
async function createInitDir(
  builtRoot: string,
  tempDir: () => Promise<string>,
): Promise<string> {
  const dir = await tempDir();
  await runCli(builtRoot, ["init"], dir);
  return dir;
}

/** フォルダの下のファイルのパスと中身を、パスの順に並べて読み込む */
async function snapshot(dir: string): Promise<string[]> {
  const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  return Promise.all(
    files.map(async (file) => `${file}\n${await readFile(file, "utf8")}`),
  );
}

// 記載の警告を持たない Markdown の文字列で、ずれ 0 件を出して終了コード 0 で終わる（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createInitDir(builtRoot, tempDir);
  const before = await snapshot(dir);
  const markdown = [
    ...flowLines(CLEAN_FLOW),
    "",
    "<!-- table: data -->",
    "",
    "| 列 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const result = await runCli(builtRoot, ["check", "--text", markdown], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["ずれ 0 件"]);
  expect(await snapshot(dir)).toEqual(before);
});

// 文字列を描いたときの記載の警告を、文字列の行を指すずれにする（正常シナリオ（記載の警告がある））
test("test_normal_when_warnings", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createInitDir(builtRoot, tempDir);
  // 実行: 標準入力から指定する
  const result = await runCli(
    builtRoot,
    ["check", "--text", "-"],
    dir,
    WARNINGS_MARKDOWN,
  );
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  expect(lines.slice(0, -1).map((line) => line.split(": ")[0])).toEqual([
    "-:1",
    "-:20",
    "-:22",
  ]);
  expect(lines.at(-1)).toBe("ずれ 3 件");
  // 記載の警告の行の内容が、同じ文字列を描いたときの警告の文言と同じ
  const html = await renderInNode(builtRoot, WARNINGS_MARKDOWN);
  const rendered = html
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/\s+/g, "");
  for (const line of [lines[0], lines[2]]) {
    const message = (line ?? "").replace(/^-:\d+: \w+: /, "");
    expect(rendered).toContain(message.replace(/[\s`]+/g, ""));
  }
});

// 描くときにスキップするマーカーの知らないキー・機能・指定を、知らないキー・機能・指定の種類のずれにする（正常シナリオ（知らないキー・機能・指定））
test("test_normal_when_unknown_mark_args", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createInitDir(builtRoot, tempDir);
  const markdown = [
    "<!-- table: data +unknown widht=説明 -->",
    "",
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
    "<!-- tabs: grop=os -->",
    "",
    "### macOS",
    "",
    "本文",
    "",
    "### Windows",
    "",
    "本文",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
  // 実行
  const result = await runCli(
    builtRoot,
    ["check", "--text", "-"],
    dir,
    markdown,
  );
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  const issues = lines.slice(0, -1);
  expect(issues).toHaveLength(3);
  // 種類は記載の警告でも知らないマーカーでもない
  for (const line of issues) {
    expect(line).toMatch(/^-:\d+: unknown_mark_arg: /);
  }
  const table = issues.filter((line) => line.startsWith("-:1: "));
  expect(table).toHaveLength(2);
  expect(table.join("\n")).toContain("+unknown");
  expect(table.join("\n")).toContain("sort");
  expect(table.join("\n")).toContain("widht=");
  expect(table.join("\n")).toContain("filter=");
  const tabs = issues.filter((line) => line.startsWith("-:8: "));
  expect(tabs).toHaveLength(1);
  expect(tabs[0]).toContain("grop=");
  expect(tabs[0]).toContain("group=");
  // 同じ文字列を描いたときは、記載の警告が出ない
  const html = await renderInNode(builtRoot, markdown);
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(lines.at(-1)).toBe("ずれ 3 件");
});

// YAML のキーの値の Markdown を点検し、YAML のファイルの行を指すずれにする（正常シナリオ（ファイルとYAMLのキー））
test("test_normal_when_yaml_key", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createInitDir(builtRoot, tempDir);
  await writeFiles(dir, { "records.yaml": RECORDS_YAML });
  // 実行
  const result = await runCli(
    builtRoot,
    ["check", "--file", "records.yaml", "--key", "items[0].body"],
    dir,
  );
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout).slice(0, -1);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^records\.yaml:8: unknown_mark: /);
  expect(lines[0]).toContain("tabz");
  expect(lines[0]).toContain("check.ignore");
  expect(await readFile(join(dir, "records.yaml"), "utf8")).toBe(RECORDS_YAML);
});

// 設定の extensions が追加するマーカーを知っているマーカーとして点検する（正常シナリオ（拡張のマーカー））
test("test_normal_when_extension_mark", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createInitDir(builtRoot, tempDir);
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${config}\nextensions: [extensions/note-card.js]\n`,
    "extensions/note-card.js": [
      "export default {",
      '  name: "note-card",',
      '  directive: "note-card",',
      "  load: async () => ({ draw() {} }),",
      "};",
      "",
    ].join("\n"),
  });
  // 実行
  const result = await runCli(
    builtRoot,
    ["check", "--text", "<!-- note-card -->\n\n<!-- tabz -->\n"],
    dir,
  );
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout).slice(0, -1);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^-:3: unknown_mark: .*tabz/);
});

// YAML に無いキーは、キーが無いことと修正の方法を示して終わる（異常シナリオ（キーが無い））
test("test_error_when_key_missing", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createInitDir(builtRoot, tempDir);
  await writeFiles(dir, { "records.yaml": RECORDS_YAML });
  // 実行
  const result = await runCli(
    builtRoot,
    ["check", "--file", "records.yaml", "--key", "items[5].body"],
    dir,
  );
  // 検証
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("records.yaml");
  expect(result.stderr).toContain("items[5].body");
  expect(result.stderr).toContain("位置を");
  expect(await readFile(join(dir, "records.yaml"), "utf8")).toBe(RECORDS_YAML);
});

/** map の書き方を誤った文字列: 4 行目に読めない行、8 行目に補足の知らないキー */
const MAP_WARNINGS_MARKDOWN = [
  "<!-- map -->",
  "```mermaid",
  "flowchart LR",
  "  A -> B",
  "```",
  "<!-- map-data: {",
  '  "version": 1,',
  '  "layuot": {}',
  "} -->",
  "<!-- /map -->",
  "",
].join("\n");

// map の範囲の読めない行と補足の知らないキーを、描いたときの書き方の警告と同じ内容のずれにする（正常シナリオ（map の書き方の警告がある））
test("test_normal_when_map_warnings", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await createInitDir(builtRoot, tempDir);
  // 実行
  const result = await runCli(
    builtRoot,
    ["check", "--text", "-"],
    dir,
    MAP_WARNINGS_MARKDOWN,
  );
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  expect(lines.slice(0, -1).map((line) => line.split(": ")[0])).toEqual([
    "-:4",
    "-:8",
  ]);
  expect(lines[0]).toContain("A -> B");
  expect(lines[1]).toContain("layuot");
  expect(lines.at(-1)).toBe("ずれ 2 件");
  // 検証: 同じ文字列を描いたときの書き方の警告と同じ内容
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: MAP_WARNINGS_MARKDOWN });
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1, { timeout: 10_000 });
  const rendered = ((await warning.textContent()) ?? "").replace(/\s+/g, "");
  for (const line of lines.slice(0, -1)) {
    const message = line.replace(/^-:\d+: \w+: /, "");
    expect(rendered).toContain(message.replace(/\s+/g, ""));
  }
});
