import { expect, test } from "vitest";
import { findTag, innerHtml, matches } from "../../helpers/html.ts";

/** ビューの部品の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadView = () => import("../../../../src/parts/view.ts");

/** 部品設計『ビュー』の Board の引数の列名 */
const COLUMNS = ["題", "状態", "担当"];

/** 部品設計『ビュー』の Board の引数の項目（状態は進行中・未着手・未着手・完了・進行中） */
const ITEMS = [
  ["ビューを描く", "進行中", "佐藤"],
  ["コメントを保存する", "未着手", "鈴木"],
  ["表を絞り込む", "未着手", "佐藤"],
  ["アイコンを決める", "完了", "高橋"],
  ["印刷を直す", "進行中", ""],
];

/** ボードの列を、見出しから次の列の前までの HTML に分けて返す */
function splitColumns(html: string): string[] {
  return html.split('<div class="mdmark-view-column">').slice(1);
}

// ボードの列を値の出た順に並べ、項目の数を出す（正常系）
test("test_render_view", async () => {
  // 準備
  const { renderView } = await loadView();
  // 実行
  const html = renderView({
    columns: COLUMNS,
    items: ITEMS,
    group: "状態",
    id: "story-view",
  });
  // 検証
  expect(html.startsWith('<div class="mdmark-view">')).toBe(true);
  expect(
    matches(html, /mdmark-view-column-name">[^<]*/g).map((name) =>
      name.replace('mdmark-view-column-name">', ""),
    ),
  ).toEqual(["進行中", "未着手", "完了"]);
  expect(
    matches(html, /mdmark-view-column-count">[^<]*/g).map((count) =>
      count.replace('mdmark-view-column-count">', ""),
    ),
  ).toEqual(["2", "2", "1"]);
  expect(findTag(html, "mdmark-view-table")).toMatch(/\shidden\b/);
  expect(findTag(html, "mdmark-view-board")).not.toMatch(/\shidden\b/);
});

// 列名と値をエスケープする（正常系）
test("test_render_view_when_values_have_html", async () => {
  // 準備
  const { renderView } = await loadView();
  // 実行
  const html = renderView({
    columns: ["題", "状態"],
    items: [["<b>x</b>", "未着手"]],
    group: "状態",
    id: "story-view",
  });
  // 検証
  expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  expect(html).not.toContain("<b>");
});

// group が無ければ切り替えもボードも置かない（正常系）
test("test_render_view_when_table_only", async () => {
  // 準備
  const { renderView } = await loadView();
  // 実行
  const html = renderView({
    columns: COLUMNS,
    items: ITEMS.slice(0, 2),
    id: "story-view",
  });
  // 検証
  expect(html).not.toContain("mdmark-view-switch");
  expect(html).not.toContain("mdmark-view-board");
  expect(html).toContain("mdmark-view-table");
});

// ボードのボタンを押せなくする（正常系）
test("test_render_view_switch_when_board_disabled", async () => {
  // 準備
  const { renderViewSwitch } = await loadView();
  // 実行
  const html = renderViewSwitch({ mode: "table", boardDisabled: "w1" });
  // 検証
  const board = findTag(html, 'data-mode="board"');
  const table = findTag(html, 'data-mode="table"');
  expect(board).toMatch(/\sdisabled\b/);
  expect(board).toContain('aria-describedby="w1"');
  expect(table).toContain('aria-pressed="true"');
  expect(board).toContain('aria-pressed="false"');
});

// 既定・上書き・対応に無い値のアイコンを引く（正常系）
test("test_render_view_board_icons", async () => {
  // 準備
  const { renderViewBoard, VIEW_ICON_PATHS } = await loadView();
  // 実行
  const html = renderViewBoard({
    columns: ["題", "状態"],
    items: [
      ["項目 1", "未着手"],
      ["項目 2", "完了"],
      ["項目 3", "受付"],
    ],
    group: 1,
    icons: { 完了: "archive" },
  });
  // 検証
  const heads = splitColumns(html).map((column) =>
    innerHtml(column, "mdmark-view-column-head"),
  );
  expect(heads).toHaveLength(3);
  expect(heads[0]).toContain(VIEW_ICON_PATHS["circle-dashed"]);
  expect(heads[0]).not.toContain(VIEW_ICON_PATHS["circle-dot"]);
  expect(heads[1]).toContain(VIEW_ICON_PATHS.archive);
  expect(heads[1]).not.toContain(VIEW_ICON_PATHS["circle-check"]);
  expect(heads[2]).toContain(VIEW_ICON_PATHS.circle);
  expect(heads[2]).not.toContain(VIEW_ICON_PATHS["circle-dashed"]);
});

// 空の値の列を項目に出さない（正常系）
test("test_render_view_board_when_empty_value", async () => {
  // 準備
  const { renderViewBoard } = await loadView();
  // 実行
  const html = renderViewBoard({
    columns: COLUMNS,
    items: [["印刷を直す", "進行中", ""]],
    group: 1,
    icons: {},
  });
  // 検証
  const card = innerHtml(html, "mdmark-view-card");
  expect(card).toContain("印刷を直す");
  expect(card).not.toContain("<dt>担当</dt>");
});
