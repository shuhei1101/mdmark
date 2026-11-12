import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// 3 行の表。行の詳細のマーカーを後ろに追加して使用する
const TABLE = "| 名前 | 数 |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n| c | 3 |\n";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 閉じたセクションを閉じて始め、見出しの開閉のボタンを押すたびに開閉する（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      '## 概要\n\n概要の段落\n\n## 補足\n<!-- section: {"open": false} -->\n\n補足の段落\n',
  });
  const overview = page.getByRole("button", { name: "概要" });
  const note = page.getByRole("button", { name: "補足" });
  // 検証: 描いた直後
  await expect(page.getByText("概要の段落")).toBeVisible();
  await expect(page.getByText("補足の段落")).toBeHidden();
  // 実行・検証: 補足を開く
  await note.click();
  await expect(page.getByText("補足の段落")).toBeVisible();
  await expect(note).toHaveAttribute("aria-expanded", "true");
  // 実行・検証: 概要を閉じる
  await overview.click();
  await expect(page.getByText("概要の段落")).toBeHidden();
  await expect(overview).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#doc")).not.toContainText("section:");
  expect(await page.locator("#doc").innerHTML()).not.toContain("<!--");
});

// URL の ID が閉じたセクションの中の見出しを指すと、そのセクションを開いて移る（正常シナリオ（閉じたセクションの中へ移る））
test("test_normal_when_fragment_in_closed_section", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 800, height: 300 });
  await openPage(page, builtRoot, { hash: "#注意" });
  // 実行
  await mountDocument(page, {
    markdown:
      '## 補足\n<!-- section: {"open": false} -->\n\n### 注意\n\n注意の段落\n\n' +
      "余白\n\n".repeat(30),
  });
  // 検証
  await expect(page.getByRole("button", { name: "補足" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#doc h3", { hasText: "注意" })).toBeInViewport();
});

// 表の後の行の詳細のマーカーで、指定した行に開閉のボタンを配置し、押すと行の下に詳細を出す（正常シナリオ（行の詳細））
test("test_normal_when_row_detail", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `${TABLE}\n<!-- row-detail: {"at": 2} -->\n\n詳細の段落\n\n- 詳細の項目\n\n<!-- /row-detail -->\n`,
  });
  const toggle = page.locator("#doc button.mdmark-row-toggle");
  // 検証: 描いた直後
  await expect(toggle).toHaveCount(1);
  await expect(
    page.locator("#doc tbody tr:nth-child(2) button.mdmark-row-toggle"),
  ).toHaveCount(1);
  await expect(page.getByText("詳細の段落")).toBeHidden();
  // 実行
  await toggle.click();
  // 検証
  const detail = page.locator(
    "#doc tbody tr:nth-child(2) + tr.mdmark-row-detail",
  );
  await expect(detail.locator("p")).toHaveText("詳細の段落");
  await expect(detail.locator("li")).toHaveText("詳細の項目");
  await expect(detail).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#doc > p")).toHaveCount(0);
});

// 型の合わない開閉の指定に記載の警告を出し、開いたセクションとして描く（異常シナリオ（型の合わない開閉の指定））
test("test_error_when_section_open_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: '## 補足\n<!-- section: {"open": "hidden"} -->\n\n補足の段落\n',
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("open");
  await expect(warning).toContainText("true");
  await expect(warning).toContainText("false");
  await expect(page.getByText("補足の段落")).toBeVisible();
});

// 表に無い行を指す行の詳細は、表の後に本文として描き、記載の警告を出す（異常シナリオ（行の位置が表に無い））
test("test_error_when_row_out_of_range", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `${TABLE}\n<!-- row-detail: {"at": 5} -->\n\n詳細の段落\n\n<!-- /row-detail -->\n`,
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toContainText("3");
  await expect(warning).toContainText("5");
  await expect(page.getByText("詳細の段落")).toBeVisible();
  await expect(page.locator("#doc button.mdmark-row-toggle")).toHaveCount(0);
});

/** 390px の幅で 1 行に収まらない説明を最終列に持つ、3 列 3 行の表の Markdown */
const FOLD_TABLE = [
  "| 名前 | 状態 | 説明 |",
  "| --- | --- | --- |",
  "| りんご | 新規 | 描画を速くするために、見出しの ID を作る処理を 1 回にまとめる改善の説明 |",
  "| みかん | 進行 | 印刷で折り畳みを開き、リンクの URL を併記して紙に収める変更の説明 |",
  "| ぶどう | 完了 | 表の見出し行を画面の上端に留めて、縦に長い表を読みやすくする変更の説明 |",
  "",
].join("\n");

// 最終列を畳んだ表の行の詳細は、開閉のボタン 1 つで、最終列の中身と行の詳細を一緒に開閉する（正常シナリオ（畳んだ最終列と行の詳細））
test("test_normal_when_row_detail_with_collapsed_column", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, builtRoot, { hostCss: "body { margin: 0 }" });
  await mountDocument(page, {
    markdown: `${FOLD_TABLE}\n<!-- row-detail: {"at": 2} -->\n\nみかんの詳細\n\n<!-- /row-detail -->\n`,
  });
  const rows = page.locator(
    "#doc tbody tr:not(.mdmark-row-detail):not(.mdmark-table-empty)",
  );
  await expect(rows).toHaveCount(3);
  // 検証: 描いた直後、各行の開閉のボタンは 1 つずつで、2 行目にも 1 つだけ
  for (const row of await rows.all()) {
    await expect(row.locator("button.mdmark-row-toggle")).toHaveCount(1);
  }
  const toggle = rows.nth(1).locator("button.mdmark-row-toggle");
  const detail = rows.nth(1).locator("xpath=following-sibling::tr[1]");
  await expect(detail).toBeHidden();
  // 実行
  await toggle.click();
  // 検証: 2 行目の直後に、見出し `説明` と 2 行目の説明の中身、その下に行の詳細の段落が表示される
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(detail).toBeVisible();
  await expect(detail.locator(".mdmark-fold-name")).toHaveText("説明");
  await expect(detail.locator(".mdmark-fold-value")).toContainText(
    "印刷で折り畳みを開き",
  );
  await expect(detail.locator("p", { hasText: "みかんの詳細" })).toBeVisible();
  const order = await detail.evaluate((row) => {
    const part = row.querySelector(".mdmark-fold-part");
    const body = [...row.querySelectorAll("p")].find(
      (p) => p.textContent === "みかんの詳細",
    );
    return Boolean(
      part &&
        body &&
        part.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(order).toBe(true);
  // 実行・検証: もう一度押すと、最終列の中身と行の詳細が一緒に閉じる
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(detail).toBeHidden();
  await expect(detail.locator(".mdmark-fold-part")).toBeHidden();
});

// h1 の見出しもセクションになり、閉じた h1 のセクションを開閉のボタンで開く（正常シナリオ（H1 のセクション））
test("test_normal_when_h1_section", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      '# 手引き\n\n手引きの段落\n\n# 付録\n<!-- section: {"open": false} -->\n\n付録の段落\n',
  });
  const appendix = page.getByRole("button", { name: "付録" });
  // 検証: 描いた直後
  await expect(page.getByText("手引きの段落")).toBeVisible();
  await expect(page.getByText("付録の段落")).toBeHidden();
  await expect(page.getByRole("button", { name: "手引き" })).toBeVisible();
  await expect(appendix).toBeVisible();
  // 実行
  await appendix.click();
  // 検証
  await expect(page.getByText("付録の段落")).toBeVisible();
  await expect(appendix).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#doc")).not.toContainText("section:");
});

// すべて展開で H1 を含む全てのセクションを開き、すべて折りたたむで H1 のセクションを開いたまま H2 以下を閉じる（正常シナリオ（すべて展開・すべて折りたたむ））
test("test_normal_when_all_toggled", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "# 手引き",
      "",
      "## 概要",
      "",
      "概要の段落",
      "",
      "## 補足",
      '<!-- section: {"open": false} -->',
      "",
      "補足の段落",
      "",
      "### 注意",
      '<!-- section: {"open": false} -->',
      "",
      "注意の段落",
      "",
    ].join("\n"),
    config: { "side-toc": { mode: "fixed" } },
  });
  await page.locator("#doc .mdmark-side-toc-toggle").click();
  const expandAll = page.locator('#doc [data-fold-all="open"]');
  const collapseAll = page.locator('#doc [data-fold-all="close"]');
  const toggleOf = (id: string) =>
    page.locator(`#doc button[aria-controls="section-${id}"]`);
  // 検証: 描いた直後
  for (const button of [expandAll, collapseAll]) {
    await expect(button).toBeVisible();
    await expect(button).toHaveText("");
    expect(await button.getAttribute("aria-label")).toBeTruthy();
  }
  // 実行・検証: すべて展開
  await expandAll.click();
  for (const id of ["手引き", "概要", "補足", "注意"]) {
    await expect(toggleOf(id)).toHaveAttribute("aria-expanded", "true");
  }
  await expect(page.getByText("注意の段落")).toBeVisible();
  // 実行・検証: すべて折りたたむ
  await collapseAll.click();
  await expect(toggleOf("手引き")).toHaveAttribute("aria-expanded", "true");
  for (const id of ["概要", "補足", "注意"]) {
    await expect(toggleOf(id)).toHaveAttribute("aria-expanded", "false");
  }
  await expect(page.locator('#doc [id="概要"]')).toBeVisible();
  await expect(page.getByText("概要の段落")).toBeHidden();
});

// Shift を押しながら開閉を押すか Enter を押すと、そのセクションと中の入れ子のセクションを同じ状態にする（正常シナリオ（Shift で入れ子をまとめて開閉））
test("test_normal_when_nested_toggled_with_shift", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "## 概要",
      "",
      "概要の段落",
      "",
      "## 補足",
      '<!-- section: {"open": false} -->',
      "",
      "### 注意",
      '<!-- section: {"open": false} -->',
      "",
      "#### 例",
      '<!-- section: {"open": false} -->',
      "",
      "例の段落",
      "",
    ].join("\n"),
  });
  const toggleOf = (id: string) =>
    page.locator(`#doc button[aria-controls="section-${id}"]`);
  const nested = ["補足", "注意", "例"];
  // 実行・検証: Shift を押しながら補足の開閉を押す
  await toggleOf("補足").click({ modifiers: ["Shift"] });
  for (const id of nested) {
    await expect(toggleOf(id)).toHaveAttribute("aria-expanded", "true");
  }
  await expect(page.getByText("例の段落")).toBeVisible();
  // 実行・検証: 補足の開閉ボタンにフォーカスし、Shift を押しながら Enter を押す
  await toggleOf("補足").focus();
  await page.keyboard.press("Shift+Enter");
  for (const id of nested) {
    await expect(toggleOf(id)).toHaveAttribute("aria-expanded", "false");
  }
  await expect(toggleOf("概要")).toHaveAttribute("aria-expanded", "true");
});

// details の範囲を、タイトルを押して開閉する（正常シナリオ（details の範囲））
test("test_normal_when_details_range", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "## 概要",
      "",
      '<!-- details: {"title": "補足の手順"} -->',
      "",
      "補足の段落",
      "",
      "- 補足の項目",
      "",
      "<!-- /details -->",
      "",
      '<!-- details: {"title": "実行の例", "open": true} -->',
      "",
      "例の段落",
      "",
      "<!-- /details -->",
      "",
    ].join("\n"),
  });
  // 検証: 描いた直後
  const summary = page.locator("#doc summary", { hasText: "補足の手順" });
  await expect(summary).toBeVisible();
  await expect(page.getByText("補足の段落")).toBeHidden();
  await expect(page.getByText("補足の項目")).toBeHidden();
  await expect(page.getByText("例の段落")).toBeVisible();
  // 実行
  await summary.click();
  // 検証
  await expect(page.getByText("補足の段落")).toBeVisible();
  await expect(page.getByText("補足の項目")).toBeVisible();
  expect(
    await summary.evaluate(
      (el) => (el.parentElement as HTMLDetailsElement).open,
    ),
  ).toBe(true);
  await expect(
    page.locator("#doc h1, #doc h2, #doc h3", { hasText: "補足の手順" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".mdmark-side-toc-list a, .mdmark-toc a", {
      hasText: "補足の手順",
    }),
  ).toHaveCount(0);
  expect(await page.locator("#doc").innerHTML()).not.toContain("<!--");
});

// 閉じのマーカーが無いときは、警告を配置して折りたたまずに出す（異常シナリオ（details の閉じのマーカーが無い））
test("test_error_when_details_unclosed", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: '<!-- details: {"title": "補足"} -->\n\n補足の段落\n',
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "<!-- /details -->",
  );
  await expect(page.getByText("補足の段落")).toBeVisible();
  await expect(page.locator("#doc details")).toHaveCount(0);
});
