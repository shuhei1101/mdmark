import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 2 つの見出しを持つタブの範囲
const TABS_MARKDOWN = [
  "<!-- tabs -->",
  "",
  "### macOS",
  "",
  "macOS の段落",
  "",
  "### Windows",
  "",
  "Windows の段落",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 見出しの文字をタブ名にしたタブを描き、押したタブの中身だけを出す（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: TABS_MARKDOWN });
  const mac = page.getByRole("tab", { name: "macOS" });
  const windows = page.getByRole("tab", { name: "Windows" });
  // 検証: 描いた直後
  await expect(mac).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("macOS の段落")).toBeVisible();
  await expect(page.getByText("Windows の段落")).toBeHidden();
  // 実行
  await windows.click();
  // 検証
  await expect(windows).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Windows の段落")).toBeVisible();
  await expect(page.getByText("macOS の段落")).toBeHidden();
  await expect(page.locator("#doc h3")).toHaveCount(0);
});

// 右矢印キーで次のタブを選び、フォーカスも移る（正常シナリオ（キーボードで切り替える））
test("test_normal_when_keyboard", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: TABS_MARKDOWN });
  await page.getByRole("tab", { name: "macOS" }).focus();
  // 実行
  await page.keyboard.press("ArrowRight");
  // 検証
  const windows = page.getByRole("tab", { name: "Windows" });
  await expect(windows).toBeFocused();
  await expect(windows).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Windows の段落")).toBeVisible();
  await expect(page.getByText("macOS の段落")).toBeHidden();
});

// 見出しの無い範囲は、中身をそのまま描き、書き方の警告を出す（異常シナリオ（見出しの無い範囲））
test("test_error_when_no_heading", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "<!-- tabs -->\n\n見出しの無い段落\n\n<!-- /tabs -->\n",
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "見出し",
  );
  await expect(page.getByText("見出しの無い段落")).toBeVisible();
  await expect(page.locator("#doc [role=tablist]")).toHaveCount(0);
});
