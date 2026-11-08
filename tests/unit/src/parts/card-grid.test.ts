import { expect, test } from "vitest";
import { findTag, findTags } from "../../helpers/html.ts";

/** カードの格子の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCardGrid = () => import("../../../../src/parts/card-grid.ts");

// リンクの有無でカードの要素を分ける（正常系）
test("test_render_card_grid", async () => {
  // 準備
  const { renderCardGrid } = await loadCardGrid();
  // 実行
  const html = renderCardGrid({
    items: [
      {
        title: "使用方法",
        href: "a.md",
        icon: "book",
        description: "導入の手順",
      },
      { title: "準備中" },
    ],
  });
  // 検証
  expect(findTag(html, "<ul")).toBe('<ul class="mdmark-card-grid">');
  expect(findTags(html, "<li")).toHaveLength(2);
  expect(findTag(html, "mdmark-card-grid-item")).toBe(
    '<a class="mdmark-card-grid-item" href="a.md">',
  );
  expect(findTag(html, "mdmark-card-grid-icon")).toContain('data-icon="book"');
  expect(html).toContain('<span class="mdmark-card-grid-title">使用方法</span>');
  expect(html).toContain('<p class="mdmark-card-grid-desc">導入の手順</p>');
  expect(findTags(html, "mdmark-card-grid-item")[1]).toBe(
    '<div class="mdmark-card-grid-item">',
  );
  expect(html).toContain('<span class="mdmark-card-grid-title">準備中</span>');
  expect(findTags(html, "mdmark-card-grid-desc")).toHaveLength(1);
});

// 許さないリンク先はリンクにしない（異常系）
test("test_render_card_grid_when_unsafe_href", async () => {
  // 準備
  const { renderCardGrid } = await loadCardGrid();
  // 実行
  const html = renderCardGrid({
    items: [{ title: "危ない", href: "javascript:alert(1)" }],
  });
  // 検証
  expect(findTag(html, "mdmark-card-grid-item")).toBe(
    '<div class="mdmark-card-grid-item">',
  );
  expect(html).not.toContain("javascript:");
});
