import { expect, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  updateDocument,
} from "../dist-page.ts";
import {
  colorSvg,
  type MediaSamples,
  readMediaSamples,
  routePageFiles,
} from "../media.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";
// 見本の動画・音声・GIF・poster の画像
let media: MediaSamples;

// 回り込みを確かめる本文の段落
const PARAGRAPH = "画像の右に回り込む本文の段落です。".repeat(20);

// GIF を撮る間隔（GIF のフレームの間隔 100ms より長い）
const GIF_INTERVAL_MS = 500;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
  media = await readMediaSamples();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

test.beforeEach(async ({ page }) => {
  await routePageFiles(page, {
    "chart.png": colorSvg({ width: 600, height: 300, color: "#0f766e" }),
    "photo.png": colorSvg({ width: 400, height: 300, color: "#b45309" }),
    "arch-dark.png": colorSvg({ width: 300, height: 160, color: "#111113" }),
    "arch-light.png": colorSvg({ width: 300, height: 160, color: "#f4f4f5" }),
    ...Object.fromEntries(
      ["a", "b", "c", "d", "e", "f"].map((name) => [
        `${name}.png`,
        colorSvg({ width: 320, height: 200, color: "#6d28d9" }),
      ]),
    ),
  });
});

/** 動画・音声・GIF・poster の画像を、ページのオリジンの下で返す */
async function routeMedia(page: Page): Promise<void> {
  await routePageFiles(page, {
    "demo.mp4": { body: media.mp4, contentType: "video/mp4" },
    "voice.mp3": { body: media.mp3, contentType: "audio/mpeg" },
    "demo.png": { body: media.poster, contentType: "image/png" },
    "anim.gif": { body: media.gif, contentType: "image/gif" },
  });
}

/** 描く先の要素の本文の列の左端・右端・幅 */
async function readContent(page: Page) {
  return page.locator("#doc").evaluate((doc) => {
    const style = getComputedStyle(doc);
    const box = doc.getBoundingClientRect();
    const left = box.left + Number.parseFloat(style.paddingLeft);
    const right = box.right - Number.parseFloat(style.paddingRight);
    return { left, right, width: right - left };
  });
}

/** 要素の箱 */
async function boxOf(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`${selector} が出ていない`);
  }
  return { ...box, right: box.x + box.width, bottom: box.y + box.height };
}

/** GIF の範囲を 500ms 空けて 2 枚撮り、画素が同じかを返す */
async function gifStill(page: Page): Promise<boolean> {
  const gif = page.locator("#doc .mdmark-gif");
  const first = await gif.screenshot();
  await page.waitForTimeout(GIF_INTERVAL_MS);
  const second = await gif.screenshot();
  return first.equals(second);
}

/** GIF を描き、画像を読み終えるまで待つ */
async function mountGif(page: Page): Promise<void> {
  await routeMedia(page);
  await mountDocument(page, { markdown: "![ビルド](anim.gif)\n" });
  await page
    .locator("#doc .mdmark-gif img")
    .evaluate((image) => (image as HTMLImageElement).decode());
  await expect(page.locator("#doc button.mdmark-gif-toggle")).toHaveCount(1);
}

// 画像の後ろの属性の幅と配置を当て、title をキャプションにし、左に置いた画像の右に本文を回り込ませる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1000, height: 900 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '![グラフ](chart.png "売上の推移"){width=300 align=center}',
      "",
      "![写真](photo.png){width=40% align=left}",
      "",
      PARAGRAPH,
      "",
    ].join("\n"),
  });
  // 検証: 1 つ目は図に入り、キャプションと幅 300px で中央に置く
  const chart = page.locator('#doc figure:has(img[alt="グラフ"])');
  await expect(chart.locator("figcaption")).toHaveText("売上の推移");
  await expect(chart.locator('img[alt="グラフ"]')).toBeVisible();
  const content = await readContent(page);
  const chartImage = await boxOf(page, '#doc img[alt="グラフ"]');
  expect(chartImage.width).toBeCloseTo(300, 0);
  const leftGap = chartImage.x - content.left;
  const rightGap = content.right - chartImage.right;
  expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
  // 検証: 2 つ目は本文の列の 40% の幅で左に置き、後ろの段落が右に回り込む
  const photo = await boxOf(page, '#doc figure:has(img[alt="写真"])');
  expect(photo.width).toBeCloseTo(content.width * 0.4, 0);
  expect(photo.x).toBeCloseTo(content.left, 0);
  const firstLine = await page
    .locator("#doc p", { hasText: "回り込む" })
    .evaluate((paragraph) => {
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const rect = range.getClientRects()[0];
      return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
    });
  expect(firstLine.left).toBeGreaterThanOrEqual(photo.right);
  expect(firstLine.top).toBeLessThan(photo.bottom);
  // 検証: 属性の文字と警告を出さない
  const text = await page.locator("#doc").innerText();
  expect(text).not.toContain("{width=");
  expect(text).not.toContain("align=");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// ギャラリーの 6 つの画像を 3 列 2 行の格子に並べてサブ図の番号を付け、幅の狭い画面では列を減らす（正常シナリオ（ギャラリー））
test("test_normal_when_gallery", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- fig: shots -->",
      "<!-- gallery: cols=3 -->",
      ...["a", "b", "c", "d", "e", "f"].map(
        (name) => `![画面 ${name}](${name}.png)`,
      ),
      "<!-- /gallery -->",
      "",
    ].join("\n"),
  });
  // 検証: 3 列 2 行の格子
  const images = page.locator("#doc .mdmark-gallery img");
  await expect(images).toHaveCount(6);
  /** 格子の画像の箱の左端と上端（重ならない値の数） */
  const grid = () =>
    images.evaluateAll((elements) => {
      const boxes = elements.map((element) => element.getBoundingClientRect());
      const distinct = (values: number[]) =>
        new Set(values.map((value) => Math.round(value))).size;
      return {
        columns: distinct(boxes.map((box) => box.left)),
        rows: distinct(boxes.map((box) => box.top)),
      };
    });
  await expect.poll(grid).toEqual({ columns: 3, rows: 2 });
  // 検証: サブ図の番号
  await expect(page.locator("#doc .mdmark-gallery figcaption b")).toHaveText([
    "図 1a",
    "図 1b",
    "図 1c",
    "図 1d",
    "図 1e",
    "図 1f",
  ]);
  // 実行: 画面の幅を 390px にする
  await page.setViewportSize({ width: 390, height: 900 });
  // 検証: 列が 3 より少なく、横スクロールが出ない
  await expect.poll(async () => (await grid()).columns).toBeLessThan(3);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

// テーマごとの画像は、今の配色に合う画像だけを出し、配色を切り替えると出す画像を替える（正常シナリオ（テーマごとの画像））
test("test_normal_when_theme_images", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "![構成](arch-dark.png#only-dark)",
      "",
      "![構成](arch-light.png#only-light)",
      "",
    ].join("\n"),
  });
  // 検証: ライト
  const dark = page.locator('#doc img[src="arch-dark.png#only-dark"]');
  const light = page.locator('#doc img[src="arch-light.png#only-light"]');
  await expect(light).toBeVisible();
  await expect(dark).toBeHidden();
  // 実行: OS の配色をダークにする
  await page.emulateMedia({ colorScheme: "dark" });
  // 検証: ダーク
  await expect(dark).toBeVisible();
  await expect(light).toBeHidden();
});

// 拡張子で動画と音声を分け、再生バー付きの video と audio を描き、autoplay の動画に muted を当てる（正常シナリオ（動画と音声））
test("test_normal_when_video_and_audio", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await routeMedia(page);
  // 実行
  await mountDocument(page, {
    markdown: [
      '![操作の様子](demo.mp4 "保存までの操作"){autoplay loop poster=demo.png}',
      "",
      "![読み上げ](voice.mp3)",
      "",
    ].join("\n"),
  });
  // 検証: 動画
  const video = page.locator("#doc figure video");
  await expect(video).toHaveCount(1);
  for (const name of ["controls", "autoplay", "muted", "loop"]) {
    await expect(video).toHaveAttribute(name, "");
  }
  await expect(video).toHaveAttribute("src", "demo.mp4");
  await expect(video).toHaveAttribute("poster", "demo.png");
  await expect(page.locator("#doc figure:has(video) figcaption")).toHaveText(
    "保存までの操作",
  );
  expect(
    await video.evaluate((element) => (element as HTMLVideoElement).muted),
  ).toBe(true);
  // 検証: 音声
  const audio = page.locator("#doc figure audio");
  await expect(audio).toHaveCount(1);
  await expect(audio).toHaveAttribute("controls", "");
  await expect(audio).toHaveAttribute("src", "voice.mp3");
  await expect(page.locator("#doc figure:has(audio) figcaption")).toHaveCount(
    0,
  );
});

// GIF に止める・再生するボタンを付け、押すたびに止めるか動かし、外への要求を増やさない（正常シナリオ（GIF を止める・再生する））
test("test_normal_when_gif_toggled", async ({ page }) => {
  // 準備
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openPage(page, builtRoot);
  await mountGif(page);
  const toggle = page.locator("#doc button.mdmark-gif-toggle");
  // 検証: ボタンは Tab でフォーカスでき、読み上げの名前を持つ
  await expect(toggle).toHaveAttribute("aria-label", "GIF を停止");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  let reached = false;
  for (let press = 0; press < 5 && !reached; press += 1) {
    await page.keyboard.press("Tab");
    reached = await toggle.evaluate(
      (element) => document.activeElement === element,
    );
  }
  expect(reached).toBe(true);
  // 検証: 押す前は動いている
  expect(await gifStill(page)).toBe(false);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  // 実行: 止めるボタンを押す
  await toggle.click();
  // 検証
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAttribute("aria-label", "GIF を再生");
  expect(await gifStill(page)).toBe(true);
  // 実行: もう一度押す
  await toggle.click();
  // 検証
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await gifStill(page)).toBe(false);
  expect(requests).toEqual([]);
});

// 動きを減らす設定のとき、GIF を止めた状態で描く（正常シナリオ（動きを減らす設定の GIF））
test("test_normal_when_reduced_motion", async ({ page }) => {
  // 準備
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page, builtRoot);
  // 実行
  await mountGif(page);
  // 検証
  const toggle = page.locator("#doc button.mdmark-gif-toggle");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAttribute("aria-label", "GIF を再生");
  expect(await gifStill(page)).toBe(true);
});

// 読めない属性を書き方の警告にし、読めた配置だけを当て、幅は指定しないときと同じにする（異常シナリオ（読めない属性））
test("test_error_when_attribute_invalid", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1000, height: 900 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "![グラフ](chart.png){width=big align=center foo}\n",
  });
  // 検証: 画像の上に警告
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("width=big");
  await expect(warning).toContainText("foo");
  for (const name of ["width", "align", "nolightbox"]) {
    await expect(warning).toContainText(name);
  }
  const warningBox = await boxOf(page, "#doc .mdmark-syntax-warning");
  const image = await boxOf(page, '#doc img[alt="グラフ"]');
  expect(warningBox.bottom).toBeLessThanOrEqual(image.y);
  // 検証: 中央に置く
  const content = await readContent(page);
  expect(
    Math.abs(image.x - content.left - (content.right - image.right)),
  ).toBeLessThanOrEqual(1);
  // 検証: 幅は、幅を指定しない画像と同じ
  await updateDocument(page, "![グラフ](chart.png){align=center}\n");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
  const plain = await boxOf(page, '#doc img[alt="グラフ"]');
  expect(image.width).toBeCloseTo(plain.width, 0);
});
