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

// デザイン方針の theme-slate の値（明るい配色とダークの配色の地の色と、明るい配色のリンクの色）
const SLATE_LIGHT_BACKGROUND = "rgb(248, 250, 252)";
const SLATE_DARK_BACKGROUND = "rgb(15, 23, 42)";
const SLATE_LIGHT_LINK_COLOR = "rgb(29, 78, 216)";

// デザイン方針の dev-swiss の値（明るい配色の地の色とリンクの色）
const SWISS_LIGHT_BACKGROUND = "rgb(255, 255, 255)";
const SWISS_LIGHT_LINK_COLOR = "rgb(15, 118, 110)";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 設定で選んだテーマの明るい配色で、文書の地とリンクを描く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: MARKDOWN,
    config: { colorTheme: "theme-slate" },
  });
  // 検証
  await expect(page.locator("#doc")).toHaveCSS(
    "background-color",
    SLATE_LIGHT_BACKGROUND,
  );
  await expect(page.locator("#doc a")).toHaveCSS(
    "color",
    SLATE_LIGHT_LINK_COLOR,
  );
});

// OS の配色がダークのとき、選んだテーマの暗い配色で描く（正常シナリオ（ダークの配色））
test("test_normal_when_dark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "dark" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: MARKDOWN,
    config: { colorTheme: "theme-slate" },
  });
  // 検証
  await expect(page.locator("#doc")).toHaveCSS(
    "background-color",
    SLATE_DARK_BACKGROUND,
  );
});

// OS の配色がダークでも、親の `mdmark-theme-light` で選んだテーマの明るい配色にする（正常シナリオ（親の class で明るい配色にする））
test("test_normal_when_parent_class_light", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "dark" });
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    document.body.className = "mdmark-theme-light";
  });
  // 実行
  await mountDocument(page, {
    markdown: MARKDOWN,
    config: { colorTheme: "theme-slate" },
  });
  // 検証
  await expect(page.locator("#doc")).toHaveCSS(
    "background-color",
    SLATE_LIGHT_BACKGROUND,
  );
});

// テーマを選ばないと、既定のテーマ（dev-swiss）の明るい配色で描く（正常シナリオ（テーマを選ばない））
test("test_normal_when_not_selected", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN, config: {} });
  // 検証
  await expect(page.locator("#doc")).toHaveCSS(
    "background-color",
    SWISS_LIGHT_BACKGROUND,
  );
  await expect(page.locator("#doc a")).toHaveCSS(
    "color",
    SWISS_LIGHT_LINK_COLOR,
  );
});

// 知らないテーマの名前は無視し、例外を出さずに既定のテーマで描く（正常シナリオ（知らないテーマの名前））
test("test_normal_when_unknown_theme", async ({ page }) => {
  // 準備
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: MARKDOWN,
    config: { colorTheme: "sepia" },
  });
  // 検証
  await expect(page.locator("#doc p").first()).toHaveText("段落");
  await expect(page.locator("#doc a")).toHaveCSS(
    "color",
    SWISS_LIGHT_LINK_COLOR,
  );
  await expect(page.locator("#doc")).toHaveCSS(
    "background-color",
    SWISS_LIGHT_BACKGROUND,
  );
  expect(errors).toEqual([]);
});
