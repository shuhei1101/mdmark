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

// 閉じた折り畳みとリンクと表を持つ見本の Markdown
const MARKDOWN = [
  "<details><summary>閉</summary>x</details>",
  "",
  "[リンク](https://example.com/page)",
  "",
  "| 列A | 列B |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
].join("\n");

// 明るい配色の `--mdmark-color-bg`（デザイン方針の modern）
const LIGHT_BACKGROUND = "#ffffff";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// ダークのページを印刷すると、折り畳みを開き、明るい配色で、リンクの URL を併記し、表を改ページで切らない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "dark" });
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: MARKDOWN });
  // 実行
  await page.emulateMedia({ colorScheme: "dark", media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("details")).toHaveAttribute("open", "");
  expect(
    await doc.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--mdmark-color-bg").trim(),
    ),
  ).toBe(LIGHT_BACKGROUND);
  const urlSuffix = await doc
    .locator("a")
    .evaluate((link) => getComputedStyle(link, "::after").content);
  expect(urlSuffix).toContain("https://example.com/page");
  await expect(doc.locator("table")).toHaveCSS("break-inside", "avoid");
  await expect(doc).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

// 印刷を終えると、印刷の前の開閉に戻る（正常シナリオ（印刷を終える））
test("test_normal_when_print_finished", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "<details><summary>閉</summary>x</details>\n\n<details open><summary>開</summary>y</details>\n",
  });
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 実行
  await page.emulateMedia({ media: "screen" });
  await sendPrintEvent(page, "afterprint");
  // 検証
  const [closed, opened] = await page.locator("#doc details").all();
  await expect(closed).not.toHaveAttribute("open", "");
  await expect(opened).toHaveAttribute("open", "");
});

// 印刷の前にタブの全ての中身と閉じた記法を開き、印刷の後に元の表示へ戻す（正常シナリオ（記法を開いて出す））
test("test_normal_when_syntax_expanded", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "<!-- tabs -->",
      "",
      "### macOS",
      "",
      "macOS の中身",
      "",
      "### Windows",
      "",
      "Windows の中身",
      "",
      "<!-- /tabs -->",
      "",
      "## 補足",
      "<!-- section: closed -->",
      "",
      "閉じた節の中身",
      "",
      "| 名前 | 数 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "<!-- row-detail: 1 -->",
      "",
      "行の詳細の中身",
      "",
      "<!-- /row-detail -->",
      "",
      "<!-- table: data closed -->",
      "",
      "| 名前 |",
      "| --- |",
      "| 閉じた表の中身 |",
      "",
      "<!-- /table -->",
      "",
      "> [!NOTE]-",
      "> 閉じた注意書きの中身",
      "",
    ].join("\n"),
  });
  const doc = page.locator("#doc");
  const hiddenTexts = [
    "Windows の中身",
    "閉じた節の中身",
    "行の詳細の中身",
    "閉じた表の中身",
    "閉じた注意書きの中身",
  ];
  for (const text of hiddenTexts) {
    await expect(doc.getByText(text), text).toBeHidden();
  }
  // 実行: 印刷の前
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証: 印刷の前のイベントの後
  await expect(doc.locator(".mdmark-tab-title")).toHaveText([
    "macOS",
    "Windows",
  ]);
  for (const title of await doc.locator(".mdmark-tab-title").all()) {
    await expect(title).toBeVisible();
  }
  await expect(doc.getByText("macOS の中身")).toBeVisible();
  for (const text of hiddenTexts) {
    await expect(doc.getByText(text), text).toBeVisible();
  }
  // 実行: 印刷の後
  await page.emulateMedia({ media: "screen" });
  await sendPrintEvent(page, "afterprint");
  // 検証: 印刷の後のイベントの後
  await expect(doc.getByText("macOS の中身")).toBeVisible();
  for (const text of hiddenTexts) {
    await expect(doc.getByText(text), text).toBeHidden();
  }
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

// 用語の下線を外してツールチップを出さず、被参照の一覧のリンクの後ろに相対パスを出して印刷する（正常シナリオ（用語と被参照））
test("test_normal_when_glossary_and_backlinks", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: "ワークスペースを置く。\n",
    index: INDEX,
    docId: "arch",
    documents: DOCUMENTS,
  });
  const term = page.locator("#doc .mdmark-term");
  await term.focus();
  await expect(page.locator("#doc .mdmark-term-tip")).toBeVisible();
  // 実行
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect(term).toHaveCSS("text-decoration-line", "none");
  await expect(page.locator("#doc .mdmark-term-tip")).toBeHidden();
  await expect(page.locator("#doc nav.mdmark-backlinks")).toBeVisible();
  const suffix = await page
    .locator("#doc nav.mdmark-backlinks a")
    .evaluate((link) => getComputedStyle(link, "::after").content);
  expect(suffix).toContain("../api.md");
});

// 印刷すると、表の上のボタンと行へのリンクの印は出さず、件数と集計の行は出し、隠した列は隠したままにする（正常シナリオ（表の機能を印刷に出す））
test("test_normal_when_table_features_printed", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "<!-- table: data +count +columns +total +copy +rowlink total=数量:sum hide=説明 -->",
      "",
      "| 名前 | 説明 | 数量 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 1 |",
      "| みかん | 印刷を直す | 2 |",
      "| ぶどう | 描画の崩れを直す | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  // 実行
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("button.mdmark-columns-toggle")).toBeHidden();
  await expect(doc.locator("button.mdmark-copy")).toBeHidden();
  await expect(doc.locator(".mdmark-row-anchor").first()).toBeHidden();
  await expect(doc.locator(".mdmark-table-count")).toBeVisible();
  await expect(doc.locator(".mdmark-table-count")).toContainText("3 / 3 件");
  await expect(doc.locator("tfoot tr")).toBeVisible();
  await expect(doc.locator("tfoot td").nth(2)).toContainText("6");
  await expect(doc.locator("thead th", { hasText: "説明" })).toBeHidden();
});

// 印刷すると、コードブロックの題・行番号・行の強調と、足した行・消した行の色と行頭の印を出す（正常シナリオ（コードブロックの題と行を印刷に出す））
test("test_normal_when_code_block_printed", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "<!-- code: title=app.ts lines highlight=1 -->",
      "",
      "```ts",
      "const a = 1;",
      "let count = 1; // [!code ++]",
      "foo(); // [!code --]",
      "```",
      "",
    ].join("\n"),
  });
  // 実行
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-code-title")).toBeVisible();
  await expect(doc.locator(".mdmark-code-title")).toHaveText("app.ts");
  const lines = doc.locator(".mdmark-code-line");
  await expect(lines).toHaveCount(3);
  const printed = await lines.evaluateAll((elements) =>
    elements.map((element) => ({
      number: getComputedStyle(element, "::before").content,
      sign: getComputedStyle(element, "::after").content,
      background: getComputedStyle(element).backgroundColor,
      adjust: getComputedStyle(element).printColorAdjust,
    })),
  );
  expect(printed.map((item) => item.number)).toEqual([
    expect.stringContaining("1"),
    expect.stringContaining("2"),
    expect.stringContaining("3"),
  ]);
  expect(printed[1]?.sign).toContain("+");
  expect(printed[2]?.sign).toContain("-");
  expect(new Set(printed.map((item) => item.background)).size).toBe(3);
  for (const item of printed) {
    expect(item.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(item.adjust).toBe("exact");
  }
});
