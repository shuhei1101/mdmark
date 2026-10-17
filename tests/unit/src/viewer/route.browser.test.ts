import { expect, test } from "vitest";

/** 描いた文書のリンクを書き換える処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRoute = () => import("../../../../src/viewer/route.ts");

// 文書間のリンク・見出しのアンカー・含まれないリンクを書き分ける（正常系）
test("test_rewrite_links", async () => {
  // 準備
  const { rewriteLinks } = await loadRoute();
  const root = document.createElement("div");
  root.innerHTML = [
    '<a href="../リファレンス/api.md#mount">api</a>',
    '<a href="#描く">描く</a>',
    '<a href="../下書き/メモ.md">メモ</a>',
    '<a href="https://example.com/">外</a>',
  ].join("");
  const paths = new Set(["使い方/guide.md", "リファレンス/api.md"]);
  // 実行
  rewriteLinks(root, "使い方/guide.md", paths);
  // 検証
  const links = [...root.querySelectorAll("a")];
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "#/リファレンス/api.md#mount",
    "#/使い方/guide.md#描く",
    "../下書き/メモ.md",
    "https://example.com/",
  ]);
  expect(links.map((link) => link.getAttribute("data-doc-path"))).toEqual([
    "リファレンス/api.md",
    null,
    null,
    null,
  ]);
});
