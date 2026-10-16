import { expect, test } from "@playwright/test";
import type { MdmarkIndex } from "../../../src/index.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  sendPrintEvent,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 閉じた折り畳みを持つ文書の本体
const DETAILS = "<details><summary>折り畳み</summary>中身</details>\n";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 設定でオンの機能を、文書の印でその文書だけオフにする（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.emulateMedia({ media: "print" });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `<!-- features: -print -->\n\n${DETAILS}`,
    config: { features: { print: true } },
  });
  // 実行
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect(page.locator("#doc details")).not.toHaveAttribute("open", "");
});

// 設定でオフにした機能を、文書の印でオンにする（正常シナリオ（設定でオフにした機能を文書でオンにする））
test("test_normal_when_enabled_by_mark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ media: "print" });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `<!-- features: +print -->\n\n${DETAILS}`,
    config: { features: { print: false } },
  });
  // 実行
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect(page.locator("#doc details")).toHaveAttribute("open", "");
});

// 印の無い文書は、設定のとおりにする（正常シナリオ（印の無い文書））
test("test_normal_when_no_mark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ media: "print" });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: DETAILS,
    config: { features: { print: false } },
  });
  // 実行
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect(page.locator("#doc details")).not.toHaveAttribute("open", "");
});

// 知らない機能名は無視して、本文を描く（正常シナリオ（知らない機能名））
test("test_normal_when_unknown_feature", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "<!-- features: +unknown -->\n\n段落\n",
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("p")).toHaveText("段落");
  const html = await doc.innerHTML();
  expect(html).not.toContain("features");
  expect(html).not.toContain("unknown");
});

// 設定で既定のオンの表と注意書きを、文書の印でその文書だけ外し、普通の Markdown として描く（正常シナリオ（記法の機能を外す））
test("test_normal_when_syntax_disabled", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- features: -table -callout -->",
      "",
      "<!-- table: data -->",
      "",
      "| 名前 | 数 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "<!-- /table -->",
      "",
      "> [!NOTE]",
      "> 引用の本文",
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("table")).toBeVisible();
  await expect(doc.locator("button.mdmark-sort")).toHaveCount(0);
  await expect(doc.locator("button.mdmark-pin")).toHaveCount(0);
  await expect(doc.locator("blockquote")).toBeVisible();
  await expect(doc.locator(".markdown-alert")).toHaveCount(0);
  const html = await doc.innerHTML();
  expect(html).not.toContain("<!--");
  await expect(doc).not.toContainText("features:");
  await expect(doc).not.toContainText("table:");
});

// 用語 `ワークスペース` を持ち、文書 `api`（題 `API`）の `related` が描く文書 `arch` を指す索引
const INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    { id: "api", path: "api.md", title: "API", related: ["arch"] },
  ],
  terms: [
    {
      id: "workspace",
      term: "ワークスペース",
      meaning: "話し合いの記録を置くフォルダ",
    },
  ],
};

// `api` の本文（`arch` を参照する側）
const DOCUMENTS = { "設計/arch.md": "", "api.md": "# API\n" };

// 文書の印で用語と被参照の機能を外すと、下線も被参照の一覧も付けず、用語集の表を普通の表として描く（正常シナリオ（用語と被参照の機能を外す））
test("test_normal_when_glossary_disabled", async ({ page }) => {
  // 準備
  const markdown = [
    "<!-- features: -glossary -backlinks -->",
    "",
    "ワークスペースを置く。",
    "",
    "<!-- glossary: term=用語 meaning=意味 -->",
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| 印 | HTML コメントで書く指定 |",
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown,
    index: INDEX,
    docId: "arch",
    documents: DOCUMENTS,
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-term")).toHaveCount(0);
  await expect(doc.locator("nav.mdmark-backlinks")).toHaveCount(0);
  await expect(doc.locator("table")).toBeVisible();
  const html = await doc.innerHTML();
  expect(html).not.toContain("<!--");
  await expect(doc).not.toContainText("glossary:");
});

// 文書の印で被参照の機能だけを外すと、用語にだけ下線を引き、関連文書を出さない（正常シナリオ（被参照の機能だけを外す））
test("test_normal_when_backlinks_disabled", async ({ page }) => {
  // 準備
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
      {
        id: "api",
        path: "api.md",
        title: "API",
        aliases: ["公開関数"],
        related: ["arch"],
      },
      {
        id: "index-ref",
        path: "索引.md",
        title: "索引のリファレンス",
        aliases: ["索引"],
      },
    ],
    terms: [
      {
        id: "index",
        term: "索引",
        meaning: "文書と用語を並べた YAML のファイル",
      },
    ],
  };
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "<!-- features: -backlinks -->\n\n索引と公開関数を読む。\n",
    index,
    docId: "arch",
    documents: { ...DOCUMENTS, "索引.md": "# 索引\n" },
  });
  // 検証
  const doc = page.locator("#doc");
  const terms = doc.locator(".mdmark-term");
  await expect(terms).toHaveText(["索引"]);
  await terms.hover();
  const tip = doc.locator(".mdmark-term-tip");
  await expect(tip).toContainText("文書と用語を並べた YAML のファイル");
  await expect(tip.locator(".mdmark-term-tip-heading")).toHaveText(["用語"]);
  await expect(doc.locator("nav.mdmark-backlinks")).toHaveCount(0);
});
