import { expect, test } from "vitest";
import type { ResolvedConfig } from "../../../../src/config.ts";
import type { RenderEnv } from "../../../../src/render/parser.ts";

/** 解析の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../src/render/parser.ts");

/** 読み込み中の枠の処理を読み込む */
const loadEmbed = () => import("../../../../src/parts/embed.ts");

/** 印を拾う規則を持つ解析器で Markdown を HTML にし、拾った印を入れた環境と一緒に返す */
async function parse(
  markdown: string,
  libraries: ResolvedConfig["libraries"] = {},
): Promise<{ html: string; env: RenderEnv }> {
  const { createParser } = await loadParser();
  const env: RenderEnv = { libraries, featureArgs: [] };
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
  const markdown = "前\n\n<!-- test-lib: a b -->\n\n後\n";
  const libraries = {
    "test-lib": { url: "/fixtures/test-lib.js", figure: true },
  };
  // 実行
  const { html } = await parse(markdown, libraries);
  // 検証
  expect(html).toContain(renderEmbed({ name: "test-lib", args: ["a", "b"] }));
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
