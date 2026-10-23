import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 一覧のフォルダの見出しの文字を、出た順に返す */
function folderHeadings(page: Page): Promise<string[]> {
  return page.locator(".mdmark-doc-list-folder").allTextContents();
}

/** 開いている文書として示された行の `data-doc-path` を返す */
function currentPaths(page: Page): Promise<(string | null)[]> {
  return page
    .locator('.mdmark-doc-list a[aria-current="page"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("data-doc-path")),
    );
}

// フォルダの無い文書を先に、フォルダごとに 1 段の見出しでまとめ、開いている文書を示す（Grouped）
test("test_grouped", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-doclist--grouped");
  // 検証
  const nav = page.locator("nav.mdmark-doc-list");
  await expect(nav.getAttribute("aria-label")).resolves.toBe("文書の一覧");
  await expect(folderHeadings(page)).resolves.toEqual([
    "使い方",
    "使い方/導入",
    "リファレンス",
  ]);
  // フォルダの無い文書のまとまりは見出しを持たず、先頭に置く
  await expect(
    nav
      .locator(".mdmark-doc-list-group")
      .first()
      .locator("a")
      .allTextContents(),
  ).resolves.toEqual(["mdmark の文書"]);
  await expect(
    nav
      .locator(".mdmark-doc-list-group")
      .first()
      .locator(".mdmark-doc-list-folder")
      .count(),
  ).resolves.toBe(0);
  await expect(currentPaths(page)).resolves.toEqual(["使い方/guide.md"]);
  await expect(
    page
      .locator('.mdmark-doc-list a[aria-current="page"]')
      .evaluate((link) => getComputedStyle(link).backgroundColor),
  ).resolves.toBe("rgb(230, 243, 241)");
  await expect(
    nav.locator('a[data-doc-path="使い方/guide.md"]').getAttribute("href"),
  ).resolves.toBe("#/使い方/guide.md");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// フォルダの無い文書だけのとき、見出しを置かない（Flat）
test("test_flat", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-doclist--flat");
  // 検証
  await expect(folderHeadings(page)).resolves.toEqual([]);
  await expect(
    page.locator(".mdmark-doc-list a").allTextContents(),
  ).resolves.toEqual(["はじめに", "手順", "よくある質問"]);
  await expect(currentPaths(page)).resolves.toEqual(["intro.md"]);
});

// 題とフォルダのパスが長くても、一覧の幅で折り返して横にはみ出さない（LongText）
test("test_long_text", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-doclist--long-text");
  // 検証
  await expect(folderHeadings(page)).resolves.toEqual([
    "使い方/カスタマイズ/テーマ/層の外の CSS",
  ]);
  await expect(page.locator(".mdmark-doc-list a").innerText()).resolves.toBe(
    "版を固定した URL で JavaScript と CSS を読み込み、要素に文書を描くまで",
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 文書が多くても、全ての文書をフォルダごとに並べる（Many）
test("test_many", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-doclist--many");
  // 検証
  await expect(page.locator(".mdmark-doc-list a").count()).resolves.toBe(14);
  await expect(folderHeadings(page)).resolves.toEqual([
    "はじめに",
    "使い方/書く",
    "使い方/カスタマイズ",
    "使い方/書き出す",
    "リファレンス",
  ]);
  await expect(currentPaths(page)).resolves.toEqual(["使い方/書く/部品.md"]);
});
