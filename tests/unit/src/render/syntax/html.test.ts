import { expect, test } from "vitest";
import type { MdmarkIndex } from "../../../../../src/knowledge/index-shape.ts";
import { INQUIRY_COUNT_TEXT, wrapHtml } from "../../../helpers/charts.ts";
import {
  findTag,
  innerHtml,
  matches,
  plainText,
} from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 範囲の外に置く `html` のコードブロック */
const OUTSIDE = ["```html", "<p>範囲の外</p>", "```", ""].join("\n");

/** 用語 `索引` を持つ索引 */
const TERM_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [{ id: "cur", path: "cur.md", title: "描く文書" }],
  terms: [{ id: "idx", term: "索引", meaning: "文書と用語を並べた YAML" }],
};

/** 範囲の中の `html` のコードブロックと、範囲の外のコードブロックを持つ文書 */
const BASIC = `${wrapHtml("<p>こんにちは</p>")}\n${OUTSIDE}`;

/** 範囲のコードブロックが 1 つでない書き方の警告の文 */
const BLOCK_COUNT_WARNING =
  "<!-- html --> の範囲に html のコードブロックを 1 つだけ置いてください";

// 範囲のコードブロックを HTML として描き、範囲の外はコードのままにする（正常系）
test("test_build_embedded_html", () => {
  // 準備
  const markdown = BASIC;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toMatch(/<div class="mdmark-html">\s*<p>こんにちは<\/p>/);
  expect(matches(html, /<pre[^>]*><code class="language-html">/g)).toHaveLength(
    1,
  );
  expect(html).toContain("&lt;p&gt;範囲の外&lt;/p&gt;");
  expect(html).not.toContain("<!--");
});

// 中の custom element を図の部品にする（正常系）
test("test_build_embedded_html_when_chart", () => {
  // 準備
  const markdown = wrapHtml(
    `<mdmark-chart>\n${INQUIRY_COUNT_TEXT}\n</mdmark-chart>`,
  );
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const embedded = innerHtml(html, 'class="mdmark-html"');
  expect(embedded).toContain('<figure class="mdmark-diagram"');
  expect(findTag(embedded, "<figure")).toContain('data-diagram="chart"');
  expect(html).not.toContain("<mdmark-chart");
  expect(html).not.toContain('"series"');
});

// data-hint に印とツールチップの中身を置き、hints がオフなら外す（正常系）
test("test_build_embedded_html_when_hint", () => {
  // 準備
  const body =
    '<div data-hint="説明">本文</div><p><span data-hint="分類の説明">分類</span></p>';
  const on = wrapHtml(body);
  const off = wrapHtml(body, "<!-- features: -hints -->");
  // 実行
  const { html: withHints } = renderDoc(on);
  const { html: withoutHints } = renderDoc(off);
  // 検証
  const block = findTag(withHints, "mdmark-hint-block");
  expect(block).toContain("<div");
  expect(innerHtml(withHints, "mdmark-hint-block")).toMatch(
    /<button[^>]*mdmark-hint-mark[^>]*>.*<\/button>$/s,
  );
  expect(findTag(withHints, "mdmark-hint-mark")).toContain('aria-label="説明"');
  const inline = findTag(withHints, "mdmark-hint-inline");
  expect(inline).toContain("<span");
  expect(inline).toContain('tabindex="0"');
  expect(withHints).toContain('role="tooltip"');
  expect(withoutHints).toContain("本文");
  expect(withoutHints).not.toContain("data-hint");
  expect(withoutHints).not.toContain("mdmark-hint-");
});

// 中の文字の用語に下線を引く（正常系）
test("test_build_embedded_html_when_terms", () => {
  // 準備
  const markdown = wrapHtml("<p>索引と索引</p>");
  // 実行
  const { html } = renderDoc(markdown, {}, { index: TERM_INDEX, docId: "cur" });
  // 検証
  const embedded = innerHtml(html, 'class="mdmark-html"');
  expect(matches(embedded, /class="mdmark-term-wrap"/g)).toHaveLength(1);
  expect(matches(html, /class="mdmark-term-wrap"/g)).toHaveLength(1);
});

// 範囲のコードブロックが 1 つでないときは書き方の警告を置く（異常系）
test("test_build_embedded_html_when_blocks_count", () => {
  // 準備
  const none = [
    "<!-- html -->",
    "",
    "コードブロックの無い範囲",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
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
  // 実行
  const { html: noneHtml } = renderDoc(none);
  const { html: twoHtml } = renderDoc(two);
  // 検証
  for (const html of [noneHtml, twoHtml]) {
    expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(1);
    expect(plainText(html)).toContain(BLOCK_COUNT_WARNING);
    expect(html).not.toContain("mdmark-html");
  }
  expect(noneHtml).toContain("コードブロックの無い範囲");
  expect(
    matches(twoHtml, /<pre[^>]*><code class="language-html">/g),
  ).toHaveLength(2);
});

// html がオフならコードブロックのままにする（正常系）
test("test_build_embedded_html_when_disabled", () => {
  // 準備
  const markdown = [
    "<!-- features: -html -->",
    "",
    wrapHtml("<p>こんにちは</p>"),
    OUTSIDE,
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /<pre[^>]*><code class="language-html">/g)).toHaveLength(
    2,
  );
  expect(html).not.toContain("mdmark-html");
  expect(html).not.toContain("<!--");
});
