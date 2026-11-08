import { expect, test } from "vitest";
import { findTag, findTags } from "../../helpers/html.ts";

/** 段組みの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLayoutColumns = () =>
  import("../../../../src/parts/layout-columns.ts");

// 列の数を `data-count` に入れる（正常系）
test("test_render_layout_columns", async () => {
  // 準備
  const { renderLayoutColumns } = await loadLayoutColumns();
  // 実行
  const html = renderLayoutColumns({ columns: ["<p>左</p>", "<p>右</p>"] });
  // 検証
  expect(findTag(html, "mdmark-layout-columns")).toBe(
    '<div class="mdmark-layout-columns" data-count="2">',
  );
  expect(findTags(html, '"mdmark-layout-column"')).toHaveLength(2);
  expect(html).toContain("<p>左</p>");
  expect(html).toContain("<p>右</p>");
});
