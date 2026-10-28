import { expect, test } from "@playwright/test";
import type { MdmarkIndex } from "../../../src/index.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  routeSyntax,
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

// 明るい配色の `--mdmark-color-bg`（デザイン方針の dev-swiss）
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

// 用語 `ワークスペース`（やめた言い方 `作業場`）を持ち、文書 `api`（題 `API`）の `related` が描く文書 `arch` を指す索引
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
      avoid: ["作業場"],
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
    markdown: "ワークスペースと作業場を置く。\n",
    index: INDEX,
    docId: "arch",
    documents: DOCUMENTS,
  });
  const term = page.locator("#doc .mdmark-term:not(.mdmark-term-avoided)");
  const avoided = page.locator("#doc .mdmark-term-avoided");
  const tips = page.locator("#doc .mdmark-term-tip");
  await term.focus();
  await expect(tips.nth(0)).toBeVisible();
  await avoided.focus();
  await expect(tips.nth(1)).toBeVisible();
  // 実行
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect(term).toHaveCSS("text-decoration-line", "none");
  await expect(tips.nth(0)).toBeHidden();
  await expect(avoided).toHaveCSS("text-decoration-line", "none");
  await expect(tips.nth(1)).toBeHidden();
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
  await expect(doc.locator("button.mdmark-totals-toggle")).toBeHidden();
  await expect(doc.locator(".mdmark-row-anchor").first()).toBeHidden();
  await expect(doc.locator(".mdmark-table-count")).toBeVisible();
  await expect(doc.locator(".mdmark-table-count")).toContainText("3 / 3 件");
  await expect(doc.locator("tfoot tr")).toBeVisible();
  await expect(doc.locator("tfoot td").nth(0)).toContainText("合計");
  await expect(doc.locator("tfoot td").nth(2)).toContainText("6");
  // 見出し行は 1 組だけで、画面の上端に留めるずれが当たっていない
  await expect(doc.locator("thead")).toHaveCount(1);
  for (const cell of await doc.locator("thead th:visible").all()) {
    await expect(cell).toHaveCSS("transform", "none");
  }
  await expect(doc.locator("thead th", { hasText: "説明" })).toBeHidden();
});

// 印刷すると、コードブロックの題・行番号・行の強調と、足した行・消した行の色と行頭の印を出す（正常シナリオ（コードブロックの題と行を印刷に出す））
test("test_normal_when_code_block_printed", async ({ page }) => {
  // 準備
  await routeSyntax(page);
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
  // 色分けし終えてから印刷する。画面の色分けの色を控える
  const spans = page.locator("#doc .mdmark-code-text span[class*='hljs-']");
  await expect(spans.first()).toBeVisible();
  const screenColors = await spans.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).color),
  );
  // 実行
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-code-title")).toBeVisible();
  await expect(doc.locator(".mdmark-code-title")).toContainText("app.ts");
  await expect(doc.locator(".mdmark-code-lang-name")).toBeVisible();
  await expect(doc.locator(".mdmark-code-lang-name")).toHaveText("ts");
  await expect(doc.locator(".mdmark-code-copy")).toBeHidden();
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
  // 行の中のキーワード・文字列などが、画面と同じ色分けの色で、色を省く設定でも出る
  const printColors = await spans.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).color),
  );
  expect(printColors).toEqual(screenColors);
  const spanAdjust = await spans.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).printColorAdjust),
  );
  expect(new Set(spanAdjust)).toEqual(new Set(["exact"]));
});

/** 390px の幅で 1 行に収まらない説明を最終列に持つ、3 列 3 行の表の Markdown */
const FOLD_TABLE = [
  "<!-- table: data -->",
  "",
  "| 名前 | 状態 | 説明 |",
  "| --- | --- | --- |",
  "| りんご | 新規 | 描画を速くするために、見出しの ID を作る処理を 1 回にまとめる改善の説明 |",
  "| みかん | 進行 | 印刷で折り畳みを開き、リンクの URL を併記して紙に収める変更の説明 |",
  "| ぶどう | 完了 | 表の見出し行を画面の上端に留めて、縦に長い表を読みやすくする変更の説明 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// 畳んだ最終列を、印刷では畳まずに列として出し、開閉のボタンを出さず、印刷の後に畳んだ表示へ戻す（正常シナリオ（畳んだ最終列を開いて出す））
test("test_normal_when_collapsed_column_printed", async ({ page }) => {
  // 準備: 描く先の要素の幅は 390px のまま、印刷の用紙の幅は画面より広い
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, builtRoot, {
    hostCss: "body { margin: 0 } #doc { width: 390px }",
  });
  await mountDocument(page, { markdown: FOLD_TABLE });
  const doc = page.locator("#doc");
  const toggles = doc.locator("button.mdmark-fold-toggle");
  const lastCells = doc.locator(
    "tbody tr:not(.mdmark-row-detail):not(.mdmark-table-empty) td:nth-child(3)",
  );
  await expect(doc.locator("thead th", { hasText: "説明" })).toBeHidden();
  await expect(toggles).toHaveCount(3);
  // 実行: 印刷の前
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証: 説明の列の見出しと全ての行のセルが出ていて、開閉のボタンが出ていない
  await expect(doc.locator("thead th", { hasText: "説明" })).toBeVisible();
  for (const cell of await lastCells.all()) {
    await expect(cell).toBeVisible();
  }
  for (const toggle of await toggles.all()) {
    await expect(toggle).toBeHidden();
  }
  // 実行: 印刷の後
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ media: "screen" });
  await sendPrintEvent(page, "afterprint");
  // 検証: 説明の列が畳まれ、行に開閉のボタンがある
  await expect(doc.locator("thead th", { hasText: "説明" })).toBeHidden();
  await expect(lastCells.first()).toBeHidden();
  for (const toggle of await toggles.all()) {
    await expect(toggle).toBeVisible();
  }
});

// 印刷では右側の目次と節のボタンを出さず、閉じた H1 の節を開き、印刷の後は画面の表示に戻る（正常シナリオ（右側の目次と節のボタンを印刷に出さない））
test("test_normal_when_side_toc_hidden_in_print", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "# 手引き\n\n手引きの段落\n\n# 付録\n<!-- section: closed -->\n\n付録の段落\n",
    config: { "side-toc": { mode: "fixed" } },
  });
  const doc = page.locator("#doc");
  await doc.locator(".mdmark-side-toc-toggle").click();
  await expect(doc.locator(".mdmark-side-toc-panel")).toBeVisible();
  await expect(page.getByText("付録の段落")).toBeHidden();
  // 実行: 印刷の前
  await page.emulateMedia({ media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect(doc.locator(".mdmark-side-toc")).toBeHidden();
  await expect(doc.locator(".mdmark-side-toc-toggle")).toBeHidden();
  await expect(doc.locator("[data-fold-all]").first()).toBeHidden();
  await expect(page.getByText("付録の段落")).toBeVisible();
  // 実行: 印刷の後
  await page.emulateMedia({ media: "screen" });
  await sendPrintEvent(page, "afterprint");
  // 検証
  await expect(doc.locator(".mdmark-side-toc-panel")).toBeVisible();
  await expect(
    doc.locator('button[aria-controls="section-付録"]'),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("付録の段落")).toBeHidden();
});
