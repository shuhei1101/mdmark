import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test } from "vitest";
import type { MdmarkConfig } from "../../../src/index.ts";

type Built = {
  render: (markdown: string, opts?: { config?: MdmarkConfig }) => string;
};

/** ビルドした配布物を Node で読み込み、`render` を返す */
async function loadRender(): Promise<Built["render"]> {
  const url = pathToFileURL(join(inject("builtRoot"), "dist", "index.js")).href;
  const built: Built = await import(url);
  return built.render;
}

/** HTML 文字列の中の、指定した要素の開始タグを全て返す */
function startTags(html: string, tagName: string): string[] {
  return html.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>`, "g")) ?? [];
}

// DOM を使わずに Markdown を HTML 文字列にする（正常系）
test("test_normal", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "# 見出し",
    "",
    "段落",
    "",
    "- 項目",
    "",
    "| 列A | 列B |",
    "| --- | ---: |",
    "| 1 | 2 |",
    "",
    "```ts",
    "const a = 1;",
    "```",
    "",
    "[リンク](https://example.com/page)",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(typeof document).toBe("undefined");
  for (const expected of [
    "<h1>",
    "<p>",
    "<ul>",
    "<table",
    '<code class="language-ts">',
    '<a href="https://example.com/page">',
  ]) {
    expect(html).toContain(expected);
  }
  expect(html).toMatch(/<pre[^>]*><code class="language-ts">/);
  expect(
    startTags(html, "td").map((tag) => /data-label="([^"]*)"/.exec(tag)?.[1]),
  ).toEqual(["列A", "列B"]);
  const alignedTags = [
    ...startTags(html, "th"),
    ...startTags(html, "td"),
  ].filter((tag) => tag.includes("mdmark-align-right"));
  expect(alignedTags).toHaveLength(2);
  expect(html).toMatch(/<th[^>]*mdmark-align-right[^>]*>列B<\/th>/);
  expect(html).not.toContain("style=");
  expect(html).not.toContain('class="mdmark"');
});

// タスクリスト・取り消し線・www の自動リンクを GitHub と同じ要素にする（正常系）
test("test_normal_when_gfm_extensions", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "- [x] 済み",
    "- [ ] 未",
    "",
    "~~消す~~",
    "",
    "www.example.com と example.com",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const items = html.split("<li").slice(1);
  expect(items).toHaveLength(2);
  expect(items[0]).toContain("済み");
  expect(items[0]).toMatch(
    /<input[^>]*type="checkbox"[^>]*disabled[^>]*checked/,
  );
  expect(items[1]).toContain("未");
  expect(items[1]).not.toContain("checked");
  expect(startTags(html, "li")).toEqual([
    '<li class="task-list-item">',
    '<li class="task-list-item">',
  ]);
  expect(html).toContain("<del>消す</del>");
  expect(html).toContain('href="http://www.example.com"');
  expect(startTags(html, "a")).toHaveLength(1);
});

// 印のコメントと、文書に書いたスクリプト・style を出力から落とす（正常系）
test("test_normal_when_marks_and_scripts", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "<!-- features: +a -b -->",
    "",
    "<!-- unknown: 1 -->",
    "",
    "<script>SCRIPT_TEXT</script>",
    "",
    '<a onclick="x" href="#top">押す</a> <a href="javascript:x">js</a>',
    "",
    '<p style="position:fixed">style</p>',
    "",
    '<input type="text" value="x">',
    "",
    "<details><summary>s</summary>b</details>",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  for (const dropped of [
    "<!--",
    "features",
    "unknown",
    "<script",
    "onclick",
    "javascript:",
    "style=",
    "SCRIPT_TEXT",
  ]) {
    expect(html, dropped).not.toContain(dropped);
  }
  expect(html).toMatch(/<input type="checkbox" disabled ?\/?>/);
  expect(html).not.toContain("value=");
  expect(html).toContain("<details>");
  expect(html).toContain("<summary>");
});

// 外部ライブラリの印を、読み込み中の印の場所の要素に置き換える。モジュールは読まない（正常系）
test("test_normal_when_library_mark", async () => {
  // 準備
  const render = await loadRender();
  const markdown = "前の段落\n\n<!-- test-lib: a b -->\n\n後の段落\n";
  const config = {
    libraries: { "test-lib": "https://example.invalid/test-lib.js" },
  };
  // 実行
  const html = render(markdown, { config });
  // 検証
  expect(html).toContain(
    '<div class="mdmark-embed" data-mdmark-slot="test-lib" data-mdmark-args="a b" role="status">図を読み込んでいます</div>',
  );
  expect(html).toContain("<p>前の段落</p>");
  expect(html).toContain("<p>後の段落</p>");
  expect(html).not.toContain("example.invalid");
});
