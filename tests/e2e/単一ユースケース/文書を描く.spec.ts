import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  destroyDocument,
  mountDocument,
  openPage,
  removeDistRoot,
  SAMPLE_MARKDOWN,
  updateDocument,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 要素と Markdown を渡すと、要素の中に本文を描く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: SAMPLE_MARKDOWN });
  // 検証
  const doc = page.locator("#doc");
  for (const selector of [
    "h1",
    "p",
    "ul",
    "table",
    "pre > code",
    "a",
    "details",
  ]) {
    await expect(doc.locator(selector).first(), selector).toBeVisible();
  }
  await expect(doc.locator("a").first()).toHaveAttribute(
    "href",
    "https://example.com/page",
  );
});

// 本文だけを差し替える（正常シナリオ（本文を差し替える））
test("test_normal_when_updated", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: SAMPLE_MARKDOWN });
  // 実行
  await updateDocument(page, "# 新しい見出し");
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("h1")).toHaveText("新しい見出し");
  await expect(doc.locator("h1")).toHaveCount(1);
  await expect(doc.locator("p, table")).toHaveCount(0);
});

// 描いたものを片付け、片付けた後の差し替えは何も描かない（正常シナリオ（片付ける））
test("test_normal_when_destroyed", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: SAMPLE_MARKDOWN });
  // 実行
  await destroyDocument(page);
  await updateDocument(page, "# 描かれない");
  // 検証
  await expect(page.locator("#doc")).toBeEmpty();
});

// 未知の印を無視して、前後の段落を描く（正常シナリオ（未知の印がある））
test("test_normal_when_unknown_mark", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "前の段落\n\n<!-- unknown: 1 -->\n\n後の段落\n",
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("p")).toHaveText(["前の段落", "後の段落"]);
  const html = await doc.innerHTML();
  expect(html).not.toContain("<!--");
  expect(html).not.toContain("unknown");
});

// 文書に書いたスクリプトを落とし、リンクを押しても実行されない（正常シナリオ（文書にスクリプトがある））
test("test_normal_when_script_in_markdown", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    (window as unknown as { __ran: boolean }).__ran = false;
  });
  const markdown = [
    "<script>window.__ran = true</script>",
    "",
    '<a onclick="window.__ran = true" href="#top">押す</a> <a href="javascript:window.__ran = true">js</a>',
    "",
    "<details><summary>折り畳み</summary>中身</details>",
    "",
  ].join("\n");
  // 実行
  await mountDocument(page, { markdown });
  const doc = page.locator("#doc");
  for (const link of await doc.locator("a").all()) {
    await link.click();
  }
  // 検証
  const html = await doc.innerHTML();
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onclick");
  expect(html).not.toContain("javascript:");
  expect(
    await page.evaluate(() => (window as unknown as { __ran: boolean }).__ran),
  ).toBe(false);
  await expect(doc.locator("details")).toBeVisible();
});
