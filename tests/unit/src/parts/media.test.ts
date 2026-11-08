import { expect, test } from "vitest";
import { findTag, findTags } from "../../helpers/html.ts";

/** 動画と音声の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMedia = () => import("../../../../src/parts/media.ts");

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
