import { expect, test } from "vitest";

/** 行の詳細の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRowDetail = () => import("../../../../src/parts/row-detail.ts");

// 閉じた詳細の行とボタンを返す（正常系）
test("test_render_row_detail", async () => {
  // 準備
  const { renderRowDetail } = await loadRowDetail();
  // 実行
  const { row, toggle } = renderRowDetail({
    id: "r1",
    row: 1,
    columns: 3,
    label: "table",
    body: "<p>詳細</p>",
  });
  // 検証
  expect(row).toMatch(
    /^<tr class="mdmark-row-detail" data-row="1"[^>]*\shidden[^>]*><td colspan="3">/,
  );
  expect(toggle).toContain('aria-expanded="false"');
  expect(toggle).toContain('aria-label="「table」の詳細"');
});

// 畳んだ最終列を詳細の中身の上に置く（正常系）
test("test_render_row_detail_when_folded_column", async () => {
  // 準備
  const { renderRowDetail } = await loadRowDetail();
  // 実行
  const { row } = renderRowDetail({
    id: "r1",
    row: 1,
    columns: 3,
    label: "table",
    foldedColumn: { name: "説明", html: "描画を速くする" },
    body: "<p>詳細</p>",
  });
  // 検証
  const part = row.indexOf("mdmark-fold-part");
  expect(part).toBeGreaterThanOrEqual(0);
  expect(row.slice(part)).toContain('<p class="mdmark-fold-name">説明</p>');
  expect(part).toBeLessThan(row.indexOf("<p>詳細</p>"));
});
