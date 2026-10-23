import { afterEach, expect, test } from "vitest";
import { loadSource } from "../../helpers/lazy.ts";

/** ビューの部品のモジュールを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadViews = () =>
  loadSource(
    import.meta.glob<typeof import("../../../../src/views/index.ts")>(
      "../../../../src/views/index.ts",
    ),
  );

const detachers: Array<() => void> = [];
const hosts: HTMLElement[] = [];

/** ビューを描く先の要素をページに置く */
function createHost(html = ""): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  hosts.push(host);
  return host;
}

/** 題・状態・担当の列名 */
const COLUMNS = ["題", "状態", "担当"];

/** 状態が上から未着手・進行中・未着手・完了・進行中、担当が佐藤・鈴木・佐藤・田中・鈴木の 5 件 */
const ITEMS = [
  { 題: "<script>alert(1)</script>設計", 状態: "未着手", 担当: "佐藤" },
  { 題: "余白の変数を決める", 状態: "進行中", 担当: "鈴木" },
  { 題: "印刷の見え方を確かめる", 状態: "未着手", 担当: "佐藤" },
  { 題: "配色を直す", 状態: "完了", 担当: "田中" },
  { 題: "表を絞り込む", 状態: "進行中", 担当: "鈴木" },
];

/** ボードの列の見出しの値を、並びの順に返す */
function columnNames(root: HTMLElement): string[] {
  return [...root.querySelectorAll(".mdmark-view-column-name")].map(
    (name) => name.textContent ?? "",
  );
}

/** 切り替えのボタンを返す */
function switchButton(root: HTMLElement, mode: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(
    `.mdmark-view-switch button[data-mode="${mode}"]`,
  );
  if (!button) {
    throw new Error(`切り替えのボタンが無い: ${mode}`);
  }
  return button;
}

/** 表形式の本文の行のうち、隠れていない行の数 */
function visibleRows(root: HTMLElement): number {
  return [...root.querySelectorAll<HTMLElement>(".mdmark-view-table tbody tr")]
    .filter((row) => !row.classList.contains("mdmark-table-empty"))
    .filter((row) => !row.hidden).length;
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  for (const host of hosts.splice(0)) {
    host.remove();
  }
});

// ボードで描き、切り替えで表形式に替える（正常系）
test("test_draw_view", async () => {
  // 準備
  const { drawView } = await loadViews();
  const el = createHost();
  // 実行
  detachers.push(
    drawView(el, { columns: COLUMNS, items: ITEMS, group: "状態" }),
  );
  // 検証
  expect(el.querySelector(":scope > .mdmark > .mdmark-view")).not.toBeNull();
  expect(columnNames(el)).toEqual(["未着手", "進行中", "完了"]);
  expect(el.textContent).toContain("<script>alert(1)</script>設計");
  expect(el.querySelector("script")).toBeNull();
  // 実行
  switchButton(el, "table").click();
  // 検証
  expect(el.querySelector<HTMLElement>(".mdmark-view-table")?.hidden).toBe(
    false,
  );
  expect(el.querySelector<HTMLElement>(".mdmark-view-board")?.hidden).toBe(
    true,
  );
  expect(switchButton(el, "table").getAttribute("aria-pressed")).toBe("true");
});

// 表形式の絞り込みはボードに当たらず、戻すと残っている（正常系）
test("test_draw_view_when_filtered", async () => {
  // 準備
  const { drawView } = await loadViews();
  const el = createHost();
  detachers.push(
    drawView(el, {
      columns: COLUMNS,
      items: ITEMS,
      group: "状態",
      default: "table",
      filter: { 担当: "select" },
    }),
  );
  const drawer = el.querySelector<HTMLElement>(".mdmark-filter-drawer");
  el.querySelector<HTMLButtonElement>("button.mdmark-filter")?.click();
  const label = [...(drawer?.querySelectorAll("label") ?? [])].find(
    (candidate) => candidate.textContent?.includes("佐藤"),
  );
  // 実行
  (label?.control as HTMLInputElement | null)?.click();
  // 検証
  expect(visibleRows(el)).toBe(2);
  // 実行
  switchButton(el, "board").click();
  // 検証
  expect(el.querySelectorAll(".mdmark-view-card")).toHaveLength(5);
  // 実行
  switchButton(el, "table").click();
  // 検証
  expect(visibleRows(el)).toBe(2);
});

// 外すと el が空になる（正常系）
test("test_draw_view_when_destroyed", async () => {
  // 準備
  const { drawView } = await loadViews();
  const el = createHost();
  const detach = drawView(el, {
    columns: COLUMNS,
    items: ITEMS,
    group: "状態",
  });
  // 実行
  detach();
  // 検証
  expect(el.childNodes).toHaveLength(0);
});

/** 題・状態の表を `div.mdmark-view` に入れた HTML。`data-view` を指定する */
function viewHtml(spec: string): string {
  return [
    `<div class="mdmark-view" data-view='${spec}'>`,
    '<div class="mdmark-table" data-kind="data" data-features="sort">',
    "<table><thead><tr><th>題</th><th>状態</th></tr></thead>",
    "<tbody><tr><td>配色を直す</td><td>未着手</td></tr>",
    "<tr><td>表を絞り込む</td><td>完了</td></tr></tbody></table>",
    "</div></div>",
  ].join("");
}

// 印の表からボードを足し、外すと戻す（正常系）
test("test_attach_view", async () => {
  // 準備
  const { attachView } = await loadViews();
  const host = createHost(
    viewHtml('{"group":1,"mode":"board","boardDisabled":"","icons":{}}'),
  );
  const view = host.querySelector<HTMLElement>(".mdmark-view");
  if (!view) {
    throw new Error("ビューの要素が無い");
  }
  // 実行
  const detach = attachView(view);
  // 検証
  expect(view.querySelector(".mdmark-view-switch")).not.toBeNull();
  expect(view.querySelector(".mdmark-view-board")).not.toBeNull();
  expect(view.querySelector<HTMLElement>(".mdmark-view-table")?.hidden).toBe(
    true,
  );
  // 実行
  detach();
  // 検証
  expect(view.querySelector(".mdmark-view-switch")).toBeNull();
  expect(view.querySelector(".mdmark-view-board")).toBeNull();
  expect(view.querySelector(".mdmark-view-table")).toBeNull();
  expect(view.querySelector<HTMLElement>(".mdmark-table")?.hidden).toBe(false);
});

// group の列が無いとボードを押せない（正常系）
test("test_attach_view_when_board_disabled", async () => {
  // 準備
  const { attachView } = await loadViews();
  const host = createHost(
    viewHtml('{"group":null,"mode":"table","boardDisabled":"w1","icons":{}}'),
  );
  const view = host.querySelector<HTMLElement>(".mdmark-view");
  if (!view) {
    throw new Error("ビューの要素が無い");
  }
  // 実行
  detachers.push(attachView(view));
  // 検証
  const board = switchButton(view, "board");
  expect(board.disabled).toBe(true);
  expect(board.getAttribute("aria-describedby")).toBe("w1");
  expect(view.querySelector<HTMLElement>(".mdmark-view-table")?.hidden).toBe(
    false,
  );
});
