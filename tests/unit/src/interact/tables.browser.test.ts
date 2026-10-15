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

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
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
