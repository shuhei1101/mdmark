import type { Page } from "@playwright/test";

/** 見本の項目の列名 */
export const VIEW_COLUMNS = ["題", "状態", "担当"];

/** 見本の項目: 状態は上から `未着手`・`進行中`・`未着手`・`完了`・`進行中`、担当は `佐藤`・`鈴木`・`佐藤`・`田中`・`鈴木` */
export const VIEW_ITEMS = [
  { 題: "配色の変数を洗い出す", 状態: "未着手", 担当: "佐藤" },
  { 題: "余白の変数を決める", 状態: "進行中", 担当: "鈴木" },
  { 題: "印刷の見え方を確かめる", 状態: "未着手", 担当: "佐藤" },
  { 題: "配色を直す", 状態: "完了", 担当: "田中" },
  { 題: "表を絞り込む", 状態: "進行中", 担当: "鈴木" },
];

/** 見本の項目を Markdown の表にしたもの */
export const VIEW_TABLE = [
  `| ${VIEW_COLUMNS.join(" | ")} |`,
  "| --- | --- | --- |",
  ...VIEW_ITEMS.map((item) => `| ${item.題} | ${item.状態} | ${item.担当} |`),
].join("\n");

/** ビューの印の引数を指定して、見本の表を囲んだ文書にする。`paragraph` があれば、後ろに段落を足す */
export function viewMarkdown(args: string, paragraph?: string): string {
  const view = `<!-- view: ${args} -->\n\n${VIEW_TABLE}\n\n<!-- /view -->\n`;
  return paragraph === undefined ? view : `${view}\n${paragraph}\n`;
}

/** ボードの列の見出しの値を、並びの順に返す */
export function columnNames(page: Page): Promise<string[]> {
  return page.locator("#doc .mdmark-view-column-name").allTextContents();
}

/** ボードの列の見出しの項目の数を、並びの順に返す */
export function columnCounts(page: Page): Promise<string[]> {
  return page.locator("#doc .mdmark-view-column-count").allTextContents();
}

/** 表形式のビューの隠れていない本文の行の、指定した列（1 から）の文字を上から並べて返す */
export function tableColumn(page: Page, column: number): Promise<string[]> {
  return page
    .locator(
      `#doc .mdmark-view-table tbody tr:not([hidden]):not(.mdmark-table-empty) td:nth-child(${column})`,
    )
    .allTextContents();
}

/** ビューの切り替えのボタンを返す */
export function switchButton(page: Page, mode: "board" | "table") {
  return page.locator(`#doc .mdmark-view-switch-item[data-mode="${mode}"]`);
}
