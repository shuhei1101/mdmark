import { expect, test } from "vitest";
import { matches } from "../../helpers/html.ts";
import { jsonMark } from "../../helpers/marks.ts";
import { renderDoc } from "../../helpers/render.ts";

/** ファイルツリーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTree = () => import("../../../../src/tree/tree.syntax.ts");

/** 読み込めるツリーの行 */
const VALID_TREE = [
  "mdmark/",
  "├── src/",
  "│   └── index.ts",
  "└── package.json",
];

/** 3 行目が上の行より 2 段深いツリーの行 */
const TOO_DEEP_TREE = ["mdmark/", "├── src/", "│   │   └── deep.ts"];

// 入れ子を読み込む（正常系）
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

// 2 段深い行を返却する（異常系）
test("test_parse_tree_when_too_deep", async () => {
  // 準備
  const { parseTree } = await loadTree();
  // 実行
  const result = parseTree(TOO_DEEP_TREE.join("\n"));
  // 検証
  expect(result).toEqual({ line: 3, depth: 2 });
});

// 読み込めるツリーを部品にし、読み込めないツリーは警告とコードブロックにする（正常系）
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

// ASCII の罫線を今の罫線と同じ階層の数え方で読み込む（正常系）
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

// マーカーの depth を部品へ指定し、注釈のインラインを描く（正常系）
test("test_build_file_trees_when_mark", () => {
  // 準備
  const markdown = [
    '<!-- tree: {"depth": 2} -->',
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

// 読み込めない depth は警告にして既定の開き方のツリーにする（異常系）
test("test_build_file_trees_when_mark_unreadable", () => {
  // 準備
  const markdown = [
    '<!-- tree: {"depth": "deep"} -->',
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
  const text = html.slice(warning, html.indexOf('<div class="mdmark-tree"'));
  expect(text).toContain("depth");
  expect(text).toContain("all");
  expect(html).toContain('<div class="mdmark-tree"');
  expect(html).not.toContain("data-open");
});

// all と階層の数を読み込む（正常系）
test("test_read_tree_options", async () => {
  // 準備
  const { readTreeOptions } = await loadTree();
  // 実行
  const all = readTreeOptions(jsonMark("tree", { depth: "all" }));
  const levels = readTreeOptions(jsonMark("tree", { depth: 2, wrap: true }));
  // 検証
  expect(all).toEqual({ open: "all", wrap: false });
  expect(levels).toEqual({ open: "2", wrap: true });
});

// depth を省けば開く階層を入れない（正常系）
test("test_read_tree_options_when_none", async () => {
  // 準備
  const { readTreeOptions } = await loadTree();
  // 実行
  const options = readTreeOptions(jsonMark("tree"));
  // 検証
  expect(options.open).toBeUndefined();
  expect(options.wrap).toBe(false);
});

// 今の罫線と ASCII の罫線と縦線の後ろの罫線を数える（正常系）
test("test_count_tree_lines", async () => {
  // 準備
  const { countTreeLines } = await loadTree();
  const source = [
    "mdmark/",
    "├── src/",
    "│   └── index.ts",
    "└── README.md",
    "|-- a",
    "`-- b",
    "|   |-- c",
    "│   └── b",
  ].join("\n");
  // 実行
  const count = countTreeLines(source);
  // 検証
  expect(count).toBe(7);
});

// 行の途中の罫線と、罫線の後ろに空白の無い行は数えない（正常系）
test("test_count_tree_lines_when_not_tree", async () => {
  // 準備
  const { countTreeLines } = await loadTree();
  const source = ["a ├── b", "├──b", "-- コメント", "const a = b || c;"].join(
    "\n",
  );
  // 実行
  const count = countTreeLines(source);
  // 検証
  expect(count).toBe(0);
});

/** 罫線のフォルダ構成の行（3 行が罫線） */
const PLAIN_TREE = ["mdmark/", "├── src/", "│   └── index.ts", "└── README.md"];

/** 1 行目と同じ罫線の index.ts の行を、上の行より 2 階層深くした行 */
const PLAIN_TOO_DEEP = [
  "mdmark/",
  "├── src/",
  "│   │   └── index.ts",
  "└── README.md",
];

/** 言語と中身からコードブロックの行を作る */
const fence = (language: string, lines: string[]) => [
  "```" + language,
  ...lines,
  "```",
  "",
];

// 罫線の行が 2 行以上の言語 text と言語なしのコードブロックをファイルツリーにする（正常系）
test("test_build_plain_file_trees", () => {
  // 準備
  const markdown = [
    ...fence("text", PLAIN_TREE),
    ...fence("", ["src/", "|-- index.ts", "`-- parts/"]),
    ...fence("text", ["└── index.js"]),
    jsonMark("code", { tree_warning: false }).raw,
    "",
    ...fence("text", PLAIN_TREE),
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /<div class="mdmark-tree"/g)).toHaveLength(2);
  expect(html).toContain('data-tree-language="text"');
  // 空の属性は描いた HTML で値を持たない形（`data-tree-language`）になる
  expect(html).toMatch(/data-tree-language(?:="")?[\s>]/);
  expect(html).toContain("└── index.js");
  expect(matches(html, /<pre/g)).toHaveLength(2);
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 罫線を読み込めない行を持つ言語 text のコードブロック（異常系）
test("test_build_plain_file_trees_when_unreadable", () => {
  // 準備
  const markdown = fence("text", PLAIN_TOO_DEEP).join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /mdmark-syntax-warning"/g)).toHaveLength(1);
  expect(html).toContain("3 行目");
  expect(html).not.toContain('<div class="mdmark-tree"');
  expect(html.indexOf("<pre")).toBeGreaterThan(
    html.indexOf("mdmark-syntax-warning"),
  );
});

// mermaid・csv・map の範囲・code がオフの文書はファイルツリーにしない（正常系）
test("test_build_plain_file_trees_when_excluded", () => {
  // 準備
  const excluded = [
    ...fence("mermaid", PLAIN_TREE),
    ...fence("csv", PLAIN_TREE),
    "<!-- map -->",
    "",
    ...fence("mermaid", [
      "flowchart LR",
      ...PLAIN_TREE.map((line) => `%% ${line}`),
      "  A --> B",
    ]),
    "<!-- /map -->",
    "",
  ].join("\n");
  const codeOff = [
    jsonMark("features", { code: false }).raw,
    "",
    ...fence("text", PLAIN_TREE),
  ].join("\n");
  // 実行
  const results = [renderDoc(excluded).html, renderDoc(codeOff).html];
  // 検証
  for (const html of results) {
    expect(html).not.toContain('<div class="mdmark-tree"');
    expect(html).not.toContain("罫線のフォルダ構成");
  }
});
