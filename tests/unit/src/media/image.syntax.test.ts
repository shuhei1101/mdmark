import { expect, test } from "vitest";
import type { ImageAttributes } from "../../../../src/media/image.syntax.ts";
import { flattenTokens, parseWithRules } from "../../helpers/core-rules.ts";
import { findTag, findTags, innerHtml, plainText } from "../../helpers/html.ts";
import { renderDoc } from "../../helpers/render.ts";
import { resolveConfig } from "../../../../src/config.ts";
import { renderDocument } from "../../../../src/render/index.ts";

/** 画像の属性と図の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadImages = () => import("../../../../src/media/image.syntax.ts");

/** 画像の属性を読み込むコアルールだけを適用して、`image` のトークンを現れた順に返却する */
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

// 幅・配置・nolightbox を読み込む（正常系）
test("test_read_image_attributes", async () => {
  // 準備
  const { readImageAttributes } = await loadImages();
  // 実行
  const first = readImageAttributes(
    "width=300 align=center nolightbox",
    "image",
    { inline: false },
  );
  const second = readImageAttributes("width=40%", "image", { inline: false });
  // 検証
  expect(first).toMatchObject({
    width: "300px",
    align: "center",
    lightbox: false,
    items: [],
  });
  expect(second).toMatchObject({ width: "40%", items: [] });
});

// 動画の属性を読み込み、autoplay に muted を追加する（正常系）
test("test_read_image_attributes_when_media", async () => {
  // 準備
  const { readImageAttributes } = await loadImages();
  // 実行
  const attributes = readImageAttributes(
    "autoplay loop poster=demo.png width=480",
    "video",
    { inline: false },
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

// 読み込めない属性を項目にする（異常系）
test("test_read_image_attributes_when_unreadable", async () => {
  // 準備
  const { readImageAttributes } = await loadImages();
  // 実行
  const block = readImageAttributes(
    "width=big width=0% width=101% foo autoplay",
    "image",
    { inline: false },
  );
  const inline = readImageAttributes("align=left", "image", { inline: true });
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

// 属性を読み込んで削除し、種類を配置する（正常系）
test("test_read_images", async () => {
  // 準備
  const markdown = [
    "![グラフ](chart.png){width=300 align=center}",
    "",
    "押す前に ![アイコン](icon.png){width=16} を確認する。",
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

// 読み込めない属性を警告にする（異常系）
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

// images がオフなら属性を読み込まない（正常系）
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
  // 検証: 文の中の音声は段落の後ろに配置する
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
    "押す前に ![アイコン](icon.png) を確認する。",
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

// modal と thumbnail を読み込む（正常系）
test("test_read_image_attributes_when_modal", async () => {
  // 準備
  const { readImageAttributes } = await loadImages();
  // 実行
  const audio = readImageAttributes("modal", "audio", { inline: false });
  const video = readImageAttributes("thumbnail poster=p.png", "video", {
    inline: false,
  });
  // 検証
  expect(audio).toMatchObject({ modal: true, opener: true, items: [] });
  expect(video).toMatchObject({ thumbnail: true, opener: true, items: [] });
});

// 読み込めない modal・thumbnail・width・align を項目にする（異常系）
test("test_read_image_attributes_when_modal_unreadable", async () => {
  // 準備
  const { readImageAttributes } = await loadImages();
  // 実行
  const image = readImageAttributes("modal", "image", { inline: false });
  const audio = readImageAttributes("thumbnail", "audio", { inline: false });
  const video = readImageAttributes("thumbnail", "video", { inline: false });
  const sized = readImageAttributes("modal width=320 align=center", "video", {
    inline: false,
  });
  const cell = readImageAttributes("align=right", "video", {
    inline: false,
    opener: true,
  });
  // 検証
  const labels = (attributes: ImageAttributes) =>
    attributes.items.map((item) => item.label);
  expect(labels(image)).toEqual(["modal"]);
  expect(image.modal).toBe(false);
  expect(labels(audio)).toEqual(["thumbnail"]);
  expect(audio.thumbnail).toBe(false);
  expect(labels(video)).toEqual(["thumbnail"]);
  expect(video.thumbnail).toBe(false);
  expect(labels(sized)).toEqual(["width=320", "align=center"]);
  expect(sized.width).toBeUndefined();
  expect(sized.align).toBeUndefined();
  expect(labels(cell)).toEqual(["align=right"]);
  expect(cell.align).toBeUndefined();
});

// 表のセルの中の動画に opener を配置する（正常系）
test("test_read_images_when_table_cell", async () => {
  // 準備
  const markdown = [
    "| 素材 | 図 |",
    "| --- | --- |",
    "| ![素材 1](m1.mp4) | ![グラフ](chart.png) |",
    "",
  ].join("\n");
  // 実行
  const tokens = await imageTokens(markdown);
  // 検証
  const meta = (src: string) =>
    tokens.find((token) => token.attrGet("src") === src)?.meta?.mdmarkImage as
      | ImageAttributes
      | undefined;
  expect(meta("m1.mp4")?.opener).toBe(true);
  expect(meta("chart.png")?.opener).toBe(false);
});

// 読み込めない thumbnail の動画・音声に opener を配置しない（異常系）
test("test_read_images_when_opener_unreadable", async () => {
  // 準備
  const markdown = [
    "![読み上げ](voice.mp3){thumbnail}",
    "",
    "![操作](demo.mp4){thumbnail}",
    "",
  ].join("\n");
  // 実行
  const tokens = await imageTokens(markdown);
  const { html } = renderDoc(markdown);
  // 検証
  for (const token of tokens) {
    expect(
      (token.meta?.mdmarkImage as ImageAttributes | undefined)?.opener,
    ).toBe(false);
  }
  const warnings = findTags(html, 'class="mdmark-syntax-warning"');
  expect(warnings).toHaveLength(2);
  expect(html.indexOf('class="mdmark-syntax-warning"')).toBeLessThan(
    html.indexOf("voice.mp3"),
  );
  expect(plainText(innerHtml(html, 'class="mdmark-syntax-warning"'))).toContain(
    "thumbnail",
  );
});

// 表のセル・段落・文の途中の動画を再生のボタンにする（正常系）
test("test_build_image_figures_when_opener", () => {
  // 準備
  const markdown = [
    "| 手順 | 素材 |",
    "| --- | --- |",
    '| 保存 | ![素材 1](m1.mp4 "手順 1") |',
    "",
    "![操作](demo.mp4){modal}",
    "",
    "手順は ![手順](steps.mp4){modal} で確認する。",
    "",
    "![素材 2](m2.mp4){thumbnail poster=m2.png}",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toMatch(/<video\b/);
  const cell = /<td[^>]*>[\s\S]*?m1\.mp4[\s\S]*?<\/td>/.exec(html)?.[0] ?? "";
  expect(cell).toContain('class="mdmark-media-open"');
  expect(plainText(innerHtml(cell, "mdmark-media-open-caption"))).toBe(
    "手順 1",
  );
  const figure = innerHtml(html, 'class="mdmark-media-inline-figure"');
  expect(figure).toContain('data-media-src="demo.mp4"');
  const sentence = /<p>手順は [\s\S]*?<\/p>/.exec(html)?.[0] ?? "";
  expect(sentence).toContain('data-media-src="steps.mp4"');
  expect(sentence.indexOf("mdmark-media-open")).toBeLessThan(
    sentence.indexOf("で確認する"),
  );
  expect(findTag(html, 'data-media-src="m2.mp4"')).toContain(
    "mdmark-media-thumb",
  );
});

// media がオフなら表のセルの動画を画像のままにする（正常系）
test("test_build_image_figures_when_opener_media_off", () => {
  // 準備
  const markdown = ["| 素材 |", "| --- |", "| ![素材 1](m1.mp4) |", ""].join(
    "\n",
  );
  // 実行
  const { html } = renderDoc(markdown, { media: false });
  // 検証
  expect(html).not.toContain("mdmark-media-open");
  expect(findTag(html, "<img")).toContain('src="m1.mp4"');
});

// 属性の無い動画を既定の幅で描き、属性とページの設定を優先する（正常系）
test("test_build_image_figures_when_default_video_width", () => {
  // 準備
  const body = [
    "![a](clip.mp4)",
    "",
    "![b](clip.mp4){width=320}",
    "",
    "![c](voice.mp3)",
    "",
  ].join("\n");
  const config = resolveConfig({ config: { media: { width: "50%" } } });
  // 実行
  const byConfig = renderDocument({ markdown: body, config }).html;
  const byPage = renderDocument({
    markdown: `<!-- page: {"media": {"width": "80%"}} -->\n\n${body}`,
    config,
  }).html;
  // 検証: 設定の既定の幅
  const figures = findTags(byConfig, "<figure");
  expect(figures[0]).toContain("--mdmark-image-width: 50%");
  expect(figures[1]).toContain("--mdmark-image-width: 320px");
  expect(figures[2]).not.toContain("--mdmark-image-width");
  // 検証: ページの設定を優先する
  const pageFigures = findTags(byPage, "<figure");
  expect(pageFigures[0]).toContain("--mdmark-image-width: 80%");
  expect(pageFigures[1]).toContain("--mdmark-image-width: 320px");
  expect(pageFigures[2]).not.toContain("--mdmark-image-width");
});
