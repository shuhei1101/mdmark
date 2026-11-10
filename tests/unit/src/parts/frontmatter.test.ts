import { expect, test } from "vitest";

/** フロントマターの表示の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFrontmatter = () => import("../../../../src/parts/frontmatter.ts");

// 閉じた折りたたみに中身を入れる（正常系）
test("test_render_frontmatter", async () => {
  // 準備
  const { renderFrontmatter } = await loadFrontmatter();
  // 実行
  const html = renderFrontmatter({ body: "<pre></pre>" });
  // 検証
  expect(html).toBe(
    '<details class="mdmark-collapsible mdmark-frontmatter"><summary>フロントマター</summary><pre></pre></details>',
  );
});
