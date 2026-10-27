import { expect, test } from "vitest";
import { createEnv, featuresOff } from "../../helpers/env.ts";
import { stripSourceLine } from "../../helpers/source-line.ts";

/** 解析の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../src/render/parser.ts");

/** 描画の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRender = () => import("../../../../src/render/index.ts");

/** 記法の機能を全てオフにした解析器で Markdown を HTML にする */
async function parse(markdown: string): Promise<string> {
  const { createParser } = await loadParser();
  const env = createEnv({ defaults: featuresOff() });
  return stripSourceLine(createParser().render(markdown, env));
}

// タスクリストの項目をチェックボックスにする（正常系）
test("test_create_parser_when_task_list", async () => {
  // 準備
  const markdown = "- [x] 済み\n- [ ] 未\n";
  // 実行
  const html = await parse(markdown);
  // 検証
  expect(html.match(/<li class="task-list-item">/g)).toHaveLength(2);
  expect(html).toMatch(/<input type="checkbox" disabled checked\s*\/?>/);
  expect(html).toMatch(/<input type="checkbox" disabled\s*\/?>/);
  expect(html).not.toContain("[x]");
  expect(html).not.toContain("[ ]");
});

// www はリンクにし、スキームも www も無いドメインはリンクにしない（正常系）
test("test_create_parser_when_autolink", async () => {
  // 準備
  const markdown = "www.example.com と example.com と https://example.org\n";
  // 実行
  const html = await parse(markdown);
  // 検証
  expect(html.match(/<a /g)).toHaveLength(2);
  expect(html).toContain('href="http://www.example.com"');
  expect(html).toContain('href="https://example.org"');
});

// 取り消し線を del にする（正常系）
test("test_create_parser_when_strikethrough", async () => {
  // 準備
  const markdown = "~~消す~~\n";
  // 実行
  const html = await parse(markdown);
  // 検証
  expect(html).toContain("<del>消す</del>");
  expect(html).not.toContain("<s>");
});

// 表に読み上げの名前と tabindex、セルに列名を付ける（正常系）
test("test_create_parser_when_table", async () => {
  // 準備
  const markdown = "## 変数\n\n| **列A** | 列B |\n| --- | --- |\n| 1 | 2 |\n";
  // 実行
  const html = await parse(markdown);
  // 検証
  expect(html).toContain('<table tabindex="0" aria-label="表: 変数">');
  expect(html).toMatch(/<td[^>]*data-label="列A"/);
  expect(html).toMatch(/<td[^>]*data-label="列B"/);
});

// 直前に見出しが無ければ読み上げの名前は「表」にする（正常系）
test("test_create_parser_when_table_without_heading", async () => {
  // 準備
  const markdown = "| 列A |\n| --- |\n| 1 |\n";
  // 実行
  const html = await parse(markdown);
  // 検証
  expect(html).toContain('<table tabindex="0" aria-label="表">');
});

// コードブロックの pre に読み上げの名前と tabindex を付ける（正常系）
test("test_create_parser_when_code_block", async () => {
  // 準備
  const markdown = "```ts\nconst a = 1;\n```\n\n```\nplain\n```\n";
  // 実行
  const html = await parse(markdown);
  // 検証
  expect(html).toContain(
    '<pre tabindex="0" aria-label="コード: ts"><code class="language-ts">',
  );
  expect(html).toContain('<pre tabindex="0" aria-label="コード">');
});

// 情報文字列に " があっても、コードブロックの読み上げの名前が途中で切れない（正常系）
test("test_create_parser_when_info_has_quote", async () => {
  // 準備
  const markdown = '```ts"x\nconst a = 1;\n```\n';
  // 実行
  const html = await parse(markdown);
  // 検証
  expect(html).toContain('aria-label="コード: ts&quot;x"');
});

// ブロックと行内の印を行の番号つきで拾う（正常系）
test("test_find_marks", async () => {
  // 準備
  const { findMarks } = await loadParser();
  const markdown = [
    "# 題",
    "",
    "<!-- tabz -->",
    "",
    "段落",
    "続き <!-- note: a --> と <!-- /note -->",
    "",
  ].join("\n");
  // 実行
  const marks = findMarks(markdown);
  // 検証
  expect(marks).toEqual([
    { name: "tabz", line: 3 },
    { name: "note", line: 6 },
    { name: "note", line: 6 },
  ]);
});

// コードブロックとインラインコードの中の印は拾わない（正常系）
test("test_find_marks_when_code", async () => {
  // 準備
  const { findMarks } = await loadParser();
  const markdown = [
    "```markdown",
    "<!-- tabz -->",
    "```",
    "",
    "段落 `<!-- tabz -->`",
    "",
  ].join("\n");
  // 実行
  const marks = findMarks(markdown);
  // 検証
  expect(marks).toEqual([]);
});

// 複数行の HTML のブロックの中の印の行を数える（正常系）
test("test_find_marks_when_multiline_block", async () => {
  // 準備
  const { findMarks } = await loadParser();
  const markdown = ["# 題", "<div>", "<!-- tabz -->", "</div>", ""].join("\n");
  // 実行
  const marks = findMarks(markdown);
  // 検証
  expect(marks).toEqual([{ name: "tabz", line: 3 }]);
});

// 表のセルの中の印の行を行の番号で返す（正常系）
test("test_find_marks_when_table_cell", async () => {
  // 準備
  const { findMarks } = await loadParser();
  const markdown = [
    "| a | b |",
    "| --- | --- |",
    "| 1 <!-- tabz --> | 2 |",
    "",
  ].join("\n");
  // 実行
  const marks = findMarks(markdown);
  // 検証
  expect(marks).toEqual([{ name: "tabz", line: 3 }]);
});

// 前に複数行の行内の HTML がある印の行を数える（正常系）
test("test_find_marks_when_multiline_inline_html", async () => {
  // 準備
  const { findMarks } = await loadParser();
  const markdown = ["p <a", 'href="x">l</a> <!-- c -->', ""].join("\n");
  // 実行
  const marks = findMarks(markdown);
  // 検証
  expect(marks).toEqual([{ name: "c", line: 2 }]);
});

// ブロックごとに始まる行の 0 始まりの番号を付ける（正常系）
test("test_mark_source_lines", async () => {
  // 準備
  const { render } = await loadRender();
  const markdown = [
    "# 見出し",
    "",
    "段落",
    "",
    "- 項目 A",
    "- 項目 B",
    "",
    "> 引用",
    "",
    "---",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(/<h1[^>]*data-source-line="0"/);
  expect(html).toMatch(/<p[^>]*data-source-line="2"/);
  expect(html).toMatch(/<ul[^>]*data-source-line="4"/);
  expect(html).toMatch(/<li[^>]*data-source-line="4"/);
  expect(html).toMatch(/<li[^>]*data-source-line="5"/);
  expect(html).toMatch(/<blockquote[^>]*data-source-line="7"/);
  expect(html).toMatch(/<hr[^>]*data-source-line="9"/);
});

// 表と表の行、コードブロックに付ける（正常系）
test("test_mark_source_lines_when_table_and_code", async () => {
  // 準備
  const { render } = await loadRender();
  const markdown = [
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "| 3 | 4 |",
    "",
    "```ts",
    "const x = 1;",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(/<table[^>]*data-source-line="0"/);
  expect(html).toMatch(/<tr[^>]*data-source-line="2"/);
  expect(html).toMatch(/<tr[^>]*data-source-line="3"/);
  expect(html).toMatch(
    /<div(?=[^>]*class="mdmark-code")[^>]*data-source-line="5"/,
  );
});

// 印の範囲を囲む要素と注意書きに開きの印の行を付け、中のブロックにもそれぞれの行を付ける（正常系）
test("test_mark_source_lines_when_mark_range", async () => {
  // 準備
  const { render } = await loadRender();
  const markdown = [
    "<!-- table: data -->",
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "<!-- /table -->",
    "",
    "> [!NOTE]",
    "> 注意",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(/<[a-z]+[^>]*data-source-line="0"/);
  expect(html).toMatch(/<table[^>]*data-source-line="2"/);
  expect(html).toMatch(/<[a-z]+[^>]*data-source-line="7"/);
});

// 文書に書いた生の HTML のブロックは変えない（正常系）
test("test_mark_source_lines_when_raw_html", async () => {
  // 準備
  const { render } = await loadRender();
  const markdown = '<div class="x">地</div>\n';
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain("地");
  expect(html).not.toContain("data-source-line");
});
