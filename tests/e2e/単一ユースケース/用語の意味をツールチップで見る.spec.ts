import { expect, test } from "@playwright/test";
import type { MdmarkIndex } from "../../../src/index.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

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
  // 実行
  await page.keyboard.press("Tab");
  // 検証
  const term = page.locator("#doc .mdmark-term").first();
  const tip = page.locator("#doc .mdmark-term-tip").first();
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
