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
  routeSyntax,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 外部ライブラリの印を持つ文書と、その印を対応表に足す設定
const MARKDOWN = "前の段落\n\n<!-- test-lib: a b -->\n\n後の段落\n";
const CONFIG = { libraries: { "test-lib": LIB_URL } };
// 読み込みが起きないことを確かめるために待つ時間（ミリ秒）
const SETTLE_MS = 500;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 文書に印があるときだけ、外部ライブラリを 1 回読んで印の場所に描かせる（正常シナリオ）
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

// 印の無い文書では、外部ライブラリを読まない（正常シナリオ（印が無い））
test("test_normal_when_no_mark", async ({ page }) => {
  // 準備
  const requestCount = await routeLibrary(page, 200);
  const syntaxRequests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: "段落\n", config: CONFIG });
  await page.waitForTimeout(SETTLE_MS);
  // 検証
  expect(requestCount()).toBe(0);
  expect(syntaxRequests()).toEqual([]);
  await expect(page.locator("#doc p")).toHaveText("段落");
});

// 外部ライブラリを読めない印の場所だけを知らせの枠にし、ほかの本文は描く（異常シナリオ（外部ライブラリを読めない））
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

// 色分けする言語のコードブロックがあるときだけ、色分けのライブラリの本体と使う言語のモジュールを読む。本体は配布物に含まれない（正常シナリオ（色分けするコードブロック））
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
  // 本体 1 件と、文書が使う言語のモジュール 1 件ずつだけを読む
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
