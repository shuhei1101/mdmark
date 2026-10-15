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
