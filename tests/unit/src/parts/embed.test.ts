import { expect, test } from "vitest";

/** 読み込み中のブロックの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEmbed = () => import("../../../../src/parts/embed.ts");

// マーカーの名前と引数を属性に持つ枠を返却する（正常系）
test("test_render_embed", async () => {
  // 準備
  const { renderEmbed } = await loadEmbed();
  // 実行
  const withOptions = renderEmbed({
    name: "chart",
    options: { items: ["a", "b"] },
  });
  const plain = renderEmbed({ name: "chart" });
  // 検証
  expect(withOptions).toBe(
    '<div class="mdmark-embed" data-mdmark-slot="chart" data-mdmark-args="{&quot;items&quot;:[&quot;a&quot;,&quot;b&quot;]}" role="status">図を読み込んでいます</div>',
  );
  expect(plain).toContain('data-mdmark-args="{}"');
});

// 引数をエスケープする（正常系）
test("test_render_embed_when_args_have_quote", async () => {
  // 準備
  const { renderEmbed } = await loadEmbed();
  // 実行
  const html = renderEmbed({ name: "chart", options: { title: `"><script>` } });
  // 検証
  const value = html.match(/data-mdmark-args="([^"]*)"/)?.[1] ?? "";
  expect(value).not.toContain("<");
  expect(value).toContain("&quot;&gt;&lt;script&gt;");
});
