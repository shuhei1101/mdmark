import { expect, test } from "vitest";
import { findTag, findTags, innerHtml, plainText } from "../../helpers/html.ts";

/** 再生のダイアログの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMediaModal = () => import("../../../../src/media/media-modal.part.ts");

// 動画とタイトルとキャプションを描く（正常系）
test("test_render_media_modal", async () => {
  // 準備
  const { renderMediaModal } = await loadMediaModal();
  // 実行（部品設計の Video）
  const html = renderMediaModal({
    id: "mdmark-media-1",
    kind: "video",
    src: "demo.mp4",
    label: "素材 2",
    caption: "操作の画面",
    poster: "demo-poster.png",
  });
  // 検証
  expect(html.startsWith('<dialog class="mdmark-media-modal"')).toBe(true);
  const dialog = findTag(html, "<dialog");
  expect(dialog).toContain('closedby="any"');
  expect(dialog).toContain('aria-labelledby="mdmark-media-1-title"');
  expect(findTag(html, 'id="mdmark-media-1-title"')).toContain(
    "mdmark-media-modal-title",
  );
  expect(
    plainText(innerHtml(html, 'class="mdmark-media-modal-title"')),
  ).toBe("素材 2");
  const video = findTag(html, "<video");
  expect(video).toMatch(/\scontrols\b/);
  expect(video).toMatch(/\sautoplay\b/);
  expect(video).toMatch(/\splaysinline\b/);
  expect(video).toContain('poster="demo-poster.png"');
  expect(video).toContain('aria-label="素材 2"');
  expect(findTag(html, 'data-tool="close"')).toContain(
    'aria-label="再生を閉じる"',
  );
  expect(
    plainText(innerHtml(html, 'class="mdmark-media-modal-caption"')),
  ).toBe("操作の画面");
  expect(html).not.toContain("mdmark-lightbox-count");
  expect(findTags(html, 'data-tool="prev"')).toHaveLength(0);
  expect(findTags(html, 'data-tool="next"')).toHaveLength(0);
});

// 音声は playsinline と poster を持たず、キャプションの無いときは出さない（正常系）
test("test_render_media_modal_when_audio", async () => {
  // 準備
  const { renderMediaModal } = await loadMediaModal();
  // 実行（部品設計の Audio と VideoNoCaption）
  const audio = renderMediaModal({
    id: "mdmark-media-2",
    kind: "audio",
    src: "voice.mp3",
    label: "読み上げ",
    caption: "読み上げの見本",
  });
  const noCaption = renderMediaModal({
    id: "mdmark-media-3",
    kind: "video",
    src: "demo.mp4",
    label: "素材 1",
  });
  // 検証
  const tag = findTag(audio, "<audio");
  expect(tag).toMatch(/\scontrols\b/);
  expect(tag).toMatch(/\sautoplay\b/);
  expect(tag).not.toContain("playsinline");
  expect(noCaption).not.toContain("mdmark-media-modal-caption");
});
