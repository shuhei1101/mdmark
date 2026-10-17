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

// 用語 `印`（別名 `マーク、オン・オフの印`）を入れる用語集の表
const GLOSSARY_TABLE = [
  "<!-- glossary: term=用語 aliases=別名 meaning=意味 -->",
  "",
  "| 用語 | 別名 | 意味 |",
  "| --- | --- | --- |",
  "| 印 | マーク、オン・オフの印 | HTML コメントで書く指定 |",
  "",
  "<!-- /glossary -->",
  "",
].join("\n");

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 用語集の表の用語と別名に下線を引き、表の意味をツールチップに出す。表の中の語には付けない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  const markdown = `${GLOSSARY_TABLE}\n## 一つ目\n\nマークを書く。\n\n## 二つ目\n\nオン・オフの印を書く。\n`;
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown });
  // 検証
  const doc = page.locator("#doc");
  // 用語集の表が表として描かれ、表の中の語には下線が付かない
  await expect(doc.locator("table")).toHaveCount(1);
  await expect(doc.locator("table .mdmark-term")).toHaveCount(0);
  // 別名 `マーク` に下線が付き、ポインターを乗せると表の意味が出る
  const sections = doc.locator(".mdmark-section-body");
  const mark = sections.nth(0).locator(".mdmark-term");
  await expect(mark).toHaveText(["マーク"]);
  await mark.hover();
  await expect(sections.nth(0).locator(".mdmark-term-tip")).toContainText(
    "HTML コメントで書く指定",
  );
  // 別の節の `オン・オフの印` は 1 つの下線で、`オン` だけの下線にならない
  await expect(sections.nth(1).locator(".mdmark-term")).toHaveText([
    "オン・オフの印",
  ]);
  // 印の文字は本文に出ない
  const html = await doc.innerHTML();
  expect(html).not.toContain("<!--");
  expect(html).not.toContain("glossary:");
});

// 索引に同じ語があるときは、索引の意味をツールチップに出す（正常シナリオ（索引に同じ語がある））
test("test_normal_when_index_has_same_term", async ({ page }) => {
  // 準備
  const index: MdmarkIndex = {
    schema: 1,
    docs: [{ id: "doc", path: "doc.md", title: "描く文書" }],
    terms: [{ id: "mark", term: "印", meaning: "索引に書いた意味" }],
  };
  const markdown = `${GLOSSARY_TABLE}\n印を書く。\n`;
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown, index, docId: "doc" });
  // 検証
  const term = page.locator("#doc p .mdmark-term");
  await expect(term).toHaveText(["印"]);
  await term.hover();
  const tip = page.locator("#doc p .mdmark-term-tip");
  await expect(tip).toContainText("索引に書いた意味");
  await expect(tip).not.toContainText("HTML コメントで書く指定");
});

// 印の列名が表に無いときも表と本文を描き、表のあたりに書き方の警告を出す（異常シナリオ（表に無い列名））
test("test_error_when_unknown_column", async ({ page }) => {
  // 準備
  const markdown = [
    "<!-- glossary: term=用語 meaning=説明 -->",
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| 印 | HTML コメントで書く指定 |",
    "",
    "<!-- /glossary -->",
    "",
    "印を書く。",
    "",
  ].join("\n");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("table")).toHaveCount(1);
  const warning = doc.locator(".mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("説明");
  await expect(warning).toContainText("列名を直してください");
  await expect(doc.locator(".mdmark-term")).toHaveCount(0);
  await expect(doc.locator("p", { hasText: "印を書く。" })).toBeVisible();
});

// ほかの文書の用語集の表から入れた用語にも、下線とツールチップを付ける（正常シナリオ（ほかの文書の表））
test("test_normal_when_other_document", async ({ page }) => {
  // 準備
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      { id: "glossary", path: "用語集.md", title: "用語集" },
      { id: "guide", path: "使い方/guide.md", title: "使い方" },
    ],
  };
  const documents = {
    "用語集.md": GLOSSARY_TABLE,
    "使い方/guide.md": "# 使い方\n\nマークを書く。\n",
  };
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: documents["使い方/guide.md"],
    index,
    docId: "guide",
    documents,
  });
  // 検証
  const term = page.locator("#doc .mdmark-term");
  await expect(term).toHaveText(["マーク"]);
  await term.hover();
  await expect(page.locator("#doc .mdmark-term-tip")).toContainText(
    "HTML コメントで書く指定",
  );
});
