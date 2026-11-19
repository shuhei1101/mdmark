import { expect, test } from "vitest";

/** 行内の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadInline = () =>
  import("../../../../src/markdown/pure-inline.logic.ts");

/** 番号の表と機能を空にして 1 行を変換する */
async function convert(line: string, numbers = new Map<string, string>()) {
  const { convertPureInline } = await loadInline();
  return convertPureInline({ line, numbers, features: {} });
}

// HTML のコメントと行内のタグを取り除く（正常系）
test("test_convert_pure_inline_comments_and_html", async () => {
  // 実行
  const line = await convert("本文 <!-- メモ --> <span>強調</span>");
  // 検証
  expect(line.trim()).toBe("本文");
  expect(line).not.toContain("<!--");
  expect(line).not.toContain("<span");
});

// バッジの頭を除く（正常系）
test("test_convert_pure_inline_badge", async () => {
  // 実行・検証
  expect(await convert("状態は `badge:完了` です")).toBe("状態は `完了` です");
});

// 番号を出すリンクの文字を番号にする（正常系）
test("test_convert_pure_inline_figure_number", async () => {
  // 実行
  const line = await convert(
    "[](#fig-count)",
    new Map([["fig-count", "表 1"]]),
  );
  // 検証
  expect(line).toBe("[表 1](#fig-count)");
});

// 行内のコードの中は変えない（正常系）
test("test_convert_pure_inline_inside_code", async () => {
  // 実行・検証
  expect(await convert("書き方は `<!-- toc -->` です")).toBe(
    "書き方は `<!-- toc -->` です",
  );
});

// 注記の参照と定義を GFM の脚注にする（正常系）
test("test_convert_pure_inline_annotation", async () => {
  // 実行・検証
  expect(await convert("進む※[cond]。")).toBe("進む[^note-cond]。");
  expect(await convert("※[cond]: 条件を満たさないとき")).toBe(
    "[^note-cond]: 条件を満たさないとき",
  );
});

// GFM の脚注は残し、行内の脚注は括弧にする（正常系）
test("test_convert_pure_inline_footnotes", async () => {
  // 実行・検証
  expect(await convert("本文[^1] と補足^[例]")).toBe("本文[^1] と補足（例）");
});

// 画像の属性を取り除く（正常系）
test("test_convert_pure_inline_image_attributes", async () => {
  // 実行・検証
  expect(
    await convert('![グラフ](chart.png "売上"){width=300 align=center}'),
  ).toBe('![グラフ](chart.png "売上")');
});
