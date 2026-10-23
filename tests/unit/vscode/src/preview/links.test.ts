import { expect, test } from "vitest";

/** リンクの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLinks = () => import("../../../../../vscode/src/preview/links.ts");

// 種類ごとに開き先を決める（正常系）
test("test_resolve_link", async () => {
  // 準備
  const { resolveLink } = await loadLinks();
  const markdownDir = "/ws/docs";
  const hrefs = [
    "https://example.com",
    "mailto:a@example.com",
    "./guide.md#使い方",
    "../img/a.png",
    "javascript:x",
  ];
  // 実行
  const targets = hrefs.map((href) => resolveLink({ href, markdownDir }));
  // 検証
  expect(targets).toEqual([
    { kind: "external", url: "https://example.com" },
    { kind: "external", url: "mailto:a@example.com" },
    { kind: "markdown", path: "/ws/docs/guide.md" },
    { kind: "file", path: "/ws/img/a.png" },
    { kind: "none" },
  ]);
});

// パーセントエンコードした相対パスを戻して解決する（正常系）
test("test_resolve_link_when_encoded", async () => {
  // 準備
  const { resolveLink } = await loadLinks();
  // 実行
  const target = resolveLink({
    href: "./%E4%BD%BF%E3%81%84%E6%96%B9.md",
    markdownDir: "/ws/docs",
  });
  // 検証
  expect(target).toEqual({ kind: "markdown", path: "/ws/docs/使い方.md" });
});
