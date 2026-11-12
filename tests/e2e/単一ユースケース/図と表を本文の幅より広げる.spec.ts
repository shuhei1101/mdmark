import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 8 列の表 */
const WIDE_TABLE = [
  "| 項目 | 1 月 | 2 月 | 3 月 | 4 月 | 5 月 | 6 月 | 備考 |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  "| 売上 | 1,200,000 | 1,350,000 | 1,410,000 | 1,280,000 | 1,520,000 | 1,610,000 | 前年比で増加した |",
].join("\n");

/** 本文の幅を 640px にする利用側の CSS */
const HOST_CSS = "#doc { --mdmark-content-width: 640px; margin-inline: auto; }";

/** 段落の前後に wide の範囲を持つ文書 */
function wideMarkdown(open = "<!-- wide -->"): string {
  return [
    "前の段落",
    "",
    open,
    "",
    WIDE_TABLE,
    "",
    "<!-- /wide -->",
    "",
    "後ろの段落",
    "",
  ].join("\n");
}

/** 要素の左端・右端・幅 */
async function boxOf(page: import("@playwright/test").Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
}

/** 文書に横のスクロールが出ていないか */
function noPageScroll(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
}

// 範囲を本文の幅より広げ、本文の列の中央にそろえる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot, { hostCss: HOST_CSS });
  // 実行
  await mountDocument(page, { markdown: wideMarkdown() });
  // 検証
  const paragraph = await boxOf(page, "#doc p");
  await expect
    .poll(async () => (await boxOf(page, "#doc .mdmark-wide-range")).width)
    .toBeGreaterThan(640);
  const range = await boxOf(page, "#doc .mdmark-wide-range");
  expect(Math.round(paragraph.width)).toBeLessThanOrEqual(640);
  expect(range.width).toBeLessThanOrEqual(1280);
  const center = (box: { left: number; right: number }) =>
    (box.left + box.right) / 2;
  expect(Math.abs(center(range) - center(paragraph))).toBeLessThanOrEqual(2);
  expect(await noPageScroll(page)).toBe(true);
  await expect(page.locator("#doc .mdmark-wide-range.is-wide")).toHaveCount(0);
  expect(await page.locator("#doc").innerHTML()).not.toContain("<!--");
});

// 右側の目次と並ぶときは、目次に重ならずに広げる（正常シナリオ（右側の目次と並ぶ））
test("test_normal_when_side_toc_shown", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot, { hostCss: HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: [
      "## 概要",
      "",
      wideMarkdown(),
      ...Array.from({ length: 30 }, (_, i) => `間の段落 ${i + 1}\n`),
      "## 詳細",
      "",
      "詳細の段落",
      "",
    ].join("\n"),
    config: { "side-toc": { mode: "fixed" } },
  });
  await page.locator(".mdmark-side-toc-toggle").click();
  // 検証
  const panel = await boxOf(page, ".mdmark-side-toc-panel");
  await expect
    .poll(async () => (await boxOf(page, "#doc .mdmark-wide-range")).width)
    .toBeGreaterThan((await boxOf(page, "#doc .mdmark-content p")).width);
  expect(
    (await boxOf(page, "#doc .mdmark-wide-range")).right,
  ).toBeLessThanOrEqual(panel.left + 1);
  // 実行
  await page.locator(".mdmark-side-toc-list a", { hasText: "詳細" }).click();
  // 検証
  await expect(page.locator("#doc h2", { hasText: "詳細" })).toBeInViewport();
});

// 狭い画面では本文の幅のまま、表を範囲の中で横にスクロールさせる（正常シナリオ（狭い画面））
test("test_normal_when_narrow", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, builtRoot, { hostCss: HOST_CSS });
  // 実行
  await mountDocument(page, { markdown: wideMarkdown() });
  // 検証
  const paragraph = await boxOf(page, "#doc p");
  const range = await boxOf(page, "#doc .mdmark-wide-range");
  expect(Math.abs(range.width - paragraph.width)).toBeLessThanOrEqual(1);
  const scrollable = await page
    .locator("#doc .mdmark-wide-range table")
    .evaluate((table) =>
      [
        table,
        table.closest(".mdmark-table-scroll"),
        table.closest(".mdmark-wide-range"),
      ].some(
        (element) =>
          element !== null && element.scrollWidth > element.clientWidth,
      ),
    );
  expect(scrollable).toBe(true);
  expect(await noPageScroll(page)).toBe(true);
});

// 閉じのマーカーが無いときは、警告を配置して本文の幅で描く（異常シナリオ（wide の閉じのマーカーが無い））
test("test_error_when_unclosed", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot, { hostCss: HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: ["前の段落", "", "<!-- wide -->", "", WIDE_TABLE, ""].join("\n"),
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "<!-- /wide -->",
  );
  await expect(page.locator("#doc .mdmark-wide-range")).toHaveCount(0);
  const paragraph = await boxOf(page, "#doc p");
  const table = await boxOf(page, "#doc .mdmark-table");
  expect(table.width).toBeLessThanOrEqual(paragraph.width + 1);
});

// 範囲の上のボタンで、広げた幅と本文の幅を切り替える（正常シナリオ（広げた幅と本文の幅を切り替える））
test("test_normal_when_toggled", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot, { hostCss: HOST_CSS });
  await mountDocument(page, { markdown: wideMarkdown() });
  const button = page.locator("#doc .mdmark-wide-toggle");
  const rangeWidth = async () =>
    (await boxOf(page, "#doc .mdmark-wide-range")).width;
  const paragraph = (await boxOf(page, "#doc p")).width;
  // 検証: 描いた直後
  await expect.poll(rangeWidth).toBeGreaterThan(paragraph);
  await expect(button).toHaveAccessibleName("広げて表示");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toHaveText("");
  const before = await button.boundingBox();
  // 実行
  await button.click();
  // 検証
  await expect.poll(rangeWidth).toBeCloseTo(paragraph, 0);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toHaveAccessibleName("広げて表示");
  expect((await button.boundingBox())?.x).toBeCloseTo(before?.x ?? 0, 0);
  // 実行・検証: もう一度押す
  await button.click();
  await expect.poll(rangeWidth).toBeGreaterThan(paragraph);
  // 実行・検証: Enter で押す
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  // 実行・検証: 狭い画面
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(button).toBeHidden();
});

// closed で始めた範囲は本文の幅から始まり、押すと広がる（正常シナリオ（本文の幅から始める））
test("test_normal_when_starts_narrow", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot, { hostCss: HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: wideMarkdown('<!-- wide: {"open": false} -->'),
  });
  // 検証
  const button = page.locator("#doc .mdmark-wide-toggle");
  const paragraph = (await boxOf(page, "#doc p")).width;
  const rangeWidth = async () =>
    (await boxOf(page, "#doc .mdmark-wide-range")).width;
  expect(await rangeWidth()).toBeCloseTo(paragraph, 0);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  // 実行
  await button.click();
  // 検証
  await expect.poll(rangeWidth).toBeGreaterThan(paragraph);
  expect(await page.locator("#doc").innerHTML()).not.toContain("<!--");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});
