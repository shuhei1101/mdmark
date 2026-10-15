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
  await expect(doc).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
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

// 印刷の前にタブの全ての中身と閉じた記法を開き、印刷の後に元の表示へ戻す（正常シナリオ（記法を開いて出す））
test("test_normal_when_syntax_expanded", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "<!-- tabs -->",
      "",
      "### macOS",
      "",
      "macOS の中身",
      "",
      "### Windows",
      "",
      "Windows の中身",
      "",
      "<!-- /tabs -->",
      "",
      "## 補足",
      "<!-- section: closed -->",
      "",
      "閉じた節の中身",
      "",
      "| 名前 | 数 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "<!-- row-detail: 1 -->",
      "",
      "行の詳細の中身",
      "",
      "<!-- /row-detail -->",
      "",
      "<!-- table: data closed -->",
      "",
      "| 名前 |",
      "| --- |",
      "| 閉じた表の中身 |",
      "",
      "<!-- /table -->",
      "",
      "> [!NOTE]-",
      "> 閉じた注意書きの中身",
      "",
    ].join("\n"),
  });
  const doc = page.locator("#doc");
  const hiddenTexts = [
    "Windows の中身",
    "閉じた節の中身",
    "行の詳細の中身",
    "閉じた表の中身",
    "閉じた注意書きの中身",
  ];
  for (const text of hiddenTexts) {
    await expect(doc.getByText(text), text).toBeHidden();
  }
  // 実行: 印刷の前
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証: 印刷の前のイベントの後
  await expect(doc.locator(".mdmark-tab-title")).toHaveText([
    "macOS",
    "Windows",
  ]);
  for (const title of await doc.locator(".mdmark-tab-title").all()) {
    await expect(title).toBeVisible();
  }
  await expect(doc.getByText("macOS の中身")).toBeVisible();
  for (const text of hiddenTexts) {
    await expect(doc.getByText(text), text).toBeVisible();
  }
  // 実行: 印刷の後
  await page.emulateMedia({ media: "screen" });
  await sendPrintEvent(page, "afterprint");
  // 検証: 印刷の後のイベントの後
  await expect(doc.getByText("macOS の中身")).toBeVisible();
  for (const text of hiddenTexts) {
    await expect(doc.getByText(text), text).toBeHidden();
  }
});
