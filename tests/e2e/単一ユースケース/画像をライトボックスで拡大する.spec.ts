import { expect, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import { colorSvg, routePageFiles } from "../media.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// ライトボックスが画面の端から空ける幅（図の全画面と同じ）
const SCREEN_INSET = 16;

// 画像の間に挟む、画面より長い本文の段落
const PARAGRAPH = "画像の間に挟む本文の段落です。".repeat(80);

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await routePageFiles(page, {
    "a.png": colorSvg({ width: 640, height: 400, color: "#0f766e" }),
    "b.png": colorSvg({ width: 640, height: 400, color: "#b45309" }),
    "c.png": colorSvg({ width: 640, height: 400, color: "#6d28d9" }),
  });
});

/** 3 つの画像を本文の段落を挟んで並べた文書を描く。`second` は 2 つ目の画像の記載方法 */
async function mountImages(
  page: Page,
  second = "![画像 b](b.png)",
): Promise<void> {
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "![画像 a](a.png)",
      "",
      PARAGRAPH,
      "",
      second,
      "",
      PARAGRAPH,
      "",
      "![画像 c](c.png)",
      "",
    ].join("\n"),
  });
}

/** 開いているライトボックス */
function lightbox(page: Page) {
  return page.locator("#doc dialog.mdmark-lightbox[open]");
}

/** ライトボックスに出ている画像のファイル名 */
async function shownImage(page: Page): Promise<string> {
  const src = await lightbox(page)
    .locator(".mdmark-lightbox-stage img")
    .getAttribute("src");
  return new URL(src ?? "", "https://app.example.test/").pathname.slice(1);
}

// 画像を押して全画面で拡大し、矢印キーとボタンで前後に切り替え、Esc で閉じて押した画像とスクロールの位置へ戻る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await mountImages(page);
  const second = page.locator("#doc button.mdmark-image-open").nth(1);
  await second.scrollIntoViewIfNeeded();
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeGreaterThan(0);
  // 実行: 2 つ目の画像を押す
  await second.click();
  // 検証: 全画面のダイアログで b.png
  const dialog = lightbox(page);
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  // 画面の端から 16px 空けて画面いっぱいに広げる
  expect(box?.x).toBeCloseTo(SCREEN_INSET, 0);
  expect(box?.y).toBeCloseTo(SCREEN_INSET, 0);
  expect(box?.width).toBeCloseTo((viewport?.width ?? 0) - SCREEN_INSET * 2, 0);
  expect(box?.height).toBeCloseTo(
    (viewport?.height ?? 0) - SCREEN_INSET * 2,
    0,
  );
  expect(await shownImage(page)).toBe("b.png");
  await expect(dialog.locator(".mdmark-lightbox-count")).toHaveText("2 / 3");
  // 検証: 前へ・次へ・閉じるのボタンがスクリーンリーダー向けの名前を持つ
  for (const [tool, label] of [
    ["prev", "前の画像"],
    ["next", "次の画像"],
    ["close", "拡大を閉じる"],
  ]) {
    await expect(dialog.locator(`[data-tool="${tool}"]`)).toHaveAttribute(
      "aria-label",
      label,
    );
  }
  // 検証: Tab のフォーカスがダイアログの外へ出ず、ダイアログの中で循環する
  const visited: string[] = [];
  for (let press = 0; press < 16; press += 1) {
    await page.keyboard.press("Tab");
    visited.push(
      await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body) {
          return "body";
        }
        return active.closest("dialog.mdmark-lightbox")
          ? (active.getAttribute("data-tool") ??
              active.getAttribute("class") ??
              "dialog")
          : "outside";
      }),
    );
  }
  expect(visited).not.toContain("outside");
  const inDialog = visited.filter((label) => label !== "body");
  expect(new Set(inDialog).size).toBeLessThan(inDialog.length);
  // 実行・検証: 右の矢印キーで c.png
  await dialog.locator('[data-tool="close"]').focus();
  await page.keyboard.press("ArrowRight");
  expect(await shownImage(page)).toBe("c.png");
  await expect(dialog.locator(".mdmark-lightbox-count")).toHaveText("3 / 3");
  // 実行・検証: 前へのボタンを 2 回押して a.png
  await dialog.locator('[data-tool="prev"]').click();
  await dialog.locator('[data-tool="prev"]').click();
  expect(await shownImage(page)).toBe("a.png");
  await expect(dialog.locator(".mdmark-lightbox-count")).toHaveText("1 / 3");
  // 実行: Esc を押す
  await page.keyboard.press("Escape");
  // 検証: 閉じて、2 つ目の画像へフォーカスが戻り、スクロールの位置が押す前と同じ
  await expect(page.locator("#doc dialog.mdmark-lightbox")).toHaveCount(0);
  await expect(second).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
});

// Tab で画像にフォーカスし、拡大できることをスクリーンリーダーで通知し、Enter で開く（正常シナリオ（キーで開く））
test("test_normal_when_opened_by_key", async ({ page }) => {
  // 準備
  await mountImages(page);
  // 実行: Tab で 1 つ目の画像にフォーカスする
  await page.keyboard.press("Tab");
  // 検証
  const first = page.locator("#doc button.mdmark-image-open").first();
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-label", "画像を拡大: 画像 a");
  // 実行: Enter を押す
  await page.keyboard.press("Enter");
  // 検証
  await expect(lightbox(page)).toBeVisible();
  expect(await shownImage(page)).toBe("a.png");
  await expect(lightbox(page).locator(".mdmark-lightbox-count")).toHaveText(
    "1 / 3",
  );
});

// nolightbox の画像は押しても開かず、Tab でフォーカスされず、切り替えの並びから除外する（正常シナリオ（拡大しない画像））
test("test_normal_when_nolightbox", async ({ page }) => {
  // 準備
  await mountImages(page, "![アイコン](b.png){nolightbox}");
  // 実行: 2 つ目の画像を押す
  const icon = page.locator('#doc img[alt="アイコン"]');
  await icon.click();
  // 検証: 開かず、拡大のボタンで包んでいない
  await expect(page.locator("#doc dialog.mdmark-lightbox")).toHaveCount(0);
  await expect(page.locator("#doc button.mdmark-image-open")).toHaveCount(2);
  expect(
    await icon.evaluate((element) => element.closest("button")),
  ).toBeNull();
  // 検証: 1 つ目の画像から Tab を押すと、2 つ目の画像を飛ばして 3 つ目の画像にフォーカスが該当する
  await page.locator("#doc button.mdmark-image-open").first().focus();
  await page.keyboard.press("Tab");
  await expect(
    page.locator("#doc button.mdmark-image-open").nth(1),
  ).toBeFocused();
  await expect(
    page.locator("#doc button.mdmark-image-open").nth(1),
  ).toHaveAttribute("aria-label", "画像を拡大: 画像 c");
  // 実行: 1 つ目の画像を押してから右の矢印キーを押す
  await page.locator("#doc button.mdmark-image-open").first().click();
  await expect(lightbox(page)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  // 検証: b.png を飛ばして c.png を出し、枚数が 2 枚
  expect(await shownImage(page)).toBe("c.png");
  await expect(lightbox(page).locator(".mdmark-lightbox-count")).toHaveText(
    "2 / 2",
  );
});
