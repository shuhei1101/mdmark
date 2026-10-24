import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import {
  columnCounts,
  switchButton,
  tableColumn,
  viewMarkdown,
} from "../view-samples.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 見出しの文字で、表形式のビューの列の `th` を引く */
function head(page: import("@playwright/test").Page, name: string) {
  return page.locator("#doc .mdmark-view-table th", { hasText: name });
}

// 担当の列で値を選んで絞り込み、ボード表示には当てず、表形式に戻すと残っている（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: viewMarkdown("group=状態 default=table filter=担当"),
  });
  // 検証: ボタンは担当の列にだけある
  await expect(page.locator("#doc button.mdmark-filter")).toHaveCount(1);
  await expect(head(page, "担当").locator("button.mdmark-filter")).toHaveCount(
    1,
  );
  await expect(head(page, "題").locator("button.mdmark-filter")).toHaveCount(0);
  await expect(head(page, "状態").locator("button.mdmark-filter")).toHaveCount(
    0,
  );
  // 検証: 検索欄と件数は無い
  await expect(page.locator("#doc input[type='search']:visible")).toHaveCount(
    0,
  );
  await expect(page.locator("#doc .mdmark-view-count")).toHaveCount(0);
  expect(await tableColumn(page, 3)).toEqual([
    "佐藤",
    "鈴木",
    "佐藤",
    "田中",
    "鈴木",
  ]);
  // 実行: 佐藤を選ぶ
  const filter = head(page, "担当").locator("button.mdmark-filter");
  await filter.click();
  const drawer = page.locator("#doc .mdmark-filter-drawer");
  await drawer.getByLabel("佐藤", { exact: true }).check();
  // 検証
  expect(await tableColumn(page, 3)).toEqual(["佐藤", "佐藤"]);
  await expect(filter).toHaveClass(/is-active/);
  // 実行: ボード表示に切り替える
  await switchButton(page, "board").click();
  // 検証
  await expect(page.locator("#doc .mdmark-view-card")).toHaveCount(5);
  expect(await columnCounts(page)).toEqual(["2", "2", "1"]);
  // 実行: 表形式に戻す
  await switchButton(page, "table").click();
  // 検証
  expect(await tableColumn(page, 3)).toEqual(["佐藤", "佐藤"]);
  await expect(filter).toHaveClass(/is-active/);
});

// 題の列に文字を入れて絞り込む（正常シナリオ（文字で絞り込む））
test("test_normal_when_filtered_by_text", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: viewMarkdown("group=状態 default=table filter=題:text"),
  });
  const drawer = page.locator("#doc .mdmark-filter-drawer");
  // 実行
  await head(page, "題").locator("button.mdmark-filter").click();
  // 検証: 文字の入力欄が出る
  await expect(drawer.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(drawer.locator('input[type="text"]')).toBeVisible();
  // 実行
  await drawer.locator('input[type="text"]').fill("変数");
  // 検証
  expect(await tableColumn(page, 1)).toEqual([
    "配色の変数を洗い出す",
    "余白の変数を決める",
  ]);
});

// 知らない絞り込みの種類は書き方の警告にして、絞り込みのボタンを付けない（異常シナリオ（知らない絞り込みの種類））
test("test_error_when_filter_kind_unknown", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: viewMarkdown("group=状態 default=table filter=担当:range"),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("range");
  await expect(warning).toContainText("select");
  await expect(warning).toContainText("text");
  await expect(warning).toContainText("date");
  await expect(page.locator("#doc button.mdmark-filter")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-view-switch")).toBeVisible();
  expect(await tableColumn(page, 1)).toHaveLength(5);
});
