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
  return matchesDateRange(cell, value);
}

/** セルの日付が、絞り込みの期間（`from`・`to`。両方空なら全て）に入るか。日付として読めないセルは入らない */
function matchesDateRange(cell: string, value: FilterValue): boolean {
  const { from, to } = value;
  if (!from && !to) {
    return true;
  }
  const date = toIsoDate(cell);
  if (date === undefined) {
    return false;
  }
  return (!from || date >= from) && (!to || date <= to);
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

/** 見出しの格子のうち、セルが覆うマス（格子の最下段まで）にセルの位置を記録する */
function fillGrid(
  grid: Array<Array<{ row: number; cell: number; colSpan: number }>>,
  at: {
    row: number;
    cell: number;
    column: number;
    span: { rowSpan: number; colSpan: number };
  },
): void {
  const { row, cell, column, span } = at;
  const end = Math.min(grid.length, row + span.rowSpan);
  for (const line of grid.slice(row, end)) {
    for (let c = column; c < column + span.colSpan; c++) {
      line[c] = { row, cell, colSpan: span.colSpan };
    }
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
      fillGrid(grid, { row, cell, column, span });
      column += span.colSpan;
    }
  }
  const bottom = grid.at(-1) ?? [];
  return Array.from(bottom, (item) =>
    item && item.colSpan === 1 ? { row: item.row, cell: item.cell } : undefined,
  );
}

/** 結合する列の範囲に行を加える: 範囲の始まりの行の `rowspan` を 1 つ増やし、加えた行を 0 にする */
function joinSpan(
  spans: number[][],
  at: { start: number; row: number; index: number },
): void {
  const startSpans = spans[at.start];
  const rowSpans = spans[at.row];
  if (startSpans && rowSpans) {
    startSpans[at.index] = (startSpans[at.index] ?? 1) + 1;
    rowSpans[at.index] = 0;
  }
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
    // 最初に値が変わった列から右は、範囲を切る
    const found = columns.findIndex(
      (_, index) =>
        values[row]?.[index] !== values[starts[index] ?? 0]?.[index],
    );
    const breakAt = found === -1 ? columns.length : found;
    for (const [index] of columns.entries()) {
      if (index >= breakAt) {
        starts[index] = row;
      } else {
        joinSpan(spans, { start: starts[index] ?? 0, row, index });
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
  /** `data-unpin` の位置（既定で留める列から除く。無ければ空） */
  unpin?: number[];
}): number[] => {
  const { pin, rowHeadCount, mode, unpin = [] } = options;
  // 留める元の列は、pinned の列、無ければ行見出しの全ての列（行見出しも無ければ先頭の列）から pinned の false の列を除いたもの
  const base =
    pin.length > 0
      ? [...new Set(pin)].sort((a, b) => a - b)
      : columnsThrough(Math.max(1, rowHeadCount) - 1).filter(
          (column) => !unpin.includes(column),
        );
  if (base.length === 0) {
    return [];
  }
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

/** 選んだ列を左から順に幅を足し、表の見えている幅に収まる列（`fitted`）と、見えている幅を超える列から右の列（`unpinned`）に分けて返却する */
export const fitPinnedColumns = (options: {
  /** 列ごとの幅（隠した列は 0） */
  widths: number[];
  /** 選んだ列の位置 */
  pinned: number[];
  /** 表を包む要素の `clientWidth` */
  visibleWidth: number;
}): { fitted: number[]; unpinned: number[] } => {
  const { widths, pinned, visibleWidth } = options;
  const sorted = [...new Set(pinned)].sort((a, b) => a - b);
  const fitted: number[] = [];
  let total = 0;
  for (const [index, column] of sorted.entries()) {
    total += widths[column] ?? 0;
    // 超えた列より右の列は、幅が小さくても留めない
    if (total > visibleWidth) {
      return { fitted, unpinned: sorted.slice(index) };
    }
    fitted.push(column);
  }
  return { fitted, unpinned: [] };
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

/** 改行で分けた 1 行がこの文字数（コードポイントの数）以上のセルを持つ列を長文の列にする */
export const LONG_COLUMN_CHARS = 20;

/** 設定の `table.long_column_min` が無いか読み込めないときの、長文の列の最小の幅（em） */
export const DEFAULT_LONG_COLUMN_MIN_EM = 45;

/** 数値（`,`・`.`・`%` を含む）の文字 */
const NUMBER_TEXT = /^[-+]?[\d,.]+%?$/;

/** 日付（`YYYY-MM-DD`・`YYYY/M/D`）の文字 */
const DATE_TEXT = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;

/** チェックの印 */
const CHECK_TEXT = /^[✓✔]$/;

/** セルの文字が、空・数値・日付・✓ のどれかなら `true` */
export const isCompactCellText = (text: string): boolean =>
  text === "" ||
  NUMBER_TEXT.test(text) ||
  DATE_TEXT.test(text) ||
  CHECK_TEXT.test(text);

/** 列ごとのセルを改行で分けた行（`findLongColumns` の引数） */
export type ColumnLines = {
  /** 見出しのセルの行 */
  head: string[];
  /** 本文のセルごとの行と、短い値だけのセルか */
  cells: { lines: string[]; compact: boolean }[];
};

/** 行の文字数（コードポイントの数）が `LONG_COLUMN_CHARS` 以上か */
const isLongLine = (line: string): boolean =>
  [...line].length >= LONG_COLUMN_CHARS;

/** 本文のセルが全て短い値でなく、見出しか本文のセルの行のどれかが `LONG_COLUMN_CHARS` 文字以上の列の位置を、小さい順に返却する */
export const findLongColumns = (columns: ColumnLines[]): number[] =>
  columns.flatMap((column, index) => {
    const allCompact =
      column.cells.length > 0 && column.cells.every((cell) => cell.compact);
    const longCell = column.cells.some(
      (cell) => !cell.compact && cell.lines.some(isLongLine),
    );
    return !allCompact && (column.head.some(isLongLine) || longCell)
      ? [index]
      : [];
  });

/** 長文の列のうち `sorts` で `true` を指定していない列と、`sorts` で `false` を指定した列の位置を、小さい順に返却する */
export const findNoSortColumns = (options: {
  /** 長文の列の位置 */
  long: number[];
  /** `columns.{列名}.sort` を記載した列と値 */
  sorts: Array<{ column: number; sort: boolean }>;
}): number[] => {
  const { long, sorts } = options;
  const sortOf = new Map(sorts.map(({ column, sort }) => [column, sort]));
  const columns = new Set([
    ...long.filter((column) => sortOf.get(column) !== true),
    ...sorts.filter(({ sort }) => !sort).map(({ column }) => column),
  ]);
  return [...columns].sort((a, b) => a - b);
};

/** `filter.type` を省いた列の絞り込みの種類。長文の列なら `text`、ほかは `select` */
export const defaultFilterKind = (long: boolean): FilterKind =>
  long ? "text" : "select";

/** 列の折り返すかと最小の幅・望む幅（px） */
export type ColumnBounds = { wraps: boolean; min: number; wanted: number };

/** 列が折り返すかと最小の幅・望む幅を決める（読者がつまみで幅を変えた列は呼ぶ側で除く） */
export const columnBounds = (options: {
  /** `width.mode` が `nowrap` か */
  nowrap: boolean;
  /** 長文の列か */
  long: boolean;
  /** `data-width` の範囲（em） */
  range?: { min?: number; max?: number };
  /** 最も長い行の幅（px。セルの余白と罫線を含む） */
  longest: number;
  /** 最も長い半角の単語の幅（px。セルの余白と罫線を含む） */
  longestWord: number;
  /** 表の文字の大きさ（px） */
  em: number;
  /** 長文の列の最小の幅（em） */
  longColumnMin: number;
}): ColumnBounds => {
  const { nowrap, long, range, longest, longestWord, em, longColumnMin } =
    options;
  if (nowrap || (range === undefined && !long)) {
    return { wraps: false, min: longest, wanted: longest };
  }
  const max =
    range?.max === undefined ? Number.POSITIVE_INFINITY : range.max * em;
  const base =
    range?.min === undefined
      ? Math.min(longest, Math.max(longColumnMin * em, longestWord))
      : range.min * em;
  const min = Math.min(base, max);
  return { wraps: true, min, wanted: Math.max(min, Math.min(longest, max)) };
};

/** 折り返す列へ、残りの幅を望む幅の比で分ける。最小の幅を下回る列は最小の幅で止めて、止めた列を除いた残りを分け直す */
const shareRest = (
  wrapping: Array<{ index: number; min: number; wanted: number }>,
  rest: number,
  widths: number[],
): void => {
  let open = wrapping;
  let left = rest;
  for (;;) {
    const total = open.reduce((sum, column) => sum + column.wanted, 0);
    const stopped = open.filter(
      (column) => (left * column.wanted) / total < column.min,
    );
    if (stopped.length === 0) {
      for (const column of open) {
        widths[column.index] = (left * column.wanted) / total;
      }
      return;
    }
    for (const column of stopped) {
      widths[column.index] = column.min;
      left -= column.min;
    }
    open = open.filter((column) => !stopped.includes(column));
    if (open.length === 0) {
      return;
    }
  }
};

/** 列ごとの最小の幅・望む幅と表の見える幅から、列の幅（px）と横にスクロールさせるかを返却する */
export const distributeColumnWidths = (
  columns: Array<ColumnBounds & { fixed?: boolean }>,
  available: number,
): { widths: number[]; overflow: boolean } => {
  const minimum = columns.reduce((sum, column) => sum + column.min, 0);
  if (minimum > available) {
    return { widths: columns.map((column) => column.min), overflow: true };
  }
  const widths = columns.map((column) => column.wanted);
  const wanted = widths.reduce((sum, width) => sum + width, 0);
  if (wanted <= available) {
    return { widths, overflow: false };
  }
  const wrapping = columns.flatMap((column, index) =>
    column.wraps && !column.fixed
      ? [{ index, min: column.min, wanted: column.wanted }]
      : [],
  );
  const fixed = columns
    .filter((column) => !column.wraps || column.fixed)
    .reduce((sum, column) => sum + column.wanted, 0);
  shareRest(wrapping, available - fixed, widths);
  return { widths, overflow: false };
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
