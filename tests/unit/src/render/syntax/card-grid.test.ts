import { expect, test } from "vitest";
import { findTag, findTags, innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** cards の範囲で 4 項目のリストを囲んだ Markdown */
const CARDS_MARKDOWN = [
  "<!-- cards -->",
  "- `icon:book` [使い方](a.md)",
  "  導入の手順",
  "- [参照](b.md) 名前の一覧",
  "- https://example.com/docs",
  "- 準備中",
  "<!-- /cards -->",
  "",
].join("\n");

// 項目をカードの引数に分ける（正常系）
test("test_build_card_grid", () => {
  // 準備
  const markdown = CARDS_MARKDOWN;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(findTags(html, 'class="mdmark-card-grid"')).toHaveLength(1);
  const links = findTags(html, "mdmark-card-grid-item");
  expect(links).toHaveLength(4);
  expect(links[0]).toContain('href="a.md"');
  expect(links[1]).toContain('href="b.md"');
  expect(links[2]).toContain('href="https://example.com/docs"');
  expect(links[3]?.startsWith("<div")).toBe(true);
  expect(findTag(html, "mdmark-card-grid-icon")).toContain('data-icon="book"');
  expect(findTags(html, "mdmark-card-grid-icon")).toHaveLength(1);
  const titles = findTags(html, "mdmark-card-grid-title").map((tag) =>
    innerHtml(html.slice(html.indexOf(tag)), "mdmark-card-grid-title"),
  );
  expect(titles).toEqual(["使い方", "参照", "example.com/docs", "準備中"]);
  const descriptions = findTags(html, "mdmark-card-grid-desc").map((tag) =>
    innerHtml(html.slice(html.indexOf(tag)), "mdmark-card-grid-desc"),
  );
  expect(descriptions).toEqual(["導入の手順", "名前の一覧"]);
  expect(html).not.toContain('class="mdmark-card"');
  expect(html).not.toContain("<!--");
});

// リスト 1 つでない範囲は囲まずに警告する（異常系）
test("test_build_card_grid_when_not_list", () => {
  // 準備
  const markdown = [
    "<!-- cards -->",
    "入口のページです。",
    "",
    "- [使い方](a.md)",
    "<!-- /cards -->",
    "",
  ].join("\n");
  // 実行
  const { html, warnings } = renderDoc(markdown);
  // 検証
  expect(warnings).toHaveLength(1);
  expect(warnings[0]?.message).toContain("リスト");
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf("入口のページです。"),
  );
  expect(html).not.toContain("mdmark-card-grid");
  expect(html).toContain('<a href="a.md">使い方</a>');
});

// オフのときは印だけを取り除く（正常系）
test("test_build_card_grid_when_disabled", () => {
  // 準備
  const markdown = CARDS_MARKDOWN;
  // 実行
  const { html, warnings } = renderDoc(markdown, { "card-grid": false });
  // 検証
  expect(html).not.toContain("mdmark-card-grid");
  expect(html).not.toContain("<!--");
  expect(warnings).toEqual([]);
  expect(findTags(html, "<li")).toHaveLength(4);
});
