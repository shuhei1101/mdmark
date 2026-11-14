import { expect, test } from "vitest";
import { renderDoc } from "../../../helpers/render.ts";

/** 行番号（1 から）に中身を配置した Markdown を作る */
function markdownAt(blocks: Record<number, string[]>): string {
  const lines: string[] = [];
  for (const [at, content] of Object.entries(blocks).sort(
    ([a], [b]) => Number(a) - Number(b),
  )) {
    while (lines.length < Number(at) - 1) {
      lines.push("");
    }
    lines.push(...content);
  }
  return `${lines.join("\n")}\n`;
}

// マーカーの行を場所にし、マーカーを持たない警告は後ろのブロックの行にする（正常系）
test("test_collect_warnings_rule", () => {
  // 準備
  const markdown = markdownAt({
    3: ['<!-- code: {"highlight": [9]} -->', "```ts", "const a = 1;", "```"],
    10: [
      "<!-- chart -->",
      "",
      "```json",
      '{ "title": ',
      "```",
      "",
      "<!-- /chart -->",
    ],
    20: ["```tree", "src/", "│   │   └── deep.ts", "```"],
  });
  // 実行
  const { warnings } = renderDoc(markdown);
  // 検証
  expect(warnings.map(({ line, kind }) => ({ line, kind }))).toEqual([
    { line: 3, kind: "syntax_warning" },
    { line: 10, kind: "diagram_invalid" },
    { line: 20, kind: "syntax_warning" },
  ]);
});

// 表とファイルツリーのマーカーの警告を、マーカーの行にする（正常系）
test("test_collect_warnings_rule_when_marks", () => {
  // 準備
  const markdown = markdownAt({
    3: [
      '<!-- table: {"kind": "foo"} -->',
      "",
      "| 列 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "<!-- /table -->",
    ],
    11: [
      '<!-- tree: {"wrap": 1} -->',
      "",
      "```tree",
      "src/",
      "└── a.ts",
      "```",
    ],
    20: [
      '<!-- tabs: {"collapse": 1} -->',
      "",
      "### macOS",
      "",
      "本文",
      "",
      "<!-- /tabs -->",
    ],
  });
  // 実行
  const { warnings } = renderDoc(markdown);
  // 検証
  expect(warnings.map(({ line }) => line)).toEqual([3, 11, 20]);
});

// マーカーの注記を、マーカーの行でその種類にして集める（正常系）
test("test_collect_warnings_rule_when_mark_notes", () => {
  // 準備
  const markdown = markdownAt({
    5: [
      '<!-- tabs: {"grop": "os"} -->',
      "",
      "### macOS",
      "",
      "本文",
      "",
      "### Windows",
      "",
      "本文",
      "",
      "<!-- /tabs -->",
    ],
    17: ["<!-- section: closed -->"],
  });
  // 実行
  const { warnings } = renderDoc(markdown);
  // 検証
  expect(warnings.map(({ line, kind }) => ({ line, kind }))).toEqual([
    { line: 5, kind: "unknown_mark_arg" },
    { line: 17, kind: "legacy_mark" },
  ]);
  expect(warnings[0]?.message).toContain("grop");
  expect(warnings[0]?.message).toContain("group");
  expect(warnings[0]?.message).toContain("collapse");
});

// 注記を記録し、画面には出さない（正常系）
test("test_record_mark_notes", () => {
  // 準備
  const markdown = markdownAt({
    3: [
      '<!-- table: {"kind": "data", "features": {"foo": {}}, "size": 2} -->',
      "",
      "| 列 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "<!-- /table -->",
    ],
  });
  // 実行
  const { html, warnings } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(html).not.toContain("foo");
  // 機能の名前の `resize` が `size` を含むため、マーカーの文字が残らないことで確かめる
  expect(html).not.toContain('"size"');
  expect(html).not.toContain("<!--");
  expect(warnings.map(({ line, kind }) => ({ line, kind }))).toEqual([
    { line: 3, kind: "unknown_mark_arg" },
    { line: 3, kind: "unknown_mark_arg" },
  ]);
  const messages = warnings.map((warning) => warning.message).join("\n");
  expect(messages).toContain("features.foo");
  expect(messages).toContain("sort");
  expect(messages).toContain("size");
  expect(messages).toContain("columns");
});
