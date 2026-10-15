import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  registerGreet,
  removeDistRoot,
  routeExtension,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 拡張の印を段落の間に持つ文書
const MARK_MARKDOWN = "前の段落\n\n<!-- greet: world -->\n\n後の段落\n";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 拡張を登録して文書を描くと、印の場所にモジュールが 1 回だけ読まれて描かれる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const requests = await routeExtension(page, 200);
  await registerGreet(page);
  // 実行
  await mountDocument(page, { markdown: MARK_MARKDOWN });
  // 検証
  await expect(page.locator("#doc [data-mdmark-slot]")).toHaveText(
    "greet:world",
  );
  expect(requests()).toBe(1);
  await expect(page.locator("#doc > p")).toHaveText(["前の段落", "後の段落"]);
});

// 印の無い文書では、拡張のモジュールを読まずに本文を描く（正常シナリオ（印が無い））
test("test_normal_when_no_mark", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const requests = await routeExtension(page, 200);
  await registerGreet(page);
  // 実行
  await mountDocument(page, { markdown: "段落だけの文書\n" });
  await page.waitForTimeout(300);
  // 検証
  expect(requests()).toBe(0);
  await expect(page.locator("#doc > p")).toHaveText("段落だけの文書");
});

// schema に合わない引数の印の場所に書き方の警告を出し、モジュールを読まない（異常シナリオ（引数が Schema に合わない））
test("test_error_when_args_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const requests = await routeExtension(page, 200);
  await registerGreet(page, { strict: true });
  // 実行
  await mountDocument(page, {
    markdown: "前の段落\n\n<!-- greet: World 2 -->\n\n後の段落\n",
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toContainText("1 つ目の World");
  await expect(warning).toContainText("2 つ目の 2");
  await page.waitForTimeout(300);
  expect(requests()).toBe(0);
  await expect(page.locator("#doc [data-mdmark-slot]")).toHaveCount(0);
  await expect(page.locator("#doc > p")).toHaveText(["前の段落", "後の段落"]);
});

// モジュールを読めない印の場所に知らせの枠を出し、ほかの本文は描く（異常シナリオ（モジュールを読めない））
test("test_error_when_module_not_found", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await routeExtension(page, 404);
  await registerGreet(page);
  // 実行
  await mountDocument(page, { markdown: MARK_MARKDOWN });
  // 検証
  const notice = page.locator("#doc .mdmark-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("greet");
  await expect(page.locator("#doc > p")).toHaveText(["前の段落", "後の段落"]);
});
