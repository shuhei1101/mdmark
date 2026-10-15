import { expect, test } from "vitest";
import { matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** ファイルツリーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTree = () => import("../../../../../src/render/syntax/tree.ts");

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
  expect(matches(html, /<ul class="mdmark-tree"/g)).toHaveLength(1);
  const warning = html.indexOf("mdmark-syntax-warning");
  expect(warning).toBeGreaterThan(html.indexOf("mdmark-tree"));
  expect(html.indexOf("3 行目")).toBeGreaterThan(warning);
  expect(html.indexOf("<pre")).toBeGreaterThan(warning);
});
