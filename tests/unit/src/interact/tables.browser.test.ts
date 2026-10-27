import { afterEach, expect, test, vi } from "vitest";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";

/** 表の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTables = () => import("../../../../src/interact/tables.ts");

const detachers: Array<() => void> = [];

/** 名前と値の 3 行の data の表。`filter` を渡すと絞り込みの列を指定する */
function dataTable(options: { filter?: string; values: string[] }): string {
  const mark = options.filter
    ? `<!-- table: data filter=${options.filter} -->`
    : "<!-- table: data -->";
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

/** 表の本文の行（詳細の行と知らせの行を除く） */
function bodyRows(root: HTMLElement): HTMLTableRowElement[] {
  return [
    ...root.querySelectorAll<HTMLTableRowElement>(
      "tbody tr:not(.mdmark-row-detail):not(.mdmark-table-empty)",
    ),
  ];
}

/** 表の本文の行の指定した列の文字を、並んだ順に返す */
function columnTexts(root: HTMLElement, column: number): string[] {
  return bodyRows(root).map((row) => row.cells[column]?.textContent ?? "");
}

/** 絞り込みのドロワーの中の、ラベルの文字に合う入力欄を返す */
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

/** 絞り込みのボタンを押してドロワーを開き、ボタンとドロワーを返す */
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

/** 表のその列の見出し・本文のセル・集計のセルを返す */
function columnCells(root: HTMLElement, column: number): HTMLElement[] {
  const head = root.querySelectorAll<HTMLElement>("thead th")[column];
  const cells = bodyRows(root).map((row) => row.cells[column]);
  const total = root.querySelectorAll<HTMLElement>("tfoot td")[column];
  return [head, ...cells, ...(total ? [total] : [])];
}

/** 集計の行ごとに、セルの文字を空白を除いてつないだものを、行の順に返す */
function totalRowTexts(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLTableRowElement>("tfoot tr")].map(
    (row) =>
      [...row.cells]
        .map((cell) => (cell.textContent ?? "").replace(/\s+/g, ""))
        .join(""),
  );
}

/** 集計の行ごとに、セルの文字を空白を除いて返す */
function totalRowCells(root: HTMLElement): string[][] {
  return [...root.querySelectorAll<HTMLTableRowElement>("tfoot tr")].map(
    (row) => [...row.cells].map((cell) => (cell.textContent ?? "").trim()),
  );
}

/** `+copy` の data の表（名前 `a`・`b`・`c`、値は渡した順） */
function dataTableWithCopy(values: string[]): string {
  return [
    "<!-- table: data +copy -->",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    ...values.map((value, i) => `| ${"abc"[i]} | ${value} |`),
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 件数の要素の文字を返す */
function countText(root: HTMLElement): string {
  return root.querySelector(".mdmark-table-count")?.textContent ?? "";
}

/** 描いた要素から、クラスで探したボタンを返す（無ければ例外） */
function findButton(root: HTMLElement, selector: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(selector);
  if (!button) {
    throw new Error(`ボタンが無い: ${selector}`);
  }
  return button;
}

/** 要素の中のセレクタに合う要素を返す（無ければ例外） */
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

// 桁区切りと小数と負の数を読み、空と読めない文字を読まない（正常系）
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

// sum・avg の列の読めない値を重なりを除いて返し、count と空のセルは数えない（正常系）
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

// 全て読めれば空を返す（正常系）
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

// 幅と折り返しと列の位置で畳むかを決める（正常系）
test("test_should_fold", async () => {
  // 準備
  const { shouldFold } = await loadLogic();
  // 実行
  const result = [
    { width: 390, lastColumn: 2, wraps: true },
    { width: 719, lastColumn: 2, wraps: true },
    { width: 720, lastColumn: 2, wraps: true },
    { width: 390, lastColumn: 2, wraps: false },
    { width: 390, lastColumn: 0, wraps: true },
  ].map((options) => shouldFold(options));
  // 検証
  expect(result).toEqual([true, true, false, false, false]);
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

// 見出し行と集計の行が動ける範囲を返す（正常系）
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

// 最後の # の後ろを戻した文字を返す（正常系）
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

// 3 回の押下で昇順・降順・元の並びになる（正常系）
test("test_attach_tables_when_sorted", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(dataTable({ values: ["10", "2", "33"] }));
  detachers.push(attachTables(root));
  const header = root.querySelectorAll("thead th")[1];
  const button = header?.querySelector<HTMLButtonElement>("button.mdmark-sort");
  // 実行・検証
  button?.click();
  expect(columnTexts(root, 1)).toEqual(["2", "10", "33"]);
  expect(header?.getAttribute("aria-sort")).toBe("ascending");
  button?.click();
  expect(columnTexts(root, 1)).toEqual(["33", "10", "2"]);
  expect(header?.getAttribute("aria-sort")).toBe("descending");
  button?.click();
  expect(columnTexts(root, 1)).toEqual(["10", "2", "33"]);
  expect(header?.hasAttribute("aria-sort")).toBe(false);
});

// ドロワーで絞って外し、外の押下で閉じる（正常系）
test("test_attach_tables_when_filtered", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      "<!-- table: data filter=名前 -->",
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
  // 実行・検証: 絞り込みを外す
  const clear = [...drawer.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("絞り込みを外す"),
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

// はみ出す表だけピン止めのボタンを出し、押した列までを留める（正常系）
test("test_attach_tables_when_pinned", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const wideHeaders = Array.from(
    { length: 10 },
    (_, i) => `とても長い列の名前${i + 1}`,
  );
  const { root } = createRoot(
    [
      `| ${wideHeaders.join(" | ")} |`,
      `| ${wideHeaders.map(() => "---").join(" | ")} |`,
      `| ${wideHeaders.map((_, i) => `値${i + 1}`).join(" | ")} |`,
      "",
      "| 列A | 列B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
    ].join("\n"),
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
  // 実行・検証: はみ出す表にだけボタンが出る
  await vi.waitFor(() => {
    expect(widePins[1].hasAttribute("hidden")).toBe(false);
  });
  for (const pin of narrowPins) {
    expect(pin.hasAttribute("hidden")).toBe(true);
  }
  // 実行・検証: 2 列目のボタンで 2 列目までを留める
  widePins[1].click();
  const cells = wide.querySelectorAll<HTMLTableCellElement>("tbody tr td");
  expect(getComputedStyle(cells[0]).position).toBe("sticky");
  expect(getComputedStyle(cells[1]).position).toBe("sticky");
  expect(getComputedStyle(cells[2]).position).not.toBe("sticky");
});

// 外すと document の受け取りが残らない（正常系）
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
    "<!-- table: data filter=名前 -->",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| 印 | 1 |",
    "| 表 | 2 |",
    "",
    "<!-- /table -->",
    "",
    "<!-- glossary: term=用語 meaning=意味 -->",
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| 印 | HTML コメントで書く指定 |",
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
    expect(candidates).toEqual(["印", "表"]);
    const buttons = [
      ...root.querySelectorAll<HTMLElement>("thead th button.mdmark-filter"),
    ];
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "「名前」で絞り込む",
    ]);
    expect(root.querySelector("tbody td .mdmark-term")?.textContent).toBe("印");
  } finally {
    handle.destroy();
    root.remove();
  }
});

// 絞り込みに合わせて件数と計算ごとの集計の行を作り直す（正常系）
test("test_attach_tables_when_counted", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      "<!-- table: data +count +total filter=名前:text total=名前:count,数量:sum,単価:avg -->",
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

// 列を隠して既定に戻し、Esc でメニューを閉じる（正常系）
test("test_attach_tables_when_columns_toggled", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      "<!-- table: data +columns +total hide=説明 total=数量:sum -->",
      "",
      "| 名前 | 説明 | 数量 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 10 |",
      "| みかん | 印刷を直す | 2 |",
      "| ぶどう | 描画の崩れを直す | 33 |",
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
  // 実行・検証: メニューを開く
  const toggle = findButton(root, "button.mdmark-columns-toggle");
  toggle.click();
  const menu = root.querySelector<HTMLElement>(".mdmark-columns-menu");
  const checkboxes = [
    ...(menu?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ??
      []),
  ];
  expect(menu?.hasAttribute("hidden")).toBe(false);
  expect(checkboxes).toHaveLength(3);
  expect(checkboxes[0].disabled).toBe(true);
  expect(document.activeElement).toBe(checkboxes[1]);
  // 実行・検証: 2 列目を入れて 3 列目を外す
  checkboxes[1].click();
  checkboxes[2].click();
  for (const cell of [...columnCells(root, 0), ...columnCells(root, 1)]) {
    expect(cell.hasAttribute("hidden")).toBe(false);
  }
  for (const cell of columnCells(root, 2)) {
    expect(cell.hasAttribute("hidden")).toBe(true);
  }
  // 実行・検証: 既定に戻す
  findButton(root, "button.mdmark-columns-reset").click();
  for (const cell of columnCells(root, 1)) {
    expect(cell.hasAttribute("hidden")).toBe(true);
  }
  for (const cell of [...columnCells(root, 0), ...columnCells(root, 2)]) {
    expect(cell.hasAttribute("hidden")).toBe(false);
  }
  // 実行・検証: Esc でメニューを閉じてボタンへフォーカスを戻す
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(menu?.hasAttribute("hidden")).toBe(true);
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

/** 帯の読み上げの要素の文字を返す */
function statusText(root: HTMLElement): string {
  return root.querySelector(".mdmark-table-status")?.textContent ?? "";
}

// 形式のメニューで TSV を選び、表示している行と列を写して 2 秒でボタンを戻す（正常系）
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
      "<!-- table: data +columns +copy hide=説明 filter=名前:text -->",
      "",
      "| 名前 | 説明 | 更新日 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 2026-10-01 |",
      "| みかん | 印刷を直す | 2026-10-10 |",
      "| りんご飴 | 描画の崩れを直す | 2026-10-20 |",
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
  // 検証: メニューを閉じてフォーカスを戻し、写した中身と、写したことの知らせ
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
      "<!-- table: data +copy -->",
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
  // 実行: 値の列を昇順・降順に並べ替えてから TSV でコピーする
  sortButton?.click();
  sortButton?.click();
  chooseCopyFormat(root, "tsv");
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  // 検証
  expect(columnTexts(root, 1)).toEqual(["3", "2", "1"]);
  expect(writeText).toHaveBeenCalledWith("名前\t値\nb\t3\nc\t2\na\t1");
});

// 拒まれたら手でコピーするパネルを出し、Esc で閉じる（正常系）
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
      "<!-- table: data +copy -->",
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
      "クリップボードにコピーできませんでした。選択したMarkdown の表を手でコピーできます",
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
      "<!-- table: data +rowlink closed -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 1 |",
      "| みかん | 2 |",
      "| りんご飴 | 3 |",
      "",
      "<!-- /table -->",
      "",
      "<!-- table: data +rowlink filter=名前:text -->",
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
  // 実行・検証: 2 つ目の表を絞り込んで #ID を変えると、絞り込みを外して行を強調する
  inputFilterText(second, "ぶどう");
  expect(rowOf(second, "もも").hasAttribute("hidden")).toBe(true);
  location.hash = "#もも";
  await vi.waitFor(() => {
    expect(targets()).toEqual(["もも"]);
  });
  for (const id of ["ぶどう", "もも", "なし"]) {
    expect(rowOf(second, id).hasAttribute("hidden")).toBe(false);
  }
  // 実行・検証: まとめた HTML の # の形でも行を指す
  location.hash = "#/a.md#%E3%81%BF%E3%81%8B%E3%82%93";
  await vi.waitFor(() => {
    expect(targets()).toEqual(["みかん"]);
  });
});

// 数として読めないセルを持つ列の合計と平均は、絞り込んでも空のままにする（正常系）
test("test_attach_tables_when_totals_unreadable", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      "<!-- table: data +total filter=名前:text total=数量:sum,数量:avg,数量:count -->",
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
  // 実行・検証: 読めないセルを隠す絞り込みの後も、合計と平均は空のまま
  inputFilterText(table, "りんご");
  expect(totalRowCells(root)).toEqual([
    ["合計", ""],
    ["平均", ""],
    ["件数", "1"],
  ]);
});

// 集計のメニューで計算の行を隠して出し、読み上げで知らせる（正常系）
test("test_attach_tables_when_totals_toggled", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    [
      "<!-- table: data +total total=数量:sum,数量:avg -->",
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
  // 実行・検証: 平均のチェックを外すと平均の行が隠れる
  checkbox("avg").click();
  expect(avgRow()?.hasAttribute("hidden")).toBe(true);
  expect(toggle.classList.contains("is-active")).toBe(true);
  expect(toggle.textContent).toContain("（1 件を隠しています）");
  expect(statusText(root)).toBe("平均の行を隠しました");
  // 実行・検証: 入れ直すと戻る
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

// 行へのリンクの印を押すと行の絶対 URL を写し、知らせを 2 秒出す（正常系）
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
      "<!-- table: data +rowlink -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 1 |",
      "| みかん | 2 |",
      "",
      "<!-- /table -->",
      "",
      "<!-- table: data +rowlink -->",
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
      throw new Error(`知らせの要素が無い: ${id}`);
    }
    return notice;
  };
  // 実行: 1 つ目の表の行のリンクを押す（書ける）
  findButtonLike(rowOf("みかん"), "a.mdmark-row-anchor").click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 解決済みの絶対 URL を写し、知らせを出す
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
  // 検証: 書けなかったことを知らせ、行へは移る
  expect(noticeOf("もも").dataset.state).toBe("failed");
  expect(noticeOf("もも").textContent).toBe("リンクをコピーできませんでした");
  expect(rowOf("もも").hasAttribute("data-target")).toBe(true);
  // 実行・検証: 2 秒たつと知らせが空になり、状態も外れる
  await vi.advanceTimersByTimeAsync(2000);
  for (const id of ["みかん", "もも"]) {
    expect(noticeOf(id).textContent).toBe("");
    expect(noticeOf(id).hasAttribute("data-state")).toBe(false);
  }
});

/** 390px の幅で 1 行に収まらない説明を最終列に持つ、3 列 3 行の表 */
const FOLDABLE_TABLE = [
  "| 名前 | 状態 | 説明 |",
  "| --- | --- | --- |",
  "| りんご | 新規 | 描画を速くするために、見出しの ID を作る処理を 1 回にまとめる改善の説明 |",
  "| みかん | 進行 | 印刷で折り畳みを開き、リンクの URL を併記して紙に収める変更の説明 |",
  "| ぶどう | 完了 | 表の見出し行を画面の上端に留めて、縦に長い表を読みやすくする変更の説明 |",
  "",
].join("\n");

/** 描く先の要素の幅を決める */
function setRootWidth(root: HTMLElement, width: number): void {
  root.style.boxSizing = "border-box";
  root.style.width = `${width}px`;
}

// 狭い幅で折り返す最終列を畳み、開閉し、広げると畳みを外す（正常系）
test("test_attach_tables_when_folded", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    `${FOLDABLE_TABLE}\n| A | B |\n| --- | --- |\n| 1 | 2 |\n`,
  );
  setRootWidth(root, 390);
  detachers.push(attachTables(root));
  const [folded, short] = [
    ...root.querySelectorAll<HTMLElement>(".mdmark-table"),
  ];
  // 検証: 付けた後は 1 つ目の表だけ畳み、各行に開閉のボタンがある
  await vi.waitFor(() => {
    expect(folded.classList.contains("is-folded")).toBe(true);
  });
  expect(short.classList.contains("is-folded")).toBe(false);
  const toggles = [
    ...folded.querySelectorAll<HTMLButtonElement>("button.mdmark-fold-toggle"),
  ];
  expect(toggles).toHaveLength(3);
  for (const toggle of toggles) {
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  }
  expect(short.querySelector(".mdmark-fold-toggle")).toBeNull();
  // 実行・検証: 1 行目のボタンを押すと、直後に最終列の見出しと中身が開く
  toggles[0].click();
  expect(toggles[0].getAttribute("aria-expanded")).toBe("true");
  const detail = toggles[0].closest("tr")?.nextElementSibling;
  expect(detail?.classList.contains("mdmark-fold-detail")).toBe(true);
  expect(detail?.hasAttribute("hidden")).toBe(false);
  expect(detail?.querySelector(".mdmark-fold-name")?.textContent).toBe("説明");
  // 実行・検証: 幅を広げると畳みを外す
  setRootWidth(root, 800);
  await vi.waitFor(() => {
    expect(folded.classList.contains("is-folded")).toBe(false);
  });
  expect(folded.querySelector(".mdmark-fold-toggle")).toBeNull();
  expect(folded.querySelector(".mdmark-fold-detail")).toBeNull();
});

// 行の詳細を持つ行は、詳細の中身の上に最終列を置いて詳細のボタンだけで開閉する（正常系）
test("test_attach_tables_when_folded_with_row_detail", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { attachSections } = await import(
    "../../../../src/interact/sections.ts"
  );
  const { root } = createRoot(
    `${FOLDABLE_TABLE}\n<!-- row-detail: 2 -->\n\nみかんの詳細\n\n<!-- /row-detail -->\n`,
  );
  setRootWidth(root, 390);
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  detachers.push(attachTables(root));
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  await vi.waitFor(() => {
    expect(table?.classList.contains("is-folded")).toBe(true);
  });
  const rows = bodyRows(root);
  // 検証: 2 行目は最終列の開閉のボタンを持たず、1・3 行目は持つ
  expect(rows[1].querySelector(".mdmark-fold-toggle")).toBeNull();
  expect(rows[0].querySelector(".mdmark-fold-toggle")).not.toBeNull();
  expect(rows[2].querySelector(".mdmark-fold-toggle")).not.toBeNull();
  // 検証: 詳細の行の中身の先頭に最終列がある
  const detail = rows[1].nextElementSibling;
  expect(detail?.classList.contains("mdmark-row-detail")).toBe(true);
  expect(detail?.querySelector(".mdmark-fold-part")).not.toBeNull();
  expect(detail?.querySelector(".mdmark-fold-name")?.textContent).toBe("説明");
  // 実行・検証: 詳細のボタンを押すと詳細の行が開く
  rows[1].querySelector<HTMLButtonElement>("button.mdmark-row-toggle")?.click();
  expect(detail?.hasAttribute("hidden")).toBe(false);
});

// 列の表示で最終列を隠すと畳みを外し、前の列を最終列として決め直す（正常系）
test("test_attach_tables_when_fold_column_hidden", async () => {
  // 準備
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(
    `<!-- table: data +columns -->\n\n${FOLDABLE_TABLE}\n<!-- /table -->\n`,
  );
  setRootWidth(root, 390);
  detachers.push(attachTables(root));
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  await vi.waitFor(() => {
    expect(table?.classList.contains("is-folded")).toBe(true);
  });
  // 実行: 列の表示で説明のチェックを外す
  findButton(root, "button.mdmark-columns-toggle").click();
  const checkboxes = [
    ...root.querySelectorAll<HTMLInputElement>(
      '.mdmark-columns-menu input[type="checkbox"]',
    ),
  ];
  checkboxes[2].click();
  // 検証: 畳みを外し、説明の列を隠す
  await vi.waitFor(() => {
    expect(table?.classList.contains("is-folded")).toBe(false);
  });
  expect(table?.querySelector(".mdmark-fold-toggle")).toBeNull();
  expect(table?.querySelector(".mdmark-fold-detail")).toBeNull();
  expect(root.querySelectorAll("thead th")[2]?.hasAttribute("hidden")).toBe(
    true,
  );
});
