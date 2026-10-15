import { expect, test } from "vitest";

/** ファイルツリーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTree = () => import("../../../../src/parts/tree.ts");

// フォルダとファイルを分け、名前をエスケープする（正常系）
test("test_render_tree", async () => {
  // 準備
  const { renderTree } = await loadTree();
  // 実行
  const html = renderTree({
    nodes: [{ name: "src/", children: [{ name: "a<b>.ts" }] }],
  });
  // 検証
  expect(html.startsWith('<ul class="mdmark-tree"')).toBe(true);
  expect(html).toContain(
    '<li class="mdmark-tree-folder"><span class="mdmark-tree-name">src/</span>',
  );
  expect(html).toContain(
    '<li class="mdmark-tree-file"><span class="mdmark-tree-name">a&lt;b&gt;.ts</span>',
  );
});
