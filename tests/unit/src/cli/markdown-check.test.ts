import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";
import { WARNINGS_MARKDOWN } from "../../helpers/diagrams.ts";

/** 指定した Markdown の点検を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMarkdownCheck = () => import("../../../../src/cli/markdown-check.ts");

const createTempDir = useTempDirs();

/** まとめた拡張のコードをモジュールとして読み込む */
const importCode = (code: string): Promise<unknown> =>
  import(/* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code)}`);

/** `items[0].body` が 5 行目の `|` で始まり、値の 3 行目（ファイルの 8 行目）に `<!-- tabz -->` を持つ YAML */
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

/** 設定ファイルを配置したフォルダを作る */
async function createConfigDir(extra: Record<string, string> = {}) {
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "index: docs/index.yaml\n",
    ...extra,
  });
  return dir;
}

// 警告・知らないマーカーを行の順に返却し、廃止した図の範囲を 1 件にする（正常系）
test("test_check_markdown_source", async () => {
  // 準備
  const { checkMarkdownSource } = await loadMarkdownCheck();
  const cwd = await createConfigDir();
  // 実行
  const issues = await checkMarkdownSource({
    cwd,
    text: WARNINGS_MARKDOWN,
    importCode,
  });
  // 検証
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    { file: "-", where: "1", kind: "retired_diagram" },
    { file: "-", where: "20", kind: "unknown_mark" },
    { file: "-", where: "22", kind: "syntax_warning" },
  ]);
});

// YAML のキーの値のずれを YAML のファイルの行で返却する（正常系）
test("test_check_markdown_source_when_yaml_key", async () => {
  // 準備
  const { checkMarkdownSource } = await loadMarkdownCheck();
  const cwd = await createConfigDir({ "records.yaml": RECORDS_YAML });
  // 実行
  const issues = await checkMarkdownSource({
    cwd,
    file: "records.yaml",
    key: "items[0].body",
    importCode,
  });
  // 検証
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([{ file: "records.yaml", where: "8", kind: "unknown_mark" }]);
});

// 設定の拡張のマーカーを知っているマーカーにする（正常系）
test("test_check_markdown_source_when_extension", async () => {
  // 準備
  const { checkMarkdownSource } = await loadMarkdownCheck();
  const cwd = await createTempDir();
  await writeFiles(cwd, {
    "mdmark.config.yaml": "extensions:\n  - extensions/note-card.js\n",
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
  const issues = await checkMarkdownSource({
    cwd,
    text: "<!-- note-card -->\n\n<!-- tabz -->\n",
    importCode,
  });
  // 検証
  expect(issues.map(({ where, kind }) => ({ where, kind }))).toEqual([
    { where: "3", kind: "unknown_mark" },
  ]);
});

// 設定ファイルが無くても既定の設定で点検する（正常系）
test("test_check_markdown_source_when_no_config", async () => {
  // 準備
  const { checkMarkdownSource } = await loadMarkdownCheck();
  const cwd = await createTempDir();
  // 実行
  const issues = await checkMarkdownSource({
    cwd,
    text: "本文\n\n<!-- tabz -->\n",
    importCode,
  });
  // 検証
  expect(issues.map(({ kind }) => kind)).toEqual(["unknown_mark"]);
});

// 取り込み先が無い警告を出さない（正常系）
test("test_check_markdown_source_when_include", async () => {
  // 準備
  const { checkMarkdownSource } = await loadMarkdownCheck();
  const cwd = await createTempDir();
  // 実行
  const issues = await checkMarkdownSource({
    cwd,
    text: '<!-- include: {"path": "missing.md"} -->\n\n本文\n\n<!-- tabz -->\n',
    importCode,
  });
  // 検証
  expect(issues.map(({ kind }) => kind)).toEqual(["unknown_mark"]);
  expect(issues.some(({ message }) => message.includes("missing.md"))).toBe(
    false,
  );
});

// ブロックスカラーの値と行を返却する（正常系）
test("test_read_yaml_key", async () => {
  // 準備
  const { readYamlKey } = await loadMarkdownCheck();
  const dir = await createTempDir();
  await writeFiles(dir, { "records.yaml": RECORDS_YAML });
  // 実行
  const { value, lineOf } = await readYamlKey({
    path: `${dir}/records.yaml`,
    key: "items[0].body",
  });
  // 検証
  expect(value).toBe("# 見出し\n本文\n<!-- tabz -->\n");
  expect(lineOf(3)).toBe(8);
});

// ブロックスカラーでない値はキーの行を返却する（正常系）
test("test_read_yaml_key_when_plain", async () => {
  // 準備
  const { readYamlKey } = await loadMarkdownCheck();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "plain.yaml": 'id: a\ntitle: "<!-- tabz -->"\n',
  });
  // 実行
  const { value, lineOf } = await readYamlKey({
    path: `${dir}/plain.yaml`,
    key: "title",
  });
  // 検証
  expect(value).toBe("<!-- tabz -->");
  expect(lineOf(1)).toBe(2);
  expect(lineOf(5)).toBe(2);
});

// 無いキーと文字列でない値を CliError にする（異常系）
test("test_read_yaml_key_when_missing", async () => {
  // 準備
  const { readYamlKey } = await loadMarkdownCheck();
  const { CliError } = await import("../../../../src/cli/errors.ts");
  const dir = await createTempDir();
  await writeFiles(dir, { "records.yaml": RECORDS_YAML });
  const path = `${dir}/records.yaml`;
  // 実行・検証
  const missing = readYamlKey({ path, key: "items[5].body" });
  await expect(missing).rejects.toBeInstanceOf(CliError);
  await expect(missing).rejects.toThrow(/items\[5\]\.body[\s\S]*2/);
  const notString = readYamlKey({ path, key: "items[0]" });
  await expect(notString).rejects.toBeInstanceOf(CliError);
  await expect(notString).rejects.toThrow(/文字列/);
});

// 描くときに無視するマーカーの知らないキーを unknown_mark_arg にする（正常系）
test("test_check_markdown_source_when_unknown_mark_keys", async () => {
  // 準備
  const { checkMarkdownSource } = await loadMarkdownCheck();
  const cwd = await createConfigDir();
  const text = [
    '<!-- table: {"kind": "data", "features": {"unknown": {}}, "widht": {"説明": {}}} -->',
    "",
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
    '<!-- tabs: {"grop": "os"} -->',
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
  const issues = await checkMarkdownSource({ cwd, text, importCode });
  // 検証
  expect(issues.map(({ where, kind }) => ({ where, kind }))).toEqual([
    { where: "1", kind: "unknown_mark_arg" },
    { where: "1", kind: "unknown_mark_arg" },
    { where: "8", kind: "unknown_mark_arg" },
  ]);
  const messages = issues.map((issue) => issue.message).join("\n");
  expect(messages).toContain("features.unknown");
  expect(messages).toContain("widht");
  expect(messages).toContain("grop");
});

// 今の書き方のマーカーを legacy_mark にし、記載の警告にしない（正常系）
test("test_check_markdown_source_when_legacy_mark", async () => {
  // 準備
  const { checkMarkdownSource } = await loadMarkdownCheck();
  const cwd = await createConfigDir();
  const text = [
    "<!-- table: data +total total=数量:sum -->",
    "",
    "| 名前 | 数量 |",
    "| --- | --- |",
    "| a | 1 |",
    "<!-- /table -->",
    "<!-- details: 補足 open -->",
    "",
    "段落",
    "",
    "<!-- /details -->",
    "",
  ].join("\n");
  // 実行
  const issues = await checkMarkdownSource({ cwd, text, importCode });
  // 検証
  expect(issues.map(({ where, kind }) => ({ where, kind }))).toEqual([
    { where: "1", kind: "legacy_mark" },
    { where: "7", kind: "legacy_mark" },
  ]);
  for (const issue of issues) {
    expect(issue.message).toContain("mdmark upgrade");
  }
});
