import { expect, test } from "vitest";
import { findTag, innerHtml, matches } from "../../helpers/html.ts";

/** GIF の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGif = () => import("../../../../src/parts/gif.ts");

// 止めているかを aria-pressed と名前に出す（正常系）
test("test_render_gif_toggle", async () => {
  // 準備
  const { renderGifToggle } = await loadGif();
  // 実行
  const playing = renderGifToggle({ paused: false });
  const paused = renderGifToggle({ paused: true });
  // 検証
  const playingTag = findTag(playing, 'class="mdmark-gif-toggle"');
  expect(playingTag).toContain('aria-pressed="false"');
  expect(playingTag).toContain('aria-label="GIF を停止"');
  const pausedTag = findTag(paused, 'class="mdmark-gif-toggle"');
  expect(pausedTag).toContain('aria-pressed="true"');
  expect(pausedTag).toContain('aria-label="GIF を再生"');
  for (const html of [playing, paused]) {
    expect(matches(html, /<svg\b/g)).toHaveLength(2);
  }
});

// 再生中は canvas を隠し、停止のボタンを置く（正常系）
test("test_render_gif", async () => {
  // 準備
  const { renderGif } = await loadGif();
  // 実行（部品設計の Playing）
  const html = renderGif({ src: "build.gif", alt: "ビルドの進み具合" });
  // 検証
  expect(html.startsWith('<span class="mdmark-gif">')).toBe(true);
  const canvas = findTag(html, "<canvas");
  expect(canvas).toContain("hidden");
  expect(canvas).toContain('aria-hidden="true"');
  expect(innerHtml(html, 'class="mdmark-image-open"')).toContain(
    'src="build.gif"',
  );
  expect(findTag(html, 'class="mdmark-gif-toggle"')).toContain(
    'aria-pressed="false"',
  );
});

// 止めたときは canvas を出し img を隠す（正常系）
test("test_render_gif_when_paused", async () => {
  // 準備
  const { renderGif } = await loadGif();
  // 実行（部品設計の Paused）
  const html = renderGif({
    src: "build.gif",
    alt: "ビルドの進み具合",
    paused: true,
  });
  // 検証
  expect(findTag(html, "<canvas")).not.toMatch(/\shidden\b/);
  expect(findTag(html, "<img")).toMatch(/visibility:\s*hidden/);
  expect(findTag(html, 'class="mdmark-gif-toggle"')).toContain(
    'aria-pressed="true"',
  );
});
