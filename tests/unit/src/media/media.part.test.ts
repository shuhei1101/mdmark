import { expect, test } from "vitest";
import { findTag, findTags, innerHtml, plainText } from "../../helpers/html.ts";

/** 動画と音声の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMedia = () => import("../../../../src/media/media.part.ts");

// 動画に再生バーと印刷用の画像を付ける（正常系）
test("test_render_media", async () => {
  // 準備
  const { renderMedia } = await loadMedia();
  // 実行（部品設計の Video）
  const html = renderMedia({
    kind: "video",
    src: "demo.mp4",
    alt: "プレビューを開く操作",
    caption: "プレビューを開く操作",
    poster: "demo-poster.png",
  });
  // 検証
  expect(html.startsWith('<figure class="mdmark-figure mdmark-media"')).toBe(
    true,
  );
  const video = findTag(html, "<video");
  expect(video).toMatch(/\scontrols\b/);
  expect(video).toContain('preload="metadata"');
  expect(video).toMatch(/\splaysinline\b/);
  expect(video).toContain('aria-label="プレビューを開く操作"');
  expect(video).toContain('poster="demo-poster.png"');
  const print = findTag(html, 'class="mdmark-media-print"');
  expect(print).toContain('alt=""');
  expect(print).toContain('src="demo-poster.png"');
});

// 自動で再生するなら muted を付ける（正常系）
test("test_render_media_when_autoplay", async () => {
  // 準備
  const { renderMedia } = await loadMedia();
  // 実行（部品設計の VideoAutoplay）
  const html = renderMedia({
    kind: "video",
    src: "demo.mp4",
    alt: "繰り返し再生する短い操作",
    caption: "繰り返し再生する短い操作",
    width: "320px",
    autoplay: true,
    loop: true,
  });
  // 検証
  const video = findTag(html, "<video");
  expect(video).toMatch(/\sautoplay\b/);
  expect(video).toMatch(/\smuted\b/);
  expect(video).toMatch(/\sloop\b/);
  expect(findTag(html, "<figure")).toContain(
    'style="--mdmark-image-width: 320px"',
  );
});

// 音声は playsinline を持たない（正常系）
test("test_render_media_when_audio", async () => {
  // 準備
  const { renderMedia } = await loadMedia();
  // 実行（部品設計の Audio）
  const html = renderMedia({
    kind: "audio",
    src: "voice.mp3",
    alt: "読み上げの見本",
    caption: "読み上げの見本（3 秒）",
  });
  // 検証
  const audio = findTag(html, "<audio");
  expect(audio).toMatch(/\scontrols\b/);
  expect(audio).not.toContain("playsinline");
  expect(findTags(html, "mdmark-media-print")).toHaveLength(0);
});

/** アイコンの svg を読み込む */
const loadIcons = () => import("../../../../src/shared/icons.part.ts");

// ラベルと再生のアイコンのボタンを描く（正常系）
test("test_render_media_opener", async () => {
  // 準備
  const { renderMediaOpener } = await loadMedia();
  const { iconSvg } = await loadIcons();
  // 実行（部品設計の OpenButton と OpenButtonAudio）
  const video = renderMediaOpener({
    kind: "video",
    src: "demo.mp4",
    alt: "素材 1",
    opener: "button",
    inline: true,
  });
  const audio = renderMediaOpener({
    kind: "audio",
    src: "voice.mp3",
    alt: "読み上げ",
    opener: "button",
    inline: true,
  });
  // 検証
  const button = findTag(video, 'class="mdmark-media-open"');
  expect(button).toContain('type="button"');
  expect(button).toContain('aria-haspopup="dialog"');
  expect(button).toContain('data-media-kind="video"');
  expect(button).toContain('data-media-src="demo.mp4"');
  expect(video).toContain(iconSvg("play"));
  expect(
    plainText(innerHtml(video, 'class="mdmark-media-open-label"')),
  ).toBe("素材 1");
  expect(audio).toContain(iconSvg("volume-2" as Parameters<typeof iconSvg>[0]));
  for (const html of [video, audio]) {
    expect(html).not.toMatch(/<(video|audio)\b/);
    expect(html).not.toContain("mdmark-media-inline-figure");
  }
});

// 段落のボタンを包み、キャプションを置く（正常系）
test("test_render_media_opener_when_caption", async () => {
  // 準備
  const { renderMediaOpener } = await loadMedia();
  // 実行（部品設計の OpenButtonCaption）
  const html = renderMediaOpener({
    kind: "video",
    src: "demo.mp4",
    alt: "操作の様子",
    caption: "保存までの操作",
    opener: "button",
    inline: false,
  });
  // 検証
  expect(html.startsWith('<div class="mdmark-media-inline-figure">')).toBe(true);
  const inner = innerHtml(html, 'class="mdmark-media-inline-figure"');
  expect(findTag(inner, 'class="mdmark-media-open"')).toContain(
    'data-media-caption="保存までの操作"',
  );
  expect(
    plainText(innerHtml(inner, 'class="mdmark-media-open-caption"')),
  ).toBe("保存までの操作");
});

// poster のサムネイルのボタンを描く（正常系）
test("test_render_media_opener_when_thumbnail", async () => {
  // 準備
  const { renderMediaOpener } = await loadMedia();
  // 実行（部品設計の OpenThumbnail）
  const html = renderMediaOpener({
    kind: "video",
    src: "demo.mp4",
    alt: "素材 2",
    poster: "demo-poster.png",
    opener: "thumbnail",
    inline: true,
  });
  // 検証
  const button = findTag(html, "mdmark-media-thumb");
  expect(button).toMatch(/class="mdmark-media-open mdmark-media-thumb"/);
  expect(button).toContain('aria-label="素材 2"');
  expect(findTag(html, "<img")).toBe('<img src="demo-poster.png" alt="">');
  expect(html).not.toContain("mdmark-media-open-label");
});

// autoplay には data-media-muted を付け、alt が空ならファイル名をラベルにする（正常系）
test("test_render_media_opener_when_autoplay", async () => {
  // 準備
  const { renderMediaOpener } = await loadMedia();
  // 実行
  const html = renderMediaOpener({
    kind: "video",
    src: "media/demo.mp4",
    alt: "",
    autoplay: true,
    loop: true,
    opener: "button",
    inline: true,
  });
  // 検証
  const button = findTag(html, 'class="mdmark-media-open"');
  expect(button).toMatch(/\sdata-media-autoplay\b/);
  expect(button).toMatch(/\sdata-media-muted\b/);
  expect(button).toMatch(/\sdata-media-loop\b/);
  expect(
    plainText(innerHtml(html, 'class="mdmark-media-open-label"')),
  ).toBe("demo.mp4");
});
