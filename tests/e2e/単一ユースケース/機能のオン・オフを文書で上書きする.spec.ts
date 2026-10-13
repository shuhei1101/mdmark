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

// 閉じた折り畳みを持つ文書の本体
const DETAILS = "<details><summary>折り畳み</summary>中身</details>\n";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 設定でオンの機能を、文書の印でその文書だけオフにする（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.emulateMedia({ media: "print" });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `<!-- features: -print -->\n\n${DETAILS}`,
    config: { features: { print: true } },
  });
  // 実行
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect(page.locator("#doc details")).not.toHaveAttribute("open", "");
});

// 設定でオフにした機能を、文書の印でオンにする（正常シナリオ（設定でオフにした機能を文書でオンにする））
test("test_normal_when_enabled_by_mark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ media: "print" });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `<!-- features: +print -->\n\n${DETAILS}`,
    config: { features: { print: false } },
  });
  // 実行
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect(page.locator("#doc details")).toHaveAttribute("open", "");
});

// 印の無い文書は、設定のとおりにする（正常シナリオ（印の無い文書））
test("test_normal_when_no_mark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ media: "print" });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: DETAILS,
    config: { features: { print: false } },
  });
  // 実行
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect(page.locator("#doc details")).not.toHaveAttribute("open", "");
});

// 知らない機能名は無視して、本文を描く（正常シナリオ（知らない機能名））
test("test_normal_when_unknown_feature", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "<!-- features: +unknown -->\n\n段落\n",
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("p")).toHaveText("段落");
  const html = await doc.innerHTML();
  expect(html).not.toContain("features");
  expect(html).not.toContain("unknown");
});
