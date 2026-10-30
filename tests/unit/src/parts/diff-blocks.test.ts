import { expect, test } from "vitest";
import { findTag, innerHtml, outerHtml } from "../../helpers/html.ts";

/** 差分のブロックの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBlocks = () => import("../../../../src/parts/diff-blocks.ts");

// 本文のブロックを包み、記号と読み上げの文字を置く（正常系）
test("test_render_diff_block", async () => {
  // 準備
  const { renderDiffBlock } = await loadBlocks();
  // 実行: 部品設計の状態 AddParagraph の引数
  const html = renderDiffBlock({
    kind: "add",
    unit: "block",
    html: "<p>確認する項目は表のとおりです。</p>",
  });
  // 検証
  const wrapper = findTag(html, "mdmark-diff-block");
  expect(wrapper).toMatch(/^<div\b/);
  expect(wrapper).toContain('data-kind="add"');
  const inner = innerHtml(html, "mdmark-diff-block");
  expect(inner).toContain("追加:");
  expect(outerHtml(inner, 'aria-hidden="true"')).toContain("+");
  expect(inner).toContain("<p>確認する項目は表のとおりです。</p>");
});

// 削除したブロックから行番号と id を外す（正常系）
test("test_render_diff_block_when_deleted", async () => {
  // 準備
  const { renderDiffBlock } = await loadBlocks();
  // 実行: 状態 DelParagraph の引数に、id を持つ見出しを足した html
  const html = renderDiffBlock({
    kind: "del",
    unit: "block",
    html: '<p data-source-line="4">リリースの前日までに、変更履歴の下書きを用意しておきます。</p><h2 data-source-line="6" id="リリースの後">リリースの後</h2>',
  });
  // 検証
  expect(findTag(html, "mdmark-diff-block")).toContain('data-kind="del"');
  expect(html).toContain("削除:");
  expect(html).toContain("−");
  expect(html).not.toContain("data-source-line");
  expect(html).not.toMatch(/\sid=/);
  expect(html).toContain("リリースの後");
});

// 表の行は tr に class を付け、1 つ目のセルに記号を置く（正常系）
test("test_render_diff_block_when_row", async () => {
  // 準備
  const { renderDiffBlock } = await loadBlocks();
  // 実行: 状態 TableRowDel の引数
  const html = renderDiffBlock({
    kind: "del",
    unit: "row",
    html: "<tr><td>配布物</td><td><code>dist/</code> にバージョンが埋まっている</td><td>開発者</td></tr>",
  });
  // 検証
  expect(html).toMatch(/^<tr\b/);
  const row = findTag(html, "mdmark-diff-block");
  expect(row).toMatch(/^<tr\b/);
  expect(row).toContain('data-kind="del"');
  expect(html).not.toContain("<div");
  const firstCell = outerHtml(html, "<td");
  expect(firstCell).toContain("削除:");
  expect(firstCell).toContain("−");
  expect(firstCell).toContain("配布物");
  expect(firstCell.indexOf("削除:")).toBeLessThan(firstCell.indexOf("配布物"));
});
