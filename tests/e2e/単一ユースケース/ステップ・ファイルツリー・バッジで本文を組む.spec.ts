import { expect, type Locator, type Page, test } from "@playwright/test";
import { stubClipboard, writtenTexts } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  routeLucide,
  routeSyntax,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// 読み込まないことを確認するために待つ時間（ミリ秒）
const SETTLE_MS = 500;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 番号付きリストが手順に、罫線のフォルダ構成がツリーに、`badge:` の行内のコードが札になる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  const syntaxRequests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- steps -->",
      "",
      "1. 取り込む",
      "2. ビルドする",
      "3. 確かめる",
      "",
      "<!-- /steps -->",
      "",
      "```tree",
      "src/",
      "├── index.ts",
      "└── parts/",
      "```",
      "",
      "版は `badge:v0.1.0` です。",
      "",
    ].join("\n"),
  });
  // 検証: 手順
  const items = page.locator("#doc ol.mdmark-steps > li");
  await expect(items).toHaveCount(3);
  // 番号は CSS のカウンタで 1 から順に丸の中へ出す
  const counters = await items.evaluateAll((elements) =>
    elements.map((element) => ({
      increment: getComputedStyle(element).counterIncrement,
      marker: getComputedStyle(element, "::before").content,
      display: getComputedStyle(element, "::before").display,
    })),
  );
  expect(counters).toEqual(
    Array(3).fill({
      increment: "mdmark-step 1",
      marker: "counter(mdmark-step)",
      display: "grid",
    }),
  );
  await expect(page.locator("#doc ol.mdmark-steps")).toHaveCSS(
    "counter-reset",
    "mdmark-step 0",
  );
  // 検証: ファイルツリー
  const tree = page.locator("#doc div.mdmark-tree");
  await expect(
    tree.locator(".mdmark-tree-folder > .mdmark-tree-row .mdmark-tree-name"),
  ).toHaveText(["src/", "parts/"]);
  await expect(
    tree.locator(".mdmark-tree-file > .mdmark-tree-row .mdmark-tree-name"),
  ).toHaveText("index.ts");
  await expect(
    tree.locator(".mdmark-tree-folder .mdmark-tree-folder"),
  ).toHaveCount(1);
  // 検証: バッジ
  await expect(page.locator("#doc .mdmark-badge")).toHaveText("v0.1.0");
  await expect(page.locator("#doc")).not.toContainText("badge:");
  // 言語 tree のコードブロックは色分けの対象にならず、色分けのライブラリを読み込まない
  await page.waitForTimeout(SETTLE_MS);
  expect(syntaxRequests()).toEqual([]);
});

// 打ち消した `badge\:` は札にせず、記載したとおりの行内のコードで見せる（正常シナリオ（バッジの記載方法を見せる））
test("test_normal_when_badge_escaped", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: "書き方は `badge\\:v0.1.0` です。\n" });
  // 検証
  await expect(page.locator("#doc code")).toHaveText("badge:v0.1.0");
  await expect(page.locator("#doc .mdmark-badge")).toHaveCount(0);
});

// 読み込めない行を持つファイルツリーは、元のコードブロックのまま描き、記載の警告を出す（異常シナリオ（ファイルツリーに読み込めない行がある））
test("test_error_when_tree_line_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "```tree\nsrc/\n└── a/\n        └── b\n```\n",
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "3 行目",
  );
  await expect(page.locator("#doc div.mdmark-tree")).toHaveCount(0);
  await expect(page.locator("#doc pre code")).toContainText("└── a/");
  await expect(page.locator("#doc pre code")).toContainText("└── b");
});

// 番号付きリストの無いステップの範囲は、中身をそのまま描き、記載の警告を出す（異常シナリオ（番号付きリストの無いステップの範囲））
test("test_error_when_steps_without_ordered_list", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "<!-- steps -->\n\n- 取り込む\n- ビルドする\n\n<!-- /steps -->\n",
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "番号付きリスト",
  );
  await expect(page.locator("#doc ol.mdmark-steps")).toHaveCount(0);
  await expect(page.locator("#doc ul > li")).toHaveText([
    "取り込む",
    "ビルドする",
  ]);
});

// 後ろが空か空白だけの `badge:` は札にせず、記載したとおりの行内のコードで出し、警告も出さない（正常シナリオ（中身の無い badge:））
test("test_normal_when_badge_empty", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "空は `badge:` と `badge: ` と書きます。\n",
  });
  // 検証
  const codes = page.locator("#doc code");
  await expect(codes).toHaveCount(2);
  expect(await codes.allTextContents()).toEqual(["badge:", "badge: "]);
  await expect(page.locator("#doc .mdmark-badge")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

/** 描いた文書の `index` 番目のファイルツリー */
function treeAt(page: Page, index: number): Locator {
  return page.locator("#doc div.mdmark-tree").nth(index);
}

/** ツリーの中の、名前のフォルダの開閉のボタン */
function folderButton(tree: Locator, name: string): Locator {
  return tree.getByRole("button", { name, exact: true });
}

/** ツリーの中の、名前の項目の名前の要素 */
function nameOf(tree: Locator, name: string): Locator {
  return tree.locator(".mdmark-tree-name", { hasText: name }).first();
}

/** `app/` の下に `src/`、その下に `parts/`、その下に `tree.ts` を持つツリーのコードブロックの行 */
const NESTED_TREE = [
  "```tree",
  "app/",
  "└── src/",
  "    └── parts/",
  "        └── tree.ts",
  "```",
];

/** 注釈・`...` を持つツリーのコードブロックの行（`index.ts` は `src/` の下） */
const NOTE_TREE = [
  "mdmark/",
  "├── src/ #ソース",
  "│   └── index.ts # 入口の `mount`",
  "├── README.md # **必読** `badge:新規`",
  "├── C#/",
  "├── #notes.md",
  "└── ...",
];

// `closed`・`open` の手順を、見出し付きの折り畳みに入れ、閉じた手順は見出しを押すと開く（正常シナリオ（折りたたみに入れたステップ））
test("test_normal_when_steps_folded", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- steps: {"collapse": {"open": false}} -->',
      "",
      "1. 一つ目",
      "2. 二つ目",
      "",
      "<!-- /steps -->",
      "",
      '<!-- steps: {"collapse": {"open": true, "title": "準備"}} -->',
      "",
      "1. 一つ目",
      "2. 二つ目",
      "3. 三つ目",
      "",
      "<!-- /steps -->",
      "",
    ].join("\n"),
  });
  const folds = page.locator("#doc details.mdmark-collapsible");
  // 検証: 描いた直後
  await expect(folds.nth(0).locator("summary")).toHaveText(
    "手順（2 ステップ）",
  );
  await expect(folds.nth(0).locator("ol.mdmark-steps")).toBeHidden();
  await expect(folds.nth(1).locator("summary")).toHaveText("準備");
  await expect(folds.nth(1).locator("ol.mdmark-steps > li")).toHaveCount(3);
  for (const item of await folds.nth(1).locator("ol.mdmark-steps > li").all()) {
    await expect(item).toBeVisible();
  }
  // 実行
  await folds.nth(0).locator("summary").click();
  // 検証
  const items = folds.nth(0).locator("ol.mdmark-steps > li");
  await expect(items).toHaveCount(2);
  for (const item of await items.all()) {
    await expect(item).toBeVisible();
  }
  const markers = await items.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element, "::before").content),
  );
  expect(markers).toEqual(["counter(mdmark-step)", "counter(mdmark-step)"]);
});

// 型の合わない collapse.open は記載の警告を出し、知らないキーは無視して、読み込めた指定だけを適用する（異常シナリオ（ステップの読み込めない指定））
test("test_error_when_steps_option_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const range = (options: string): string[] => [
    `<!-- steps: ${options} -->`,
    "",
    "1. 一つ目",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
  ];
  // 実行
  await mountDocument(page, {
    markdown: [
      ...range('{"collapse": {"open": "no"}}'),
      ...range('{"fold": true}'),
      ...range('{"collapse": {"title": "準備"}}'),
    ].join("\n"),
  });
  // 検証
  const warnings = page.locator("#doc .mdmark-syntax-warning");
  await expect(warnings).toHaveCount(1);
  await expect(warnings.nth(0)).toContainText("collapse.open");
  await expect(warnings.nth(0)).toContainText("true");
  await expect(warnings.nth(0)).toContainText("false");
  // 知らないキー fold は無視する
  await expect(warnings.nth(0)).not.toContainText("fold");
  const lists = page.locator("#doc ol.mdmark-steps");
  await expect(lists).toHaveCount(3);
  await expect(lists.nth(0).locator("xpath=ancestor::details")).toHaveCount(1);
  await expect(lists.nth(1).locator("xpath=ancestor::details")).toHaveCount(0);
  await expect(lists.nth(2).locator("xpath=ancestor::details")).toHaveCount(1);
  const folds = page.locator("#doc details.mdmark-collapsible");
  await expect(folds).toHaveCount(2);
  for (const fold of await folds.all()) {
    await expect(fold).not.toHaveAttribute("open", "");
  }
  await expect(folds.nth(1).locator("summary")).toHaveText("準備");
});

// `#` の後ろの注釈を列に統一し、拡張子ごとのアイコンを付け、`C#/` と `#notes.md` は割らず、`...` を「ほかにもある」の項目にする（正常シナリオ（ファイルツリーに注釈を記載する））
test("test_normal_when_tree_annotated", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- tree: {"depth": "all"} -->',
      "",
      "```tree",
      ...NOTE_TREE,
      "```",
      "",
    ].join("\n"),
  });
  const tree = treeAt(page, 0);
  await page.waitForFunction(() =>
    document
      .querySelector<HTMLElement>(".mdmark-tree")
      ?.style.getPropertyValue("--mdmark-tree-note-start"),
  );
  // 検証: 名前に # と注釈が入らず、注釈が項目の右に出る
  for (const name of ["src/", "index.ts", "README.md"]) {
    await expect(
      tree
        .locator(".mdmark-tree-row", {
          has: page.locator(".mdmark-tree-name", { hasText: name }),
        })
        .first(),
    ).not.toContainText("#");
  }
  const notes = tree.locator(".mdmark-tree-note");
  await expect(notes).toHaveCount(3);
  // 検証: 3 つの注釈の左端が、階層の深さによらず同じ位置に一致する
  const lefts = await notes.evaluateAll((elements) =>
    elements.map((element) => Math.round(element.getBoundingClientRect().left)),
  );
  expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(1);
  // 検証: 注釈の中のコード・太字・バッジ
  await expect(tree.locator(".mdmark-tree-note code")).toHaveText("mount");
  await expect(tree.locator(".mdmark-tree-note strong")).toHaveText("必読");
  await expect(tree.locator(".mdmark-tree-note .mdmark-badge")).toHaveText(
    "新規",
  );
  // 検証: C#/ と #notes.md は名前のまま出て、注釈を持たない
  await expect(
    tree.locator(".mdmark-tree-folder > .mdmark-tree-row", {
      has: page.locator(".mdmark-tree-name", { hasText: "C#/" }),
    }),
  ).toHaveCount(1);
  await expect(
    tree.locator(".mdmark-tree-file", {
      has: page.locator(".mdmark-tree-name", { hasText: "#notes.md" }),
    }),
  ).toHaveCount(1);
  await expect(
    tree
      .locator(".mdmark-tree-row", {
        has: page.locator(".mdmark-tree-name", {
          hasText: /^(C#\/|#notes\.md)$/,
        }),
      })
      .locator(".mdmark-tree-note"),
  ).toHaveCount(0);
  // 検証: index.ts と README.md のアイコンが違う
  const masks = await Promise.all(
    ["index.ts", "README.md"].map((name) =>
      nameOf(tree, name).evaluate(
        (element) => getComputedStyle(element, "::before").maskImage,
      ),
    ),
  );
  expect(masks[0]).toContain("data:image/svg+xml");
  expect(masks[1]).toContain("data:image/svg+xml");
  expect(masks[0]).not.toBe(masks[1]);
  // 検証: ... はファイルでもフォルダでもない「ほかにもある」の項目
  const more = tree.locator("li.mdmark-tree-more");
  await expect(more).toHaveCount(1);
  await expect(more.locator(".mdmark-visually-hidden")).toHaveText(
    "ほかにもあります",
  );
});

// ツリーを open= の階層まで開いて描き、フォルダの名前・アイコンの押下と Enter で開閉し、Shift を押しながらなら入れ子も同じ状態にする（正常シナリオ（ファイルツリーのフォルダを開閉する））
test("test_normal_when_tree_folders_toggled", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      ...NESTED_TREE,
      "",
      '<!-- tree: {"depth": 2} -->',
      "",
      ...NESTED_TREE,
      "",
    ].join("\n"),
  });
  const first = treeAt(page, 0);
  const second = treeAt(page, 1);
  // 検証: 描いた直後
  await expect(folderButton(first, "app/")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(folderButton(first, "src/")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(nameOf(first, "parts/")).toBeHidden();
  await expect(folderButton(second, "app/")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(folderButton(second, "src/")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(folderButton(second, "parts/")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(nameOf(second, "tree.ts")).toBeHidden();
  // 実行: src/ の名前を押す
  await nameOf(first, "src/").click();
  // 検証
  await expect(folderButton(first, "src/")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(nameOf(first, "parts/")).toBeVisible();
  // 実行: フォーカスして Enter を押す
  await folderButton(first, "src/").focus();
  await page.keyboard.press("Enter");
  // 検証
  await expect(folderButton(first, "src/")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  // 実行: app/ のアイコンを Shift を押しながら押す
  await folderButton(first, "app/").click({
    modifiers: ["Shift"],
    position: { x: 24, y: 10 },
  });
  // 検証: app/ と入れ子を全て閉じる
  for (const name of ["app/", "src/", "parts/"]) {
    await expect(
      first.getByRole("button", { name, exact: true, includeHidden: true }),
    ).toHaveAttribute("aria-expanded", "false");
  }
  // 実行: もう一度 Shift を押しながら押す
  await folderButton(first, "app/").click({
    modifiers: ["Shift"],
    position: { x: 24, y: 10 },
  });
  // 検証: 入れ子を全て開く
  for (const name of ["app/", "src/", "parts/"]) {
    await expect(folderButton(first, name)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  }
  await expect(nameOf(first, "tree.ts")).toBeVisible();
});

// ASCII の罫線を今の罫線と同じ階層で読み込み、入れ子のツリーにする（正常シナリオ（ASCII の罫線のファイルツリー））
test("test_normal_when_tree_ascii", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "```tree",
      "src/",
      "|-- index.ts",
      "`-- parts/",
      "    |-- tree.ts",
      "    `-- ...",
      "```",
      "",
    ].join("\n"),
  });
  // 検証
  const tree = treeAt(page, 0);
  await expect(
    tree.locator(".mdmark-tree-folder > .mdmark-tree-row .mdmark-tree-name"),
  ).toHaveText(["src/", "parts/"]);
  await expect(
    tree.locator(".mdmark-tree-file > .mdmark-tree-row .mdmark-tree-name"),
  ).toHaveText(["index.ts", "tree.ts"]);
  await expect(tree.locator("li.mdmark-tree-more")).toHaveCount(1);
  await expect(tree.locator(".mdmark-tree-list")).not.toContainText("|");
  await expect(tree.locator(".mdmark-tree-list")).not.toContainText("--");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// コピーボタンで、閉じたフォルダの中の行も含めた元の罫線のテキストをクリップボードへ書き込み、ボタンとスクリーンリーダーで通知する（正常シナリオ（ファイルツリーをコピーする））
test("test_normal_when_tree_copied", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: ["```tree", ...NOTE_TREE, "```", ""].join("\n"),
  });
  const tree = treeAt(page, 0);
  const button = tree.locator("button.mdmark-tree-copy");
  await expect(nameOf(tree, "index.ts")).toBeHidden();
  // 実行
  await button.click();
  // 検証
  await expect(button).toContainText("コピーしました");
  expect(await writtenTexts(page)).toEqual([NOTE_TREE.join("\n")]);
  await expect(tree.locator('[role="status"]')).toContainText("コピーしました");
});

// クリップボードに書き込めなければ、元の罫線のテキストを全て選択したパネルを出し、閉じるボタンと Esc で閉じてフォーカスをコピーボタンへ戻す（異常シナリオ（ファイルツリーをクリップボードに書き込めない））
test("test_error_when_tree_clipboard_denied", async ({ page }) => {
  // 準備
  await stubClipboard(page, "deny");
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: ["```tree", ...NOTE_TREE, "```", ""].join("\n"),
  });
  const tree = treeAt(page, 0);
  const button = tree.locator("button.mdmark-tree-copy");
  // 実行
  await button.click();
  // 検証: パネルの中に、元の罫線のテキストが全て選択された状態で出る
  const panel = tree.locator(".mdmark-copy-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("クリップボードにコピーできませんでした");
  await expect(tree.locator('[role="status"]')).toContainText("手動でコピー");
  const textarea = panel.locator("textarea");
  await expect(textarea).toHaveValue(NOTE_TREE.join("\n"));
  const selection = await textarea.evaluate((element) => {
    const area = element as HTMLTextAreaElement;
    return {
      start: area.selectionStart,
      end: area.selectionEnd,
      length: area.value.length,
    };
  });
  expect(selection).toEqual({
    start: 0,
    end: selection.length,
    length: selection.length,
  });
  // 実行: Esc で閉じる
  await page.keyboard.press("Escape");
  // 検証
  await expect(panel).toHaveCount(0);
  await expect(button).toBeFocused();
  // 実行: もう一度コピーし、閉じるボタンで閉じる
  await button.click();
  await panel.getByRole("button", { name: "閉じる" }).click();
  // 検証
  await expect(panel).toHaveCount(0);
  await expect(button).toBeFocused();
});

// 読み込めない depth は記載の警告を出し、既定の開き方（ルートだけ開く）でツリーを描く（異常シナリオ（ファイルツリーの読み込めない depth））
test("test_error_when_tree_open_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: ['<!-- tree: {"depth": "deep"} -->', "", ...NESTED_TREE, ""].join(
      "\n",
    ),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("depth");
  await expect(warning).toContainText('"all"');
  await expect(warning).toContainText("1 以上の整数");
  const tree = treeAt(page, 0);
  await expect(folderButton(tree, "app/")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(folderButton(tree, "src/")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(nameOf(tree, "parts/")).toBeHidden();
});

/** 画面の幅 390px で表示の幅より長い名前と注釈を入れ子の中に持つファイルツリー */
const WRAP_TREE = [
  "```tree",
  "very-long-folder-name-for-the-generated-design-documents/",
  "└── a-file-name-that-is-much-longer-than-the-box-width-on-phones.config.ts # 狭い幅では注釈も項目の中で折り返す",
  "```",
];

/** ツリーのリストの横のはみ出し・入れ子の線の左端の位置・ファイルの名前と注釈の行の左端 */
function treeLayout(tree: Locator) {
  return tree.locator(".mdmark-tree-list").evaluate((list) => {
    const lefts = (element: Element | null) => {
      const text = element
        ? document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()
        : null;
      if (!text) {
        return [];
      }
      const range = document.createRange();
      range.selectNodeContents(text);
      return [...range.getClientRects()].map((rect) => Math.round(rect.left));
    };
    const nested = list.querySelector("ul ul");
    return {
      overflows: list.scrollWidth > list.clientWidth,
      nestedLeft: nested
        ? Math.round(
            nested.getBoundingClientRect().left -
              list.getBoundingClientRect().left,
          )
        : -1,
      name: lefts(list.querySelector(".mdmark-tree-file .mdmark-tree-name")),
      note: lefts(list.querySelector(".mdmark-tree-file .mdmark-tree-note")),
    };
  });
}

// wrap のツリーだけを、名前の頭に統一して項目の中で折り返す（正常シナリオ（ファイルツリーを折り返す））
test("test_normal_when_tree_wrap", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- tree: {"depth": "all", "wrap": true} -->',
      "",
      ...WRAP_TREE,
      "",
      '<!-- tree: {"depth": "all"} -->',
      "",
      ...WRAP_TREE,
      "",
    ].join("\n"),
  });
  // 検証
  const wrapped = await treeLayout(page.locator("#doc .mdmark-tree").nth(0));
  const plain = await treeLayout(page.locator("#doc .mdmark-tree").nth(1));
  expect(wrapped.overflows).toBe(false);
  expect(wrapped.name.length).toBeGreaterThanOrEqual(2);
  expect(new Set(wrapped.name).size).toBe(1);
  expect(wrapped.note[0]).toBe(wrapped.name[0]);
  expect(wrapped.nestedLeft).toBe(plain.nestedLeft);
  expect(plain.overflows).toBe(true);
  expect(plain.name).toHaveLength(1);
});

// 見出しと段落のアイコン・キー・ルビを、スクリプト無しの外観で描く（正常シナリオ（アイコン・キー・ルビ））
test("test_normal_when_icon_kbd_ruby", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const requests = await routeLucide(page);
  // 実行
  await mountDocument(page, {
    markdown:
      "## `icon:flag` はじめに\n\n`icon:check` 保存したら `kbd:Ctrl+C` で写し、<ruby>漢字<rt>かんじ</rt></ruby>を読む。\n",
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(
    doc.locator('h2 .mdmark-inline-icon[data-icon="flag"] svg'),
  ).toHaveCount(1);
  await expect(
    doc.locator('p .mdmark-inline-icon[data-icon="check"] svg'),
  ).toHaveCount(1);
  await expect(doc).not.toContainText("icon:");
  await expect(doc.locator(".mdmark-inline-icon").first()).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(doc.getByRole("heading", { level: 2 })).toHaveAccessibleName(
    /^はじめに/,
  );
  await expect(doc.locator(".mdmark-kbd")).toHaveText(["Ctrl", "C"]);
  await expect(doc).not.toContainText("kbd:");
  await expect(doc.locator("ruby rt")).toHaveText("かんじ");
  await page.waitForTimeout(SETTLE_MS);
  expect(requests).toEqual([]);
  await expect(doc.locator(".mdmark-syntax-warning")).toHaveCount(0);
});

// 頭の : の前に \ を記載した行内のコードは、記載したとおりの文字で出す（正常シナリオ（アイコンとキーの記載方法を見せる））
test("test_normal_when_icon_kbd_escaped", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: "`icon\\:check` と `kbd\\:Ctrl+C`\n" });
  // 検証
  await expect(page.locator("#doc code")).toHaveText([
    "icon:check",
    "kbd:Ctrl+C",
  ]);
  await expect(
    page.locator("#doc .mdmark-inline-icon, #doc .mdmark-kbd"),
  ).toHaveCount(0);
});

// 名前の記載方法に合わないアイコンは、警告を配置して記載したとおりの文字で出す（異常シナリオ（アイコンの名前の記載方法が誤っている））
test("test_error_when_icon_name_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const requests = await routeLucide(page);
  // 実行
  await mountDocument(page, {
    markdown: "`icon:Rocket!` の段落\n\n`icon:` の段落\n",
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("Rocket!");
  const next = warning.locator("xpath=following-sibling::p[1]");
  await expect(next.locator("code")).toHaveText("icon:Rocket!");
  await expect(page.locator("#doc code", { hasText: /^icon:$/ })).toHaveCount(
    1,
  );
  await page.waitForTimeout(SETTLE_MS);
  expect(requests).toEqual([]);
});
