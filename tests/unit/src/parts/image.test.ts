import { expect, test } from "vitest";
import { findTag, findTags, innerHtml } from "../../helpers/html.ts";

/** 画像の図の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadImage = () => import("../../../../src/parts/image.ts");

// 読み上げの名前を alt から作り、アイコンを置く（正常系）
test("test_render_image_opener", async () => {
  // 準備
  const { renderImageOpener } = await loadImage();
  // 実行
  const html = renderImageOpener({
    alt: "売上<推移>",
    img: '<img src="a.png" alt="売上">',
  });
  // 検証
  const button = findTag(html, 'class="mdmark-image-open"');
  expect(button.startsWith("<button")).toBe(true);
  expect(button).toContain('aria-label="画像を拡大: 売上&lt;推移&gt;"');
  const inner = innerHtml(html, 'class="mdmark-image-open"');
  expect(inner).toContain('<img src="a.png" alt="売上">');
  expect(inner).toContain(
    '<span class="mdmark-image-open-icon" aria-hidden="true">',
  );
  expect(innerHtml(html, 'class="mdmark-image-open-icon"')).toContain("<svg");
});

// icon が false ならアイコンを置かない（正常系）
test("test_render_image_opener_when_no_icon", async () => {
  // 準備
  const { renderImageOpener } = await loadImage();
  // 実行
  const html = renderImageOpener({
    alt: "ビルド",
    img: '<img src="a.gif" alt="ビルド">',
    icon: false,
  });
  // 検証
  expect(innerHtml(html, 'class="mdmark-image-open"')).toBe(
    '<img src="a.gif" alt="ビルド">',
  );
  expect(html).not.toContain("mdmark-image-open-icon");
});

// 幅・配置・キャプションを当て、拡大のボタンで包む（正常系）
test("test_render_image_figure", async () => {
  // 準備
  const { renderImageFigure } = await loadImage();
  // 実行（部品設計の Caption に幅と配置を足す）
  const html = renderImageFigure({
    src: "screen-light.svg",
    alt: "プレビューを開いた画面",
    caption: "プレビューを開いた画面",
    width: "300px",
    align: "center",
  });
  // 検証
  expect(
    html.startsWith(
      '<figure class="mdmark-figure mdmark-image" data-align="center" style="--mdmark-image-width: 300px">',
    ),
  ).toBe(true);
  expect(innerHtml(html, 'class="mdmark-image-open"')).toContain(
    'src="screen-light.svg"',
  );
  expect(html).toContain(
    '<figcaption class="mdmark-figure-caption">プレビューを開いた画面</figcaption>',
  );
});

// opener が false なら img だけを置く（正常系）
test("test_render_image_figure_when_render", async () => {
  // 準備
  const { renderImageFigure } = await loadImage();
  // 実行
  const html = renderImageFigure({
    src: "screen-dark.svg#only-dark",
    alt: "暗い配色のときの画面",
    only: "dark",
    opener: false,
    gif: true,
  });
  // 検証
  expect(findTags(html, "<button")).toHaveLength(0);
  expect(findTag(html, "<figure")).toMatch(/class="[^"]*\bmdmark-only-dark\b/);
  expect(findTag(html, "<img")).toContain("data-gif");
});

// lightbox が false ならボタンで包まない（正常系）
test("test_render_image_figure_when_no_lightbox", async () => {
  // 準備
  const { renderImageFigure } = await loadImage();
  // 実行（部品設計の NoLightbox）
  const html = renderImageFigure({
    src: "step-4.svg",
    alt: "拡大しない画面",
    caption: "拡大しない画面",
    lightbox: false,
  });
  // 検証
  expect(findTags(html, "<button")).toHaveLength(0);
  expect(findTag(html, "<img")).toContain("data-nolightbox");
});

// サブ図の番号と id を付ける（正常系）
test("test_render_image_figure_when_sub_figure", async () => {
  // 準備
  const { renderImageFigure } = await loadImage();
  // 実行（部品設計の SubFigure）
  const html = renderImageFigure({
    src: "screen-dark.svg",
    alt: "暗い配色の画面",
    caption: "暗い配色",
    id: "fig-schemes-b",
    label: "図 2b",
  });
  // 検証
  expect(findTag(html, "<figure")).toContain('id="fig-schemes-b"');
  expect(innerHtml(html, "<figcaption")).toBe("<b>図 2b</b>暗い配色");
});
