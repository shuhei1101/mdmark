import { expect, test } from "vitest";
import { matches, outerHtml } from "../../../helpers/html.ts";
import { ARCH_INDEX } from "../../../helpers/index-fixtures.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 被参照を末尾の一覧に足す（正常系）
test("test_backlinks_rule", () => {
  // 準備
  const references = {
    backlinks: { arch: ["api", "guide"] },
    glossary: [],
  };
  // 実行
  const { html } = renderDoc(
    "# 見出し\n\n本文\n",
    {},
    { index: ARCH_INDEX, docId: "arch", references },
  );
  // 検証
  const nav = outerHtml(html, "mdmark-backlinks");
  expect(nav).toContain("関連文書");
  expect(matches(nav, /<a href="[^"]*"/g)).toEqual([
    '<a href="../api.md"',
    '<a href="../使い方/guide.md"',
  ]);
  expect(matches(nav, />(?:API|使い方)<\/a>/g)).toEqual([
    ">API</a>",
    ">使い方</a>",
  ]);
  expect(html.trimEnd().endsWith("</nav>")).toBe(true);
});

// 被参照が無ければ足さない（正常系）
test("test_backlinks_rule_when_empty", () => {
  // 準備
  const empty = { backlinks: { arch: [] }, glossary: [] };
  const referenced = { backlinks: { arch: ["api"] }, glossary: [] };
  const markdown = "# 見出し\n\n本文\n";
  // 実行
  const withNone = renderDoc(
    markdown,
    {},
    { index: ARCH_INDEX, docId: "arch", references: empty },
  );
  const withOne = renderDoc(
    markdown,
    {},
    { index: ARCH_INDEX, docId: "arch", references: referenced },
  );
  // 検証
  // 被参照が 1 つあれば一覧を足す同じ入力で、0 件だと足さない
  expect(withOne.html).toContain("mdmark-backlinks");
  expect(withNone.html).not.toContain("mdmark-backlinks");
});
