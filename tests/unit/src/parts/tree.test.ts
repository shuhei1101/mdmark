import { expect, test } from "vitest";
import { findTags, innerHtml, matches } from "../../helpers/html.ts";

/** ファイルツリーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTree = () => import("../../../../src/parts/tree.ts");

/** `mdmark/` の下に `src/`（子 `index.ts`）と `package.json` を持つ項目 */
const BASIC_NODES = [
  {
    name: "mdmark/",
    children: [
      { name: "src/", children: [{ name: "index.ts" }] },
      { name: "package.json" },
    ],
  },
];

/** `app/` の下に `src/`、その下に `parts/`、その下に `tree.ts` を持つ項目 */
const NESTED_NODES = [
  {
    name: "app/",
    children: [
      {
        name: "src/",
        children: [{ name: "parts/", children: [{ name: "tree.ts" }] }],
      },
    ],
  },
];

/** `button.mdmark-tree-toggle` の開始タグを現れた順に返す */
function togglesOf(html: string): string[] {
  return findTags(html, "mdmark-tree-toggle");
}

// フォルダとファイルを分け、名前と元のテキストをエスケープする（正常系）
test("test_render_tree", async () => {
  // 準備
  const { renderTree } = await loadTree();
  // 実行
  const html = renderTree({
    nodes: [{ name: "src/", children: [{ name: "a<b>.ts" }] }],
    source: "src/\n└── a<b>.ts",
  });
  // 検証
  expect(
    html.startsWith(
      '<div class="mdmark-tree" data-source="src/\n└── a&lt;b&gt;.ts">',
    ),
  ).toBe(true);
  expect(html).toContain(
    '<ul class="mdmark-tree-list" aria-label="ファイルツリー">',
  );
  expect(html).toContain('<li class="mdmark-tree-folder">');
  expect(html).toContain('<span class="mdmark-tree-name">src/</span>');
  expect(html).toContain('<li class="mdmark-tree-file"');
  expect(html).toContain('<span class="mdmark-tree-name">a&lt;b&gt;.ts</span>');
  expect(html).not.toContain("data-open");
  expect(html).not.toContain("mdmark-tree-note");
  expect(html).not.toContain("<button");
});

// 注釈・アイコンの種類・ほかにもある項目を描く（正常系）
test("test_render_tree_when_items", async () => {
  // 準備
  const { renderTree } = await loadTree();
  // 実行
  const notes = renderTree({
    nodes: [
      {
        name: "mdmark/",
        children: [
          {
            name: "src/",
            note: "ソース",
            children: [{ name: "index.ts", note: "入口の <code>mount</code>" }],
          },
          {
            name: "README.md",
            note: '<strong>必読</strong> <span class="mdmark-badge">新規</span>',
          },
        ],
      },
    ],
    source:
      "mdmark/\n├── src/ # ソース\n│   └── index.ts # 入口の `mount`\n└── README.md # **必読** `badge:新規`",
    open: "all",
  });
  const more = renderTree({
    nodes: [
      { name: "src/", children: [{ name: "index.ts" }, { name: "..." }] },
    ],
    source: "src/\n├── index.ts\n└── ...",
  });
  // 検証
  expect(notes).toContain(
    '<span class="mdmark-tree-name">src/</span><span class="mdmark-tree-note">ソース</span>',
  );
  expect(notes).toContain(
    '<span class="mdmark-tree-note">入口の <code>mount</code></span>',
  );
  expect(notes).toContain(
    '<span class="mdmark-tree-note"><strong>必読</strong> <span class="mdmark-badge">新規</span></span>',
  );
  expect(matches(notes, /mdmark-tree-note">/g)).toHaveLength(3);
  expect(findTags(notes, 'data-file-icon="file-code"')).toHaveLength(1);
  expect(findTags(notes, 'data-file-icon="file-text"')).toHaveLength(1);
  expect(more).toContain('<li class="mdmark-tree-more">');
  expect(more).toContain("ほかにもあります");
});

// 帯と開閉のボタンを置き、開く階層より深いフォルダを閉じる（正常系）
test("test_render_tree_when_interactive", async () => {
  // 準備
  const { renderTree } = await loadTree();
  // 実行
  const basic = renderTree({
    nodes: BASIC_NODES,
    source: "mdmark/\n├── src/\n│   └── index.ts\n└── package.json",
    interactive: true,
  });
  const levels = renderTree({
    nodes: NESTED_NODES,
    source: "app/\n└── src/\n    └── parts/\n        └── tree.ts",
    open: "2",
    interactive: true,
  });
  // 検証: 帯が一覧の前にあり、コピーのボタンが idle で種類 tree を持つ
  for (const html of [basic, levels]) {
    const bar = html.indexOf("mdmark-tree-bar");
    expect(bar).toBeGreaterThan(-1);
    expect(bar).toBeLessThan(html.indexOf('<ul class="mdmark-tree-list"'));
    expect(html).toContain('aria-hidden="true">tree<');
    expect(findTags(html, "mdmark-tree-copy")[0]).toContain(
      'data-state="idle"',
    );
  }
  // 検証: ルートだけが開き、src/ の入れ子の ul が閉じて aria-controls で指される
  const basicToggles = togglesOf(basic);
  expect(basicToggles).toHaveLength(2);
  expect(basicToggles[0]).toContain('aria-expanded="true"');
  expect(basicToggles[1]).toContain('aria-expanded="false"');
  const closedLists = findTags(basic, 'hidden="until-found"');
  expect(closedLists).toHaveLength(1);
  const controls = /aria-controls="([^"]+)"/.exec(basicToggles[1] ?? "")?.[1];
  expect(controls).toBeTruthy();
  expect(closedLists[0]).toContain(`id="${controls}"`);
  // 検証: open=2 で app/ と src/ が開き、parts/ が閉じる
  expect(
    togglesOf(levels).map((tag) => /aria-expanded="(\w+)"/.exec(tag)?.[1]),
  ).toEqual(["true", "true", "false"]);
});

// コピーできないときのパネルをツリーの下に置く（正常系）
test("test_render_tree_when_copy_fallback", async () => {
  // 準備
  const { renderTree } = await loadTree();
  // 実行
  const html = renderTree({
    nodes: [{ name: "src/", children: [{ name: "index.ts" }] }],
    source: "src/\n└── index.ts",
    interactive: true,
    copyFallback: true,
  });
  // 検証
  expect(html.indexOf("mdmark-copy-panel")).toBeGreaterThan(
    html.lastIndexOf("</ul>"),
  );
  expect(html).toContain("ツリーのテキストを選択しています。");
  expect(innerHtml(html, "<textarea")).toBe("src/\n└── index.ts");
});

// 名前と拡張子からアイコンの種類を決める（正常系）
test("test_file_icon_of", async () => {
  // 準備
  const { fileIconOf } = await loadTree();
  const names = [
    "README.md",
    "index.ts",
    "package.json",
    "photo.PNG",
    "data.csv",
    "dist.tar.gz",
    "run.sh",
    "Dockerfile",
    "LICENSE",
    "font.woff2",
    "Makefile.bak",
  ];
  // 実行
  const icons = names.map((name) => fileIconOf(name));
  // 検証
  expect(icons).toEqual([
    "file-text",
    "file-code",
    "file-json",
    "file-image",
    "file-spreadsheet",
    "file-archive",
    "file-terminal",
    "file-terminal",
    "file-text",
    "file",
    "file",
  ]);
});

// コピーのボタンの状態で文言を切り替える（正常系）
test("test_render_tree_bar", async () => {
  // 準備
  const { renderTreeBar } = await loadTree();
  // 実行
  const idle = renderTreeBar({});
  const copied = renderTreeBar({ copyState: "copied" });
  // 検証
  expect(idle).toContain(
    '<button class="mdmark-tree-copy" type="button" data-state="idle">',
  );
  expect(idle).toContain("コピー");
  expect(idle).not.toContain("コピーしました");
  expect(copied).toContain('data-state="copied"');
  expect(copied).toContain("コピーしました");
  for (const html of [idle, copied]) {
    expect(html.startsWith('<div class="mdmark-tree-bar"')).toBe(true);
    expect(html).toContain('aria-hidden="true">tree<');
    expect(html).toContain('role="status"');
  }
});

// 指定ごとに開く深さを決める（正常系）
test("test_folder_open_by_default", async () => {
  // 準備
  const { folderOpenByDefault } = await loadTree();
  const depths = [0, 1, 2];
  // 実行
  const unset = depths.map((depth) => folderOpenByDefault(depth, undefined));
  const all = depths.map((depth) => folderOpenByDefault(depth, "all"));
  const two = depths.map((depth) => folderOpenByDefault(depth, "2"));
  // 検証
  expect(unset).toEqual([true, false, false]);
  expect(all).toEqual([true, true, true]);
  expect(two).toEqual([true, true, false]);
});
