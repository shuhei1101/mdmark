import { expect, test } from "vitest";

/** 折り畳みの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCollapsible = () => import("../../../../src/parts/collapsible.ts");

// 閉じた折り畳みに中身を入れ、見出しをエスケープする（正常系）
test("test_render_collapsible", async () => {
  // 準備
  const { renderCollapsible } = await loadCollapsible();
  // 実行
  const html = renderCollapsible({
    title: "a<b",
    open: false,
    body: "<ol></ol>",
  });
  // 検証
  expect(html).toBe(
    '<details class="mdmark-collapsible"><summary>a&lt;b</summary><ol></ol></details>',
  );
});

// 開いた折り畳みは open を持つ（正常系）
test("test_render_collapsible_when_open", async () => {
  // 準備
  const { renderCollapsible } = await loadCollapsible();
  // 実行
  const html = renderCollapsible({ title: "準備", open: true, body: "" });
  // 検証
  expect(
    html.startsWith(
      '<details class="mdmark-collapsible" open><summary>準備</summary>',
    ),
  ).toBe(true);
});

// 加える class を mdmark-collapsible の後ろに付ける（正常系）
test("test_render_collapsible_when_class_name", async () => {
  // 準備
  const { renderCollapsible } = await loadCollapsible();
  // 実行
  const html = renderCollapsible({
    title: "フロントマター",
    open: false,
    body: "<pre></pre>",
    className: "mdmark-frontmatter",
  });
  // 検証
  expect(html).toBe(
    '<details class="mdmark-collapsible mdmark-frontmatter"><summary>フロントマター</summary><pre></pre></details>',
  );
});
