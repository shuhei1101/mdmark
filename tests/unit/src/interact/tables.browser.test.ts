import { afterEach, expect, test, vi } from "vitest";
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

/** 集計の行のセルの文字を、空白を除いて列の順に返す */
function totalTexts(root: HTMLElement): string[] {
  return [...root.querySelectorAll("tfoot td")].map((cell) =>
    (cell.textContent ?? "").replace(/\s+/g, ""),
  );
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

/** `navigator.clipboard.writeText` を差し替える */
function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "clipboard");
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

// 数として読めないセルを除いて合計・平均し、空でないセルを数える（正常系）
test("test_compute_total", async () => {
  // 準備
  const { computeTotal } = await loadLogic();
  // 実行
  const sum = computeTotal(["10", "2", "33", "-"], "sum");
  const avg = computeTotal(["100", "200", "300", "400"], "avg");
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

// 絞り込みに合わせて件数と集計の行を作り直す（正常系）
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
      "| ぶどう | - | 400 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  // 実行・検証: 絞り込む前
  detachers.push(attachTables(root));
  expect(countText(root)).toContain("4 / 4 件");
  expect(totalTexts(root)).toEqual(["個数4", "合計45", "平均250"]);
  // 実行・検証: 「りんご」で絞り込む
  const table = root.querySelector<HTMLElement>(".mdmark-table");
  if (!table) {
    throw new Error("表が無い");
  }
  inputFilterText(table, "りんご");
  expect(countText(root)).toContain("2 / 4 件");
  expect(totalTexts(root)).toEqual(["個数2", "合計43", "平均200"]);
  // 実行・検証: 一致する行が無い
  inputFilterText(table, "存在しない");
  expect(countText(root)).toContain("0 / 4 件");
  expect(totalTexts(root)).toEqual(["個数0", "合計0", "平均—"]);
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

// 表示している行と列を TSV で写し、2 秒でボタンを戻す（正常系）
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
  // 実行
  button.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 写した中身と、写したことの知らせ
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith(
    "名前\t更新日\nりんご\t2026-10-01\nりんご飴\t2026-10-20",
  );
  expect(button.dataset.state).toBe("copied");
  // 実行・検証: 2 秒たつとボタンが戻る
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.dataset.state).toBe("idle");
});

// 拒まれたら failed を残し、例外を外へ出さない（正常系）
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
  button.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 失敗が残り、2 秒たっても戻らず、例外が外へ出ない
  try {
    expect(button.dataset.state).toBe("failed");
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.dataset.state).toBe("failed");
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
