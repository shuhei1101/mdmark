import { expect, test } from "vitest";

/** アイコンの形状の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadIconNode = () => import("../../../../src/shared/icon-node.logic.ts");

// 許す要素と属性だけを残す（正常系）
test("test_icon_node_svg", async () => {
  // 準備
  const { iconNodeSvg } = await loadIconNode();
  // 実行
  const svg = iconNodeSvg([
    ["path", { d: "M1 1" }],
    ["script", {}],
    ["circle", { cx: "1", onclick: "x" }],
  ]);
  // 検証
  expect(svg.startsWith('<svg class="mdmark-icon"')).toBe(true);
  expect(svg).toContain('<path d="M1 1"></path>');
  expect(svg).toContain('<circle cx="1"></circle>');
  expect(svg).not.toContain("script");
  expect(svg).not.toContain("onclick");
});
