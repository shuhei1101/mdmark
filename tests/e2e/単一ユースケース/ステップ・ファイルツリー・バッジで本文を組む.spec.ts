import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  routeSyntax,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 読まないことを確かめるために待つ時間（ミリ秒）
const SETTLE_MS = 500;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 番号付きリストが手順に、罫線のフォルダ構成がツリーに、`badge:` の行内のコードが札になる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  const syntaxRequests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- steps -->",
      "",
      "1. 取り込む",
      "2. ビルドする",
      "3. 確かめる",
      "",
      "<!-- /steps -->",
      "",
      "```tree",
      "src/",
      "├── index.ts",
      "└── parts/",
      "```",
      "",
      "版は `badge:v0.1.0` です。",
      "",
    ].join("\n"),
  });
  // 検証: 手順
  const items = page.locator("#doc ol.mdmark-steps > li");
  await expect(items).toHaveCount(3);
  // 番号は CSS のカウンタで 1 から順に丸の中へ出す
  const counters = await items.evaluateAll((elements) =>
    elements.map((element) => ({
      increment: getComputedStyle(element).counterIncrement,
      marker: getComputedStyle(element, "::before").content,
      display: getComputedStyle(element, "::before").display,
    })),
  );
  expect(counters).toEqual(
    Array(3).fill({
      increment: "mdmark-step 1",
      marker: "counter(mdmark-step)",
      display: "grid",
    }),
  );
  await expect(page.locator("#doc ol.mdmark-steps")).toHaveCSS(
    "counter-reset",
    "mdmark-step 0",
  );
  // 検証: ファイルツリー
  const tree = page.locator("#doc ul.mdmark-tree");
  await expect(
    tree.locator(".mdmark-tree-folder > .mdmark-tree-name"),
  ).toHaveText(["src/", "parts/"]);
  await expect(
    tree.locator(".mdmark-tree-file > .mdmark-tree-name"),
  ).toHaveText("index.ts");
  await expect(
    tree.locator(".mdmark-tree-folder .mdmark-tree-folder"),
  ).toHaveCount(1);
  // 検証: バッジ
  await expect(page.locator("#doc .mdmark-badge")).toHaveText("v0.1.0");
  await expect(page.locator("#doc")).not.toContainText("badge:");
  // 言語 tree のコードブロックは色分けの対象にならず、色分けのライブラリを読まない
  await page.waitForTimeout(SETTLE_MS);
  expect(syntaxRequests()).toEqual([]);
});

// 打ち消した `badge\:` は札にせず、書いたとおりの行内のコードで見せる（正常シナリオ（バッジの書き方を見せる））
test("test_normal_when_badge_escaped", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: "書き方は `badge\\:v0.1.0` です。\n" });
  // 検証
  await expect(page.locator("#doc code")).toHaveText("badge:v0.1.0");
  await expect(page.locator("#doc .mdmark-badge")).toHaveCount(0);
});

// 読めない行を持つファイルツリーは、元のコードブロックのまま描き、書き方の警告を出す（異常シナリオ（ファイルツリーに読めない行がある））
test("test_error_when_tree_line_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "```tree\nsrc/\n└── a/\n        └── b\n```\n",
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "3 行目",
  );
  await expect(page.locator("#doc ul.mdmark-tree")).toHaveCount(0);
  await expect(page.locator("#doc pre code")).toContainText("└── a/");
  await expect(page.locator("#doc pre code")).toContainText("└── b");
});

// 番号付きリストの無いステップの範囲は、中身をそのまま描き、書き方の警告を出す（異常シナリオ（番号付きリストの無いステップの範囲））
test("test_error_when_steps_without_ordered_list", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "<!-- steps -->\n\n- 取り込む\n- ビルドする\n\n<!-- /steps -->\n",
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "番号付きリスト",
  );
  await expect(page.locator("#doc ol.mdmark-steps")).toHaveCount(0);
  await expect(page.locator("#doc ul > li")).toHaveText([
    "取り込む",
    "ビルドする",
  ]);
});

// 後ろが空か空白だけの `badge:` は札にせず、書いたとおりの行内のコードで出し、警告も出さない（正常シナリオ（中身の無い badge:））
test("test_normal_when_badge_empty", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "空は `badge:` と `badge: ` と書きます。\n",
  });
  // 検証
  const codes = page.locator("#doc code");
  await expect(codes).toHaveCount(2);
  expect(await codes.allTextContents()).toEqual(["badge:", "badge: "]);
  await expect(page.locator("#doc .mdmark-badge")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});
