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
const LIGHT_BACKGROUND = "rgb(255, 255, 255)";

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

// OS の配色がライトでも、祖先の `vscode-dark` でダークの配色で描き、class を外すと戻す（正常シナリオ（親の class でダークにする））
test("test_normal_when_parent_class_dark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    document.body.className = "vscode-dark";
  });
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc).toHaveCSS("background-color", DARK_BACKGROUND);
  await page.evaluate(() => {
    document.body.className = "vscode-light";
  });
  await expect(doc).toHaveCSS("background-color", LIGHT_BACKGROUND);
});

// OS の配色がダークでも、祖先の `vscode-light` でライトの配色で描き、`mdmark-theme-light` は `vscode-dark` に勝つ（正常シナリオ（親の class でライトにする））
test("test_normal_when_parent_class_light", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "dark" });
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    document.body.className = "vscode-light";
  });
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc).toHaveCSS("background-color", LIGHT_BACKGROUND);
  await page.evaluate(() => {
    document.body.className = "vscode-dark";
    document
      .getElementById("doc")
      ?.parentElement?.classList.add("mdmark-theme-light");
  });
  await expect(doc).toHaveCSS("background-color", LIGHT_BACKGROUND);
});

/** 3 列 60 行の表を、長い段落の間に置いた Markdown */
function layoutDocument(): string {
  const paragraph = `${"本文の長い段落です。".repeat(60)}\n`;
  const rows = Array.from(
    { length: 60 },
    (_, row) => `| 行${row + 1} | ${row + 1} | 値${row + 1} |`,
  );
  return [
    paragraph,
    "| 名前 | 数量 | 備考 |",
    "| --- | --- | --- |",
    ...rows,
    "",
    paragraph,
  ].join("\n");
}

// 使う側が見出し行を留める位置のずれと本文の幅を上書きすると、固定のヘッダーの下に見出し行が留まり、本文の幅が上限を超えない（正常シナリオ（見出し行の位置と本文の幅を変える））
test("test_normal_when_layout_overridden", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  const hostCss = [
    "body::before { content: ''; position: fixed; inset: 0 0 auto 0; height: 48px; background: rgb(200, 200, 200); z-index: 100 }",
    ".mdmark { --mdmark-sticky-top: 48px; --mdmark-content-width: 40rem }",
  ].join("\n");
  await openPage(page, builtRoot, { hostCss });
  await mountDocument(page, { markdown: layoutDocument() });
  // 検証: 本文の段落の幅が 40rem を超えない
  const paragraphWidth = (await page.locator("#doc > p").first().boundingBox())
    ?.width;
  expect(paragraphWidth).toBeLessThanOrEqual(640 + 0.5);
  expect(paragraphWidth).toBeGreaterThan(300);
  // 実行: 表の途中までページを縦にスクロールする
  const tableTop = await page
    .locator("#doc table")
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((top) => window.scrollTo(0, top), tableTop + 500);
  // 検証: 見出し行の上端が画面の上端から 48px の位置にあり、固定のヘッダーに隠れていない
  await expect
    .poll(async () =>
      page
        .locator("#doc thead th")
        .evaluateAll((cells) =>
          Math.max(
            ...cells.map((cell) =>
              Math.abs(cell.getBoundingClientRect().top - 48),
            ),
          ),
        ),
    )
    .toBeLessThanOrEqual(1);
});

// 何も上書きしないと、本文の幅に既定の上限が無く、画面を広げるとその幅を使う（正常シナリオ（既定の本文の幅））
test("test_normal_when_content_width_default", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `${"本文の長い段落です。".repeat(400)}\n`,
  });
  /** 描く先の要素の中身の幅と、段落の幅 */
  const widths = async () =>
    await page.locator("#doc").evaluate((doc) => {
      const style = getComputedStyle(doc);
      return {
        content:
          doc.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight),
        paragraph: (doc.querySelector("p") as Element).getBoundingClientRect()
          .width,
      };
    });
  // 検証: 1280px のとき
  const narrow = await widths();
  expect(Math.abs(narrow.paragraph - narrow.content)).toBeLessThanOrEqual(1);
  // 実行: 画面の幅を 1920px に広げる
  await page.setViewportSize({ width: 1920, height: 800 });
  // 検証: 1920px のとき
  await expect
    .poll(async () => {
      const wide = await widths();
      return Math.abs(wide.paragraph - wide.content);
    })
    .toBeLessThanOrEqual(1);
  expect((await widths()).paragraph).toBeGreaterThan(narrow.paragraph);
});
