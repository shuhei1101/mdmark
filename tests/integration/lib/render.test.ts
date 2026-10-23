import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test, vi } from "vitest";
import type {
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
  parsed,
  REPLY_TIME_TEXT,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../unit/helpers/diagrams.ts";
import { matches, plainText } from "../../unit/helpers/html.ts";
import { stripSourceLine } from "../../unit/helpers/source-line.ts";
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

/** ビルドした配布物を Node で読み込み、`render` をそのまま返す */
async function loadRawRender(): Promise<Built["render"]> {
  return (await loadBuilt()).render;
}

/** ビルドした配布物を Node で読み込み、元の行番号の属性を取り除いた出力を返す `render` を返す。元の行番号以外の出力を比べるテストが使う */
async function loadRender(): Promise<Built["render"]> {
  const render = await loadRawRender();
  return (markdown, opts) => stripSourceLine(render(markdown, opts));
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
    "<!-- tabs: group=os -->",
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
    "<!-- tabs: group= grop=os closed -->",
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
  ).toHaveLength(5);
  expect(
    html.match(/<p class="mdmark-syntax-warning-title">書き方の警告<\/p>/g),
  ).toHaveLength(5);
  expect(html).toContain('data-kind="default" data-features="pin sort"');
  expect(html).toContain("<code>unknown</code>");
  expect(html).toContain("<code>data</code>・<code>plain</code>");
  expect(html).toContain("<p>見出しの無い範囲</p>");
  // 見出しの無い範囲はタブにせず、読めない指定の範囲だけが組を持たないタブになる
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
  for (const label of ["group=", "grop=", "closed"]) {
    expect(tabsWarning).toContain(`<code>${label}</code>`);
  }
  expect(html).toContain('<a href="#fig-missing">図</a>');
  expect(html).toContain("<code>#fig-missing</code>");
  expect(html).toContain('data-kind="data"');
  expect(html).toContain("&lt;!-- /table --&gt;");
});

// 表の印の 5 つの機能と hide=・total= を data-* に写し、行に ID とリンクを付ける（正常系）
test("test_normal_when_table_features", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "## みかん",
    "",
    "<!-- table: data +count +columns +total +copy +rowlink hide=説明 total=数量:sum -->",
    "",
    "| 名前 | 説明 | 数量 |",
    "| --- | --- | --- |",
    "| りんご | 描画を速くする | 1 |",
    "| みかん | 印刷を直す | 2 |",
    "| みかん | 描画の崩れを直す | 3 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(
    /<div class="mdmark-table" data-kind="data" data-features="sort pin filter count columns total copy rowlink"[^>]*data-hide="1"[^>]*data-total="2:sum"/,
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

// 読めない集計・隠す列と、機能を付けていない表のキーを書き方の警告にして当てない（正常系）
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
    "<!-- table: data +total -->",
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
  // 表 A: 読めた計算だけを当て、隠す列は当てない
  expect(wrapperTag(a)).toContain('data-total="2:avg"');
  expect(wrapperTag(a)).not.toContain("data-hide");
  const warnings = html.split('<div class="mdmark-syntax-warning"');
  expect(warnings).toHaveLength(6);
  // 警告の本文: 先頭の `<code>` は印の文字なので、取り除いた本文だけを見る
  const bodyOf = (warning: string | undefined): string =>
    (warning ?? "").replace(/<code>.*?<\/code>/, "");
  // 表 A: 読めない指定ごとに 1 つずつ、本文に列名と計算がある
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
  // 表 B: 機能の無い表のキーは当てず、機能が要ることを知らせる
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
  const html = stripSourceLine(render(markdown));
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

/** `Intl.Segmenter` を取り除いた間だけ、ほかのテストと共有しない新しいモジュールとして配布物の入口を読み込んで `run` に渡す */
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

// `Intl.Segmenter` を持たない環境でも配布物を読み込め、英数字の語の一部に下線を付けずに用語を照合する（正常系）
test("test_normal_when_no_intl_segmenter", async () => {
  await withoutIntlSegmenter(async (built) => {
    // 準備
    const index: MdmarkIndex = {
      schema: 1,
      docs: [],
      terms: [
        {
          id: "ws",
          term: "ワークスペース",
          aliases: ["WS"],
          meaning: "話し合いの記録を置くフォルダ",
        },
      ],
    };
    // 実行
    const html = built.render("ワークスペースを WSL に置く\n", { index });
    // 検証
    expect(matches(html, /class="mdmark-term"/g)).toHaveLength(1);
    expect(html).toContain(">ワークスペース</span>");
    expect(html).toContain("を WSL に置く");
  });
});

/** `figure.mdmark-diagram` の開始タグを、現れた順に返す */
function diagramFigures(html: string): string[] {
  return startTags(html, "figure").filter((tag) =>
    tag.includes('class="mdmark-diagram"'),
  );
}

// 図の部品の定義から、題・図・凡例を持つ図を描き、定義の JSON と文書のスクリプトを出さない（正常系）
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
  // フロー図: 3 つの層が定義の順にあり、枠の外の箱が枠の外の座標にある
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
  // tip を持つ線と io を持つ箱: role="tooltip" と hidden を持つ中身があり、印は io を持つ箱にだけ
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

// 読めない定義の図の場所だけを書き方の警告にし、ほかの図と本文を描く（正常系）
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
  expect(warnings[0]).toContain("フロー図の部品の定義を JSON として読めません");
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

// 文書の印で図の部品の機能を外すと、印だけを取り除き、定義を json のコードブロックのまま描く（正常系）
test("test_normal_when_diagram_feature_disabled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = `<!-- features: -diagrams -->\n\n${wrapDirective("flow", INQUIRY_TEXT)}`;
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toContain('<code class="language-json">');
  expect(diagramFigures(html)).toHaveLength(0);
  expect(html).not.toContain("<!--");
});

// 図の部品が出した hidden は sanitize を通った後も残り、文書に書いた生の svg・button は残らない（正常系）
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

// 拡張の印を範囲で書いたときは、印の場所の要素だけを出し、定義の JSON を出力に残さない。json が 2 つ以上あれば書き方の警告にする（正常系）
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

/** 開始タグのうち `needle` を含む最初のものを返す（無ければ失敗する） */
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
  '<div style="display: flex; gap: 12px; position: fixed; background-image: url(https://example.com/a.png)">箱</div>',
  '<button onclick="x" type="submit">押す</button>',
  "<script>window.__ran = true</script>",
  '<div data-hint="返信の種類を選ぶ">自動返信</div>',
  '<p>問い合わせは <span data-hint="本文を読んで種類を決める">分類</span> する。</p>',
  `<mdmark-chart>\n${INQUIRY_COUNT_TEXT}\n</mdmark-chart>`,
].join("\n");

// 印を付けた html のコードブロックの中身を HTML として描き、スクリプトと許可していない宣言を落とす（正常系）
test("test_normal_when_embedded_html", async () => {
  // 準備
  const render = await loadRender();
  const outside = ["```html", "<p>範囲の外</p>", "```", ""].join("\n");
  const markdown = `${wrapHtml(EMBEDDED_BODY)}\n${outside}`;
  // 実行
  const html = render(markdown);
  // 検証
  expect(html).toMatch(/<div class="mdmark-html">\s*<div style=/);
  expect(html).not.toMatch(/<pre[^>]*><code class="language-html">[\s\S]*箱/);
  expect(html).toMatch(/<pre[^>]*><code class="language-html">/);
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
  // data-hint: ブロックは印、行内は tabindex を持ち、どちらもツールチップを指す
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
  expect(textById(html, inlineTip)).toBe("本文を読んで種類を決める");
});

// html がオフならコードブロックをコードのまま出し、hints がオフならツールチップの中身と印を出さない（正常系）
test("test_normal_when_html_and_hints_disabled", async () => {
  // 準備
  const render = await loadRender();
  const htmlOff = wrapHtml(EMBEDDED_BODY, "<!-- features: -html -->");
  const diagramHints = `<!-- features: -hints -->\n\n${wrapDirective("flow", INQUIRY_HINT_TEXT)}`;
  const hintsOff = `${wrapHtml(EMBEDDED_BODY)}\n${diagramHints}`;
  // 実行
  const offHtml = render(htmlOff);
  const offHints = render(hintsOff);
  // 検証
  expect(offHtml).toMatch(/<pre[^>]*><code class="language-html">/);
  expect(offHtml).not.toContain("mdmark-html");
  expect(offHtml).not.toContain("<!--");
  expect(offHints).toContain("mdmark-html");
  expect(offHints).not.toContain("data-hint");
  expect(offHints).not.toContain("mdmark-hint-");
  expect(offHints).not.toContain('role="tooltip"');
  expect(offHints).toContain("窓口の MCP");
  expect(offHints).not.toContain("mdmark-diagram-info");
});

// 範囲にコードブロックが 1 つでないときと、読めないチャートの定義の場所に書き方の警告を置く（正常系）
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
    `<p>読めない定義の前</p><mdmark-chart>{"title": "a",</mdmark-chart><p>同じ範囲のほかの HTML</p>`,
  );
  const markdown = [none, two, broken, "後ろの段落", ""].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(3);
  const text = plainText(html);
  const sentence =
    "<!-- html --> の範囲に html のコードブロックを 1 つだけ置いてください";
  expect(text.split(sentence)).toHaveLength(3);
  expect(html).toContain("コードブロックの無い範囲");
  expect(html).toMatch(/<pre[^>]*><code class="language-html">/);
  expect(text).toContain("グラフの部品の定義を JSON として読めません");
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
  expect(matches(bar, /<pattern[^>]*patternunits/g)).toHaveLength(4);
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
  expect(pie).toContain("よくある質問で答えた（186 件）");
  // 散布図: 系列ごとに違う形の点と、数値の目盛りを持つ横の軸
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

// ビューの印の範囲を、引数を持つ `mdmark-view` の中に表を残した HTML にする（正常系）
test("test_normal_when_view_marked", async () => {
  // 準備
  const render = await loadRender();
  const table = [
    "| 題 | 状態 | 担当 |",
    "| --- | --- | --- |",
    "| 配色の変数を洗い出す | 未着手 | 佐藤 |",
    "| 余白の変数を決める | 進行中 | 鈴木 |",
  ].join("\n");
  const markdown = `<!-- view: group=状態 default=table filter=担当 icons=未着手:inbox -->\n\n${table}\n\n<!-- /view -->\n`;
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

/** HTML 文字列の中の、コードブロックの `pre` を書いた順に全て返す */
function codeBlocks(html: string): string[] {
  return html.match(/<pre[\s\S]*?<\/pre>/g) ?? [];
}

/** HTML 文字列の中の、書き方の警告の枠を書いた順に全て返す */
function warnings(html: string): string[] {
  return html.match(/<div class="mdmark-syntax-warning"[\s\S]*?<\/div>/g) ?? [];
}

// コードブロックの印と行の印から、題・行番号・行の強調・行の種類を付ける（正常系）
test("test_normal_when_code_block_decorated", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "<!-- code: title=app.ts lines highlight=1 -->",
    "",
    "```ts",
    "const a = 1;",
    "let count = 1; // [!code ++]",
    "foo(); // 消す [!code --]",
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
  expect(html).toContain(
    '<figcaption class="mdmark-code-title">app.ts</figcaption>',
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
  expect(first).toMatch(/foo\(\); \/\/ 消す<\/span>/);
  expect(second).toContain('data-kind="highlight"');
  expect(second).not.toContain("[!code highlight]");
  expect(second).not.toContain("#");
  expect(second).not.toContain("mdmark-code-numbered");
  expect(second).not.toContain("mdmark-code-signs");
  expect(third).not.toContain("mdmark-code-line");
  expect(third).toContain("// [!code ++]");
  expect(html).not.toContain("<!--");
});

// コードブロックの印と行の印の読めない指定を書き方の警告にし、読めた指定で描く（正常系）
test("test_normal_when_code_block_syntax_invalid", async () => {
  // 準備
  const render = await loadRender();
  const block = (body: string[]): string[] => ["```ts", ...body, "```", ""];
  const markdown = [
    "<!-- code: title=app.ts color=red -->",
    "",
    ...block(["const a = 1;", "const b = 2;", "const c = 3;"]),
    "<!-- code: highlight=2,5 -->",
    "",
    ...block(["const a = 1;", "const b = 2;", "const c = 3;"]),
    ...block(["foo(); // [!code focus]"]),
    "<!-- code: title=app.ts -->",
    "",
    "直後の段落",
    "",
    "<!-- code: title=My App.ts -->",
    "",
    ...block(["const a = 1;"]),
  ].join("\n");
  // 実行
  const html = render(markdown);
  // 検証
  const boxes = warnings(html);
  expect(boxes).toHaveLength(5);
  for (const box of boxes) {
    expect(box).toContain('role="note"');
    expect(box).toContain("書き方の警告");
  }
  const [
    keyBox = "",
    lineBox = "",
    markBox = "",
    fenceBox = "",
    spaceBox = "",
  ] = boxes.map(plainText);
  expect(keyBox).toContain("color=");
  for (const key of ["title=", "lines", "highlight="]) {
    expect(keyBox).toContain(key);
  }
  expect(lineBox).toContain("5");
  expect(lineBox).toContain("3 行");
  expect(markBox).toContain("[!code focus]");
  expect(markBox).toContain("[!code ++]");
  expect(fenceBox).toContain("直後にコードブロックがありません");
  expect(spaceBox).toContain("App.ts");
  expect(html).toContain(
    '<figcaption class="mdmark-code-title">app.ts</figcaption>',
  );
  expect(html).toContain(
    '<figcaption class="mdmark-code-title">My</figcaption>',
  );
  expect(matches(html, /<figure/g)).toHaveLength(2);
  const [, highlighted = "", focused = ""] = codeBlocks(html);
  expect(matches(highlighted, /data-kind=/g)).toHaveLength(1);
  expect(highlighted).toMatch(
    /data-kind="highlight"><span class="mdmark-code-text">const b = 2;/,
  );
  expect(focused).not.toContain("mdmark-code-line");
  expect(focused).toContain("// [!code focus]");
  expect(html).toContain("<p>直後の段落</p>");
});

// コードブロックの飾りの機能を外すと、印を取り除き、行の印を書いた文字のまま描く（正常系）
test("test_normal_when_code_block_feature_disabled", async () => {
  // 準備
  const render = await loadRender();
  const markdown = [
    "<!-- features: -code -->",
    "",
    "<!-- code: title=app.ts lines -->",
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

/** 元の行番号の確認に使う、行の位置が分かる Markdown（1 行目に見出し、3 行目に段落、5〜7 行目に表、8 行目に印、9〜11 行目にコードブロック、13〜14 行目にリスト） */
const SOURCE_LINE_MARKDOWN = [
  "# 見出し",
  "",
  "段落",
  "",
  "| 列A | 列B |",
  "| --- | ---: |",
  "| 1 | 2 |",
  "<!-- code: lines -->",
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
  expect(lineOf("pre")).toBe("8");
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
