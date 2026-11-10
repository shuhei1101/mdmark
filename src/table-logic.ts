import type { TablePinMode } from "./config.ts";

/** 絞り込みの種類 */
export type FilterKind = "select" | "text" | "date";

/** `filter=` に記載できる絞り込みの種類。省いたときは先頭 */
export const FILTER_KINDS: readonly FilterKind[] = ["select", "text", "date"];

/** 列 1 つに適用した絞り込み */
export type FilterValue = {
  /** 列の位置 */
  column: number;
  /** `select` の選んだ値 */
  values?: string[] | undefined;
  /** `text` のキーワード */
  text?: string | undefined;
  /** `date` の開始日（`YYYY-MM-DD`） */
  from?: string | undefined;
  /** `date` の終了日（`YYYY-MM-DD`） */
  to?: string | undefined;
};

/** セルの文字の前後の空白と `,` を除いて数にする。空か数として読み込めなければ `undefined` */
export function parseNumberCell(text: string): number | undefined {
  const normalized = text.replaceAll(",", "").trim();
  if (normalized === "" || !Number.isFinite(Number(normalized))) {
    return undefined;
  }
  return Number(normalized);
}

/** 文字の並べ替えの照合: 日本語の辞書の順で、数字を数として比べる */
const collator = new Intl.Collator("ja", { numeric: true });

/** 並べ替えの比較。両方が数値なら数の大きさ、それ以外は辞書の順で比べる */
export function compareCells(a: string, b: string): number {
  const left = parseNumberCell(a);
  const right = parseNumberCell(b);
  if (left !== undefined && right !== undefined) {
    return left - right;
  }
  return collator.compare(a, b);
}

/** 日付として読み込めるセルの文字を `YYYY-MM-DD` にする。読み込めなければ `undefined` */
function toIsoDate(text: string): string | undefined {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text.trim());
  if (!match) {
    return undefined;
  }
  const [, year, month, day] = match;
  return `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
}

/** セルが絞り込みに合うか。値が空の絞り込みは全てに合う */
export function matchesFilter(
  cell: string,
  kind: FilterKind,
  value: FilterValue,
): boolean {
  if (kind === "select") {
    return !value.values?.length || value.values.includes(cell);
  }
  if (kind === "text") {
    return !value.text || cell.toLowerCase().includes(value.text.toLowerCase());
  }
  if (!value.from && !value.to) {
    return true;
  }
  const date = toIsoDate(cell);
  if (date === undefined) {
    return false;
  }
  return (!value.from || date >= value.from) && (!value.to || date <= value.to);
}

/** 集計の計算 */
export type TotalCalc = "sum" | "avg" | "count";

/** `total=列名:計算` に記載できる計算。集計の行のタイトルは `TOTAL_LABELS` */
export const TOTAL_CALCS: readonly TotalCalc[] = ["sum", "avg", "count"];

/** 集計の行に出すタイトル */
export const TOTAL_LABELS: Readonly<Record<TotalCalc, string>> = {
  sum: "合計",
  avg: "平均",
  count: "件数",
};

/** 平均する値が無いときの表示 */
const NO_VALUE = "—";

/** 集計の値の書式: 桁区切りを付け、小数は 2 桁までにする */
const totalFormat = new Intl.NumberFormat("ja", { maximumFractionDigits: 2 });

/** セルの文字を集計して表示する文字にする。`sum`・`avg` は数として読み込めるセルだけ、`count` は空でないセルを数える */
export function computeTotal(cells: string[], calc: TotalCalc): string {
  if (calc === "count") {
    return totalFormat.format(
      cells.filter((cell) => cell.trim() !== "").length,
    );
  }
  const numbers = cells
    .map(parseNumberCell)
    .filter((value): value is number => value !== undefined);
  const sum = numbers.reduce((total, value) => total + value, 0);
  if (calc === "sum") {
    return totalFormat.format(sum);
  }
  return numbers.length > 0
    ? totalFormat.format(sum / numbers.length)
    : NO_VALUE;
}

/** 集計する列と計算 */
export type TotalSpec = { column: number; calc: TotalCalc };

/** 数として読み込めない値を持つ、集計する列と計算 */
export type UnreadableTotal = {
  column: number;
  calc: "sum" | "avg";
  /** 読み込めないセルの文字（重なりを除いて現れた順） */
  values: string[];
};

/** `sum`・`avg` の列ごとに、空でなく数として読み込めないセルの文字を集める。読み込めないセルが無い列と計算、`count` は返却しない */
export function findUnreadableTotals(options: {
  rows: string[][];
  totals: TotalSpec[];
}): UnreadableTotal[] {
  const { rows, totals } = options;
  const found: UnreadableTotal[] = [];
  for (const { column, calc } of totals) {
    if (calc === "count") {
      continue;
    }
    const values = new Set<string>();
    for (const row of rows) {
      const cell = row[column] ?? "";
      if (cell.trim() !== "" && parseNumberCell(cell) === undefined) {
        values.add(cell);
      }
    }
    if (values.size > 0) {
      found.push({ column, calc, values: [...values] });
    }
  }
  return found;
}

/** 行ごとのセルの文字を、セルをタブで、行を改行で区切った文字にする。セルの中のタブと改行は空白 1 つにする */
export function tableToTsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => cell.replace(/[\t\r\n]+/g, " ")).join("\t"))
    .join("\n");
}

/** 行ごとのセルの文字を、先頭の行を見出しの行にした Markdown の表にする。セルの中の `|` は `\|` にし、改行は空白 1 つにする */
export function tableToMarkdown(rows: string[][]): string {
  const line = (row: string[]): string =>
    `| ${row.map((cell) => cell.replace(/[\r\n]+/g, " ").replaceAll("|", "\\|")).join(" | ")} |`;
  const [head, ...body] = rows;
  if (head === undefined) {
    return "";
  }
  const separator = `| ${head.map(() => "---").join(" | ")} |`;
  return [line(head), separator, ...body.map(line)].join("\n");
}

/** 描く先の要素の中身の幅（px）がこの値未満のときだけ最終列を畳む */
export const FOLD_MAX_WIDTH = 720;

/** 最終列を畳むか。幅が `FOLD_MAX_WIDTH` 未満で、表示している最終列が先頭の列でなく、そのセルのどれかが 1 行に収まらないときだけ `true` */
export function shouldFold(options: {
  width: number;
  lastColumn: number;
  wraps: boolean;
}): boolean {
  const { width, lastColumn, wraps } = options;
  return width < FOLD_MAX_WIDTH && lastColumn > 0 && wraps;
}

/** `animation-timeline` を持たないブラウザで、見出し行を下げる量（0 以上）と集計の行を動かす量（0 以下。集計の行が無ければ 0）を、ずらす前の位置から求める */
export function stickyShift(options: {
  stickyTop: number;
  viewportBottom: number;
  headTop: number;
  headBottom: number;
  bodyTop: number;
  bodyBottom: number;
  footTop?: number | undefined;
  footBottom?: number | undefined;
}): { head: number; foot: number } {
  const { stickyTop, viewportBottom, headTop, headBottom } = options;
  const { bodyTop, bodyBottom, footTop, footBottom } = options;
  const headMax = Math.max(bodyBottom - headBottom, 0);
  const head = Math.min(Math.max(stickyTop - headTop, 0), headMax);
  if (footTop === undefined || footBottom === undefined) {
    return { head, foot: 0 };
  }
  const footMin = Math.min(bodyTop - footTop, 0);
  const foot = Math.max(Math.min(viewportBottom - footBottom, 0), footMin);
  return { head, foot };
}

/** `animation-timeline` を持つブラウザで、CSS のアニメーションが使用する動く範囲（px）を求める。集計の行が無ければ `footMax`・`footEnd` は 0 */
export function stickyRange(options: {
  tableTop: number;
  tableBottom: number;
  headTop: number;
  headBottom: number;
  bodyTop: number;
  bodyBottom: number;
  footTop?: number | undefined;
  footBottom?: number | undefined;
}): { headStart: number; headMax: number; footMax: number; footEnd: number } {
  const { tableTop, tableBottom, headTop, headBottom } = options;
  const { bodyTop, bodyBottom, footTop, footBottom } = options;
  const headStart = headTop - tableTop;
  const headMax = Math.max(bodyBottom - headBottom, 0);
  if (footTop === undefined || footBottom === undefined) {
    return { headStart, headMax, footMax: 0, footEnd: 0 };
  }
  return {
    headStart,
    headMax,
    footMax: Math.max(footTop - bodyTop, 0),
    footEnd: tableBottom - footBottom,
  };
}

/** `location.hash` の最後の `#` の後ろを戻した文字を返却する。戻せないときはそのまま、`#` が無ければ空文字 */
export function rowIdFromHash(hash: string): string {
  const position = hash.lastIndexOf("#");
  if (position < 0) {
    return "";
  }
  const raw = hash.slice(position + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 見出しの行ごとのセルの `rowspan`・`colspan` から、列ごとに、その列だけを覆い最下段まで届くセルの位置を返却する。複数の列をまたぐセルしか無い列は `undefined` */
export function bottomHeadCells(
  rows: Array<Array<{ rowSpan: number; colSpan: number }>>,
): Array<{ row: number; cell: number } | undefined> {
  // 格子の行ごとに、上の行から縦に結合したセルが覆う列を記録する
  const grid: Array<Array<{ row: number; cell: number; colSpan: number }>> =
    rows.map(() => []);
  for (const [row, cells] of rows.entries()) {
    let column = 0;
    for (const [cell, span] of cells.entries()) {
      while (grid[row]?.[column]) {
        column += 1;
      }
      for (let r = row; r < Math.min(rows.length, row + span.rowSpan); r++) {
        for (let c = column; c < column + span.colSpan; c++) {
          const line = grid[r];
          if (line) {
            line[c] = { row, cell, colSpan: span.colSpan };
          }
        }
      }
      column += span.colSpan;
    }
  }
  const bottom = grid.at(-1) ?? [];
  return Array.from(bottom, (item) =>
    item && item.colSpan === 1 ? { row: item.row, cell: item.cell } : undefined,
  );
}

/** 表示している行の結合する列の値から、列ごとに隣り合う同じ値の範囲の `rowspan` を決める。範囲の始まりは覆う行の数、続く行は 0。左にある結合する列の範囲の切れ目でも切る */
export function mergeSpans(options: {
  values: string[][];
  columns: number[];
}): number[][] {
  const { values, columns } = options;
  const spans = values.map(() => columns.map(() => 1));
  // 列ごとの、今の範囲の始まりの行
  const starts = columns.map(() => 0);
  for (let row = 1; row < values.length; row++) {
    let broken = false;
    for (const [index] of columns.entries()) {
      const start = starts[index] ?? 0;
      const same = values[row]?.[index] === values[start]?.[index];
      if (broken || !same) {
        broken = true;
        starts[index] = row;
        continue;
      }
      const startSpans = spans[start];
      const rowSpans = spans[row];
      if (startSpans && rowSpans) {
        startSpans[index] = (startSpans[index] ?? 1) + 1;
        rowSpans[index] = 0;
      }
    }
  }
  return spans;
}

/** 先頭から `last` までの列の位置を返却する（`last` が負なら空） */
const columnsThrough = (last: number): number[] =>
  Array.from({ length: Math.max(0, last + 1) }, (_, index) => index);

/** `data-pin` の位置・行見出しの列の数・ピン止めの動きから、描いた直後に留める列の位置を小さい順に返却する */
export const initialPinnedColumns = (options: {
  /** `data-pin` の位置（無ければ空） */
  pin: number[];
  /** `th scope="row"` の行見出しの列の数 */
  rowHeadCount: number;
  /** ピン止めの動き */
  mode: TablePinMode;
}): number[] => {
  const { pin, rowHeadCount, mode } = options;
  // 留める元の列は、pin= の列、無ければ行見出しの全ての列、行見出しも無ければ先頭の列
  const base =
    pin.length > 0
      ? [...new Set(pin)].sort((a, b) => a - b)
      : columnsThrough(Math.max(1, rowHeadCount) - 1);
  return mode === "each" ? base : columnsThrough(Math.max(...base));
};

/** ピン止めのボタンを押した列と今の留める列から、新しい留める列の位置を小さい順に返却する（指定された配列は書き換えない） */
export const togglePinnedColumn = (options: {
  /** 今の留める列 */
  pinned: number[];
  /** 押した列の位置 */
  column: number;
  /** ピン止めの動き */
  mode: TablePinMode;
}): number[] => {
  const { pinned, column, mode } = options;
  if (mode === "each") {
    // 押した列が留める列にあれば除き、無ければ加える
    return pinned.includes(column)
      ? pinned.filter((item) => item !== column)
      : [...pinned, column].sort((a, b) => a - b);
  }
  // 押した列が留める列の最も右なら解除し、それ以外は押した列までにする
  return Math.max(-1, ...pinned) === column ? [] : columnsThrough(column);
};

/** 列ごとの幅と留める列から、留める列ごとにそれより左で留めた列の幅の合計（`start`）と右で留めた列の幅の合計（`end`）を返却する */
export const pinOffsets = (options: {
  /** 列ごとの幅（隠した列は 0） */
  widths: number[];
  /** 留める列の位置 */
  pinned: number[];
}): Map<number, { start: number; end: number }> => {
  const { widths, pinned } = options;
  const sorted = [...new Set(pinned)].sort((a, b) => a - b);
  const total = sorted.reduce((sum, column) => sum + (widths[column] ?? 0), 0);
  const offsets = new Map<number, { start: number; end: number }>();
  let start = 0;
  for (const column of sorted) {
    const width = widths[column] ?? 0;
    offsets.set(column, { start, end: total - start - width });
    start += width;
  }
  return offsets;
};

/** 列の幅を、列の最小幅から上限までに収めた値を返却する。上限が最小幅より小さいときは最小幅を返す */
export const clampColumnWidth = (options: {
  /** 指定したい幅（px） */
  width: number;
  /** 列の最小幅（px） */
  min: number;
  /** 上限（px） */
  max: number;
}): number => {
  const { width, min, max } = options;
  return Math.max(min, Math.min(width, max));
};

/** 表の見えている幅から、ほかに留めている列の幅の合計を引いた幅を返却する。表がはみ出していないときは見えている幅をそのまま返す */
export const columnWidthLimit = (options: {
  /** 表を包む要素の `clientWidth` */
  visibleWidth: number;
  /** 表がはみ出しているか */
  overflowing: boolean;
  /** 列ごとの幅（隠した列は 0） */
  widths: number[];
  /** 留めている列の位置 */
  pinned: number[];
  /** 幅を変える列の位置 */
  column: number;
}): number => {
  const { visibleWidth, overflowing, widths, pinned, column } = options;
  if (!overflowing) {
    return visibleWidth;
  }
  const others = [...new Set(pinned)]
    .filter((item) => item !== column)
    .reduce((sum, item) => sum + (widths[item] ?? 0), 0);
  return visibleWidth - others;
};

/** 列が属する結合した見出しの範囲とピン止めの側 */
export type ColumnPlace = {
  /** 結合した見出しの範囲（`{行}:{位置}`。範囲の外は `undefined`） */
  group: string | undefined;
  /** ピン止めした列か */
  pinned: boolean;
};

/** 動かす列と動かす先の列が同じ結合した見出しの範囲で、ピン止めの同じ側にあるときだけ `true` を返却する */
export function canMoveColumn(options: {
  from: ColumnPlace;
  to: ColumnPlace;
}): boolean {
  const { from, to } = options;
  return from.group === to.group && from.pinned === to.pinned;
}

/** 列の順（元の列の位置の並び）の `column` を `target` の前か後ろへ動かした新しい並びを返却する */
export function moveColumn(options: {
  /** 今の列の順 */
  order: number[];
  /** 動かす列（元の列の位置） */
  column: number;
  /** 動かす先の列（元の列の位置） */
  target: number;
  /** `target` の前か後ろか */
  side: "before" | "after";
}): number[] {
  const { order, column, target, side } = options;
  if (column === target) {
    return [...order];
  }
  const rest = order.filter((value) => value !== column);
  const at = rest.indexOf(target);
  if (at === -1) {
    return [...order];
  }
  rest.splice(side === "before" ? at : at + 1, 0, column);
  return rest;
}
