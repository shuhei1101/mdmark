import { afterEach, expect, inject, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type {
  MdmarkTableCellEditDetail,
  MdmarkTableColumn,
  MdmarkTableFeatures,
  MdmarkTableRow,
  MdmarkTableRowClickDetail,
} from "../../../src/index.ts";

/** 表のカスタム要素のプロパティ */
type TableElement = HTMLElement & {
  columns?: unknown;
  rows?: unknown;
  features?: unknown;
};

/** 描いた要素の幅（px） */
const TABLE_WIDTH = 800;
/** 2 行目のタイトルの文字数 */
const LONG_TITLE_LENGTH = 200;
/** 列の幅のつまみをドラッグする量（px） */
const RESIZE_DX = 80;

const placed: HTMLElement[] = [];
let built: Promise<unknown> | undefined;
let stylesheetLoaded: Promise<void> | undefined;

afterEach(() => {
  for (const element of placed.splice(0)) {
    element.remove();
  }
  vi.restoreAllMocks();
});

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
const distUrl = (file: string): string =>
  `/@fs${inject("builtRoot")}/dist/${file}`;

/** ビルドした CSS と JS を 1 度だけ読み込み、`<mdmark-table>` を登録した状態にする */
const loadBuilt = async (): Promise<void> => {
  stylesheetLoaded ??= new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = distUrl("index.css");
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.append(link);
  });
  await stylesheetLoaded;
  built ??= import(/* @vite-ignore */ distUrl("index.js"));
  await built;
};

/** 4 列の列の定義 */
const columns = (
  overrides: Partial<Record<string, Partial<MdmarkTableColumn>>> = {},
): MdmarkTableColumn[] => [
  { key: "title", title: "タイトル", pinned: true, ...overrides.title },
  {
    key: "state",
    title: "状態",
    filter: { type: "select" },
    ...overrides.state,
  },
  { key: "owner", title: "担当", ...overrides.owner },
  { key: "updated", title: "更新日", ...overrides.updated },
];

/** 5 行の行のデータ（1 行目は HTML の文字、2 行目は 200 文字のタイトル） */
const rows = (): MdmarkTableRow[] => [
  {
    key: "R1",
    values: {
      title: "<script>alert(1)</script>設計",
      state: "未着手",
      owner: "佐藤",
      updated: "2026-11-20",
    },
  },
  {
    key: "R2",
    values: {
      title: "長".repeat(LONG_TITLE_LENGTH),
      state: "進行中",
      owner: "鈴木",
      updated: "2026-11-22",
    },
  },
  {
    key: "R3",
    values: {
      title: "並べ替え",
      state: "進行中",
      owner: "佐藤",
      updated: "2026-11-18",
    },
  },
  {
    key: "R4",
    values: {
      title: "ピン止め",
      state: "完了",
      owner: "田中",
      updated: "2026-11-15",
    },
  },
  {
    key: "R5",
    values: {
      title: "行を押す",
      state: "未着手",
      owner: "鈴木",
      updated: "2026-11-21",
    },
  },
];

/** 既定の機能 */
const features = (extra: MdmarkTableFeatures = {}): MdmarkTableFeatures => ({
  count: {},
  columns: {},
  reorder: {},
  ...extra,
});

/** 幅 800px の `<mdmark-table>` を配置する（後ろに文字 `後ろの段落` の段落を持つ） */
const placeTable = async (): Promise<TableElement> => {
  await loadBuilt();
  const container = document.createElement("div");
  const element = document.createElement("mdmark-table") as TableElement;
  element.style.display = "block";
  element.style.width = `${TABLE_WIDTH}px`;
  const after = document.createElement("p");
  after.textContent = "後ろの段落";
  container.append(element, after);
  document.body.append(container);
  placed.push(container);
  return element;
};

/** 指定を代入して描き終えるまで待つ */
const assign = async (
  element: TableElement,
  spec: { columns?: unknown; rows?: unknown; features?: unknown },
): Promise<void> => {
  Object.assign(element, spec);
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/** 要素の中を CSS セレクタで 1 つ参照する（無ければ失敗する） */
const find = <T extends Element>(root: Element, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (!found) {
    throw new Error(`見つからない: ${selector}`);
  }
  return found;
};

/** 本文の行 */
const bodyRows = (element: Element): HTMLTableRowElement[] => [
  ...element.querySelectorAll<HTMLTableRowElement>(
    "tbody tr:not(.mdmark-table-empty)",
  ),
];

/** 表示している本文の行のキー */
const shownKeys = (element: Element): string[] =>
  bodyRows(element)
    .filter((row) => !row.hidden)
    .map((row) => row.dataset.key ?? "");

/** 最下段の見出しのセル */
const heads = (element: Element): HTMLTableCellElement[] => [
  ...element.querySelectorAll<HTMLTableCellElement>("thead tr:last-child th"),
];

/** 表示している見出しの列のキー */
const shownColumnKeys = (element: Element): string[] =>
  heads(element)
    .filter((head) => !head.hidden)
    .map((head) => head.dataset.columnKey ?? "");

/** 列のキーの見出しのセル */
const headOf = (element: Element, key: string): HTMLTableCellElement => {
  const head = heads(element).find((cell) => cell.dataset.columnKey === key);
  if (!head) {
    throw new Error(`見出しが無い: ${key}`);
  }
  return head;
};

/** 行のキーと列のキーのセル（今の並びで参照する） */
const cellOf = (
  element: Element,
  rowKey: string,
  columnKey: string,
): HTMLTableCellElement => {
  const position = heads(element).indexOf(headOf(element, columnKey));
  const row = bodyRows(element).find((tr) => tr.dataset.key === rowKey);
  const cell = row?.cells[position];
  if (!cell) {
    throw new Error(`セルが無い: ${rowKey} ${columnKey}`);
  }
  return cell;
};

/** 状態の絞り込みで値を 1 つ選ぶ */
const filterState = (element: Element, value: string): void => {
  find<HTMLButtonElement>(headOf(element, "state"), ".mdmark-filter").click();
  const drawer = find<HTMLElement>(
    element,
    ".mdmark-filter-drawer:not([hidden])",
  );
  const checkbox = [
    ...drawer.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
  ].find((input) => input.closest("label")?.textContent?.includes(value));
  if (!checkbox) {
    throw new Error(`絞り込みの候補が無い: ${value}`);
  }
  checkbox.click();
};

/** 件数の表示の文字 */
const countText = (element: Element): string =>
  find(element, ".mdmark-table-count span[aria-hidden]").textContent ?? "";

/** キーを押す */
const press = (target: Element, key: string): void => {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
};

/** テーブル設定を開き、記載した順の列の位置の項目の要素を返却する関数を返却する */
const openSettings = (
  element: Element,
): ((column: number, selector: string) => HTMLElement) => {
  find<HTMLButtonElement>(
    element,
    "button.mdmark-table-settings-toggle",
  ).click();
  const panel = find<HTMLElement>(element, ".mdmark-table-settings");
  return (column, selector) =>
    find<HTMLElement>(
      panel,
      `.mdmark-table-settings-item[data-column="${column}"] ${selector}`,
    );
};

/** 列の幅のつまみに `pointerdown` から `pointerup` までを送信する */
const dragResizeHandle = (handle: HTMLElement, dx: number): void => {
  const rect = handle.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const init = {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "mouse",
  };
  handle.dispatchEvent(
    new PointerEvent("pointerdown", { ...init, clientX: x, clientY: y }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", { ...init, clientX: x + dx, clientY: y }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointerup", { ...init, clientX: x + dx, clientY: y }),
  );
};

/** 2 つの矩形が重なるか */
const overlaps = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// 列の定義と行のデータから表を描き、並べ替え・絞り込み・列の幅・列の表示と並び順を操作する（正常系）
test("test_normal", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const element = await placeTable();
  // 実行
  await assign(element, {
    columns: columns(),
    rows: rows(),
    features: features(),
  });
  // 検証: 囲みと表
  expect(element.querySelectorAll(":scope > .mdmark")).toHaveLength(1);
  const table = find<HTMLTableElement>(element, ".mdmark table");
  expect(table.querySelector("thead tr")).not.toBeNull();
  expect(headOf(element, "title").querySelector(".mdmark-pin")).not.toBeNull();
  expect(
    headOf(element, "state").querySelector(".mdmark-filter"),
  ).not.toBeNull();
  expect(bodyRows(element)).toHaveLength(5);
  // 検証: HTML の文字はそのまま出る
  expect(cellOf(element, "R1", "title").textContent).toBe(
    "<script>alert(1)</script>設計",
  );
  expect(element.querySelector("script")).toBeNull();
  // 検証: 200 文字のタイトルは折り返し、隣のセルと重ならない
  const longCell = cellOf(element, "R2", "title");
  const nextCell = cellOf(element, "R2", "state");
  expect(longCell.getBoundingClientRect().height).toBeGreaterThan(
    nextCell.querySelector("*")?.getBoundingClientRect().height ??
      Number.parseFloat(getComputedStyle(nextCell).lineHeight),
  );
  expect(
    overlaps(
      longCell.getBoundingClientRect(),
      nextCell.getBoundingClientRect(),
    ),
  ).toBe(false);
  // 実行・検証: 更新日の見出しで並べ替える
  find<HTMLButtonElement>(headOf(element, "updated"), ".mdmark-sort").click();
  expect(headOf(element, "updated").getAttribute("aria-sort")).toBe(
    "descending",
  );
  expect(shownKeys(element)).toEqual(["R2", "R5", "R1", "R3", "R4"]);
  // 実行・検証: 状態で 進行中 に絞り込む
  filterState(element, "進行中");
  expect(shownKeys(element)).toEqual(["R2", "R3"]);
  expect(countText(element)).toBe("2 / 5 件");
  // 実行・検証: 担当の列の幅を広げる
  const owner = headOf(element, "owner");
  const before = owner.offsetWidth;
  dragResizeHandle(
    find<HTMLElement>(owner, ":scope > .mdmark-col-resize"),
    RESIZE_DX,
  );
  expect(headOf(element, "owner").offsetWidth).toBeGreaterThan(before);
  // 実行・検証: テーブル設定で更新日を隠し、担当を状態の前へ動かす
  const control = openSettings(element);
  control(3, ".mdmark-table-settings-eye").click();
  expect(shownColumnKeys(element)).toEqual(["title", "state", "owner"]);
  press(control(2, ".mdmark-table-settings-grip"), "ArrowUp");
  expect(shownColumnKeys(element)).toEqual(["title", "owner", "state"]);
  const firstRow = bodyRows(element).find((row) => !row.hidden);
  const shownCells = [...(firstRow?.cells ?? [])].filter(
    (cell) => !cell.hidden,
  );
  expect(shownCells.map((cell) => cell.dataset.label)).toEqual([
    "タイトル",
    "担当",
    "状態",
  ]);
});

// 編集できない列のセルを押すか、行にフォーカスして Enter を押すと、行のキーで行の押下を送信する（正常系（行を押す））
test("test_normal_when_row_clicked", async () => {
  // 準備
  const element = await placeTable();
  const owner = columns().map((column) =>
    column.key === "owner"
      ? {
          ...column,
          render: (value: string | number | null) => {
            const link = document.createElement("a");
            link.href = "#owner";
            link.textContent = String(value);
            return link;
          },
        }
      : column,
  );
  await assign(element, { columns: owner, rows: rows(), features: features() });
  const keys: string[] = [];
  element.addEventListener("mdmark-row-click", (event) => {
    keys.push((event as CustomEvent<MdmarkTableRowClickDetail>).detail.key);
  });
  // 実行: 3 行目の状態のセルを押す
  cellOf(element, "R3", "state").click();
  // 実行: 3 行目から ↓ で 4 行目へ移して Enter を押す
  const third = bodyRows(element)[2];
  third?.focus();
  press(document.activeElement ?? element, "ArrowDown");
  press(document.activeElement ?? element, "Enter");
  const focused = document.activeElement;
  // 実行: 並べ替え・ピン止め・絞り込みのボタンとセルの中のリンクを押す
  find<HTMLButtonElement>(headOf(element, "updated"), ".mdmark-sort").click();
  find<HTMLButtonElement>(headOf(element, "title"), ".mdmark-pin").click();
  find<HTMLButtonElement>(headOf(element, "state"), ".mdmark-filter").click();
  find<HTMLAnchorElement>(cellOf(element, "R1", "owner"), "a").click();
  // 検証
  expect(keys).toEqual(["R3", "R4"]);
  expect(focused).toBe(
    bodyRows(element).find((row) => row.dataset.key === "R4"),
  );
  expect(
    bodyRows(element).filter((row) => row.getAttribute("tabindex") === "0"),
  ).toHaveLength(1);
});

// 編集できる列のセルを入力欄にし、確定するとセルの編集を送信する（正常系（セルを編集する））
test("test_normal_when_cell_edited", async () => {
  // 準備
  const element = await placeTable();
  await assign(element, {
    columns: columns({ owner: { editable: true } }),
    rows: rows(),
    features: features(),
  });
  const edits: MdmarkTableCellEditDetail[] = [];
  const clicks = vi.fn();
  element.addEventListener("mdmark-cell-edit", (event) => {
    edits.push((event as CustomEvent<MdmarkTableCellEditDetail>).detail);
  });
  element.addEventListener("mdmark-row-click", clicks);
  // 実行: 2 行目の担当のセルを押す
  cellOf(element, "R2", "owner").click();
  const input = find<HTMLInputElement>(cellOf(element, "R2", "owner"), "input");
  // 検証
  expect(input.value).toBe("鈴木");
  expect(document.activeElement).toBe(input);
  expect(clicks).not.toHaveBeenCalled();
  // 実行: 田中 を入れて Enter を押す
  await userEvent.fill(input, "田中");
  press(input, "Enter");
  // 検証
  expect(edits).toEqual([
    { key: "R2", column: "owner", oldValue: "鈴木", value: "田中" },
  ]);
  expect(cellOf(element, "R2", "owner").textContent).toBe("田中");
  // 実行: 3 行目で F2 を押し、入力して Esc を押す
  const third = bodyRows(element).find((row) => row.dataset.key === "R3");
  third?.focus();
  press(third ?? element, "F2");
  const escaped = find<HTMLInputElement>(
    cellOf(element, "R3", "owner"),
    "input",
  );
  escaped.value = "高橋";
  press(escaped, "Escape");
  // 実行: 4 行目を値を変えずに確定する
  cellOf(element, "R4", "owner").click();
  press(
    find<HTMLInputElement>(cellOf(element, "R4", "owner"), "input"),
    "Enter",
  );
  // 実行: タイトルのセルを押す
  cellOf(element, "R5", "title").click();
  // 検証
  expect(cellOf(element, "R3", "owner").textContent).toBe("佐藤");
  expect(edits).toHaveLength(1);
  expect(cellOf(element, "R5", "title").querySelector("input")).toBeNull();
});

// 行追加 を押すと行の追加を送信し、指定し直した行のデータで並べ替えと絞り込みを保って描き直す（正常系（行を追加する））
test("test_normal_when_row_added", async () => {
  // 準備
  const element = await placeTable();
  await assign(element, {
    columns: columns(),
    rows: rows(),
    features: features({ add: {} }),
  });
  const added = {
    key: "R6",
    values: {
      title: "行を追加",
      state: "進行中",
      owner: "佐藤",
      updated: "2026-11-21",
    },
  };
  const adds = vi.fn(() => {
    element.rows = [...rows(), added];
  });
  element.addEventListener("mdmark-row-add", adds);
  find<HTMLButtonElement>(headOf(element, "updated"), ".mdmark-sort").click();
  filterState(element, "進行中");
  const button = find<HTMLButtonElement>(element, ".mdmark-table-add-button");
  const table = find<HTMLElement>(element, ".mdmark-table-scroll");
  // 検証: 表の下の左端に 行追加 のボタン
  expect(button.textContent).toBe("行追加");
  expect(button.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    table.getBoundingClientRect().bottom,
  );
  expect(
    Math.abs(
      button.getBoundingClientRect().left - table.getBoundingClientRect().left,
    ),
  ).toBeLessThan(TABLE_WIDTH / 4);
  // 実行
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  // 検証
  expect(adds).toHaveBeenCalledTimes(1);
  expect(countText(element)).toBe("3 / 6 件");
  expect(shownKeys(element)).toEqual(["R2", "R6", "R3"]);
  expect(headOf(element, "updated").getAttribute("aria-sort")).toBe(
    "descending",
  );
  find<HTMLButtonElement>(headOf(element, "state"), ".mdmark-filter").click();
  const checked = [
    ...element.querySelectorAll<HTMLInputElement>(
      ".mdmark-filter-drawer:not([hidden]) input[type=checkbox]:checked",
    ),
  ].map((input) => input.closest("label")?.textContent?.trim());
  expect(checked).toEqual([expect.stringContaining("進行中")]);
});

// 描き方の関数が返却した要素をセルに配置し、並べ替えと絞り込みは行のデータの値で動かす（正常系（セルの中身を差し替える））
test("test_normal_when_cell_content_replaced", async () => {
  // 準備
  const element = await placeTable();
  const render = vi.fn(
    (value: string | number | null, _row: MdmarkTableRow) => {
      const badge = document.createElement("span");
      badge.className = "app-badge";
      badge.textContent = `● ${String(value)}`;
      return badge;
    },
  );
  const data = rows();
  // 実行
  await assign(element, {
    columns: columns({ state: { render } }),
    rows: data,
    features: features(),
  });
  // 検証
  for (const row of data) {
    expect(
      cellOf(element, row.key, "state").querySelectorAll("span.app-badge"),
    ).toHaveLength(1);
  }
  for (const [index, row] of data.entries()) {
    expect(render.mock.calls[index]?.[1]).toEqual(row);
  }
  // 実行: 状態の見出しで並べ替える
  find<HTMLButtonElement>(headOf(element, "state"), ".mdmark-sort").click();
  // 検証: 最初の押下は降順
  const order = shownKeys(element).map(
    (key) => data.find((row) => row.key === key)?.values.state,
  );
  expect(headOf(element, "state").getAttribute("aria-sort")).toBe("descending");
  expect(order).toEqual(
    [...order].sort((a, b) => String(b).localeCompare(String(a), "ja")),
  );
  find<HTMLButtonElement>(headOf(element, "state"), ".mdmark-filter").click();
  const candidates = [
    ...element.querySelectorAll<HTMLInputElement>(
      ".mdmark-filter-drawer:not([hidden]) input[type=checkbox]",
    ),
  ].map((input) => input.value);
  expect(new Set(candidates)).toEqual(
    new Set(data.map((row) => String(row.values.state))),
  );
});

// 指定に誤りがあると、例外を投げずに通知ブロックを配置する（異常系（データの誤り・通知ブロック））
test("test_error_when_data_invalid", async () => {
  // 準備
  const invalid: Array<{
    spec: { columns: unknown; rows: unknown; features?: unknown };
    name: string;
  }> = [
    { spec: { columns: columns(), rows: "R1" }, name: "rows" },
    {
      spec: {
        columns: [
          { key: "a", title: "担当" },
          { key: "b", title: "担当" },
        ],
        rows: [],
      },
      name: "columns[1].title",
    },
    {
      spec: { columns: columns(), rows: rows(), features: { total: {} } },
      name: "features.total",
    },
  ];
  for (const { spec, name } of invalid) {
    const element = await placeTable();
    // 実行
    const assignInvalid = () => Object.assign(element, spec);
    expect(assignInvalid).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // 検証
    const notice = find<HTMLElement>(element, ".mdmark-notice");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.textContent).toContain("この表を表示できません");
    expect(
      [...notice.querySelectorAll("code")].map((code) => code.textContent),
    ).toContain(name);
    expect(element.querySelector("table")).toBeNull();
    const after = element.nextElementSibling as HTMLElement;
    expect(after.textContent).toBe("後ろの段落");
    expect(after.getBoundingClientRect().height).toBeGreaterThan(0);
    // 実行・検証: 正しい指定を代入し直すと表を描く
    await assign(element, { columns: columns(), rows: rows(), features: {} });
    expect(element.querySelector(".mdmark-notice")).toBeNull();
    expect(element.querySelector("table")).not.toBeNull();
  }
});
