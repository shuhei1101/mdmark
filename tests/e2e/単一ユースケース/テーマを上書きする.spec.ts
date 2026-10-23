import { expect, test } from "@playwright/test";
import { flowMarkdown } from "../diagram.ts";
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

// デザイン方針の dev-swiss の値（明るい配色のリンクの色と、ダークの配色の地の色）
const LIGHT_LINK_COLOR = "rgb(15, 118, 110)";
const DARK_BACKGROUND = "rgb(19, 19, 22)";

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

// 使う側が図の層の色の変数を上書きすると、その層の箱の縁・層の背景・凡例の色が変わる（正常シナリオ（図の色を変える））
test("test_normal_when_diagram", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  const hostCss = ".mdmark { --mdmark-color-diagram-llm: rgb(255, 0, 0) }";
  await openPage(page, builtRoot, { hostCss });
  // 実行
  await mountDocument(page, { markdown: await flowMarkdown() });
  // 検証: LLM の層の箱の縁が上書きした色になり、ほかの層は変わらない
  await expect(page.locator('#doc [data-node="draft"]')).toHaveCSS(
    "border-top-color",
    "rgb(255, 0, 0)",
  );
  await expect(page.locator('#doc [data-node="mcp"]')).not.toHaveCSS(
    "border-top-color",
    "rgb(255, 0, 0)",
  );
  // LLM の層の背景は、上書きした色（赤）を薄く混ぜた色になる
  const background = await page
    .locator('#doc .mdmark-diagram-lane[data-kind="llm"]')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const [red = 0, green = 0, blue = 0] = (
    background.match(/[\d.]+/g) ?? []
  ).map(Number);
  expect(red).toBeGreaterThan(green);
  expect(red).toBeGreaterThan(blue);
});
