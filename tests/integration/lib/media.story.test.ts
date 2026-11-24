import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 動画と音声のストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-media--${id}`);
}

/** 要素が持つ属性の名前と、出ているか */
async function readMedia(page: Page, selector: string) {
  return page.evaluate((target) => {
    const element = document.querySelector(target) as HTMLElement;
    const figure = element.closest("figure") as HTMLElement;
    const print = figure.querySelector(
      ".mdmark-media-print",
    ) as HTMLElement | null;
    const caption = figure.querySelector("figcaption");
    return {
      attributes: Object.fromEntries(
        [...element.attributes].map((attribute) => [
          attribute.name,
          attribute.value,
        ]),
      ),
      display: getComputedStyle(element).display,
      figureWidth: figure.getBoundingClientRect().width,
      printDisplay: print ? getComputedStyle(print).display : null,
      printAlt: print?.getAttribute("alt") ?? null,
      caption: caption?.textContent ?? null,
      captionDisplay: caption ? getComputedStyle(caption).display : null,
    };
  }, selector);
}

// poster と title を持つ動画は、再生バーを出し、下にキャプションを出す（Video）
test("test_video", async () => {
  // 準備・実行
  const page = await open("video");
  // 検証
  const media = await readMedia(page, "figure.mdmark-media video");
  expect(media.attributes).toMatchObject({
    controls: "",
    playsinline: "",
    preload: "metadata",
    "aria-label": "プレビューを開く操作",
  });
  expect(media.attributes.poster).toBeTruthy();
  expect(media.attributes.autoplay).toBeUndefined();
  expect(media.display).toBe("block");
  expect(media.caption).toBe("プレビューを開く操作");
  // 印刷用の画像は画面では出さない
  expect(media.printAlt).toBe("");
  expect(media.printDisplay).toBe("none");
});

// autoplay・loop の動画は、muted を追加し、幅 320px で出す（VideoAutoplay）
test("test_video_autoplay", async () => {
  // 準備・実行
  const page = await open("video-autoplay");
  // 検証
  const media = await readMedia(page, "figure.mdmark-media video");
  expect(media.attributes).toMatchObject({
    autoplay: "",
    muted: "",
    loop: "",
    controls: "",
  });
  expect(media.figureWidth).toBeCloseTo(320, 0);
  await expect(
    page
      .locator("figure.mdmark-media video")
      .evaluate((element) => (element as HTMLVideoElement).muted),
  ).resolves.toBe(true);
});

// title を持たない動画は、キャプションを出さない（VideoNoCaption）
test("test_video_no_caption", async () => {
  // 準備・実行
  const page = await open("video-no-caption");
  // 検証
  const media = await readMedia(page, "figure.mdmark-media video");
  expect(media.caption).toBeNull();
  expect(media.attributes["aria-label"]).toBe("操作の動画");
});

// title を持つ音声は、再生バーとキャプションを出す（Audio）
test("test_audio", async () => {
  // 準備・実行
  const page = await open("audio");
  // 検証
  const media = await readMedia(page, "figure.mdmark-media audio");
  expect(media.attributes).toMatchObject({
    controls: "",
    preload: "metadata",
    "aria-label": "読み上げの見本",
  });
  expect(media.attributes.playsinline).toBeUndefined();
  expect(media.display).toBe("block");
  expect(media.caption).toBe("読み上げの見本（3 秒）");
  expect(media.printDisplay).toBeNull();
});

// 印刷では、再生バーを出さず、poster の画像とキャプションを出す（VideoPrint）
test("test_video_print", async () => {
  // 準備
  const page = await open("video-print");
  // 実行
  await page.emulateMedia({ media: "print" });
  // 検証
  const media = await readMedia(page, "figure.mdmark-media video");
  expect(media.display).toBe("none");
  expect(media.printDisplay).toBe("block");
  expect(media.captionDisplay).not.toBe("none");
  expect(media.caption).toBe("プレビューを開く操作");
  const printed = await page
    .locator(".mdmark-media-print")
    .evaluate((element) => {
      const image = element as HTMLImageElement;
      return {
        src: image.getAttribute("src"),
        poster: document.querySelector("video")?.getAttribute("poster"),
        height: image.getBoundingClientRect().height,
      };
    });
  expect(printed.src).toBe(printed.poster);
  expect(printed.height).toBeGreaterThan(0);
});

/** 再生のボタンの属性・ラベル・キャプションと、アイコンと枠線の出方 */
async function readOpener(page: Page) {
  return page.evaluate(() => {
    const button = document.querySelector(
      "button.mdmark-media-open",
    ) as HTMLButtonElement;
    const icon = button.querySelector("svg");
    const caption = document.querySelector(".mdmark-media-open-caption");
    const box = button.getBoundingClientRect();
    const frame = button.closest(".mdmark") ?? document.body;
    return {
      attributes: Object.fromEntries(
        [...button.attributes].map((attribute) => [
          attribute.name,
          attribute.value,
        ]),
      ),
      label:
        button.querySelector(".mdmark-media-open-label")?.textContent ?? null,
      caption: caption?.textContent ?? null,
      wrapped: button.closest(".mdmark-media-inline-figure") !== null,
      iconDisplay: icon ? getComputedStyle(icon).display : null,
      borderWidth: getComputedStyle(button).borderTopWidth,
      buttonRight: box.right,
      frameRight: frame.getBoundingClientRect().right,
      hasPlayer: document.querySelector("video, audio") !== null,
    };
  });
}

// 表のセルの中の動画は、ラベルと再生のアイコンのボタンにする（OpenButton）
test("test_open_button", async () => {
  // 準備・実行
  const page = await open("open-button");
  // 検証
  const opener = await readOpener(page);
  expect(opener.attributes).toMatchObject({
    type: "button",
    "aria-haspopup": "dialog",
    "data-media-kind": "video",
  });
  expect(opener.label).toBe("素材 1");
  expect(opener.iconDisplay).not.toBe("none");
  expect(opener.wrapped).toBe(false);
  expect(opener.hasPlayer).toBe(false);
  // Tab でフォーカスできる
  await page.keyboard.press("Tab");
  await expect(
    page.evaluate(() =>
      document.activeElement?.classList.contains("mdmark-media-open"),
    ),
  ).resolves.toBe(true);
});

// 表のセルの中の音声は、音声のアイコンのボタンにする（OpenButtonAudio）
test("test_open_button_audio", async () => {
  // 準備・実行
  const page = await open("open-button-audio");
  // 検証
  const opener = await readOpener(page);
  expect(opener.attributes["data-media-kind"]).toBe("audio");
  expect(opener.label).toBe("読み上げ");
  expect(opener.hasPlayer).toBe(false);
});

// 段落の動画は、ボタンの後ろにキャプションを置いて包む（OpenButtonCaption）
test("test_open_button_caption", async () => {
  // 準備・実行
  const page = await open("open-button-caption");
  // 検証
  const opener = await readOpener(page);
  expect(opener.wrapped).toBe(true);
  expect(opener.caption).toBe("保存までの操作");
  expect(opener.attributes["data-media-caption"]).toBe("保存までの操作");
});

// 長いラベルはボタンの中で折り返し、はみ出さない（OpenButtonLongLabel）
test("test_open_button_long_label", async () => {
  // 準備・実行
  const page = await open("open-button-long-label");
  // 検証
  const opener = await readOpener(page);
  expect(opener.buttonRight).toBeLessThanOrEqual(opener.frameRight + 1);
});

// thumbnail の動画は、poster の画像に再生のアイコンを重ねる（OpenThumbnail）
test("test_open_thumbnail", async () => {
  // 準備・実行
  const page = await open("open-thumbnail");
  // 検証
  const thumb = await page
    .locator("button.mdmark-media-thumb")
    .evaluate((button) => {
      const image = button.querySelector("img") as HTMLImageElement;
      return {
        label: button.getAttribute("aria-label"),
        alt: image.getAttribute("alt"),
        height: image.getBoundingClientRect().height,
        icon: button.querySelector(".mdmark-media-thumb-icon svg") !== null,
        text: button.querySelector(".mdmark-media-open-label"),
      };
    });
  expect(thumb.label).toBe("素材 2");
  expect(thumb.alt).toBe("");
  expect(thumb.height).toBeGreaterThan(0);
  expect(thumb.icon).toBe(true);
  expect(thumb.text).toBeNull();
});

// 印刷では、枠線と再生のアイコンを出さず、ラベルとキャプションを出す（OpenButtonPrint）
test("test_open_button_print", async () => {
  // 準備
  const page = await open("open-button-print");
  // 実行
  await page.emulateMedia({ media: "print" });
  // 検証
  const opener = await readOpener(page);
  expect(opener.iconDisplay).toBe("none");
  expect(opener.borderWidth).toBe("0px");
  expect(opener.label).toBe("操作の様子");
  expect(opener.caption).toBe("保存までの操作");
});
