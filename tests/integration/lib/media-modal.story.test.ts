import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 再生のダイアログのストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-mediamodal--${id}`);
}

/** 再生のダイアログのタイトル・キャプション・閉じるボタン・再生の要素 */
async function readModal(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector(
      "dialog.mdmark-media-modal",
    ) as HTMLDialogElement;
    const media = dialog.querySelector("video, audio") as HTMLMediaElement;
    const close = dialog.querySelector(
      'button[data-tool="close"]',
    ) as HTMLButtonElement;
    const dialogBox = dialog.getBoundingClientRect();
    const closeBox = close.getBoundingClientRect();
    const mediaBox = media.getBoundingClientRect();
    return {
      title:
        dialog.querySelector(".mdmark-media-modal-title")?.textContent ?? null,
      caption:
        dialog.querySelector(".mdmark-media-modal-caption")?.textContent ??
        null,
      tag: media.localName,
      attributes: Object.fromEntries(
        [...media.attributes].map((attribute) => [
          attribute.name,
          attribute.value,
        ]),
      ),
      closeLabel: close.getAttribute("aria-label"),
      closeRight: closeBox.right,
      dialogRight: dialogBox.right,
      mediaRight: mediaBox.right,
      mediaLeft: mediaBox.left,
      dialogLeft: dialogBox.left,
      nav: dialog.querySelector('[data-tool="prev"], [data-tool="next"]'),
    };
  });
}

// title を持つ動画は、再生バー・タイトル・キャプションを出す（Video）
test("test_video", async () => {
  // 準備・実行
  const page = await open("video");
  // 検証
  const modal = await readModal(page);
  expect(modal.tag).toBe("video");
  expect(modal.attributes).toMatchObject({
    controls: "",
    autoplay: "",
    playsinline: "",
    "aria-label": "素材 2",
  });
  expect(modal.attributes.poster).toBeTruthy();
  expect(modal.title).toBe("素材 2");
  expect(modal.caption).toBe("操作の画面");
  expect(modal.closeLabel).toBe("再生を閉じる");
  expect(modal.nav).toBeNull();
});

// title を持たない動画は、キャプションを出さない（VideoNoCaption）
test("test_video_no_caption", async () => {
  // 準備・実行
  const page = await open("video-no-caption");
  // 検証
  const modal = await readModal(page);
  expect(modal.caption).toBeNull();
  expect(modal.title).toBe("素材 1");
});

// 音声は、再生バーだけを出す（Audio）
test("test_audio", async () => {
  // 準備・実行
  const page = await open("audio");
  // 検証
  const modal = await readModal(page);
  expect(modal.tag).toBe("audio");
  expect(modal.attributes.playsinline).toBeUndefined();
  expect(modal.caption).toBe("読み上げの見本");
});

// 長いラベルとキャプションは折り返し、閉じるボタンを右端に残す（LongLabel）
test("test_long_label", async () => {
  // 準備・実行
  const page = await open("long-label");
  // 検証
  const modal = await readModal(page);
  expect(modal.closeRight).toBeLessThanOrEqual(modal.dialogRight);
  expect(modal.dialogRight - modal.closeRight).toBeLessThan(16);
});

// 幅の狭い画面では、動画を画面の幅に収める（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await open("narrow");
  // 検証
  const modal = await readModal(page);
  expect(modal.mediaLeft).toBeGreaterThanOrEqual(modal.dialogLeft);
  expect(modal.mediaRight).toBeLessThanOrEqual(modal.dialogRight);
});
