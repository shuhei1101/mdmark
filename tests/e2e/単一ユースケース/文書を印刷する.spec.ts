import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  sendPrintEvent,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 閉じた折り畳みとリンクと表を持つ見本の Markdown
const MARKDOWN = [
  "<details><summary>閉</summary>x</details>",
  "",
  "[リンク](https://example.com/page)",
  "",
  "| 列A | 列B |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
].join("\n");

// 明るい配色の `--mdmark-color-bg`（デザイン方針の modern）
const LIGHT_BACKGROUND = "#ffffff";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// ダークのページを印刷すると、折り畳みを開き、明るい配色で、リンクの URL を併記し、表を改ページで切らない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "dark" });
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: MARKDOWN });
  // 実行
  await page.emulateMedia({ colorScheme: "dark", media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("details")).toHaveAttribute("open", "");
  expect(
    await doc.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--mdmark-color-bg").trim(),
    ),
  ).toBe(LIGHT_BACKGROUND);
  const urlSuffix = await doc
    .locator("a")
    .evaluate((link) => getComputedStyle(link, "::after").content);
  expect(urlSuffix).toContain("https://example.com/page");
  await expect(doc.locator("table")).toHaveCSS("break-inside", "avoid");
});

// 印刷を終えると、印刷の前の開閉に戻る（正常シナリオ（印刷を終える））
test("test_normal_when_print_finished", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "<details><summary>閉</summary>x</details>\n\n<details open><summary>開</summary>y</details>\n",
  });
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 実行
  await page.emulateMedia({ media: "screen" });
  await sendPrintEvent(page, "afterprint");
  // 検証
  const [closed, opened] = await page.locator("#doc details").all();
  await expect(closed).not.toHaveAttribute("open", "");
  await expect(opened).toHaveAttribute("open", "");
});
