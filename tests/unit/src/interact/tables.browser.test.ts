import { afterEach, expect, test, vi } from "vitest";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";

/** 表の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTables = () => import("../../../../src/interact/tables.ts");

const detachers: Array<() => void> = [];

/** 名前と値の 3 行の data の表。`filter` を指定すると絞り込みの列を指定する */
function dataTable(options: { filter?: string; values: string[] }): string {
  const mark = options.filter
    ? `<!-- table: {"kind": "data", "columns": {"${options.filter}": {"filter": {}}}} -->`
    : '<!-- table: {"kind": "data"} -->';
  return [
    mark,
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    ...options.values.map((value, i) => `| ${"abc"[i]} | ${value} |`),
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 表の本文の行（詳細の行と通知の行を除く） */
function bodyRows(root: HTMLElement): HTMLTableRowElement[] {
  return [
    ...root.querySelectorAll<HTMLTableRowElement>(
      "tbody tr:not(.mdmark-row-detail):not(.mdmark-table-empty)",
    ),
  ];
}

/** 表の本文の行の指定した列の文字を、並んだ順に返却する */
function columnTexts(root: HTMLElement, column: number): string[] {
  return bodyRows(root).map((row) => row.cells[column]?.textContent ?? "");
}

/** 絞り込みのドロワーの中の、ラベルの文字に合う入力欄を返却する */
function findCheckbox(drawer: HTMLElement, text: string): HTMLInputElement {
  const label = [...drawer.querySelectorAll("label")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  const control = label?.control;
  if (!(control instanceof HTMLInputElement)) {
    throw new Error(`候補の入力欄が無い: ${text}`);
  }
  return control;
}

/** 絞り込みのボタンを押してドロワーを開き、ボタンとドロワーを返却する */
function openDrawer(root: HTMLElement): {
  button: HTMLButtonElement;
  drawer: HTMLElement;
} {
  const button = root.querySelector<HTMLButtonElement>("button.mdmark-filter");
  const drawer = root.querySelector<HTMLElement>(".mdmark-filter-drawer");
  if (!button || !drawer) {
    throw new Error("絞り込みのボタンかドロワーが無い");
  }
  button.click();
  return { button, drawer };
}

/** 表のコピーなどの処理を読み込む */
const loadLogic = () => import("../../../../src/table-logic.ts");

/** 表の絞り込みのボタンを押して開き、含む文字の欄に文字を入れる */
function inputFilterText(table: HTMLElement, text: string): void {
  table.querySelector<HTMLButtonElement>("button.mdmark-filter")?.click();
  const input = table.querySelector<HTMLInputElement>(
    ".mdmark-filter-drawer input",
  );
  if (!input) {
    throw new Error("含む文字の欄が無い");
  }
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** 表のその列の見出し・本文のセル・集計のセルを返却する */
function columnCells(root: HTMLElement, column: number): HTMLElement[] {
  const head = root.querySelectorAll<HTMLElement>("thead th")[column];
  const cells = bodyRows(root).map((row) => row.cells[column]);
  const total = root.querySelectorAll<HTMLElement>("tfoot td")[column];
  return [head, ...cells, ...(total ? [total] : [])];
}

/** 集計の行ごとに、セルの文字を空白を除いてつないだものを、行の順に返却する */
function totalRowTexts(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLTableRowElement>("tfoot tr")].map(
    (row) =>
      [...row.cells]
        .map((cell) => (cell.textContent ?? "").replace(/\s+/g, ""))
        .join(""),
  );
}

/** 集計の行ごとに、セルの文字を空白を除いて返却する */
function totalRowCells(root: HTMLElement): string[][] {
  return [...root.querySelectorAll<HTMLTableRowElement>("tfoot tr")].map(
    (row) => [...row.cells].map((cell) => (cell.textContent ?? "").trim()),
  );
}

/** `+copy` の data の表（名前 `a`・`b`・`c`、値は指定した順） */
function dataTableWithCopy(values: string[]): string {
  return [
    '<!-- table: {"kind": "data", "features": {"copy": {}}} -->',
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    ...values.map((value, i) => `| ${"abc"[i]} | ${value} |`),
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 件数の要素の文字を返却する */
function countText(root: HTMLElement): string {
  return root.querySelector(".mdmark-table-count")?.textContent ?? "";
}

/** 描いた要素から、クラスで探したボタンを返却する（無ければ例外） */
function findButton(root: HTMLElement, selector: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(selector);
  if (!button) {
    throw new Error(`ボタンが無い: ${selector}`);
  }
  return button;
}

/** 要素の中のセレクタに合う要素を返却する（無ければ例外） */
function findButtonLike(parent: HTMLElement, selector: string): HTMLElement {
  const element = parent.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`要素が無い: ${selector}`);
  }
  return element;
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
  vi.useRealTimers();
  restoreClipboard();
  history.replaceState(null, "", location.pathname);
});

// 数値は数の大きさで比べる（正常系）
test("test_compare_cells", async () => {
  // 準備
  const { compareCells } = await loadTables();
  // 実行・検証
  expect(compareCells("10", "2")).toBeGreaterThan(0);
  expect(compareCells("1,022", "227")).toBeGreaterThan(0);
});

// 文字は辞書の順で比べる（正常系）
test("test_compare_cells_when_text", async () => {
  // 準備
  const { compareCells } = await loadTables();
  // 実行・検証
  expect(compareCells("みかん", "りんご")).toBeLessThan(0);
});

// 3 種類を判定する（正常系）
test("test_matches_filter", async () => {
  // 準備
  const { matchesFilter } = await loadTables();
  const select = { column: 0, values: ["りんご"] };
  const text = { column: 0, text: "描画" };
  const date = { column: 0, from: "2026-10-05", to: "2026-10-15" };
  // 実行・検証
  expect(matchesFilter("りんご", "select", select)).toBe(true);
  expect(matchesFilter("りんご飴", "select", select)).toBe(false);
  expect(matchesFilter("描画を速くする", "text", text)).toBe(true);
  expect(matchesFilter("2026-10-10", "date", date)).toBe(true);
  expect(matchesFilter("2026-10-20", "date", date)).toBe(false);
});

// 開始日だけのときはその日以降に合う（正常系）
test("test_matches_filter_when_open_range", async () => {
  // 準備
  const { matchesFilter } = await loadTables();
  const date = { column: 0, from: "2026-10-10" };
  // 実行・検証
  expect(matchesFilter("2026-10-01", "date", date)).toBe(false);
  expect(matchesFilter("2026-10-10", "date", date)).toBe(true);
});

// 空のセルを除いて合計・平均し、空でないセルを数える（正常系）
test("test_compute_total", async () => {
  // 準備
  const { computeTotal } = await loadLogic();
  // 実行
  const sum = computeTotal(["10", "2", "33", ""], "sum");
  const avg = computeTotal(["100", "", "400"], "avg");
  const count = computeTotal(["りんご", "", "ぶどう"], "count");
  // 検証
  expect(sum).toBe("45");
  expect(avg).toBe("250");
  expect(count).toBe("2");
});

// 桁区切りを付け、小数を 2 桁までに丸める（正常系）
test("test_compute_total_when_rounded", async () => {
  // 準備
  const { computeTotal } = await loadLogic();
  // 実行
  const sum = computeTotal(["1,000", "2,001"], "sum");
  const avg = computeTotal(["1", "2", "2"], "avg");
  // 検証
  expect(sum).toBe("3,001");
  expect(avg).toBe("1.67");
});

// 行が無いとき（正常系）
test("test_compute_total_when_empty", async () => {
  // 準備
  const { computeTotal } = await loadLogic();
  // 実行
  const sum = computeTotal([], "sum");
  const avg = computeTotal([], "avg");
  const count = computeTotal([], "count");
  // 検証
  expect(sum).toBe("0");
  expect(avg).toBe("—");
  expect(count).toBe("0");
});

// セルをタブで、行を改行で区切る（正常系）
test("test_table_to_tsv", async () => {
  // 準備
  const { tableToTsv } = await loadLogic();
  // 実行
  const tsv = tableToTsv([
    ["名前", "更新日"],
    ["りんご", "2026-10-01"],
    ["りんご飴", "2026-10-20"],
  ]);
  // 検証
  expect(tsv).toBe("名前\t更新日\nりんご\t2026-10-01\nりんご飴\t2026-10-20");
});

// セルの中のタブと改行を空白にする（正常系）
test("test_table_to_tsv_when_cell_has_tab", async () => {
  // 準備
  const { tableToTsv } = await loadLogic();
  // 実行
  const tsv = tableToTsv([["a\tb", "c\nd"]]);
  // 検証
  expect(tsv).toBe("a b\tc d");
});

// 桁区切りと小数と負の数を読み込み、空と読み込めない文字を読み込まない（正常系）
test("test_parse_number_cell", async () => {
  // 準備
  const { parseNumberCell } = await loadLogic();
  // 実行
  const result = ["1,000", " 2.5 ", "-3", "", "-", "約 3"].map((text) =>
    parseNumberCell(text),
  );
  // 検証
  expect(result).toEqual([1000, 2.5, -3, undefined, undefined, undefined]);
});

// sum・avg の列の読み込めない値を重なりを除いて返却し、count と空のセルは数えない（正常系）
test("test_find_unreadable_totals", async () => {
  // 準備
  const { findUnreadableTotals } = await loadLogic();
  const rows = [
    ["a", "10", "x"],
    ["b", "-", "1"],
    ["c", "", "2"],
    ["d", "-", "3"],
  ];
  const totals = [
    { column: 1, calc: "sum" },
    { column: 1, calc: "avg" },
    { column: 1, calc: "count" },
    { column: 2, calc: "sum" },
    { column: 0, calc: "count" },
  ] as const;
  // 実行
  const result = findUnreadableTotals({ rows, totals: [...totals] });
  // 検証
  expect(result).toEqual([
    { column: 1, calc: "sum", values: ["-"] },
    { column: 1, calc: "avg", values: ["-"] },
    { column: 2, calc: "sum", values: ["x"] },
  ]);
});

// 全て読み込めれば空を返却する（正常系）
test("test_find_unreadable_totals_when_all_readable", async () => {
  // 準備
  const { findUnreadableTotals } = await loadLogic();
  // 実行
  const result = findUnreadableTotals({
    rows: [["1,000"], [""]],
    totals: [{ column: 0, calc: "sum" }],
  });
  // 検証
  expect(result).toEqual([]);
});

// 見出しの行・区切りの行・本文の行を並べ、セルの縦線と改行を替える（正常系）
test("test_table_to_markdown", async () => {
  // 準備
  const { tableToMarkdown } = await loadLogic();
  // 実行
  const markdown = tableToMarkdown([
    ["名前", "式"],
    ["a", "x | y"],
    ["b", "1\n2"],
  ]);
  // 検証
  expect(markdown).toBe(
    "| 名前 | 式 |\n| --- | --- |\n| a | x \\| y |\n| b | 1 2 |",
  );
});

// 数値・日付・✓・空だけを短い値にする（正常系）
test("test_is_compact_cell_text", async () => {
  // 準備
  const { isCompactCellText } = await loadLogic();
  const texts = [
    "",
    "1,234",
    "12.5%",
    "2026-11-01",
    "2026/1/2",
    "✓",
    "りんご",
    "v1.0 を出す",
  ];
  // 実行
  const result = texts.map((text) => isCompactCellText(text));
  // 検証
  expect(result).toEqual([true, true, true, true, true, true, false, false]);
});

/** 全角の文字を指定した数だけ並べる */
const wide = (count: number): string => "あ".repeat(count);

// 20 文字以上の行を持つ文の列だけを長文の列にする（正常系）
test("test_find_long_columns", async () => {
  // 準備
  const { findLongColumns } = await loadLogic();
  const columns = [
    {
      head: ["No"],
      cells: [
        { lines: ["1"], compact: true },
        { lines: ["2"], compact: true },
      ],
    },
    { head: ["名前"], cells: [{ lines: [wide(6)], compact: false }] },
    {
      head: ["手順"],
      cells: [{ lines: [wide(10), wide(10), wide(10)], compact: false }],
    },
    {
      head: ["説明"],
      cells: [
        { lines: [wide(20)], compact: false },
        { lines: [wide(19)], compact: false },
      ],
    },
    {
      head: ["更新日"],
      cells: [{ lines: ["12345678901234567890"], compact: true }],
    },
  ];
  // 実行
  const result = findLongColumns(columns);
  // 検証: 列 4 は全てのセルが短い値のため長文の列にしない
  expect(result).toEqual([3]);
});

// 見出しだけが 20 文字以上の列も長文の列にする（正常系）
test("test_find_long_columns_when_head", async () => {
  // 準備
  const { findLongColumns } = await loadLogic();
  // 実行
  const result = findLongColumns([
    { head: [wide(20)], cells: [{ lines: [wide(2)], compact: false }] },
  ]);
  // 検証
  expect(result).toEqual([0]);
});

// 長文の列は text、ほかは select（正常系）
test("test_default_filter_kind", async () => {
  // 準備
  const { defaultFilterKind } = await loadLogic();
  // 実行
  const result = [defaultFilterKind(true), defaultFilterKind(false)];
  // 検証
  expect(result).toEqual(["text", "select"]);
});

/** `columnBounds` の結果を `{wraps, min, wanted}` の並びの配列にする */
const boundsOf = (result: {
  wraps: boolean;
  min: number;
  wanted: number;
}): [boolean, number, number] => [result.wraps, result.min, result.wanted];

// 折り返さない列・長文の列・幅の範囲の列の最小の幅と望む幅（正常系）
test("test_column_bounds", async () => {
  // 準備
  const { columnBounds } = await loadLogic();
  const base = {
    nowrap: false,
    long: false,
    longest: 0,
    longestWord: 0,
    em: 14,
    longColumnMin: 45,
  };
  // 実行
  const result = [
    { ...base, longest: 80 },
    { ...base, long: true, longest: 1700, longestWord: 60 },
    { ...base, long: true, longest: 323 },
    { ...base, long: true, longest: 1700, longestWord: 700 },
    { ...base, nowrap: true, long: true, longest: 1700 },
  ].map((options) => boundsOf(columnBounds(options)));
  // 検証
  expect(result).toEqual([
    [false, 80, 80],
    [true, 630, 1700],
    [true, 323, 323],
    [true, 700, 1700],
    [false, 1700, 1700],
  ]);
});

// width.min・width.max で最小の幅と望む幅を決め、最小の幅は最大の幅を超えない（正常系）
test("test_column_bounds_when_range", async () => {
  // 準備
  const { columnBounds } = await loadLogic();
  const base = {
    nowrap: false,
    long: false,
    longest: 0,
    longestWord: 0,
    em: 14,
    longColumnMin: 45,
  };
  // 実行
  const result = [
    { ...base, range: { min: 20, max: 30 }, longest: 2800 },
    { ...base, range: { max: 12 }, long: true, longest: 1120 },
    { ...base, range: { min: 30, max: 20 }, longest: 2800 },
    { ...base, range: { min: 10 }, longest: 60 },
  ].map((options) => boundsOf(columnBounds(options)));
  // 検証
  expect(result).toEqual([
    [true, 280, 420],
    [true, 168, 168],
    [true, 280, 280],
    [true, 140, 140],
  ]);
});

/** `distributeColumnWidths` に渡す列の並びを `[wraps, min, wanted]` から作る */
const columnsOf = (
  values: Array<[boolean, number, number]>,
): Array<{ wraps: boolean; min: number; wanted: number }> =>
  values.map(([wraps, min, wanted]) => ({ wraps, min, wanted }));

// 収まる・分ける・最小の幅で止めて分け直す・はみ出す（正常系）
test("test_distribute_column_widths", async () => {
  // 準備
  const { distributeColumnWidths } = await loadLogic();
  // 実行
  const result = [
    distributeColumnWidths(
      columnsOf([
        [false, 80, 80],
        [true, 323, 323],
      ]),
      1000,
    ),
    distributeColumnWidths(
      columnsOf([
        [false, 388, 388],
        [true, 630, 1700],
      ]),
      1145,
    ),
    distributeColumnWidths(
      columnsOf([
        [false, 67, 67],
        [true, 630, 1700],
        [true, 323, 323],
      ]),
      1145,
    ),
    distributeColumnWidths(
      columnsOf([
        [false, 67, 67],
        [true, 630, 1700],
        [true, 630, 1100],
      ]),
      390,
    ),
  ];
  // 検証
  expect(result).toEqual([
    { widths: [80, 323], overflow: false },
    { widths: [388, 757], overflow: false },
    { widths: [67, 755, 323], overflow: false },
    { widths: [67, 630, 630], overflow: true },
  ]);
});

// 読者が幅を変えた列は分けずにその幅のまま残す（正常系）
test("test_distribute_column_widths_when_fixed", async () => {
  // 準備
  const { distributeColumnWidths } = await loadLogic();
  // 実行
  const result = distributeColumnWidths(
    [
      { wraps: false, min: 118, wanted: 118, fixed: true },
      { wraps: true, min: 630, wanted: 1700 },
    ],
    1145,
  );
  // 検証
  expect(result).toEqual({ widths: [118, 1027], overflow: false });
});

/** 画面に収まる表の位置（上端 0・下端 800 の画面で、本文の 140〜500） */
const FITTING = {
  headTop: 100,
  headBottom: 140,
  bodyTop: 140,
  bodyBottom: 500,
  footTop: 500,
  footBottom: 540,
};

/** 画面の上へ流れた表の位置（本文は -260〜1200） */
const SCROLLED = {
  headTop: -300,
  headBottom: -260,
  bodyTop: -260,
  bodyBottom: 1200,
  footTop: 1200,
  footBottom: 1240,
};

// 表が画面に収まるときはずらさず、上へ流れたときは見出し行を下げ、集計の行を上げる（正常系）
test("test_sticky_shift", async () => {
  // 準備
  const { stickyShift } = await loadLogic();
  const screen = { stickyTop: 0, viewportBottom: 800 };
  // 実行
  const fitting = stickyShift({ ...screen, ...FITTING });
  const scrolled = stickyShift({ ...screen, ...SCROLLED });
  // 検証
  expect(fitting).toEqual({ head: 0, foot: 0 });
  expect(scrolled).toEqual({ head: 300, foot: -440 });
});

// 見出し行は本文の下端を、集計の行は本文の上端を越えない（正常系）
test("test_sticky_shift_when_at_edge", async () => {
  // 準備
  const { stickyShift } = await loadLogic();
  const screen = { stickyTop: 0, viewportBottom: 800 };
  // 実行
  const scrolledOut = stickyShift({
    ...screen,
    headTop: -2000,
    headBottom: -1960,
    bodyTop: -1960,
    bodyBottom: 20,
    footTop: 20,
    footBottom: 60,
  });
  const atBottom = stickyShift({
    ...screen,
    headTop: 760,
    headBottom: 800,
    bodyTop: 800,
    bodyBottom: 840,
    footTop: 840,
    footBottom: 880,
  });
  // 検証
  expect(scrolledOut).toEqual({ head: 1980, foot: 0 });
  expect(atBottom).toEqual({ head: 0, foot: -40 });
});

// 集計の行が無ければ foot は 0（正常系）
test("test_sticky_shift_when_no_foot", async () => {
  // 準備
  const { stickyShift } = await loadLogic();
  const { footTop: _footTop, footBottom: _footBottom, ...noFoot } = SCROLLED;
  // 実行
  const result = stickyShift({ stickyTop: 0, viewportBottom: 800, ...noFoot });
  // 検証
  expect(result).toEqual({ head: 300, foot: 0 });
});

// 見出し行と集計の行が動ける範囲を返却する（正常系）
test("test_sticky_range", async () => {
  // 準備
  const { stickyRange } = await loadLogic();
  const table = {
    tableTop: 0,
    tableBottom: 1242,
    headTop: 1,
    headBottom: 41,
    bodyTop: 41,
    bodyBottom: 1201,
  };
  // 実行
  const withFoot = stickyRange({ ...table, footTop: 1201, footBottom: 1241 });
  const withoutFoot = stickyRange(table);
  // 検証
  expect(withFoot).toEqual({
    headStart: 1,
    headMax: 1160,
    footMax: 1160,
    footEnd: 1,
  });
  expect(withoutFoot).toEqual({
    headStart: 1,
    headMax: 1160,
    footMax: 0,
    footEnd: 0,
  });
});

// 最後の # の後ろを戻した文字を返却する（正常系）
test("test_row_id_from_hash", async () => {
  // 準備
  const { rowIdFromHash } = await loadLogic();
  // 実行
  const ids = [
    "#%E3%81%BF%E3%81%8B%E3%82%93",
    "#/a.md#%E3%81%BF%E3%81%8B%E3%82%93",
    "#%E3%81",
    "",
  ].map((hash) => rowIdFromHash(hash));
  // 検証
  expect(ids).toEqual(["みかん", "みかん", "%E3%81", ""]);
});

// 3 回の押下で降順・昇順・元の並びになる（正常系）
test("test_attach_tables_when_sorted", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(dataTable({ values: ["10", "2", "33"] }));
  detachers.push(attachTables(root));
  const header = root.querySelectorAll("thead th")[1];
  const button = header?.querySelector<HTMLButtonElement>("button.mdmark-sort");
  // 実行・検証
  button?.click();
  expect(columnTexts(root, 1)).toEqual(["33", "10", "2"]);
  expect(header?.getAttribute("aria-sort")).toBe("descending");
  button?.click();
  expect(columnTexts(root, 1)).toEqual(["2", "10", "33"]);
  expect(header?.getAttribute("aria-sort")).toBe("ascending");
  button?.click();
  expect(columnTexts(root, 1)).toEqual(["10", "2", "33"]);
  expect(header?.hasAttribute("aria-sort")).toBe(false);
});

// ドロワーで絞って除外し、外の押下で閉じる（正常系）
test("test_attach_tables_when_filtered", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {}}}} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 1 |",
      "| みかん | 2 |",
      "| ぶどう | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachTables(root));
  // 実行・検証: ボタンを押してドロワーを開く
  const { drawer } = openDrawer(root);
  expect(drawer.hasAttribute("hidden")).toBe(false);
  expect(document.activeElement).toBe(drawer.querySelector("input"));
  // 実行・検証: 候補を選ぶ
  findCheckbox(drawer, "りんご").click();
  expect(bodyRows(root).filter((row) => !row.hidden)).toHaveLength(1);
  // 実行・検証: 絞り込みを解除
  const clear = [...drawer.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("絞り込みを解除"),
  );
  clear?.click();
  expect(bodyRows(root).filter((row) => !row.hidden)).toHaveLength(3);
  expect(drawer.hasAttribute("hidden")).toBe(false);
  // 実行・検証: 表の外を押す
  document.body.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(drawer.hasAttribute("hidden")).toBe(true);
});

// Esc で閉じてボタンへフォーカスを戻す（正常系）
test("test_attach_tables_when_escape", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    dataTable({ filter: "名前", values: ["1", "2", "3"] }),
  );
  detachers.push(attachTables(root));
  const { button, drawer } = openDrawer(root);
  // 実行
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  // 検証
  expect(drawer.hasAttribute("hidden")).toBe(true);
  expect(document.activeElement).toBe(button);
});

/** 表の本文の最初の行のセルが `position: sticky` かを、列の順に返却する */
function stickyColumns(table: HTMLElement): boolean[] {
  const row = table.querySelector<HTMLTableRowElement>("tbody tr");
  return [...(row?.cells ?? [])].map(
    (cell) => getComputedStyle(cell).position === "sticky",
  );
}

/** `count` 列の表の Markdown。`mark` を指定すると表のマーカーで囲む */
function wideTable(count: number, mark?: string): string[] {
  const headers = Array.from(
    { length: count },
    (_, i) => `とても長い列の名前${i + 1}`,
  );
  const table = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    `| ${headers.map((_, i) => `値${i + 1}`).join(" | ")} |`,
    "",
  ];
  return mark ? [mark, "", ...table, "<!-- /table -->", ""] : table;
}

// はみ出す表だけピン止めのボタンを出して先頭の列を既定で留め、押した列だけを留める（正常系）
test("test_attach_tables_when_pinned", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [...wideTable(10), "| 列A | 列B |", "| --- | --- |", "| 1 | 2 |", ""].join(
      "\n",
    ),
  );
  root.style.width = "320px";
  detachers.push(attachTables(root));
  const [wide, narrow] = [
    ...root.querySelectorAll<HTMLElement>(".mdmark-table"),
  ];
  const widePins =
    wide.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  const narrowPins =
    narrow.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  // 検証: はみ出す表にだけボタンが出て、先頭の列が留まる
  await vi.waitFor(() => {
    expect(widePins[1].hasAttribute("hidden")).toBe(false);
  });
  for (const pin of narrowPins) {
    expect(pin.hasAttribute("hidden")).toBe(true);
  }
  expect(stickyColumns(wide).slice(0, 3)).toEqual([true, false, false]);
  expect(widePins[0].getAttribute("aria-pressed")).toBe("true");
  expect(stickyColumns(narrow)).toEqual([false, false]);
  // 実行・検証: 3 列目のボタンで 3 列目だけを加えて留める
  widePins[2].click();
  expect(stickyColumns(wide).slice(0, 4)).toEqual([true, false, true, false]);
  const firstCell =
    wide.querySelector<HTMLTableRowElement>("tbody tr")?.cells[0];
  const thirdCell =
    wide.querySelector<HTMLTableRowElement>("tbody tr")?.cells[2];
  expect(thirdCell?.style.left).toBe(`${firstCell?.offsetWidth}px`);
  // 実行・検証: もう一度押すと 3 列目だけを解除する
  widePins[2].click();
  expect(stickyColumns(wide).slice(0, 4)).toEqual([true, false, false, false]);
});

// data-pin の列だけを留め、pin の無い表は留めず、幅が広がると留めを解除する（正常系）
test("test_attach_tables_when_pin_specified", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      ...wideTable(
        8,
        '<!-- table: {"kind": "data", "columns": {"とても長い列の名前2": {"pinned": true}}} -->',
      ),
      ...wideTable(10, '<!-- table: {"kind": "plain"} -->'),
    ].join("\n"),
  );
  root.style.width = "320px";
  detachers.push(attachTables(root));
  const [pinned, plain] = [
    ...root.querySelectorAll<HTMLElement>(".mdmark-table"),
  ];
  const pins = pinned.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  // 検証: data-pin の列だけが留まる
  await vi.waitFor(() => {
    expect(stickyColumns(pinned).slice(0, 3)).toEqual([false, true, false]);
  });
  expect(pins[0].getAttribute("aria-pressed")).toBe("false");
  expect(pins[1].getAttribute("aria-pressed")).toBe("true");
  expect(plain.querySelector("button.mdmark-pin")).toBeNull();
  expect(stickyColumns(plain).some(Boolean)).toBe(false);
  // 実行・検証: 幅が広がると留めを解除する
  root.style.width = "2000px";
  await vi.waitFor(() => {
    expect(stickyColumns(pinned).some(Boolean)).toBe(false);
  });
});

// 真偽値の列を data-value の値で並べ替え・絞り込み・コピーする（正常系）
test("test_attach_tables_when_check_column", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "features": {"copy": {}}, "columns": {"必須": {"format": {"type": "check"}, "filter": {}}}} -->',
      "",
      "| 名前 | 必須 |",
      "| --- | --- |",
      "| a | true |",
      "| b | false |",
      "| c | true |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachTables(root));
  // 実行・検証: 必須の列を降順に並べる
  root
    .querySelectorAll("thead th")[1]
    ?.querySelector<HTMLButtonElement>("button.mdmark-sort")
    ?.click();
  expect(columnTexts(root, 0)).toEqual(["a", "c", "b"]);
  // 実行・検証: 絞り込みの候補と、true に絞る
  const { drawer } = openDrawer(root);
  const candidates = [...drawer.querySelectorAll<HTMLInputElement>("li input")];
  expect(candidates.map((input) => input.value).sort()).toEqual([
    "false",
    "true",
  ]);
  findCheckbox(drawer, "true").click();
  const shown = bodyRows(root).filter((row) => !row.hidden);
  expect(shown.map((row) => row.cells[0]?.textContent)).toEqual(["a", "c"]);
  // 実行・検証: TSV でコピーする
  findButton(root, "button.mdmark-copy").click();
  findButton(root, 'button.mdmark-copy-format[data-format="tsv"]').click();
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  expect(writeText).toHaveBeenCalledWith("名前\t必須\na\ttrue\nc\ttrue");
});

// 削除すると document の受け取りが残らない（正常系）
test("test_attach_tables_when_detached", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    dataTable({ filter: "名前", values: ["1", "2", "3"] }),
  );
  const detach = attachTables(root);
  openDrawer(root);
  const removeSpy = vi.spyOn(document, "removeEventListener");
  // 実行
  detach();
  // 検証
  const types = removeSpy.mock.calls.map(([type]) => type);
  expect(types).toContain("pointerdown");
  expect(types).toContain("keydown");
});

// セルに用語の下線があっても、絞り込みの値の候補と見出しのボタンの名前にツールチップの文字を含めない（正常系）
test("test_attach_tables_when_cell_has_term", async () => {
  // 準備
  const { mount } = await import("../../../../src/mount.ts");
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {}}}} -->',
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| マーカー | 1 |",
    "| 表 | 2 |",
    "",
    "<!-- /table -->",
    "",
    '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}} -->',
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| マーカー | HTML コメントで記載する指定 |",
    "| 名前 | 見出しの文字 |",
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
  const root = document.createElement("div");
  document.body.append(root);
  // 実行
  const handle = mount(root, { markdown });
  // 検証
  try {
    const { drawer } = openDrawer(root);
    const candidates = [...drawer.querySelectorAll("label")]
      .filter(
        (label) =>
          label.control instanceof HTMLInputElement &&
          label.control.type === "checkbox",
      )
      .map((label) => label.textContent);
    expect(candidates).toEqual(["マーカー", "表"]);
    const buttons = [
      ...root.querySelectorAll<HTMLElement>("thead th button.mdmark-filter"),
    ];
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "「名前」で絞り込む",
    ]);
    expect(root.querySelector("tbody td .mdmark-term")?.textContent).toBe(
      "マーカー",
    );
  } finally {
    handle.destroy();
    root.remove();
  }
});

// 絞り込みに合わせて件数と計算ごとの集計の行を再作成する（正常系）
test("test_attach_tables_when_counted", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "features": {"count": {}}, "columns": {"名前": {"filter": {"type": "text"}, "total": [{"calc": "count"}]}, "数量": {"total": [{"calc": "sum"}]}, "単価": {"total": [{"calc": "avg"}]}}} -->',
      "",
      "| 名前 | 数量 | 単価 |",
      "| --- | --- | --- |",
      "| りんご | 10 | 100 |",
      "| みかん | 2 | 200 |",
      "| りんご飴 | 33 | 300 |",
      "| ぶどう |  | 400 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  // 実行・検証: 絞り込む前
  detachers.push(attachTables(root));
  expect(countText(root)).toContain("4 / 4 件");
  expect(totalRowTexts(root)).toEqual(["合計45", "平均250", "件数4"]);
  // 実行・検証: 「りんご」で絞り込む
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  if (!table) {
    throw new Error("表が無い");
  }
  inputFilterText(table, "りんご");
  expect(countText(root)).toContain("2 / 4 件");
  expect(totalRowTexts(root)).toEqual(["合計43", "平均200", "件数2"]);
  // 実行・検証: 一致する行が無い
  inputFilterText(table, "存在しない");
  expect(countText(root)).toContain("0 / 4 件");
  expect(totalRowTexts(root)).toEqual(["合計0", "平均—", "件数0"]);
});

// テーブル設定のパネルの目のアイコンで列を出し入れし、Esc でパネルを閉じる（正常系）
test("test_attach_tables_when_columns_toggled", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "columns": {"説明": {"hidden": true}, "数量": {"total": [{"calc": "sum"}]}}} -->',
      "",
      "| 名前 | 説明 | 数量 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 10 |",
      "| みかん | 印刷を修正する | 2 |",
      "| ぶどう | 描画の崩れを修正する | 33 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  // 実行・検証: 付けた直後は 2 列目だけが隠れている
  detachers.push(attachTables(root));
  for (const cell of columnCells(root, 1)) {
    expect(cell.hasAttribute("hidden")).toBe(true);
  }
  for (const cell of [...columnCells(root, 0), ...columnCells(root, 2)]) {
    expect(cell.hasAttribute("hidden")).toBe(false);
  }
  // 実行・検証: テーブル設定のパネルを開く
  const toggle = findButton(root, "button.mdmark-table-settings-toggle");
  toggle.click();
  const panel = root.querySelector<HTMLElement>(".mdmark-table-settings");
  const eyes = [
    ...(panel?.querySelectorAll<HTMLButtonElement>(
      "button.mdmark-table-settings-eye",
    ) ?? []),
  ];
  expect(panel?.hasAttribute("hidden")).toBe(false);
  expect(eyes).toHaveLength(3);
  expect(eyes[0].disabled).toBe(true);
  expect(document.activeElement).toBe(eyes[1]);
  // 実行・検証: 目のアイコンで 2 列目を表示して 3 列目を隠す
  eyes[1].click();
  eyes[2].click();
  for (const cell of [...columnCells(root, 0), ...columnCells(root, 1)]) {
    expect(cell.hasAttribute("hidden")).toBe(false);
  }
  for (const cell of columnCells(root, 2)) {
    expect(cell.hasAttribute("hidden")).toBe(true);
  }
  // 実行・検証: Esc でパネルを閉じてボタンへフォーカスを戻す
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(panel?.hasAttribute("hidden")).toBe(true);
  expect(document.activeElement).toBe(toggle);
});

/** `表をコピー` を押してコピーの形式のメニューを開き、形式のボタンを押す */
function chooseCopyFormat(root: HTMLElement, format: "markdown" | "tsv"): void {
  findButton(root, "button.mdmark-copy").click();
  findButton(
    root,
    `button.mdmark-copy-format[data-format="${format}"]`,
  ).click();
}

/** 帯のスクリーンリーダー向けの要素の文字を返却する */
function statusText(root: HTMLElement): string {
  return root.querySelector(".mdmark-table-status")?.textContent ?? "";
}

// 形式のメニューで TSV を選び、表示している行と列をコピーして 2 秒でボタンを戻す（正常系）
test("test_attach_tables_when_copied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "features": {"copy": {}}, "columns": {"説明": {"hidden": true}, "名前": {"filter": {"type": "text"}}}} -->',
      "",
      "| 名前 | 説明 | 更新日 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 2026-10-01 |",
      "| みかん | 印刷を修正する | 2026-10-10 |",
      "| りんご飴 | 描画の崩れを修正する | 2026-10-20 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachTables(root));
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  if (!table) {
    throw new Error("表が無い");
  }
  inputFilterText(table, "りんご");
  const button = findButton(root, "button.mdmark-copy");
  const menu = root.querySelector<HTMLElement>(".mdmark-copy-menu");
  // 実行・検証: ボタンを押すと形式のメニューが開く
  button.click();
  expect(menu?.hasAttribute("hidden")).toBe(false);
  // 実行: TSV を選ぶ
  findButton(root, 'button.mdmark-copy-format[data-format="tsv"]').click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: メニューを閉じてフォーカスを戻し、コピーした中身と、コピーしたことの通知
  expect(menu?.hasAttribute("hidden")).toBe(true);
  expect(document.activeElement).toBe(button);
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith(
    "名前\t更新日\nりんご\t2026-10-01\nりんご飴\t2026-10-20",
  );
  expect(button.dataset.state).toBe("copied");
  expect(statusText(root)).toBe("TSVをコピーしました");
  // 実行・検証: 2 秒たつとボタンが戻る
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.dataset.state).toBe("idle");
});

// Markdown の表の形式で写す（正常系）
test("test_attach_tables_when_copied_markdown", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "features": {"copy": {}}} -->',
      "",
      "| 名前 | 式 |",
      "| --- | --- |",
      "| a | x \\| y |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachTables(root));
  // 実行
  chooseCopyFormat(root, "markdown");
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  // 検証
  expect(writeText).toHaveBeenCalledWith(
    "| 名前 | 式 |\n| --- | --- |\n| a | x \\| y |",
  );
  await vi.waitFor(() => {
    expect(statusText(root)).toBe("Markdown の表をコピーしました");
  });
});

// 並べ替えた表は、画面の並びで写す（正常系）
test("test_attach_tables_when_copied_after_sorted", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachTables } = await loadTables();
  const { root } = createRoot(dataTableWithCopy(["1", "3", "2"]));
  detachers.push(attachTables(root));
  const sortButton = root
    .querySelectorAll("thead th")[1]
    ?.querySelector<HTMLButtonElement>("button.mdmark-sort");
  // 実行: 値の列を降順に並べ替えてから TSV でコピーする
  sortButton?.click();
  chooseCopyFormat(root, "tsv");
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  // 検証
  expect(columnTexts(root, 1)).toEqual(["3", "2", "1"]);
  expect(writeText).toHaveBeenCalledWith("名前\t値\nb\t3\nc\t2\na\t1");
});

// 拒まれたら手動でコピーするパネルを出し、Esc で閉じる（正常系）
test("test_attach_tables_when_copy_denied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  stubClipboard(() =>
    Promise.reject(new DOMException("denied", "NotAllowedError")),
  );
  const rejections: PromiseRejectionEvent[] = [];
  const onRejection = (event: PromiseRejectionEvent): void => {
    rejections.push(event);
  };
  window.addEventListener("unhandledrejection", onRejection);
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "features": {"copy": {}}} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "| b | 2 |",
      "| c | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachTables(root));
  const button = findButton(root, "button.mdmark-copy");
  // 実行
  chooseCopyFormat(root, "markdown");
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 失敗が残り、2 秒たっても戻らず、帯の直後にパネルが出る
  try {
    expect(button.dataset.state).toBe("failed");
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.dataset.state).toBe("failed");
    const panel = root.querySelector<HTMLElement>(".mdmark-copy-panel");
    expect(panel).not.toBeNull();
    expect(root.querySelector(".mdmark-table-bar")?.nextElementSibling).toBe(
      panel,
    );
    // 検証: textarea にフォーカスがあり、中身が全て選ばれている
    const textarea = panel?.querySelector("textarea");
    expect(document.activeElement).toBe(textarea);
    expect(textarea?.selectionStart).toBe(0);
    expect(textarea?.selectionEnd).toBe(textarea?.value.length);
    expect(textarea?.value.startsWith("| 名前 | 値 |\n| --- | --- |")).toBe(
      true,
    );
    expect(statusText(root)).toBe(
      "クリップボードにコピーできませんでした。選択したMarkdown の表を手動でコピーできます",
    );
    // 検証: パネルの中の Esc で閉じてフォーカスを戻す
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(root.querySelector(".mdmark-copy-panel")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(rejections).toHaveLength(0);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

// #ID が指す行を開いて強調し、hashchange で移す（正常系）
test("test_attach_tables_when_row_linked", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "features": {"rowlink": {}}, "collapse": {"open": false}} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 1 |",
      "| みかん | 2 |",
      "| りんご飴 | 3 |",
      "",
      "<!-- /table -->",
      "",
      '<!-- table: {"kind": "data", "features": {"rowlink": {}}, "columns": {"名前": {"filter": {"type": "text"}}}} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| ぶどう | 1 |",
      "| もも | 2 |",
      "| なし | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  const [first, second] = [
    ...root.querySelectorAll<HTMLElement>(".mdmark-table"),
  ];
  const rowOf = (table: HTMLElement, id: string): HTMLElement => {
    const row = table.querySelector<HTMLElement>(`tr[id="${id}"]`);
    if (!row) {
      throw new Error(`行が無い: ${id}`);
    }
    return row;
  };
  const targets = (): string[] =>
    [...root.querySelectorAll<HTMLElement>("tr[data-target]")].map(
      (row) => row.id,
    );
  history.replaceState(null, "", "#みかん");
  // 実行・検証: #ID のまま付けると、閉じた表を開いて行を強調する
  detachers.push(attachTables(root));
  expect(first.querySelector("details")?.hasAttribute("open")).toBe(true);
  expect(targets()).toEqual(["みかん"]);
  // 実行・検証: 2 つ目の表を絞り込んで #ID を変えると、絞り込みを解除して行を強調する
  inputFilterText(second, "ぶどう");
  expect(rowOf(second, "もも").hasAttribute("hidden")).toBe(true);
  location.hash = "#もも";
  await vi.waitFor(() => {
    expect(targets()).toEqual(["もも"]);
  });
  for (const id of ["ぶどう", "もも", "なし"]) {
    expect(rowOf(second, id).hasAttribute("hidden")).toBe(false);
  }
  // 実行・検証: まとめた HTML の # の構造でも行を指す
  location.hash = "#/a.md#%E3%81%BF%E3%81%8B%E3%82%93";
  await vi.waitFor(() => {
    expect(targets()).toEqual(["みかん"]);
  });
});

// 数として読み込めないセルを持つ列の合計と平均は、絞り込んでも空のままにする（正常系）
test("test_attach_tables_when_totals_unreadable", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {"type": "text"}}, "数量": {"total": [{"calc": "sum"}, {"calc": "avg"}, {"calc": "count"}]}}} -->',
      "",
      "| 名前 | 数量 |",
      "| --- | --- |",
      "| りんご | 10 |",
      "| みかん | 約 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachTables(root));
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  if (!table) {
    throw new Error("表が無い");
  }
  // 実行・検証: 絞り込む前は合計と平均が空で、件数は空でないセルの数
  expect(totalRowCells(root)).toEqual([
    ["合計", ""],
    ["平均", ""],
    ["件数", "2"],
  ]);
  // 実行・検証: 読み込めないセルを隠す絞り込みの後も、合計と平均は空のまま
  inputFilterText(table, "りんご");
  expect(totalRowCells(root)).toEqual([
    ["合計", ""],
    ["平均", ""],
    ["件数", "1"],
  ]);
});

// 集計のメニューで計算の行を隠して出し、スクリーンリーダーで通知する（正常系）
test("test_attach_tables_when_totals_toggled", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}, {"calc": "avg"}]}}} -->',
      "",
      "| 名前 | 数量 |",
      "| --- | --- |",
      "| りんご | 10 |",
      "| みかん | 2 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachTables(root));
  const toggle = findButton(root, "button.mdmark-totals-toggle");
  const menu = root.querySelector<HTMLElement>(".mdmark-totals-menu");
  const avgRow = (): HTMLElement | null =>
    root.querySelector<HTMLElement>('tfoot tr[data-total-kind="avg"]');
  const checkbox = (calc: string): HTMLInputElement => {
    const input = menu?.querySelector<HTMLInputElement>(
      `input[value="${calc}"]`,
    );
    if (!input) {
      throw new Error(`チェックボックスが無い: ${calc}`);
    }
    return input;
  };
  // 実行・検証: メニューを開く
  toggle.click();
  expect(menu?.hasAttribute("hidden")).toBe(false);
  expect(document.activeElement).toBe(checkbox("sum"));
  // 実行・検証: 平均のチェックを解除すると平均の行が隠れる
  checkbox("avg").click();
  expect(avgRow()?.hasAttribute("hidden")).toBe(true);
  expect(toggle.classList.contains("is-active")).toBe(true);
  expect(toggle.textContent).toContain("（1 件を非表示にしています）");
  expect(statusText(root)).toBe("平均の行を隠しました");
  // 実行・検証: もう一度入れると戻る
  checkbox("avg").click();
  expect(avgRow()?.hasAttribute("hidden")).toBe(false);
  expect(statusText(root)).toBe("平均の行を出しました");
  // 実行・検証: Esc でメニューを閉じてボタンへフォーカスを戻す
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(menu?.hasAttribute("hidden")).toBe(true);
  expect(document.activeElement).toBe(toggle);
});

// 行へのリンクのマーカーを押すと行の絶対 URL をコピーし、通知を 2 秒出す（正常系）
test("test_attach_tables_when_row_link_copied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi
    .fn<(text: string) => Promise<void>>()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
  stubClipboard(writeText);
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "features": {"rowlink": {}}} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 1 |",
      "| みかん | 2 |",
      "",
      "<!-- /table -->",
      "",
      '<!-- table: {"kind": "data", "features": {"rowlink": {}}} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| ぶどう | 1 |",
      "| もも | 2 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachTables(root));
  const base = location.href.split("#")[0];
  const rowOf = (id: string): HTMLElement => {
    const row = root.querySelector<HTMLElement>(`tr[id="${id}"]`);
    if (!row) {
      throw new Error(`行が無い: ${id}`);
    }
    return row;
  };
  const noticeOf = (id: string): HTMLElement => {
    const notice = rowOf(id).querySelector<HTMLElement>(
      ".mdmark-row-link-notice",
    );
    if (!notice) {
      throw new Error(`通知の要素が無い: ${id}`);
    }
    return notice;
  };
  // 実行: 1 つ目の表の行のリンクを押す（記載できる）
  findButtonLike(rowOf("みかん"), "a.mdmark-row-anchor").click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 解決済みの絶対 URL をコピーし、通知を出す
  expect(writeText).toHaveBeenNthCalledWith(
    1,
    `${base}#${encodeURIComponent("みかん")}`,
  );
  expect(noticeOf("みかん").dataset.state).toBe("copied");
  expect(noticeOf("みかん").textContent).toBe("リンクをコピーしました");
  expect(rowOf("みかん").hasAttribute("data-target")).toBe(true);
  // 実行: 2 つ目の表の行のリンクを押す（拒まれる）
  findButtonLike(rowOf("もも"), "a.mdmark-row-anchor").click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 書き込めなかったことを通知し、行へは移る
  expect(noticeOf("もも").dataset.state).toBe("failed");
  expect(noticeOf("もも").textContent).toBe("リンクをコピーできませんでした");
  expect(rowOf("もも").hasAttribute("data-target")).toBe(true);
  // 実行・検証: 2 秒たつと通知が空になり、状態も削除される
  await vi.advanceTimersByTimeAsync(2000);
  for (const id of ["みかん", "もも"]) {
    expect(noticeOf(id).textContent).toBe("");
    expect(noticeOf(id).hasAttribute("data-state")).toBe(false);
  }
});

/** 390px の幅で 1 行に収まらない長文の説明を最終列に持つ、3 列 3 行の表 */
const FOLDABLE_TABLE = [
  "| 名前 | 状態 | 説明 |",
  "| --- | --- | --- |",
  "| りんご | 新規 | 描画を速くするために、見出しの ID を作る処理を 1 回にまとめる改善の説明 |",
  "| みかん | 進行 | 印刷で折り畳みを開き、リンクの URL を併記して紙に収める変更の説明 |",
  "| ぶどう | 完了 | 表の見出し行を画面の上端に留めて、縦に長い表を読み込みやすくする変更の説明 |",
  "",
].join("\n");

/** 描く先の要素の幅を決める */
function setRootWidth(root: HTMLElement, width: number): void {
  root.style.boxSizing = "border-box";
  root.style.width = `${width}px`;
}

/** 描画の更新を 2 回待つ（`ResizeObserver` の呼び出しが済むまで） */
function nextFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

// 行の詳細の中の表の要素を、親の表の操作が取得しない（正常系）
test("test_attach_tables_when_nested_table", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { attachSections } = await import(
    "../../../../src/interact/sections.ts"
  );
  const wideHeaders = Array.from(
    { length: 10 },
    (_, i) => `とても長い列の名前${i + 1}`,
  );
  const { root } = createRoot(
    [
      `<!-- table: {"kind": "data", "columns": {"${wideHeaders[0]}": {"filter": {}}}} -->`,
      "",
      `| ${wideHeaders.join(" | ")} |`,
      `| ${wideHeaders.map(() => "---").join(" | ")} |`,
      `| ${wideHeaders.map((_, i) => `値${i + 1}`).join(" | ")} |`,
      `| ${wideHeaders.map((_, i) => `別${i + 1}`).join(" | ")} |`,
      "",
      "<!-- /table -->",
      "",
      '<!-- row-detail: {"at": 1} -->',
      "",
      '<!-- table: {"kind": "data", "features": {"sort": {"enabled": false}}, "columns": {"引数": {"filter": {}}}} -->',
      "",
      "| 引数 | 値 |",
      "| --- | --- |",
      "| secret | 隠れた値 |",
      "",
      "<!-- /table -->",
      "",
      "<!-- /row-detail -->",
      "",
    ].join("\n"),
  );
  setRootWidth(root, 320);
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  detachers.push(attachTables(root));
  const parent = root.querySelector<HTMLElement>(".mdmark-table");
  const nested = parent?.querySelector<HTMLElement>(".mdmark-table");
  const parentHead = parent?.querySelector("table")?.tHead?.rows[0];
  if (!parent || !nested || !parentHead) {
    throw new Error("親の表か中の表が無い");
  }
  // 実行: 付けた後に描く先の要素の幅を変え、続けて親の表の囲みの幅だけを変えて、親の表の `ResizeObserver` にピン止めのボタンの表示を最後にもう一度決めせる
  setRootWidth(root, 300);
  await nextFrames();
  parent.style.width = "250px";
  await nextFrames();
  // 検証: 親の表のピン止めのボタンは出て、中の表のピン止めのボタンは隠れたまま
  const parentPins =
    parentHead.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  expect(parentPins).toHaveLength(10);
  for (const pin of parentPins) {
    expect(pin.hasAttribute("hidden")).toBe(false);
  }
  const nestedPins =
    nested.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  expect(nestedPins).toHaveLength(2);
  for (const pin of nestedPins) {
    expect(pin.hasAttribute("hidden")).toBe(true);
  }
  // 実行: 親の表の 1 列目の絞り込みのボタンを押す
  const button = parentHead.querySelector<HTMLButtonElement>(
    "button.mdmark-filter",
  );
  const controls = button?.getAttribute("aria-controls");
  if (!button || !controls) {
    throw new Error("親の表の絞り込みのボタンが無い");
  }
  button.click();
  // 検証: 開くのは親の表の 1 列目のドロワーだけで、値の候補に中の表のセルの文字が無い
  const drawer = document.getElementById(controls);
  expect(drawer?.hasAttribute("hidden")).toBe(false);
  expect(drawer?.textContent).toContain("値1");
  expect(drawer?.textContent).not.toContain("隠れた値");
  const nestedDrawers = nested.querySelectorAll<HTMLElement>(
    ".mdmark-filter-drawer",
  );
  expect(nestedDrawers).toHaveLength(1);
  expect(nestedDrawers[0].hasAttribute("hidden")).toBe(true);
  // 検証: 中の表の囲みに親の表のドロワーが配置されない
  expect(nested.querySelector(`[id="${controls}"]`)).toBeNull();
});

// 行の詳細の中の表の並べ替えのボタンを押しても、親の表を並べ替えない（正常系）
test("test_attach_tables_when_nested_table_sorted", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { attachSections } = await import(
    "../../../../src/interact/sections.ts"
  );
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "features": {"filter": {"enabled": false}}} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "| b | 2 |",
      "",
      "<!-- /table -->",
      "",
      '<!-- row-detail: {"at": 1} -->',
      "",
      '<!-- table: {"kind": "data", "features": {"filter": {"enabled": false}}} -->',
      "",
      "| 引数 | 値 |",
      "| --- | --- |",
      "| y | 1 |",
      "| x | 2 |",
      "",
      "<!-- /table -->",
      "",
      "<!-- /row-detail -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  detachers.push(attachTables(root));
  const parent = root.querySelector<HTMLElement>(".mdmark-table");
  const nested = parent?.querySelector<HTMLElement>(".mdmark-table");
  const parentTable = parent?.querySelector("table");
  const nestedHead = nested?.querySelector("th");
  if (!parentTable || !nested || !nestedHead) {
    throw new Error("親の表か中の表が無い");
  }
  // 実行: 中の表の 1 列目の並べ替えのボタンを押す
  findButtonLike(nestedHead, "button.mdmark-sort").click();
  // 検証: 中の表だけが降順になり、親の表の行の並びと見出しは変わらない
  expect(nestedHead.getAttribute("aria-sort")).toBe("descending");
  const parentRows = [...(parentTable.tBodies[0]?.rows ?? [])].filter(
    (row) => !row.classList.contains("mdmark-row-detail"),
  );
  expect(parentRows.map((row) => row.cells[0]?.textContent)).toEqual([
    "a",
    "b",
  ]);
  for (const cell of parentTable.tHead?.rows[0]?.cells ?? []) {
    expect(cell.hasAttribute("aria-sort")).toBe(false);
  }
});

/** 見出しが 2 行で、分類の列を `^^` で結合した表（数値は上から `3`・`1`・`4`・`2`） */
const MERGED_TABLE = [
  '<!-- table: {"kind": "data", "features": {"copy": {}}, "columns": {"分類": {"filter": {}}}, "header": {"rows": 2}} -->',
  "",
  "| 区分 | << |",
  "| --- | --- |",
  "| 分類 | 数値 |",
  "| A | 3 |",
  "| ^^ | 1 |",
  "| B | 4 |",
  "| ^^ | 2 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// 最下段の見出しにボタンを配置し、並べ替え・絞り込みの後にもう一度結合する（正常系）
test("test_attach_tables_when_merged_sorted", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachTables } = await loadTables();
  const { root } = createRoot(MERGED_TABLE);
  detachers.push(attachTables(root));
  const headRows = root.querySelectorAll<HTMLTableRowElement>("thead tr");
  const sortButton =
    headRows[1]?.cells[1]?.querySelector<HTMLButtonElement>(
      "button.mdmark-sort",
    );
  // 検証: ボタンは 2 行目の th にだけある
  expect(headRows[0]?.querySelector("button")).toBeNull();
  expect(sortButton).toBeTruthy();
  // 実行: 数値の列を降順に並べ替える
  sortButton?.click();
  // 検証: 隣り合う同じ値が無く、分類のセルを結合しない
  expect(columnTexts(root, 1)).toEqual(["4", "3", "2", "1"]);
  for (const cell of columnCells(root, 0).slice(1)) {
    expect(cell.hasAttribute("rowspan")).toBe(false);
    expect(cell.hasAttribute("hidden")).toBe(false);
  }
  // 実行: 分類を A に絞り込む
  const { drawer } = openDrawer(root);
  findCheckbox(drawer, "A").click();
  // 検証: A の 2 行を出し、1 行目の分類のセルをもう一度結合する
  const visible = bodyRows(root).filter((row) => !row.hidden);
  expect(visible).toHaveLength(2);
  expect(visible[0]?.cells[0]?.getAttribute("rowspan")).toBe("2");
  // 実行: TSV でコピーする
  chooseCopyFormat(root, "tsv");
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  // 検証: 各行の分類が A で、結合の記号を含まない
  const [text] = writeText.mock.calls[0] ?? [""];
  const rows = text.split("\n").slice(-2);
  for (const row of rows) {
    expect(row.split("\t")[0]).toBe("A");
  }
  expect(text).not.toContain("^^");
  expect(text).not.toContain("<<");
});

// 行見出しを持つはみ出す表を、描いた直後に行見出しの全ての列を留める（正常系）
test("test_attach_tables_when_row_header_pinned", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const headers = Array.from(
    { length: 10 },
    (_, i) => `とても長い列の名前${i + 1}`,
  );
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "header": {"columns": 2}} -->',
      "",
      `| ${headers.join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
      ...Array.from(
        { length: 5 },
        (_, row) =>
          `| ${headers.map((_, i) => `値${row + 1}-${i + 1}`).join(" | ")} |`,
      ),
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  setRootWidth(root, 320);
  // 実行
  detachers.push(attachTables(root));
  // 検証: 1・2 列目のピン止めが押した状態で、行見出しの全ての列を留める
  const pins = root.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  await vi.waitFor(() => {
    expect(pins[1]?.getAttribute("aria-pressed")).toBe("true");
  });
  expect(pins[0]?.getAttribute("aria-pressed")).toBe("true");
  const cells = root.querySelector<HTMLTableRowElement>("tbody tr")?.cells;
  if (!cells) {
    throw new Error("本文の行が無い");
  }
  expect(getComputedStyle(cells[0]).position).toBe("sticky");
  expect(getComputedStyle(cells[1]).position).toBe("sticky");
  expect(getComputedStyle(cells[2]).position).not.toBe("sticky");
});

// 留めた列より左を表示している間は、留めた列を右端に並べて留める（正常系）
test("test_attach_tables_when_pinned_at_end", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(wideTable(10).join("\n"));
  setRootWidth(root, 800);
  detachers.push(attachTables(root));
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  const scroller = root.querySelector<HTMLElement>(".mdmark-table-scroll");
  const pins = root.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  if (!table || !scroller) {
    throw new Error("表が無い");
  }
  await vi.waitFor(() => {
    expect(pins[8]?.hasAttribute("hidden")).toBe(false);
  });
  // 実行: 右端までスクロールして 8・9 列目を押し、左端まで戻す
  scroller.scrollLeft = scroller.scrollWidth;
  pins[7].click();
  pins[8].click();
  scroller.scrollLeft = 0;
  scroller.dispatchEvent(new Event("scroll"));
  // 検証
  const cells = table.querySelector<HTMLTableRowElement>("tbody tr")?.cells;
  if (!cells) {
    throw new Error("本文の行が無い");
  }
  expect(cells[7].style.right).toBe(`${cells[8].offsetWidth}px`);
  expect(cells[8].style.right).toBe("0px");
  // 表を包む要素の見えている範囲の右端（縦のスクロールバーを除く）
  const visibleRight =
    scroller.getBoundingClientRect().left +
    scroller.clientLeft +
    scroller.clientWidth;
  await vi.waitFor(() => {
    expect(Math.round(cells[8].getBoundingClientRect().right)).toBe(
      Math.round(visibleRight),
    );
  });
  expect(cells[7].classList.contains("is-pinned-edge-end")).toBe(true);
  expect(cells[8].classList.contains("is-pinned-edge-end")).toBe(false);
});

// pinMode: through の表は押した列までを左端に留め、押した列のボタンだけを押した状態にする（正常系）
test("test_attach_tables_when_pinned_through", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(wideTable(10).join("\n"));
  setRootWidth(root, 320);
  detachers.push(attachTables(root, { pinMode: "through" }));
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  const pins = root.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  if (!table) {
    throw new Error("表が無い");
  }
  await vi.waitFor(() => {
    expect(pins[2]?.hasAttribute("hidden")).toBe(false);
  });
  // 実行: 3 列目を押す
  pins[2].click();
  // 検証
  expect(stickyColumns(table).slice(0, 4)).toEqual([true, true, true, false]);
  const cells = table.querySelector<HTMLTableRowElement>("tbody tr")?.cells;
  expect(cells?.[0].style.right).toBe("");
  expect([...pins].map((pin) => pin.getAttribute("aria-pressed"))).toEqual([
    "false",
    "false",
    "true",
    ...Array.from({ length: 7 }, () => "false"),
  ]);
  expect(pins[2].getAttribute("aria-label")).toBe(
    "「とても長い列の名前3」の列までピン止め",
  );
  // 実行・検証: もう一度押すと全て解除する
  pins[2].click();
  expect(stickyColumns(table).some(Boolean)).toBe(false);
});

// 結合した見出しの下の 1 列だけを留めると、結合したセルは留めない（正常系）
test("test_attach_tables_when_pinned_under_merged_header", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const long = "とても長い説明の文".repeat(8);
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "columns": {"備考": {"width": {"mode": "nowrap"}}}, "header": {"rows": 2}} -->',
      "",
      "| 名前 | 設定 | << | << | 備考 |",
      "| --- | --- | --- | --- | --- |",
      "| 名前 | 型 | 既定 | 必須 | 備考 |",
      `| table.pin | string | each | false | ${long} |`,
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  setRootWidth(root, 320);
  detachers.push(attachTables(root));
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  if (!table) {
    throw new Error("表が無い");
  }
  const defaultHead = [
    ...table.querySelectorAll<HTMLTableCellElement>("thead tr:last-child th"),
  ].find((cell) => cell.textContent?.includes("既定"));
  const pin =
    defaultHead?.querySelector<HTMLButtonElement>("button.mdmark-pin");
  await vi.waitFor(() => {
    expect(pin?.hasAttribute("hidden")).toBe(false);
  });
  // 実行
  pin?.click();
  // 検証
  const cells = table.querySelector<HTMLTableRowElement>("tbody tr")?.cells;
  if (!cells || !defaultHead) {
    throw new Error("セルが無い");
  }
  expect(getComputedStyle(defaultHead).position).toBe("sticky");
  expect(getComputedStyle(cells[2]).position).toBe("sticky");
  expect(cells[2].style.left).toBe(`${cells[0].offsetWidth}px`);
  const groupHead = [
    ...table.querySelectorAll<HTMLTableCellElement>("thead tr:first-child th"),
  ].find((cell) => cell.textContent?.includes("設定"));
  expect(groupHead && getComputedStyle(groupHead).position).not.toBe("sticky");
});

// 描いた直後に留める列を、pin・行見出し・先頭の列の順に決め、through は最も右の列まで広げる（正常系）
test("test_initial_pinned_columns", async () => {
  // 準備
  const { initialPinnedColumns } = await loadLogic();
  // 実行・検証
  expect(
    initialPinnedColumns({ pin: [0, 2], rowHeadCount: 0, mode: "each" }),
  ).toEqual([0, 2]);
  expect(
    initialPinnedColumns({ pin: [], rowHeadCount: 2, mode: "each" }),
  ).toEqual([0, 1]);
  expect(
    initialPinnedColumns({ pin: [], rowHeadCount: 0, mode: "each" }),
  ).toEqual([0]);
  expect(
    initialPinnedColumns({ pin: [2], rowHeadCount: 0, mode: "through" }),
  ).toEqual([0, 1, 2]);
});

// each は押した列だけを出し入れし、through は押した列までにするか解除する（正常系）
test("test_toggle_pinned_column", async () => {
  // 準備
  const { togglePinnedColumn } = await loadLogic();
  const pinned = [0];
  // 実行・検証
  expect(togglePinnedColumn({ pinned, column: 2, mode: "each" })).toEqual([
    0, 2,
  ]);
  expect(
    togglePinnedColumn({ pinned: [0, 2], column: 2, mode: "each" }),
  ).toEqual([0]);
  expect(togglePinnedColumn({ pinned, column: 2, mode: "through" })).toEqual([
    0, 1, 2,
  ]);
  expect(
    togglePinnedColumn({ pinned: [0, 1, 2], column: 2, mode: "through" }),
  ).toEqual([]);
  expect(pinned).toEqual([0]);
});

// 左右で留めた列の幅だけを足し合わせる（正常系）
test("test_pin_offsets", async () => {
  // 準備
  const { pinOffsets } = await loadLogic();
  // 実行
  const offsets = pinOffsets({
    widths: [100, 80, 60, 40, 30],
    pinned: [0, 2, 4],
  });
  // 検証
  expect(offsets.get(0)).toEqual({ start: 0, end: 90 });
  expect(offsets.get(2)).toEqual({ start: 100, end: 30 });
  expect(offsets.get(4)).toEqual({ start: 160, end: 0 });
  expect(offsets.has(1)).toBe(false);
  expect(offsets.has(3)).toBe(false);
});

// 同じ範囲と同じピン止めの側だけを許す（正常系）
test("test_can_move_column", async () => {
  // 準備
  const { canMoveColumn } = await loadLogic();
  // 実行・検証
  expect(
    canMoveColumn({
      from: { group: "0:1", pinned: false },
      to: { group: "0:1", pinned: false },
    }),
  ).toBe(true);
  expect(
    canMoveColumn({
      from: { group: "0:1", pinned: false },
      to: { group: undefined, pinned: false },
    }),
  ).toBe(false);
  expect(
    canMoveColumn({
      from: { group: undefined, pinned: true },
      to: { group: undefined, pinned: false },
    }),
  ).toBe(false);
});

// 列を前と後ろへ動かす（正常系）
test("test_move_column", async () => {
  // 準備
  const { moveColumn } = await loadLogic();
  const order = [0, 1, 2, 3];
  // 実行
  const before = moveColumn({ order, column: 3, target: 0, side: "before" });
  const after = moveColumn({ order, column: 1, target: 2, side: "after" });
  // 検証
  expect(before).toEqual([3, 0, 1, 2]);
  expect(after).toEqual([0, 2, 1, 3]);
  expect(order).toEqual([0, 1, 2, 3]);
});

// 縦に結合したセルと 2 行目のセルを選ぶ（正常系）
test("test_bottom_head_cells", async () => {
  // 準備
  const { bottomHeadCells } = await loadLogic();
  const rows = [
    [
      { rowSpan: 2, colSpan: 1 },
      { rowSpan: 1, colSpan: 2 },
    ],
    [
      { rowSpan: 1, colSpan: 1 },
      { rowSpan: 1, colSpan: 1 },
    ],
  ];
  // 実行
  const cells = bottomHeadCells(rows);
  // 検証
  expect(cells).toEqual([
    { row: 0, cell: 0 },
    { row: 1, cell: 0 },
    { row: 1, cell: 1 },
  ]);
});

// またぐセルしか無い列を undefined にする（正常系）
test("test_bottom_head_cells_when_spanning", async () => {
  // 準備
  const { bottomHeadCells } = await loadLogic();
  const rows = [
    [
      { rowSpan: 1, colSpan: 1 },
      { rowSpan: 1, colSpan: 2 },
    ],
  ];
  // 実行
  const cells = bottomHeadCells(rows);
  // 検証
  expect(cells).toEqual([{ row: 0, cell: 0 }, undefined, undefined]);
});

// 隣り合う同じ値だけを結合する（正常系）
test("test_merge_spans", async () => {
  // 準備
  const { mergeSpans } = await loadLogic();
  // 実行
  const spans = mergeSpans({
    values: [["A"], ["A"], ["B"], ["A"]],
    columns: [0],
  });
  // 検証
  expect(spans).toEqual([[2], [0], [1], [1]]);
});

// 左の列の切れ目で右の列も切る（正常系）
test("test_merge_spans_when_left_breaks", async () => {
  // 準備
  const { mergeSpans } = await loadLogic();
  // 実行
  const spans = mergeSpans({
    values: [
      ["東", "札幌"],
      ["東", "札幌"],
      ["西", "札幌"],
    ],
    columns: [0, 1],
  });
  // 検証
  expect(spans).toEqual([
    [2, 2],
    [0, 0],
    [1, 1],
  ]);
});

/** `+columns` の表の Markdown（列 `名前`・`状態`・`説明`）。`hide` を指定すると最初から隠す列を指定する */
function columnsTable(hide?: string): string {
  return [
    hide
      ? `<!-- table: {"kind": "data", "columns": {"${hide}": {"hidden": true}}} -->`
      : '<!-- table: {"kind": "data", "features": {"columns": {}}} -->',
    "",
    "| 名前 | 状態 | 説明 |",
    "| --- | --- | --- |",
    "| a | 完了 | 一つ目 |",
    "| b | 作業中 | 二つ目 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** テーブル設定のパネルを開き、列ごとの目のアイコンを返却する */
function columnEyes(wrapper: HTMLElement): HTMLButtonElement[] {
  findButton(wrapper, "button.mdmark-table-settings-toggle").click();
  return [
    ...wrapper.querySelectorAll<HTMLButtonElement>(
      ".mdmark-table-settings button.mdmark-table-settings-eye",
    ),
  ];
}

// 階層の表のコピーに畳んだ行を含め、キーを全体のパスで記載し、補った行を含めない（正常系）
test("test_attach_tables_when_tree_copied", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "features": {"copy": {}}, "tree": {"key": {"column": "キー"}}} -->',
      "",
      "| キー | 説明 |",
      "| --- | --- |",
      "| features.table | 表の機能 |",
      "| aliases[].id | 別名の ID |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachTables(root));
  findButton(
    root,
    'tr[data-path="aliases[]"] button.mdmark-tree-toggle',
  ).click();
  // 実行
  chooseCopyFormat(root, "markdown");
  // 検証
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  expect(writeText).toHaveBeenCalledWith(
    "| キー | 説明 |\n| --- | --- |\n| features.table | 表の機能 |\n| aliases[].id | 別名の ID |",
  );
});

// 列の表示を切り替えるたびに、表の番号と隠している列の見出しで通知する（正常系）
test("test_attach_tables_when_columns_notified", async () => {
  // 準備: 1 つ目は削除したブロックの中、2 つ目は 3 列目を隠した表、3 つ目は隠していない表
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [columnsTable(), columnsTable("説明"), columnsTable()].join("\n"),
  );
  const wrappers = [...root.querySelectorAll<HTMLElement>(".mdmark-table")];
  const deleted = document.createElement("div");
  deleted.className = "mdmark-diff-block";
  deleted.dataset.kind = "del";
  wrappers[0]?.before(deleted);
  deleted.append(wrappers[0] as HTMLElement);
  const third = wrappers[2];
  if (!third) {
    throw new Error("3 つ目の表が無い");
  }
  const onColumnsChange = vi.fn();
  // 実行・検証: 付けた時点では通知しない
  detachers.push(attachTables(root, { onColumnsChange }));
  expect(onColumnsChange).not.toHaveBeenCalled();
  // 実行・検証: 3 つ目の表のテーブル設定で `状態` を目のアイコンで隠す
  const thirdEyes = columnEyes(third);
  thirdEyes[1]?.click();
  expect(onColumnsChange).toHaveBeenLastCalledWith({
    tableIndex: 1,
    hidden: ["状態"],
  });
  // 実行・検証: もう一度押して表示する
  thirdEyes[1]?.click();
  expect(onColumnsChange).toHaveBeenLastCalledWith({
    tableIndex: 1,
    hidden: [],
  });
  expect(onColumnsChange).toHaveBeenCalledTimes(2);
});

// 通知が例外を投げても列の表示を切り替える（異常系）
test("test_attach_tables_when_columns_callback_throws", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(columnsTable());
  const error = new Error("通知の失敗");
  const onColumnsChange = vi.fn(() => {
    throw error;
  });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  detachers.push(attachTables(root, { onColumnsChange }));
  // 実行: 2 列目を目のアイコンで隠す
  columnEyes(root)[1]?.click();
  // 検証
  for (const cell of columnCells(root, 1)) {
    expect(cell.hasAttribute("hidden")).toBe(true);
  }
  expect(onColumnsChange).toHaveBeenCalledTimes(1);
  expect(consoleError).toHaveBeenCalledWith(
    expect.any(String),
    "onColumnsChange",
    error,
  );
});

/** テーブル設定のボタンのバッジの文字（隠していれば null） */
function badgeText(root: HTMLElement): string | null {
  const badge = root.querySelector<HTMLElement>(
    "button.mdmark-table-settings-toggle .mdmark-table-tool-badge",
  );
  return badge && !badge.hidden ? (badge.textContent ?? "") : null;
}

/** テーブル設定のボタンのスクリーンリーダー向けの名前 */
function toggleName(root: HTMLElement): string {
  return (
    root
      .querySelector("button.mdmark-table-settings-toggle")
      ?.getAttribute("aria-label") ?? ""
  );
}

/** テーブル設定のパネルの、元の位置 `column` の列の目のアイコンを押す */
function clickEye(root: HTMLElement, column: number): void {
  findButton(
    root,
    `.mdmark-table-settings-item[data-column="${column}"] button.mdmark-table-settings-eye`,
  ).click();
}

// 列の表示を切り替えるたびにバッジとスクリーンリーダー向けの名前を書き換える（正常系）
test("test_attach_tables_when_columns_badge", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data", "columns": {"説明": {"hidden": true}}} -->',
      "",
      "| 名前 | 説明 | 更新日 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 2026-10-01 |",
      "| みかん | 印刷を修正する | 2026-10-10 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  // 実行・検証: 付けた直後
  detachers.push(attachTables(root));
  expect(badgeText(root)).toBe("1");
  expect(toggleName(root)).toBe("テーブル設定（1 列を非表示）");
  const toggle = findButton(root, "button.mdmark-table-settings-toggle");
  toggle.click();
  // 実行・検証: 2 列目を表示する
  clickEye(root, 1);
  expect(badgeText(root)).toBeNull();
  expect(toggle.classList.contains("is-active")).toBe(false);
  expect(toggleName(root)).toBe("テーブル設定");
  // 実行・検証: 2 列目と 3 列目を隠す
  clickEye(root, 1);
  clickEye(root, 2);
  expect(badgeText(root)).toBe("2");
  // 実行・検証: 3 列目を表示する
  clickEye(root, 2);
  expect(badgeText(root)).toBe("1");
});

// 包む要素がはみ出す間だけピン止めを適用する（正常系）
test("test_attach_tables_when_scroll_wrapper", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const wide = Array.from({ length: 12 }, (_, i) => `列${i + 1}の見出し`);
  const { root } = createRoot(
    [
      '<!-- table: {"kind": "data"} -->',
      "",
      "| 名前 | 数量 |",
      "| --- | --- |",
      "| りんご | 3 |",
      "",
      "<!-- /table -->",
      "",
      '<!-- table: {"kind": "data"} -->',
      "",
      `| ${wide.join(" | ")} |`,
      `| ${wide.map(() => "---").join(" | ")} |`,
      `| ${wide.map((_, i) => `値${i + 1}の長い文字`).join(" | ")} |`,
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  root.style.width = "1000px";
  // 実行
  detachers.push(attachTables(root));
  // 検証
  const [narrow, many] = [
    ...root.querySelectorAll<HTMLElement>(".mdmark-table"),
  ];
  const narrowScroll = narrow?.querySelector<HTMLElement>(
    ".mdmark-table-scroll",
  );
  const manyScroll = many?.querySelector<HTMLElement>(".mdmark-table-scroll");
  if (!narrow || !many || !narrowScroll || !manyScroll) {
    throw new Error("表か包む要素が無い");
  }
  expect(
    [...narrow.querySelectorAll<HTMLElement>("button.mdmark-pin")].every(
      (pin) => pin.hidden,
    ),
  ).toBe(true);
  const table = narrow.querySelector("table");
  expect(table?.getBoundingClientRect().width ?? 0).toBeLessThan(
    narrowScroll.getBoundingClientRect().width,
  );
  expect(narrowScroll.scrollWidth).toBeLessThanOrEqual(
    narrowScroll.clientWidth,
  );
  expect(
    [...many.querySelectorAll<HTMLElement>("button.mdmark-pin")].some(
      (pin) => !pin.hidden,
    ),
  ).toBe(true);
  expect(manyScroll.scrollWidth).toBeGreaterThan(manyScroll.clientWidth);
});

// 最小幅と上限の間に収める（正常系）
test("test_clamp_column_width", async () => {
  // 準備
  const { clampColumnWidth } = await loadLogic();
  // 実行・検証
  expect(clampColumnWidth({ width: 50, min: 100, max: 300 })).toBe(100);
  expect(clampColumnWidth({ width: 200, min: 100, max: 300 })).toBe(200);
  expect(clampColumnWidth({ width: 400, min: 100, max: 300 })).toBe(300);
  expect(clampColumnWidth({ width: 200, min: 100, max: 80 })).toBe(100);
});

// ほかに留めた列の幅だけを引く（正常系）
test("test_column_width_limit", async () => {
  // 準備
  const { columnWidthLimit } = await loadLogic();
  const base = { visibleWidth: 300, widths: [100, 80, 60], pinned: [0, 2] };
  // 実行・検証: はみ出しているとき
  expect(columnWidthLimit({ ...base, overflowing: true, column: 0 })).toBe(240);
  expect(columnWidthLimit({ ...base, overflowing: true, column: 1 })).toBe(140);
  // 実行・検証: はみ出していないとき
  expect(columnWidthLimit({ ...base, overflowing: false, column: 0 })).toBe(
    300,
  );
  expect(columnWidthLimit({ ...base, overflowing: false, column: 1 })).toBe(
    300,
  );
});

/** つまみにキーを送信する */
function pressResizeKey(handle: HTMLElement, key: string): void {
  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
}

// resize の表は、留めた列の幅を変えると留める位置を計算し直し、上限で止める（正常系）
test("test_attach_tables_when_column_resized", async () => {
  // 準備
  addStyles();
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(
    () => undefined,
  );
  const { attachTables } = await loadTables();
  // 列名が短く、留めた 1 列目と 3 列目の幅の合計が見えている幅に収まる 10 列の表
  const names = Array.from({ length: 10 }, (_, i) => `列${i + 1}`);
  const { root } = createRoot(
    [
      `| ${names.join(" | ")} |`,
      `| ${names.map(() => "---").join(" | ")} |`,
      `| ${names.map((_, i) => `値${i + 1}`).join(" | ")} |`,
      "",
    ].join("\n"),
  );
  setRootWidth(root, 320);
  detachers.push(attachTables(root));
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  const scroll = root.querySelector<HTMLElement>(".mdmark-table-scroll");
  const pins = root.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  const handles = root.querySelectorAll<HTMLElement>(".mdmark-col-resize");
  const heads = root.querySelectorAll<HTMLTableCellElement>("thead th");
  if (!table || !scroll) {
    throw new Error("表が無い");
  }
  expect(table.dataset.features?.split(" ")).toContain("resize");
  await vi.waitFor(() => {
    expect(pins[2]?.hasAttribute("hidden")).toBe(false);
  });
  pins[2].click();
  // 実行: 1 列目のつまみで → を押す
  pressResizeKey(handles[0], "ArrowRight");
  // 検証: 3 列目は広げた 1 列目の右に留まる
  const third = table.querySelector<HTMLTableRowElement>("tbody tr")?.cells[2];
  expect(third?.style.left).toBe(`${heads[0].offsetWidth}px`);
  // 実行: 1 列目のつまみを右へ 2000px ドラッグする
  const rect = handles[0].getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, pointerId: 1 };
  handles[0].dispatchEvent(
    new PointerEvent("pointerdown", { ...init, clientX: rect.left }),
  );
  handles[0].dispatchEvent(
    new PointerEvent("pointermove", { ...init, clientX: rect.left + 2000 }),
  );
  handles[0].dispatchEvent(
    new PointerEvent("pointerup", { ...init, clientX: rect.left + 2000 }),
  );
  // 検証: 上限で止まる
  expect(heads[0].offsetWidth).toBeLessThanOrEqual(
    scroll.clientWidth - heads[2].offsetWidth,
  );
  expect(handles[0].getAttribute("aria-valuenow")).toBe(
    handles[0].getAttribute("aria-valuemax"),
  ); // 実行・検証: 3 列目のつまみにフォーカスすると、広げた 1 列目の幅を引いた上限になる
  handles[2].focus();
  expect(handles[2].getAttribute("aria-valuemax")).toBe(
    String(Math.floor(scroll.clientWidth - heads[0].offsetWidth)),
  );
});

// resize を持たない表には、つまみの操作を付けない（正常系）
test("test_attach_tables_when_resize_off", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    dataTable({ values: ["10", "2", "33"] }).replace(
      '<!-- table: {"kind": "data"} -->',
      '<!-- table: {"kind": "data", "features": {"resize": {"enabled": false}}} -->',
    ),
  );
  // 実行
  detachers.push(attachTables(root));
  // 検証
  expect(root.querySelector(".mdmark-col-resize")).toBeNull();
});
// 狭い幅でも最終列を畳まず、列の幅を自動で決めてから、はみ出す表にピン止めを付ける（正常系）
test("test_attach_tables_when_auto_width", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    `<!-- table: {"kind": "data"} -->\n\n${FOLDABLE_TABLE}\n<!-- /table -->\n`,
  );
  setRootWidth(root, 390);
  // 実行
  detachers.push(attachTables(root));
  // 検証
  const wrapper = root.querySelector<HTMLElement>(".mdmark-table");
  const table = wrapper?.querySelector("table");
  const scroller = wrapper?.querySelector<HTMLElement>(".mdmark-table-scroll");
  if (!wrapper || !table || !scroller) {
    throw new Error("表が無い");
  }
  expect(wrapper.dataset.long).toBe("2");
  await vi.waitFor(() => {
    expect(table.hasAttribute("data-auto-width")).toBe(true);
  });
  const lastCells = [
    ...table.querySelectorAll<HTMLElement>("tbody td:last-child"),
  ];
  expect(
    lastCells.every((cell) => getComputedStyle(cell).display !== "none"),
  ).toBe(true);
  expect(
    root.querySelector(".mdmark-fold-toggle, .mdmark-fold-col"),
  ).toBeNull();
  expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  await vi.waitFor(() => {
    expect(getComputedStyle(table.rows[1].cells[0]).position).toBe("sticky");
  });
});

// 列を隠しても、残った列の幅を変えない（正常系）
test("test_attach_tables_when_column_hidden_keeps_widths", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    `<!-- table: {"kind": "data", "features": {"columns": {"enabled": true}}} -->\n\n${FOLDABLE_TABLE}\n<!-- /table -->\n`,
  );
  setRootWidth(root, 1280);
  detachers.push(attachTables(root));
  const table = root.querySelector<HTMLTableElement>(".mdmark-table table");
  if (!table) {
    throw new Error("表が無い");
  }
  await vi.waitFor(() => {
    expect(table.hasAttribute("data-auto-width")).toBe(true);
  });
  const heads = [...table.querySelectorAll<HTMLElement>("thead th")];
  const before = heads.map((th) => th.offsetWidth);
  // 実行: 状態の列を隠す
  clickEye(root, 1);
  // 検証: 残った名前・説明の列の幅は隠す前と同じ
  expect(heads[1]?.hidden).toBe(true);
  for (const column of [0, 2]) {
    expect(
      Math.abs((heads[column]?.offsetWidth ?? 0) - (before[column] ?? 0)),
    ).toBeLessThanOrEqual(1);
  }
});

// つまみで列の幅を変えた後と戻した後に、列の幅を決め直す（正常系）
test("test_attach_tables_when_resized_refreshes_width", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    `<!-- table: {"kind": "data"} -->\n\n${FOLDABLE_TABLE}\n<!-- /table -->\n`,
  );
  setRootWidth(root, 1280);
  detachers.push(attachTables(root));
  const table = root.querySelector<HTMLTableElement>(".mdmark-table table");
  const handle = root.querySelector<HTMLElement>(".mdmark-col-resize");
  const nameHead = root.querySelector<HTMLElement>("thead th");
  if (!table || !handle || !nameHead) {
    throw new Error("表かつまみが無い");
  }
  await vi.waitFor(() => {
    expect(table.hasAttribute("data-auto-width")).toBe(true);
  });
  // 実行: 名前の列のつまみで → を 2 回押す
  pressResizeKey(handle, "ArrowRight");
  pressResizeKey(handle, "ArrowRight");
  // 検証: 名前の列は自動の幅を持たず、表の幅の合計に広げた幅が入る
  await vi.waitFor(() => {
    expect(nameHead.style.getPropertyValue("--mdmark-auto-width")).toBe("");
  });
  const sum = [...table.querySelectorAll<HTMLElement>("thead th")].reduce(
    (total, th) => total + th.offsetWidth,
    0,
  );
  expect(
    Number.parseFloat(
      table.style.getPropertyValue("--mdmark-auto-table-width"),
    ),
  ).toBeCloseTo(sum, -1);
  // 実行: Enter で戻す
  pressResizeKey(handle, "Enter");
  // 検証: 名前の列に自動の幅が入り直す
  await vi.waitFor(() => {
    expect(nameHead.style.getPropertyValue("--mdmark-auto-width")).not.toBe("");
  });
});
