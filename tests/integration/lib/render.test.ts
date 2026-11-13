import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test, vi } from "vitest";
import type {
  MdmarkAlias,
  MdmarkConfig,
  MdmarkExtension,
  MdmarkFlowDefinition,
  MdmarkIndex,
  MdmarkReferences,
} from "../../../src/index.ts";
import {
  INQUIRY_COUNT_TEXT,
  INQUIRY_HINT_TEXT,
  LENGTH_TIME_TEXT,
  REPLY_KIND_TEXT,
  wrapHtml,
} from "../../unit/helpers/charts.ts";
import {
  INQUIRY_SEQ_TEXT,
  INQUIRY_TEXT,
  JUDGEMENT_AUTO_TEXT,
  parsed,
  REPLY_TIME_TEXT,
  SINGLE_KINDS_TEXT,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../unit/helpers/diagrams.ts";
import { erText, shopEr } from "../../unit/helpers/er.ts";
import {
  findTag,
  findTags,
  innerHtml,
  matches,
  outerHtml,
  plainText,
} from "../../unit/helpers/html.ts";
import {
  DATA as MAP_DATA,
  FLOW as MAP_FLOW,
  SEQUENCE as MAP_SEQUENCE,
  mapRange,
} from "../../unit/helpers/map.ts";
import { stripSourceLine } from "../../unit/helpers/source-line.ts";
import {
  ALIAS_EXPECTED_HTML,
  ALIAS_MARKDOWN,
  ALIASES,
  AVOID_DOC_ID,
  AVOID_EXPECTED_HTML,
  AVOID_INDEX,
  AVOID_MARKDOWN,
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
      aliases?: MdmarkAlias[];
      includes?: Record<string, string>;
      icons?: Record<string, Array<[string, Record<string, string>]>>;
    },
  ) => string;
  registerExtension: (extension: MdmarkExtension) => void;
};

/** ビルドした配布物を Node で読み込む */
async function loadBuilt(): Promise<Built> {
  const url = pathToFileURL(join(inject("builtRoot"), "dist", "index.js")).href;
  return await import(url);
}

/** ビルドした配布物を Node で読み込み、`render` をそのまま返却する */
async function loadRawRender(): Promise<Built["render"]> {
  return (await loadBuilt()).render;
}

/** ビルドした配布物を Node で読み込み、元の行番号の属性を取り除いた出力を返却する `render` を返却する。元の行番号以外の出力を比べるテストが使用する */
async function loadRender(): Promise<Built["render"]> {
  const render = await loadRawRender();
  return (markdown, opts) => stripSourceLine(render(markdown, opts));
}

/** HTML 文字列の中の、指定した要素の開始タグを全て返却する */
function startTags(html: string, tagName: string): string[] {
  return html.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>`, "g")) ?? [];
}

// DOM を使用せずに Markdown を HTML 文字列にする（正常系）
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
    // リンク 1 つだけの段落はカードにするため、文の中にリンクを配置する
    "詳しくは [リンク](https://example.com/page) を確認する。",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(typeof document).toBe("undefined");
  for (const expected of [
    "<p>",
    "<ul>",
    "<table",
    '<code class="language-ts"',
    '<a href="https://example.com/page">',
  ]) {
    expect(html).toContain(expected);
  }
  expect(html).toMatch(/<h1[^>]* id="/);
  expect(html).toMatch(/<pre[^>]*><code class="language-ts"[^>]*>/);
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
    "~~削除する~~",
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
  expect(html).toContain("<del>削除する</del>");
  expect(html).toContain('href="http://www.example.com"');
  expect(startTags(html, "a")).toHaveLength(1);
});

// マーカーのコメントと、文書に記載したスクリプト・style を出力から落とす（正常系）
test("test_normal_when_marks_and_scripts", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- features: {"a": true, "b": false} -->',
    "",
    '<!-- unknown: {"size": 1} -->',
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

// 外部ライブラリのマーカーを、読み込み中のマーカーの場所の要素に置き換える。モジュールは読み込まない（正常系）
test("test_normal_when_library_mark", async () => {
  // 準備
  const render = await loadRender();
  const markdown =
    '前の段落\n\n<!-- test-lib: {"label": "a b", "size": 2} -->\n\n後の段落\n';
  const config = {
    libraries: { "test-lib": "https://example.invalid/test-lib.js" },
  };
  // 実行
  const html = render(markdown, { config });
  // 検証
  expect(html).toContain(
    '<div class="mdmark-embed" data-mdmark-slot="test-lib" data-mdmark-args="{&quot;label&quot;:&quot;a b&quot;,&quot;size&quot;:2}" role="status">図を読み込んでいます</div>',
  );
  expect(html).toContain("<p>前の段落</p>");
  expect(html).toContain("<p>後の段落</p>");
  expect(html).not.toContain("example.invalid");
});

// 記法のマーカーと記載方法を、スクリプト無しで中身を読み込める HTML にする（正常系）
test("test_normal_when_syntax", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "<!-- toc -->",
    "",
    '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {}}}, "collapse": {"open": false}} -->',
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "| c | 3 |",
    "",
    "<!-- /table -->",
    "",
    '<!-- tabs: {"group": "os"} -->',
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
    '<!-- section: {"open": false} -->',
    "",
    "セクションの本文",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| x | 1 |",
    "| y | 2 |",
    "",
    '<!-- row-detail: {"at": 1} -->',
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
    '<!-- fig: {"id": "arch"} -->',
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
    /<div class="mdmark-table" data-kind="data" data-features="sort pin filter resize" data-filter="0:select"><details class="mdmark-table-details"><summary>表（3 行）<\/summary>/,
  );
  expect(html).not.toMatch(/<details class="mdmark-table-details"[^>]*\sopen/);
  expect(html).toContain('<div class="mdmark-tabs" data-group="os">');
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
  expect(html).toContain('<div class="mdmark-tree"');
  expect(html).toContain(
    '<ul class="mdmark-tree-list" aria-label="ファイルツリー">',
  );
  expect(html).toContain(
    '<li class="mdmark-tree-folder"><span class="mdmark-tree-row"><span class="mdmark-tree-name">src/</span>',
  );
  expect(html).toContain(
    '<li class="mdmark-tree-file" data-file-icon="file-code"><span class="mdmark-tree-row"><span class="mdmark-tree-name">index.ts</span>',
  );
  expect(html).toContain('<span class="mdmark-badge">v1</span>');
  expect(html).not.toContain("badge:");
  expect(html).toMatch(
    /<div class="mdmark-section-body" id="section-補足" data-section="closed">[\s\S]*セクションの本文/,
  );
  expect(html).toMatch(
    /<tr class="mdmark-row-detail" data-row="1"[^>]*><td colspan="2">\s*<p>詳細の段落<\/p>/,
  );
  expect(html.slice(html.lastIndexOf("</table>"))).not.toContain("詳細の段落");
  expect(html).toContain(
    '<figure class="mdmark-figure mdmark-image" id="fig-arch">',
  );
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
  const markdown = "# Hello, World!\n\n## 使用方法\n\n## 使用方法\n";
  // 実行
  const html = render(markdown);
  // 検証
  const ids = [...html.matchAll(/<h[1-6][^>]*\sid="([^"]*)"/g)].map(
    (match) => match[1],
  );
  expect(ids).toEqual(["hello-world", "使用方法", "使用方法-1"]);
  for (const [id, text] of [
    ["hello-world", "Hello, World!"],
    ["使用方法", "使用方法"],
    ["使用方法-1", "使用方法"],
  ]) {
    expect(html).toContain(
      `<a class="mdmark-anchor" href="#${id}" aria-label="「${text}」へのリンク">`,
    );
  }
});

// オフの記法はマーカーを取り除き、記載した Markdown を普通の Markdown として描く（正常系）
test("test_normal_when_syntax_features_disabled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- features: {"table": false, "callout": false, "anchors": false} -->',
    "",
    '<!-- table: {"kind": "data"} -->',
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
    "## 使用方法",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain("<table");
  expect(html).not.toContain("mdmark-table");
  expect(html).toContain("<blockquote>");
  expect(html).not.toContain("markdown-alert");
  expect(html).toMatch(/<h2[^>]*\sid="使用方法"/);
  expect(html).not.toContain("mdmark-anchor");
  expect(html).not.toContain("<!--");
});

// 読み込めない指定の箇所に記載の警告を配置し、読み込めた指定で本文を描く（正常系）
test("test_normal_when_syntax_errors", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- table: {"kind": "unknown", "features": {"sort": {}}} -->',
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
    '<!-- tabs: {"group": "", "grop": "os", "fold": true} -->',
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
    "[図](#fig-missing)",
    "",
    '<!-- table: {"kind": "data"} -->',
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
  ).toHaveLength(5);
  expect(
    html.match(/<p class="mdmark-syntax-warning-title">記載の警告<\/p>/g),
  ).toHaveLength(5);
  // 知らない種類 unknown は既定の種類で描き、選べる値を警告に出す
  expect(html).toContain('data-kind="default" data-features="sort pin resize"');
  const kindWarning = html.slice(0, html.indexOf("<table"));
  expect(kindWarning).toContain("kind");
  expect(kindWarning).toContain("unknown");
  expect(kindWarning).toContain("data");
  expect(kindWarning).toContain("plain");
  expect(html).toContain("<p>見出しの無い範囲</p>");
  // 見出しの無い範囲はタブにせず、読み込めない指定の範囲だけが組を持たないタブになる
  expect(html.match(/<div class="mdmark-tabs"/g)).toHaveLength(1);
  expect(html).toContain('<div class="mdmark-tabs">');
  expect(html).not.toContain("data-group");
  const tabsWarning = html.slice(
    html.lastIndexOf(
      '<div class="mdmark-syntax-warning"',
      html.indexOf('<div class="mdmark-tabs">'),
    ),
    html.indexOf('<div class="mdmark-tabs">'),
  );
  // マーカーの後ろの本文に、空の文字の group だけを出し、知らないキー grop と fold は無視する
  const tabsMessage = tabsWarning.slice(tabsWarning.indexOf("</code>"));
  expect(tabsMessage).toContain("<code>group</code>");
  expect(tabsMessage).toContain("1 文字以上の文字");
  expect(tabsMessage).not.toContain("grop");
  expect(tabsMessage).not.toContain("fold");
  expect(html).toContain('<a href="#fig-missing">図</a>');
  expect(html).toContain("<code>#fig-missing</code>");
  expect(html).toContain('data-kind="data"');
  expect(html).toContain("&lt;!-- /table --&gt;");
});

// 既定の種類と data の種類の表は data-features に resize を持ち、-resize の表と plain の表は持たない（正常系（列の幅の機能））
test("test_normal_when_table_resize", async () => {
  // 準備
  const render = await loadRender();
  const table = ["| 名前 | 説明 |", "| --- | --- |", "| りんご | 描画 |", ""];
  const marked = (mark: string): string[] => [
    `<!-- table: ${mark} -->`,
    "",
    ...table,
    "<!-- /table -->",
    "",
  ];
  const markdown = [
    ...table,
    ...marked('{"kind": "data"}'),
    ...marked('{"kind": "data", "features": {"resize": {"enabled": false}}}'),
    ...marked('{"kind": "plain"}'),
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const features = [
    ...html.matchAll(
      /<div class="mdmark-table"[^>]*data-features(?:="([^"]*)")?/g,
    ),
  ].map((match) => (match[1] ?? "").split(" ").filter(Boolean));
  expect(features).toHaveLength(4);
  expect(features[0]).toEqual(expect.arrayContaining(["pin", "resize"]));
  expect(features[1]).toEqual(
    expect.arrayContaining(["sort", "pin", "filter", "resize"]),
  );
  expect(features[2]).not.toContain("resize");
  expect(features[3]).toEqual([]);
  expect(html).not.toContain("mdmark-col-resize");
});

// 表のマーカーの 5 つの機能と hide=・total= を data-* にコピーし、行に ID とリンクを付ける（正常系）
test("test_normal_when_table_features", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "## みかん",
    "",
    '<!-- table: {"kind": "data", "features": {"count": {}, "copy": {}, "rowlink": {}}, "columns": {"説明": {"hidden": true}, "数量": {"total": [{"calc": "sum"}]}}} -->',
    "",
    "| 名前 | 説明 | 数量 |",
    "| --- | --- | --- |",
    "| りんご | 描画を速くする | 1 |",
    "| みかん | 印刷を修正する | 2 |",
    "| みかん | 描画の崩れを修正する | 3 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(
    /<div class="mdmark-table" data-kind="data" data-features="sort pin filter resize count columns total copy rowlink"[^>]*data-hide="1"[^>]*data-total="2:sum"/,
  );
  expect(html).toContain('id="みかん"');
  const rowIds = startTags(html, "tr")
    .map((tag) => /\sid="([^"]*)"/.exec(tag)?.[1])
    .filter((id) => id !== undefined);
  expect(rowIds).toEqual(["りんご", "みかん-1", "みかん-2"]);
  const anchors = startTags(html, "a").filter((tag) =>
    tag.includes("mdmark-row-anchor"),
  );
  expect(anchors).toHaveLength(3);
  expect(anchors[1]).toContain('href="#みかん-1"');
  expect(anchors[1]).toContain('aria-label="「みかん」の行へのリンク"');
  expect(html).not.toContain("<tfoot");
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<!--");
});

// 読み込めない集計・隠す列と、機能を付けていない表のキーを記載の警告にして適用しない（正常系）
test("test_normal_when_table_feature_errors", async () => {
  // 準備
  const render = await loadRender();
  const table = [
    "| 名前 | 数量 | 単価 |",
    "| --- | --- | --- |",
    "| a | 1 | 2 |",
    "",
    "<!-- /table -->",
    "",
  ];
  const markdown = [
    "<!-- table: data +total +columns total=数量:max,価格:sum,単価:avg hide=備考,名前 -->",
    "",
    ...table,
    "<!-- table: data total=数量:sum hide=単価 -->",
    "",
    ...table,
    '<!-- table: {"kind": "data", "features": {"total": {}}} -->',
    "",
    ...table,
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const wrappers = html.split('<div class="mdmark-table"').slice(1);
  expect(wrappers).toHaveLength(3);
  const [a, b, c] = wrappers as [string, string, string];
  const wrapperTag = (part: string): string => part.slice(0, part.indexOf(">"));
  // 表 A: 読み込めた計算だけを当て、隠す列は適用しない
  expect(wrapperTag(a)).toContain('data-total="2:avg"');
  expect(wrapperTag(a)).not.toContain("data-hide");
  const warnings = html.split('<div class="mdmark-syntax-warning"');
  expect(warnings).toHaveLength(6);
  // 警告の本文: 先頭の `<code>` はマーカーの文字なので、取り除いた本文だけを確認する
  const bodyOf = (warning: string | undefined): string =>
    (warning ?? "").replace(/<code>.*?<\/code>/, "");
  // 表 A: 読み込めない指定ごとに 1 つずつ、本文に列名と計算がある
  const [maxBody, priceBody, noteBody, firstBody] = [1, 2, 3, 4].map((i) =>
    bodyOf(warnings[i]),
  );
  for (const word of ["max", "sum", "avg", "count"]) {
    expect(maxBody).toContain(word);
  }
  expect(priceBody).toContain("価格");
  expect(noteBody).toContain("備考");
  expect(firstBody).toContain("<code>名前</code>");
  expect(firstBody).toContain("先頭の列");
  // 表 B: 機能の無い表のキーは当てず、機能が要ることを通知する
  expect(wrapperTag(b)).not.toContain("data-total");
  expect(wrapperTag(b)).not.toContain("data-hide");
  const warningB = warnings[5] ?? "";
  expect(warningB).toContain("+total");
  expect(warningB).toContain("+columns");
  // 表 C: total= の無い +total は警告も集計の行も出さない
  expect(wrapperTag(c)).toContain("total");
  expect(wrapperTag(c)).not.toContain("data-total");
  expect(
    html.match(/<div class="mdmark-syntax-warning" role="note">/g),
  ).toHaveLength(5);
});

// pin=・wide=・check= の列の位置を data-* にコピーし、広く取る列のセルに class を付け、真偽値のセルを ✓ と空欄にする（正常系）
test("test_normal_when_table_columns_specified", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"物理名": {"pinned": true}, "説明": {"width": {"mode": "nowrap"}}, "必須": {"format": {"type": "check"}}}} -->',
    "",
    "| No | 物理名 | 説明 | 必須 | 既定 |",
    "| --- | --- | --- | --- | --- |",
    "| 1 | id | 行の ID | true | true |",
    "| 2 | name | 表示する名前 | false | false |",
    "",
    "<!-- /table -->",
    "",
    '<!-- table: {"kind": "data", "columns": {"No": {"pinned": true}, "物理名": {"pinned": true}}} -->',
    "",
    "| No | 物理名 | 説明 | 必須 | 既定 |",
    "| --- | --- | --- | --- | --- |",
    "| 1 | id | 行の ID | true | true |",
    "| 2 | name | 表示する名前 | false | false |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証: 囲みの属性
  const [first = "", second = ""] = html
    .split('<div class="mdmark-table"')
    .slice(1);
  const wrapper = findTag(
    `<div class="mdmark-table"${first}`,
    '<div class="mdmark-table"',
  );
  expect(wrapper).toContain('data-kind="data"');
  expect(wrapper).toContain('data-pin="1"');
  expect(wrapper).toContain('data-check="3"');
  // 検証: 2 つ目の表は 2 つの列の位置を空白で区切る
  expect(
    findTag(`<div class="mdmark-table"${second}`, '<div class="mdmark-table"'),
  ).toContain('data-pin="0 1"');
  // 検証: 説明の列の th と 2 つの td
  const wide = findTags(first, "mdmark-wide");
  expect(wide.filter((tag) => tag.startsWith("<th"))).toHaveLength(1);
  expect(wide.filter((tag) => tag.startsWith("<td"))).toHaveLength(2);
  // 検証: 必須の列の th と 2 つの td
  const centered = findTags(first, "mdmark-align-center");
  expect(centered.filter((tag) => tag.startsWith("<th"))).toHaveLength(1);
  expect(centered.filter((tag) => tag.startsWith("<td"))).toHaveLength(2);
  // 検証: 必須の列の真偽値のセル
  const [yes = "", no = ""] = matches(
    first,
    /<td\b[^>]*mdmark-align-center[^>]*>[\s\S]*?<\/td>/g,
  );
  expect(yes).toContain('data-value="true"');
  expect(yes).toContain(
    '<span class="mdmark-check" role="img" aria-label="はい">',
  );
  expect(plainText(yes)).not.toContain("true");
  expect(no).toContain('data-value="false"');
  expect(innerHtml(no, "<td")).toBe(
    '<span class="mdmark-visually-hidden">いいえ</span>',
  );
  // 検証: 既定の列は文字のまま
  const defaults = matches(
    first,
    /<td\b[^>]*data-label="既定"[^>]*>[^<]*<\/td>/g,
  );
  expect(defaults.map((cell) => plainText(cell))).toEqual(["true", "false"]);
  for (const cell of defaults) {
    expect(cell).not.toContain("data-value");
  }
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 見出しに無い列名の pin=・check= と、pin の機能の無い表の pin= を記載の警告にして適用しない（正常系）
test("test_normal_when_table_column_errors", async () => {
  // 準備
  const render = await loadRender();
  const table = [
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| a | 長い説明 |",
    "",
    "<!-- /table -->",
    "",
  ];
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"無い列": {"pinned": true, "format": {"type": "check"}}, "説明": {"width": {"mode": "nowrap"}}}} -->',
    "",
    ...table,
    '<!-- table: {"kind": "data", "features": {"pin": {"enabled": false}}, "columns": {"名前": {"pinned": true}}} -->',
    "",
    ...table,
    '<!-- table: {"kind": "data", "columns": {"名前": {"pinned": true}, "無い列": {"pinned": true}}} -->',
    "",
    ...table,
    '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {"type": "range"}}, "説明": {"filter": {}}}} -->',
    "",
    ...table,
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const wrappers = html.split('<div class="mdmark-table"').slice(1);
  expect(wrappers).toHaveLength(4);
  const [a, b, c, d] = wrappers as [string, string, string, string];
  const wrapperTag = (part: string): string => part.slice(0, part.indexOf(">"));
  // 表 A: 広く取る列だけを当て、表に無い列名を 1 つの警告に出す
  expect(findTags(a, "mdmark-wide")).toHaveLength(2);
  expect(wrapperTag(a)).not.toContain("data-pin");
  expect(wrapperTag(a)).not.toContain("data-check");
  const warningsA = a
    .slice(0, a.indexOf("<table"))
    .split('<div class="mdmark-syntax-warning"')
    .slice(1);
  expect(warningsA).toHaveLength(1);
  expect(warningsA[0]).toContain("無い列");
  // 表 B: pin を削除した表の列の pinned は当てず、記載の警告も出さない
  expect(wrapperTag(b)).not.toMatch(/data-features="[^"]*pin/);
  expect(wrapperTag(b)).not.toContain("data-pin");
  const warningsB = b
    .slice(0, b.indexOf("<table"))
    .split('<div class="mdmark-syntax-warning"')
    .slice(1);
  expect(warningsB).toHaveLength(0);
  // 表 C: 読めた列名は当て、表に無い列名だけを警告にする
  expect(wrapperTag(c)).toContain('data-pin="0"');
  const warningsC = c
    .slice(0, c.indexOf("<table"))
    .split('<div class="mdmark-syntax-warning"')
    .slice(1);
  expect(warningsC).toHaveLength(1);
  expect(warningsC[0]).toContain("無い列");
  expect(plainText(warningsC[0] ?? "")).not.toContain("columns.名前");
  // 表 D: 選べる値に無い種類の列には絞り込みを付けず、ほかの列の絞り込みは付ける
  expect(wrapperTag(d)).toContain('data-filter="1:select"');
  const filterWarnings = (
    html.match(/<div class="mdmark-syntax-warning"[\s\S]*?<\/div>/g) ?? []
  ).filter((warning) => warning.includes("filter.type"));
  expect(filterWarnings).toHaveLength(1);
  const tables = [...html.matchAll(/<div class="mdmark-table"/g)];
  const warningAt = html.indexOf(filterWarnings[0] ?? "@");
  expect(warningAt).toBeGreaterThan(tables[2]?.index ?? -1);
  expect(warningAt).toBeLessThan(tables[3]?.index ?? -1);
  const textD = plainText(filterWarnings[0] ?? "");
  expect(textD).toContain("columns.名前.filter.type");
  expect(textD).toContain("range は選べる値にありません");
  expect(textD).toContain("選べる値は select・text・date です");
  expect(
    html.match(/<div class="mdmark-syntax-warning" role="note">/g),
  ).toHaveLength(3);
});

// 文書に生の HTML で記載した記法の class・data-*・id を落とす（正常系）
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

// 登録した拡張のマーカーを、読み込み中のマーカーの場所の要素に置き換える。拡張のモジュールは読み込まない（正常系）
test("test_normal_when_extension_mark", async () => {
  // 準備
  const { render, registerExtension } = await loadBuilt();
  const load = vi.fn(async () => ({ draw: () => {} }));
  const validate = vi.fn(() => ({ value: { options: {} } }));
  registerExtension({
    name: "greet",
    directive: "greet",
    load,
    schema: { "~standard": { version: 1, vendor: "test", validate } },
  });
  const markdown =
    '前の段落\n\n<!-- greet: {"target": "world", "lang": "ja"} -->\n\n後の段落\n';
  // 実行
  const html = stripSourceLine(render(markdown));
  // 検証
  expect(html).toContain(
    '<div class="mdmark-embed" data-mdmark-slot="greet" data-mdmark-args="{&quot;target&quot;:&quot;world&quot;,&quot;lang&quot;:&quot;ja&quot;}" role="status">図を読み込んでいます</div>',
  );
  expect(load).not.toHaveBeenCalled();
  expect(validate).not.toHaveBeenCalled();
});

// 用語の意味・関連文書・末尾の関連文書の一覧を、スクリプト無しで読み込める HTML 文字列にする（正常系）
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

// やめた言い方のマーカーと代わりの用語を、スクリプト無しで読み込める HTML 文字列にする（正常系）
test("test_normal_when_avoided_term", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(AVOID_MARKDOWN, {
    index: AVOID_INDEX,
    docId: AVOID_DOC_ID,
  });
  // 検証
  expect(typeof document).toBe("undefined");
  expect(html).toBe(AVOID_EXPECTED_HTML);
  // 用語は破線の下線で「用語」の意味を持ち、やめた言い方は波線のマーカーで「代わりの用語」の単語と意味を持つ
  expect(html).toContain(
    '<span class="mdmark-term" tabindex="0" aria-describedby="mdmark-term-1">ワークスペース</span>',
  );
  expect(html).toContain(
    '<span class="mdmark-term mdmark-term-avoided" tabindex="0" aria-describedby="mdmark-term-2">作業場</span>',
  );
  expect(plainText(html)).toContain(
    "代わりの用語ワークスペース話し合いの記録を配置するフォルダ",
  );
  expect(html).not.toContain("<script");
});

/** `Intl.Segmenter` を取り除いた間だけ、ほかのテストと共有しない新しいモジュールとして配布物の入口を読み込んで `run` に指定する */
async function withoutIntlSegmenter(
  run: (built: Built) => Promise<void>,
): Promise<void> {
  const original = Intl.Segmenter;
  Reflect.deleteProperty(Intl, "Segmenter");
  try {
    const url = pathToFileURL(join(inject("builtRoot"), "dist", "index.js"));
    url.search = "without-intl-segmenter";
    await run(await import(url.href));
  } finally {
    Object.defineProperty(Intl, "Segmenter", {
      value: original,
      configurable: true,
      writable: true,
    });
  }
}

// `Intl.Segmenter` を持たない環境でも配布物を読み込め、英数字の単語の一部に下線を付けずに用語を照合する（正常系）
test("test_normal_when_no_intl_segmenter", async () => {
  await withoutIntlSegmenter(async (built) => {
    // 準備
    const index: MdmarkIndex = {
      schema: 2,
      docs: [],
      terms: [
        {
          id: "ws",
          term: "ワークスペース",
          aliases: ["WS"],
          meaning: "話し合いの記録を配置するフォルダ",
        },
      ],
    };
    // 実行
    const html = built.render("ワークスペースを WSL に配置する\n", { index });
    // 検証
    expect(matches(html, /class="mdmark-term"/g)).toHaveLength(1);
    expect(html).toContain(">ワークスペース</span>");
    expect(html).toContain("を WSL に配置する");
  });
});

/** `figure.mdmark-diagram` の開始タグを、現れた順に返却する */
function diagramFigures(html: string): string[] {
  return startTags(html, "figure").filter((tag) =>
    tag.includes('class="mdmark-diagram"'),
  );
}

// 図の部品の定義から、タイトル・図・凡例を持つ図を描き、定義の JSON と文書のスクリプトを出さない（正常系）
test("test_normal_when_diagram", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "前の段落",
    "",
    wrapDirective("flow", INQUIRY_TEXT),
    wrapDirective("sequence", INQUIRY_SEQ_TEXT),
    wrapDirective("chart", REPLY_TIME_TEXT),
    wrapDirective("param", STRENGTH_TEXT),
    "<script>window.__ran = true</script>",
    "",
  ].join("\n");
  const flow = parsed<MdmarkFlowDefinition>(INQUIRY_TEXT);
  // 実行
  const html = render(markdown);
  // 検証
  const figures = diagramFigures(html);
  expect(figures).toHaveLength(4);
  expect(
    figures.slice(0, 3).map((tag) => /data-diagram="(\w+)"/.exec(tag)?.[1]),
  ).toEqual(["flow", "sequence", "chart"]);
  // 操作できる部品は、グラフの図を持つ
  expect(html).toMatch(
    /<div[^>]*class="mdmark-param"[\s\S]*<figure[^>]*data-diagram="chart"/,
  );
  expect(
    startTags(html, "ul").filter((tag) => tag.includes('aria-label="凡例"')),
  ).toHaveLength(4);
  for (const title of [
    "問い合わせへの自動返信の構成",
    "問い合わせ 1 通の流れ",
    "返信までの時間",
  ]) {
    expect(html, title).toContain(title);
  }
  expect(html).toContain(
    "範囲: メールを受け取ってから返信するまで・更新日: <time",
  );
  // フロー図: 3 つの層が定義の順にあり、枠の外のノードが枠の外の座標にある
  const lanes = startTags(html, "div").filter((tag) =>
    tag.includes('class="mdmark-diagram-lane"'),
  );
  expect(lanes.map((tag) => /data-kind="(\w+)"/.exec(tag)?.[1])).toEqual(
    flow.lanes?.map((lane) => lane.kind),
  );
  const frameLeft = Number(
    /left:(-?[\d.]+)px/.exec(
      startTags(html, "div").find((tag) =>
        tag.includes('class="mdmark-diagram-frame"'),
      ) ?? "",
    )?.[1],
  );
  const mailLeft = Number(
    /left:(-?[\d.]+)px/.exec(
      startTags(html, "div").find((tag) => tag.includes('data-node="mail"')) ??
        "",
    )?.[1],
  );
  expect(mailLeft).toBeLessThan(frameLeft);
  // 交わる横の線は飛び越えの弧を持ち、loop の線は破線で戻り先のラベルを持つ
  expect(html).toMatch(/<path[^>]*data-line="flow"[^>]*d="[^"]* A6,6 /);
  expect(html).toMatch(/<path[^>]*data-line="loop"[^>]*stroke-dasharray="8 4"/);
  expect(html).toContain("次の問い合わせへ（受け取りへ戻る）");
  // tip を持つ線と io を持つノード: role="tooltip" と hidden を持つ中身があり、マーカーは io を持つノードにだけ
  const tips = startTags(html, "div").filter((tag) =>
    tag.includes('role="tooltip"'),
  );
  const withTip = flow.wires.filter((wire) => wire.tip).length;
  const withIo = flow.nodes.filter((node) => node.io).length;
  expect(tips.length).toBeGreaterThanOrEqual(withTip + withIo);
  for (const tag of tips) {
    expect(tag).toContain("hidden");
  }
  expect(
    startTags(html, "button").filter((tag) =>
      tag.includes("mdmark-diagram-info"),
    ),
  ).toHaveLength(withIo);
  // 操作できる部品: スライダーの値が既定の値
  const range =
    startTags(html, "input").find((tag) => tag.includes('type="range"')) ?? "";
  expect(range).toContain('value="5"');
  // 定義の JSON と文書のスクリプトを出さない
  expect(html).not.toContain('"nodes"');
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<!--");
  expect(html).toContain("<p>前の段落</p>");
});

// 読み込めない定義の図の場所だけを記載の警告にし、ほかの図と本文を描く（正常系）
test("test_normal_when_diagram_invalid", async () => {
  // 準備
  const render = await loadRender();
  const broken = INQUIRY_TEXT.slice(0, INQUIRY_TEXT.lastIndexOf("}"));
  const robot = parsed<MdmarkFlowDefinition>(INQUIRY_TEXT);
  Object.assign(robot.nodes[2] ?? {}, { kind: "robot" });
  const markdown = [
    wrapDirective("flow", broken),
    wrapDirective("flow", JSON.stringify(robot)),
    wrapDirective("flow", INQUIRY_TEXT),
    "段落",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const warnings = [
    ...html.matchAll(
      /<div class="mdmark-syntax-warning"[^>]*>([\s\S]*?)<\/div>/g,
    ),
  ].map((match) => match[1] ?? "");
  expect(warnings).toHaveLength(2);
  expect(warnings[0]).toContain(
    "フロー図の部品の定義を JSON として読み込めません",
  );
  expect(warnings[0]).toContain("行目");
  expect(warnings[0]).toContain("}");
  for (const word of [
    "分類",
    "robot",
    "llm・dm・script・mcp・data・external",
  ]) {
    expect(warnings[1], word).toContain(word);
  }
  expect(diagramFigures(html)).toHaveLength(1);
  expect(html).toContain("<p>段落</p>");
});

// 文書のマーカーで図の部品の機能を解除すると、マーカーだけを取り除き、定義を json のコードブロックのまま描く（正常系）
test("test_normal_when_diagram_feature_disabled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = `<!-- features: {"diagrams": false} -->\n\n${wrapDirective("flow", INQUIRY_TEXT)}`;
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain('<code class="language-json"');
  expect(diagramFigures(html)).toHaveLength(0);
  expect(html).not.toContain("<!--");
});

// 図の部品が出した hidden は sanitize を通った後も残り、文書に記載した生の svg・button は残らない（正常系）
test("test_normal_when_diagram_sanitized", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    wrapDirective("flow", INQUIRY_TEXT),
    '<svg width="10"><text>生の文字</text></svg>',
    "<button>生のボタン</button>",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(
    /role="tooltip"[^>]*hidden="hidden"|hidden="hidden"[^>]*role="tooltip"/,
  );
  expect(html).not.toContain("生の文字");
  expect(html).not.toContain("生のボタン");
});

// 拡張のマーカーを範囲で記載したときは、マーカーの場所の要素だけを出し、定義の JSON を出力に残さない。json が 2 つ以上あれば記載の警告にする（正常系）
test("test_normal_when_extension_definition", async () => {
  // 準備
  const { render, registerExtension } = await loadBuilt();
  const load = vi.fn(async () => ({ draw: () => {} }));
  registerExtension({ name: "plan", directive: "plan", load });
  const one = wrapDirective("plan", '{"title": "段取り"}');
  const two = [
    "<!-- plan -->",
    "",
    "```json",
    '{"title": "a"}',
    "```",
    "",
    "```json",
    '{"title": "b"}',
    "```",
    "",
    "<!-- /plan -->",
    "",
  ].join("\n");
  // 実行
  const html = render(`${one}\n${two}`);
  // 検証
  expect(html).toContain('data-mdmark-slot="plan"');
  expect(html).not.toContain("段取り");
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("json のコードブロックが 2 つあります");
  expect(load).not.toHaveBeenCalled();
});

/** 開始タグのうち `needle` を含む最初のものを返却する（無ければ失敗する） */
function tagOf(html: string, needle: string): string {
  const tag = (html.match(/<[a-zA-Z][^>]*>/g) ?? []).find((candidate) =>
    candidate.includes(needle),
  );
  if (tag === undefined) {
    throw new Error(`開始タグが無い: ${needle}`);
  }
  return tag;
}

/** `id` を持つ要素の中の文字（タグを除いたもの） */
function textById(html: string, id: string): string {
  const pattern = new RegExp(
    `<([a-z]+)[^>]*\\sid="${id}"[^>]*>([\\s\\S]*?)</\\1>`,
  );
  return plainText(pattern.exec(html)?.[2] ?? "");
}

/** 埋め込んだ HTML の見本: 許されない宣言・スクリプト・ボタン・ヒント・チャートを持つ */
const EMBEDDED_BODY = [
  '<div style="display: flex; gap: 12px; position: fixed; background-image: url(https://example.com/a.png)">ノード</div>',
  '<button onclick="x" type="submit">押す</button>',
  "<script>window.__ran = true</script>",
  '<div data-hint="返信の種類を選ぶ">自動返信</div>',
  '<p>問い合わせは <span data-hint="本文を読み込んで種類を決める">分類</span> する。</p>',
  `<mdmark-chart>\n${INQUIRY_COUNT_TEXT}\n</mdmark-chart>`,
].join("\n");

// マーカーを付けた html のコードブロックの中身を HTML として描き、スクリプトと許可していない宣言を落とす（正常系）
test("test_normal_when_embedded_html", async () => {
  // 準備
  const render = await loadRender();
  const outside = ["```html", "<p>範囲の外</p>", "```", ""].join("\n");
  const markdown = `${wrapHtml(EMBEDDED_BODY)}\n${outside}`;
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(/<div class="mdmark-html">\s*<div style=/);
  expect(html).not.toMatch(
    /<pre[^>]*><code class="language-html"[^>]*>[\s\S]*ノード/,
  );
  expect(html).toMatch(/<pre[^>]*><code class="language-html"[^>]*>/);
  expect(html).toContain("&lt;p&gt;範囲の外&lt;/p&gt;");
  expect(html).toContain('style="display:flex;gap:12px"');
  expect(html).not.toContain("position");
  expect(html).not.toContain("example.com/a.png");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onclick");
  expect(html).toMatch(/<button[^>]*type="button"[^>]*>押す<\/button>/);
  expect(tagOf(html, "<figure")).toContain('data-diagram="chart"');
  // 凡例の見本の棒を除いた、グラフの svg の中の棒
  const chartSvg = /<svg[^>]*role="img"[\s\S]*?<\/svg>/.exec(html)?.[0] ?? "";
  expect(
    matches(chartSvg, /<rect[^>]*class="mdmark-diagram-bar"/g),
  ).toHaveLength(8);
  expect(html).not.toContain("<mdmark-chart");
  expect(html).not.toContain('"series"');
  // data-hint: ブロックはマーカー、行内は tabindex を持ち、どちらもツールチップを指す
  const block = tagOf(html, "mdmark-hint-block");
  expect(block).toContain("<div");
  const mark = tagOf(html, "mdmark-hint-mark");
  const inline = tagOf(html, "mdmark-hint-inline");
  expect(inline).toContain('tabindex="0"');
  const markTip = /aria-describedby="([^"]*)"/.exec(mark)?.[1] ?? "";
  const inlineTip = /aria-describedby="([^"]*)"/.exec(inline)?.[1] ?? "";
  expect(tagOf(html, `id="${markTip}"`)).toMatch(/role="tooltip"/);
  expect(tagOf(html, `id="${markTip}"`)).toMatch(/\bhidden\b/);
  expect(textById(html, markTip)).toBe("返信の種類を選ぶ");
  expect(textById(html, inlineTip)).toBe("本文を読み込んで種類を決める");
});

// html がオフならコードブロックをコードのまま出し、hints がオフならグラフの項目以外のツールチップの中身とマーカーを出さない（正常系）
test("test_normal_when_html_and_hints_disabled", async () => {
  // 準備
  const render = await loadRender();
  const htmlOff = wrapHtml(EMBEDDED_BODY, '<!-- features: {"html": false} -->');
  const diagramHints = `<!-- features: {"hints": false} -->\n\n${wrapDirective("flow", INQUIRY_HINT_TEXT)}`;
  const hintsOff = `${wrapHtml(EMBEDDED_BODY)}\n${diagramHints}`;
  // 実行
  const offHtml = render(htmlOff);
  const offHints = render(hintsOff);
  // 検証
  expect(offHtml).toMatch(/<pre[^>]*><code class="language-html"[^>]*>/);
  expect(offHtml).not.toContain("mdmark-html");
  expect(offHtml).not.toContain("<!--");
  expect(offHints).toContain("mdmark-html");
  expect(offHints).not.toContain("data-hint");
  expect(offHints).not.toContain("mdmark-hint-");
  // ツールチップはヒントの機能が受け持たないグラフの項目のものだけ
  const tooltips = findTags(offHints, 'role="tooltip"');
  expect(tooltips.length).toBeGreaterThan(0);
  for (const tag of tooltips) {
    expect(tag).toMatch(/data-tip-for="item:\d+"/);
  }
  expect(offHints).toContain("窓口の MCP");
  expect(offHints).not.toContain("mdmark-diagram-info");
});

// 範囲にコードブロックが 1 つでないときと、読み込めないチャートの定義の場所に記載の警告を配置する（正常系）
test("test_normal_when_embedded_html_invalid", async () => {
  // 準備
  const render = await loadRender();
  const none = "<!-- html -->\n\nコードブロックの無い範囲\n\n<!-- /html -->\n";
  const two = [
    "<!-- html -->",
    "",
    "```html",
    "<p>一つ目</p>",
    "```",
    "",
    "```html",
    "<p>二つ目</p>",
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
  const broken = wrapHtml(
    `<p>読み込めない定義の前</p><mdmark-chart>{"title": "a",</mdmark-chart><p>同じ範囲のほかの HTML</p>`,
  );
  const markdown = [none, two, broken, "後ろの段落", ""].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(3);
  const text = plainText(html);
  const sentence =
    "<!-- html --> の範囲に html のコードブロックを 1 つだけ配置してください";
  expect(text.split(sentence)).toHaveLength(3);
  expect(html).toContain("コードブロックの無い範囲");
  expect(html).toMatch(/<pre[^>]*><code class="language-html"[^>]*>/);
  expect(text).toContain("グラフの部品の定義を JSON として読み込めません");
  expect(html).toContain("同じ範囲のほかの HTML");
  expect(html).toContain("<p>後ろの段落</p>");
});

// グラフの定義の type で棒・円・散布図を描き、縦の軸の範囲を省くと刻みをデータから切る（正常系）
test("test_normal_when_chart_types", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    wrapDirective("chart", INQUIRY_COUNT_TEXT),
    wrapDirective("chart", REPLY_KIND_TEXT),
    wrapDirective("chart", LENGTH_TIME_TEXT),
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const [bar = "", pie = "", scatter = ""] = html
    .split('<figure class="mdmark-diagram"')
    .slice(1);
  // 棒: 系列ごとの塗りの模様と、データから切った縦の軸
  const fills = new Set(
    matches(bar, /<rect[^>]*class="mdmark-diagram-bar"[^>]*>/g).map(
      (tag) => /fill="([^"]*)"/.exec(tag)?.[1],
    ),
  );
  expect(fills.size).toBe(2);
  // 塗りの模様は、系列の上限の 6 つ分を定義に配置する
  expect(matches(bar, /<pattern[^>]*patternunits/g)).toHaveLength(6);
  const ticks = matches(
    bar,
    /<text[^>]*class="mdmark-diagram-axis-text"[^>]*text-anchor="end"[^>]*>-?\d+<\/text>/g,
  ).map((text) => Number(plainText(text)));
  expect(ticks).toEqual([0, 50, 100, 150]);
  // 円: 扇形 3 つと、扇形の外の整数の割合、凡例の名前と値
  expect(matches(pie, /class="mdmark-diagram-slice"/g)).toHaveLength(3);
  expect(
    matches(
      pie,
      /<text[^>]*class="mdmark-diagram-value-text"[^>]*>[^<]*<\/text>/g,
    ).map((text) => plainText(text)),
  ).toEqual(["62%", "31%", "7%"]);
  expect(pie).toContain("よくある質問で回答した（186 件）");
  // 散布図: 系列ごとに違う構造の点と、数値の目盛りを持つ横の軸
  const first = /<g data-series="1">([\s\S]*?)<\/g>/.exec(scatter)?.[1] ?? "";
  const second = /<g data-series="2">([\s\S]*?)<\/g>/.exec(scatter)?.[1] ?? "";
  expect(matches(first, /<circle[^>]*mdmark-diagram-point/g)).toHaveLength(6);
  expect(matches(second, /<rect[^>]*mdmark-diagram-point/g)).toHaveLength(6);
  expect(
    matches(
      scatter,
      /<text[^>]*class="mdmark-diagram-axis-text"[^>]*text-anchor="middle"[^>]*>-?\d+<\/text>/g,
    ).length,
  ).toBeGreaterThanOrEqual(2);
});

// ビューのマーカーの範囲を、引数を持つ `mdmark-view` の中に表を残した HTML にする（正常系）
test("test_normal_when_view_marked", async () => {
  // 準備
  const render = await loadRender();
  const table = [
    "| タイトル | 状態 | 担当 |",
    "| --- | --- | --- |",
    "| 配色の変数を洗い出す | 未着手 | 佐藤 |",
    "| 余白の変数を決める | 進行中 | 鈴木 |",
  ].join("\n");
  const markdown = `<!-- view: {"board": {"group": {"column": "状態"}, "values": {"未着手": {"icon": "inbox"}}}, "initial": "table", "columns": {"担当": {"filter": {}}}} -->\n\n${table}\n\n<!-- /view -->\n`;
  // 実行
  const html = render(markdown);
  const withoutViews = render(markdown, {
    config: { features: { views: false } },
  });
  // 検証
  const [view] = startTags(html, "div").filter((tag) =>
    tag.includes("mdmark-view"),
  );
  expect(view).toBeDefined();
  const data = /data-view="([^"]*)"/.exec(view ?? "")?.[1] ?? "";
  expect(JSON.parse(data.replaceAll("&quot;", '"'))).toEqual({
    group: 1,
    mode: "table",
    boardDisabled: "",
    icons: { 未着手: "inbox" },
  });
  const viewBody = html.slice(html.indexOf('class="mdmark-view"'));
  expect(viewBody).toContain("<table");
  expect(startTags(viewBody, "div").join(" ")).toContain(
    'data-filter="2:select"',
  );
  expect(html).not.toContain("mdmark-view-switch");
  expect(html).not.toContain("mdmark-view-board");
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<!--");
  expect(withoutViews).not.toContain("mdmark-view");
  expect(withoutViews).toContain("<table");
});

/** HTML 文字列の中の、コードブロックの `pre` を記載した順に全て返却する */
function codeBlocks(html: string): string[] {
  return html.match(/<pre[\s\S]*?<\/pre>/g) ?? [];
}

/** HTML 文字列の中の、タイトルを持つコードブロックのタイトルの文字（`figcaption` から言語とファイル名のラベルを除いたもの）を記載した順に全て返却する */
function codeTitles(html: string): string[] {
  return [...html.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/g)].map(
    ([, inner = ""]) =>
      inner.replace(
        /<span class="mdmark-code-lang">[\s\S]*?<\/span><\/span>/,
        "",
      ),
  );
}

/** HTML 文字列の中の、記載の警告の枠を記載した順に全て返却する */
function warnings(html: string): string[] {
  return html.match(/<div class="mdmark-syntax-warning"[\s\S]*?<\/div>/g) ?? [];
}

// コードブロックのマーカーと行のマーカーから、タイトル・行番号・行の強調・行の種類を付ける（正常系）
test("test_normal_when_code_block_decorated", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- code: {"title": "app.ts", "lines": {}, "highlight": [1]} -->',
    "",
    "```ts",
    "const a = 1;",
    "let count = 1; // [!code ++]",
    "foo(); // 削除する [!code --]",
    "```",
    "",
    "```python",
    "x = 1  # [!code highlight]",
    "y = 2",
    "```",
    "",
    "```ts",
    "let count = 1; // [\\!code ++]",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const [first = "", second = "", third = ""] = codeBlocks(html);
  expect(html).toContain('<figure class="mdmark-code"');
  expect(matches(html, /<figure/g)).toHaveLength(1);
  expect(html).toMatch(
    /<figcaption class="mdmark-code-title mdmark-code-bar"><span class="mdmark-code-lang"><span class="mdmark-code-lang-name" aria-hidden="true">ts<\/span><\/span>app\.ts<\/figcaption>/,
  );
  expect(first).toContain('aria-label="コード: app.ts"');
  expect(first).toContain(
    'class="mdmark-code-lines mdmark-code-numbered mdmark-code-signs"',
  );
  expect(first).toMatch(/style="--mdmark-code-digits: ?1"/);
  expect(first).toContain('data-line="1" data-kind="highlight"');
  expect(first).toContain('data-line="2" data-kind="add"');
  expect(first).toContain('data-line="3" data-kind="del"');
  expect(first).toMatch(/let count = 1;<\/span>/);
  expect(first).toMatch(/foo\(\); \/\/ 削除する<\/span>/);
  expect(second).toContain('data-kind="highlight"');
  expect(second).not.toContain("[!code highlight]");
  expect(second).not.toContain("#");
  expect(second).not.toContain("mdmark-code-numbered");
  expect(second).not.toContain("mdmark-code-signs");
  expect(html).toContain(
    '<div class="mdmark-code"><div class="mdmark-code-bar">',
  );
  expect(third).not.toContain("mdmark-code-line");
  expect(third).toContain("// [!code ++]");
  expect(html).not.toContain("<!--");
});

// 情報文字列の `言語:ファイル名` を言語とファイル名に分け、全てのコードブロックを帯で囲んで言語とファイル名のラベルを配置する（正常系）
test("test_normal_when_code_block_labeled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "```python:hoge.py",
    "print(1)",
    "```",
    "",
    "```ts",
    "const a = 1;",
    "```",
    "",
    "```",
    "plain",
    "```",
    "",
    "```:a.txt",
    "text",
    "```",
    "",
    "```tree:src",
    "src/",
    "```",
    "",
    '<!-- code: {"title": "app.ts"} -->',
    "",
    "```ts:src/app.ts",
    "const b = 2;",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const [
    python = "",
    ts = "",
    plain = "",
    fileOnly = "",
    tree = "",
    titled = "",
  ] = html.split(/(?=<(?:div|figure) class="mdmark-code")/);
  const label = (language: string, file?: string): string =>
    `<span class="mdmark-code-lang"><span class="mdmark-code-lang-name" aria-hidden="true">${language}</span>${file === undefined ? "" : `<span class="mdmark-code-file">${file}</span>`}</span>`;
  expect(python).toMatch(/^<div class="mdmark-code">/);
  expect(python).toContain(
    `<div class="mdmark-code-bar">${label("python", "hoge.py")}</div>`,
  );
  expect(python).toContain('<code class="language-python"');
  expect(python).toContain('aria-label="コード: hoge.py"');
  expect(ts).toContain(`<div class="mdmark-code-bar">${label("ts")}</div>`);
  expect(ts).not.toContain("mdmark-code-file");
  expect(ts).toContain('aria-label="コード: ts"');
  for (const block of [plain, fileOnly]) {
    expect(block).toMatch(
      /^<div class="mdmark-code"><div class="mdmark-code-bar"><\/div>/,
    );
    expect(block).not.toContain("mdmark-code-lang");
    expect(block).toContain('aria-label="コード"');
  }
  expect(tree).toContain(
    `<div class="mdmark-code-bar">${label("tree", "src")}</div>`,
  );
  expect(tree).toContain('<code class="language-tree"');
  expect(tree).not.toContain("mdmark-tree");
  expect(titled).toMatch(/^<figure class="mdmark-code">/);
  expect(titled).toContain(
    `<figcaption class="mdmark-code-title mdmark-code-bar">${label("ts", "src/app.ts")}app.ts</figcaption>`,
  );
  expect(titled).toContain('aria-label="コード: app.ts"');
  expect(html).not.toContain("mdmark-code-copy");
});

// `badge:` の後ろが空か空白だけの行内のコードを、空のバッジにせずそのままコードで出す（正常系）
test("test_normal_when_badge_empty", async () => {
  // 準備
  const render = await loadRender();
  const markdown = "`badge:` と `badge: ` と `badge:v1`\n";
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain("<code>badge:</code>");
  expect(html).toContain("<code>badge: </code>");
  expect(html).not.toMatch(/<span class="mdmark-badge"><\/span>/);
  expect(matches(html, /<span class="mdmark-badge">/g)).toHaveLength(1);
  expect(html).toContain('<span class="mdmark-badge">v1</span>');
});

// 集計する列に数として読み込めないセルがあるとき、表の前に記載の警告を配置する（正常系）
test("test_normal_when_total_cell_not_number", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}, "単価": {"total": [{"calc": "avg"}]}, "名前": {"total": [{"calc": "count"}]}}} -->',
    "",
    "| 名前 | 数量 | 単価 |",
    "| --- | --- | --- |",
    "| - | 10 | 100 |",
    "| b | 約 3 | 200 |",
    "| c | 5 |  |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const boxes = warnings(html);
  expect(boxes).toHaveLength(1);
  const [box = ""] = boxes;
  const text = plainText(box);
  for (const word of ["数量", "約 3", "合計"]) {
    expect(text).toContain(word);
  }
  expect(html.indexOf(box)).toBeLessThan(html.indexOf('class="mdmark-table"'));
  expect(matches(html, /<div class="mdmark-syntax-warning"/g)).toHaveLength(1);
  expect(html).toContain('data-total="1:sum 2:avg 0:count"');
});

// コードブロックのマーカーと行のマーカーの読み込めない指定を記載の警告にし、読み込めた指定で描く（正常系）
test("test_normal_when_code_block_syntax_invalid", async () => {
  // 準備
  const render = await loadRender();
  const block = (body: string[]): string[] => ["```ts", ...body, "```", ""];
  const markdown = [
    '<!-- code: {"title": "app.ts", "color": "red"} -->',
    "",
    ...block(["const a = 1;", "const b = 2;", "const c = 3;"]),
    '<!-- code: {"highlight": [2, 5]} -->',
    "",
    ...block(["const a = 1;", "const b = 2;", "const c = 3;"]),
    ...block(["foo(); // [!code blink]"]),
    '<!-- code: {"title": "app.ts"} -->',
    "",
    "直後の段落",
    "",
    '<!-- code: {"title": "My App.ts", "lines": true} -->',
    "",
    ...block(["const a = 1;"]),
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const boxes = warnings(html);
  expect(boxes).toHaveLength(4);
  for (const box of boxes) {
    expect(box).toContain('role="note"');
    expect(box).toContain("記載の警告");
  }
  const [lineBox = "", markBox = "", fenceBox = "", spaceBox = ""] =
    boxes.map(plainText);
  // 知らないキー color は無視する
  expect(boxes.map(plainText).join("\n")).not.toContain("color");
  expect(lineBox).toContain("5");
  expect(lineBox).toContain("3 行");
  expect(markBox).toContain("[!code blink]");
  expect(markBox).toContain("[!code ++]");
  expect(fenceBox).toContain("直後にコードブロックがありません");
  expect(spaceBox).toContain("lines");
  expect(spaceBox).toContain("start");
  expect(spaceBox).toContain("オブジェクト");
  expect(codeTitles(html)).toEqual(["app.ts", "My App.ts"]);
  expect(matches(html, /<figure/g)).toHaveLength(2);
  const [, highlighted = "", focused = "", typed = ""] = codeBlocks(html);
  expect(typed).not.toContain("mdmark-code-numbered");
  expect(matches(highlighted, /data-kind=/g)).toHaveLength(1);
  expect(highlighted).toMatch(
    /data-kind="highlight"><span class="mdmark-code-text">const b = 2;/,
  );
  expect(focused).not.toContain("mdmark-code-line");
  expect(focused).toContain("// [!code blink]");
  expect(html).toContain("<p>直後の段落</p>");
});

// コードブロックの飾りの機能を解除すると、マーカーを取り除き、行のマーカーを記載した文字のまま描く（正常系）
test("test_normal_when_code_block_feature_disabled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- features: {"code": false} -->',
    "",
    '<!-- code: {"title": "app.ts", "lines": {}} -->',
    "",
    "```ts",
    "let count = 1; // [!code ++]",
    "foo();",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain('<pre tabindex="0" aria-label="コード: ts">');
  expect(html).not.toContain("mdmark-code");
  expect(html).toContain("// [!code ++]");
  expect(html).not.toContain("<!--");
  expect(html).not.toContain("app.ts");
});

/** 元の行番号の確認に使用する、行の位置が分かる Markdown（1 行目に見出し、3 行目に段落、5〜7 行目に表、8 行目にマーカー、9〜11 行目にコードブロック、13〜14 行目にリスト） */
const SOURCE_LINE_MARKDOWN = [
  "# 見出し",
  "",
  "段落",
  "",
  "| 列A | 列B |",
  "| --- | ---: |",
  "| 1 | 2 |",
  '<!-- code: {"lines": {}} -->',
  "```ts",
  "const a = 1;",
  "```",
  "",
  "- 項目A",
  "- 項目B",
  "",
].join("\n");

// ブロックの要素に、Markdown で始まる行の 0 始まりの番号を出す（正常系）
test("test_normal_when_source_lines", async () => {
  // 準備
  const render = await loadRawRender();
  // 実行
  const html = render(SOURCE_LINE_MARKDOWN);
  // 検証
  const lineOf = (tag: string, index = 0): string | undefined =>
    startTags(html, tag)[index]?.match(/data-source-line="(\d+)"/)?.[1];
  expect(lineOf("h1")).toBe("0");
  expect(lineOf("p")).toBe("2");
  expect(html).toMatch(/<div data-source-line="4" class="mdmark-table"/);
  expect(lineOf("tr", 1)).toBe("6");
  expect(html).toMatch(/<div data-source-line="8" class="mdmark-code"/);
  expect(lineOf("pre")).toBeUndefined();
  expect(lineOf("ul")).toBe("12");
  expect(lineOf("li", 0)).toBe("12");
  expect(lineOf("li", 1)).toBe("13");
  // コードブロックの行は今のとおり `data-line`（1 から）を持ち、`data-source-line` を持たない
  const codeLine = startTags(html, "span").find((tag) =>
    tag.includes("mdmark-code-line"),
  );
  expect(codeLine).toContain('data-line="1"');
  expect(codeLine).not.toContain("data-source-line");
  // 表のセルの `data-label` と `mdmark-align-*` の class は変わらない
  expect(html).toContain('<td data-label="列A">1</td>');
  expect(html).toContain(
    '<td data-label="列B" class="mdmark-align-right">2</td>',
  );
});

// h1 の見出しもセクションにし、次の h1 の前までをセクションの中身で囲む（正常系（H1 のセクション））
test("test_normal_when_h1_sections", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "# 手引き",
    "",
    "手引きの段落",
    "",
    "## 概要",
    "",
    "概要の段落",
    "",
    "# 付録",
    "",
    '<!-- section: {"open": false} -->',
    "",
    "付録の段落",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(/<h1 class="mdmark-heading" id="手引き">/);
  expect(html).toMatch(/<h1 class="mdmark-heading" id="付録">/);
  const outer = html.slice(
    html.indexOf('<div class="mdmark-section-body" id="section-手引き"'),
    html.indexOf('<h1 class="mdmark-heading" id="付録">'),
  );
  expect(outer).toContain(
    '<div class="mdmark-section-body" id="section-手引き" data-section="open">',
  );
  expect(outer).toContain('<h2 class="mdmark-heading" id="概要">');
  expect(outer).toContain('id="section-概要"');
  expect(outer).not.toContain('id="付録"');
  expect(html).toContain(
    '<div class="mdmark-section-body" id="section-付録" data-section="closed"',
  );
  expect(html).not.toContain("section: closed");
});

// 指定したエイリアスの下線と種類ごとのツールチップを、スクリプト無しで読み込める HTML 文字列にする（正常系）
test("test_normal_when_aliases", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(ALIAS_MARKDOWN, { aliases: ALIASES });
  // 検証
  expect(typeof document).toBe("undefined");
  expect(html).toBe(ALIAS_EXPECTED_HTML);
  // 用語は「用語」の下に説明を持つ role="tooltip" のツールチップ、コマンドは「コマンド」の下に code とコピーのボタンを持つ
  expect(html).toMatch(
    /<span class="mdmark-term"[^>]*>ワークスペース<\/span><span class="mdmark-term-tip"[^>]*role="tooltip"[^>]*>[\s\S]*?>用語<[\s\S]*?話し合いの記録を配置するフォルダ/,
  );
  expect(html).toMatch(
    /<span class="mdmark-term"[^>]*>単体テスト<\/span><span class="mdmark-term-tip"[^>]*>[\s\S]*?>コマンド<[\s\S]*?<code>npm run test:unit<\/code><button[^>]*type="button"[^>]*>[\s\S]*?コピー<\/button>/,
  );
  // スクリプトもマーカーの文字も含まない
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<!--");
});

/** 記載の警告の枠の中身を、現れた順に返却する（警告の枠は入れ子の `div` を持たない） */
function warningBodies(html: string): string[] {
  return html
    .split('<div class="mdmark-syntax-warning" role="note">')
    .slice(1)
    .map((part) => part.slice(0, part.indexOf("</div>")));
}

// closed・open の表・タブ・ステップを、title= か中身から作った見出しの details に入れる（正常系）
test("test_normal_when_syntax_folded", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- table: {"kind": "data", "collapse": {"open": false}} -->',
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "| c | 3 |",
    "",
    "<!-- /table -->",
    "",
    '<!-- table: {"kind": "data", "collapse": {"open": true, "title": "リリースの一覧"}} -->',
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "",
    "<!-- /table -->",
    "",
    '<!-- tabs: {"collapse": {"open": false}} -->',
    "",
    "### uv",
    "",
    "uv で入れる",
    "",
    "### pip",
    "",
    "pip で入れる",
    "",
    "<!-- /tabs -->",
    "",
    '<!-- tabs: {"collapse": {"open": true, "title": "入れ方"}} -->',
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
    '<!-- steps: {"collapse": {"open": false}} -->',
    "",
    "1. 一つ目",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
    '<!-- steps: {"collapse": {"open": true, "title": "準備"}} -->',
    "",
    "1. 一つ目",
    "2. 二つ目",
    "3. 三つ目",
    "",
    "<!-- /steps -->",
    "",
  ].join("\n");
  // 実行
  const html = stripSourceLine(render(markdown));
  // 検証
  expect(html).toContain(
    '<details class="mdmark-table-details"><summary>表（3 行）</summary>',
  );
  expect(html).toContain(
    '<details class="mdmark-table-details" open><summary>リリースの一覧</summary>',
  );
  expect(html).toContain(
    '<details class="mdmark-collapsible"><summary>タブ（uv・pip）</summary><div class="mdmark-tabs">',
  );
  expect(html).toContain(
    '<details class="mdmark-collapsible" open><summary>入れ方</summary><div class="mdmark-tabs">',
  );
  expect(html).toContain(
    '<details class="mdmark-collapsible"><summary>手順（2 ステップ）</summary><ol class="mdmark-steps">',
  );
  expect(html).toContain(
    '<details class="mdmark-collapsible" open><summary>準備</summary><ol class="mdmark-steps">',
  );
  expect(html).not.toContain("mdmark-syntax-warning");
});

// ファイルツリーの名前と注釈を分け、アイコンの種類・ほかにもある項目・ASCII の罫線・開く階層・元の罫線のテキストを HTML に持たせる（正常系）
test("test_normal_when_tree_annotated", async () => {
  // 準備
  const render = await loadRender();
  const annotated = [
    "mdmark/",
    "├── src/ #ソース",
    "│   └── index.ts # 入口の `mount`",
    "├── README.md # **必読** `badge:新規`",
    "├── C#/",
    "├── #notes.md",
    "├── photo.PNG",
    "├── Dockerfile",
    "├── font.woff2",
    "└── ...",
  ];
  const ascii = ["src/", "|-- index.ts", "`-- parts/"];
  const markdown = [
    '<!-- tree: {"depth": "all"} -->',
    "",
    "```tree",
    ...annotated,
    "```",
    "",
    "```tree",
    ...ascii,
    "```",
    "",
  ].join("\n");
  // 実行
  const html = stripSourceLine(render(markdown));
  // 検証
  const trees = html.split('<div class="mdmark-tree"').slice(1);
  expect(trees).toHaveLength(2);
  const [firstRaw = "", secondRaw = ""] = trees;
  expect(firstRaw.startsWith(' data-open="all"')).toBe(true);
  expect(secondRaw.startsWith(" data-open")).toBe(false);
  expect(firstRaw).toContain(`data-source="${annotated.join("\n")}"`);
  expect(secondRaw).toContain(`data-source="${ascii.join("\n")}"`);
  // 名前と注釈は、元の罫線のテキストを持つ属性を除いた HTML で確認する
  const first = firstRaw.replace(/ data-source="[^"]*"/, "");
  const second = secondRaw.replace(/ data-source="[^"]*"/, "");
  const note = (name: string): RegExp =>
    new RegExp(
      `<span class="mdmark-tree-name">${name}</span><span class="mdmark-tree-note">`,
    );
  expect(first).toMatch(note("src/"));
  expect(first).toMatch(note("index.ts"));
  expect(first).toMatch(note("README.md"));
  expect(first).not.toContain("#ソース");
  expect(first).toContain("<code>mount</code>");
  expect(first).toContain("<strong>必読</strong>");
  expect(first).toContain('<span class="mdmark-badge">新規</span>');
  expect(first).toContain(
    '<li class="mdmark-tree-folder"><span class="mdmark-tree-row"><span class="mdmark-tree-name">C#/</span></span></li>',
  );
  expect(first).toContain(
    '<li class="mdmark-tree-file" data-file-icon="file-text"><span class="mdmark-tree-row"><span class="mdmark-tree-name">#notes.md</span></span></li>',
  );
  for (const [name, icon] of [
    ["index.ts", "file-code"],
    ["README.md", "file-text"],
    ["photo.PNG", "file-image"],
    ["Dockerfile", "file-terminal"],
    ["font.woff2", "file"],
  ] as const) {
    expect(first).toContain(
      `<li class="mdmark-tree-file" data-file-icon="${icon}"><span class="mdmark-tree-row"><span class="mdmark-tree-name">${name}</span>`,
    );
  }
  expect(first).toContain('<li class="mdmark-tree-more">');
  expect(first).toContain("ほかにもあります");
  expect(second).toContain(
    '<span class="mdmark-tree-name">parts/</span></span></li>',
  );
  expect(second).toMatch(/mdmark-tree-folder[\s\S]*mdmark-tree-name">src\//);
  expect(second).toContain('data-file-icon="file-code"');
  expect(second.split("</ul>")[0]).not.toMatch(
    /mdmark-tree-name">[^<]*(\||`|--)/,
  );
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(html).not.toContain("<button");
});

// 型の合わない collapse・collapse.open と読み込めない depth に記載の警告を配置し、読み込めた指定で描く（正常系）
test("test_normal_when_fold_and_tree_errors", async () => {
  // 準備
  const render = await loadRender();
  const steps = (mark: string): string[] => [
    mark,
    "",
    "1. 一つ目",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
  ];
  const markdown = [
    '<!-- tabs: {"collapse": "closed"} -->',
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
    ...steps('<!-- steps: {"collapse": {"open": "no"}} -->'),
    ...steps('<!-- steps: {"fold": true} -->'),
    ...steps('<!-- steps: {"collapse": {"title": "準備"}} -->'),
    '<!-- tree: {"depth": "deep"} -->',
    "",
    "```tree",
    "src/",
    "└── index.ts",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = stripSourceLine(render(markdown));
  // 検証
  const warnings = warningBodies(html);
  expect(warnings).toHaveLength(3);
  const [tabs = "", collapseOpen = "", depth = ""] = warnings;
  expect(tabs).toContain("collapse");
  expect(tabs).toContain("open");
  expect(tabs).toContain("title");
  expect(html).not.toContain("<summary>タブ（macOS・Windows）</summary>");
  expect(collapseOpen).toContain("collapse.open");
  expect(collapseOpen).toContain("<code>true</code> か <code>false</code>");
  // 知らないキー fold は無視する
  expect(warnings.join("\n")).not.toContain("fold");
  expect(
    matches(
      html,
      /<details class="mdmark-collapsible"><summary>手順（2 ステップ）<\/summary><ol class="mdmark-steps">/g,
    ),
  ).toHaveLength(1);
  expect(html).toContain(
    '<details class="mdmark-collapsible"><summary>準備</summary><ol class="mdmark-steps">',
  );
  expect(matches(html, /<details class="mdmark-collapsible"/g)).toHaveLength(2);
  expect(html).not.toContain('<details class="mdmark-collapsible" open');
  expect(matches(html, /<ol class="mdmark-steps">/g)).toHaveLength(3);
  expect(depth).toContain("depth");
  expect(depth).toContain("deep");
  expect(depth).toContain('"all"');
  expect(depth).toContain("1 以上の整数");
  expect(html).toContain('<div class="mdmark-tree"');
  expect(html).not.toContain("data-open");
});

/** 色の名前の一覧（記載の警告の本文に出す） */
const COLOR_NAMES = [
  "blue",
  "red",
  "green",
  "yellow",
  "orange",
  "purple",
  "gray",
];

// 表の列の強調と行の色・バッジの色・本文の文字の色を、色の名前の data-color を持つ要素にする（正常系）
test("test_normal_when_named_colors", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"金額": {"highlight": {}}}, "rows": {"colors": [{"column": "状態", "value": "完了", "color": "green"}, {"column": "状態", "value": "保留", "color": "yellow"}, {"at": 3, "color": "red"}]}} -->',
    "",
    "| 名前 | 状態 | 金額 |",
    "| --- | --- | --- |",
    "| 見積もり | 完了 | 120 |",
    "| 契約 | 保留 | 80 |",
    "| 請求 | 未着手 | 45 |",
    "",
    "<!-- /table -->",
    "",
    "`badge:red:要確認` と `badge:v1:beta` と [決め手の 1 文]{color=blue}",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(findTags(html, "mdmark-col-highlight")).toHaveLength(4);
  for (const tag of findTags(html, "mdmark-col-highlight")) {
    expect(tag).toContain('data-color="blue"');
  }
  expect(startTags(html, "th")[2]).toContain("mdmark-col-highlight");
  expect(
    startTags(html, "tr")
      .slice(1)
      .map((tag) => /data-color="([a-z]+)"/.exec(tag)?.[1] ?? null),
  ).toEqual(["green", "yellow", "red"]);
  expect(html).toContain(
    '<span class="mdmark-badge" data-color="red">要確認</span>',
  );
  expect(html).toContain('<span class="mdmark-badge">v1:beta</span>');
  expect(html).toContain(
    '<span class="mdmark-color" data-color="blue">決め手の 1 文</span>',
  );
  expect(html).not.toContain("{color=blue}");
  expect(html).not.toContain("[決め手");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 色の名前の一覧に無い名前を記載の警告にし、色を付けない（正常系）
test("test_normal_when_color_unknown", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- table: {"kind": "data", "rows": {"colors": [{"column": "状態", "value": "完了", "color": "pink"}]}} -->',
    "",
    "| 名前 | 状態 |",
    "| --- | --- |",
    "| 見積もり | 完了 |",
    "",
    "<!-- /table -->",
    "",
    "[決め手の 1 文]{color=pink}",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const boxes = warnings(html);
  expect(boxes).toHaveLength(2);
  const [tableBox = "", paragraphBox = ""] = boxes;
  // 表の警告は表の前、段落の警告は段落の前
  expect(html.indexOf(tableBox)).toBeLessThan(
    html.indexOf('class="mdmark-table"'),
  );
  const paragraph = html.indexOf("<p>決め手の 1 文</p>");
  expect(paragraph).toBeGreaterThan(-1);
  expect(html.lastIndexOf(paragraphBox, paragraph)).toBeGreaterThan(
    html.indexOf("</table>"),
  );
  for (const box of boxes) {
    expect(box).toContain("pink");
    for (const name of COLOR_NAMES) {
      expect(box).toContain(name);
    }
  }
  for (const tag of startTags(html, "tr")) {
    expect(tag).not.toContain("data-color");
  }
  expect(html).not.toContain("mdmark-color");
  expect(html).not.toContain("{color=pink}");
  expect(html).not.toContain("[決め手");
});

// 画像だけの段落の画像を図にし、後ろの属性・title・テーマごとのフラグメントを適用する（正常系）
test("test_normal_when_image_attributes", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '![グラフ](chart.png "売上の推移"){width=300 align=center}',
    "",
    "![写真](photo.png){width=40% align=left nolightbox}",
    "",
    "![構成](arch-dark.png#only-dark)",
    "",
    "押す前に ![アイコン](icon.png){width=16} を確認する。",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const figures = startTags(html, "figure");
  expect(figures).toHaveLength(3);
  expect(figures[0]).toBe(
    '<figure class="mdmark-figure mdmark-image" data-align="center" style="--mdmark-image-width: 300px">',
  );
  expect(innerHtml(html, 'data-align="center"')).toContain(
    '<figcaption class="mdmark-figure-caption">売上の推移</figcaption>',
  );
  expect(figures[1]).toContain('data-align="left"');
  expect(figures[1]).toContain("--mdmark-image-width: 40%");
  expect(innerHtml(html, 'data-align="left"')).not.toContain("figcaption");
  expect(findTag(html, 'src="photo.png"')).toContain("data-nolightbox");
  expect(figures[2]).toContain("mdmark-only-dark");
  expect(findTag(html, 'alt="構成"')).toContain(
    'src="arch-dark.png#only-dark"',
  );
  // 文の中の画像は図にせず、幅を img に配置する
  const icon = findTag(html, 'src="icon.png"');
  expect(icon).toContain('style="--mdmark-image-width: 16px"');
  expect(html).toMatch(/<p>押す前に <img [^>]*src="icon.png"/);
  expect(html).not.toContain("{width=");
  expect(html).not.toContain("nolightbox}");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 読み込めない属性を記載の警告にし、読み込めた属性だけを適用する（正常系）
test("test_normal_when_image_attribute_invalid", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "![グラフ](chart.png){width=big align=center foo}",
    "",
    "押す前に ![アイコン](icon.png){align=left} を確認する。",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const boxes = warnings(html);
  expect(boxes).toHaveLength(2);
  const [figureBox = "", paragraphBox = ""] = boxes;
  expect(html.indexOf(figureBox)).toBeLessThan(html.indexOf("<figure"));
  expect(figureBox).toContain("width=big");
  expect(figureBox).toContain("foo");
  for (const name of ["width", "align", "nolightbox"]) {
    expect(figureBox).toContain(`<code>${name}</code>`);
  }
  const figure = findTag(html, "<figure");
  expect(figure).toContain('data-align="center"');
  expect(figure).not.toContain("style=");
  expect(html.indexOf(paragraphBox)).toBeGreaterThan(html.indexOf("</figure>"));
  expect(html.indexOf(paragraphBox)).toBeLessThan(html.indexOf("<p>押す前に"));
  expect(paragraphBox).toContain("align");
  expect(paragraphBox).toContain("画像だけの段落");
  expect(html).not.toContain("{width=big");
  expect(html).not.toContain("{align=left}");
});

// ギャラリーのマーカーの範囲の画像を格子に並べ、fig のマーカーの番号にサブ図の番号を付ける（正常系）
test("test_normal_when_gallery", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- fig: {"id": "shots"} -->',
    '<!-- gallery: {"columns": 3} -->',
    '![開いた画面](open.png "開く")',
    '![記載した画面](write.png "記載する")',
    "<!-- /gallery -->",
    "",
    "<!-- gallery -->",
    "![一覧](list.png)",
    "![設定](settings.png)",
    "<!-- /gallery -->",
    "",
    "[図](#fig-shots) を確認する。",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const outer = innerHtml(html, 'id="fig-shots"');
  expect(findTag(html, 'id="fig-shots"')).toBe(
    '<figure class="mdmark-figure" id="fig-shots">',
  );
  expect(outer).toContain(
    '<div class="mdmark-gallery" style="--mdmark-gallery-cols: 3"><div class="mdmark-gallery-grid">',
  );
  expect(outer).toMatch(
    /<\/div><\/div><figcaption class="mdmark-figure-caption"><b>図 1<\/b><\/figcaption>$/,
  );
  expect(innerHtml(html, 'id="fig-shots-a"')).toContain(
    '<figcaption class="mdmark-figure-caption"><b>図 1a</b>開く</figcaption>',
  );
  expect(innerHtml(html, 'id="fig-shots-b"')).toContain(
    '<figcaption class="mdmark-figure-caption"><b>図 1b</b>記載する</figcaption>',
  );
  const galleries = findTags(html, 'class="mdmark-gallery"');
  expect(galleries).toHaveLength(2);
  expect(galleries[1]).toContain("--mdmark-gallery-cols: 2");
  const second = html.slice(html.lastIndexOf('<div class="mdmark-gallery"'));
  expect(second).not.toContain("<b>図");
  expect(second).not.toContain('id="fig-');
  expect(html).toContain('<a href="#fig-shots">図 1</a>');
});

// 拡張子で動画・音声・GIF を分け、動画と音声を再生バー付きの要素にする（正常系）
test("test_normal_when_video_audio_gif", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '![操作の様子](demo.mp4 "保存までの操作"){autoplay loop poster=demo.png width=480}',
    "",
    "![スクリーンリーダー](voice.mp3)",
    "",
    "![ビルド](build.gif)",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(findTag(html, "mdmark-media")).toBe(
    '<figure class="mdmark-figure mdmark-media" style="--mdmark-image-width: 480px">',
  );
  const video = findTag(html, "<video");
  for (const part of [
    'src="demo.mp4"',
    " controls",
    " autoplay",
    " muted",
    " loop",
    " playsinline",
    'preload="metadata"',
    'poster="demo.png"',
    'aria-label="操作の様子"',
  ]) {
    expect(video).toContain(part);
  }
  expect(html).toMatch(
    /<img class="mdmark-media-print" src="demo.png" alt="" ?\/?>/,
  );
  expect(innerHtml(html, "mdmark-media")).toContain(
    '<figcaption class="mdmark-figure-caption">保存までの操作</figcaption>',
  );
  const audio = findTag(html, "<audio");
  for (const part of [
    'src="voice.mp3"',
    " controls",
    'preload="metadata"',
    'aria-label="スクリーンリーダー"',
  ]) {
    expect(audio).toContain(part);
  }
  const audioFigure = html.slice(
    html.indexOf("<audio"),
    html.indexOf("</figure>", html.indexOf("<audio")),
  );
  expect(audioFigure).not.toContain("figcaption");
  expect(html.lastIndexOf("<figure", html.indexOf("<audio"))).toBe(
    html.indexOf('<figure class="mdmark-figure mdmark-media">'),
  );
  const gif = findTag(html, 'src="build.gif"');
  expect(gif).toContain("data-gif");
  expect(html.lastIndexOf("<figure", html.indexOf('src="build.gif"'))).toBe(
    html.indexOf('<figure class="mdmark-figure mdmark-image">'),
  );
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<canvas");
});

// リンク 1 つだけの段落を、拡張子でリンクのカードと添付のカードにする（正常系）
test("test_normal_when_cards", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "https://example.com/docs/guide",
    "",
    "[設計の資料](https://example.com/design)",
    "",
    "[仕様書](files/spec.pdf)",
    "",
    "詳しくは https://example.com/docs を確認する。",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const cards = html.match(/<a class="mdmark-card"[\s\S]*?<\/a>/g) ?? [];
  expect(cards).toHaveLength(3);
  const [link = "", titled = "", file = ""] = cards;
  expect(link).toMatch(
    /^<a class="mdmark-card" data-card="link" href="https:\/\/example.com\/docs\/guide">/,
  );
  expect(link).toContain(
    '<span class="mdmark-card-title">example.com/docs/guide</span>',
  );
  expect(link).toContain('<span class="mdmark-card-domain">example.com</span>');
  expect(link).toContain(
    '<span class="mdmark-card-url">https://example.com/docs/guide</span>',
  );
  expect(titled).toContain('<span class="mdmark-card-title">設計の資料</span>');
  expect(file).toMatch(
    /^<a class="mdmark-card" data-card="file" data-file-kind="pdf" href="files\/spec.pdf">/,
  );
  expect(file).toContain('<span class="mdmark-card-title">仕様書</span>');
  expect(file).toContain('<span class="mdmark-card-domain">PDF</span>');
  expect(file).toContain('<span class="mdmark-card-url">spec.pdf</span>');
  expect(html).toContain(
    '<p>詳しくは <a href="https://example.com/docs">https://example.com/docs</a> を確認する。</p>',
  );
  expect(html).not.toContain("iframe");
});

// 文書のマーカーで削除した新しい記法を、普通の Markdown として描く（正常系）
test("test_normal_when_media_features_disabled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- features: {"text-color": false, "images": false, "cards": false} -->',
    "",
    "[決め手の 1 文]{color=blue}",
    "",
    "![グラフ](chart.png){width=300}",
    "",
    "https://example.com/docs",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).not.toContain("mdmark-color");
  expect(html).toContain("<p>[決め手の 1 文]{color=blue}</p>");
  expect(html).not.toContain("<figure");
  expect(html).toMatch(/<p><img [^>]*src="chart.png"[^>]*>\{width=300\}<\/p>/);
  expect(html).not.toContain("mdmark-card");
  expect(html).toContain(
    '<a href="https://example.com/docs">https://example.com/docs</a>',
  );
});

/** グラフの部品の定義の共通の項目（範囲と更新日） */
const CHART_META = { scope: "10 月", updated: "2026-10-31" };

/** グラフの部品の定義を `<!-- chart -->` の範囲の json のコードブロックにする */
function chartBlock(definition: Record<string, unknown>): string {
  return wrapDirective(
    "chart",
    JSON.stringify({ ...CHART_META, ...definition }, null, 2),
  );
}

/** 横の軸の目盛り 3 つと、2 つの系列を持つグラフの部品の定義 */
function twoSeriesChart(type: string): Record<string, unknown> {
  return {
    type,
    title: `${type} のグラフ`,
    x: { label: "週", ticks: ["1", "2", "3"] },
    y: { label: "件" },
    series: [
      { name: "メール", points: [3, 5, 2] },
      { name: "フォーム", points: [4, 1, 6] },
    ],
  };
}

/** 系列の数を指定した折れ線のグラフの部品の定義 */
function lineChart(count: number): Record<string, unknown> {
  return {
    type: "line",
    title: `${count} つの系列`,
    x: { label: "週", ticks: ["1", "2", "3"] },
    y: { label: "件" },
    series: Array.from({ length: count }, (_, index) => ({
      name: `窓口${index + 1}`,
      points: [index, index + 1, index + 2],
    })),
  };
}

/** 項目 2 つのドーナツのグラフの部品の定義 */
const DONUT_CHART = {
  type: "donut",
  title: "返信の種類",
  items: [
    { name: "自動", value: 3 },
    { name: "担当者", value: 5 },
  ],
};

/** 棒と折れ線を組み合わせ、`y2` を持たないグラフの部品の定義 */
const COMBO_CHART = {
  type: "combo",
  title: "件数と解決数",
  x: { label: "週", ticks: ["1", "2", "3"] },
  y: { label: "件" },
  series: [
    { name: "件数", as: "bar", points: [3, 5, 2] },
    { name: "解決数", as: "line", points: [4, 1, 6] },
  ],
};

/** 描いた HTML の図を、`figure.mdmark-diagram` ごとに記載した順に返却する */
function chartFigures(html: string): string[] {
  return html.split('<figure class="mdmark-diagram"').slice(1);
}

/** 棒の `rect` の属性の値を数にして返却する */
function rectBox(tag: string): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const value = (name: string): number =>
    Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]);
  return {
    x: value("x"),
    y: value("y"),
    width: value("width"),
    height: value("height"),
  };
}

/** 図の中の、凡例の見本を除いた棒の `rect` を記載した順に返却する */
function chartBars(figure: string): string[] {
  const svg = /<svg[^>]*role="img"[\s\S]*?<\/svg>/.exec(figure)?.[0] ?? "";
  return matches(svg, /<rect[^>]*class="mdmark-diagram-bar"[^>]*>/g);
}

// 表のマーカーの `header-rows=`・`row-header=` と `^^`・`<<` で、多段の見出し・行見出し・結合したセルを出す（正常系）
test("test_normal_when_table_cells_merged", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- table: {"kind": "data", "header": {"rows": 2, "columns": 1}} -->',
    "",
    "| 区分 | 値 | << | 備考 |",
    "| --- | --- | --- | --- |",
    "| 分類 | 件数 | 時間 | メモ |",
    "| A | 1 | 2 | x |",
    "| ^^ | 3 | 4 | y |",
    "| ^^ | 5 | 6 | z |",
    "",
    "<!-- /table -->",
    "",
    "| 列A | 列B |",
    "| --- | --- |",
    "| ^^ | << |",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const [merged = "", plain = ""] = html
    .split('<div class="mdmark-table"')
    .slice(1);
  const head = innerHtml(merged, "<thead");
  const headRows = matches(head, /<tr>[\s\S]*?<\/tr>/g);
  expect(headRows).toHaveLength(2);
  expect(startTags(headRows[0] ?? "", "th")[1]).toContain('colspan="2"');
  expect(headRows[0]).not.toContain("&lt;&lt;");
  const bodyRows = matches(innerHtml(merged, "<tbody"), /<tr>[\s\S]*?<\/tr>/g);
  for (const row of bodyRows) {
    expect(startTags(row, "th")[0]).toContain('scope="row"');
  }
  const firsts = bodyRows.map((row) => startTags(row, "th")[0] ?? "");
  expect(firsts[0]).toContain('rowspan="3"');
  for (const [index, row] of bodyRows.slice(1).entries()) {
    expect(firsts[index + 1]).toContain('data-merge="up"');
    expect(firsts[index + 1]).toContain("hidden");
    expect(row).toMatch(/<th[^>]*>A<\/th>/);
  }
  expect(merged.slice(0, merged.indexOf(">"))).toContain(
    'data-merge-columns="0"',
  );
  expect(plain).toContain('<td data-label="列A">^^</td>');
  expect(plain).toContain("&lt;&lt;");
  expect(plain).not.toMatch(/rowspan|colspan|data-merge/);
  expect(html).not.toContain('<div class="mdmark-syntax-warning"');
});

// 読み込めない `header-rows=` と、結合する相手の無い `^^`・`<<` を記載の警告にし、文字のまま出す（正常系）
test("test_normal_when_table_merge_invalid", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- table: {"kind": "data", "header": {"rows": 5}} -->',
    "",
    "| << | 列B |",
    "| --- | --- |",
    "| x | ^^ |",
    "| y | z |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const [box = ""] = warnings(html).map(plainText);
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf("<table"),
  );
  expect(box).toContain("header.rows");
  expect(box).toContain("5");
  expect(box).toContain("3");
  expect(box).toContain("<<");
  expect(box).toContain("左に結合するセルがありません");
  expect(box).toContain("^^");
  expect(box).toContain("見出しの行と本文の行をまたいで結合できません");
  expect(matches(innerHtml(html, "<thead"), /<tr>/g)).toHaveLength(1);
  expect(html).toContain("<th>&lt;&lt;</th>");
  expect(html).toContain('<td data-label="列B">^^</td>');
  expect(html).not.toMatch(/rowspan|colspan/);
  expect(html).toContain('data-features="sort pin filter resize"');
});

// 注意書きのタイトル・`+` の開いた折り畳み・入れ子を出す（正常系）
test("test_normal_when_callout_titled_and_nested", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "> [!TIP] 設定を先に確認する",
    "> タイトルを付けた本文",
    "",
    "> [!NOTE]+ 詳細",
    "> 開いて描く本文",
    "",
    "> [!WARNING]",
    "> 外側の本文",
    ">",
    "> > [!TIP]",
    "> > 内側の本文",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain(
    '<div class="markdown-alert markdown-alert-tip"><p class="markdown-alert-title"><span class="mdmark-visually-hidden">ヒント: </span>設定を先に確認する</p><p>タイトルを付けた本文</p>',
  );
  expect(html).toMatch(
    /<details class="markdown-alert markdown-alert-note" open><summary[^>]*>[\s\S]*?詳細<\/summary><p>開いて描く本文<\/p>/,
  );
  const warning = html.slice(html.indexOf("markdown-alert-warning"));
  expect(warning).toMatch(
    /<p>外側の本文<\/p>\s*<div class="markdown-alert markdown-alert-tip">[\s\S]*?<p>内側の本文<\/p>/,
  );
  for (const mark of ["[!TIP]", "[!NOTE]", "[!WARNING]"]) {
    expect(html).not.toContain(mark);
  }
});

/** 外側のタブの `macOS` の中に内側のタブを配置した Markdown。`closeInner` が偽なら内側の閉じのマーカーを記載しない */
function nestedTabs(closeInner: boolean): string {
  return [
    "<!-- tabs -->",
    "",
    "### macOS",
    "",
    "<!-- tabs -->",
    "",
    "#### zsh",
    "",
    "zsh の本文",
    "",
    "#### bash",
    "",
    "bash の本文",
    "",
    ...(closeInner ? ["<!-- /tabs -->", ""] : []),
    "### **Windows**",
    "",
    "Windows の本文",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
}

// タブの中にタブを入れ子にし、強調したタブ名を強調のまま出す（正常系）
test("test_normal_when_tabs_nested", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(nestedTabs(true));
  // 検証
  expect(html).toMatch(
    /^<div class="mdmark-tabs"><div class="mdmark-tab-panel"><p class="mdmark-tab-title">macOS<\/p><div class="mdmark-tabs">/,
  );
  const inner = html.slice(html.indexOf('<div class="mdmark-tabs">', 1));
  expect(inner).toContain('<p class="mdmark-tab-title">zsh</p>');
  expect(inner).toContain('<p class="mdmark-tab-title">bash</p>');
  // 内側のタブを除いた外側の直下のパネルは macOS と Windows の 2 つ
  const outer = html.replace(
    /<div class="mdmark-tabs"><div class="mdmark-tab-panel"><p class="mdmark-tab-title">zsh[\s\S]*?bash の本文<\/p>\s*<\/div><\/div>/,
    "",
  );
  expect(matches(outer, /class="mdmark-tab-panel"/g)).toHaveLength(2);
  expect(html).toContain(
    '<p class="mdmark-tab-title"><strong>Windows</strong></p>',
  );
  expect(html).not.toContain("**");
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(html).not.toContain("<!--");
});

// 内側の閉じのマーカーが無い入れ子のタブは、外側の開きに記載の警告を配置し、見出しと本文のまま出す（正常系）
test("test_normal_when_nested_tabs_unclosed", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(nestedTabs(false));
  // 検証
  const boxes = warnings(html);
  expect(boxes).toHaveLength(1);
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf("macOS"),
  );
  expect(plainText(boxes[0] ?? "")).toContain("閉じのマーカー");
  expect(html).not.toContain('<div class="mdmark-tabs"');
  for (const [tag, name] of [
    ["h3", "macOS"],
    ["h3", "<strong>Windows</strong>"],
    ["h4", "zsh"],
    ["h4", "bash"],
  ]) {
    expect(html).toMatch(new RegExp(`<${tag}[^>]*>${name}<a `));
  }
  for (const body of ["zsh の本文", "bash の本文", "Windows の本文"]) {
    expect(html).toContain(`<p>${body}</p>`);
  }
});

// 追加したグラフの種類と 6 つの系列を、タイトルと凡例を持つ図に描く（正常系）
test("test_normal_when_chart_types_added", async () => {
  // 準備
  const render = await loadRender();
  const stackedBar = {
    type: "stacked-bar",
    title: "積み上げの棒",
    x: { label: "窓口", ticks: ["メール", "電話"] },
    y: { label: "件" },
    series: [
      { name: "回答", points: [3, 5] },
      { name: "回送", points: [4, 1] },
    ],
  };
  const bubble = {
    type: "bubble",
    title: "長さと時間と件数",
    x: { label: "字" },
    y: { label: "分" },
    size: { label: "件数" },
    series: [
      {
        name: "自動",
        points: [
          [1, 2, 3],
          [2, 3, 4],
        ],
      },
      {
        name: "担当者",
        points: [
          [3, 1, 2],
          [4, 2, 5],
        ],
      },
    ],
  };
  const markdown = [
    chartBlock(twoSeriesChart("area")),
    chartBlock(stackedBar),
    chartBlock(twoSeriesChart("stacked-area")),
    chartBlock(twoSeriesChart("horizontal-bar")),
    chartBlock(DONUT_CHART),
    chartBlock(twoSeriesChart("radar")),
    chartBlock(bubble),
    chartBlock(COMBO_CHART),
    chartBlock(lineChart(6)),
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const figures = chartFigures(html);
  expect(figures).toHaveLength(9);
  for (const figure of figures) {
    expect(figure).toMatch(/^ data-diagram="chart"/);
    expect(figure).toContain("mdmark-diagram-title");
    expect(figure).toContain("mdmark-diagram-legend");
  }
  expect(html).not.toContain("mdmark-syntax-warning");
  const [
    ,
    stacked = "",
    ,
    horizontal = "",
    donut = "",
    ,
    ,
    combo = "",
    six = "",
  ] = figures;
  // 積み上げの棒: 1 つ目の項目で 2 つ目の系列が 1 つ目の上に載り、高さの和が値 7 の高さ
  const [first, , second] = chartBars(stacked).map(rectBox);
  expect(second?.x).toBe(first?.x);
  expect((second?.y ?? 0) + (second?.height ?? 0)).toBeCloseTo(first?.y ?? 0);
  const unit = (first?.height ?? 0) / 3;
  expect((first?.height ?? 0) + (second?.height ?? 0)).toBeCloseTo(unit * 7);
  // 横の棒: 値が大きいほど幅が広く、縦の位置で項目を分ける
  const bars = chartBars(horizontal).map(rectBox);
  const [three, five, two] = bars;
  expect(five?.width).toBeGreaterThan(three?.width ?? 0);
  expect(three?.width).toBeGreaterThan(two?.width ?? 0);
  expect(new Set(bars.slice(0, 3).map((bar) => bar.y)).size).toBe(3);
  expect(new Set(bars.slice(0, 3).map((bar) => bar.x)).size).toBe(1);
  // ドーナツ: 扇形が外と内の 2 つの弧を持つ
  const slices = matches(
    donut,
    /<path class="mdmark-diagram-slice" d="[^"]*"/g,
  );
  expect(slices).toHaveLength(2);
  for (const slice of slices) {
    expect(matches(slice, / A/g)).toHaveLength(2);
  }
  // 組み合わせ: 1 つ目の系列が棒、2 つ目の系列が折れ線
  expect(chartBars(combo)).toHaveLength(3);
  expect(combo).toMatch(
    /<path class="mdmark-diagram-series" data-series="2" d="M[^"]* L/,
  );
  // 6 つの系列の折れ線: 系列 1〜6 と凡例の 6 つの名前
  for (let index = 1; index <= 6; index += 1) {
    expect(six).toContain(`data-series="${index}"`);
    expect(six).toContain(`窓口${index}`);
  }
});

// 系列（ドーナツは項目）が 6 つを超えるグラフを描かず、記載の警告にする（正常系）
test("test_normal_when_chart_series_too_many", async () => {
  // 準備
  const render = await loadRender();
  const manyItems = {
    ...DONUT_CHART,
    items: Array.from({ length: 7 }, (_, index) => ({
      name: `種類${index + 1}`,
      value: index + 1,
    })),
  };
  const markdown = [
    chartBlock(lineChart(7)),
    chartBlock(manyItems),
    chartBlock(lineChart(6)),
    "段落の本文",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const [series = "", items = ""] = warnings(html).map(plainText);
  expect(series).toContain("系列が 7 つ");
  expect(series).toContain("1〜6");
  expect(items).toContain("項目が 7 つ");
  expect(items).toContain("1〜6");
  expect(chartFigures(html)).toHaveLength(1);
  expect(html).toContain("<p>段落の本文</p>");
});

// 埋め込んだ HTML の中のドーナツと組み合わせのチャートを、`<!-- chart -->` と同じ図に描く（正常系）
test("test_normal_when_embedded_chart_types_added", async () => {
  // 準備
  const render = await loadRender();
  const element = (definition: Record<string, unknown>): string =>
    `<mdmark-chart>${JSON.stringify({ ...CHART_META, ...definition })}</mdmark-chart>`;
  const markdown = [
    wrapHtml(`<div>${element(DONUT_CHART)}${element(COMBO_CHART)}</div>`),
    chartBlock(DONUT_CHART),
    chartBlock(COMBO_CHART),
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const normalized = (pattern: RegExp): string[] =>
    matches(html, pattern).map((part) =>
      part.replace(/mdmark-diagram-\d+/g, "mdmark-diagram-N"),
    );
  const svgs = normalized(/<svg[^>]*role="img"[\s\S]*?<\/svg>/g);
  expect(svgs).toHaveLength(4);
  expect(svgs[0]).toBe(svgs[2]);
  expect(svgs[1]).toBe(svgs[3]);
  const legends = normalized(
    /<(?:ul|div)[^>]*mdmark-diagram-legend[\s\S]*?<\/(?:ul|div)>/g,
  );
  expect(legends[0]).toBe(legends[2]);
  expect(legends[1]).toBe(legends[3]);
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(html).not.toContain("<mdmark-chart");
});

// 行末の `[!code focus]`・`[!code error]`・`[!code warning]` を行の種類にし、マーカーを取り除く（正常系）
test("test_normal_when_code_focus_error_warning", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "```ts",
    "foo(); // [!code focus]",
    "bar(); // [!code error]",
    "baz(); // [!code warning]",
    "qux();",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const [pre = ""] = startTags(html, "pre");
  expect(pre).toContain('class="mdmark-code-lines mdmark-code-has-focus"');
  const lines = startTags(html, "span").filter((tag) =>
    tag.includes('"mdmark-code-line"'),
  );
  expect(lines.map((tag) => /data-kind="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "focus",
    "error",
    "warning",
    undefined,
  ]);
  expect(html).not.toContain("[!code");
  expect(html).not.toContain("//");
});

/** 行に分けたコードブロックの、行ごとの開始タグを記載した順に返却する */
function codeLineTags(block: string): string[] {
  return startTags(block, "span").filter((tag) =>
    tag.includes('"mdmark-code-line"'),
  );
}

// インデントのある行に深さと畳める行の数を付け、`fold=` の行を畳んで出す（正常系）
test("test_normal_when_code_foldable", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- code: {"fold": [2]} -->',
    "",
    "```yaml",
    "a:",
    "  b:",
    "    c: 1",
    "  d: 2",
    "```",
    "",
    "```json",
    "{",
    '  "a": {',
    '    "b": 1',
    "  }",
    "}",
    "```",
    "",
    "```tree",
    "src/",
    "├── a.ts",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const [yaml = "", json = ""] = codeBlocks(html);
  const [a = "", b = "", c = "", d = ""] = codeLineTags(yaml);
  expect(a).toContain('data-fold-lines="3"');
  expect(a).not.toContain("data-indent");
  expect(b).toContain('data-indent="1"');
  expect(b).toContain('data-fold-lines="1"');
  expect(b).toContain("data-folded");
  expect(c).toContain('data-indent="2"');
  expect(d).toContain('data-indent="1"');
  expect(d).not.toContain("data-fold-lines");
  // 閉じ括弧の行は畳む行に含めない
  const [open = "", inner = ""] = codeLineTags(json);
  expect(open).toContain('data-fold-lines="3"');
  expect(inner).toContain('data-fold-lines="1"');
  const tree = html.slice(html.indexOf('class="mdmark-tree"'));
  expect(tree).not.toContain("mdmark-code-line");
  expect(tree).not.toContain("data-fold-lines");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 畳めない行とコードブロックに無い行の `fold=` を記載の警告にし、畳める行だけを畳む（正常系）
test("test_normal_when_code_fold_invalid", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- code: {"fold": [1, 3, 99]} -->',
    "",
    "```yaml",
    "a:",
    "  b: 1",
    "c: 2",
    "d: 3",
    "e: 4",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const boxes = warnings(html);
  expect(boxes).toHaveLength(1);
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf("<pre"),
  );
  const box = plainText(boxes[0] ?? "");
  expect(box).toContain("3 行目");
  expect(box).toContain("畳めません");
  expect(box).toContain("99");
  const lines = codeLineTags(html);
  expect(lines.map((tag) => tag.includes("data-folded"))).toEqual([
    true,
    false,
    false,
    false,
    false,
  ]);
  for (const text of ["a:", "  b: 1", "c: 2", "d: 3", "e: 4"]) {
    expect(html).toContain(`<span class="mdmark-code-text">${text}</span>`);
  }
});

/** 結合テストの ER 図の定義（モックの `shop-er` の `products` を緑にして概要を除き、`orders` を畳んだもの） */
function integrationEr(): ReturnType<typeof shopEr> {
  const definition = shopEr();
  definition.tables = definition.tables.map((table) => {
    if (table.id === "products") {
      const { desc: _desc, ...rest } = table;
      return { ...rest, color: "green" };
    }
    return table.id === "orders" ? { ...table, folded: true } : table;
  });
  return definition;
}

/** 描いた HTML の中の、`data-node` が `id` の ER 図のテーブル */
function erTableHtml(html: string, id: string): string {
  return outerHtmlOf(html, `data-node="${id}"`);
}

/** `needle` を含む開始タグから、その要素の閉じタグまで（入れ子を数える） */
function outerHtmlOf(html: string, needle: string): string {
  const tag = findTag(html, needle);
  return `${tag}${innerHtml(html, needle)}</div>`;
}

// ER 図を描く（正常系）
test("test_normal_when_er_diagram", async () => {
  // 準備
  const render = await loadRender();
  const definition = integrationEr();
  // 実行
  const html = render(wrapDirective("er", erText(definition)));
  // 検証
  const figures = findTags(html, 'mdmark-diagram"');
  expect(findTags(html, 'class="mdmark-diagram"')).toHaveLength(1);
  expect(figures.some((tag) => tag.includes('data-diagram="er"'))).toBe(true);
  const text = plainText(html);
  expect(text).toContain(definition.title);
  expect(text).toContain(`範囲: ${definition.scope}`);
  expect(html).toContain(`datetime="${definition.updated}"`);
  for (const table of definition.tables) {
    const tag = findTag(html, `data-node="${table.id}"`);
    expect(tag).toContain(
      `left:${table.x}px;top:${table.y}px;width:${table.w}px`,
    );
    const inner = plainText(erTableHtml(html, table.id));
    expect(inner).toContain(table.name);
    expect(inner).toContain(table.label);
  }
  const customers = erTableHtml(html, "customers");
  expect(findTag(html, 'data-node="customers"')).toContain('data-color="blue"');
  expect(plainText(customers)).toContain("マスター");
  expect(findTag(html, 'data-node="order_items"')).toContain(
    'data-color="orange"',
  );
  expect(plainText(erTableHtml(html, "order_items"))).toContain(
    "トランザクション",
  );
  expect(findTag(html, 'data-node="products"')).toContain('data-color="green"');
  expect(plainText(erTableHtml(html, "products"))).toContain("マスター");
  const columns = matches(customers, /data-column="([^"]+)"/g).map((m) =>
    m.slice('data-column="'.length, -1),
  );
  expect(columns).toEqual(["id", "email", "name", "created_at"]);
  const idRow = outerHtmlOf(customers, 'data-column="id"').replace(
    /<\/div>$/,
    "",
  );
  expect(idRow).toMatch(/<abbr[^>]*title="主キー"[^>]*>PK<\/abbr>/);
  expect(idRow).toMatch(/<abbr[^>]*title="NOT NULL"[^>]*>NN<\/abbr>/);
  const orders = erTableHtml(html, "orders");
  const visible = findTags(orders, "data-column=").filter(
    (tag) => !/\bhidden\b/.test(tag),
  );
  expect(visible).toHaveLength(2);
  expect(findTag(orders, "mdmark-diagram-er-rest")).not.toMatch(/\bhidden\b/);
  expect(plainText(orders)).toContain("非表示 6 列");
  expect(findTag(orders, "mdmark-diagram-er-fold")).toContain(
    'aria-expanded="false"',
  );
  expect(findTag(customers, "mdmark-diagram-er-fold")).toContain(
    'aria-expanded="true"',
  );
  expect(
    matches(html, /<g data-er-relation="\d+"[^>]*><path[^>]*data-line="er"/g),
  ).toHaveLength(3);
  const order = findTag(html, 'data-er-to-column="customer_id"');
  expect(order).toContain('data-er-from-card="1"');
  expect(order).toContain('data-er-to-card="0..n"');
  expect(text).toContain("注文する");
  const info = findTag(customers, "mdmark-diagram-info");
  const tipId = /aria-describedby="([^"]+)"/.exec(info)?.[1] ?? "";
  const tip = findTag(html, `id="${tipId}"`);
  expect(tip).toContain('role="tooltip"');
  expect(tip).toMatch(/\bhidden\b/);
  const tipText = plainText(innerHtml(html, `id="${tipId}"`));
  expect(tipText).toContain("顧客（customers）");
  expect(tipText).toContain("注文する人");
  expect(tipText).toContain("ログインに使用する");
  expect(erTableHtml(html, "products")).not.toContain("mdmark-diagram-info");
  const legend = plainText(innerHtml(html, "mdmark-diagram-legend"));
  expect(findTags(html, "mdmark-diagram-legend-item")).toHaveLength(8);
  for (const word of [
    "マスター",
    "トランザクション",
    "PK",
    "FK",
    "NN",
    "1 つ",
    "1 つ以上",
    "0 以上",
  ]) {
    expect(legend).toContain(word);
  }
  expect(html).not.toContain('"tables"');
});

// 誤った ER 図の定義は記載の警告にし、ほかの図と本文は描く（正常系）
test("test_normal_when_er_diagram_invalid", async () => {
  // 準備
  const render = await loadRender();
  const relate = (patch: Record<string, string>) => {
    const definition = integrationEr();
    definition.relations = definition.relations.map((relation) =>
      relation.label === "注文する" ? { ...relation, ...patch } : relation,
    );
    return erText(definition);
  };
  const markdown = [
    wrapDirective("er", relate({ toColumn: "customer" })),
    wrapDirective("er", relate({ to: "payments" })),
    wrapDirective("er", erText(integrationEr())),
    "段落",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const warnings = html
    .split('class="mdmark-syntax-warning"')
    .slice(1)
    .map((part) =>
      plainText(part.slice(part.indexOf(">") + 1, part.indexOf("</div>"))),
    );
  expect(warnings).toHaveLength(2);
  expect(warnings[0]).toMatch(/^記載の警告ER 図の部品の定義を読み込めません/);
  expect(warnings[0]).toContain(
    "関係「注文する」の先の列 orders.customer がテーブル orders にありません",
  );
  expect(warnings[1]).toContain("関係「注文する」の先のテーブル payments");
  expect(findTags(html, 'class="mdmark-diagram"')).toHaveLength(1);
  expect(html).toContain("<p>段落</p>");
});

/** 1 つ目の段落に参照、2 つ目の段落に行内の脚注を持ち、途中に 2 段落の定義を配置した文書 */
const FOOTNOTES_MARKDOWN = [
  "出典がある[^src]。",
  "",
  "[^src]: 出典の説明",
  "",
  "    [詳しく](https://example.com)",
  "",
  "行内にも記載できる^[行内の補足]。",
  "",
].join("\n");

// `[^ラベル]`・定義・行内の `^[中身]` を、番号・ツールチップ・末尾の閉じた一覧にする（正常系）
test("test_normal_when_footnotes", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(FOOTNOTES_MARKDOWN);
  // 検証
  const [first = "", second = ""] = html.split("</p>");
  const firstLink = findTag(first, "mdmark-fn-link");
  expect(firstLink).toContain('id="mdmark-fnref-1-0"');
  expect(firstLink).toContain('href="#mdmark-fn-1"');
  expect(plainText(innerHtml(first, "mdmark-fn-link"))).toBe("脚注 1");
  const secondLink = findTag(second, "mdmark-fn-link");
  expect(secondLink).toContain('id="mdmark-fnref-2-0"');
  expect(plainText(innerHtml(second, "mdmark-fn-link"))).toBe("脚注 2");
  const firstTip = findTag(html, 'id="mdmark-fn-tip-1-0"');
  expect(firstTip).toContain('role="group"');
  expect(firstTip).toContain('aria-label="脚注 1"');
  expect(firstLink).toContain('aria-details="mdmark-fn-tip-1-0"');
  const firstTipBody = innerHtml(html, 'id="mdmark-fn-tip-1-0"');
  expect(plainText(innerHtml(firstTipBody, "mdmark-fn-tip-title"))).toBe(
    "脚注 1",
  );
  expect(firstTipBody).toContain("出典の説明");
  expect(firstTipBody).toContain('<a href="https://example.com">詳しく</a>');
  expect(findTag(html, 'id="mdmark-fn-tip-2-0"')).toContain('role="tooltip"');
  expect(secondLink).toContain('aria-describedby="mdmark-fn-tip-2-0"');
  expect(innerHtml(html, 'id="mdmark-fn-tip-2-0"')).toContain("行内の補足");
  const list = findTag(html, "mdmark-footnotes");
  expect(list).toBe('<details class="mdmark-footnotes">');
  expect(html.trimEnd().endsWith("</details>")).toBe(true);
  expect(innerHtml(html, "<summary")).toBe("脚注（2 件）");
  const items = findTags(html, "mdmark-fn-item").map(
    (tag) => /id="([^"]*)"/.exec(tag)?.[1],
  );
  expect(items).toEqual(["mdmark-fn-1", "mdmark-fn-2"]);
  for (const number of [1, 2]) {
    expect(innerHtml(html, `id="mdmark-fn-${number}"`)).toContain(
      `href="#mdmark-fnref-${number}-0"`,
    );
  }
  expect(html).not.toContain("[^src]");
  expect(html).not.toContain("^[");
});

// ラベルを大文字小文字を区別せずに照合し、最初の定義を採り、定義の無い参照とリンクを文字のまま残す（正常系）
test("test_normal_when_footnotes_matched", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "[^Note] と [^note] と [^missing] と [^x](https://example.com)",
    "",
    "[^note]: 1 つ目",
    "",
    "[^NOTE]: 2 つ目",
    "",
    "[^unused]: 使用しない",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const refs = findTags(html, "mdmark-fn-link").map(
    (tag) => /id="([^"]*)"/.exec(tag)?.[1],
  );
  expect(refs).toEqual(["mdmark-fnref-1-0", "mdmark-fnref-1-1"]);
  expect(plainText(innerHtml(html, 'id="mdmark-fn-tip-1-0"'))).toBe(
    "脚注 11 つ目",
  );
  // 戻るリンクのスクリーンリーダー向けの名前（`2 つ目の参照`）は除き、画面に出る文字で確認する
  expect(plainText(html)).not.toContain("2 つ目");
  expect(html).toContain("[^missing]");
  expect(html).toContain('<a href="https://example.com">^x</a>');
  expect(findTags(html, "mdmark-fn-item")).toHaveLength(1);
  const backs = findTags(innerHtml(html, 'id="mdmark-fn-1"'), "mdmark-fn-back");
  expect(backs).toHaveLength(2);
  expect(
    matches(innerHtml(html, 'id="mdmark-fn-1"'), /<\/svg>([ab])<\/a>/g),
  ).toEqual(["</svg>a</a>", "</svg>b</a>"]);
  expect(html).not.toContain("使用しない");
});

// 文書のマーカーで `footnotes` を削除し、参照と定義を記載した文字のまま記載した位置に残す（正常系）
test("test_normal_when_footnotes_disabled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- features: {"footnotes": false} -->',
    "",
    "出典がある[^src] と ^[補足]。",
    "",
    "[^src]: 出典の説明",
    "",
    "終わり",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain("<p>出典がある[^src] と ^[補足]。</p>");
  expect(html).not.toContain("<a ");
  const definitionAt = html.indexOf("<p>[^src]: 出典の説明</p>");
  expect(definitionAt).toBeGreaterThan(-1);
  expect(definitionAt).toBeLessThan(html.indexOf("<p>終わり</p>"));
  expect(html).not.toMatch(/class="mdmark-fn-/);
  expect(html).not.toContain("mdmark-footnotes");
});

/** ノードの `data-node` ごとの位置と大きさ（`style` の `left`・`top`・`width`・`height`） */
function nodeBoxes(
  html: string,
): Map<string, { x: number; y: number; w: number; h: number }> {
  const boxes = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();
  for (const tag of startTags(html, "div")) {
    const id = /data-node="([^"]+)"/.exec(tag)?.[1];
    const style =
      /left:(-?[\d.]+)px;top:(-?[\d.]+)px;width:([\d.]+)px;height:([\d.]+)px/.exec(
        tag,
      );
    if (id !== undefined && style) {
      boxes.set(id, {
        x: Number(style[1]),
        y: Number(style[2]),
        w: Number(style[3]),
        h: Number(style[4]),
      });
    }
  }
  return boxes;
}

/** 線の `data-wire` ごとの、パスの `M`・`L` の点 */
function wirePoints(html: string): Map<string, Array<[number, number]>> {
  const points = new Map<string, Array<[number, number]>>();
  for (const tag of startTags(html, "path")) {
    const id = /data-wire="([^"]+)"/.exec(tag)?.[1];
    const d = / d="([^"]*)"/.exec(tag)?.[1];
    if (id === undefined || d === undefined) {
      continue;
    }
    points.set(
      id,
      [...d.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(
        ([, x = "0", y = "0"]): [number, number] => [Number(x), Number(y)],
      ),
    );
  }
  return points;
}

// 座標を省いた判定フローチャートを配置して描き、座標を省けない定義を記載の警告にする（正常系）
test("test_normal_when_flowchart_auto_layout", async () => {
  // 準備
  const render = await loadRender();
  const auto = JSON.parse(JUDGEMENT_AUTO_TEXT) as {
    nodes: Array<Record<string, unknown>>;
    wires: Array<{ id: string; from: string; to: string }>;
  };
  const mixed = structuredClone(auto);
  Object.assign(mixed.nodes[1] ?? {}, { x: 60, y: 156, w: 280, h: 136 });
  const notJudgement = structuredClone(auto);
  Object.assign(notJudgement.nodes[2] ?? {}, { kind: "llm" });
  const markdown = [
    wrapDirective("flow", JUDGEMENT_AUTO_TEXT),
    wrapDirective("flow", JSON.stringify(mixed)),
    wrapDirective("flow", JSON.stringify(notJudgement)),
    "後の段落",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const figures = diagramFigures(html);
  expect(figures).toHaveLength(1);
  const boxes = nodeBoxes(html);
  const lines = wirePoints(html);
  expect(boxes.size).toBe(6);
  expect(lines.size).toBe(6);
  const box = (id: string) => {
    const found = boxes.get(id);
    if (found === undefined) {
      throw new Error(`ノードが無い: ${id}`);
    }
    return found;
  };
  expect(Math.min(...[...boxes.values()].map((item) => item.y))).toBe(
    box("start").y,
  );
  expect(box("q1").x).toBe(box("q2").x);
  expect(box("q1").y).toBeLessThan(box("q2").y);
  expect(box("a1").x).toBeGreaterThan(box("q1").x + box("q1").w);
  expect(box("r1").x).toBeGreaterThan(box("q2").x + box("q2").w);
  expect(box("r2").y).toBeGreaterThan(box("q2").y + box("q2").h);
  // 重ならず、図の中にある
  const stage =
    /class="mdmark-diagram-stage" style="width:([\d.]+)px;height:([\d.]+)px/.exec(
      html,
    );
  const width = Number(stage?.[1]);
  const height = Number(stage?.[2]);
  const all = [...boxes.entries()];
  for (const [id, item] of all) {
    expect(item.x + item.w, id).toBeLessThanOrEqual(width);
    expect(item.y + item.h, id).toBeLessThanOrEqual(height);
    for (const [other, next] of all) {
      if (other === id) {
        continue;
      }
      const overlaps =
        item.x < next.x + next.w &&
        next.x < item.x + item.w &&
        item.y < next.y + next.h &&
        next.y < item.y + item.h;
      expect(overlaps, `${id} と ${other}`).toBe(false);
    }
  }
  // 線は縦と横だけで、端でないノードの中を通らない
  for (const wire of auto.wires) {
    const path = lines.get(wire.id) ?? [];
    expect(path.length, wire.id).toBeGreaterThanOrEqual(2);
    for (const [index, [x, y]] of path.slice(1).entries()) {
      const [px, py] = path[index] ?? [x, y];
      expect(px === x || py === y, wire.id).toBe(true);
      for (const [id, item] of all) {
        if (id === wire.from || id === wire.to) {
          continue;
        }
        const crosses =
          Math.max(px, x) > item.x &&
          Math.min(px, x) < item.x + item.w &&
          Math.max(py, y) > item.y &&
          Math.min(py, y) < item.y + item.h;
        expect(crosses, `${wire.id} と ${id}`).toBe(false);
      }
    }
  }
  const [mixedWarning = "", kindWarning = ""] = warnings(html).map(plainText);
  expect(mixedWarning).toContain("全て記載するか、全て省いて");
  expect(kindWarning).toContain("llm");
  expect(kindWarning).toContain("判定フローチャート");
  expect(html).toContain("<p>後の段落</p>");
  expect(render(markdown)).toBe(html);
});

// リンク先を持つノードをリンクにし、許さないリンク先のノードをリンクにせず記載の警告にする（正常系）
test("test_normal_when_node_link", async () => {
  // 準備
  const render = await loadRender();
  const node = (id: string, x: number, extra: Record<string, unknown>) => ({
    id,
    kind: "script",
    x,
    y: 40,
    w: 140,
    h: 72,
    name: `ノード${id}`,
    ...extra,
  });
  const definition = {
    title: "リンク",
    scope: "点検",
    updated: "2026-11-05",
    width: 900,
    height: 152,
    nodes: [
      node("a", 20, {
        href: "https://example.com/spec",
        io: { in: "本文", do: "分ける", out: "種類" },
      }),
      node("b", 200, { href: "./other.md" }),
      node("c", 380, { href: "javascript:alert(1)" }),
      node("d", 560, { href: "id:spec#items" }),
      node("e", 740, {}),
    ],
    wires: [],
  };
  // 実行
  const html = render(wrapDirective("flow", JSON.stringify(definition)));
  // 検証
  const nodeHtml = (id: string) => outerHtmlOf(html, `data-node="${id}"`);
  for (const [id, href] of [
    ["a", "https://example.com/spec"],
    ["b", "./other.md"],
  ] as const) {
    const tag = startTags(html, "div").find((item) =>
      item.includes(`data-node="${id}"`),
    );
    expect(tag).toContain("has-link");
    expect(nodeHtml(id)).toContain(
      `<a class="mdmark-diagram-node-link" href="${href}" aria-label="ノード${id}"></a>`,
    );
  }
  expect(nodeHtml("a")).toMatch(
    /<a class="mdmark-diagram-node-link"[^>]*><\/a><button[^>]*mdmark-diagram-info/,
  );
  for (const id of ["c", "d", "e"]) {
    const tag = startTags(html, "div").find((item) =>
      item.includes(`data-node="${id}"`),
    );
    expect(tag, id).not.toContain("has-link");
    expect(nodeHtml(id), id).not.toContain("<a ");
    expect(nodeHtml(id), id).toContain(`ノード${id}`);
  }
  const found = warnings(html);
  expect(found).toHaveLength(1);
  const text = plainText(found[0] ?? "");
  for (const word of [
    "c",
    "d",
    "javascript:alert(1)",
    "id:spec#items",
    "mailto",
  ]) {
    expect(text).toContain(word);
  }
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf("mdmark-diagram"),
  );
  expect(html.replace("javascript:alert(1)", "")).not.toContain("javascript:");
});

// wrap を持つコードブロックとファイルツリーに折り返す class を付け、値を持つ wrap= を記載の警告にする（正常系）
test("test_normal_when_wrap", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- code: {"lines": {}, "wrap": true} -->',
    "",
    "```ts",
    "const a = 1;",
    "const b = 2;",
    "const c = 3;",
    "```",
    "",
    '<!-- code: {"wrap": true} -->',
    "",
    "```ts",
    "const a = 1;",
    "```",
    "",
    "```ts",
    "const plain = 1;",
    "```",
    "",
    '<!-- tree: {"depth": "all", "wrap": true} -->',
    "",
    "```tree",
    "src/",
    "└── a.ts",
    "```",
    "",
    '<!-- code: {"wrap": "yes"} -->',
    "",
    "```ts",
    "const valued = 1;",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const pres = startTags(html, "pre");
  const classOf = (tag: string) =>
    /class="([^"]*)"/.exec(tag)?.[1]?.split(" ") ?? [];
  expect(classOf(pres[0] ?? "")).toEqual(
    expect.arrayContaining([
      "mdmark-code-lines",
      "mdmark-code-numbered",
      "mdmark-code-wrap",
    ]),
  );
  expect(
    codeLineTags(codeBlocks(html)[0] ?? "").map(
      (tag) => /data-line="(\d+)"/.exec(tag)?.[1],
    ),
  ).toEqual(["1", "2", "3"]);
  expect(classOf(pres[1] ?? "")).toEqual(
    expect.arrayContaining(["mdmark-code-lines", "mdmark-code-wrap"]),
  );
  expect(classOf(pres[1] ?? "")).not.toContain("mdmark-code-numbered");
  expect(classOf(pres[2] ?? "")).not.toContain("mdmark-code-wrap");
  const tree = startTags(html, "div").find((tag) =>
    tag.includes("mdmark-tree"),
  );
  expect(tree).toContain("mdmark-tree-wrap");
  expect(tree).toContain('data-open="all"');
  const [warning = ""] = warnings(html);
  expect(plainText(warning)).toContain("wrap");
  expect(plainText(warning)).toContain('"yes"');
  expect(plainText(warning)).toContain("true");
  expect(plainText(warning)).toContain("false");
  expect(html.indexOf(warning)).toBeLessThan(html.indexOf("const valued"));
  expect(classOf(pres[3] ?? "")).not.toContain("mdmark-code-wrap");
});

/** 1〜12 行目に `const v{行} = {行};` を持つ `src/app.ts` の本文 */
const APP_TS = Array.from(
  { length: 12 },
  (_, index) => `const v${index + 1} = ${index + 1};`,
).join("\n");

/** `共通/手順.md`（準備・実行・片付け。実行の下に表と `../src/app.ts#L1` の取り込み） */
const PROCEDURE_MD = [
  "## 準備",
  "",
  "準備の段落",
  "",
  "## 実行",
  "",
  "実行の段落",
  "",
  '<!-- table: {"kind": "data"} -->',
  "",
  "| 手順 | 担当 |",
  "| --- | --- |",
  "| ビルド | 開発者 |",
  "",
  "<!-- /table -->",
  "",
  '<!-- include: {"path": "../src/app.ts", "heading": "L1"} -->',
  "",
  "## 片付け",
  "",
  "片付けの段落",
  "",
].join("\n");

// 行内の新しい記法を、スクリプト無しで読み込める HTML にする（正常系）
test("test_normal_when_inline_notations", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "## `icon:flag` はじめに",
    "",
    "`icon:sailboat` と `icon\\:check` と `kbd:Ctrl+C` と `kbd:Ctrl++` と ==決め手== と ==例外=={color=green} と <ruby>漢字<rt>かんじ</rt></ruby>",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(innerHtml(innerHtml(html, "<h2"), 'data-icon="flag"')).toContain(
    "<svg",
  );
  expect(findTag(html, 'data-icon="flag"')).toBe(
    '<span class="mdmark-inline-icon" data-icon="flag" aria-hidden="true">',
  );
  expect(html).toContain(
    '<span class="mdmark-inline-icon" data-icon="sailboat" aria-hidden="true"></span>',
  );
  expect(html).toContain("<code>icon:check</code>");
  expect(html).toContain(
    '<span class="mdmark-kbd-group"><kbd class="mdmark-kbd">Ctrl</kbd><span class="mdmark-kbd-join">+</span><kbd class="mdmark-kbd">C</kbd></span>',
  );
  expect(html).toContain(
    '<span class="mdmark-kbd-group"><kbd class="mdmark-kbd">Ctrl</kbd><span class="mdmark-kbd-join">+</span><kbd class="mdmark-kbd">+</kbd></span>',
  );
  expect(html).toContain('<mark class="mdmark-highlight">決め手</mark>');
  expect(html).toContain(
    '<mark class="mdmark-highlight" data-color="green">例外</mark>',
  );
  expect(html).not.toContain("==");
  expect(html).not.toContain("{color=");
  expect(html).toContain("<ruby>漢字<rt>かんじ</rt></ruby>");
  expect(html).not.toContain("icon:flag");
  expect(html).not.toContain("kbd:");
});

// opts.icons にあるまとめていない名前を、その構造の svg で描く（正常系）
test("test_normal_when_icon_nodes", async () => {
  // 準備
  const render = await loadRender();
  const icons = {
    sailboat: [
      ["path", { d: "M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z" }],
      ["path", { d: "M21 14 10 2 3 14h18Z", onclick: "x" }],
    ],
  } as Record<string, Array<[string, Record<string, string>]>>;
  // 実行
  const html = render("`icon:sailboat`\n", { icons });
  // 検証
  const icon = innerHtml(html, 'data-icon="sailboat"');
  expect(icon).toContain("<svg");
  expect(findTags(icon, "<path")).toHaveLength(2);
  expect(html).not.toContain("onclick");
});

// 範囲を持つ新しい記法を、中身を隠さない HTML にする（正常系）
test("test_normal_when_block_notations", async () => {
  // 準備
  const render = await loadRender();
  const table = [
    "| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| a | b | c | d | e | f | g | h |",
  ].join("\n");
  const markdown = [
    "<!-- columns -->",
    "",
    "左の列",
    "",
    "<!-- column -->",
    "",
    "右の列",
    "",
    "<!-- /columns -->",
    "",
    '<!-- details: {"title": "補足の手順"} -->',
    "",
    "補足の中身",
    "",
    "<!-- /details -->",
    "",
    '<!-- details: {"title": "実行の例", "open": true} -->',
    "",
    "例の中身",
    "",
    "<!-- /details -->",
    "",
    "<!-- pagebreak -->",
    "",
    "<!-- wide -->",
    "",
    table,
    "",
    "<!-- /wide -->",
    "",
    '<!-- wide: {"open": false} -->',
    "",
    table,
    "",
    "<!-- /wide -->",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(findTag(html, "mdmark-layout-columns")).toBe(
    '<div class="mdmark-layout-columns" data-count="2">',
  );
  expect(findTags(html, '"mdmark-layout-column"')).toHaveLength(2);
  expect(html).toContain(
    '<details class="mdmark-collapsible"><summary>補足の手順</summary>',
  );
  expect(html).toContain(
    '<details class="mdmark-collapsible" open><summary>実行の例</summary>',
  );
  expect(html).not.toMatch(/<summary>[^<]*open/);
  expect(html).not.toMatch(/<h[1-6][^>]*>補足の手順/);
  expect(html).toContain(
    '<div class="mdmark-pagebreak" aria-hidden="true"></div>',
  );
  const ranges = html.split('<div class="mdmark-wide-range"').slice(1);
  expect(ranges).toHaveLength(2);
  expect(ranges[0]).toMatch(/^ data-state="wide">/);
  expect(ranges[1]).toMatch(/^ data-state="narrow">/);
  for (const range of ranges) {
    expect(range).toContain("<table");
  }
  expect(html).not.toContain("<!--");
  expect(html).not.toContain("<button");
});

// include のマーカーの場所に、取り込む文書の表から参照した全体・見出しの中・行の範囲を描く（正常系）
test("test_normal_when_includes", async () => {
  // 準備
  const render = await loadRender();
  const includes = { "共通/手順.md": PROCEDURE_MD, "src/app.ts": APP_TS };
  const markdown = [
    "前の段落",
    "",
    '<!-- include: {"path": "共通/手順.md"} -->',
    "",
    "間の段落",
    "",
    '<!-- include: {"path": "./共通/手順.md", "heading": "実行"} -->',
    "",
    '<!-- include: {"path": "src/app.ts", "lines": {"from": 3, "to": 5}} -->',
    "",
  ].join("\n");
  // 実行
  const html = render(markdown, { includes });
  // 検証
  expect(findTag(html, "mdmark-include")).toBe(
    '<div class="mdmark-include" data-include="共通/手順.md">',
  );
  const whole = innerHtml(html, 'data-include="共通/手順.md"');
  const section = innerHtml(html, 'data-include="./共通/手順.md#実行"');
  const lines = innerHtml(html, 'data-include="src/app.ts#L3-L5"');
  for (const text of ["準備の段落", "実行の段落", "片付けの段落"]) {
    expect(whole).toContain(text);
  }
  expect(section).toContain("実行の段落");
  expect(section).not.toContain("準備の段落");
  expect(section).not.toContain("片付けの段落");
  expect(findTag(section, "mdmark-table")).toContain('data-kind="data"');
  expect(section).toContain("const v1 = 1;");
  expect(lines).toContain('<code class="language-ts"');
  expect(lines).toContain("const v3 = 3;");
  expect(lines).toContain("const v5 = 5;");
  expect(lines).not.toContain("const v6 = 6;");
  expect(lines).not.toContain("const v2 = 2;");
  const ids = [...html.matchAll(/<h2[^>]* id="([^"]+)"/g)].map((m) => m[1]);
  expect(ids).toContain("実行-1");
  expect(new Set(ids).size).toBe(ids.length);
  expect(html).not.toContain("<!--");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 取り込めないマーカーの場所に記載の警告を配置し、循環する取り込みを止める（正常系）
test("test_normal_when_include_errors", async () => {
  // 準備
  const render = await loadRender();
  const includes = {
    "共通/手順.md": PROCEDURE_MD,
    "src/app.ts": APP_TS,
    "a.md": 'A\n\n<!-- include: {"path": "b.md"} -->\n',
    "b.md": 'B\n\n<!-- include: {"path": "a.md"} -->\n',
  };
  const markdown = [
    "前の段落",
    "",
    '<!-- include: {"path": "missing.md"} -->',
    "",
    '<!-- include: {"path": "共通/手順.md", "heading": "無い見出し"} -->',
    "",
    '<!-- include: {"path": "src/app.ts", "lines": {"from": 20, "to": 22}} -->',
    "",
    '<!-- include: {"path": "a.md"} -->',
    "",
    "後ろの段落",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown, { includes });
  const without = render(markdown);
  // 検証
  const warnings = html
    .split('<div class="mdmark-syntax-warning" role="note">')
    .slice(1);
  expect(warnings).toHaveLength(4);
  expect(warnings[0]).toContain("missing.md");
  expect(warnings[1]).toContain("無い見出し");
  expect(warnings[2]).toContain("20〜22 行目");
  expect(warnings[2]).toContain("12 行");
  expect(warnings[3]).toContain("a.md → b.md → a.md");
  expect(html.split("<p>A</p>")).toHaveLength(2);
  expect(html.split("<p>B</p>")).toHaveLength(2);
  expect(findTags(without, 'class="mdmark-syntax-warning"')).toHaveLength(4);
  expect(html).toContain("前の段落");
  expect(html).toContain("後ろの段落");
});

// 言語 csv のコードブロックを表にし、元の CSV を隠して添える（正常系）
test("test_normal_when_csv", async () => {
  // 準備
  const render = await loadRender();
  const csv = [
    "名前,拠点,金額",
    '北山,"東京, 本社",1200',
    '南田,"大阪\r\n（支店）",800',
    '西川,"名古屋 ""中央""",950',
  ].join("\r\n");
  const markdown = [
    '<!-- table: {"kind": "data"} -->',
    "",
    "```csv",
    csv,
    "```",
    "",
    "<!-- /table -->",
    "",
    "```csv",
    csv,
    "```",
    "",
    "```text",
    csv,
    "```",
    "",
    "```csv",
    "a,b,c",
    "1,2",
    "1,2,3,4",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const wrappers = findTags(html, 'class="mdmark-table"');
  expect(wrappers[0]).toBe(
    '<div class="mdmark-table" data-kind="data" data-features="sort pin filter resize" data-source="csv">',
  );
  const first = innerHtml(html, 'class="mdmark-table"');
  expect(plainText(first)).toContain("名前");
  expect(first.match(/<th[ >]/g)).toHaveLength(3);
  expect(findTags(innerHtml(first, "<tbody"), "<tr")).toHaveLength(3);
  expect(first).toMatch(/<td[^>]*>東京, 本社<\/td>/);
  expect(first).toMatch(/<td[^>]*>大阪<br \/>\s*（支店）<\/td>/);
  expect(first).toMatch(/<td[^>]*>名古屋 "中央"<\/td>/);
  expect(first).toContain('<pre class="mdmark-raw" hidden');
  expect(innerHtml(first, 'class="language-csv"')).toBe(
    `${csv.replaceAll("\r\n", "\n")}\n`,
  );
  expect(wrappers[1]).toContain('data-kind="default"');
  expect(wrappers[1]).toContain('data-source="csv"');
  expect(html).toContain('<code class="language-text"');
  const warning = innerHtml(html, 'class="mdmark-syntax-warning"');
  expect(warning).toContain("2 行目");
  expect(warning).toContain("3 行目");
  const lastTable = html.slice(html.lastIndexOf('data-source="csv"'));
  const rows = innerHtml(lastTable, "<tbody").split("<tr").slice(1);
  expect(rows[0]?.split("<td")).toHaveLength(4);
  expect(rows[0]).toMatch(/<td[^>]*><\/td>/);
});

// 新しい記法の読み込めない記載方法の箇所に記載の警告を配置し、読み込めた分で描く（正常系）
test("test_normal_when_new_syntax_errors", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "前の段落 `icon:Rocket!` と `icon:`",
    "",
    "==決め手=={color=pink}",
    "",
    "<!-- columns -->",
    "",
    "1 列だけ",
    "",
    "<!-- /columns -->",
    "",
    "<!-- columns -->",
    "",
    "c1",
    "",
    "<!-- column -->",
    "",
    "c2",
    "",
    "<!-- column -->",
    "",
    "c3",
    "",
    "<!-- column -->",
    "",
    "c4",
    "",
    "<!-- /columns -->",
    "",
    "<!-- columns -->",
    "",
    "<!-- columns -->",
    "",
    "内1",
    "",
    "<!-- column -->",
    "",
    "内2",
    "",
    "<!-- /columns -->",
    "",
    "<!-- column -->",
    "",
    "外2",
    "",
    "<!-- /columns -->",
    "",
    '<!-- details: {"title": "補足"} -->',
    "",
    "補足の段落",
    "",
    "<!-- wide -->",
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const warnings = html
    .split('<div class="mdmark-syntax-warning" role="note">')
    .slice(1)
    .map((part) => plainText(part.slice(0, part.indexOf("</div>"))));
  expect(html).toContain("<code>icon:Rocket!</code>");
  expect(html).toContain("<code>icon:</code>");
  expect(warnings.filter((w) => w.includes("Rocket!"))).toHaveLength(1);
  expect(html).toContain('<mark class="mdmark-highlight">決め手</mark>');
  const pink = warnings.find((w) => w.includes("pink"));
  expect(pink).toContain("blue");
  expect(warnings.some((w) => w.includes("1 列") && w.includes("2〜3"))).toBe(
    true,
  );
  expect(warnings.some((w) => w.includes("4 列") && w.includes("2〜3"))).toBe(
    true,
  );
  expect(warnings.some((w) => w.includes("入れ子"))).toBe(true);
  expect(findTags(html, "mdmark-layout-columns")).toHaveLength(1);
  expect(findTag(html, "mdmark-layout-columns")).toContain('data-count="2"');
  expect(html).not.toContain("<details");
  expect(warnings.some((w) => w.includes("<!-- /details -->"))).toBe(true);
  expect(html).not.toContain("mdmark-wide-range");
  expect(warnings.some((w) => w.includes("<!-- /wide -->"))).toBe(true);
  expect(html).toContain("補足の段落");
});

// オフの新しい記法を、記載した文字か普通の Markdown として描く（正常系）
test("test_normal_when_new_syntax_disabled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- features: {"icon": false, "columns": false, "highlight": false, "kbd": false, "details": false, "pagebreak": false, "include": false, "wide": false, "csv": false} -->',
    "",
    "`icon:check` と `kbd:Ctrl+C` と ==決め手==",
    "",
    "<!-- columns -->",
    "",
    "左",
    "",
    "<!-- column -->",
    "",
    "右",
    "",
    "<!-- /columns -->",
    "",
    '<!-- details: {"title": "補足"} -->',
    "",
    "補足の中身",
    "",
    "<!-- /details -->",
    "",
    "<!-- pagebreak -->",
    "",
    '<!-- include: {"path": "part.md"} -->',
    "",
    "<!-- wide -->",
    "",
    "広げる中身",
    "",
    "<!-- /wide -->",
    "",
    "```csv",
    "a,b",
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown, { includes: { "part.md": "取り込んだ段落" } });
  // 検証
  expect(html).toContain("<code>icon:check</code>");
  expect(html).toContain("<code>kbd:Ctrl+C</code>");
  expect(html).toContain("==決め手==");
  expect(html).not.toContain("<mark");
  for (const name of [
    "mdmark-layout-columns",
    "mdmark-collapsible",
    "mdmark-pagebreak",
    "mdmark-include",
    "mdmark-wide-range",
    "mdmark-syntax-warning",
    "data-source",
  ]) {
    expect(html).not.toContain(name);
  }
  for (const text of ["左", "右", "補足の中身", "広げる中身"]) {
    expect(html).toContain(text);
  }
  expect(html).not.toContain("取り込んだ段落");
  expect(html).toContain('<code class="language-csv"');
  expect(html).not.toContain("<!--");
});

// `+reorder` を `data-features` に設定し、結合した見出しの範囲を列ごとに写す（正常系）
test("test_normal_when_table_reorder", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- table: {"kind": "data", "features": {"reorder": {}, "columns": {}}, "header": {"rows": 2}} -->',
    "",
    "| 名前 | 設定 | << | << | 備考 |",
    "| --- | --- | --- | --- | --- |",
    "| ^^ | 型 | 既定 | 必須 | ^^ |",
    "| features.table | bool | true | ✓ | 表の機能 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const wrapper = findTag(html, 'class="mdmark-table"');
  expect(wrapper).toMatch(/data-features="[^"]*\breorder\b[^"]*"/);
  const second = innerHtml(html, "<thead").split("</tr>")[1] ?? "";
  const secondHeads = startTags(second, "th");
  const texts = second
    .split("</th>")
    .slice(0, -1)
    .map((part) => plainText(part).trim());
  expect(texts).toEqual(["型", "既定", "必須"]);
  const groups = secondHeads.map(
    (tag) => /data-group="([^"]*)"/.exec(tag)?.[1],
  );
  expect(groups[0]).toBeDefined();
  expect(new Set(groups).size).toBe(1);
  const first = innerHtml(html, "<thead").split("</tr>")[0] ?? "";
  for (const tag of startTags(first, "th").filter((tag) =>
    /rowspan="2"/.test(tag),
  )) {
    expect(tag).not.toContain("data-group");
  }
  expect(plainText(innerHtml(html, "<tbody")).replace(/\s+/g, " ").trim()).toBe(
    "features.table bool true ✓ 表の機能",
  );
  expect(html).not.toContain("<button");
});

/** 階層の表の行（キー・型・必須・既定・説明） */
const TREE_TABLE_ROWS = [
  "| キー | 型 | 必須 | 既定 | 説明 |",
  "| --- | --- | --- | --- | --- |",
  "| features.table | bool | ✓ | true | 表の機能 |",
  "| features.html | bool |  |  | 埋め込んだ HTML |",
  "| aliases[].id | string |  |  | 別名の ID |",
  "| aliases[].metadata.alias_type.type | ref \\| custom |  |  | 別名の種類 |",
];

/** 表のマーカーの `tree` に `extra` のキーを加えた階層の表の文書 */
function treeMarkdown(extra = ""): string {
  return [
    `<!-- table: {"kind": "data", "tree": {"key": {"column": "キー"}, "type": {"column": "型"}, "required": {"column": "必須"}, "default": {"column": "既定"}${extra}}} -->`,
    "",
    ...TREE_TABLE_ROWS,
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 階層の行の開始タグを、上から並べて返却する */
function treeRowTags(html: string): string[] {
  return startTags(html, "tr").filter((tag) => tag.includes("mdmark-tree-row"));
}

/** パスの階層の行の HTML（開始タグから `</tr>` まで） */
function treeRowHtml(html: string, path: string): string {
  const at = html.indexOf(`data-path="${path}"`);
  const start = html.lastIndexOf("<tr", at);
  return html.slice(start, html.indexOf("</tr>", at) + "</tr>".length);
}

// tree.key.column の列を階層の行にし、表に無い親の行を補い、型・必須・既定の列を替える（正常系）
test("test_normal_when_table_tree", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(treeMarkdown());
  // 検証
  const rows = treeRowTags(html);
  expect(rows.map((tag) => /data-path="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "features",
    "features.table",
    "features.html",
    "aliases[]",
    "aliases[].id",
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
    "aliases[].metadata.alias_type.type",
  ]);
  for (const path of [
    "features",
    "aliases[]",
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
  ]) {
    const row = treeRowHtml(html, path);
    const tag = startTags(row, "tr")[0] ?? "";
    expect(tag).toContain("is-virtual");
    expect(tag).toContain("has-children");
    const cells = row.split("</td>").slice(1, -1);
    for (const cell of cells) {
      expect(plainText(cell).trim()).toBe("");
    }
  }
  const leaf = treeRowHtml(html, "aliases[].metadata.alias_type.type");
  expect(startTags(leaf, "tr")[0]).toContain('data-depth="3"');
  expect(startTags(leaf, "tr")[0]).toContain(
    'data-parent="aliases[].metadata.alias_type"',
  );
  expect(findTags(leaf, "mdmark-tree-guide")).toHaveLength(3);
  expect(plainText(innerHtml(leaf, "mdmark-tree-name"))).toBe("type");
  expect(html).toContain('<span class="mdmark-type-badge" data-type="bool">');
  expect(findTags(leaf, "mdmark-type-chip")).toHaveLength(2);
  expect(plainText(innerHtml(html, "<thead"))).not.toContain("必須");
  expect(
    findTags(treeRowHtml(html, "features.table"), "mdmark-tree-required"),
  ).toHaveLength(1);
  expect(html.match(/mdmark-tree-required/g)).toHaveLength(1);
  expect(treeRowHtml(html, "features.table")).toContain(
    '<span class="mdmark-tree-default">true</span>',
  );
  expect(findTag(html, 'class="mdmark-table"')).not.toMatch(
    /data-features="[^"]*\bsort\b/,
  );
});

// tree.example.heading の見出しの下のタブを表の下へ移し、見本の行にキーのパスを持たせる（正常系）
test("test_normal_when_table_tree_example", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    treeMarkdown(', "example": {"heading": "設定の見本"}'),
    "## 設定の見本",
    "",
    "<!-- tabs -->",
    "",
    "### 最小",
    "",
    "```yaml",
    "features:",
    "  table: true",
    "```",
    "",
    "### エイリアス",
    "",
    "```yaml",
    "aliases:",
    "  - id: terms",
    "    metadata:",
    "      alias_type:",
    "        type: custom",
    "```",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const layout = innerHtml(html, 'class="mdmark-tree-layout"');
  expect(layout).toContain('class="mdmark-table"');
  const aside = findTag(layout, "<aside");
  expect(aside).toContain("mdmark-tree-example");
  expect(aside).toContain('aria-label="見本: 設定の見本"');
  expect(html.indexOf("</table>")).toBeLessThan(html.indexOf("<aside"));
  expect(
    findTags(innerHtml(layout, "<aside"), "mdmark-tab-panel"),
  ).toHaveLength(2);
  const heading = /<h2[^>]*>[\s\S]*?<\/h2>/.exec(html)?.[0] ?? "";
  expect(plainText(heading)).toContain("設定の見本");
  expect(innerHtml(layout, "<aside")).not.toContain("<h2");
  const lineOf = (path: string) =>
    findTags(layout, `data-path="${path}"`).find((tag) =>
      tag.includes("mdmark-yaml-line"),
    );
  expect(lineOf("aliases[].metadata.alias_type.type")).toBeDefined();
  expect(lineOf("aliases[].id")).toBeDefined();
  const typeLine = layout.slice(
    layout.indexOf(lineOf("aliases[].metadata.alias_type.type") ?? "@"),
  );
  expect(plainText(typeLine.split("\n")[0] ?? "")).toContain("type: custom");
});

// 表に無い列名の tree.key.column・tree.key の無い tree・無い見出しの tree.example.heading に記載の警告を配置する（正常系）
test("test_normal_when_table_tree_invalid", async () => {
  // 準備
  const render = await loadRender();
  const table = (mark: string) =>
    [
      `<!-- table: ${mark} -->`,
      "",
      ...TREE_TABLE_ROWS,
      "",
      "<!-- /table -->",
      "",
    ].join("\n");
  const markdown = [
    table('{"kind": "data", "tree": {"key": {"column": "キー名"}}}'),
    table('{"kind": "data", "tree": {"type": {"column": "型"}}}'),
    table(
      '{"kind": "data", "tree": {"key": {"column": "キー"}, "example": {"heading": "見本"}}}',
    ),
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const parts = html.split('<div class="mdmark-syntax-warning" role="note">');
  expect(parts).toHaveLength(4);
  const warnings = parts
    .slice(1)
    .map((part) => plainText(part.split("</div>")[0] ?? ""));
  expect(warnings[0]).toContain("tree.key.column");
  expect(warnings[0]).toContain("キー名");
  expect(warnings[1]).toContain("tree に必須の key がありません");
  expect(warnings[2]).toContain("tree.example.heading");
  expect(warnings[2]).toContain("見本");
  const tables = html.split('class="mdmark-table"').slice(1);
  expect(tables[0]).not.toContain("mdmark-tree-row");
  expect(tables[1]).not.toContain("mdmark-type-badge");
  expect(tables[2]).toContain("mdmark-tree-row");
  expect(html).not.toContain("mdmark-tree-example");
});

/** 範囲に html（class `box` の div と `<script>`）・css・ts を配置した文書 */
const RANGE_MARKDOWN = [
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">ノード</div>',
  "<script>window.__mdmarkScriptRan = true</script>",
  "```",
  "",
  "```css",
  ".box { background-color: red }",
  "```",
  "",
  "```ts",
  "export default (root: HTMLElement): void => {",
  '  root.dataset.ran = "1";',
  "};",
  "```",
  "",
  "<!-- /html -->",
  "",
].join("\n");

/** 範囲の ts のコード（`template` の中身と比べる） */
const RANGE_TS = [
  "export default (root: HTMLElement): void => {",
  '  root.dataset.ran = "1";',
  "};",
].join("\n");

// html-scripts がオンのとき、範囲の css を根の要素に限った style にし、ts を実行しない template に入れる（正常系）
test("test_normal_when_range_scripts", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(RANGE_MARKDOWN, {
    config: { features: { "html-scripts": true } },
  });
  // 検証
  const scope = findTag(html, 'class="mdmark-html"');
  expect(scope).toContain('data-html-scope="0"');
  const inner = innerHtml(html, 'class="mdmark-html"');
  expect(inner.startsWith('<style class="mdmark-html-style">')).toBe(true);
  expect(inner.trimEnd()).toMatch(
    /<template class="mdmark-html-script" data-lang="ts">[\s\S]*<\/template>$/,
  );
  const css = innerHtml(inner, 'class="mdmark-html-style"');
  for (const rule of css.split("}").filter((part) => part.trim() !== "")) {
    expect(rule.trim().startsWith('.mdmark-html[data-html-scope="0"]')).toBe(
      true,
    );
  }
  expect(css).not.toMatch(/(^|\})\s*\.box\s*\{/);
  const template = innerHtml(inner, 'class="mdmark-html-script"');
  expect(
    template
      .replaceAll("&quot;", '"')
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&")
      .trim(),
  ).toBe(RANGE_TS);
  expect(html).not.toContain("<script");
  expect(inner).toContain('<div class="box">ノード</div>');
  expect(html).not.toContain('class="language-css"');
  expect(html).not.toContain('class="language-ts"');
});

// html-scripts がオフのとき、範囲の html だけを描き、css・ts をコードのまま出す（正常系）
test("test_normal_when_range_scripts_off", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(RANGE_MARKDOWN);
  // 検証
  const inner = innerHtml(html, 'class="mdmark-html"');
  expect(inner).not.toContain("<style");
  expect(inner).not.toContain("<template");
  const after = html.slice(html.indexOf('class="mdmark-html"'));
  expect(after).toMatch(/<pre[^>]*><code class="language-css"/);
  expect(after).toMatch(/<pre[^>]*><code class="language-ts"/);
  expect(html).not.toContain("mdmark-syntax-warning");
});

// ts と js を両方置いた範囲に記載の警告を配置し、どちらのスクリプトも配置しない（正常系）
test("test_normal_when_range_scripts_both_languages", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "<!-- html -->",
    "",
    "```html",
    "<p>範囲</p>",
    "```",
    "",
    "```ts",
    "export default () => {};",
    "```",
    "",
    "```js",
    "export default () => {};",
    "```",
    "",
    "<!-- /html -->",
    "",
    "後ろの段落",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown, {
    config: { features: { "html-scripts": true } },
  });
  // 検証
  const warnings = html.split('class="mdmark-syntax-warning"');
  expect(warnings).toHaveLength(2);
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf('class="mdmark-html"'),
  );
  const warning = plainText(warnings[1]?.split("</div>")[0] ?? "");
  expect(warning).toContain("ts");
  expect(warning).toContain("js");
  expect(innerHtml(html, 'class="mdmark-html"')).toContain("<p>範囲</p>");
  expect(html).not.toContain("mdmark-html-script");
  expect(html).toContain("<p>後ろの段落</p>");
});

// ノードも線も 1 種類ずつのフロー図は、凡例の項目を持たずに描く（正常系（種類が 1 つずつの図））
test("test_normal_when_single_kinds", async () => {
  // 準備
  const render = await loadRender();
  const definition = parsed<MdmarkFlowDefinition>(SINGLE_KINDS_TEXT);
  // 実行
  const html = render(wrapDirective("flow", SINGLE_KINDS_TEXT));
  // 検証
  expect(diagramFigures(html)).toHaveLength(1);
  expect(findTags(html, 'data-node="')).toHaveLength(3);
  expect(
    matches(html, /<path[^>]* class="mdmark-diagram-wire"[^>]*>/g),
  ).toHaveLength(2);
  expect(html).toContain(definition.title);
  expect(html).not.toContain("mdmark-diagram-legend-item");
  expect(html).not.toContain("mdmark-diagram-legend-sample");
});

// page のマーカーを本文に出さず、cards の範囲のリストをカードの格子の HTML にする（正常系（ページの設定のマーカーとカードの格子））
test("test_normal_when_page_marker_and_card_grid", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- page: {"scheme": "dark", "toc": {"mode": "fixed"}} -->',
    "",
    "# 目次",
    "",
    "<!-- cards -->",
    "- `icon:book` [使用方法](使い方/README.md)",
    "  導入と使用方法の手順",
    "- https://example.com/docs",
    "- 準備中",
    "<!-- /cards -->",
    "",
  ].join("\n");
  const middle = [
    "最初の段落",
    "",
    '<!-- page: {"scheme": "dark"} -->',
    "",
    "後ろの段落",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  const middleHtml = render(middle);
  // 検証
  expect(html).not.toContain("page:");
  expect(html).not.toContain("mdmark-syntax-warning");
  const grid = innerHtml(html, '<ul class="mdmark-card-grid"');
  const items = grid.split("<li").slice(1);
  expect(items).toHaveLength(3);
  expect(items[0]).toContain(
    `<a class="mdmark-card-grid-item" href="${encodeURI("使い方/README.md")}"`,
  );
  expect(findTag(items[0] ?? "", "mdmark-card-grid-icon")).toContain(
    'data-icon="book"',
  );
  expect(items[0]).toContain(
    '<span class="mdmark-card-grid-title">使用方法</span>',
  );
  expect(items[0]).toContain(
    '<p class="mdmark-card-grid-desc">導入と使用方法の手順</p>',
  );
  expect(items[1]).toContain(
    '<span class="mdmark-card-grid-title">example.com/docs</span>',
  );
  expect(html).not.toMatch(/class="mdmark-card[ "]/);
  expect(items[2]).toContain('<div class="mdmark-card-grid-item"');
  expect(items[2]).toContain(
    '<span class="mdmark-card-grid-title">準備中</span>',
  );
  expect(findTags(middleHtml, 'class="mdmark-syntax-warning"')).toHaveLength(1);
  expect(middleHtml.indexOf("mdmark-syntax-warning")).toBeGreaterThan(
    middleHtml.indexOf("最初の段落"),
  );
  expect(middleHtml.indexOf("mdmark-syntax-warning")).toBeLessThan(
    middleHtml.indexOf("後ろの段落"),
  );
});

// mermaid のコードブロックは図にせず、属性 data-mdmark-mermaid を付けたコードブロックとして返却する（正常系（mermaid のコードブロック））
test("test_normal_when_mermaid_code_block", async () => {
  // 準備
  const render = await loadRender();
  const block = ["```mermaid", "flowchart LR", "  A --> B", "```", ""].join(
    "\n",
  );
  // 実行
  const enabled = render(block);
  const disabled = render(`<!-- features: {"mermaid": false} -->\n\n${block}`);
  // 検証
  expect(findTag(enabled, 'class="mdmark-code"')).toContain(
    "data-mdmark-mermaid",
  );
  expect(findTag(enabled, "<code")).toContain('class="language-mermaid"');
  expect(plainText(innerHtml(enabled, "<code"))).toContain("A --> B");
  expect(findTag(disabled, 'class="mdmark-code"')).not.toContain(
    "data-mdmark-mermaid",
  );
  for (const html of [enabled, disabled]) {
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("data-mdmark-syntax");
  }
});

/** 1〜4 行目にフロントマター、6 行目に見出し、8 行目に段落を持つ文書 */
const FRONTMATTER_MARKDOWN = [
  "---",
  "title: テスト",
  "tags: [a, b]",
  "---",
  "",
  "# 見出し",
  "",
  "段落",
  "",
].join("\n");

// 先頭のフロントマターを本文から除外し、後ろのブロックの元の行番号は元の Markdown のままにする（正常系）
test("test_normal_when_frontmatter", async () => {
  // 準備
  const render = await loadRawRender();
  // 実行
  const html = render(FRONTMATTER_MARKDOWN);
  // 検証
  for (const text of ["title: テスト", "tags: [a, b]", "<hr", "<h2"]) {
    expect(html).not.toContain(text);
  }
  expect(findTag(html, "<h1")).toContain('data-source-line="5"');
  expect(findTag(html, "<p")).toContain('data-source-line="7"');
  expect(html).not.toContain("mdmark-frontmatter");
});

// 機能 frontmatter がオンなら、本文の先頭の閉じた折りたたみにフロントマターを yaml のコードブロックで描く（正常系）
test("test_normal_when_frontmatter_enabled", async () => {
  // 準備
  const render = await loadRawRender();
  // 実行
  const html = render(FRONTMATTER_MARKDOWN, {
    config: { features: { frontmatter: true } },
  });
  // 検証
  const details = findTag(html, "<details");
  expect(html.startsWith(details)).toBe(true);
  expect(details).toContain('class="mdmark-collapsible mdmark-frontmatter"');
  expect(details).not.toContain("open");
  expect(plainText(innerHtml(html, "<summary"))).toBe("フロントマター");
  const inside = innerHtml(html, "mdmark-frontmatter");
  expect(findTag(inside, "<code")).toContain('class="language-yaml"');
  const lines = plainText(innerHtml(inside, "<code"))
    .split("\n")
    .filter((line) => line !== "");
  expect(lines).toEqual(["title: テスト", "tags: [a, b]"]);
  const outside = html.replace(outerHtml(html, "mdmark-frontmatter"), "");
  expect(outside).not.toContain("title: テスト");
  expect(outside).not.toContain("<h2");
  expect(findTag(html, "<h1")).toContain('data-source-line="5"');
});

// 閉じる行が無ければ、先頭の区切り線をフロントマターとして扱わない（正常系）
test("test_normal_when_frontmatter_unclosed", async () => {
  // 準備
  const render = await loadRender();
  const markdown = ["---", "", "段落", "", "## 見出し", ""].join("\n");
  // 実行
  const html = render(markdown, {
    config: { features: { frontmatter: true } },
  });
  // 検証
  expect(html.startsWith("<hr")).toBe(true);
  expect(html).toContain("<p>");
  expect(html).toContain("<h2");
  expect(html).not.toContain("mdmark-frontmatter");
});

// 取り込む Markdown の先頭のフロントマターは、機能 frontmatter がオンでも除外して取り込む（正常系）
test("test_normal_when_included_has_frontmatter", async () => {
  // 準備
  const render = await loadRender();
  const includes = {
    "共通/手順.md": [
      "---",
      "title: 手順",
      "---",
      "",
      "## 実行",
      "",
      "実行の段落",
      "",
    ].join("\n"),
  };
  const markdown = [
    "前の段落",
    "",
    '<!-- include: {"path": "共通/手順.md"} -->',
    "",
    "後の段落",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown, {
    config: { features: { frontmatter: true } },
    includes,
  });
  // 検証
  const included = innerHtml(html, "mdmark-include");
  expect(plainText(innerHtml(included, "<h2"))).toContain("実行");
  expect(included).toContain("実行の段落");
  expect(html).not.toContain("title: 手順");
  expect(html).not.toContain("mdmark-frontmatter");
});

// map の範囲を、mount が図にする場所の要素とソースのコードブロックにする（正常系（map の範囲））
test("test_normal_when_map_range", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    mapRange({
      args: '{"title": "全体の構成", "interval": 3}',
      mermaid: MAP_FLOW,
      data: MAP_DATA,
    }),
    mapRange({ mermaid: MAP_SEQUENCE }),
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const ranges = findTags(html, 'class="mdmark-map"');
  expect(ranges).toHaveLength(2);
  expect(ranges[0]).toContain('data-map="1"');
  expect(ranges[0]).toContain('data-map-kind="flowchart"');
  expect(ranges[0]).toContain(
    'data-map-args="{&quot;title&quot;:&quot;全体の構成&quot;,&quot;interval&quot;:3}"',
  );
  expect(ranges[1]).toContain('data-map="2"');
  expect(ranges[1]).toContain('data-map-kind="sequenceDiagram"');
  const codes = findTags(html, 'class="mdmark-code"');
  expect(codes).toHaveLength(2);
  for (const code of codes) expect(code).not.toContain("data-mdmark-mermaid");
  expect(findTags(html, 'class="language-mermaid"')).toHaveLength(2);
  const data = findTags(html, 'class="mdmark-map-data"');
  expect(data).toHaveLength(1);
  expect(data[0]).toMatch(/^<pre /);
  expect(data[0]).toContain("hidden");
  expect(plainText(html)).toContain('"walkthroughs"');
  expect(html).not.toContain("<!-- map");
  expect(html).not.toContain("-->");
  expect(html).not.toContain("<svg");
  expect(html).not.toContain("mdmark-diagram");
  expect(render(markdown)).toBe(html);
});

// map の範囲の形の誤りを書き方の警告にし、印の知らないキーは無視する（正常系（map の書き方の誤り））
test("test_normal_when_map_written_wrongly", async () => {
  // 準備
  const render = await loadRender();
  const parts = [
    mapRange({
      args: '{"mdoe": 1}',
      mermaid: "flowchart LR\n  subgraph lib [mdmark]\n  A -> B\n",
      data: '{"version": 1, "layuot": {}}',
    }),
    mapRange({ args: "{title: 全体}", mermaid: "flowchart LR\n  A --> B\n" }),
    mapRange({ mermaid: 'pie\n  "a" : 1\n' }),
    mapRange({}),
    `<!-- map -->\n\n\`\`\`mermaid\nflowchart LR\n  A --> B\n\`\`\`\n\n<!-- map-data: {"version": 1} -->\n\n<!-- map-data: {"version": 1} -->\n\n<!-- /map -->\n`,
  ];
  const markdown = parts
    .map((part, index) => `段落 P${index + 1}\n\n${part}`)
    .join("\n");
  // 実行
  const html = render(`${markdown}\n段落 END\n`);
  // 検証: 範囲ごとに切り分ける
  const pieces = html.split(/<p[^>]*>段落 P\d<\/p>/).slice(1);
  expect(pieces).toHaveLength(5);
  const warning = (piece: string) =>
    matches(piece, /class="mdmark-syntax-warning[" ]/g).length;
  // 1 つ目: 書き方の警告が無く、印の知らないキーを落とす
  expect(warning(pieces[0] ?? "")).toBe(0);
  const first = findTags(pieces[0] ?? "", 'class="mdmark-map"');
  expect(first).toHaveLength(1);
  expect(first[0]).not.toContain("mdoe");
  // 2 つ目: JSON として読めない印の引数
  expect(warning(pieces[1] ?? "")).toBe(1);
  expect(plainText(pieces[1] ?? "")).toContain("JSON");
  const second = findTags(pieces[1] ?? "", 'class="mdmark-map"');
  expect(second).toHaveLength(1);
  expect(second[0]).not.toContain("title");
  // 3 つ目: 描かない図の種類
  expect(warning(pieces[2] ?? "")).toBe(1);
  expect(plainText(pieces[2] ?? "")).toContain("flowchart");
  expect(plainText(pieces[2] ?? "")).toContain("sequenceDiagram");
  expect(findTags(pieces[2] ?? "", 'class="mdmark-map"')).toHaveLength(0);
  expect(findTags(pieces[2] ?? "", "language-mermaid")).toHaveLength(1);
  // 4・5 つ目: mermaid のブロックが無い範囲・補足が 2 つの範囲
  for (const piece of [pieces[3] ?? "", pieces[4] ?? ""]) {
    expect(warning(piece)).toBe(1);
    expect(findTags(piece, 'class="mdmark-map"')).toHaveLength(0);
  }
  expect(plainText(html)).toContain("段落 END");
});

// 機能 map がオフの文書では、範囲を普通の Markdown として描く（正常系（map の機能を解除する））
test("test_normal_when_map_disabled", async () => {
  // 準備
  const render = await loadRender();
  // 実行
  const html = render(
    `<!-- features: {"map": false} -->\n\n${mapRange({ mermaid: MAP_FLOW, data: MAP_DATA })}`,
  );
  // 検証
  expect(findTags(html, 'class="mdmark-map"')).toHaveLength(0);
  expect(findTag(html, 'class="mdmark-code"')).toContain("data-mdmark-mermaid");
  expect(html).not.toContain("mdmark-map-data");
  expect(html).not.toContain("walkthroughs");
  expect(html).not.toContain("<!-- map");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 引数が JSON のオブジェクトでない外部ライブラリと拡張のマーカーを、マーカーの場所の要素にせず記載の警告にする（正常系）
test("test_normal_when_legacy_embed_args", async () => {
  // 準備
  const { render, registerExtension } = await loadBuilt();
  registerExtension({
    name: "greet",
    directive: "greet-legacy",
    load: async () => ({ draw: () => {} }),
  });
  const markdown = [
    "前の段落",
    "",
    "<!-- test-lib: a b -->",
    "",
    "中の段落",
    "",
    "<!-- greet-legacy: world -->",
    "",
    "後の段落",
    "",
  ].join("\n");
  const config = {
    libraries: { "test-lib": "https://example.invalid/test-lib.js" },
  };
  // 実行
  const html = stripSourceLine(render(markdown, { config }));
  // 検証
  expect(html).not.toContain("mdmark-embed");
  const boxes = warningBodies(html).map(plainText);
  expect(boxes).toHaveLength(2);
  expect(boxes[0]).toContain("test-lib");
  expect(boxes[1]).toContain("greet-legacy");
  for (const box of boxes) {
    expect(box).toContain("JSON のオブジェクトで記載してください");
    expect(box).toContain("mdmark upgrade");
  }
  expect(html.indexOf("<p>前の段落</p>")).toBeLessThan(
    html.indexOf("mdmark-syntax-warning"),
  );
  expect(html).toContain("<p>中の段落</p>");
  expect(html).toContain("<p>後の段落</p>");
});

// 今の書き方の記法のマーカーを、同じ設定の JSON のオブジェクトと同じ HTML に描く（正常系）
test("test_normal_when_legacy_marks", async () => {
  // 準備
  const render = await loadRender();
  const body = (table: string, code: string, details: string): string =>
    [
      table,
      "",
      "| 名前 | 数量 |",
      "| --- | --- |",
      "| a | 1 |",
      "| b | 2 |",
      "",
      "<!-- /table -->",
      "",
      code,
      "",
      "```ts",
      ...Array.from({ length: 6 }, (_, index) => `const v${index} = ${index};`),
      "```",
      "",
      details,
      "",
      "段落",
      "",
      "<!-- /details -->",
      "",
    ].join("\n");
  const legacy = body(
    "<!-- table: data +total total=数量:sum closed -->",
    "<!-- code: title=app.ts lines highlight=2,4-6 -->",
    "<!-- details: 実行の例 open -->",
  );
  const json = body(
    '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}}, "collapse": {"open": false}} -->',
    '<!-- code: {"title": "app.ts", "lines": {}, "highlight": [2, {"from": 4, "to": 6}]} -->',
    '<!-- details: {"title": "実行の例", "open": true} -->',
  );
  // 実行
  const legacyHtml = render(legacy);
  const jsonHtml = render(json);
  // 検証
  expect(legacyHtml).toBe(jsonHtml);
  expect(legacyHtml).not.toContain("mdmark-syntax-warning");
  expect(jsonHtml).not.toContain("mdmark-syntax-warning");
});

// 複数行に分けた JSON のマーカーを、1 行で記載したマーカーと同じ HTML に描く（正常系）
test("test_normal_when_multiline_mark_args", async () => {
  // 準備
  const render = await loadRender();
  const table = [
    "",
    "| 名前 | 数量 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "| c | 3 |",
    "",
    "<!-- /table -->",
    "",
  ];
  const multiline = [
    "<!-- table: {",
    '"kind": "data",',
    '"columns": {"数量": {"total": [{"calc": "sum"}]}},',
    '"collapse": {"open": false, "title": "明細"}',
    "} -->",
    ...table,
  ].join("\n");
  const oneLine = [
    '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}}, "collapse": {"open": false, "title": "明細"}} -->',
    ...table,
  ].join("\n");
  // 実行
  const multilineHtml = render(multiline);
  const oneLineHtml = render(oneLine);
  // 検証
  expect(multilineHtml).toBe(oneLineHtml);
  expect(multilineHtml).toContain('data-total="1:sum"');
  expect(multilineHtml).toContain(
    '<details class="mdmark-table-details"><summary>明細</summary>',
  );
  expect(multilineHtml).not.toContain('"kind"');
  expect(multilineHtml).not.toContain("&quot;kind&quot;");
  expect(multilineHtml).not.toContain("<!--");
  expect(multilineHtml).not.toContain("mdmark-syntax-warning");
});

// JSON として読めない引数と値の --> で閉じた引数に記載の警告を配置し、既定の設定で描く（正常系）
test("test_normal_when_mark_args_not_json", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- details: {"title": 補足} -->',
    "",
    "1 つ目の段落",
    "",
    "<!-- /details -->",
    "",
    '<!-- fig: {"id": 1} -->',
    "",
    '![構成](a.png "全体の構成")',
    "",
    '<!-- details: {"title": "a --> b"} -->',
    "",
    "3 つ目の段落",
    "",
    "<!-- /details -->",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const boxes = warningBodies(html);
  expect(boxes).toHaveLength(3);
  const [invalid = "", figure = "", closed = ""] = boxes.map(plainText);
  expect(invalid).toContain("JSON として読めません");
  expect(invalid).toContain("文字目");
  expect(figure).toContain("id");
  expect(figure).toContain("文字");
  expect(closed).toContain("-->");
  expect(closed).toContain("--\\u003e");
  const details = html.match(/<details[^>]*><summary>詳細<\/summary>/g) ?? [];
  expect(details).toHaveLength(2);
  for (const tag of details) {
    expect(tag).not.toContain(" open");
  }
  expect(html).toContain("1 つ目の段落");
  expect(html).not.toContain("mdmark-figure-number");
  expect(html).not.toContain('id="fig-');
  expect(html).toContain(' b"} --&gt;');
});

// コードブロックの行番号を lines.start の番号から始め、強調の行と桁の数を合わせる（正常系）
test("test_normal_when_line_start", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    '<!-- code: {"title": "src/app.ts の抜粋", "lines": {"start": 10}, "highlight": [{"from": 11, "to": 12}]} -->',
    "",
    "```ts",
    'import { mount } from "mdmark";',
    'const doc = await fetch("/README.md");',
    'mount(document.querySelector("#doc"), await doc.text());',
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(codeTitles(html)).toEqual(["src/app.ts の抜粋"]);
  const lines = codeLineTags(codeBlocks(html)[0] ?? "");
  expect(lines.map((tag) => /data-line="(\d+)"/.exec(tag)?.[1])).toEqual([
    "10",
    "11",
    "12",
  ]);
  expect(
    lines.flatMap((tag) =>
      tag.includes('data-kind="highlight"')
        ? [/data-line="(\d+)"/.exec(tag)?.[1]]
        : [],
    ),
  ).toEqual(["11", "12"]);
  expect(startTags(html, "code").join(" ")).toMatch(
    /style="--mdmark-code-digits: ?2"/,
  );
});

// Markdown のファイルへの lines と、heading と lines の両方を持つ取り込みを、取り込まずに記載の警告にする（正常系）
test("test_normal_when_include_lines_not_allowed", async () => {
  // 準備
  const render = await loadRender();
  const includes = { "共通/手順.md": PROCEDURE_MD, "src/app.ts": APP_TS };
  const markdown = [
    "前の段落",
    "",
    '<!-- include: {"path": "共通/手順.md", "lines": {"from": 1, "to": 3}} -->',
    "",
    '<!-- include: {"path": "src/app.ts", "heading": "実行", "lines": {"from": 3, "to": 5}} -->',
    "",
    "後ろの段落",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown, { includes });
  // 検証
  expect(html).not.toContain("mdmark-include");
  const [markdownLines = "", both = "", ...rest] =
    warningBodies(html).map(plainText);
  expect(rest).toHaveLength(0);
  expect(markdownLines).toContain("lines");
  expect(markdownLines).toContain("Markdown 以外のファイル");
  expect(both).toContain("heading");
  expect(both).toContain("lines");
  expect(both).toContain("同時に記載できません");
  expect(html).toContain("<p>前の段落</p>");
  expect(html).toContain("<p>後ろの段落</p>");
});

// ビューの board.values の値ごとのアイコンのうち、列にある値だけを当て、列に無い値を記載の警告にする（正常系）
test("test_normal_when_board_value_icons", async () => {
  // 準備
  const render = await loadRender();
  const table = [
    "| タイトル | 状態 |",
    "| --- | --- |",
    "| 配色の変数を洗い出す | 未着手 |",
    "| 余白の変数を決める | 完了 |",
  ].join("\n");
  const markdown = `<!-- view: {"board": {"group": {"column": "状態"}, "values": {"未着手": {"icon": "inbox"}, "保留": {"icon": "flag"}}}} -->\n\n${table}\n\n<!-- /view -->\n`;
  // 実行
  const html = render(markdown);
  // 検証
  const [view] = startTags(html, "div").filter((tag) =>
    tag.includes("mdmark-view"),
  );
  const data = /data-view="([^"]*)"/.exec(view ?? "")?.[1] ?? "";
  expect(JSON.parse(data.replaceAll("&quot;", '"')).icons).toEqual({
    未着手: "inbox",
  });
  const [box = "", ...rest] = warningBodies(html).map(plainText);
  expect(rest).toHaveLength(0);
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf('class="mdmark-view"'),
  );
  expect(box).toContain("保留");
  expect(box).toContain("未着手");
  expect(box).toContain("完了");
});

// 罫線の行を 2 行以上持つ言語が tree でないコードブロックの前に記載の警告を配置し、tree_warning が false のコードブロックには配置しない（正常系）
test("test_normal_when_tree_lines_without_tree_language", async () => {
  // 準備
  const render = await loadRender();
  const tree = ["mdmark/", "├── src/", "│   └── index.ts", "└── README.md"];
  const markdown = [
    "```text",
    ...tree,
    "```",
    "",
    "```",
    "src/",
    "|-- index.ts",
    "`-- parts/",
    "```",
    "",
    "```text",
    "└── index.js",
    "```",
    "",
    '<!-- code: {"tree_warning": false} -->',
    "",
    "```text",
    ...tree,
    "```",
    "",
    "```tree",
    ...tree,
    "```",
    "",
    '<!-- code: {"tree_warning": "no"} -->',
    "",
    "```text",
    ...tree,
    "```",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証: 警告とコードブロック・ファイルツリーを出る順に並べる
  const order = [
    ...html.matchAll(
      /<div class="mdmark-syntax-warning"[^>]*>[\s\S]*?<\/div>|<pre[^>]*>|<div class="mdmark-tree"/g,
    ),
  ].map((match) =>
    match[0].startsWith('<div class="mdmark-syntax-warning"')
      ? match[0].includes("罫線のフォルダ構成があります")
        ? match[0].includes("言語の無いコードブロック")
          ? "tree-warning-none"
          : "tree-warning-text"
        : "warning"
      : match[0].startsWith("<pre")
        ? "pre"
        : "tree",
  );
  expect(order).toEqual([
    "tree-warning-text",
    "pre",
    "tree-warning-none",
    "pre",
    "pre",
    "pre",
    "tree",
    "warning",
    "tree-warning-text",
    "pre",
  ]);
  expect(html).toContain(
    "言語 <code>text</code> のコードブロックに、罫線のフォルダ構成があります。",
  );
  expect(html).toContain('&lt;!-- code: {"tree_warning": false} --&gt;');
  expect(
    startTags(html, "code").filter((tag) => tag.includes("language-text")),
  ).toHaveLength(4);
});
