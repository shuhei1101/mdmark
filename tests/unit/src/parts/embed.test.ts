import { expect, test } from "vitest";

/** 読み込み中の枠の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEmbed = () => import("../../../../src/parts/embed.ts");

// 印の名前と引数を属性に持つ枠を返す（正常系）
test("test_render_embed", async () => {
  // 準備
  const { renderEmbed } = await loadEmbed();
  // 実行
  const html = renderEmbed({ name: "chart", args: ["a", "b"] });
  // 検証
  expect(html).toBe(
    '<div class="mdmark-embed" data-mdmark-slot="chart" data-mdmark-args="a b" role="status">図を読み込んでいます</div>',
  );
});

// 引数をエスケープする（正常系）
test("test_render_embed_when_args_have_quote", async () => {
  // 準備
  const { renderEmbed } = await loadEmbed();
  // 実行
  const html = renderEmbed({ name: "chart", args: [`"><script>`] });
  // 検証
  expect(html).toContain('data-mdmark-args="&quot;&gt;&lt;script&gt;"');
});
