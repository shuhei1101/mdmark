import MarkdownIt from "markdown-it";
import { expect, test } from "vitest";
import type { MdmarkAlias } from "../../../../../src/knowledge/aliases.ts";
import type { MdmarkIndex } from "../../../../../src/knowledge/index-shape.ts";
import { INQUIRY_COUNT_TEXT, wrapHtml } from "../../../helpers/charts.ts";
import { STRENGTH_TEXT } from "../../../helpers/diagrams.ts";
import { createEnv } from "../../../helpers/env.ts";
import {
  findTag,
  innerHtml,
  matches,
  plainText,
} from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 解析の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../../src/render/parser.ts");

/** 範囲の外に配置する `html` のコードブロック */
const OUTSIDE = ["```html", "<p>範囲の外</p>", "```", ""].join("\n");

/** 用語 `索引` を持つ索引 */
const TERM_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [{ id: "cur", path: "cur.md", title: "描く文書" }],
  terms: [{ id: "idx", term: "索引", meaning: "文書と用語を並べた YAML" }],
};

/** 範囲の中の `html` のコードブロックと、範囲の外のコードブロックを持つ文書 */
const BASIC = `${wrapHtml("<p>こんにちは</p>")}\n${OUTSIDE}`;

/** 範囲のコードブロックが 1 つでない記載の警告の文 */
const BLOCK_COUNT_WARNING =
  "<!-- html --> の範囲に html のコードブロックを 1 つだけ配置してください";

// 範囲のコードブロックを HTML として描き、範囲の外はコードのままにする（正常系）
test("test_build_embedded_html", () => {
  // 準備
  const markdown = BASIC;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toMatch(/<div class="mdmark-html">\s*<p>こんにちは<\/p>/);
  expect(
    matches(html, /<pre[^>]*><code class="language-html"[^>]*>/g),
  ).toHaveLength(1);
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

// data-hint にマーカーとツールチップの中身を配置し、hints がオフなら削除する（正常系）
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

// 中の文字の用語に下線を付ける（正常系）
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

// 中の文字のエイリアスに下線を付け、種類のツールチップを配置する（正常系）
test("test_build_embedded_html_when_alias", () => {
  // 準備
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "url",
      id: "issues",
      name: "課題の一覧",
      aliases: [],
      description: "Issue を並べたページ",
      url: "https://github.com/shuhei1101/mdmark/issues",
    },
  ];
  const markdown = wrapHtml("<p>課題の一覧と課題の一覧</p>");
  // 実行
  const { html } = renderDoc(markdown, {}, { aliases });
  // 検証
  // 範囲ごとに単語の最初の 1 回だけで、ツールチップのリンクが URL を指す
  const embedded = innerHtml(html, 'class="mdmark-html"');
  expect(matches(embedded, /class="mdmark-term-wrap"/g)).toHaveLength(1);
  expect(findTag(embedded, 'class="mdmark-term-tip-link"')).toContain(
    'href="https://github.com/shuhei1101/mdmark/issues"',
  );
});

// 中の文字のやめた言い方にマーカーを付ける（正常系）
test("test_build_embedded_html_when_avoided_term", () => {
  // 準備
  const index: MdmarkIndex = {
    schema: 2,
    docs: [{ id: "cur", path: "cur.md", title: "描く文書" }],
    terms: [
      {
        id: "ws",
        term: "ワークスペース",
        meaning: "話し合いの記録を配置するフォルダ",
        avoid: ["作業場"],
      },
    ],
  };
  const markdown = wrapHtml("<p>作業場と作業場</p>");
  // 実行
  const { html } = renderDoc(markdown, {}, { index, docId: "cur" });
  // 検証
  const embedded = innerHtml(html, 'class="mdmark-html"');
  expect(
    matches(embedded, /class="mdmark-term mdmark-term-avoided"/g),
  ).toHaveLength(1);
});

// 範囲のコードブロックが 1 つでないときは記載の警告を配置する（異常系）
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
    matches(twoHtml, /<pre[^>]*><code class="language-html"[^>]*>/g),
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
  expect(
    matches(html, /<pre[^>]*><code class="language-html"[^>]*>/g),
  ).toHaveLength(2);
  expect(html).not.toContain("mdmark-html");
  expect(html).not.toContain("<!--");
});

// 中の操作できる部品のボタンを `env.labels.paramCopy` の文言で描く（正常系）
test("test_build_embedded_html_when_param_copy_label", async () => {
  // 準備
  const { createParser } = await loadParser();
  const markdown = wrapHtml(
    `<mdmark-param>\n${STRENGTH_TEXT}\n</mdmark-param>`,
  );
  const env = createEnv({ labels: { paramCopy: "コピー" } });
  // 実行
  const html = createParser().render(markdown, env);
  // 検証
  const embedded = innerHtml(html, 'class="mdmark-html"');
  expect(plainText(innerHtml(embedded, "mdmark-param-copy"))).toBe("コピー");
});

/** 範囲に `html`・`css`・`ts` のコードブロックを 1 つずつ配置した文書 */
const RANGE_SCRIPTS = [
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">ノード</div>',
  "```",
  "",
  "```css",
  ".box { color: red }",
  "```",
  "",
  "```ts",
  'export default (root: HTMLElement) => root.classList.add("is-open");',
  "```",
  "",
  "<!-- /html -->",
  "",
].join("\n");

/** 範囲の css を根の要素の中に限る処理を読み込む */
const loadScopeCss = () => import("../../../../../src/render/scope-css.ts");

/** 埋め込んだ HTML の処理を読み込む */
const loadHtml = () => import("../../../../../src/render/syntax/html.ts");

/** コードブロックを並べた Markdown を記法のルールを経由せずに解析し、`fence` のトークンを返却する */
function fenceTokens(languages: string[]) {
  const markdown = languages
    .map((lang) => [`\`\`\`${lang}`, `${lang} の中身`, "```", ""].join("\n"))
    .join("\n");
  return new MarkdownIt()
    .parse(markdown, {})
    .filter((token) => token.type === "fence");
}

// `html-scripts` がオンのとき、`css` を根の要素に限った `style` にし、`ts` を `template` に入れる（正常系）
test("test_build_embedded_html_when_range_scripts", async () => {
  // 準備
  const { scopeCss } = await loadScopeCss();
  // 実行
  const { html } = renderDoc(RANGE_SCRIPTS, { "html-scripts": true });
  // 検証
  const root = findTag(html, 'class="mdmark-html"');
  expect(root).toContain('data-html-scope="0"');
  const embedded = innerHtml(html, 'class="mdmark-html"');
  expect(
    embedded.trimStart().startsWith('<style class="mdmark-html-style"'),
  ).toBe(true);
  expect(innerHtml(embedded, "mdmark-html-style")).toBe(
    scopeCss({ css: ".box { color: red }\n", scope: 0 }),
  );
  const template = findTag(embedded, "mdmark-html-script");
  expect(template.startsWith("<template")).toBe(true);
  expect(template).toContain('data-lang="ts"');
  expect(embedded.trimEnd().endsWith("</template>")).toBe(true);
  expect(html).not.toContain("<pre");
});

// `html-scripts` がオフのとき、`css`・`ts` をコードのまま残す（正常系）
test("test_build_embedded_html_when_range_scripts_off", () => {
  // 準備
  const markdown = RANGE_SCRIPTS;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const embedded = innerHtml(html, 'class="mdmark-html"');
  expect(embedded).not.toContain("<style");
  expect(embedded).not.toContain("<template");
  const after = html.slice(html.indexOf(embedded) + embedded.length);
  expect(after).toMatch(/<pre[^>]*><code class="language-css"/);
  expect(after).toMatch(/<pre[^>]*><code class="language-ts"/);
});

// `html`・`css`・`ts` を 1 つずつ読み込む（正常系）
test("test_read_range_scripts", async () => {
  // 準備
  const { readRangeScripts } = await loadHtml();
  const tokens = fenceTokens(["html", "css", "ts"]);
  // 実行
  const read = readRangeScripts(tokens);
  // 検証
  expect(read.html).toBe(tokens[0]);
  expect(read.css).toBe("css の中身\n");
  expect(read.script).toEqual({ lang: "ts", code: "ts の中身\n" });
  expect(read.warnings).toEqual([]);
});

// `ts` と `js` を両方持つ範囲は警告を返却し `script` を返却しない（異常系）
test("test_read_range_scripts_when_both_languages", async () => {
  // 準備
  const { readRangeScripts } = await loadHtml();
  const tokens = fenceTokens(["html", "ts", "js"]);
  // 実行
  const read = readRangeScripts(tokens);
  // 検証
  expect(read.script).toBeUndefined();
  expect(read.warnings).toHaveLength(1);
});

// 同じ言語を 2 つ持つ範囲は警告を返却する（異常系）
test("test_read_range_scripts_when_duplicate", async () => {
  // 準備
  const { readRangeScripts } = await loadHtml();
  const tokens = fenceTokens(["html", "css", "css"]);
  // 実行
  const read = readRangeScripts(tokens);
  // 検証
  expect(read.warnings).toHaveLength(1);
});
