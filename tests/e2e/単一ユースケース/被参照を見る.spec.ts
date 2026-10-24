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

// 3 つの文書を別のフォルダに置く索引（`api` の `related` が `arch`）
const INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    {
      id: "api",
      path: "api.md",
      title: "API",
      related: ["arch"],
    },
    { id: "guide", path: "使い方/guide.md", title: "使い方" },
  ],
};

// `arch` の本文: 見出しと、自分のパス `arch.md` へのリンクを持つ段落
const ARCH_BODY = "# アーキテクチャ\n\n自分への[リンク](arch.md)です。\n";

// ほかの文書の本文: `guide` が `../設計/arch.md` へのリンクを持つ
const DOCUMENTS = {
  "設計/arch.md": ARCH_BODY,
  "api.md": "# API\n",
  "使い方/guide.md": "# 使い方\n\n[構成](../設計/arch.md)\n",
};

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 文書の末尾に、参照している文書の一覧を相対パスのリンクで置き、題を押すとその文書へ移る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await page.route("**/api.md", (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>api</p>" }),
  );
  await mountDocument(page, {
    markdown: ARCH_BODY,
    index: INDEX,
    docId: "arch",
    documents: DOCUMENTS,
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("h1")).toContainText("アーキテクチャ");
  const nav = doc.locator("nav.mdmark-backlinks");
  await expect(nav.locator(".mdmark-backlinks-title")).toHaveText("関連文書");
  // `API` と `使い方` が並び、自分自身は並ばない
  await expect(nav.locator("li a")).toHaveText(["API", "使い方"]);
  const hrefs = await nav
    .locator("li a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual(["../api.md", "../使い方/guide.md"]);
  // 一覧は文書の末尾にある
  await expect(doc.locator(":scope > :last-child")).toHaveClass(
    /mdmark-backlinks/,
  );
  // 題を押すと、その文書へのリンクが開く
  await nav.locator("li a", { hasText: "API" }).click();
  await expect(page).toHaveURL(/\/api\.md$/);
});

// どの文書からも参照されていない文書には、一覧を置かずに本文を描く（正常シナリオ（参照されていない文書））
test("test_normal_when_not_referenced", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "# 使い方\n\n[構成](../設計/arch.md)\n",
    index: INDEX,
    docId: "guide",
    documents: DOCUMENTS,
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("nav.mdmark-backlinks")).toHaveCount(0);
  await expect(doc.locator("h1")).toContainText("使い方");
});

// 文書の別名が本文の語に一致すると、その語のツールチップに関連文書を出す（正常シナリオ（文書の別名））
test("test_normal_when_document_alias", async ({ page }) => {
  // 準備
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
      {
        id: "api",
        path: "api.md",
        title: "API",
        description: "mount と render の引数",
        aliases: ["公開関数"],
      },
      {
        id: "guide",
        path: "使い方/guide.md",
        title: "使い方",
        aliases: ["ワークスペース"],
      },
    ],
    terms: [
      {
        id: "workspace",
        term: "ワークスペース",
        meaning: "話し合いの記録を置くフォルダ",
      },
    ],
  };
  const markdown = "# アーキテクチャ\n\n公開関数と、ワークスペースを使う。\n";
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown, index, docId: "arch" });
  // 検証
  const terms = page.locator("#doc p .mdmark-term");
  await expect(terms).toHaveText(["公開関数", "ワークスペース"]);
  // `公開関数`: ツールチップの「関連文書」に題・リンク・説明が並び、用語の区分は無い
  const apiTip = page.locator("#doc p .mdmark-term-tip").nth(0);
  await terms.nth(0).hover();
  await expect(apiTip).toBeVisible();
  await expect(apiTip.locator("a")).toHaveText("API");
  await expect(apiTip.locator("a")).toHaveAttribute("href", "../api.md");
  await expect(apiTip).toContainText("mount と render の引数");
  await expect(apiTip.locator(".mdmark-term-tip-heading")).toHaveText([
    "関連文書",
  ]);
  // `ワークスペース`: 「用語」の意味と「関連文書」の `使い方` がこの順で並ぶ。用語が出る文書の一覧は無い
  const wsTip = page.locator("#doc p .mdmark-term-tip").nth(1);
  await terms.nth(1).hover();
  await expect(wsTip.locator(".mdmark-term-tip-heading")).toHaveText([
    "用語",
    "関連文書",
  ]);
  await expect(wsTip.locator("a")).toHaveText(["使い方"]);
  // キーボードでツールチップの中のリンクへフォーカスを移せる
  await terms.nth(0).focus();
  await page.keyboard.press("Tab");
  await expect(apiTip.locator("a")).toBeFocused();
});

// 全角と半角・大文字と小文字だけが違う別名の出現から、被参照の一覧に参照している文書を並べる（正常シナリオ（全角と半角・大文字と小文字だけが違う別名））
test("test_normal_when_alias_width_and_case_differ", async ({ page }) => {
  // 準備
  const index: MdmarkIndex = {
    ...INDEX,
    docs: INDEX.docs.map((doc) =>
      doc.id === "api"
        ? { id: doc.id, path: doc.path, title: doc.title, aliases: ["MCP"] }
        : doc,
    ),
  };
  // どちらの本文も `api` へのリンクを持たず、別名の表記だけが違う
  const documents = {
    "設計/arch.md": "# アーキテクチャ\n\nmcp を使う。\n",
    "api.md": "# API\n",
    "使い方/guide.md": "# 使い方\n\nＭＣＰ を使う。\n",
  };
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "# API\n",
    index,
    docId: "api",
    documents,
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("h1")).toContainText("API");
  const nav = doc.locator("nav.mdmark-backlinks");
  await expect(nav.locator(".mdmark-backlinks-title")).toHaveText("関連文書");
  const titles = await nav.locator("li a").allTextContents();
  expect([...titles].sort()).toEqual(["アーキテクチャ", "使い方"].sort());
});
