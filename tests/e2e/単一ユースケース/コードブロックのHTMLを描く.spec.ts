import { expect, test } from "@playwright/test";
import { wrapHtml } from "../chart.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  RANGE_COLOR,
  RANGE_CSS,
  RANGE_TS,
  rangeMarkdown,
  removeDistRoot,
  routeSyntax,
  routeTranspiler,
  updateDocument,
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
  const syntaxRequests = await routeSyntax(page);
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
  // 範囲の外の html のコードブロックだけが色分けされ、読むのは本体と html の言語のモジュール
  await expect(code.locator('span[class*="hljs-"]').first()).toBeVisible();
  expect(syntaxRequests()).toEqual(["core.min.js", "languages/xml.min.js"]);
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

/** 範囲の html: 箱 1 つと、動くと `window.__mdmarkScriptRan` を `true` にする `script` */
const RANGE_HTML = [
  '<div class="box">箱</div>',
  "<script>window.__mdmarkScriptRan = true</script>",
].join("\n");

/** 範囲の外に置く、範囲の箱と同じ class の箱の範囲 */
const OUTSIDE_BOX = rangeMarkdown({}, '<div class="box">範囲の外の箱</div>');

/** `html-scripts` をオンにした設定 */
const SCRIPTS_ON = { features: { "html-scripts": true } };

// 範囲の css を範囲の根の要素にだけ当て、ts の既定のエクスポートの関数を範囲の根の要素で呼び、本文の差し替えの前に destroy を呼ぶ（正常シナリオ（範囲のスクリプトと CSS））
test("test_normal_when_range_scripts", async ({ page }) => {
  // 準備
  const transpilerRequests = await routeTranspiler(page);
  await openPage(page, builtRoot);
  const markdown = [
    rangeMarkdown({ css: RANGE_CSS, ts: RANGE_TS }, RANGE_HTML),
    OUTSIDE_BOX,
  ].join("\n");
  // 実行
  await mountDocument(page, { markdown, config: SCRIPTS_ON });
  // 検証: 範囲の箱だけに css が当たる
  const scope = page.locator('#doc .mdmark-html[data-html-scope="0"]');
  const box = scope.locator(".box");
  await expect(box).toHaveCSS("background-color", RANGE_COLOR);
  await expect(page.locator("#doc .box").nth(1)).not.toHaveCSS(
    "background-color",
    RANGE_COLOR,
  );
  // 検証: 押すと根の要素に class が付き、もう一度押すと外れる
  await expect(async () => {
    await box.click();
    await expect(scope).toHaveClass(/\bis-open\b/, { timeout: 500 });
  }).toPass();
  await box.click();
  await expect(scope).not.toHaveClass(/\bis-open\b/);
  // 検証: css・ts はコードの pre で出ず、script は描かれず動かない
  await expect(page.locator("#doc pre")).toHaveCount(0);
  await expect(page.locator("#doc script")).toHaveCount(0);
  expect(await page.evaluate(() => "__mdmarkScriptRan" in window)).toBe(false);
  expect(transpilerRequests()).toBe(1);
  // 実行・検証: 本文を差し替えると destroy が 1 回呼ばれる
  await updateDocument(page, markdown);
  expect(
    await page.evaluate(() => Reflect.get(window, "__mdmarkDestroyed")),
  ).toBe(1);
});

// html-scripts がオフのとき、範囲の html だけを描き、css・ts をコードのまま出し、変換のライブラリを読まない（正常シナリオ（範囲のスクリプトの機能がオフ））
test("test_normal_when_range_scripts_off", async ({ page }) => {
  // 準備
  const transpilerRequests = await routeTranspiler(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: rangeMarkdown({ css: RANGE_CSS, ts: RANGE_TS }, RANGE_HTML),
  });
  // 検証
  const scope = page.locator("#doc .mdmark-html");
  const box = scope.locator(":scope > div");
  await expect(box).toHaveText("箱");
  await expect(box).not.toHaveCSS("background-color", RANGE_COLOR);
  await expect(page.locator("#doc pre code.language-css")).toHaveCount(1);
  await expect(page.locator("#doc pre code.language-ts")).toHaveCount(1);
  await box.click();
  await expect(scope).not.toHaveClass(/\bis-open\b/);
  expect(transpilerRequests()).toBe(0);
});

// 既定のエクスポートが関数でない範囲・例外を投げる範囲・ts と js を両方置いた範囲の上に書き方の警告を置き、範囲の HTML と本文は描く（異常シナリオ（範囲のスクリプトを動かせない））
test("test_error_when_range_script_invalid", async ({ page }) => {
  // 準備
  await routeTranspiler(page);
  await openPage(page, builtRoot);
  const markdown = [
    rangeMarkdown({ ts: "export default 1 as number;" }),
    rangeMarkdown({ js: 'export default () => { throw new Error("失敗"); };' }),
    rangeMarkdown({
      ts: "export default (): void => {};",
      js: "export default () => { window.__mdmarkBoth = true; };",
    }),
    "後ろの段落",
    "",
  ].join("\n");
  // 実行
  await mountDocument(page, { markdown, config: SCRIPTS_ON });
  // 検証
  const scopes = page.locator("#doc .mdmark-html");
  await expect(scopes).toHaveCount(3);
  const warningBefore = (index: number) =>
    scopes.nth(index).locator("xpath=preceding-sibling::*[1]");
  await expect(warningBefore(0)).toHaveClass(/mdmark-syntax-warning/);
  await expect(warningBefore(0)).toContainText("export default");
  await expect(warningBefore(1)).toHaveClass(/mdmark-syntax-warning/);
  await expect(warningBefore(1)).toContainText("例外を投げた");
  await expect(warningBefore(2)).toHaveClass(/mdmark-syntax-warning/);
  await expect(warningBefore(2)).toContainText("ts");
  await expect(warningBefore(2)).toContainText("js");
  for (const index of [0, 1, 2]) {
    await expect(scopes.nth(index).locator(".box")).toHaveText("箱");
  }
  expect(await page.evaluate(() => "__mdmarkBoth" in window)).toBe(false);
  await expect(page.locator("#doc p", { hasText: "後ろの段落" })).toHaveCount(
    1,
  );
});

// 変換のライブラリを読めないとき、ts と js の範囲に知らせの枠を置き、範囲の html・css と本文は描く（異常シナリオ（変換のライブラリを読めない））
test("test_error_when_transpiler_unavailable", async ({ page }) => {
  // 準備
  await routeTranspiler(page, 404);
  await openPage(page, builtRoot);
  const markdown = [
    rangeMarkdown({
      css: RANGE_CSS,
      ts: 'export default (root: HTMLElement): void => { root.dataset.ran = "1"; };',
    }),
    rangeMarkdown({
      js: 'export default (root) => { root.dataset.ran = "1"; };',
    }),
    "後ろの段落",
    "",
  ].join("\n");
  // 実行
  await mountDocument(page, { markdown, config: SCRIPTS_ON });
  // 検証
  const scopes = page.locator("#doc .mdmark-html");
  await expect(page.locator("#doc .mdmark-notice")).toHaveCount(2);
  for (const index of [0, 1]) {
    await expect(
      scopes.nth(index).locator("xpath=preceding-sibling::*[1]"),
    ).toHaveClass(/mdmark-notice/);
    await expect(scopes.nth(index).locator(".box")).toHaveText("箱");
    await expect(scopes.nth(index)).not.toHaveAttribute("data-ran", /.*/);
  }
  await expect(page.locator("#doc .mdmark-notice").first()).toContainText(
    "スクリプトを動かせません",
  );
  await expect(scopes.nth(0).locator(".box")).toHaveCSS(
    "background-color",
    RANGE_COLOR,
  );
  await expect(page.locator("#doc p", { hasText: "後ろの段落" })).toHaveCount(
    1,
  );
});
