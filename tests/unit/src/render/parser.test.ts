import { expect, test } from "vitest";
import type { RenderEnv } from "../../../../src/render/parser.ts";

/** 解析の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../src/render/parser.ts");

/** 解析器で Markdown を HTML にする */
async function parse(markdown: string): Promise<string> {
  const { createParser } = await loadParser();
  const env: RenderEnv = { libraries: {}, featureArgs: [] };
  return createParser().render(markdown, env);
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
