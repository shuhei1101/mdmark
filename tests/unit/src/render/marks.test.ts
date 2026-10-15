import MarkdownIt from "markdown-it";
import { expect, test } from "vitest";
import type { ResolvedConfig } from "../../../../src/config.ts";
import type { RenderEnv } from "../../../../src/render/parser.ts";
import { createEnv } from "../../helpers/env.ts";

/** 解析の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../src/render/parser.ts");

/** 印の処理を読み込む */
const loadMarks = () => import("../../../../src/render/marks.ts");

/** 読み込み中の枠の処理を読み込む */
const loadEmbed = () => import("../../../../src/parts/embed.ts");

/** mdmark が出した要素の印の処理を読み込む */
const loadOwn = () => import("../../../../src/parts/own.ts");

/** 拡張の処理を読み込む */
const loadExtensions = () => import("../../../../src/extensions.ts");

/** 印を拾う規則を持つ解析器で Markdown を HTML にし、拾った印を入れた環境と一緒に返す */
async function parse(
  markdown: string,
  libraries: ResolvedConfig["libraries"] = {},
): Promise<{ html: string; env: RenderEnv }> {
  const { createParser } = await loadParser();
  const env = createEnv({ libraries });
  const html = createParser().render(markdown, env);
  return { html, env };
}

// 機能の印の引数を書いた順に拾い、本文から取り除く（正常系）
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

// 対応表にある印を印の場所の要素にする（正常系）
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

// 未知の印を取り除き、印でないコメントとコードの中はそのままにする（正常系）
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

// 記法の印と閉じの印、コロンの無い印を印のトークンにする（正常系）
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

// 登録した拡張の印を印の場所の要素にする（正常系）
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

// 種類・機能・キー・開閉を読み分ける（正常系）
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

// オフの記法の印を取り除き、囲んだ Markdown は残す（正常系）
test("test_drop_marks", async () => {
  // 準備
  const { createParser } = await loadParser();
  const markdown =
    "<!-- features: -tabs -->\n\n<!-- tabs -->\n\n段落\n\n<!-- /tabs -->\n";
  const env = createEnv();
  const parser = createParser();
  // 実行
  const html = parser.render(markdown, env);
  const tokens = parser.parse(markdown, createEnv());
  // 検証
  expect(html).toContain("段落");
  expect(html).not.toContain("<!--");
  expect(tokens.some((token) => token.type === "mdmark_mark")).toBe(false);
});
