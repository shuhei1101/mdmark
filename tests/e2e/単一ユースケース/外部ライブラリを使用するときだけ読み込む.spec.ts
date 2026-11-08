import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  LIB_URL,
  mountDocument,
  openPage,
  removeDistRoot,
  routeLibrary,
  routeLucide,
  routeSyntax,
} from "../dist-page.ts";
import { routeMermaid } from "../mermaid.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// 外部ライブラリのマーカーを持つ文書と、そのマーカーを対応表に追加する設定
const MARKDOWN = "前の段落\n\n<!-- test-lib: a b -->\n\n後の段落\n";
const CONFIG = { libraries: { "test-lib": LIB_URL } };
// 読み込みが起きないことを確認するために待つ時間（ミリ秒）
const SETTLE_MS = 500;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 文書にマーカーがあるときだけ、外部ライブラリを 1 回読んでマーカーの場所に描かせる（正常シナリオ）
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

// マーカーの無い文書では、外部ライブラリを読み込まない（正常シナリオ（マーカーが無い））
test("test_normal_when_no_mark", async ({ page }) => {
  // 準備
  const requestCount = await routeLibrary(page, 200);
  const syntaxRequests = await routeSyntax(page);
  const mermaidRequests = await routeMermaid(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: "段落\n", config: CONFIG });
  await page.waitForTimeout(SETTLE_MS);
  // 検証
  expect(requestCount()).toBe(0);
  expect(syntaxRequests()).toEqual([]);
  expect(mermaidRequests()).toEqual([]);
  await expect(page.locator("#doc p")).toHaveText("段落");
});

// 外部ライブラリを読み込めないマーカーの場所だけを通知ブロックにし、ほかの本文は描く（異常シナリオ（外部ライブラリを読み込めない））
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

// 色分けする言語のコードブロックがあるときだけ、色分けのライブラリの本体と使用する言語のモジュールを読み込む。本体は配布物に含まれない（正常シナリオ（色分けするコードブロック））
test("test_normal_when_code_highlighted", async ({ page }) => {
  // 準備
  const syntaxRequests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "```ts",
      "const count: number = 1;",
      "```",
      "",
      "```yaml",
      "name: mdmark",
      "```",
      "",
    ].join("\n"),
  });
  // 検証
  const codes = page.locator("#doc pre code");
  await expect(codes).toHaveCount(2);
  for (const index of [0, 1]) {
    await expect(
      codes.nth(index).locator('span[class*="hljs-"]').first(),
    ).toBeVisible();
  }
  // 本体 1 件と、文書が使用する言語のモジュール 1 件ずつだけを読み込む
  expect(syntaxRequests()).toEqual([
    "core.min.js",
    "languages/typescript.min.js",
    "languages/yaml.min.js",
  ]);
  // 配布物に色分けのライブラリの本体が含まれていない
  const dist = await readFile(join(builtRoot, "dist", "index.js"), "utf8");
  expect(dist).not.toContain("highlightAuto");
  expect(dist).not.toContain("Highlight.js v");
});

/** まとめていない名前のアイコンを見出しと段落に持つ文書 */
const ICONS_MARKDOWN =
  "## `icon:sailboat` 航海\n\n前の文 `icon:anchor` 後ろの文\n";

// まとめていない名前のアイコンを、使用する名前の分だけ jsDelivr から読み込んで描く（正常シナリオ（まとめていない名前のアイコン））
test("test_normal_when_unbundled_icon", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const requests = await routeLucide(page);
  // 実行
  await mountDocument(page, { markdown: ICONS_MARKDOWN });
  // 検証
  await expect(
    page.locator('#doc .mdmark-inline-icon[data-icon="sailboat"] svg'),
  ).toHaveCount(1);
  await expect(
    page.locator('#doc .mdmark-inline-icon[data-icon="anchor"] svg'),
  ).toHaveCount(1);
  expect(requests.map((line) => line.replace(/^.*\//, "")).sort()).toEqual([
    "anchor.mjs",
    "sailboat.mjs",
  ]);
  await expect(page.locator("#doc")).toContainText("前の文");
  await expect(page.locator("#doc")).toContainText("後ろの文");
  // 実行: まとめていない名前を持たない文書
  requests.length = 0;
  await mountDocument(page, { markdown: "`icon:flag` だけの段落\n" });
  await page.waitForTimeout(500);
  // 検証
  expect(requests).toEqual([]);
});

// Lucide に無い名前は、警告を配置して記載したとおりの行内のコードで出す（異常シナリオ（Lucide に無いアイコンの名前））
test("test_error_when_icon_not_in_lucide", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await routeLucide(page, (name) => (name === "no-such-icon" ? 404 : 200));
  // 実行
  await mountDocument(page, {
    markdown: "前の文 `icon:no-such-icon` と `icon:anchor` 後ろの文\n",
  });
  // 検証
  await expect(
    page.locator("#doc code:not(.mdmark-syntax-warning code)", {
      hasText: "icon:no-such-icon",
    }),
  ).toHaveCount(1);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "no-such-icon",
  );
  await expect(
    page.locator('#doc .mdmark-inline-icon[data-icon="anchor"] svg'),
  ).toHaveCount(1);
  await expect(page.locator("#doc")).toContainText("後ろの文");
});

// Lucide を読み込めないときは、行内のコードに戻して通知ブロックを 1 つだけ配置する（異常シナリオ（Lucide を読み込めない））
test("test_error_when_lucide_unavailable", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await routeLucide(page, () => "fail");
  // 実行
  await mountDocument(page, { markdown: ICONS_MARKDOWN });
  // 検証
  await expect(page.locator("#doc .mdmark-notice")).toHaveCount(1);
  await expect(page.locator("#doc .mdmark-notice")).toContainText("Lucide");
  await expect(
    page.locator("#doc code", { hasText: "icon:sailboat" }),
  ).toHaveCount(1);
  await expect(
    page.locator("#doc code", { hasText: "icon:anchor" }),
  ).toHaveCount(1);
  await expect(page.locator("#doc")).toContainText("航海");
  await expect(page.locator("#doc")).toContainText("後ろの文");
});
