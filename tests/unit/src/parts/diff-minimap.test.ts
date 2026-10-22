import { expect, test } from "vitest";
import { findTag, findTags } from "../../helpers/html.ts";

/** ミニマップの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMinimap = () => import("../../../../src/parts/diff-minimap.ts");

// 部品設計の状態 Top の引数
const TOP = {
  marks: [
    { kind: "del" as const, top: 0.02, height: 0.01 },
    { kind: "add" as const, top: 0.03, height: 0.01 },
    { kind: "del" as const, top: 0.41, height: 0.02 },
    { kind: "add" as const, top: 0.68, height: 0.01 },
    { kind: "del" as const, top: 0.93, height: 0.01 },
    { kind: "add" as const, top: 0.94, height: 0.01 },
  ],
  view: { top: 0, height: 0.18 },
};

// 印と枠を割合の位置に置く（正常系）
test("test_render_diff_minimap", async () => {
  // 準備
  const { renderDiffMinimap } = await loadMinimap();
  // 実行
  const html = renderDiffMinimap(TOP);
  // 検証
  expect(findTag(html, "mdmark-diff-minimap")).toContain('aria-hidden="true"');
  const marks = findTags(html, "mdmark-diff-minimap-mark");
  expect(marks).toHaveLength(6);
  expect(marks[0]).toContain('data-kind="del"');
  expect(marks[0]).toContain("top: 2%");
  expect(marks[1]).toContain('data-kind="add"');
  const view = findTag(html, "mdmark-diff-minimap-view");
  expect(view).toContain("top: 0%");
  expect(view).toContain("height: 18%");
});
