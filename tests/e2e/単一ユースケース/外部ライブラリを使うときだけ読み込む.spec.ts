import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  LIB_URL,
  mountDocument,
  openPage,
  removeDistRoot,
  routeLibrary,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 外部ライブラリの印を持つ文書と、その印を対応表に足す設定
const MARKDOWN = "前の段落\n\n<!-- test-lib: a b -->\n\n後の段落\n";
const CONFIG = { libraries: { "test-lib": LIB_URL } };
// 読み込みが起きないことを確かめるために待つ時間（ミリ秒）
const SETTLE_MS = 500;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 文書に印があるときだけ、外部ライブラリを 1 回読んで印の場所に描かせる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  const requestCount = await routeLibrary(page, 200);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN, config: CONFIG });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("[data-mdmark-slot]")).toHaveText("drawn:a,b");
  expect(requestCount()).toBe(1);
  await expect(doc.locator("p")).toHaveText(["前の段落", "後の段落"]);
});

// 印の無い文書では、外部ライブラリを読まない（正常シナリオ（印が無い））
test("test_normal_when_no_mark", async ({ page }) => {
  // 準備
  const requestCount = await routeLibrary(page, 200);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: "段落\n", config: CONFIG });
  await page.waitForTimeout(SETTLE_MS);
  // 検証
  expect(requestCount()).toBe(0);
  await expect(page.locator("#doc p")).toHaveText("段落");
});

// 外部ライブラリを読めない印の場所だけを知らせの枠にし、ほかの本文は描く（異常シナリオ（外部ライブラリを読めない））
test("test_error_when_library_not_found", async ({ page }) => {
  // 準備
  await routeLibrary(page, 404);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN, config: CONFIG });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-notice")).toBeVisible();
  await expect(doc.locator(":scope > p")).toHaveText(["前の段落", "後の段落"]);
});
