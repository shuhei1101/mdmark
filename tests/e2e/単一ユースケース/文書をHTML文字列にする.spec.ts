import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  openPage,
  removeDistRoot,
  renderInNode,
  renderInPage,
  SAMPLE_MARKDOWN,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// DOM を持たない Node の処理が、Markdown を HTML 文字列にする（正常シナリオ）
test("test_normal", async () => {
  // 準備・実行
  const html = await renderInNode(builtRoot, SAMPLE_MARKDOWN);
  // 検証
  for (const element of [
    "<h1>",
    "<p>",
    "<ul>",
    "<table",
    "<pre",
    "<code",
    "<a ",
    "<details>",
  ]) {
    expect(html, element).toContain(element);
  }
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<!--");
});

// ブラウザで返った HTML 文字列が Node の文字列と一致し、ページには描かない（正常シナリオ（ブラウザで呼ぶ））
test("test_normal_when_in_browser", async ({ page }) => {
  // 準備
  const nodeHtml = await renderInNode(builtRoot, SAMPLE_MARKDOWN);
  await openPage(page, builtRoot);
  const before = await page.locator("#doc").innerHTML();
  // 実行
  const browserHtml = await renderInPage(page, SAMPLE_MARKDOWN);
  // 検証
  expect(browserHtml).toBe(nodeHtml);
  expect(await page.locator("#doc").innerHTML()).toBe(before);
});
