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

// 機能のマーカーの引数を記載した順に取得し、本文から取り除く（正常系）
test("test_take_marks", async () => {
  // 準備
  const markdown =
    "<!-- features: +a -b -->\n\n段落 <!-- features: +c --> の続き\n";
  // 実行
  const { html, env } = await parse(markdown);
  // 検証
  expect(env.featureArgs).toEqual(["+a", "-b", "+c"]);
  expect(html).not.toContain("<!--");
});

// 対応表にあるマーカーをマーカーの場所の要素にする（正常系）
test("test_take_marks_when_library_mark", async () => {
  // 準備
  const { renderEmbed } = await loadEmbed();
  const { markOwn } = await loadOwn();
  const markdown = "前\n\n<!-- test-lib: a b -->\n\n後\n";
  const libraries = {
    "test-lib": { url: "/fixtures/test-lib.js", figure: true },
  };
  // 実行
  const { html, env } = await parse(markdown, libraries);
  // 検証
  expect(html).toContain(
    markOwn(renderEmbed({ name: "test-lib", args: ["a", "b"] }), env.nonce),
  );
});

// 未知のマーカーを取り除き、マーカーでないコメントとコードの中はそのままにする（正常系）
test("test_take_marks_when_unknown_mark", async () => {
  // 準備
  const markdown = [
    "<!-- unknown: 1 -->",
    "",
    "<!-- ただのコメント -->",
    "",
    "```md",
    "<!-- features: -print -->",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html, env } = await parse(markdown);
  // 検証
  expect(html).not.toContain("unknown");
  expect(html).toContain("<!-- ただのコメント -->");
  expect(html).toContain("&lt;!-- features: -print --&gt;");
  expect(env.featureArgs).toEqual([]);
});

// 記法のマーカーと閉じのマーカー、コロンの無いマーカーをマーカーのトークンにする（正常系）
test("test_take_marks_when_syntax_mark", async () => {
  // 準備
  const { takeMarks } = await loadMarks();
  const parser = new MarkdownIt({ html: true });
  parser.core.ruler.push("take_marks", takeMarks);
  const markdown = "<!-- table: data -->\n<!-- /table -->\n<!-- tabs -->\n";
  // 実行
  const tokens = parser.parse(markdown, createEnv());
  // 検証
  const marks = tokens.filter((token) => token.type === "mdmark_mark");
  expect(marks.map((token) => token.meta)).toMatchObject([
    { name: "table", closing: false },
    { name: "table", closing: true },
    { name: "tabs", args: { args: [], keys: {} } },
  ]);
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
  const markdown = "<!-- greet: world lang=ja -->\n";
  try {
    // 実行
    const { html, env } = await parse(markdown);
    // 検証
    expect(html).toContain(
      markOwn(
        renderEmbed({ name: "greet", args: ["world", "lang=ja"] }),
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
    "<!-- features: -tabs -->\n\n<!-- tabs -->\n\n段落\n\n<!-- /tabs -->\n";
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

/** 機能を重ねた設定で文書を描く助け */
const loadRenderHelper = () => import("../../helpers/render.ts");

// 先頭のマーカーを読み込み、本文にマーカーを残さない（正常系）
test("test_resolve_page_settings", async () => {
  // 準備
  const { renderDoc } = await loadRenderHelper();
  const markdown = [
    "<!-- features: -toc -->",
    "<!-- page: scheme=dark -->",
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
  const markdown = ["段落", "", "<!-- page: scheme=dark -->", ""].join("\n");
  // 実行
  const rendered = renderDoc(markdown);
  // 検証
  expect(rendered.page).toEqual({});
  expect(rendered.warnings).toHaveLength(1);
  expect(rendered.warnings[0]?.message).toContain("先頭");
  expect(rendered.html).toContain("mdmark-syntax-warning");
});

// 知らない値を文書の先頭の警告にまとめ、知らないキーをスキップする（異常系）
test("test_resolve_page_settings_when_unknown", async () => {
  // 準備
  const { renderDoc } = await loadRenderHelper();
  const markdown = [
    "<!-- page: scheme=sepia size=wide toc=fixed -->",
    "",
    "段落",
  ].join("\n");
  // 実行
  const rendered = renderDoc(markdown);
  // 検証
  expect(rendered.page).toEqual({ toc: "fixed" });
  const shown = rendered.warnings.filter(
    (warning) => warning.kind === "syntax_warning",
  );
  expect(shown).toHaveLength(1);
  expect(shown[0]?.message).toContain("scheme=sepia");
  // 本文の頭はマーカーの文字のため、マーカーの後ろの挙げた指定だけを確認する
  const listed = (shown[0]?.message ?? "").replace(
    "<!-- page: scheme=sepia size=wide toc=fixed -->",
    "",
  );
  expect(listed).not.toContain("size=wide");
  const skipped = rendered.warnings.filter(
    (warning) => warning.kind === "unknown_mark_arg",
  );
  expect(skipped).toHaveLength(1);
  expect(skipped[0]?.message).toContain("size=");
  expect(rendered.html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    rendered.html.indexOf("段落"),
  );
});
