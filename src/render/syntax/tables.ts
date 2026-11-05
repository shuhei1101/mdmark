import type { StateCore, Token } from "markdown-it";
import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
import {
  COLOR_NAMES,
  type ColorName,
  isColorName,
} from "../../parts/colors.ts";
import { markOwn, SLOT_MARKER } from "../../parts/own.ts";
import {
  isCheckValue,
  renderCheckCell,
  renderRowLink,
  renderTable,
  type TableFeature,
  type TableFilter,
  type TableKind,
  type TableTotal,
} from "../../parts/table.ts";
import {
  FILTER_KINDS,
  type FilterKind,
  findUnreadableTotals,
  TOTAL_CALCS,
  TOTAL_LABELS,
  type TotalCalc,
} from "../../table-logic.ts";
import type { Mark } from "../marks.ts";
import { readCollapse } from "./collapse.ts";
import { slugBase } from "./headings.ts";
import { MERGE_LEFT, MERGE_UP, planCellMerges } from "./table-cells.ts";
import {
  envOf,
  featureOn,
  findClose,
  markOf,
  ownBlock,
  textOf,
} from "./tokens.ts";
import {
  type SyntaxWarning,
  unclosedWarning,
  warningBlock,
} from "./warnings.ts";

export { FILTER_KINDS };

/** 表の種類ごとの既定の機能 */
export const TABLE_KINDS: Readonly<Record<TableKind, readonly TableFeature[]>> =
  {
    default: ["pin"],
    data: ["sort", "pin", "filter"],
    plain: [],
  };

/** 表の機能の名前。後ろの 5 つはどの種類の既定にも入らず、`+機能` を書いた表にだけ付く */
export const TABLE_FEATURES: readonly TableFeature[] = [
  "sort",
  "pin",
  "filter",
  "count",
  "columns",
  "total",
  "copy",
  "rowlink",
];

/** 表の印に書ける種類（`default` は印を書かない表の種類） */
const WRITABLE_KINDS = ["data", "plain"];

/** 表の印を読んだ結果 */
export type TableSpec = {
  /** 種類。知らない種類は `default` */
  kind: TableKind;
  /** 種類の機能に `+機能`・`-機能` を当てたもの */
  features: TableFeature[];
  /** 絞り込む列。表に無い列名・知らない種類は入れない */
  filters: TableFilter[];
  /** 折り畳み。`closed` と `open` を両方書いたら `closed` */
  collapse: "none" | "closed" | "open";
  /** 折り畳みの見出し（`title=` の値）。`collapse` が `none` のときと、値の無い `title=` では入れない */
  title?: string | undefined;
  /** 読めなかった指定 */
  warnings: WarningItem[];
  /** `hide=` で既定で隠す列の位置。`columns` の無い表・先頭の列・表に無い列名は入れない */
  hide: number[];
  /** `total=` で集計する列。`total` の無い表・表に無い列名・知らない計算は入れない */
  totals: TableTotal[];
  /** `header-rows=` で `thead` にする表の先頭の行の数（既定 1）。数でない値と、表の行の数以上の値は 1 にする */
  headRows: number;
  /** `row-header=` で `<th scope="row">` にする本文の各行の先頭の列の数（既定 0）。数でない値と、表の列の数以上の値は 0 にする */
  rowHeader: number;
  /** `pin=` で留める最後の列の位置。`pin` の無い表・表に無い列名では入れない */
  pin?: number | undefined;
  /** `wide=` で広く取る列の位置。表に無い列名は入れない */
  wide: number[];
  /** `check=` で真偽値を ✓ と空欄で出す列の位置。表に無い列名は入れない */
  check: number[];
};

/** 表の色の指定を読んだ結果 */
export type TableColors = {
  /** 強調する列の位置と色。色を省いた列は `blue` */
  highlight: Array<{ column: number; color: ColorName }>;
  /** 本文の行ごとの色。色を付けない行は `null` */
  rows: Array<ColorName | null>;
  /** 読めなかった指定 */
  warnings: WarningItem[];
};

/** 表の色を指定するキー */
const COLOR_KEYS = ["highlight", "row-color", "row-at"];

/** `highlight=` で色を省いた列の色 */
const DEFAULT_HIGHLIGHT_COLOR: ColorName = "blue";

/** 並びをコードにして `・` でつなぐ */
export function codes(values: readonly string[]): string {
  return values.map((value) => `\`${value}\``).join("・");
}

/** `filter=` の値を、表の見出しの文字と照らして読む */
export function readFilters(
  value: string,
  headers: string[],
  warnings: WarningItem[],
): TableFilter[] {
  const filters: TableFilter[] = [];
  for (const item of value.split(",").map((part) => part.trim())) {
    if (!item) {
      continue;
    }
    // 列名に `:` を含む表もあるため、見出しの文字と一致するときは丸ごと列名にする
    const colon = headers.includes(item) ? -1 : item.lastIndexOf(":");
    const name = colon > 0 ? item.slice(0, colon) : item;
    const kind = colon > 0 ? item.slice(colon + 1) : "select";
    const column = headers.indexOf(name);
    if (column < 0) {
      warnings.push({
        label: name,
        message: `の列名 \`${name}\` は表にありません。表の見出しの文字で書いてください。`,
      });
    } else if (!FILTER_KINDS.includes(kind as FilterKind)) {
      warnings.push({
        label: kind,
        message: `の絞り込みの種類 \`${kind}\` は使えません。使える種類は ${codes(FILTER_KINDS)} です。\`${name}\` の列には絞り込みを付けずに描いています。`,
      });
    } else {
      filters.push({ column, kind: kind as FilterKind });
    }
  }
  return filters;
}

/** `hide=` の値を、表の見出しの文字と照らして読む。先頭の列は隠せない */
function readHide(
  value: string,
  headers: string[],
  warnings: WarningItem[],
): number[] {
  const hide: number[] = [];
  for (const name of value.split(",").map((part) => part.trim())) {
    if (!name) {
      continue;
    }
    const column = headers.indexOf(name);
    if (column < 0) {
      warnings.push({
        label: name,
        message: `の列名 \`${name}\` は表にありません。表の見出しの文字で書いてください。`,
      });
    } else if (column === 0) {
      warnings.push({
        label: name,
        message: `の列 \`${name}\` は先頭の列のため隠せません。先頭の列は行の識別子と行へのリンクの置き場所なので、隠さずに描いています。`,
      });
    } else if (!hide.includes(column)) {
      hide.push(column);
    }
  }
  return hide;
}

/** `wide=`・`check=` の値を、表の見出しの文字と照らして列の位置にする */
function readColumns(
  value: string,
  headers: string[],
  warnings: WarningItem[],
): number[] {
  const columns: number[] = [];
  for (const name of value.split(",").map((part) => part.trim())) {
    if (!name) {
      continue;
    }
    const column = headers.indexOf(name);
    if (column < 0) {
      warnings.push(unknownColumn(name));
    } else if (!columns.includes(column)) {
      columns.push(column);
    }
  }
  return columns;
}

/** `total=` の値を、表の見出しの文字と照らして読む */
function readTotals(
  value: string,
  headers: string[],
  warnings: WarningItem[],
): TableTotal[] {
  const totals: TableTotal[] = [];
  for (const item of value.split(",").map((part) => part.trim())) {
    if (!item) {
      continue;
    }
    // 列名に `:` を含む表もあるため、`filter=` と同じく見出しの文字と一致するときは丸ごと列名にする
    const colon = headers.includes(item) ? -1 : item.lastIndexOf(":");
    const name = colon > 0 ? item.slice(0, colon) : item;
    const calc = colon > 0 ? item.slice(colon + 1) : "";
    const column = headers.indexOf(name);
    if (column < 0) {
      warnings.push({
        label: name,
        message: `の列名 \`${name}\` は表にありません。表の見出しの文字で書いてください。`,
      });
    } else if (!TOTAL_CALCS.includes(calc as TotalCalc)) {
      warnings.push({
        label: calc || item,
        message: `の計算 \`${calc}\` は使えません。\`total=列名:計算\` の形で書き、使える計算は ${codes(TOTAL_CALCS)} です。\`${name}\` の列は集計せずに描いています。`,
      });
    } else {
      // 同じ列に別の計算を書けるため、列と計算が同じ指定だけを重ねない
      const duplicated = totals.some(
        (total) => total.column === column && total.calc === calc,
      );
      if (!duplicated) {
        totals.push({ column, calc: calc as TotalCalc });
      }
    }
  }
  return totals;
}

/** `header-rows=`・`row-header=` の値を、`limit` 未満の正の整数として読む。読めないときは警告を足して `fallback` を返す */
function readHeaderCount(options: {
  key: string;
  value: string;
  limit: number;
  unit: string;
  fallback: number;
  warnings: WarningItem[];
}): number {
  const { key, value, limit, unit, fallback, warnings } = options;
  const count = /^\d+$/.test(value) ? Number(value) : 0;
  if (count >= 1 && count < limit) {
    return count;
  }
  warnings.push({
    label: `${key}=`,
    message: `\`${value}\` は使えません。1 以上で表の${unit}の数（${limit}）より小さい整数を指定してください。既定の ${fallback} で描いています`,
  });
  return fallback;
}

/** 表の印の引数と表の見出しから `TableSpec` を作る。印が無い表は `default` */
export function readTableSpec(
  args: MdmarkMarkArgs | undefined,
  headers: string[],
  rowCount: number,
): TableSpec {
  const warnings: WarningItem[] = [];
  let kind: TableKind = "default";
  const featureArgs: string[] = [];
  const unknownKinds: string[] = [];
  const { collapse, title, items, rest } = readCollapse(
    args ?? { args: [], keys: {} },
  );
  for (const arg of rest.args) {
    if (arg.startsWith("+") || arg.startsWith("-")) {
      featureArgs.push(arg);
    } else if (WRITABLE_KINDS.includes(arg) && kind === "default") {
      kind = arg as TableKind;
    } else {
      unknownKinds.push(arg);
    }
  }
  // 種類の機能に、`+機能`・`-機能` を書いた順に当てる
  const features: TableFeature[] = [...TABLE_KINDS[kind]];
  const applied: string[] = [];
  const unknownFeatures: string[] = [];
  for (const arg of featureArgs) {
    const name = arg.slice(1) as TableFeature;
    if (!TABLE_FEATURES.includes(name)) {
      unknownFeatures.push(arg);
      continue;
    }
    applied.push(arg);
    const position = features.indexOf(name);
    if (arg.startsWith("+") && position < 0) {
      features.push(name);
    } else if (arg.startsWith("-") && position >= 0) {
      features.splice(position, 1);
    }
  }
  const appliedText = applied.length
    ? `既定の種類に ${codes(applied)} を当てて描いています。`
    : "既定の種類で描いています。";
  for (const unknown of unknownKinds) {
    warnings.push({
      label: unknown,
      message: `の種類 \`${unknown}\` は使えません。使える種類は ${codes(WRITABLE_KINDS)} です。${appliedText}`,
    });
  }
  for (const arg of unknownFeatures) {
    warnings.push({
      label: arg,
      message: `使えない機能です。使える機能は ${codes(TABLE_FEATURES)} です`,
    });
  }
  let filters: TableFilter[] = [];
  let hide: number[] = [];
  let totals: TableTotal[] = [];
  let headRows = 1;
  let rowHeader = 0;
  let pin: number | undefined;
  let wide: number[] = [];
  let check: number[] = [];
  // `hide=` は `columns`、`total=` は `total`、`pin=` は `pin` を付けた表でだけ読む
  const keyFeatures: Record<string, TableFeature> = {
    hide: "columns",
    total: "total",
    pin: "pin",
  };
  for (const [key, value] of Object.entries(rest.keys)) {
    const needed = keyFeatures[key];
    if (needed && !features.includes(needed)) {
      warnings.push({
        label: `${key}=`,
        message: `\`+${needed}\` を書いた表でだけ使えます。当てずに描いています`,
      });
    } else if (key === "filter") {
      filters = readFilters(value, headers, warnings);
    } else if (key === "hide") {
      hide = readHide(value, headers, warnings);
    } else if (key === "total") {
      totals = readTotals(value, headers, warnings);
    } else if (key === "header-rows") {
      headRows = readHeaderCount({
        key,
        value,
        limit: rowCount,
        unit: "行",
        fallback: 1,
        warnings,
      });
    } else if (key === "row-header") {
      rowHeader = readHeaderCount({
        key,
        value,
        limit: headers.length,
        unit: "列",
        fallback: 0,
        warnings,
      });
    } else if (key === "pin") {
      const column = headers.indexOf(value.trim());
      if (column < 0) {
        warnings.push(unknownColumn(value.trim()));
      } else {
        pin = column;
      }
    } else if (key === "wide") {
      wide = readColumns(value, headers, warnings);
    } else if (key === "check") {
      check = readColumns(value, headers, warnings);
    } else if (COLOR_KEYS.includes(key)) {
      // 色の指定は `readTableColors` が読む
    } else {
      warnings.push({
        label: `${key}=`,
        message: `使えないキーです。使えるキーは ${codes(["filter=", "hide=", "total=", "pin=", "wide=", "check=", "header-rows=", "row-header=", ...COLOR_KEYS.map((name) => `${name}=`)])} です`,
      });
    }
  }
  warnings.push(...items);
  return {
    kind,
    features,
    filters,
    collapse,
    title,
    warnings,
    hide,
    totals,
    headRows,
    rowHeader,
    pin,
    wide,
    check,
  };
}

/** 列名が表に無いときの警告の項目 */
function unknownColumn(name: string): WarningItem {
  return {
    label: name,
    message: `の列名 \`${name}\` は表にありません。表の見出しの文字で書いてください。`,
  };
}

/** 色の名前が一覧に無いときの警告の項目 */
function unknownColor(name: string): WarningItem {
  return {
    label: name,
    message: `の \`${name}\` は色の名前ではありません。使える色の名前は ${codes(COLOR_NAMES)} です。色を付けずに描いています。`,
  };
}

/** `=` の無い項目の警告の項目 */
function missingEquals(item: string, form: string): WarningItem {
  return {
    label: item,
    message: `の \`${item}\` に \`=\` がありません。\`${form}\` の形で書いてください。`,
  };
}

/** `highlight=` の値を、表の見出しの文字と照らして読む */
function readHighlight(
  value: string,
  headers: string[],
  warnings: WarningItem[],
): TableColors["highlight"] {
  const highlight: TableColors["highlight"] = [];
  for (const item of value.split(",").map((part) => part.trim())) {
    if (!item) {
      continue;
    }
    // 列名に `:` を含む表もあるため、見出しの文字と一致するときは丸ごと列名にする
    const colon = headers.includes(item) ? -1 : item.lastIndexOf(":");
    const name = colon > 0 ? item.slice(0, colon) : item;
    const color = colon > 0 ? item.slice(colon + 1) : DEFAULT_HIGHLIGHT_COLOR;
    const column = headers.indexOf(name);
    if (column < 0) {
      warnings.push(unknownColumn(name));
    } else if (!isColorName(color)) {
      warnings.push(unknownColor(color));
    } else {
      highlight.push({ column, color });
    }
  }
  return highlight;
}

/** 項目の頭の `列名:` が表の見出しに当たれば、列の位置と残りの文字を返す */
function splitColumnHead(
  item: string,
  headers: string[],
): { column: number; rest: string } | undefined {
  for (
    let colon = item.indexOf(":");
    colon > 0;
    colon = item.indexOf(":", colon + 1)
  ) {
    const column = headers.indexOf(item.slice(0, colon));
    if (column >= 0) {
      return { column, rest: item.slice(colon + 1) };
    }
  }
  return undefined;
}

/** `row-color=` の値を、見出しと本文のセルの文字と照らして読み、行の色を `rows` に書く */
function readRowColor(
  value: string,
  headers: string[],
  cells: string[][],
  rows: TableColors["rows"],
  warnings: WarningItem[],
): void {
  let column: number | undefined;
  for (const item of value.split(",").map((part) => part.trim())) {
    if (!item) {
      continue;
    }
    const head = splitColumnHead(item, headers);
    let pair = item;
    if (head) {
      column = head.column;
      pair = head.rest;
    } else if (column === undefined) {
      const colon = item.indexOf(":");
      warnings.push(unknownColumn(colon > 0 ? item.slice(0, colon) : item));
      continue;
    }
    const equals = pair.lastIndexOf("=");
    if (equals < 0) {
      warnings.push(missingEquals(pair, "列名:値=色"));
      continue;
    }
    const color = pair.slice(equals + 1);
    if (!isColorName(color)) {
      warnings.push(unknownColor(color));
      continue;
    }
    const cell = pair.slice(0, equals);
    for (const [row, values] of cells.entries()) {
      if (values[column]?.trim() === cell) {
        rows[row] = color;
      }
    }
  }
}

/** `row-at=` の値を、本文の行の数と照らして読み、行の色を `rows` に書く */
function readRowAt(
  value: string,
  rows: TableColors["rows"],
  warnings: WarningItem[],
): void {
  for (const item of value.split(",").map((part) => part.trim())) {
    if (!item) {
      continue;
    }
    const equals = item.indexOf("=");
    if (equals < 0) {
      warnings.push(missingEquals(item, "位置=色"));
      continue;
    }
    const position = item.slice(0, equals);
    const color = item.slice(equals + 1);
    const range = /^(\d+)(?:-(\d+))?$/.exec(position);
    const first = Number(range?.[1]);
    const last = Number(range?.[2] ?? range?.[1]);
    if (!range || first < 1 || last < first || last > rows.length) {
      warnings.push({
        label: position,
        message: `の行の位置 \`${position}\` は表にありません。表の本文は ${rows.length} 行です。行の位置を 1〜${rows.length} で書いてください。`,
      });
    } else if (!isColorName(color)) {
      warnings.push(unknownColor(color));
    } else {
      rows.fill(color, first - 1, last);
    }
  }
}

/** 表の印の `highlight=`・`row-color=`・`row-at=` を、表の見出しと本文の行のセルの文字で照らして読む */
export function readTableColors(
  args: MdmarkMarkArgs | undefined,
  headers: string[],
  cells: string[][],
): TableColors {
  const warnings: WarningItem[] = [];
  const keys = args?.keys ?? {};
  const highlight =
    keys.highlight === undefined
      ? []
      : readHighlight(keys.highlight, headers, warnings);
  const rows: TableColors["rows"] = cells.map(() => null);
  if (keys["row-color"] !== undefined) {
    readRowColor(keys["row-color"], headers, cells, rows, warnings);
  }
  // `row-at=` は `row-color=` の後に読み、両方が当たる行を `row-at=` の色にする
  if (keys["row-at"] !== undefined) {
    readRowAt(keys["row-at"], rows, warnings);
  }
  return { highlight, rows, warnings };
}

/** 強調する列の `th`・`td` と、色を付ける本文の行の `tr` に色の属性を付ける */
function applyTableColors(
  state: StateCore,
  tableOpen: number,
  colors: TableColors,
): void {
  const tokens = state.tokens;
  const nonce = envOf(state).nonce;
  const colorOf = new Map(
    colors.highlight.map((item) => [item.column, item.color]),
  );
  let inBody = false;
  let row = -1;
  let column = 0;
  for (const index of ownTokenIndexes(tokens, tableOpen)) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    if (token.type === "tbody_open") {
      inBody = true;
    } else if (token.type === "tr_open") {
      column = 0;
      row += inBody ? 1 : 0;
      const color = inBody ? colors.rows[row] : null;
      if (color) {
        token.attrSet("data-color", color);
        token.attrSet("data-mdmark-own", nonce);
      }
    } else if (token.type === "th_open" || token.type === "td_open") {
      const color = colorOf.get(column);
      if (color) {
        token.attrJoin("class", "mdmark-col-highlight");
        token.attrSet("data-color", color);
        token.attrSet("data-mdmark-own", nonce);
      }
      column += 1;
    }
  }
}

/** 広く取る列と真偽値の列の `th`・`td` に class を付け、真偽値の列の `true`・`false` のセルの中身を ✓ と空欄にする */
function applyColumnStyles(
  state: StateCore,
  tableOpen: number,
  spec: Pick<TableSpec, "wide" | "check">,
): void {
  if (spec.wide.length === 0 && spec.check.length === 0) {
    return;
  }
  const tokens = state.tokens;
  const nonce = envOf(state).nonce;
  let inBody = false;
  let column = 0;
  for (const index of ownTokenIndexes(tokens, tableOpen)) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    if (token.type === "tbody_open") {
      inBody = true;
    } else if (token.type === "tr_open") {
      column = 0;
    } else if (token.type === "th_open" || token.type === "td_open") {
      const checking = spec.check.includes(column);
      if (spec.wide.includes(column)) {
        token.attrJoin("class", "mdmark-wide");
        token.attrSet("data-mdmark-own", nonce);
      }
      if (checking) {
        token.attrJoin("class", "mdmark-align-center");
        token.attrSet("data-mdmark-own", nonce);
      }
      const inline = tokens[index + 1];
      const text = inline?.type === "inline" ? textOf(inline).trim() : "";
      if (checking && inBody && inline && isCheckValue(text)) {
        token.attrSet("data-value", text);
        const html = new state.Token("html_inline", "", 0);
        html.content = markOwn(renderCheckCell(text), nonce);
        inline.children = [html];
      }
      column += 1;
    }
  }
}

/** `tableOpen` の表の直下のトークンの位置を返す（中の表のトークンと、自分の `table_open`・`table_close` を含まない） */
function ownTokenIndexes(tokens: Token[], tableOpen: number): number[] {
  const indexes: number[] = [];
  let depth = 0;
  for (let index = tableOpen; index < tokens.length; index++) {
    const type = tokens[index]?.type;
    if (type === "table_open") {
      depth += 1;
    } else if (type === "table_close") {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    } else if (depth === 1) {
      indexes.push(index);
    }
  }
  return indexes;
}

/** `tableOpen` の表の本文の行の数を数える */
function bodyRowCount(tokens: Token[], tableOpen: number): number {
  let count = 0;
  let inBody = false;
  for (const index of ownTokenIndexes(tokens, tableOpen)) {
    const type = tokens[index]?.type;
    if (type === "tbody_open") {
      inBody = true;
    } else if (type === "tbody_close") {
      inBody = false;
    } else if (inBody && type === "tr_open") {
      count += 1;
    }
  }
  return count;
}

/** 先頭のセルの文字から行の ID を作る。見出しの ID と同じ規則で、`taken` にあれば `-1`・`-2` と番号を上げる。作れないときは `row` を元にする。返した ID を `taken` に足す */
export function rowIdOf(text: string, taken: Set<string>): string {
  const base = slugBase(text) || "row";
  let id = base;
  for (let count = 1; taken.has(id); count++) {
    id = `${base}-${count}`;
  }
  taken.add(id);
  return id;
}

/** `table_open` から対応する `table_close` までの本文の各行に、行の ID と先頭のセルの行へのリンクを付ける */
function linkRows(
  state: StateCore,
  tokens: Token[],
  tableOpen: number,
  taken: Set<string>,
): void {
  const nonce = envOf(state).nonce;
  /** 印を付けた HTML の `html_inline` を作る */
  const inlineHtml = (html: string): Token => {
    const token = new state.Token("html_inline", "", 0);
    token.content = markOwn(html, nonce);
    return token;
  };
  let inBody = false;
  for (const index of ownTokenIndexes(tokens, tableOpen)) {
    const token = tokens[index];
    if (token?.type === "tbody_open") {
      inBody = true;
    } else if (inBody && token?.type === "tr_open") {
      const inline = tokens.slice(index + 1).find((t) => t.type === "inline");
      if (!inline) {
        continue;
      }
      const text = textOf(inline);
      const id = rowIdOf(text, taken);
      token.attrSet("id", id);
      token.attrSet("data-mdmark-own", nonce);
      const [open = "", close = ""] = renderRowLink(
        SLOT_MARKER,
        id,
        text,
      ).split(SLOT_MARKER);
      inline.children = [
        inlineHtml(open),
        ...(inline.children ?? []),
        inlineHtml(close),
      ];
    }
  }
}

/** 項目の形（`+機能`・`キー=`・結合できない `^^`・`<<`）の警告か、1 文の警告かを見分ける */
function isItemWarning(item: WarningItem): boolean {
  return (
    /^[+-]/.test(item.label) ||
    item.label.endsWith("=") ||
    item.label === MERGE_UP ||
    item.label === MERGE_LEFT
  );
}

/** 表の指定の警告を、書き方の警告に渡す値にする: 項目の形のものは 1 つにまとめ、1 文のものは 1 つずつ */
export function warningsOf(
  mark: string,
  warnings: WarningItem[],
): SyntaxWarning[] {
  const items = warnings.filter(isItemWarning);
  const sentences = warnings.filter((warning) => !isItemWarning(warning));
  const result: SyntaxWarning[] = sentences.map((warning) => ({
    mark,
    message: warning.message,
  }));
  if (items.length) {
    result.push({
      mark,
      message: "の読めない指定を当てずに描いています。",
      items,
    });
  }
  return result;
}

/** 表の印の範囲 */
type TableRange = {
  /** 開きの印の位置 */
  open: number;
  /** 閉じの印の位置。無ければ `-1` */
  close: number;
  /** 開きの印 */
  mark: Mark;
  /** 閉じの印が無い警告を出したか */
  warned: boolean;
};

/** 表に読み上げの名前と tabindex を付け、セルに同じ列の見出しの文字を写す */
function decorateAttributes(state: StateCore): void {
  const tokens = state.tokens;
  let heading = "";
  let headers: string[] = [];
  let column = 0;
  // 中の表を読む間、外の表の見出しと列の位置を控える
  const outers: Array<{ headers: string[]; column: number }> = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (!token) {
      continue;
    }
    if (token.type === "heading_open") {
      heading = next ? textOf(next) : "";
    } else if (token.type === "table_open") {
      token.attrSet("tabindex", "0");
      token.attrSet("aria-label", heading ? `表: ${heading}` : "表");
      outers.push({ headers, column });
      headers = [];
    } else if (token.type === "table_close") {
      ({ headers, column } = outers.pop() ?? { headers: [], column: 0 });
    } else if (token.type === "tr_open") {
      column = 0;
    } else if (token.type === "th_open") {
      headers.push(next ? textOf(next) : "");
    } else if (token.type === "td_open") {
      token.attrSet("data-label", headers[column] ?? "");
      column += 1;
    }
  }
}

/** 表の本文の各行のセルの文字を集める */
function bodyCellsOf(tokens: Token[], tableOpen: number): string[][] {
  const rows: string[][] = [];
  let inBody = false;
  for (const index of ownTokenIndexes(tokens, tableOpen)) {
    const token = tokens[index];
    if (token?.type === "tbody_open") {
      inBody = true;
    } else if (inBody && token?.type === "tr_open") {
      rows.push([]);
    } else if (
      inBody &&
      (token?.type === "td_open" || token?.type === "th_open")
    ) {
      const inline = tokens[index + 1];
      rows.at(-1)?.push(inline ? textOf(inline) : "");
    }
  }
  return rows;
}

/** 集計する列に数として読めないセルがあるときの警告を、列と計算ごとに作る */
function unreadableTotalWarnings(options: {
  tokens: Token[];
  tableOpen: number;
  totals: TableTotal[];
}): SyntaxWarning[] {
  const { tokens, tableOpen, totals } = options;
  const headers = headersOf(tokens, tableOpen);
  return findUnreadableTotals({
    rows: bodyCellsOf(tokens, tableOpen),
    totals,
  }).map((item) => ({
    message: `「${headers[item.column] ?? ""}」の列に数として読めない値 ${codes(item.values)} があるため、${TOTAL_LABELS[item.calc]}を出していません。数を書くか、セルを空にしてください。`,
  }));
}

/** 表の見出しの文字を集める。見出しが多段なら最下段の行の文字 */
export function headersOf(tokens: Token[], tableOpen: number): string[] {
  let headers: string[] = [];
  for (let index = tableOpen; index < tokens.length; index++) {
    const token = tokens[index];
    if (token?.type === "thead_close") {
      break;
    }
    if (token?.type === "tr_open") {
      headers = [];
    } else if (token?.type === "th_open" && tokens[index + 1]) {
      headers.push(textOf(tokens[index + 1] as Token));
    }
  }
  return headers;
}

/** 表の行のセルのトークンの位置 */
type RowCells = {
  /** 見出しの行か */
  head: boolean;
  /** セルごとの開きと閉じのトークンの位置 */
  cells: Array<{ open: number; close: number }>;
};

/** `tableOpen` の表の行ごとに、セルの開きと閉じのトークンの位置を集める */
function rowCellsOf(tokens: Token[], tableOpen: number): RowCells[] {
  const rows: RowCells[] = [];
  let head = true;
  for (const index of ownTokenIndexes(tokens, tableOpen)) {
    const type = tokens[index]?.type;
    if (type === "tbody_open") {
      head = false;
    } else if (type === "tr_open") {
      rows.push({ head, cells: [] });
    } else if (type === "th_open" || type === "td_open") {
      rows.at(-1)?.cells.push({ open: index, close: index });
    } else if (type === "th_close" || type === "td_close") {
      const cell = rows.at(-1)?.cells.at(-1);
      if (cell) {
        cell.close = index;
      }
    }
  }
  return rows;
}

/** セルの開きと閉じのトークンを `th` にする */
function toHeadCell(open: Token, close: Token | undefined): void {
  open.type = "th_open";
  open.tag = "th";
  if (close) {
    close.type = "th_close";
    close.tag = "th";
  }
}

/** 本文の先頭の `count` 行を `thead` の終わりへ移し、セルを `th` にする */
function moveRowsToHead(tokens: Token[], tableOpen: number, count: number) {
  const own = ownTokenIndexes(tokens, tableOpen);
  const theadClose = own.find((i) => tokens[i]?.type === "thead_close");
  const tbodyOpen = own.find((i) => tokens[i]?.type === "tbody_open");
  if (theadClose === undefined || tbodyOpen === undefined) {
    return;
  }
  const rowEnds = own.filter(
    (i) => i > tbodyOpen && tokens[i]?.type === "tr_close",
  );
  const end = rowEnds[count - 1];
  if (end === undefined) {
    return;
  }
  const moved = tokens.splice(tbodyOpen + 1, end - tbodyOpen);
  tokens.splice(theadClose, 0, ...moved);
  for (const row of rowCellsOf(tokens, tableOpen).filter((r) => r.head)) {
    for (const cell of row.cells) {
      const open = tokens[cell.open];
      if (open?.type === "td_open") {
        toHeadCell(open, tokens[cell.close]);
        // 本文のセルに写した列名は、見出しにしたセルには要らない
        open.attrs = (open.attrs ?? []).filter(
          ([name]) => name !== "data-label",
        );
      }
    }
  }
}

/** 表の印の範囲の表に、多段の見出し・行見出し・セルの結合を当て、本文の行で結合した列と結合できない警告を返す。見出しの結合したセルのトークンは `dropped` に入れる */
function mergeTableCells(options: {
  state: StateCore;
  tableOpen: number;
  spec: TableSpec;
  dropped: Set<Token>;
}): { mergeColumns: number[]; warnings: WarningItem[] } {
  const { state, tableOpen, spec, dropped } = options;
  const tokens = state.tokens;
  const nonce = envOf(state).nonce;
  if (spec.headRows > 1) {
    moveRowsToHead(tokens, tableOpen, spec.headRows - 1);
  }
  const rows = rowCellsOf(tokens, tableOpen);
  if (spec.headRows > 1) {
    // 本文のセルの列名を、見出しの最下段の文字に替える
    const labels = headersOf(tokens, tableOpen);
    for (const row of rows.filter((r) => !r.head)) {
      for (const [column, cell] of row.cells.entries()) {
        tokens[cell.open]?.attrSet("data-label", labels[column] ?? "");
      }
    }
  }
  const texts = rows.map((row) =>
    row.cells.map((cell) => {
      const inline = tokens[cell.open + 1];
      return inline?.type === "inline" ? textOf(inline) : "";
    }),
  );
  const plan = planCellMerges({ cells: texts, headRows: spec.headRows });
  /** 開きのトークンに、mdmark が付けた属性として値を付ける */
  const setOwn = (token: Token, name: string, value: string): void => {
    token.attrSet(name, value);
    token.attrSet("data-mdmark-own", nonce);
  };
  for (const [r, row] of rows.entries()) {
    for (const [c, cell] of row.cells.entries()) {
      const open = tokens[cell.open];
      const planned = plan.cells[r]?.[c];
      if (!open || !planned) {
        continue;
      }
      if (row.head && planned.merged) {
        for (let index = cell.open; index <= cell.close; index++) {
          const token = tokens[index];
          if (token) {
            dropped.add(token);
          }
        }
        continue;
      }
      if (!row.head && c < spec.rowHeader) {
        toHeadCell(open, tokens[cell.close]);
        // 行見出しの `scope` は開始タグの先頭に置く
        open.attrs = [["scope", "row"], ...(open.attrs ?? [])];
        open.attrSet("data-mdmark-own", nonce);
      }
      if (planned.merged && planned.source) {
        const [sourceRow, sourceColumn] = planned.source;
        const source = rows[sourceRow]?.cells[sourceColumn];
        const from = source ? tokens[source.open + 1] : undefined;
        const to = tokens[cell.open + 1];
        if (from?.type === "inline" && to?.type === "inline") {
          to.content = from.content;
          to.children = [...(from.children ?? [])];
        }
        setOwn(open, "data-merge", planned.merged);
        // 値の無い属性は落とされるため、属性の名前を値にする
        setOwn(open, "hidden", "hidden");
        continue;
      }
      if (planned.rowspan > 1) {
        setOwn(open, "rowspan", String(planned.rowspan));
      }
      if (planned.colspan > 1) {
        setOwn(open, "colspan", String(planned.colspan));
      }
      if (
        row.head &&
        (spec.headRows > 1 || planned.rowspan > 1 || planned.colspan > 1)
      ) {
        setOwn(open, "scope", planned.colspan > 1 ? "colgroup" : "col");
      }
    }
  }
  return { mergeColumns: plan.mergeColumns, warnings: plan.warnings };
}

/** 表の印の範囲を集める */
function collectRanges(tokens: Token[]): TableRange[] {
  const ranges: TableRange[] = [];
  tokens.forEach((token, index) => {
    const mark = markOf(token);
    if (mark?.name === "table" && !mark.closing) {
      ranges.push({
        open: index,
        close: findClose(tokens, index, "table"),
        mark,
        warned: false,
      });
    }
  });
  return ranges;
}

/** 表に読み上げの名前と tabindex を付け、`table` がオンなら、表の印の範囲の表と囲まない表を表の部品の囲みに入れる */
export function decorateTables(state: StateCore): void {
  decorateAttributes(state);
  if (!featureOn(state, "table")) {
    return;
  }
  const tokens = state.tokens;
  const ranges = collectRanges(tokens);
  // 行の ID が重ならないよう、見出しの ID と前の行の ID を文書の頭から控える
  const taken = new Set(envOf(state).headings.map((heading) => heading.id));
  const out: Token[] = [];
  // 囲みに入れて閉じていない表の `table_open` の位置と、閉じるときに置く囲みの終わり
  const openTables: Array<{ open: number; tail: string }> = [];
  // 見出しの結合したセルのトークン（囲みに移さない）
  const dropped = new Set<Token>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token || dropped.has(token)) {
      continue;
    }
    const mark = markOf(token);
    if (mark?.name === "table") {
      // 表の印は、ここで使い切る
      continue;
    }
    const outer = openTables.at(-1);
    if (token.type === "table_close" && outer) {
      openTables.pop();
      out.push(token);
      const close = ownBlock(state, outer.tail);
      close.meta = { role: "table-close" };
      out.push(close);
      continue;
    }
    if (token.type !== "table_open") {
      out.push(token);
      continue;
    }
    const range = ranges
      .filter(
        (candidate) =>
          candidate.open < index &&
          candidate.open > (outer?.open ?? -1) &&
          (candidate.close < 0 || index < candidate.close),
      )
      .pop();
    // ビューの印が表の指定を当てた表は、その指定で表の部品にする
    const viewSpec = (token.meta as { tableSpec?: TableSpec } | null)
      ?.tableSpec;
    const rowCount = bodyRowCount(tokens, index) + 1;
    let spec =
      viewSpec ??
      readTableSpec(range?.mark.args, headersOf(tokens, index), rowCount);
    let mergeColumns: number[] = [];
    if (range && !viewSpec) {
      if (spec.headRows > 1) {
        // 列名は見出しの最下段の行から読む
        const bottom = bodyCellsOf(tokens, index)[spec.headRows - 2] ?? [];
        spec = readTableSpec(range.mark.args, bottom, rowCount);
      }
      const merged = mergeTableCells({
        state,
        tableOpen: index,
        spec,
        dropped,
      });
      mergeColumns = merged.mergeColumns;
      spec.warnings.push(...merged.warnings);
    }
    const filtering = spec.features.includes("filter");
    const html = renderTable({
      kind: spec.kind,
      features: spec.features,
      filters: filtering ? spec.filters : [],
      collapse: spec.collapse,
      title: spec.title,
      rowCount: bodyRowCount(tokens, index),
      hide: spec.hide,
      totals: spec.totals,
      mergeColumns,
      pin: spec.pin,
      check: spec.check,
      body: SLOT_MARKER,
    });
    if (spec.features.includes("rowlink")) {
      linkRows(state, tokens, index, taken);
    }
    const colors = readTableColors(
      range?.mark.args,
      headersOf(tokens, index),
      bodyCellsOf(tokens, index),
    );
    applyTableColors(state, index, colors);
    applyColumnStyles(state, index, spec);
    const [head = "", tail = ""] = html.split(SLOT_MARKER);
    // 警告は、囲みの頭（折り畳みの外）に差し込む
    const divEnd = head.indexOf(">") + 1;
    const warnings = range ? warningsOf(range.mark.raw, spec.warnings) : [];

    if (range && range.close < 0 && !range.warned) {
      range.warned = true;
      warnings.push(unclosedWarning(range.mark));
    }
    // 色の指定の警告と集計できない列の警告は、表の囲みの直前に置く
    if (range) {
      for (const warning of warningsOf(range.mark.raw, colors.warnings)) {
        out.push(warningBlock(state, warning, tokens[range.open]));
      }
    }
    if (spec.features.includes("total")) {
      for (const warning of unreadableTotalWarnings({
        tokens,
        tableOpen: index,
        totals: spec.totals,
      })) {
        out.push(
          warningBlock(state, warning, range ? tokens[range.open] : undefined),
        );
      }
    }
    const open = ownBlock(
      state,
      head.slice(0, divEnd),
      range ? tokens[range.open] : token,
    );
    open.meta = { role: "table-open" };
    out.push(open);
    for (const warning of warnings) {
      out.push(
        warningBlock(state, warning, range ? tokens[range.open] : undefined),
      );
    }
    out.push(ownBlock(state, head.slice(divEnd)));
    // 中のトークンは、対応する `table_close` までこの繰り返しで移す（中の表も囲みに入れる）
    out.push(token);
    openTables.push({ open: index, tail });
  }
  state.tokens = out;
}
