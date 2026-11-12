import MarkdownIt from "markdown-it";
import { expect, test } from "vitest";
import type { ResolvedConfig } from "../../../../src/config.ts";
import type { RenderEnv } from "../../../../src/render/parser.ts";
import { createEnv } from "../../helpers/env.ts";
import { stripSourceLine } from "../../helpers/source-line.ts";

/** 解析の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../src/render/parser.ts");

/** マーカーの処理を読み込む */
const loadMarks = () => import("../../../../src/render/marks.ts");

/** 読み込み中のブロックの処理を読み込む */
const loadEmbed = () => import("../../../../src/parts/embed.ts");

/** mdmark が出した要素のマーカーの処理を読み込む */
const loadOwn = () => import("../../../../src/parts/own.ts");

/** 拡張の処理を読み込む */
const loadExtensions = () => import("../../../../src/extensions.ts");

/** 機能を重ねた設定で文書を描く助け */
const loadRenderHelper = () => import("../../helpers/render.ts");

/** マーカーを取得する規則を持つ解析器で Markdown を HTML にし、取得したマーカーを入れた環境と一緒に返却する */
async function parse(
  markdown: string,
  libraries: ResolvedConfig["libraries"] = {},
): Promise<{ html: string; env: RenderEnv }> {
  const { createParser } = await loadParser();
  const env = createEnv({ libraries });
  const html = stripSourceLine(createParser().render(markdown, env));
  return { html, env };
}

// 機能のマーカーの JSON のオブジェクトを記載した順に取得し、本文から取り除く（正常系）
test("test_take_marks", async () => {
  // 準備
  const markdown =
    '<!-- features: {"a": true, "b": false} -->\n\n段落 <!-- features: {"c": true} --> の続き\n';
  // 実行
  const { html, env } = await parse(markdown);
  // 検証
  expect(env.featureOptions).toEqual([{ a: true, b: false }, { c: true }]);
  expect(html).not.toContain("<!--");
});

// 対応表にあるマーカーをマーカーの場所の要素にする（正常系）
test("test_take_marks_when_library_mark", async () => {
  // 準備
  const { renderEmbed } = await loadEmbed();
  const { markOwn } = await loadOwn();
  const markdown = '前\n\n<!-- test-lib: {"items": ["a", "b"]} -->\n\n後\n';
  const libraries = {
    "test-lib": { url: "/fixtures/test-lib.js", figure: true },
  };
  // 実行
  const { html, env } = await parse(markdown, libraries);
  // 検証
  expect(html).toContain(
    markOwn(
      renderEmbed({ name: "test-lib", options: { items: ["a", "b"] } }),
      env.nonce,
    ),
  );
});

// 今の書き方の対応表と拡張のマーカーを、マーカーの場所の要素にせず記載の警告にする（異常系）
test("test_take_marks_when_legacy_embed", async () => {
  // 準備
  const { registerExtension, resetExtensions } = await loadExtensions();
  resetExtensions();
  registerExtension({
    name: "greet",
    directive: "greet",
    load: async () => ({ draw: () => {} }),
  });
  const markdown = "<!-- test-lib: a b -->\n\n<!-- greet: world -->\n";
  const libraries = {
    "test-lib": { url: "/fixtures/test-lib.js", figure: true },
  };
  try {
    // 実行
    const { html } = await parse(markdown, libraries);
    // 検証
    expect(html).not.toContain("mdmark-embed");
    const warnings = html.match(/mdmark-syntax-warning"/g) ?? [];
    expect(warnings).toHaveLength(2);
    expect(html).toContain("JSON のオブジェクトで記載");
    expect(html).toContain("mdmark upgrade");
  } finally {
    resetExtensions();
  }
});

// 未知のマーカーを取り除き、マーカーでないコメントとコードの中はそのままにする（正常系）
test("test_take_marks_when_unknown_mark", async () => {
  // 準備
  const markdown = [
    '<!-- unknown: {"size": 1} -->',
    "",
    "<!-- ただのコメント -->",
    "",
    "```md",
    '<!-- features: {"print": false} -->',
    "```",
    "",
  ].join("\n");
  // 実行
  const { html, env } = await parse(markdown);
  // 検証
  expect(html).not.toContain("unknown");
  expect(html).toContain("<!-- ただのコメント -->");
  expect(html).toContain("&lt;!-- features: {&quot;print&quot;: false} --&gt;");
  expect(env.featureOptions).toEqual([]);
});

// 記法のマーカーと閉じのマーカー、コロンの無いマーカーをマーカーのトークンにする（正常系）
test("test_take_marks_when_syntax_mark", async () => {
  // 準備
  const { takeMarks } = await loadMarks();
  const parser = new MarkdownIt({ html: true });
  parser.core.ruler.push("take_marks", takeMarks);
  const markdown =
    '<!-- table: {"kind": "data"} -->\n<!-- /table -->\n<!-- tabs -->\n';
  // 実行
  const tokens = parser.parse(markdown, createEnv());
  // 検証
  const marks = tokens.filter((token) => token.type === "mdmark_mark");
  expect(marks.map((token) => token.meta)).toMatchObject([
    {
      name: "table",
      closing: false,
      options: { kind: "data" },
      source: "json",
    },
    { name: "table", closing: true },
    { name: "tabs", options: {}, source: "none" },
  ]);
});

// 今の書き方の記法のマーカーを、同じ JSON のオブジェクトにしたマーカーのトークンにする（正常系）
test("test_take_marks_when_legacy_syntax_mark", async () => {
  // 準備
  const { takeMarks } = await loadMarks();
  const { renderDoc } = await loadRenderHelper();
  const markdown = "<!-- table: data +total total=数量:sum closed -->\n";
  // マーカーのトークンは最後のコアルールが取り除くため、マーカーを取得するルールだけで解析する
  const parser = new MarkdownIt({ html: true });
  parser.core.ruler.push("take_marks", takeMarks);
  // 実行
  const tokens = parser.parse(markdown, createEnv());
  const { html } = renderDoc(markdown);
  // 検証
  const marks = tokens.filter((token) => token.type === "mdmark_mark");
  expect(marks.map((token) => token.meta)).toMatchObject([
    {
      name: "table",
      source: "legacy",
      options: {
        kind: "data",
        columns: { 数量: { total: [{ calc: "sum" }] } },
        collapse: { open: false },
      },
    },
  ]);
  expect(html).not.toContain("mdmark-syntax-warning");
});

// JSON として読めない引数と型の合わない値を記載の警告にし、知らないキーを空のトークンにする（異常系）
test("test_take_marks_when_invalid_options", async () => {
  // 準備
  const { renderDoc } = await loadRenderHelper();
  const { takeMarks } = await loadMarks();
  const markdown = [
    '<!-- details: {"title": 補足} -->',
    "",
    "中身",
    "",
    "<!-- /details -->",
    "",
    '<!-- section: {"open": "no", "size": 1} -->',
    "",
  ].join("\n");
  const parser = new MarkdownIt({ html: true });
  parser.core.ruler.push("take_marks", takeMarks);
  // 実行
  const rendered = renderDoc(markdown);
  const tokens = parser.parse(markdown, createEnv());
  // 検証
  const shown = rendered.warnings.filter(
    (warning) => warning.kind === "syntax_warning",
  );
  expect(shown.map((warning) => warning.line)).toEqual([1, 7]);
  expect(shown[0]?.message).toMatch(/\d+ 文字目/);
  expect(shown[1]?.message).toContain("open");
  const unknown = rendered.warnings.filter(
    (warning) => warning.kind === "unknown_mark_arg",
  );
  expect(unknown).toHaveLength(1);
  expect(unknown[0]?.message).toContain("size");
  const section = tokens.find(
    (token) =>
      token.type === "mdmark_mark" &&
      (token.meta as { name?: string }).name === "section",
  );
  const meta = section?.meta as { options?: unknown } | undefined;
  expect(meta?.options).toEqual({});
});

// 登録した拡張のマーカーをマーカーの場所の要素にする（正常系）
test("test_take_marks_when_extension_mark", async () => {
  // 準備
  const { registerExtension, resetExtensions } = await loadExtensions();
  const { renderEmbed } = await loadEmbed();
  const { markOwn } = await loadOwn();
  resetExtensions();
  registerExtension({
    name: "greet",
    directive: "greet",
    load: async () => ({ draw: () => {} }),
  });
  const markdown = '<!-- greet: {"target": "world", "lang": "ja"} -->\n';
  try {
    // 実行
    const { html, env } = await parse(markdown);
    // 検証
    expect(html).toContain(
      markOwn(
        renderEmbed({
          name: "greet",
          options: { target: "world", lang: "ja" },
        }),
        env.nonce,
      ),
    );
  } finally {
    resetExtensions();
  }
});

// 種類・機能・キー・開閉を判別しる（正常系）
test("test_parse_mark_args", async () => {
  // 準備
  const { parseMarkArgs } = await loadMarks();
  // 実行
  const args = parseMarkArgs("data +sort -pin filter=名前:text closed");
  // 検証
  expect(args).toEqual({
    args: ["data", "+sort", "-pin", "closed"],
    keys: { filter: "名前:text" },
  });
});

// 引数が無ければ空にする（正常系）
test("test_parse_mark_args_when_empty", async () => {
  // 準備
  const { parseMarkArgs } = await loadMarks();
  // 実行
  const args = parseMarkArgs("");
  // 検証
  expect(args).toEqual({ args: [], keys: {} });
});

// オフの記法のマーカーを取り除き、囲んだ Markdown は残す（正常系）
test("test_drop_marks", async () => {
  // 準備
  const { createParser } = await loadParser();
  const markdown =
    '<!-- features: {"tabs": false} -->\n\n<!-- tabs -->\n\n段落\n\n<!-- /tabs -->\n';
  const env = createEnv();
  const parser = createParser();
  // 実行
  const html = stripSourceLine(parser.render(markdown, env));
  const tokens = parser.parse(markdown, createEnv());
  // 検証
  expect(html).toContain("段落");
  expect(html).not.toContain("<!--");
  expect(tokens.some((token) => token.type === "mdmark_mark")).toBe(false);
});

// 範囲で記載した拡張のマーカーは、マーカーの場所の要素だけを出して範囲の中身と定義の JSON を残さない（正常系）
test("test_take_marks_when_extension_range", async () => {
  // 準備
  const { registerExtension, resetExtensions } = await loadExtensions();
  resetExtensions();
  registerExtension({
    name: "greet",
    directive: "greet",
    load: async () => ({ draw: () => {} }),
  });
  const markdown = [
    "前",
    "",
    "<!-- greet -->",
    "",
    "```json",
    '{"title": "段取り", "items": ["a"]}',
    "```",
    "",
    "<!-- /greet -->",
    "",
    "後",
    "",
  ].join("\n");
  try {
    // 実行
    const { html } = await parse(markdown);
    // 検証
    expect(html).toContain('data-mdmark-slot="greet"');
    expect(html).not.toContain("段取り");
    expect(html).not.toContain("items");
    expect(html).toContain("<p>前</p>");
    expect(html).toContain("<p>後</p>");
  } finally {
    resetExtensions();
  }
});

// 登録していないマーカーの範囲のうち、中身が json のコードブロックだけのものは中身ごと取り除く（正常系）
test("test_take_marks_when_unknown_range_with_json", async () => {
  // 準備
  const markdown = [
    "前",
    "",
    "<!-- unknown -->",
    "",
    "```json",
    '{"title": "消える"}',
    "```",
    "",
    "<!-- /unknown -->",
    "",
    "後",
    "",
  ].join("\n");
  // 実行
  const { html } = await parse(markdown);
  // 検証
  expect(html).not.toContain("消える");
  expect(html).not.toContain("language-json");
  expect(html).toContain("<p>前</p>");
  expect(html).toContain("<p>後</p>");
});

// 先頭のマーカーを読み込み、本文にマーカーを残さない（正常系）
test("test_resolve_page_settings", async () => {
  // 準備
  const { renderDoc } = await loadRenderHelper();
  const markdown = [
    '<!-- features: {"toc": false} -->',
    '<!-- page: {"scheme": "dark"} -->',
    "",
    "段落",
  ].join("\n");
  // 実行
  const rendered = renderDoc(markdown);
  // 検証
  expect(rendered.page).toEqual({ scheme: "dark" });
  expect(rendered.html).not.toContain("page:");
  expect(rendered.html).not.toContain("mdmark-syntax-warning");
  expect(rendered.warnings).toEqual([]);
});

// 先頭に無いマーカーは読み込まずに警告を配置する（異常系）
test("test_resolve_page_settings_when_not_at_top", async () => {
  // 準備
  const { renderDoc } = await loadRenderHelper();
  const markdown = ["段落", "", '<!-- page: {"scheme": "dark"} -->', ""].join(
    "\n",
  );
  // 実行
  const rendered = renderDoc(markdown);
  // 検証
  expect(rendered.page).toEqual({});
  expect(rendered.warnings).toHaveLength(1);
  expect(rendered.warnings[0]?.message).toContain("先頭");
  expect(rendered.html).toContain("mdmark-syntax-warning");
});

// 選べる値に無い値を文書の先頭の警告にまとめ、知らないキーを無視する（異常系）
test("test_resolve_page_settings_when_unknown", async () => {
  // 準備
  const { renderDoc } = await loadRenderHelper();
  const mark =
    '<!-- page: {"scheme": "sepia", "size": "wide", "toc": {"mode": "fixed"}} -->';
  const markdown = [mark, "", "段落"].join("\n");
  // 実行
  const rendered = renderDoc(markdown);
  // 検証
  expect(rendered.page).toEqual({ toc: "fixed" });
  const shown = rendered.warnings.filter(
    (warning) => warning.kind === "syntax_warning",
  );
  expect(shown).toHaveLength(1);
  // 本文の頭はマーカーの文字のため、マーカーの後ろの文だけを確認する
  const listed = (shown[0]?.message ?? "").replace(mark, "");
  expect(listed).toContain("scheme");
  expect(listed).toContain("sepia");
  expect(listed).not.toContain("size");
  const unknown = rendered.warnings.filter(
    (warning) => warning.kind === "unknown_mark_arg",
  );
  expect(unknown).toHaveLength(1);
  expect(unknown[0]?.message).toContain("size");
  expect(rendered.html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    rendered.html.indexOf("段落"),
  );
});
