import { afterEach, expect, test, vi } from "vitest";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";

/** 列の幅を自動で決める処理を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読み込む） */
const loadTableWidth = (): Promise<
  typeof import("../../../../src/interact/table-width.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/interact/table-width.ts",
      import.meta.url,
    ).href
  );

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 全角の文字を指定した数だけ並べる */
const wide = (count: number): string => "あ".repeat(count);

/** インターフェース定義『文書を描く』の「正常系（列の幅を中身から決める）」の 6 列の表 */
const CONTENT_TABLE = [
  '<!-- table: {"kind": "data"} -->',
  "",
  "| No | 状態 | 更新日 | 名前 | 手順 | 説明 |",
  "| --- | --- | --- | --- | --- | --- |",
  ...[1, 2, 3].map(
    (no) =>
      `| ${no} | \`badge:対応中\` | 2026-11-0${no} | ${wide(6)} | ${wide(10)}<br>${wide(8)}<br>${wide(6)} | ${wide(120)} |`,
  ),
  "",
  "<!-- /table -->",
  "",
].join("\n");

/** 描く先の要素の幅を決める */
const setRootWidth = (root: HTMLElement, width: number): void => {
  root.style.boxSizing = "border-box";
  root.style.width = `${width}px`;
};

/** 描いた表の囲み・表・包む要素・最下段の見出しのセルを返却する */
const tableParts = (
  root: HTMLElement,
): {
  wrapper: HTMLElement;
  table: HTMLTableElement;
  scroller: HTMLElement;
  headCells: HTMLTableCellElement[];
} => {
  const wrapper = root.querySelector<HTMLElement>(".mdmark-table");
  const table = wrapper?.querySelector("table");
  const scroller = wrapper?.querySelector<HTMLElement>(".mdmark-table-scroll");
  const head = table?.tHead?.rows;
  if (!wrapper || !table || !scroller || !head) {
    throw new Error("表が無い");
  }
  return {
    wrapper,
    table,
    scroller,
    headCells: [...(head[head.length - 1]?.cells ?? [])],
  };
};

/** セルの中に文字を折り返さずに置いたときの幅に、余白と罫線と 2px を足して切り上げる */
const expectedWidth = (cell: HTMLElement, text: string): number => {
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:nowrap";
  probe.textContent = text;
  cell.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  const style = getComputedStyle(cell);
  const padding =
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight) +
    Number.parseFloat(style.borderLeftWidth) +
    Number.parseFloat(style.borderRightWidth);
  return Math.ceil(width + padding + 2);
};

/** 描画の更新を 2 回待つ（`ResizeObserver` の呼び出しが済むまで） */
const nextFrames = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/** 見出しのセルの `--mdmark-auto-width` を数で返却する（無ければ `NaN`） */
const autoWidthOf = (cell: HTMLElement | undefined): number =>
  Number.parseFloat(cell?.style.getPropertyValue("--mdmark-auto-width") ?? "");

// 改行で分けた行のうち最も長い行と、最も長い半角の単語を測る（正常系）
test("test_measure_columns", async () => {
  // 準備
  addStyles();
  const { measureColumns } = await loadTableWidth();
  const { root } = createRoot(
    [
      "| 短い | 単語 | 隠す |",
      "| --- | --- | --- |",
      "| ab<br>abcdef | x hello-world y | z |",
      "",
    ].join("\n"),
  );
  root.style.font = "14px/1.5 monospace";
  const { table, headCells } = tableParts(root);
  for (const row of table.rows) {
    row.cells[2]?.setAttribute("hidden", "");
  }
  const bodyCells = table.tBodies[0]?.rows[0]?.cells;
  if (!bodyCells?.[0] || !bodyCells[1]) {
    throw new Error("本文のセルが無い");
  }
  const longest = expectedWidth(bodyCells[0], "abcdef");
  const longestWord = expectedWidth(bodyCells[1], "hello-world");
  // 実行
  const columns = measureColumns(table, headCells);
  // 検証
  expect(columns.map((column) => column.column)).toEqual([0, 1]);
  expect(columns[0]?.longest).toBe(longest);
  expect(columns[1]?.longestWord).toBe(longestWord);
  expect(columns[0]?.em).toBe(14);
  expect(table.querySelector("span[style*='visibility']")).toBeNull();
});

// 先頭から MEASURE_ROWS 行までだけを測る（正常系）
test("test_measure_columns_when_rows_limited", async () => {
  // 準備
  addStyles();
  const { measureColumns, MEASURE_ROWS } = await loadTableWidth();
  const rows = Array.from({ length: MEASURE_ROWS + 1 }, (_, index) =>
    index === MEASURE_ROWS ? `| ${wide(60)} |` : "| あ |",
  );
  const { root } = createRoot(["| 列 |", "| --- |", ...rows, ""].join("\n"));
  const { table, headCells } = tableParts(root);
  const lastCell = table.tBodies[0]?.rows[MEASURE_ROWS]?.cells[0];
  if (!lastCell) {
    throw new Error("201 行目のセルが無い");
  }
  const longLine = expectedWidth(lastCell, wide(60));
  // 実行
  const [column] = measureColumns(table, headCells);
  // 検証
  expect(MEASURE_ROWS).toBe(200);
  expect(column?.longest).toBeLessThan(longLine);
});

// 長文の列を残りの幅で広げ、ほかの列を最も長い行の幅にする（正常系）
test("test_attach_auto_column_widths", async () => {
  // 準備
  addStyles();
  const { attachAutoColumnWidths } = await loadTableWidth();
  const { root } = createRoot(CONTENT_TABLE);
  setRootWidth(root, 1280);
  const { wrapper, table, scroller, headCells } = tableParts(root);
  const body = table.tBodies[0]?.rows[0]?.cells;
  if (!body?.[3] || !body[4]) {
    throw new Error("本文の行が無い");
  }
  const nameWidth = expectedWidth(body[3], wide(6));
  const stepWidth = expectedWidth(body[4], wide(10));
  // 実行
  const handle = attachAutoColumnWidths(table, {
    wrapper,
    scroller,
    headCells,
    longColumnMin: 45,
  });
  detachers.push(handle.detach);
  // 検証
  await vi.waitFor(() => {
    expect(table.hasAttribute("data-auto-width")).toBe(true);
  });
  const widths = headCells.map((cell) => autoWidthOf(cell));
  expect(widths.every((width) => width > 0)).toBe(true);
  // 長文でない列は最も長い行の幅（手順の列は 3 行のうち最も長い行）
  expect(widths[3]).toBe(nameWidth);
  expect(widths[4]).toBe(stepWidth);
  // 説明の列は 45em 以上で、表の幅は見える幅から枠線と列の数の 1px を引いた幅以下
  expect(widths[5]).toBeGreaterThanOrEqual(45 * 14);
  const tableWidth = Number.parseFloat(
    table.style.getPropertyValue("--mdmark-auto-table-width"),
  );
  expect(tableWidth).toBeLessThanOrEqual(
    scroller.clientWidth -
      (table.offsetWidth - table.clientWidth) -
      headCells.length,
  );
});

// 包む要素の幅が変わったときだけ決め直し、つまみで変えた列の幅を保つ（正常系）
test("test_attach_auto_column_widths_when_resized_container", async () => {
  // 準備
  addStyles();
  const { attachAutoColumnWidths } = await loadTableWidth();
  const { root } = createRoot(CONTENT_TABLE);
  setRootWidth(root, 1280);
  const { wrapper, table, scroller, headCells } = tableParts(root);
  const onApply = vi.fn();
  const handle = attachAutoColumnWidths(table, {
    wrapper,
    scroller,
    headCells,
    longColumnMin: 45,
    onApply,
  });
  detachers.push(handle.detach);
  await vi.waitFor(() => {
    expect(table.hasAttribute("data-auto-width")).toBe(true);
  });
  const [first] = headCells;
  if (!first) {
    throw new Error("見出しのセルが無い");
  }
  // 実行: 1 列目をつまみで変えた状態にして決め直す
  first.classList.add("is-resized");
  first.style.width = "200px";
  handle.refresh();
  // 検証
  expect(first.style.getPropertyValue("--mdmark-auto-width")).toBe("");
  const sum = headCells.reduce((total, cell) => total + cell.offsetWidth, 0);
  expect(
    Number.parseFloat(
      table.style.getPropertyValue("--mdmark-auto-table-width"),
    ),
  ).toBeCloseTo(sum, -1);
  // 実行: 高さだけを変える
  onApply.mockClear();
  scroller.style.minHeight = "900px";
  await nextFrames();
  // 検証: 決め直さない
  expect(onApply).not.toHaveBeenCalled();
  // 実行: 幅を 900px にする
  setRootWidth(root, 900);
  // 検証: 決め直し、説明の列が 45em になる
  await vi.waitFor(() => {
    expect(onApply).toHaveBeenCalled();
  });
  expect(autoWidthOf(headCells[5])).toBeCloseTo(45 * 14, 0);
});

// 列の表示を切り替えても、表示している列の幅を変えない（正常系）
test("test_attach_auto_column_widths_when_columns_toggled", async () => {
  // 準備
  addStyles();
  const { attachAutoColumnWidths } = await loadTableWidth();
  const { root } = createRoot(CONTENT_TABLE);
  setRootWidth(root, 1280);
  const { wrapper, table, scroller, headCells } = tableParts(root);
  const handle = attachAutoColumnWidths(table, {
    wrapper,
    scroller,
    headCells,
    longColumnMin: 45,
  });
  detachers.push(handle.detach);
  await vi.waitFor(() => {
    expect(table.hasAttribute("data-auto-width")).toBe(true);
  });
  const before = headCells.map((cell) => cell.offsetWidth);
  const stepWidth = autoWidthOf(headCells[4]);
  /** 手順の列の見出しとセルの `hidden` を切り替える */
  const setStepHidden = (hidden: boolean): void => {
    for (const row of table.rows) {
      const cell = row.cells[4];
      if (cell) {
        cell.hidden = hidden;
      }
    }
  };
  // 実行: 手順の列を隠す
  setStepHidden(true);
  handle.columnsChanged();
  // 検証: 残った列の幅は変わらず、表の幅は残った列の幅の合計
  const shown = [0, 1, 2, 3, 5];
  for (const column of shown) {
    expect(
      Math.abs((headCells[column]?.offsetWidth ?? 0) - (before[column] ?? 0)),
    ).toBeLessThanOrEqual(1);
  }
  expect(
    Number.parseFloat(
      table.style.getPropertyValue("--mdmark-auto-table-width"),
    ),
  ).toBe(
    shown.reduce((sum, column) => sum + autoWidthOf(headCells[column]), 0),
  );
  // 実行: 手順の列を出す
  setStepHidden(false);
  handle.columnsChanged();
  // 検証: 手順の列は隠す前の幅で、各列の幅は隠す前と同じ
  expect(autoWidthOf(headCells[4])).toBe(stepWidth);
  headCells.forEach((cell, column) => {
    expect(
      Math.abs(cell.offsetWidth - (before[column] ?? 0)),
    ).toBeLessThanOrEqual(1);
  });
});

// 幅が 0 の表は決めず、見えたときに決める（正常系）
test("test_attach_auto_column_widths_when_hidden", async () => {
  // 準備
  addStyles();
  const { attachAutoColumnWidths } = await loadTableWidth();
  const { root } = createRoot(CONTENT_TABLE);
  setRootWidth(root, 1280);
  const panel = document.createElement("div");
  panel.hidden = true;
  root.prepend(panel);
  const wrapperElement = root.querySelector<HTMLElement>(".mdmark-table");
  if (!wrapperElement) {
    throw new Error("表が無い");
  }
  panel.append(wrapperElement);
  const { wrapper, table, scroller, headCells } = tableParts(root);
  // 実行
  const handle = attachAutoColumnWidths(table, {
    wrapper,
    scroller,
    headCells,
    longColumnMin: 45,
  });
  detachers.push(handle.detach);
  // 検証: 付けた直後は決めない
  expect(table.hasAttribute("data-auto-width")).toBe(false);
  // 実行: 出す
  panel.hidden = false;
  // 検証: 開いた後に決める
  await vi.waitFor(() => {
    expect(table.hasAttribute("data-auto-width")).toBe(true);
  });
});

// 取り除く関数で変数と印を外す（正常系）
test("test_attach_auto_column_widths_when_detached", async () => {
  // 準備
  addStyles();
  const { attachAutoColumnWidths } = await loadTableWidth();
  const { root } = createRoot(CONTENT_TABLE);
  setRootWidth(root, 1280);
  const { wrapper, table, scroller, headCells } = tableParts(root);
  const onApply = vi.fn();
  const handle = attachAutoColumnWidths(table, {
    wrapper,
    scroller,
    headCells,
    longColumnMin: 45,
    onApply,
  });
  await vi.waitFor(() => {
    expect(table.hasAttribute("data-auto-width")).toBe(true);
  });
  // 実行
  handle.detach();
  onApply.mockClear();
  setRootWidth(root, 900);
  await nextFrames();
  // 検証
  expect(table.hasAttribute("data-auto-width")).toBe(false);
  expect(table.style.getPropertyValue("--mdmark-auto-table-width")).toBe("");
  expect(
    headCells.every(
      (cell) => cell.style.getPropertyValue("--mdmark-auto-width") === "",
    ),
  ).toBe(true);
  expect(onApply).not.toHaveBeenCalled();
});
