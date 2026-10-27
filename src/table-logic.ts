/** 絞り込みの種類 */
export type FilterKind = "select" | "text" | "date";

/** `filter=` に書ける絞り込みの種類。省いたときは先頭 */
export const FILTER_KINDS: readonly FilterKind[] = ["select", "text", "date"];

/** 列 1 つに当てた絞り込み */
export type FilterValue = {
  /** 列の位置 */
  column: number;
  /** `select` の選んだ値 */
  values?: string[] | undefined;
  /** `text` の含む文字 */
  text?: string | undefined;
  /** `date` の開始日（`YYYY-MM-DD`） */
  from?: string | undefined;
  /** `date` の終了日（`YYYY-MM-DD`） */
  to?: string | undefined;
};

/** セルの文字の前後の空白と `,` を除いて数にする。空か数として読めなければ `undefined` */
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

/** 日付として読めるセルの文字を `YYYY-MM-DD` にする。読めなければ `undefined` */
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

/** `total=列名:計算` に書ける計算。集計の行の題は `TOTAL_LABELS` */
export const TOTAL_CALCS: readonly TotalCalc[] = ["sum", "avg", "count"];

/** 集計の行に出す題 */
export const TOTAL_LABELS: Readonly<Record<TotalCalc, string>> = {
  sum: "合計",
  avg: "平均",
  count: "件数",
};

/** 平均する値が無いときの表示 */
const NO_VALUE = "—";

/** 集計の値の書式: 桁区切りを付け、小数は 2 桁までにする */
const totalFormat = new Intl.NumberFormat("ja", { maximumFractionDigits: 2 });

/** セルの文字を集計して表示する文字にする。`sum`・`avg` は数として読めるセルだけ、`count` は空でないセルを数える */
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

/** 数として読めない値を持つ、集計する列と計算 */
export type UnreadableTotal = {
  column: number;
  calc: "sum" | "avg";
  /** 読めないセルの文字（重なりを除いて現れた順） */
  values: string[];
};

/** `sum`・`avg` の列ごとに、空でなく数として読めないセルの文字を集める。読めないセルが無い列と計算、`count` は返さない */
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

/** `animation-timeline` を持つブラウザで、CSS のアニメーションが使う動く範囲（px）を求める。集計の行が無ければ `footMax`・`footEnd` は 0 */
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

/** `location.hash` の最後の `#` の後ろを戻した文字を返す。戻せないときはそのまま、`#` が無ければ空文字 */
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
