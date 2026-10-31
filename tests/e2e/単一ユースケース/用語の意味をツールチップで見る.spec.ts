import { expect, type Locator, type Page, test } from "@playwright/test";
import type { MdmarkIndex } from "../../../src/index.ts";
import { wrapHtml } from "../chart.ts";
import { stubClipboard, writtenTexts } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  rawAliases,
  removeDistRoot,
} from "../dist-page.ts";
import {
  expectAbove,
  expectBelow,
  expectInViewport,
  TOP_EDGE_CSS,
} from "../tooltip.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 描く文書の索引の id
const DOC_ID = "doc";

// 用語 `ワークスペース`（別名 `WS`）と `印` を持ち、描く文書を持つ索引
const INDEX: MdmarkIndex = {
  schema: 1,
  docs: [{ id: DOC_ID, path: "doc.md", title: "描く文書" }],
  terms: [
    {
      id: "workspace",
      term: "ワークスペース",
      aliases: ["WS"],
      meaning: "話し合いの記録を置くフォルダ",
    },
    { id: "mark", term: "印", meaning: "HTML コメントで書く指定" },
  ],
};

// 1 つ目の節に `ワークスペース` が 2 回と `WS`、2 つ目の節に `WS` と `印刷` が出る文書
const MARKDOWN = [
  "## 一つ目",
  "",
  "ワークスペースを置き、ワークスペースを使う。WS も同じ。",
  "",
  "## 二つ目",
  "",
  "WS を使う。印刷を行う。",
  "",
].join("\n");

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 節ごとに用語を最初に出たところだけに下線を引き、語の区切りに揃う語だけに付け、ポインターを乗せると意味を出す（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: MARKDOWN,
    index: INDEX,
    docId: DOC_ID,
  });
  // 実行・検証
  const sections = page.locator("#doc .mdmark-section-body");
  const first = sections.nth(0);
  const second = sections.nth(1);
  // 1 つ目の節: 最初の `ワークスペース` だけに付き、2 回目と同じ用語の別名 `WS` には付かない
  await expect(first.locator(".mdmark-term")).toHaveText(["ワークスペース"]);
  // 2 つ目の節: `WS` に付き、`印刷` の `印` には付かない
  await expect(second.locator(".mdmark-term")).toHaveText(["WS"]);
  await expect(
    page.locator("#doc .mdmark-term", { hasText: /^印$/ }),
  ).toHaveCount(0);
  // ポインターを乗せると意味が出て、ツールチップの上へ移っても出たまま
  const term = second.locator(".mdmark-term");
  const tip = second.locator(".mdmark-term-tip");
  await expect(tip).toBeHidden();
  await term.hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("話し合いの記録を置くフォルダ");
  // ツールチップは語の上に出る
  await expectAbove({ tip, owner: term });
  // ポインターの形は `?` にならない
  expect(
    await term.evaluate((element) => getComputedStyle(element).cursor),
  ).not.toBe("help");
  await tip.hover();
  await expect(tip).toBeVisible();
});

// Tab で下線の付いた語へフォーカスして意味を読み、Esc で消す（正常シナリオ（キーボードで読む））
test("test_normal_when_keyboard", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: MARKDOWN,
    index: INDEX,
    docId: DOC_ID,
  });
  // 実行・検証
  // 1 回目の Tab は `## 一つ目` の開閉のボタン、2 回目はそのアンカーのリンク、3 回目が最初の用語
  const heading = page.locator("#doc h2").first();
  const term = page.locator("#doc .mdmark-term").first();
  const tip = page.locator("#doc .mdmark-term-tip").first();
  await page.keyboard.press("Tab");
  await expect(heading.locator("button.mdmark-section-toggle")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(heading.locator("a.mdmark-anchor")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(term).toBeFocused();
  await expect(tip).toBeVisible();
  const describedBy = await term.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveAttribute(
    "role",
    "tooltip",
  );
  // Esc: ツールチップが消え、フォーカスは語に残る
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
  await expect(term).toBeFocused();
});

// 見出し・行内のコード・コードブロック・リンクの文字の中の語には下線を引かない（正常シナリオ（下線を付けない場所））
test("test_normal_when_excluded_place", async ({ page }) => {
  // 準備
  const markdown = [
    "## ワークスペース",
    "",
    "`ワークスペース`",
    "",
    "```",
    "ワークスペース",
    "```",
    "",
    "[ワークスペース](https://example.com/)",
    "",
  ].join("\n");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown, index: INDEX, docId: DOC_ID });
  // 検証
  await expect(page.locator("#doc .mdmark-term")).toHaveCount(0);
  await expect(page.locator("#doc h2")).toContainText("ワークスペース");
  await expect(page.locator("#doc pre")).toContainText("ワークスペース");
});

// 索引を渡さない文書には下線を引かず、本文を描く（正常シナリオ（索引を渡さない））
test("test_normal_when_no_index", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  await expect(page.locator("#doc .mdmark-term")).toHaveCount(0);
  await expect(page.locator("#doc p").first()).toContainText("ワークスペース");
});

// 索引の一部が Schema に合わなくても、読めた用語だけに下線を引いて本文を描く（異常シナリオ（Schema に合わない索引））
test("test_error_when_invalid_index", async ({ page }) => {
  // 準備
  const index = {
    schema: 1,
    docs: [{ id: DOC_ID, path: "doc.md", title: "描く文書" }],
    terms: [
      {
        id: "workspace",
        term: "ワークスペース",
        meaning: "話し合いの記録を置くフォルダ",
      },
      { id: "branch", term: "ブランチ" },
    ],
  } as unknown as MdmarkIndex;
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "ワークスペースとブランチを使う。\n",
    index,
    docId: DOC_ID,
  });
  // 検証
  await expect(page.locator("#doc p")).toBeVisible();
  await expect(page.locator("#doc .mdmark-term")).toHaveText([
    "ワークスペース",
  ]);
  await page.locator("#doc .mdmark-term").hover();
  await expect(page.locator("#doc .mdmark-term-tip")).toContainText(
    "話し合いの記録を置くフォルダ",
  );
});

// 埋め込んだ HTML の中の語にも下線を引き、フォーカスすると意味を出し、リンクの文字には引かず、後ろの Markdown は節ごとに最初に出たところだけに引く決まりのまま（正常シナリオ（埋め込んだ HTML の中の用語））
test("test_normal_when_embedded_html", async ({ page }) => {
  // 準備
  const markdown = [
    wrapHtml(
      [
        "<p>ワークスペースを置く。</p>",
        '<p><a href="https://example.com/">ワークスペース</a>へのリンク。</p>',
      ].join("\n"),
    ),
    "後ろの段落でもワークスペースを使う。",
    "",
  ].join("\n");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown, index: INDEX, docId: DOC_ID });
  // 検証: HTML の中の段落の語に、本文の用語と同じ破線の下線が引かれている
  const term = page.locator("#doc .mdmark-html p .mdmark-term");
  await expect(term).toHaveCount(1);
  await expect(term).toHaveText("ワークスペース");
  await expect(term).toHaveCSS("text-decoration-style", "dashed");
  expect(
    await term.evaluate((element) => getComputedStyle(element).cursor),
  ).not.toBe("help");
  // 実行: 語にフォーカスする
  await term.focus();
  // 検証: 意味のツールチップが出る
  const describedBy = await term.getAttribute("aria-describedby");
  const tip = page.locator(`[id="${describedBy}"]`);
  await expect(tip).toBeVisible();
  await expect(tip).toHaveAttribute("role", "tooltip");
  await expect(tip).toContainText("話し合いの記録を置くフォルダ");
  // HTML の中のリンクの文字には下線が引かれていない
  await expect(page.locator("#doc .mdmark-html a .mdmark-term")).toHaveCount(0);
  // 後ろの Markdown の段落は、節ごとに最初に出たところだけに引く決まりのとおり、HTML とは別に最初の語へ下線が引かれる
  const after = page.locator("#doc p", { hasText: "後ろの段落でも" });
  await expect(after.locator(".mdmark-term")).toHaveCount(1);
  await expect(page.locator("#doc .mdmark-term")).toHaveCount(2);
});

// 用語 `ワークスペース` のやめた言い方 `作業場` を持つ索引
const AVOID_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [{ id: DOC_ID, path: "doc.md", title: "描く文書" }],
  terms: [
    {
      id: "workspace",
      term: "ワークスペース",
      meaning: "話し合いの記録を置くフォルダ",
      avoid: ["作業場"],
    },
  ],
};

// 1 つ目の節の段落に `作業場` が 2 回と `ワークスペース` が 1 回、2 つ目の節の段落に `作業場` が出て、見出しと行内のコードにも `作業場` を書いた文書
const AVOID_MARKDOWN = [
  "## 一つ目の作業場",
  "",
  "作業場を置き、作業場を使う。ワークスペースも同じ。`作業場` も書く。",
  "",
  "## 二つ目",
  "",
  "作業場を使う。",
  "",
].join("\n");

// 節ごとにやめた言い方が最初に出たところだけに波線のマーカーを付け、ポインターとフォーカスで代わりの用語のツールチップを出し、Esc で消す（正常シナリオ（やめた言い方が本文に出る））
test("test_normal_when_avoided_term", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: AVOID_MARKDOWN,
    index: AVOID_INDEX,
    docId: DOC_ID,
  });
  // 実行・検証
  const sections = page.locator("#doc .mdmark-section-body");
  const first = sections.nth(0);
  const second = sections.nth(1);
  // 1 つ目の節: 最初の `作業場` だけにマーカーが付き、2 回目の `作業場` と行内のコードには付かない
  await expect(first.locator(".mdmark-term-avoided")).toHaveText(["作業場"]);
  await expect(first.locator("code .mdmark-term")).toHaveCount(0);
  // 1 つ目の節の `ワークスペース` には、マーカーでなく用語の破線の下線が付く
  const workspace = first.locator(".mdmark-term:not(.mdmark-term-avoided)");
  await expect(workspace).toHaveText(["ワークスペース"]);
  await expect(workspace).toHaveCSS("text-decoration-style", "dashed");
  // 2 つ目の節の `作業場` にマーカーが付く。見出しの `作業場` には付かない
  await expect(second.locator(".mdmark-term-avoided")).toHaveText(["作業場"]);
  await expect(page.locator("#doc h2 .mdmark-term")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-term-avoided")).toHaveCount(2);
  // マーカーは用語の破線の下線と、形で見分けられる
  const marker = first.locator(".mdmark-term-avoided");
  await expect(marker).toHaveCSS("text-decoration-line", "underline");
  await expect(marker).toHaveCSS("text-decoration-style", "wavy");
  // ポインターを乗せると代わりの用語と意味が出て、ツールチップの上へ移っても出たまま
  const tip = first
    .locator(".mdmark-term-wrap", {
      has: page.locator(".mdmark-term-avoided"),
    })
    .locator(".mdmark-term-tip");
  await expect(tip).toBeHidden();
  await marker.hover();
  await expect(tip).toBeVisible();
  await expect(tip.locator(".mdmark-term-tip-heading")).toHaveText([
    "代わりの用語",
  ]);
  await expect(tip.locator(".mdmark-term-tip-replacement")).toHaveText(
    "ワークスペース",
  );
  await expect(tip.locator(".mdmark-term-tip-meaning")).toHaveText(
    "話し合いの記録を置くフォルダ",
  );
  await tip.hover();
  await expect(tip).toBeVisible();
  // Tab でマーカーの付いた語へフォーカスし、`aria-describedby` がツールチップを指す
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
  await page.keyboard.press("Tab");
  const heading = page.locator("#doc h2").first();
  await expect(heading.locator("button.mdmark-section-toggle")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(heading.locator("a.mdmark-anchor")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(marker).toBeFocused();
  await expect(tip).toBeVisible();
  const describedBy = await marker.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveAttribute(
    "role",
    "tooltip",
  );
  // Esc: ツールチップが消え、フォーカスは語に残る
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
  await expect(marker).toBeFocused();
});

// 語の上にツールチップの高さが残らないときだけ、語の下に出して画面に収める（正常シナリオ（上に収まらない語））
test("test_normal_when_no_room_above", async ({ page }) => {
  // 準備: 描く先の要素をページの上端に置き、スクロールせずに 1 行目の語を描く
  await openPage(page, builtRoot, { hostCss: TOP_EDGE_CSS });
  await mountDocument(page, {
    markdown: "ワークスペースを使う。\n",
    index: INDEX,
    docId: DOC_ID,
  });
  const term = page.locator("#doc .mdmark-term");
  const tip = page.locator("#doc .mdmark-term-tip");
  // 実行
  await term.hover();
  // 検証
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("話し合いの記録を置くフォルダ");
  await expectBelow({ tip, owner: term });
  await expectInViewport({ page, tip });
});

// 設定の tooltips.placement を bottom にすると、下に収まるツールチップを語の下に出す（正常シナリオ（設定で下に出す））
test("test_normal_when_placement_bottom", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: MARKDOWN,
    index: INDEX,
    docId: DOC_ID,
    config: { tooltips: { placement: "bottom" } },
  });
  const second = page.locator("#doc .mdmark-section-body").nth(1);
  const term = second.locator(".mdmark-term");
  const tip = second.locator(".mdmark-term-tip");
  // 実行
  await term.hover();
  // 検証
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("話し合いの記録を置くフォルダ");
  await expectBelow({ tip, owner: term });
});

// 全角と半角・大文字と小文字だけが違う語にも下線を引き、文字は本文の表記のまま、やめた言い方には代わりの用語のツールチップを出す（正常シナリオ（全角と半角・大文字と小文字だけが違う語））
test("test_normal_when_width_and_case_differ", async ({ page }) => {
  // 準備
  const index: MdmarkIndex = {
    schema: 1,
    docs: [{ id: DOC_ID, path: "doc.md", title: "描く文書" }],
    terms: [
      {
        id: "workspace",
        term: "ワークスペース",
        aliases: ["WS"],
        meaning: "話し合いの記録を置くフォルダ",
        avoid: ["workplace"],
      },
    ],
  };
  const markdown = [
    "## 一つ目",
    "",
    "ＷＳを開く。",
    "",
    "## 二つ目",
    "",
    "ws と WorkPlace を書く。",
    "",
  ].join("\n");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown, index, docId: DOC_ID });
  // 検証
  const sections = page.locator("#doc .mdmark-section-body");
  const first = sections.nth(0);
  const second = sections.nth(1);
  // 下線の付いた語の文字は、本文に記載したまま
  await expect(first.locator(".mdmark-term")).toHaveText(["ＷＳ"]);
  await expect(second.locator(".mdmark-term")).toHaveText(["ws", "WorkPlace"]);
  await expect(first.locator(".mdmark-term")).toHaveCSS(
    "text-decoration-style",
    "dashed",
  );
  await expect(second.locator(".mdmark-term").first()).toHaveCSS(
    "text-decoration-style",
    "dashed",
  );
  // `ＷＳ` にポインターを乗せると意味が出る
  const wsTip = first.locator(".mdmark-term-tip");
  await first.locator(".mdmark-term").hover();
  await expect(wsTip).toBeVisible();
  await expect(wsTip).toContainText("話し合いの記録を置くフォルダ");
  // `WorkPlace` はやめた言い方のマーカーで、代わりの用語と意味が出る
  const avoided = second.locator(".mdmark-term-avoided");
  await expect(avoided).toHaveText("WorkPlace");
  await expect(avoided).toHaveCSS("text-decoration-style", "wavy");
  await avoided.hover();
  const avoidedTip = second.locator(".mdmark-term-tip").nth(1);
  await expect(avoidedTip).toBeVisible();
  await expect(avoidedTip).toContainText("ワークスペース");
  await expect(avoidedTip).toContainText("話し合いの記録を置くフォルダ");
});

/** コマンドのエイリアス `単体テスト` */
const UNIT_TEST_ALIAS = {
  alias_type: "command",
  id: "unit-test",
  name: "単体テスト",
  aliases: [],
  description: "ライブラリ本体の単体テストを流す",
  command: "npm run test:unit",
  cwd: "リポジトリの直下",
};

/** 下線を引いた語と、その語に付いたツールチップを包む要素を返す */
function wrapOf(page: Page, word: string): Locator {
  return page.locator("#doc .mdmark-term-wrap").filter({
    has: page.locator(".mdmark-term", { hasText: new RegExp(`^${word}$`) }),
  });
}

// 渡したエイリアスの名前と別名に下線を引き、種類ごとのツールチップを出す。env は照合しない（正常シナリオ（エイリアスを渡す））
test("test_normal_when_aliases", async ({ page }) => {
  // 準備
  const aliases = rawAliases([
    {
      alias_type: "term",
      id: "review",
      name: "レビュー",
      aliases: ["査読"],
      description: "変更を別の人が確かめること",
    },
    {
      alias_type: "doc",
      id: "design-doc",
      name: "設計書",
      aliases: [],
      description: "仕様を記載した文書",
    },
    {
      alias_type: "url",
      id: "issues",
      name: "課題の一覧",
      aliases: [],
      description: "Issue を並べたページ",
      url: "https://github.com/shuhei1101/mdmark/issues",
    },
    {
      alias_type: "skill",
      id: "session",
      name: "記録の取り込み",
      aliases: [],
      skill: "mindstella:session",
    },
    {
      alias_type: "tool",
      id: "check-tool",
      name: "点検のツール",
      aliases: [],
      tool: "check",
    },
    {
      alias_type: "path",
      id: "config-file",
      name: "設定ファイル",
      aliases: [],
      path: "mdmark.config.yaml",
    },
    {
      alias_type: "env",
      id: "dev-server",
      name: "開発サーバー",
      aliases: [],
      url: "http://127.0.0.1:8767/",
      port: "8767",
    },
  ]);
  const markdown = [
    "## 一つ目",
    "",
    "レビュー、設計書、課題の一覧、記録の取り込み、点検のツール、設定ファイル、開発サーバーを並べる。",
    "",
    "## 二つ目",
    "",
    "査読を書く。",
    "",
  ].join("\n");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown, aliases });
  // 検証
  const doc = page.locator("#doc");
  // env を除く 6 つの名前と別名 `査読` に、用語と同じ破線の下線が付く
  const terms = doc.locator(".mdmark-term");
  await expect(terms).toHaveText([
    "レビュー",
    "設計書",
    "課題の一覧",
    "記録の取り込み",
    "点検のツール",
    "設定ファイル",
    "査読",
  ]);
  for (const term of await terms.all()) {
    await expect(term).toHaveCSS("text-decoration-style", "dashed");
  }
  // env: 下線もツールチップも無く、値が文書に入らない
  await expect(doc.locator(".mdmark-term-tip")).toHaveCount(7);
  await expect(doc).toContainText("開発サーバー");
  expect(await doc.innerHTML()).not.toContain("http://127.0.0.1:8767/");
  // 査読: ポインターを乗せると名前と説明が出る
  const reviewTip = wrapOf(page, "査読").locator(".mdmark-term-tip");
  await wrapOf(page, "査読").locator(".mdmark-term").hover();
  await expect(reviewTip).toBeVisible();
  await expect(reviewTip.locator(".mdmark-term-tip-name")).toHaveText(
    "レビュー",
  );
  await expect(reviewTip.locator(".mdmark-term-tip-meaning")).toHaveText(
    "変更を別の人が確かめること",
  );
  // 設計書: 名前と概要が出る
  const docTip = wrapOf(page, "設計書").locator(".mdmark-term-tip");
  await wrapOf(page, "設計書").locator(".mdmark-term").focus();
  await expect(docTip.locator(".mdmark-term-tip-name")).toHaveText("設計書");
  await expect(docTip.locator(".mdmark-term-tip-meaning")).toHaveText(
    "仕様を記載した文書",
  );
  // スキル・ツール・パス: 値がコードとして出る
  const codes: Array<[string, string]> = [
    ["記録の取り込み", "mindstella:session"],
    ["点検のツール", "check"],
    ["設定ファイル", "mdmark.config.yaml"],
  ];
  for (const [word, code] of codes) {
    await wrapOf(page, word).locator(".mdmark-term").focus();
    await expect(
      wrapOf(page, word).locator(".mdmark-term-tip code"),
    ).toHaveText(code);
  }
  // 課題の一覧: 名前・説明とリンクが出る。Tab でリンクへ移り、Esc で消える
  const issues = wrapOf(page, "課題の一覧").locator(".mdmark-term");
  const issuesTip = wrapOf(page, "課題の一覧").locator(".mdmark-term-tip");
  await issues.focus();
  await expect(issuesTip).toBeVisible();
  await expect(issuesTip.locator(".mdmark-term-tip-name")).toHaveText(
    "課題の一覧",
  );
  await expect(issuesTip.locator(".mdmark-term-tip-meaning")).toHaveText(
    "Issue を並べたページ",
  );
  const link = issuesTip.locator("a");
  await expect(link).toHaveAttribute(
    "href",
    "https://github.com/shuhei1101/mdmark/issues",
  );
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect(issuesTip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(issuesTip).toBeHidden();
});

// コマンドのツールチップのコピーのボタンで、コマンドをクリップボードへ書き、ボタンの文字で知らせる（正常シナリオ（コマンドをコピーする））
test("test_normal_when_copy_command", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: "手元で単体テストを流す。\n",
    aliases: rawAliases([UNIT_TEST_ALIAS]),
  });
  const term = page.locator("#doc .mdmark-term");
  const tip = page.locator("#doc .mdmark-term-tip");
  const button = tip.locator("button.mdmark-term-tip-copy");
  // 実行
  await term.focus();
  // 検証: ツールチップの中身
  await expect(tip).toBeVisible();
  await expect(tip.locator(".mdmark-term-tip-heading")).toHaveText([
    "コマンド",
  ]);
  await expect(tip.locator(".mdmark-term-tip-meaning")).toHaveText(
    "ライブラリ本体の単体テストを流す",
  );
  await expect(tip.locator("code")).toHaveText("npm run test:unit");
  await expect(tip).toContainText("実行場所");
  await expect(tip).toContainText("リポジトリの直下");
  await expect(button).toHaveText("コピー");
  // 実行: Tab でコピーのボタンへ移り、Enter で押す
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  // 検証: コマンドを書き、ボタンの文字と読み上げで知らせ、ツールチップは出たまま
  await expect(button).toHaveText("コピーしました");
  await expect(button).toHaveAttribute("data-state", "copied");
  expect(await writtenTexts(page)).toEqual(["npm run test:unit"]);
  await expect(tip.locator('[role="status"]')).toContainText(
    "コマンドをコピーしました",
  );
  await expect(tip).toBeVisible();
});

// avoid の種類と term の avoid の語に波線のマーカーを付け、置き換え先のツールチップを出す（正常シナリオ（やめた言い方のエイリアス））
test("test_normal_when_avoid_alias", async ({ page }) => {
  // 準備
  const aliases = rawAliases([
    {
      alias_type: "avoid",
      id: "workplace",
      name: "作業場",
      aliases: [],
      replacement: "ワークスペース",
    },
    {
      alias_type: "term",
      id: "branch",
      name: "ブランチ",
      aliases: [],
      description: "作業を分ける線",
      avoid: ["枝"],
    },
  ]);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: "作業場と枝を書く。\n", aliases });
  // 検証
  const terms = page.locator("#doc .mdmark-term");
  await expect(terms).toHaveText(["作業場", "枝"]);
  for (const term of await terms.all()) {
    await expect(term).toHaveClass(/mdmark-term-avoided/);
    await expect(term).toHaveCSS("text-decoration-style", "wavy");
  }
  // 作業場: 置き換え先だけが出る
  const workplaceTip = wrapOf(page, "作業場").locator(".mdmark-term-tip");
  await wrapOf(page, "作業場").locator(".mdmark-term").hover();
  await expect(workplaceTip).toBeVisible();
  await expect(workplaceTip.locator(".mdmark-term-tip-heading")).toHaveText([
    "代わりの用語",
  ]);
  await expect(workplaceTip.locator(".mdmark-term-tip-replacement")).toHaveText(
    "ワークスペース",
  );
  // 枝: term の名前と説明が出る
  const branchTip = wrapOf(page, "枝").locator(".mdmark-term-tip");
  await wrapOf(page, "枝").locator(".mdmark-term").hover();
  await expect(branchTip).toBeVisible();
  await expect(branchTip.locator(".mdmark-term-tip-replacement")).toHaveText(
    "ブランチ",
  );
  await expect(branchTip.locator(".mdmark-term-tip-meaning")).toHaveText(
    "作業を分ける線",
  );
});

// 種類の必須のキーが空・知らない種類のエイリアスは照合せず、http と https でない URL は文字で出し、描く処理は止まらない（異常シナリオ（使えないエイリアス））
test("test_error_when_invalid_alias", async ({ page }) => {
  // 準備
  const aliases = rawAliases([
    {
      alias_type: "term",
      id: "review",
      name: "レビュー",
      aliases: [],
      description: "変更を別の人が確かめること",
    },
    {
      alias_type: "command",
      id: "build",
      name: "ビルド",
      aliases: [],
      command: "",
    },
    { alias_type: "memo", id: "memo", name: "メモ", aliases: [] },
    {
      alias_type: "url",
      id: "danger",
      name: "危ないリンク",
      aliases: [],
      description: "文字で出す URL",
      url: "javascript:alert(1)",
    },
  ]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "レビュー、ビルド、メモ、危ないリンクを書く。\n",
    aliases,
  });
  // 検証
  await expect(page.locator("#doc p")).toContainText("ビルド");
  await expect(page.locator("#doc .mdmark-term")).toHaveText([
    "レビュー",
    "危ないリンク",
  ]);
  const reviewTip = wrapOf(page, "レビュー").locator(".mdmark-term-tip");
  await wrapOf(page, "レビュー").locator(".mdmark-term").hover();
  await expect(reviewTip).toBeVisible();
  await expect(reviewTip.locator(".mdmark-term-tip-meaning")).toHaveText(
    "変更を別の人が確かめること",
  );
  // 危ないリンク: URL はリンクにせず文字で出る
  const dangerTip = wrapOf(page, "危ないリンク").locator(".mdmark-term-tip");
  await wrapOf(page, "危ないリンク").locator(".mdmark-term").hover();
  await expect(dangerTip).toBeVisible();
  await expect(dangerTip).toContainText("javascript:alert(1)");
  await expect(dangerTip.locator("a")).toHaveCount(0);
  // 描く処理が例外を投げず、知らせの枠も出ない
  expect(errors).toEqual([]);
  await expect(page.locator("#doc .mdmark-notice")).toHaveCount(0);
});
