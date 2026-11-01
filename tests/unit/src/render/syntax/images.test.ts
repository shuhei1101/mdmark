import { expect, test } from "vitest";
import type { ImageAttributes } from "../../../../../src/render/syntax/images.ts";
import { flattenTokens, parseWithRules } from "../../../helpers/core-rules.ts";
import {
  findTag,
  findTags,
  innerHtml,
  plainText,
} from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 画像の属性と図の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadImages = () => import("../../../../../src/render/syntax/images.ts");

/** 画像の属性を読むコアルールだけを当てて、`image` のトークンを現れた順に返す */
async function imageTokens(
  markdown: string,
  features: Record<string, boolean> = {},
) {
  const { readImages } = await loadImages();
  return flattenTokens(parseWithRules(markdown, [readImages], features)).filter(
    (token) => token.type === "image",
  );
}

// 拡張子で種類を見分ける（正常系）
test("test_media_kind_of", async () => {
  // 準備
  const { mediaKindOf } = await loadImages();
  const sources = [
    "demo.MP4?v=2",
    "voice.m4a#t=3",
    "build.gif",
    "chart.png",
    "readme",
  ];
  // 実行
  const kinds = sources.map((src) => mediaKindOf(src));
  // 検証
  expect(kinds).toEqual(["video", "audio", "gif", "image", "image"]);
});

// 幅・配置・nolightbox を読む（正常系）
test("test_read_image_attributes", async () => {
  // 準備
  const { readImageAttributes } = await loadImages();
  // 実行
  const first = readImageAttributes(
    "width=300 align=center nolightbox",
    "image",
    false,
  );
  const second = readImageAttributes("width=40%", "image", false);
  // 検証
  expect(first).toMatchObject({
    width: "300px",
    align: "center",
    lightbox: false,
    items: [],
  });
  expect(second).toMatchObject({ width: "40%", items: [] });
});

// 動画の属性を読み、autoplay に muted を足す（正常系）
test("test_read_image_attributes_when_media", async () => {
  // 準備
  const { readImageAttributes } = await loadImages();
  // 実行
  const attributes = readImageAttributes(
    "autoplay loop poster=demo.png width=480",
    "video",
    false,
  );
  // 検証
  expect(attributes).toMatchObject({
    autoplay: true,
    muted: true,
    loop: true,
    poster: "demo.png",
    width: "480px",
  });
});

// 読めない属性を項目にする（異常系）
test("test_read_image_attributes_when_unreadable", async () => {
  // 準備
  const { readImageAttributes } = await loadImages();
  // 実行
  const block = readImageAttributes(
    "width=big width=0% width=101% foo autoplay",
    "image",
    false,
  );
  const inline = readImageAttributes("align=left", "image", true);
  // 検証
  expect(block.width).toBeUndefined();
  const labels = block.items.map((item) => item.label);
  expect(labels).toHaveLength(5);
  expect(labels).toEqual(
    expect.arrayContaining([
      "width=big",
      "width=0%",
      "width=101%",
      "foo",
      "autoplay",
    ]),
  );
  expect(inline.align).toBeUndefined();
  expect(inline.items.map((item) => item.label)).toEqual(["align"]);
});

// 属性を読んで外し、種類を置く（正常系）
test("test_read_images", async () => {
  // 準備
  const markdown = [
    "![グラフ](chart.png){width=300 align=center}",
    "",
    "押す前に ![アイコン](icon.png){width=16} を確かめる。",
    "",
  ].join("\n");
  // 実行
  const tokens = await imageTokens(markdown);
  const { html } = renderDoc(markdown);
  // 検証
  expect(tokens[0]?.meta?.mdmarkImage).toMatchObject({
    width: "300px",
    align: "center",
  });
  expect(findTag(html, 'src="icon.png"')).toContain(
    'style="--mdmark-image-width: 16px"',
  );
  expect(html).not.toContain("{width=");
});

// GIF に data-gif を付ける（正常系）
test("test_read_images_when_gif", () => {
  // 準備
  const markdown = "![ビルド](build.gif)\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(findTag(html, "<img")).toContain("data-gif");
});

// 読めない属性を警告にする（異常系）
test("test_read_images_when_unreadable", async () => {
  // 準備
  const { IMAGE_ATTRIBUTE_NAMES } = await loadImages();
  const markdown = "![グラフ](chart.png){width=big align=center foo}\n";
  // 実行
  const { html } = renderDoc(markdown);
  const tokens = await imageTokens(markdown);
  // 検証
  const warnings = findTags(html, 'class="mdmark-syntax-warning"');
  expect(warnings).toHaveLength(1);
  expect(html.indexOf('class="mdmark-syntax-warning"')).toBeLessThan(
    html.indexOf('src="chart.png"'),
  );
  const warning = plainText(innerHtml(html, 'class="mdmark-syntax-warning"'));
  for (const text of ["width=big", "foo", ...IMAGE_ATTRIBUTE_NAMES]) {
    expect(warning).toContain(text);
  }
  expect(
    (tokens[0]?.meta?.mdmarkImage as ImageAttributes | undefined)?.align,
  ).toBe("center");
});

// images がオフなら属性を読まない（正常系）
test("test_read_images_when_feature_off", () => {
  // 準備
  const markdown = "![グラフ](chart.png){width=300}\n";
  // 実行
  const { html } = renderDoc(markdown, { images: false });
  // 検証
  expect(html).toContain("{width=300}");
});

// 画像だけの段落を図にし、title をキャプションにする（正常系）
test("test_build_image_figures", () => {
  // 準備
  const markdown = [
    '![グラフ](chart.png "売上の推移"){width=300 align=center}',
    "",
    "![構成](arch-dark.png#only-dark)",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<figure class="mdmark-figure mdmark-image" data-align="center" style="--mdmark-image-width: 300px">',
  );
  expect(html).toContain(
    '<figcaption class="mdmark-figure-caption">売上の推移</figcaption>',
  );
  const figures = findTags(html, "<figure");
  expect(figures).toHaveLength(2);
  expect(figures[1]).toMatch(/class="[^"]*\bmdmark-only-dark\b/);
  expect(findTag(html, "arch-dark.png")).toContain(
    'src="arch-dark.png#only-dark"',
  );
  expect(findTags(html, "<button")).toHaveLength(0);
});

// 動画と音声を再生バー付きの図にする（正常系）
test("test_build_image_figures_when_media", () => {
  // 準備
  const markdown = [
    '![操作の様子](demo.mp4 "保存までの操作"){autoplay poster=demo.png}',
    "",
    "読み上げは ![読み上げ](voice.mp3) で聞く。",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 動画
  const video = findTag(html, "<video");
  for (const attribute of [
    "controls",
    "autoplay",
    "muted",
    "playsinline",
    'preload="metadata"',
    'poster="demo.png"',
  ]) {
    expect(video).toContain(attribute);
  }
  const media = findTags(html, "mdmark-media");
  expect(media.filter((tag) => tag.startsWith("<figure"))).toHaveLength(2);
  expect(findTags(html, 'class="mdmark-media-print"')).toHaveLength(1);
  // 検証: 文の中の音声は段落の後ろに置く
  const paragraph = /<p>読み上げは[\s\S]*?<\/p>/.exec(html)?.[0] ?? "";
  expect(paragraph).not.toContain("<img");
  expect(html.indexOf("<audio")).toBeGreaterThan(html.indexOf(paragraph));
});

// リンクの中の画像と、文の中の画像は図にしない（正常系）
test("test_build_image_figures_when_link", () => {
  // 準備
  const markdown = [
    "[![ロゴ](logo.png)](https://example.com)",
    "",
    "押す前に ![アイコン](icon.png) を確かめる。",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(findTags(html, "<figure")).toHaveLength(0);
});

// media がオフなら動画を画像として描く（正常系）
test("test_build_image_figures_when_media_off", () => {
  // 準備
  const markdown = "![操作](demo.mp4)\n";
  // 実行
  const { html } = renderDoc(markdown, { media: false });
  // 検証
  expect(html).not.toContain("<video");
  expect(innerHtml(html, "mdmark-image")).toContain('src="demo.mp4"');
});
