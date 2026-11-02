import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import { contrastRatio, resolveColor } from "../media.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 段落とリンクを持つ見本の Markdown（リンク 1 つだけの段落はカードにするため、文の中にリンクを置く）
const MARKDOWN =
  "段落\n\n詳しくは [リンク](https://example.com/page) を見る。\n";

// デザイン方針の theme-slate の値（明るい配色とダークの配色の地の色と、明るい配色のリンクの色）
const SLATE_LIGHT_BACKGROUND = "rgb(248, 250, 252)";
const SLATE_DARK_BACKGROUND = "rgb(15, 23, 42)";
const SLATE_LIGHT_LINK_COLOR = "rgb(29, 78, 216)";

// デザイン方針の theme-slate の明るい配色の、色のプリセットの green・red の文字の色
const SLATE_LIGHT_GREEN_TEXT = "rgb(4, 105, 76)";
const SLATE_LIGHT_RED_TEXT = "rgb(185, 28, 28)";

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

// 選んだテーマの明るい配色の色のプリセットで、バッジと本文の文字の色を描く（正常シナリオ（選んだテーマの色のプリセット））
test("test_normal_when_color_preset_in_theme", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "`badge:green:完了` と [決め手の 1 文]{color=red}\n",
    config: { colorTheme: "theme-slate" },
  });
  // 検証: theme-slate の明るい配色の green・red の文字の色
  const badge = page.locator("#doc .mdmark-badge[data-color]");
  const text = page.locator("#doc .mdmark-color[data-color]");
  await expect(badge).toHaveCSS("color", SLATE_LIGHT_GREEN_TEXT);
  await expect(text).toHaveCSS("color", SLATE_LIGHT_RED_TEXT);
  // 検証: 色を付けた文字と面のコントラスト
  const badgeColors = await badge.evaluate((element) => [
    getComputedStyle(element).color,
    getComputedStyle(element).backgroundColor,
  ]);
  expect(
    contrastRatio(badgeColors[0] ?? "", badgeColors[1] ?? ""),
  ).toBeGreaterThanOrEqual(4.5);
  const background = await resolveColor(page, "#doc", "var(--mdmark-color-bg)");
  expect(
    contrastRatio(SLATE_LIGHT_RED_TEXT, background),
  ).toBeGreaterThanOrEqual(4.5);
});
