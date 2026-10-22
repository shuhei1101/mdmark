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

/** 数として読めるセルの文字（`,` を除く）を数にする。読めなければ `undefined` */
function toNumber(text: string): number | undefined {
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
  const left = toNumber(a);
  const right = toNumber(b);
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
  count: "個数",
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
    .map(toNumber)
    .filter((value): value is number => value !== undefined);
  const sum = numbers.reduce((total, value) => total + value, 0);
  if (calc === "sum") {
    return totalFormat.format(sum);
  }
  return numbers.length > 0
    ? totalFormat.format(sum / numbers.length)
    : NO_VALUE;
}

/** 行ごとのセルの文字を、セルをタブで、行を改行で区切った文字にする。セルの中のタブと改行は空白 1 つにする */
export function tableToTsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => cell.replace(/[\t\r\n]+/g, " ")).join("\t"))
    .join("\n");
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
