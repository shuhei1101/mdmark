import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { addStyles } from "../../helpers/dom.ts";

/** 表のカスタム要素を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadElement = () =>
  import("../../../../src/table/mdmark-table.element.ts");

const elements: HTMLElement[] = [];

beforeAll(async () => {
  addStyles();
  const { defineTableElement } = await loadElement().catch(() => ({
    defineTableElement: undefined,
  }));
  defineTableElement?.(customElements);
});

afterEach(() => {
  for (const element of elements.splice(0)) {
    element.remove();
  }
});

/** 4 列の列の定義 */
const columns = () => [
  { key: "title", title: "タイトル", pinned: true },
  { key: "state", title: "状態", filter: { type: "select" as const } },
  { key: "owner", title: "担当", editable: true },
  { key: "updated", title: "更新日" },
];

/** 5 行の行のデータ */
const rows = () => [
  { key: "R1", values: { title: "設計", state: "未着手", owner: "佐藤", updated: "2026-11-20" } },
  { key: "R2", values: { title: "列の幅", state: "進行中", owner: "鈴木", updated: "2026-11-22" } },
  { key: "R3", values: { title: "並べ替え", state: "進行中", owner: "佐藤", updated: "2026-11-18" } },
  { key: "R4", values: { title: "ピン止め", state: "完了", owner: "田中", updated: "2026-11-15" } },
  { key: "R5", values: { title: "行を押す", state: "未着手", owner: "鈴木", updated: "2026-11-21" } },
];

/** 型 MdmarkTableElement のプロパティを持つ要素 */
type TableElement = HTMLElement & {
  columns?: unknown;
  rows?: unknown;
  features?: unknown;
};

/** ページに配置した <mdmark-table> */
function createTable(): TableElement {
  const element = document.createElement("mdmark-table") as TableElement;
  document.body.append(element);
  elements.push(element);
  return element;
}

/** マイクロタスクを終えるまで待つ */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** 本文の行 */
function bodyRows(element: HTMLElement): HTMLTableRowElement[] {
  return [
    ...element.querySelectorAll<HTMLTableRowElement>(
      "tbody tr:not(.mdmark-table-empty)",
    ),
  ];
}

/** 表示している本文の行のキー */
function shownKeys(element: HTMLElement): string[] {
  return bodyRows(element)
    .filter((row) => !row.hidden)
    .map((row) => row.dataset.key ?? "");
}

/** 列の見出しの並べ替えのボタン */
function sortButton(element: HTMLElement, column: number): HTMLButtonElement {
  const button = element.querySelectorAll<HTMLTableCellElement>("thead th")[
    column
  ]?.querySelector<HTMLButtonElement>(".mdmark-sort");
  if (!button) {
    throw new Error("並べ替えのボタンがありません");
  }
  return button;
}

/** 状態の列の絞り込みで値を 1 つ選ぶ */
function filterState(element: HTMLElement, value: string): void {
  element.querySelector<HTMLButtonElement>(".mdmark-filter")?.click();
  const drawer = element.querySelector<HTMLElement>(
    ".mdmark-filter-drawer:not([hidden])",
  );
  const checkbox = [
    ...(drawer?.querySelectorAll<HTMLInputElement>("input[type=checkbox]") ?? []),
  ].find((input) => input.closest("label")?.textContent?.includes(value));
  checkbox?.click();
}

// 登録する前に代入したプロパティで描く（正常系）
test("test_connected_callback_when_upgraded", async () => {
  // 準備
  const { MdmarkTableElement } = await loadElement();
  const element = document.createElement("mdmark-table-upgrade") as TableElement;
  element.columns = columns();
  element.rows = rows();
  document.body.append(element);
  elements.push(element);
  // 実行
  customElements.define("mdmark-table-upgrade", class extends MdmarkTableElement {});
  await flush();
  // 検証
  expect(element.querySelector("table")).not.toBeNull();
});

// 取り除くと操作を解除し、戻すと描き直す（正常系）
test("test_disconnected_callback", async () => {
  // 準備
  await loadElement();
  const element = createTable();
  element.columns = columns();
  element.rows = rows();
  await flush();
  const parent = element.parentElement;
  // 実行
  element.remove();
  // 取り除いた後は操作を解除しているので、ボタンが残っていても行は動かない
  element
    .querySelectorAll("thead th")[3]
    ?.querySelector<HTMLButtonElement>(".mdmark-sort")
    ?.click();
  const whileRemoved = shownKeys(element);
  parent?.append(element);
  await flush();
  sortButton(element, 3).click();
  // 検証
  expect(whileRemoved).toEqual(["R1", "R2", "R3", "R4", "R5"]);
  expect(shownKeys(element)).toEqual(["R2", "R5", "R1", "R3", "R4"]);
});

// 同じマイクロタスクの代入を 1 回にまとめる（正常系）
test("test_schedule_render", async () => {
  // 準備
  await loadElement();
  const element = createTable();
  const records: MutationRecord[] = [];
  const watch = new MutationObserver((list) => records.push(...list));
  watch.observe(element, { childList: true });
  // 実行
  element.columns = columns();
  element.rows = rows();
  element.features = { count: {} };
  await flush();
  watch.disconnect();
  // 検証
  expect(records.filter((record) => record.addedNodes.length > 0)).toHaveLength(1);
});

// 列の定義と行のデータから表を描く（正常系）
test("test_render_now", async () => {
  // 準備
  await loadElement();
  const element = createTable();
  // 実行
  element.columns = columns();
  element.rows = rows();
  await flush();
  // 検証
  expect(element.children).toHaveLength(1);
  expect(element.firstElementChild?.classList.contains("mdmark")).toBe(true);
  expect(
    element.querySelector('div.mdmark-table[data-kind="data"]'),
  ).not.toBeNull();
  expect(bodyRows(element)).toHaveLength(5);
  expect(bodyRows(element).every((row) => row.dataset.key)).toBe(true);
});

// 誤った指定は例外を投げずに通知ブロックを描く（異常系）
test("test_render_now_when_invalid", async () => {
  // 準備
  await loadElement();
  const element = createTable();
  element.columns = columns();
  // 実行
  const assign = () => {
    element.rows = "R1";
  };
  expect(assign).not.toThrow();
  await flush();
  const notice = element.querySelector(".mdmark-notice");
  const noticeHtml = notice?.innerHTML ?? "";
  element.rows = rows();
  await flush();
  // 検証
  expect(noticeHtml).toContain("この表を表示できません");
  expect(noticeHtml).toContain("<code>rows</code>");
  expect(element.querySelector("table")).not.toBeNull();
  expect(element.querySelector(".mdmark-notice")).toBeNull();
});

// 行のデータを代入し直すと並べ替えと絞り込みを保って描き直す（正常系）
test("test_render_now_when_rows_reassigned", async () => {
  // 準備
  await loadElement();
  const element = createTable();
  element.columns = columns();
  element.rows = rows();
  await flush();
  sortButton(element, 3).click();
  filterState(element, "進行中");
  // 実行
  element.rows = [
    ...rows(),
    { key: "R6", values: { title: "行を追加", state: "進行中", owner: "佐藤", updated: "2026-11-23" } },
  ];
  await flush();
  // 検証
  expect(
    element.querySelectorAll("thead th")[3]?.getAttribute("aria-sort"),
  ).toBe("descending");
  expect(shownKeys(element)).toEqual(["R6", "R2", "R3"]);
});

// アプリが preventDefault すると前の値に戻す（正常系）
test("test_render_now_when_cell_edit_cancelled", async () => {
  // 準備
  await loadElement();
  const element = createTable();
  element.columns = columns();
  element.rows = rows();
  await flush();
  const events: CustomEvent[] = [];
  element.addEventListener("mdmark-cell-edit", (event) => {
    events.push(event as CustomEvent);
    event.preventDefault();
  });
  const cell = bodyRows(element)[1]?.children[2] as HTMLElement;
  // 実行
  cell.click();
  const input = cell.querySelector<HTMLInputElement>("input");
  if (input) {
    input.value = "田中";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
  }
  // 検証
  expect(events).toHaveLength(1);
  expect(events[0]?.cancelable).toBe(true);
  expect(cell.textContent).toBe("鈴木");
});

// 行の押下と行の追加を要素のイベントで送信する（正常系）
test("test_render_now_when_events", async () => {
  // 準備
  await loadElement();
  const wrapper = document.createElement("div");
  document.body.append(wrapper);
  elements.push(wrapper);
  const element = document.createElement("mdmark-table") as TableElement;
  wrapper.append(element);
  element.columns = columns();
  element.rows = rows();
  element.features = { add: {} };
  await flush();
  const clicks = vi.fn();
  const adds = vi.fn();
  wrapper.addEventListener("mdmark-row-click", (event) =>
    clicks((event as CustomEvent).detail),
  );
  wrapper.addEventListener("mdmark-row-add", adds);
  // 実行
  (bodyRows(element)[2]?.children[0] as HTMLElement).click();
  element.querySelector<HTMLButtonElement>(".mdmark-table-add-button")?.click();
  // 検証
  expect(clicks).toHaveBeenCalledTimes(1);
  expect(clicks).toHaveBeenCalledWith({ key: "R3" });
  expect(adds).toHaveBeenCalledTimes(1);
});

// 未登録なら登録し、登録済みなら何もしない（正常系）
test("test_define_table_element", async () => {
  // 準備
  const { defineTableElement, MdmarkTableElement } = await loadElement();
  const define = vi.fn();
  const registered: Array<CustomElementConstructor | undefined> = [
    undefined,
    class extends HTMLElement {},
  ];
  const registry = {
    get: vi.fn(() => registered.shift()),
    define,
  } as unknown as CustomElementRegistry;
  // 実行
  defineTableElement(registry);
  defineTableElement(registry);
  // 検証
  expect(define).toHaveBeenCalledTimes(1);
  expect(define).toHaveBeenCalledWith("mdmark-table", MdmarkTableElement);
});
