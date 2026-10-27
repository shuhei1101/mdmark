import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 3 行の表。行の詳細の印を後ろに足して使う
const TABLE = "| 名前 | 数 |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n| c | 3 |\n";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 閉じた節を閉じて始め、見出しの開閉のボタンを押すたびに開閉する（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "## 概要\n\n概要の段落\n\n## 補足\n<!-- section: closed -->\n\n補足の段落\n",
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

// URL の ID が閉じた節の中の見出しを指すと、その節を開いて移る（正常シナリオ（閉じた節の中へ移る））
test("test_normal_when_fragment_in_closed_section", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 800, height: 300 });
  await openPage(page, builtRoot, { hash: "#注意" });
  // 実行
  await mountDocument(page, {
    markdown:
      "## 補足\n<!-- section: closed -->\n\n### 注意\n\n注意の段落\n\n" +
      "余白\n\n".repeat(30),
  });
  // 検証
  await expect(page.getByRole("button", { name: "補足" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#doc h3", { hasText: "注意" })).toBeInViewport();
});

// 表の後の行の詳細の印で、指定した行に開閉のボタンを置き、押すと行の下に詳細を出す（正常シナリオ（行の詳細））
test("test_normal_when_row_detail", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `${TABLE}\n<!-- row-detail: 2 -->\n\n詳細の段落\n\n- 詳細の項目\n\n<!-- /row-detail -->\n`,
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

// 知らない開閉の指定は、開いた節として描き、書き方の警告を出す（異常シナリオ（知らない開閉の指定））
test("test_error_when_unknown_section_value", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "## 補足\n<!-- section: hidden -->\n\n補足の段落\n",
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toContainText("hidden");
  await expect(warning).toContainText("closed");
  await expect(warning).toContainText("open");
  await expect(page.getByText("補足の段落")).toBeVisible();
});

// 表に無い行を指す行の詳細は、表の後に本文として描き、書き方の警告を出す（異常シナリオ（行の位置が表に無い））
test("test_error_when_row_out_of_range", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `${TABLE}\n<!-- row-detail: 5 -->\n\n詳細の段落\n\n<!-- /row-detail -->\n`,
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
    markdown: `${FOLD_TABLE}\n<!-- row-detail: 2 -->\n\nみかんの詳細\n\n<!-- /row-detail -->\n`,
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
