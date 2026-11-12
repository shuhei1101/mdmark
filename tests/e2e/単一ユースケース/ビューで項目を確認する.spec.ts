import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import {
  columnCounts,
  columnNames,
  switchButton,
  tableColumn,
  viewMarkdown,
} from "../view-samples.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 状態の列の値ごとのボード表示で描き、表形式と行き来する（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: viewMarkdown('{"board": {"group": {"column": "状態"}}}'),
  });
  // 検証: ボード表示
  await expect(switchButton(page, "board")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await columnNames(page)).toEqual(["未着手", "進行中", "完了"]);
  expect(await columnCounts(page)).toEqual(["2", "2", "1"]);
  const icons = page.locator("#doc .mdmark-view-column-head svg");
  await expect(icons).toHaveCount(3);
  const shapes = await icons.evaluateAll((nodes) =>
    nodes.map((node) => node.innerHTML),
  );
  expect(new Set(shapes).size).toBe(3);
  const firstColumn = page.locator("#doc .mdmark-view-column").first();
  await expect(firstColumn.locator(".mdmark-view-card-title")).toHaveText([
    "配色の変数を洗い出す",
    "印刷の見え方を確かめる",
  ]);
  await expect(firstColumn.locator("dt")).toHaveText(["担当", "担当"]);
  await expect(firstColumn.locator("dd")).toHaveText(["佐藤", "佐藤"]);
  await expect(page.locator("#doc .mdmark-view-card")).toHaveCount(5);
  await expect(page.locator("#doc .mdmark-view-board")).not.toContainText(
    "状態",
  );
  // 実行: 表形式に切り替える
  await switchButton(page, "table").click();
  // 検証: 表形式
  await expect(switchButton(page, "table")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(switchButton(page, "board")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator("#doc .mdmark-view-board")).toBeHidden();
  await expect(page.locator("#doc .mdmark-view-table thead th")).toContainText([
    "題",
    "状態",
    "担当",
  ]);
  expect(await tableColumn(page, 1)).toEqual([
    "配色の変数を洗い出す",
    "余白の変数を決める",
    "印刷の見え方を確かめる",
    "配色を直す",
    "表を絞り込む",
  ]);
  expect(await tableColumn(page, 2)).toEqual([
    "未着手",
    "進行中",
    "未着手",
    "完了",
    "進行中",
  ]);
  // 実行: ボード表示に戻す
  await switchButton(page, "board").click();
  // 検証
  await expect(page.locator("#doc .mdmark-view-board")).toBeVisible();
  await expect(page.locator("#doc .mdmark-view-table")).toBeHidden();
  await expect(switchButton(page, "board")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const html = await page.locator("#doc").innerHTML();
  expect(html).not.toContain("<!--");
  await expect(page.locator("#doc")).not.toContainText("view:");
});

// default=table で表形式のビューを開き、ボード表示に切り替える（正常シナリオ（表形式で開く））
test("test_normal_when_opened_as_table", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: viewMarkdown(
      '{"board": {"group": {"column": "状態"}}, "initial": "table"}',
    ),
  });
  // 検証
  await expect(switchButton(page, "table")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#doc .mdmark-view-table")).toBeVisible();
  await expect(page.locator("#doc .mdmark-view-board")).toBeHidden();
  expect(await tableColumn(page, 1)).toHaveLength(5);
  // 実行
  await switchButton(page, "board").click();
  // 検証
  expect(await columnNames(page)).toEqual(["未着手", "進行中", "完了"]);
  expect(await columnCounts(page)).toEqual(["2", "2", "1"]);
});

// views を削除した設定では、マーカーの範囲の表を普通の表で描き、切り替えも警告も出さない（正常シナリオ（機能を解除する））
test("test_normal_when_disabled", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: viewMarkdown('{"board": {"group": {"column": "状態"}}}'),
    config: { features: { views: false } },
  });
  await page.waitForTimeout(300);
  // 検証
  await expect(page.locator("#doc table tbody tr")).toHaveCount(5);
  await expect(page.locator("#doc .mdmark-view")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-view-switch")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-view-board")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// board.group.column が表に無い列のときは、記載の警告を出して表形式で描き、ボード表示を押せなくする（異常シナリオ（知らない列））
test("test_error_when_group_column_missing", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: viewMarkdown('{"board": {"group": {"column": "優先度"}}}'),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("優先度");
  await expect(warning).toContainText("題・状態・担当");
  await expect(page.locator("#doc .mdmark-view-table")).toBeVisible();
  await expect(page.locator("#doc .mdmark-view-board")).toBeHidden();
  expect(await tableColumn(page, 1)).toHaveLength(5);
  await expect(switchButton(page, "board")).toBeDisabled();
  await expect(switchButton(page, "table")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

// 範囲に表が無いときは、記載の警告を出して範囲の中身をそのまま描く（異常シナリオ（範囲に表が無い））
test("test_error_when_no_table", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown:
      '<!-- view: {"board": {"group": {"column": "状態"}}} -->\n\n表の無い段落だけ。\n\n<!-- /view -->\n',
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("表がありません");
  await expect(
    page.locator("#doc p", { hasText: "表の無い段落だけ。" }),
  ).toBeVisible();
  await expect(page.locator("#doc .mdmark-view-switch")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-view-board")).toHaveCount(0);
});

// board.values の値ごとのアイコンを、その値の列の見出しにだけ付ける（正常シナリオ（値ごとのアイコンを指定する））
test("test_normal_when_value_icon", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: viewMarkdown('{"board": {"group": {"column": "状態"}}}'),
  });
  await expect(page.locator("#doc .mdmark-view-column-head svg")).toHaveCount(
    3,
  );
  const defaults = await page
    .locator("#doc .mdmark-view-column-head svg")
    .evaluateAll((nodes) => nodes.map((node) => node.innerHTML));
  await mountDocument(page, {
    markdown: viewMarkdown(
      '{"board": {"group": {"column": "状態"}, "values": {"未着手": {"icon": "inbox"}}}}',
    ),
  });
  // 実行
  const icons = await page
    .locator("#doc .mdmark-view-column-head svg")
    .evaluateAll((nodes) => nodes.map((node) => node.innerHTML));
  // 検証
  expect(await columnNames(page)).toEqual(["未着手", "進行中", "完了"]);
  expect(icons).toHaveLength(3);
  expect(icons[0]).not.toBe(defaults[0]);
  expect(icons.slice(1)).toEqual(defaults.slice(1));
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// board.values の列に無い値は、記載の警告を出して当てず、既定のアイコンで描く（異常シナリオ（列に無い値のアイコン））
test("test_error_when_value_missing", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: viewMarkdown('{"board": {"group": {"column": "状態"}}}'),
  });
  await expect(page.locator("#doc .mdmark-view-column-head svg")).toHaveCount(
    3,
  );
  const defaults = await page
    .locator("#doc .mdmark-view-column-head svg")
    .evaluateAll((nodes) => nodes.map((node) => node.innerHTML));
  // 実行
  await mountDocument(page, {
    markdown: viewMarkdown(
      '{"board": {"group": {"column": "状態"}, "values": {"保留": {"icon": "inbox"}}}}',
    ),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("board.values");
  await expect(warning).toContainText("保留");
  for (const value of ["未着手", "進行中", "完了"]) {
    await expect(warning).toContainText(value);
  }
  const icons = await page
    .locator("#doc .mdmark-view-column-head svg")
    .evaluateAll((nodes) => nodes.map((node) => node.innerHTML));
  expect(icons).toEqual(defaults);
});
