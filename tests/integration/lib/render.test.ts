import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test, vi } from "vitest";
import type {
  MdmarkConfig,
  MdmarkExtension,
  MdmarkIndex,
  MdmarkReferences,
} from "../../../src/index.ts";
import {
  DOC_ID,
  EXPECTED_HTML,
  INDEX,
  MARKDOWN,
  REFERENCES,
} from "./index-render.ts";

type Built = {
  render: (
    markdown: string,
    opts?: {
      config?: MdmarkConfig;
      index?: MdmarkIndex;
      docId?: string;
      references?: MdmarkReferences;
    },
  ) => string;
  registerExtension: (extension: MdmarkExtension) => void;
};

/** ビルドした配布物を Node で読み込む */
async function loadBuilt(): Promise<Built> {
  const url = pathToFileURL(join(inject("builtRoot"), "dist", "index.js")).href;
  return await import(url);
}

/** ビルドした配布物を Node で読み込み、`render` を返す */
async function loadRender(): Promise<Built["render"]> {
  return (await loadBuilt()).render;
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
    '<h1 id="',
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

// 記法の印と書き方を、スクリプト無しで中身を読める HTML にする（正常系）
test("test_normal_when_syntax", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "<!-- toc -->",
    "",
    "<!-- table: data filter=名前 closed -->",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "| c | 3 |",
    "",
    "<!-- /table -->",
    "",
    "<!-- tabs -->",
    "",
    "### macOS",
    "",
    "macOS の手順",
    "",
    "### Windows",
    "",
    "Windows の手順",
    "",
    "<!-- /tabs -->",
    "",
    "> [!WARNING]",
    "> 警告の本文",
    "",
    "> [!NOTE]-",
    "> 補足の本文",
    "",
    "<!-- steps -->",
    "",
    "1. 一つ目",
    "2. 二つ目",
    "3. 三つ目",
    "",
    "<!-- /steps -->",
    "",
    "```tree",
    "src/",
    "└── index.ts",
    "```",
    "",
    "`badge:v1`",
    "",
    "## 補足",
    "",
    "<!-- section: closed -->",
    "",
    "節の本文",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| x | 1 |",
    "| y | 2 |",
    "",
    "<!-- row-detail: 1 -->",
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
    "<!-- fig: arch -->",
    "",
    '![構成](a.png "全体の構成")',
    "",
    "[図](#fig-arch)",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(
    /<nav class="mdmark-toc" aria-label="目次">[\s\S]*<a href="#補足">補足<\/a>[\s\S]*<\/nav>/,
  );
  expect(html).toMatch(
    /<div class="mdmark-table" data-kind="data" data-features="sort pin filter" data-filter="0:select"><details class="mdmark-table-details"><summary>表を開く<\/summary>/,
  );
  expect(html).not.toMatch(/<details class="mdmark-table-details"[^>]*\sopen/);
  expect(html).toContain('<div class="mdmark-tabs">');
  expect(html.match(/<div class="mdmark-tab-panel">/g)).toHaveLength(2);
  expect(html).toContain('<p class="mdmark-tab-title">macOS</p>');
  expect(html).toContain('<p class="mdmark-tab-title">Windows</p>');
  expect(html).not.toMatch(/\shidden[\s>=]/);
  expect(html).not.toContain("<h3");
  expect(html).toContain('<div class="markdown-alert markdown-alert-warning">');
  expect(html).toContain('<p class="markdown-alert-title">警告</p>');
  expect(html).not.toContain("[!WARNING]");
  expect(html).toContain(
    '<details class="markdown-alert markdown-alert-note"><summary class="markdown-alert-title">補足</summary>',
  );
  expect(html).toContain('<ol class="mdmark-steps">');
  expect(html).toContain('<ul class="mdmark-tree"');
  expect(html).toContain(
    '<li class="mdmark-tree-folder"><span class="mdmark-tree-name">src/</span>',
  );
  expect(html).toContain(
    '<li class="mdmark-tree-file"><span class="mdmark-tree-name">index.ts</span>',
  );
  expect(html).toContain('<span class="mdmark-badge">v1</span>');
  expect(html).not.toContain("badge:");
  expect(html).toMatch(
    /<div class="mdmark-section-body" id="section-補足" data-section="closed">[\s\S]*節の本文/,
  );
  expect(html).toMatch(
    /<tr class="mdmark-row-detail" data-row="1"[^>]*><td colspan="2">\s*<p>詳細の段落<\/p>/,
  );
  expect(html.slice(html.lastIndexOf("</table>"))).not.toContain("詳細の段落");
  expect(html).toContain('<figure class="mdmark-figure" id="fig-arch">');
  expect(html).toContain(
    '<figcaption class="mdmark-figure-caption"><b>図 1</b>全体の構成</figcaption>',
  );
  expect(html).toContain('<a href="#fig-arch">図 1</a>');
  for (const absent of ["<!--", "<svg", "<button"]) {
    expect(html, absent).not.toContain(absent);
  }
});

// 見出しに GitHub と同じ規則の ID と、その ID へのリンクを付ける（正常系）
test("test_normal_when_headings", async () => {
  // 準備
  const render = await loadRender();
  const markdown = "# Hello, World!\n\n## 使い方\n\n## 使い方\n";
  // 実行
  const html = render(markdown);
  // 検証
  const ids = [...html.matchAll(/<h[1-6][^>]*\sid="([^"]*)"/g)].map(
    (match) => match[1],
  );
  expect(ids).toEqual(["hello-world", "使い方", "使い方-1"]);
  for (const [id, text] of [
    ["hello-world", "Hello, World!"],
    ["使い方", "使い方"],
    ["使い方-1", "使い方"],
  ]) {
    expect(html).toContain(
      `<a class="mdmark-anchor" href="#${id}" aria-label="「${text}」へのリンク">`,
    );
  }
});

// オフの記法は印を取り除き、書いた Markdown を普通の Markdown として描く（正常系）
test("test_normal_when_syntax_features_disabled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "<!-- features: -table -callout -anchors -->",
    "",
    "<!-- table: data -->",
    "",
    "| 列 |",
    "| --- |",
    "| 値 |",
    "",
    "<!-- /table -->",
    "",
    "> [!WARNING]",
    "> 引用",
    "",
    "## 使い方",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain("<table");
  expect(html).not.toContain("mdmark-table");
  expect(html).toContain("<blockquote>");
  expect(html).not.toContain("markdown-alert");
  expect(html).toMatch(/<h2[^>]*\sid="使い方"/);
  expect(html).not.toContain("mdmark-anchor");
  expect(html).not.toContain("<!--");
});

// 読めない指定の箇所に書き方の警告を置き、読めた指定で本文を描く（正常系）
test("test_normal_when_syntax_errors", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "<!-- table: unknown +sort -->",
    "",
    "| a |",
    "| --- |",
    "| 1 |",
    "",
    "<!-- /table -->",
    "",
    "<!-- tabs -->",
    "",
    "見出しの無い範囲",
    "",
    "<!-- /tabs -->",
    "",
    "[図](#fig-missing)",
    "",
    "<!-- table: data -->",
    "",
    "| b |",
    "| --- |",
    "| 2 |",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(
    html.match(/<div class="mdmark-syntax-warning" role="note">/g),
  ).toHaveLength(4);
  expect(
    html.match(/<p class="mdmark-syntax-warning-title">書き方の警告<\/p>/g),
  ).toHaveLength(4);
  expect(html).toContain('data-kind="default" data-features="pin sort"');
  expect(html).toContain("<code>unknown</code>");
  expect(html).toContain("<code>data</code>・<code>plain</code>");
  expect(html).toContain("<p>見出しの無い範囲</p>");
  expect(html).not.toContain("mdmark-tabs");
  expect(html).toContain('<a href="#fig-missing">図</a>');
  expect(html).toContain("<code>#fig-missing</code>");
  expect(html).toContain('data-kind="data"');
  expect(html).toContain("&lt;!-- /table --&gt;");
});

// 文書に生の HTML で書いた記法の class・data-*・id を落とす（正常系）
test("test_normal_when_raw_html_imitates_syntax", async () => {
  // 準備
  const render = await loadRender();
  const markdown =
    '<div class="mdmark-tabs" data-kind="data"><p id="fig-x" class="markdown-alert">偽り</p></div>\n';
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain("偽り");
  for (const absent of [
    "mdmark-tabs",
    "data-kind",
    "fig-x",
    "markdown-alert",
  ]) {
    expect(html, absent).not.toContain(absent);
  }
});

// 登録した拡張の印を、読み込み中の印の場所の要素に置き換える。拡張のモジュールは読まない（正常系）
test("test_normal_when_extension_mark", async () => {
  // 準備
  const { render, registerExtension } = await loadBuilt();
  const load = vi.fn(async () => ({ draw: () => {} }));
  const validate = vi.fn(() => ({ value: { args: [], keys: {} } }));
  registerExtension({
    name: "greet",
    directive: "greet",
    load,
    schema: { "~standard": { version: 1, vendor: "test", validate } },
  });
  const markdown = "前の段落\n\n<!-- greet: world lang=ja -->\n\n後の段落\n";
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain(
    '<div class="mdmark-embed" data-mdmark-slot="greet" data-mdmark-args="world lang=ja" role="status">図を読み込んでいます</div>',
  );
  expect(load).not.toHaveBeenCalled();
  expect(validate).not.toHaveBeenCalled();
});

// 用語の意味・関連文書・末尾の関連文書の一覧を、スクリプト無しで読める HTML 文字列にする（正常系）
test("test_normal_when_index", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(MARKDOWN, {
    index: INDEX,
    docId: DOC_ID,
    references: REFERENCES,
  });
  // 検証
  expect(typeof document).toBe("undefined");
  expect(html).toBe(EXPECTED_HTML);
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<!--");
});
