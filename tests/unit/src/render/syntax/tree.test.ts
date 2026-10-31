import { expect, test } from "vitest";
import { type Mark, parseMarkArgs } from "../../../../../src/render/marks.ts";
import { matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** ファイルツリーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTree = () => import("../../../../../src/render/syntax/tree.ts");

/** `<!-- tree: {rest} -->` の印 */
function treeMark(rest: string): Mark {
  return {
    name: "tree",
    args: parseMarkArgs(rest),
    raw: `<!-- tree: ${rest} -->`,
    closing: false,
    rest,
  };
}

/** 読めるツリーの行 */
const VALID_TREE = [
  "mdmark/",
  "├── src/",
  "│   └── index.ts",
  "└── package.json",
];

/** 3 行目が上の行より 2 段深いツリーの行 */
const TOO_DEEP_TREE = ["mdmark/", "├── src/", "│   │   └── deep.ts"];

// 入れ子を読む（正常系）
test("test_parse_tree", async () => {
  // 準備
  const { parseTree } = await loadTree();
  // 実行
  const result = parseTree(VALID_TREE.join("\n"));
  // 検証
  expect(result).toEqual({
    nodes: [
      {
        name: "mdmark/",
        children: [
          { name: "src/", children: [{ name: "index.ts" }] },
          { name: "package.json" },
        ],
      },
    ],
  });
});

// 2 段深い行を返す（異常系）
test("test_parse_tree_when_too_deep", async () => {
  // 準備
  const { parseTree } = await loadTree();
  // 実行
  const result = parseTree(TOO_DEEP_TREE.join("\n"));
  // 検証
  expect(result).toEqual({ line: 3, depth: 2 });
});

// 読めるツリーを部品にし、読めないツリーは警告とコードブロックにする（正常系）
test("test_build_file_trees", () => {
  // 準備
  const markdown = [
    "```tree",
    ...VALID_TREE,
    "```",
    "",
    "```tree",
    ...TOO_DEEP_TREE,
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /<div class="mdmark-tree"/g)).toHaveLength(1);
  expect(html).toContain(`data-source="${VALID_TREE.join("\n")}"`);
  const warning = html.indexOf("mdmark-syntax-warning");
  expect(warning).toBeGreaterThan(html.indexOf("mdmark-tree"));
  expect(html.indexOf("3 行目")).toBeGreaterThan(warning);
  expect(html.indexOf("<pre")).toBeGreaterThan(warning);
});

// 前に空白がある最初の # で名前と注釈に分ける（正常系）
test("test_parse_tree_when_notes", async () => {
  // 準備
  const { parseTree } = await loadTree();
  const source = [
    "mdmark/",
    "├── src/ #ソース",
    "│   └── index.ts # 入口 # 中の #",
    "├── C#/",
    "└── #notes.md",
  ].join("\n");
  // 実行
  const result = parseTree(source, (markdown) => `<em>${markdown}</em>`);
  // 検証
  expect(result).toEqual({
    nodes: [
      {
        name: "mdmark/",
        children: [
          {
            name: "src/",
            note: "<em>ソース</em>",
            children: [{ name: "index.ts", note: "<em>入口 # 中の #</em>" }],
          },
          { name: "C#/" },
          { name: "#notes.md" },
        ],
      },
    ],
  });
});

// ASCII の罫線を今の罫線と同じ段の数え方で読む（正常系）
test("test_parse_tree_when_ascii", async () => {
  // 準備
  const { parseTree } = await loadTree();
  const source = [
    "src/",
    "|-- index.ts",
    "`-- parts/",
    "    ├── tree.ts",
    "    `-- ...",
  ].join("\n");
  // 実行
  const result = parseTree(source);
  // 検証
  expect(result).toEqual({
    nodes: [
      {
        name: "src/",
        children: [
          { name: "index.ts" },
          {
            name: "parts/",
            children: [{ name: "tree.ts" }, { name: "..." }],
          },
        ],
      },
    ],
  });
});

// 印の open= を部品へ渡し、注釈のインラインを描く（正常系）
test("test_build_file_trees_when_mark", () => {
  // 準備
  const markdown = [
    "<!-- tree: open=2 -->",
    "",
    "```tree",
    "src/ # **ソース**",
    "└── index.ts # `badge:新規`",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<div class="mdmark-tree" data-open="2"');
  expect(html).toContain("<strong>ソース</strong>");
  expect(html).toContain('<span class="mdmark-badge">新規</span>');
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(html).not.toContain("<!-- tree");
});

// 読めない open= は警告にして既定の開き方のツリーにする（異常系）
test("test_build_file_trees_when_mark_unreadable", () => {
  // 準備
  const markdown = [
    "<!-- tree: open=deep -->",
    "",
    "```tree",
    ...VALID_TREE,
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warning = html.indexOf("mdmark-syntax-warning");
  expect(warning).toBeGreaterThan(-1);
  expect(html).toContain("<code>open=deep</code>");
  expect(warning).toBeLessThan(html.indexOf('<div class="mdmark-tree"'));
  expect(html).toContain('<div class="mdmark-tree"');
  expect(html).not.toContain("data-open");
});

// all と階層の数を読む（正常系）
test("test_read_tree_options", async () => {
  // 準備
  const { readTreeOptions } = await loadTree();
  // 実行
  const all = readTreeOptions(treeMark("open=all"));
  const levels = readTreeOptions(treeMark("open=2"));
  // 検証
  expect(all.open).toBe("all");
  expect(all.warning).toBeUndefined();
  expect(levels.open).toBe("2");
  expect(levels.warning).toBeUndefined();
});

// 読めない値・キー・指定を 1 つの警告にまとめる（異常系）
test("test_read_tree_options_when_unreadable", async () => {
  // 準備
  const { readTreeOptions } = await loadTree();
  // 実行
  const mixed = readTreeOptions(treeMark("open=deep depth=2 closed"));
  const zero = readTreeOptions(treeMark("open=0"));
  // 検証
  expect(mixed.open).toBeUndefined();
  const items = mixed.warning?.items ?? [];
  expect(items.map((item) => item.label).sort()).toEqual(
    ["closed", "depth=", "open=deep"].sort(),
  );
  const deep = items.find((item) => item.label === "open=deep")?.message ?? "";
  expect(deep).toContain("all");
  expect(deep).toContain("階層の数");
  expect(zero.open).toBeUndefined();
  expect((zero.warning?.items ?? []).map((item) => item.label)).toEqual([
    "open=0",
  ]);
});
