import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 段落とリンクを持つ見本の Markdown
const MARKDOWN = "段落\n\n[リンク](https://example.com/page)\n";

// デザイン方針の modern の値（明るい配色のリンクの色と、ダークの配色の地の色）
const LIGHT_LINK_COLOR = "rgb(9, 105, 218)";
const DARK_BACKGROUND = "rgb(13, 17, 23)";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 使う側が層の外に書いた CSS と変数の上書きが、mdmark の CSS に勝つ（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  const hostCss =
    "a { text-decoration: none } .mdmark { --mdmark-color-link: rgb(255, 0, 0) }";
  await openPage(page, builtRoot, { hostCss });
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  const link = page.locator("#doc a");
  await expect(link).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(link).toHaveCSS("text-decoration-line", "none");
});

// 何も上書きしなければ、既定の明るい配色で描く（正常シナリオ（上書きしない））
test("test_normal_when_not_overridden", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  await expect(page.locator("#doc a")).toHaveCSS("color", LIGHT_LINK_COLOR);
});

// OS の設定がダークのとき、ダークの配色で描く（正常シナリオ（ダークの配色））
test("test_normal_when_dark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "dark" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  await expect(page.locator("#doc")).toHaveCSS(
    "background-color",
    DARK_BACKGROUND,
  );
});
