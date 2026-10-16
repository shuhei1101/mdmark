import { expect, test } from "vitest";

/** 索引のパスの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPaths = () => import("../../../../src/knowledge/paths.ts");

// 符号化・?・# を持つ相対リンクを解く（正常系）
test("test_resolve_link", async () => {
  // 準備
  const { resolveLink } = await loadPaths();
  // 実行
  const encoded = resolveLink(
    "使い方/guide.md",
    "../%E8%A8%AD%E8%A8%88/arch.md?v=1#top",
  );
  const sibling = resolveLink("使い方/guide.md", "./x.md");
  // 検証
  expect(encoded).toBe("設計/arch.md");
  expect(sibling).toBe("使い方/x.md");
});

// 索引の外・URL・# だけは参照にしない（正常系）
test("test_resolve_link_when_outside", async () => {
  // 準備
  const { resolveLink } = await loadPaths();
  const hrefs = ["../../a.md", "https://example.com/a.md", "#top", "/a.md"];
  // 実行・検証
  for (const href of hrefs) {
    expect(resolveLink("使い方/guide.md", href)).toBeUndefined();
  }
});

// 別のフォルダの文書への相対パスを作る（正常系）
test("test_relative_href", async () => {
  // 準備
  const { relativeHref } = await loadPaths();
  // 実行
  const cases = [
    relativeHref("設計/arch.md", "api.md"),
    relativeHref("設計/arch.md", "使い方/guide.md"),
    relativeHref("設計/arch.md", "設計/b.md"),
    relativeHref(undefined, "api.md"),
  ];
  // 検証
  expect(cases).toEqual(["../api.md", "../使い方/guide.md", "b.md", "api.md"]);
});
