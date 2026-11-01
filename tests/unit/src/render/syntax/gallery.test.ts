import { expect, test } from "vitest";
import type { Mark } from "../../../../../src/render/marks.ts";
import { parseWithRules } from "../../../helpers/core-rules.ts";
import { findTag, findTags, innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** ギャラリーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGallery = () => import("../../../../../src/render/syntax/gallery.ts");

/** 文書の最初のギャラリーのマーカーを返す */
async function galleryMark(markdown: string) {
  const mark = parseWithRules(markdown, []).find(
    (token) => token.type === "mdmark_mark" && token.meta?.name === "gallery",
  );
  if (mark === undefined) {
    throw new Error("ギャラリーのマーカーが無い");
  }
  return mark.meta as Mark;
}

/** `count` 枚の画像だけの段落を並べた Markdown を返す */
function imageParagraphs(count: number): string[] {
  return Array.from({ length: count }, (_, index) => [
    `![画像 ${index + 1}](img-${index + 1}.png "画像 ${index + 1}")`,
    "",
  ]).flat();
}

// 列の数を読み、省けば既定にする（正常系）
test("test_read_gallery_options", async () => {
  // 準備
  const { readGalleryOptions } = await loadGallery();
  const withCols = await galleryMark("<!-- gallery: cols=3 -->\n");
  const plain = await galleryMark("<!-- gallery -->\n");
  // 実行
  const first = readGalleryOptions(withCols);
  const second = readGalleryOptions(plain);
  // 検証
  expect(first).toEqual({ cols: 3, items: [] });
  expect(second).toEqual({ cols: 2, items: [] });
});

// 読めない列の数と指定を項目にする（異常系）
test("test_read_gallery_options_when_unreadable", async () => {
  // 準備
  const { readGalleryOptions } = await loadGallery();
  const mark = await galleryMark("<!-- gallery: cols=7 wide -->\n");
  // 実行
  const options = readGalleryOptions(mark);
  // 検証
  expect(options.cols).toBe(2);
  expect(options.items.map((item) => item.label)).toEqual(["cols=7", "wide"]);
});

// 範囲の画像を格子に並べる（正常系）
test("test_build_gallery", () => {
  // 準備
  const markdown = [
    "<!-- gallery: cols=3 -->",
    "",
    '![開く](open.png "開く")',
    "",
    '![書く](write.png "書く")',
    "",
    "範囲の中の文",
    "",
    "<!-- /gallery -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<div class="mdmark-gallery" style="--mdmark-gallery-cols: 3"><div class="mdmark-gallery-grid">',
  );
  const grid = innerHtml(html, 'class="mdmark-gallery-grid"');
  expect(findTags(grid, "mdmark-image")).toHaveLength(2);
  expect(html).not.toContain("範囲の中の文");
});

// 番号を付けたギャラリーの画像にサブ図の番号を付ける（正常系）
test("test_build_gallery_when_numbered", () => {
  // 準備（fig のマーカーが開きのマーカーに { id: "shots", number: 1 } を置く）
  const markdown = [
    "<!-- fig: shots -->",
    "",
    "<!-- gallery -->",
    "",
    '![開く](open.png "開く")',
    "",
    '![書く](write.png "書く")',
    "",
    "<!-- /gallery -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const outer = findTag(html, 'id="fig-shots"');
  expect(outer).toMatch(/^<figure class="mdmark-figure"/);
  expect(html).toContain("<b>図 1</b>");
  expect(findTag(html, 'id="fig-shots-a"')).toMatch(/^<figure/);
  expect(findTag(html, 'id="fig-shots-b"')).toMatch(/^<figure/);
  expect(html).toContain("<b>図 1a</b>開く");
  expect(html).toContain("<b>図 1b</b>書く");
});

// 画像が 0 枚と 27 枚以上を警告にする（異常系）
test("test_build_gallery_when_empty_or_too_many", () => {
  // 準備
  const empty = ["<!-- gallery -->", "", "文だけ", "", "<!-- /gallery -->", ""];
  const many = [
    "<!-- fig: many -->",
    "",
    "<!-- gallery -->",
    "",
    ...imageParagraphs(27),
    "<!-- /gallery -->",
    "",
  ];
  // 実行
  const emptyHtml = renderDoc(empty.join("\n")).html;
  const manyHtml = renderDoc(many.join("\n")).html;
  // 検証: 範囲の前の警告
  expect(emptyHtml).toContain('class="mdmark-syntax-warning"');
  expect(manyHtml.indexOf('class="mdmark-syntax-warning"')).toBeLessThan(
    manyHtml.indexOf("mdmark-gallery"),
  );
  // 検証: 27 枚目は id とサブ図の番号を持たない
  const figures = findTags(manyHtml, "mdmark-image");
  expect(figures).toHaveLength(27);
  expect(figures[25]).toContain('id="fig-many-z"');
  expect(figures[26]).not.toContain("id=");
  expect(manyHtml).not.toMatch(/<b>図 1[a-z]{2}<\/b>/);
  expect(manyHtml).toContain(
    '<figcaption class="mdmark-figure-caption">画像 27</figcaption>',
  );
});
