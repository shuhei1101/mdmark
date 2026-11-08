import { expect, test } from "vitest";
import { renderDoc } from "../../../helpers/render.ts";

/** 行番号（1 から）に中身を置いた Markdown を作る */
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
    3: ["<!-- code: highlight=9 -->", "```ts", "const a = 1;", "```"],
    10: [
      "<!-- flow -->",
      "",
      "```json",
      '{ "title": ',
      "```",
      "",
      "<!-- /flow -->",
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
      "<!-- table: foo -->",
      "",
      "| 列 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "<!-- /table -->",
    ],
    11: ["<!-- tree: wrap=1 -->", "", "```tree", "src/", "└── a.ts", "```"],
    20: [
      "<!-- tabs: x=1 -->",
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

// 読み飛ばした引数を、印の行で unknown_mark_arg にして集める（正常系）
test("test_collect_warnings_rule_when_skipped_args", () => {
  // 準備
  const markdown = markdownAt({
    5: [
      "<!-- tabs: grop=os -->",
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
  });
  // 実行
  const { warnings } = renderDoc(markdown);
  // 検証
  expect(warnings.map(({ line, kind }) => ({ line, kind }))).toEqual([
    { line: 5, kind: "unknown_mark_arg" },
  ]);
  expect(warnings[0]?.message).toContain("grop=");
  expect(warnings[0]?.message).toContain("group=");
  expect(warnings[0]?.message).toContain("title=");
});

// 読み飛ばした引数ごとに中身の空のトークンを差し込み、画面には出さない（正常系）
test("test_push_skipped_args", () => {
  // 準備
  const markdown = markdownAt({
    3: [
      "<!-- table: data +foo size=2 -->",
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
  expect(html).not.toContain("+foo");
  expect(html).not.toContain("size=");
  expect(warnings.map(({ line, kind }) => ({ line, kind }))).toEqual([
    { line: 3, kind: "unknown_mark_arg" },
    { line: 3, kind: "unknown_mark_arg" },
  ]);
  const messages = warnings.map((warning) => warning.message).join("\n");
  expect(messages).toContain("+foo");
  expect(messages).toContain("sort");
  expect(messages).toContain("size=");
  expect(messages).toContain("filter=");
});
