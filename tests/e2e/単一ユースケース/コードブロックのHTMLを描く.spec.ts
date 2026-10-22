import { expect, test } from "@playwright/test";
import { wrapHtml } from "../chart.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 範囲の HTML: 文字に色を付けた箱 2 つを横に並べる `div`、動くと `window.__mdmarkScriptRan` を `true` にする `script`、`onclick` を持つボタン
const HTML = [
  '<div style="display: flex; gap: 12px">',
  '  <div style="color: rgb(200, 0, 0)">一つ目の箱</div>',
  '  <div style="color: rgb(0, 0, 200)">二つ目の箱</div>',
  "</div>",
  "<script>window.__mdmarkScriptRan = true</script>",
  '<button onclick="window.__mdmarkScriptRan = true">押す</button>',
].join("\n");

// 範囲の外に置く `html` のコードブロック
const OUTSIDE = ["```html", "<p>範囲の外</p>", "```", ""].join("\n");

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 印で囲んだ html のコードブロックをその場の HTML として描き、スクリプトとイベントの属性を落とし、範囲の外のコードブロックはコードのまま出す（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: `${wrapHtml(HTML)}\n${OUTSIDE}` });
  // 検証: 色を付けた箱 2 つが横に並び、範囲の中にコードの pre が無い
  const html = page.locator("#doc .mdmark-html");
  await expect(html).toHaveCount(1);
  await expect(html.locator(":scope > div")).toHaveCSS("display", "flex");
  const boxes = html.locator(":scope > div > div");
  await expect(boxes).toHaveText(["一つ目の箱", "二つ目の箱"]);
  await expect(boxes.nth(0)).toHaveCSS("color", "rgb(200, 0, 0)");
  await expect(boxes.nth(1)).toHaveCSS("color", "rgb(0, 0, 200)");
  const first = await boxes.nth(0).boundingBox();
  const second = await boxes.nth(1).boundingBox();
  if (!first || !second) {
    throw new Error("箱の範囲を取れない");
  }
  expect(second.x).toBeGreaterThan(first.x + first.width - 1);
  expect(Math.abs(second.y - first.y)).toBeLessThan(1);
  await expect(html.locator("pre")).toHaveCount(0);
  // 範囲の外の html のコードブロックは、コードの pre のまま出る
  const code = page.locator("#doc pre");
  await expect(code).toHaveCount(1);
  await expect(code).toContainText("<p>範囲の外</p>");
  // script 要素が無く、動いていない
  await expect(page.locator("#doc script")).toHaveCount(0);
  expect(await page.evaluate(() => "__mdmarkScriptRan" in window)).toBe(false);
  // ボタンは描かれ、onclick を持たず、押してもスクリプトは動かない
  const button = html.locator("button");
  await expect(button).toHaveText("押す");
  await expect(button).not.toHaveAttribute("onclick", /.*/);
  await button.click();
  expect(await page.evaluate(() => "__mdmarkScriptRan" in window)).toBe(false);
  // 印のコメントは残らない
  expect(await page.locator("#doc").innerHTML()).not.toContain("<!--");
  // 描いた HTML の周りに拡大・縮小のボタンが無い
  await expect(html.locator("button")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "拡大" })).toHaveCount(0);
});

// html の機能をオフにすると、範囲のコードブロックもコードのまま出し、印のコメントを残さない（正常シナリオ（機能がオフ））
test("test_normal_when_feature_off", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `${wrapHtml(HTML)}\n${OUTSIDE}`,
    config: { features: { html: false } },
  });
  // 検証
  await expect(page.locator("#doc .mdmark-html")).toHaveCount(0);
  const code = page.locator("#doc pre");
  await expect(code).toHaveCount(2);
  await expect(code.first()).toContainText("一つ目の箱");
  await expect(code.nth(1)).toContainText("<p>範囲の外</p>");
  expect(await page.locator("#doc").innerHTML()).not.toContain("<!--");
});

// 範囲のコードブロックが 1 つでないときは、範囲の上に書き方の警告を出し、コードブロックはコードのまま、後ろの本文を描く（異常シナリオ（範囲にコードブロックが 1 つでない））
test("test_error_when_block_count_invalid", async ({ page }) => {
  // 準備
  const markdown = [
    "<!-- html -->",
    "",
    "```html",
    "<p>一つ目</p>",
    "```",
    "",
    "```html",
    "<p>二つ目</p>",
    "```",
    "",
    "<!-- /html -->",
    "",
    "後ろの段落",
    "",
  ].join("\n");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown });
  // 検証: 範囲の上に、コードブロックを 1 つだけ置くように促す警告がある
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText(
    "のコードブロックを 1 つだけ置いてください",
  );
  const code = page.locator("#doc pre");
  await expect(code).toHaveCount(2);
  await expect(code.nth(0)).toContainText("<p>一つ目</p>");
  await expect(code.nth(1)).toContainText("<p>二つ目</p>");
  const warningBox = await warning.boundingBox();
  const codeBox = await code.first().boundingBox();
  if (!warningBox || !codeBox) {
    throw new Error("警告かコードブロックの範囲を取れない");
  }
  expect(warningBox.y).toBeLessThan(codeBox.y);
  // 範囲の後ろの段落が描かれている
  await expect(page.locator("#doc p", { hasText: "後ろの段落" })).toBeVisible();
  await expect(page.locator("#doc .mdmark-html")).toHaveCount(0);
});
