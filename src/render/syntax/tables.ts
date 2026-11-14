import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import type { ColorName } from "../../parts/colors.ts";
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
  type ColumnLines,
  defaultFilterKind,
  FILTER_KINDS,
  type FilterKind,
  findLongColumns,
  findNoSortColumns,
  findUnreadableTotals,
  isCompactCellText,
  TOTAL_LABELS,
  type TotalCalc,
} from "../../table-logic.ts";
import type { MarkOptions } from "../mark-options.ts";
import type { Mark } from "../marks.ts";
import { readCollapse } from "./collapse.ts";
import type { CsvTableMeta } from "./csv.ts";
import { slugBase } from "./headings.ts";
import {
  headerGroupsOf,
  MERGE_LEFT,
  MERGE_UP,
  planCellMerges,
} from "./table-cells.ts";
import { decorateTreeTable } from "./table-tree.ts";
import {
  envOf,
  featureOn,
  findClose,
  findNestedClose,
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
    default: ["pin", "resize"],
    data: ["sort", "pin", "filter", "resize"],
    plain: [],
  };

/** 表の機能の名前。後ろの 6 つはどの種類の既定にも入らず、`+機能` を記載した表にだけ付く */
export const TABLE_FEATURES: readonly TableFeature[] = [
  "sort",
  "pin",
  "filter",
  "resize",
  "count",
  "columns",
  "reorder",
  "total",
  "copy",
  "rowlink",
];

/** 表のマーカーを読み込んだ結果 */
export type TableSpec = {
  /** 種類（省くと `default`） */
  kind: TableKind;
  /** 種類の機能に、`features` と列の設定の機能を適用したもの */
  features: TableFeature[];
  /** 絞り込む列。表に無い列名は入れない。`type` を省いた列は `kind` を持たない */
  filters: Array<{ column: number; kind?: FilterKind }>;
  /** 折り畳み */
  collapse: "none" | "closed" | "open";
  /** 折り畳みの見出し（`collapse.title`） */
  title?: string | undefined;
  /** 表に照らして読み込めなかった設定 */
  warnings: WarningItem[];
  /** 既定で隠す列の位置。先頭の列と表に無い列名は入れない */
  hide: number[];
  /** 集計する列と計算 */
  totals: TableTotal[];
  /** `thead` にする表の先頭の行の数（既定 1） */
  headRows: number;
  /** `<th scope="row">` にする本文の各行の先頭の列の数（既定 0） */
  rowHeader: number;
  /** 留める列の位置（小さい順）。`pin` の無い表・`true` の列が無いときは入れない */
  pin?: number[] | undefined;
  /** 既定で留める列から除く列の位置（`pinned` の `false`） */
  unpinned: number[];
  /** 列の幅 */
  widths: Array<{
    column: number;
    mode: "auto" | "nowrap";
    min?: number;
    max?: number;
  }>;
  /** 真偽値を ✓ と空欄で出す列の位置 */
  check: number[];
  /** `columns.{列名}.sort` を記載した列と値（`sort` の機能を持たない表では入れない） */
  sorts: Array<{ column: number; sort: boolean }>;
  /** 階層にするキーの列の位置 */
  tree?: number | undefined;
  /** 型の列の位置 */
  treeType?: number | undefined;
  /** 必須の列の位置 */
  treeRequired?: number | undefined;
  /** 既定の列の位置 */
  treeDefault?: number | undefined;
  /** YAML の見本にするタブの範囲の見出し */
  example?: string | undefined;
};

/** 表の色の指定を読み込んだ結果 */
export type TableColors = {
  /** 強調する列の位置と色。色を省いた列は `blue` */
  highlight: Array<{ column: number; color: ColorName }>;
  /** 本文の行ごとの色。色を付けない行は `null` */
  rows: Array<ColorName | null>;
  /** 読み込めなかった指定 */
  warnings: WarningItem[];
};

/** `highlight=` で色を省いた列の色 */
const DEFAULT_HIGHLIGHT_COLOR: ColorName = "blue";

/** 並びをコードにして `・` でつなぐ */
export function codes(values: readonly string[]): string {
  return values.map((value) => `\`${value}\``).join("・");
}

/** 列名が表に無いときの警告の項目。`path` は列名を記載したキーのパス */
function unknownColumn(
  path: string,
  name: string,
  headers: string[],
): WarningItem {
  return {
    label: path,
    message: `の列 \`${name}\` は表にありません。表の列は ${codes(headers)} です。列名を修正してください。当てずに描いています。`,
  };
}

/** 列の設定のキーから、その設定が付ける機能の名前を参照する */
const COLUMN_FEATURES: Readonly<Record<string, TableFeature>> = {
  filter: "filter",
  hidden: "columns",
  pinned: "pin",
  total: "total",
};

/** 値がオブジェクト（配列を除く）か */
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 表のマーカーの設定と表の見出しから `TableSpec` を作る。マーカーが無い表は `default` */
export function readTableSpec(
  options: MarkOptions | undefined,
  headers: string[],
  rowCount: number,
): TableSpec {
  const spec = options ?? {};
  const warnings: WarningItem[] = [];
  const kind: TableKind =
    spec.kind === "data" || spec.kind === "plain" ? spec.kind : "default";
  const featureSettings = isObject(spec.features) ? spec.features : {};
  const disabled = new Set(
    Object.entries(featureSettings)
      .filter(([, value]) => isObject(value) && value.enabled === false)
      .map(([name]) => name),
  );
  const features: TableFeature[] = TABLE_KINDS[kind].filter(
    (name) => !disabled.has(name),
  );
  const add = (name: TableFeature): void => {
    if (!disabled.has(name) && !features.includes(name)) {
      features.push(name);
    }
  };
  for (const name of Object.keys(featureSettings)) {
    if (TABLE_FEATURES.includes(name as TableFeature)) {
      add(name as TableFeature);
    }
  }
  const filters: TableSpec["filters"] = [];
  const hide: number[] = [];
  const totals: TableTotal[] = [];
  const pinned: number[] = [];
  const unpinned: number[] = [];
  const widths: TableSpec["widths"] = [];
  const check: number[] = [];
  const sorts: TableSpec["sorts"] = [];
  const columns = isObject(spec.columns) ? spec.columns : {};
  for (const [name, settings] of Object.entries(columns)) {
    if (!isObject(settings)) {
      continue;
    }
    const column = headers.indexOf(name);
    if (column < 0) {
      warnings.push(unknownColumn(`columns.${name}`, name, headers));
      continue;
    }
    for (const key of Object.keys(settings)) {
      const feature = COLUMN_FEATURES[key];
      if (feature !== undefined && key !== "pinned") {
        add(feature);
      }
    }
    // 機能を削除した表の列の設定は当てない（注記は `takeMarks` が記録する）
    const on = (key: string): boolean => {
      const feature = COLUMN_FEATURES[key];
      return feature === undefined || !disabled.has(feature);
    };
    if (isObject(settings.filter) && on("filter")) {
      const type = settings.filter.type;
      filters.push(
        typeof type === "string"
          ? { column, kind: type as FilterKind }
          : { column },
      );
    }
    if (settings.hidden === true && on("hidden")) {
      if (column === 0) {
        warnings.push({
          label: `columns.${name}.hidden`,
          message: `の列 \`${name}\` は先頭の列のため隠せません。先頭の列は行の識別子と行へのリンクの配置場所なので、隠さずに描いています。`,
        });
      } else {
        hide.push(column);
      }
    }
    if (Array.isArray(settings.total) && on("total")) {
      for (const item of settings.total) {
        const calc = isObject(item) ? item.calc : undefined;
        const duplicated = totals.some(
          (total) => total.column === column && total.calc === calc,
        );
        if (typeof calc === "string" && !duplicated) {
          totals.push({ column, calc: calc as TotalCalc });
        }
      }
    }
    if (settings.pinned === true && on("pinned")) {
      add("pin");
      pinned.push(column);
    } else if (settings.pinned === false) {
      unpinned.push(column);
    }
    if (isObject(settings.width)) {
      const { mode, min, max } = settings.width;
      widths.push({
        column,
        mode: mode === "nowrap" ? "nowrap" : "auto",
        ...(typeof min === "number" ? { min } : {}),
        ...(typeof max === "number" ? { max } : {}),
      });
    }
    if (isObject(settings.format) && settings.format.type === "check") {
      check.push(column);
    }
    if (typeof settings.sort === "boolean" && !disabled.has("sort")) {
      if (settings.sort) {
        add("sort");
      }
      sorts.push({ column, sort: settings.sort });
    }
  }
  const header = isObject(spec.header) ? spec.header : {};
  let headRows = 1;
  if (typeof header.rows === "number") {
    if (header.rows < rowCount) {
      headRows = header.rows;
    } else {
      warnings.push({
        label: "header.rows",
        message: `\`${header.rows}\` は使用できません。1 以上で表の行の数（${rowCount}）より小さい整数を指定してください。既定の 1 で描いています`,
      });
    }
  }
  let rowHeader = 0;
  if (typeof header.columns === "number") {
    if (header.columns < headers.length) {
      rowHeader = header.columns;
    } else {
      warnings.push({
        label: "header.columns",
        message: `\`${header.columns}\` は使用できません。0 以上で表の列の数（${headers.length}）より小さい整数を指定してください。既定の 0 で描いています`,
      });
    }
  }
  const tree = readTree({
    tree: isObject(spec.tree) ? spec.tree : undefined,
    headers,
    warnings,
  });
  if (tree.tree !== undefined) {
    // 階層の表は行の順を Markdown に記載した順のまま保つため、並べ替えを付けない
    const sort = features.indexOf("sort");
    if (sort >= 0) {
      features.splice(sort, 1);
    }
  }
  const { collapse, title } = readCollapse(spec);
  // 機能は名前の一覧の順に並べる
  features.sort(
    (a, b) => TABLE_FEATURES.indexOf(a) - TABLE_FEATURES.indexOf(b),
  );
  return {
    ...tree,
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
    pin:
      features.includes("pin") && pinned.length > 0
        ? [...pinned].sort((a, b) => a - b)
        : undefined,
    unpinned,
    widths,
    check,
    // `sort` の機能を持たない表（階層の表を含む）には列ごとの並べ替えの指定を当てない
    sorts: features.includes("sort") ? sorts : [],
  };
}

/** `tree` の列を、表の見出しの文字と照らして読み込む */
function readTree(options: {
  tree: Record<string, unknown> | undefined;
  headers: string[];
  warnings: WarningItem[];
}): Pick<
  TableSpec,
  "tree" | "treeType" | "treeRequired" | "treeDefault" | "example"
> {
  const { tree: spec, headers, warnings } = options;
  if (spec === undefined) {
    return {};
  }
  const columnOf = (key: string): number | undefined => {
    const name = (spec[key] as { column?: unknown } | undefined)?.column;
    if (typeof name !== "string") {
      return undefined;
    }
    const column = headers.indexOf(name);
    if (column < 0) {
      warnings.push(
        key === "key"
          ? {
              label: "tree.key.column",
              message: `の \`tree.key.column\` の列 \`${name}\` が表にありません。表の列は ${codes(headers)} です。階層にせずに描いています。`,
            }
          : unknownColumn(`tree.${key}.column`, name, headers),
      );
      return undefined;
    }
    return column;
  };
  const tree = columnOf("key");
  if (tree === undefined) {
    return {};
  }
  const heading = (spec.example as { heading?: unknown } | undefined)?.heading;
  return {
    tree,
    treeType: columnOf("type"),
    treeRequired: columnOf("required"),
    treeDefault: columnOf("default"),
    example: typeof heading === "string" ? heading : undefined,
  };
}

/** 表のマーカーの `columns.{列名}.highlight` と `rows.colors` を、表の見出しと本文の行のセルの文字で照らして読み込む */
export function readTableColors(
  options: MarkOptions | undefined,
  headers: string[],
  cells: string[][],
): TableColors {
  const spec = options ?? {};
  const warnings: WarningItem[] = [];
  const highlight: TableColors["highlight"] = [];
  const columns = isObject(spec.columns) ? spec.columns : {};
  for (const [name, settings] of Object.entries(columns)) {
    if (!isObject(settings) || !isObject(settings.highlight)) {
      continue;
    }
    const column = headers.indexOf(name);
    if (column < 0) {
      warnings.push({
        ...unknownColumn(`columns.${name}`, name, headers),
        label: name,
      });
      continue;
    }
    const color = settings.highlight.color;
    highlight.push({
      column,
      color:
        typeof color === "string"
          ? (color as ColorName)
          : DEFAULT_HIGHLIGHT_COLOR,
    });
  }
  const rows: TableColors["rows"] = cells.map(() => null);
  const rowSpec = isObject(spec.rows) ? spec.rows : {};
  const colors = Array.isArray(rowSpec.colors) ? rowSpec.colors : [];
  for (const item of colors) {
    if (!isObject(item) || typeof item.color !== "string") {
      continue;
    }
    const color = item.color as ColorName;
    const hasColumn = typeof item.column === "string";
    if (hasColumn !== (typeof item.value === "string")) {
      // `column` と `value` の片方だけの要素は当てない（注記は `takeMarks` が記録する）
      continue;
    }
    let position: number | undefined;
    if (hasColumn) {
      position = headers.indexOf(item.column as string);
      if (position < 0) {
        warnings.push({
          ...unknownColumn("rows.colors", item.column as string, headers),
          label: item.column as string,
        });
        continue;
      }
    }
    let range: [number, number] | undefined;
    if (item.at !== undefined) {
      const at = item.at as number | { from: number; to?: number };
      const [from, to] =
        typeof at === "number" ? [at, at] : [at.from, at.to ?? at.from];
      if (from < 1 || to < from || to > rows.length) {
        warnings.push({
          label: String(typeof at === "number" ? at : `${from}-${to}`),
          message: `の行の位置 \`${typeof at === "number" ? at : `${from}-${to}`}\` は表にありません。表の本文は ${rows.length} 行です。行の位置を 1〜${rows.length} で記載してください。`,
        });
        continue;
      }
      range = [from, to];
    } else if (!hasColumn) {
      continue;
    }
    cells.forEach((row, index) => {
      const inRange =
        range === undefined || (index + 1 >= range[0] && index + 1 <= range[1]);
      const matches =
        position === undefined || (row[position] ?? "").trim() === item.value;
      if (inRange && matches) {
        rows[index] = color;
      }
    });
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
  spec: Pick<TableSpec, "widths" | "check">,
): void {
  const wide = spec.widths
    .filter((width) => width.mode === "nowrap")
    .map((width) => width.column);
  if (wide.length === 0 && spec.check.length === 0) {
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
      if (wide.includes(column)) {
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

/** `tableOpen` の表の直下のトークンの位置を返却する（中の表のトークンと、自分の `table_open`・`table_close` を含まない） */
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

/** 先頭のセルの文字から行の ID を作る。見出しの ID と同じ規則で、`taken` にあれば `-1`・`-2` と番号を上げる。作れないときは `row` を元にする。返却した ID を `taken` に追加する */
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
  /** マーカーを付けた HTML の `html_inline` を作る */
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
      const [open = "", close = ""] = renderRowLink({
        content: SLOT_MARKER,
        id,
        label: text,
      }).split(SLOT_MARKER);
      inline.children = [
        inlineHtml(open),
        ...(inline.children ?? []),
        inlineHtml(close),
      ];
    }
  }
}

/** 項目の構造（キーのパス・結合できない `^^`・`<<`）の警告か、1 文の警告かを見分ける */
function isItemWarning(item: WarningItem): boolean {
  // マーカーの文字に続けて読む文（`の` で始まる）は 1 つずつの警告にする
  return (
    !item.message.startsWith("の") ||
    item.label === MERGE_UP ||
    item.label === MERGE_LEFT
  );
}

/** 表の指定の警告を、記載の警告に指定する値にする: 項目の構造のものは 1 つにまとめ、1 文のものは 1 つずつ */
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
      message: "の読み込めない指定を当てずに描いています。",
      items,
    });
  }
  return result;
}

/** 表のマーカーの範囲 */
type TableRange = {
  /** 開きのマーカーの位置 */
  open: number;
  /** 閉じのマーカーの位置。無ければ `-1` */
  close: number;
  /** 開きのマーカー */
  mark: Mark;
  /** 閉じのマーカーが無い警告を出したか */
  warned: boolean;
};

/** 表にスクリーンリーダー向けの名前と tabindex を付け、セルに同じ列の見出しの文字を写す */
function decorateAttributes(state: StateCore): void {
  const tokens = state.tokens;
  let heading = "";
  let headers: string[] = [];
  let column = 0;
  // 中の表を読み込む間、外の表の見出しと列の位置を記録する
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

/** `badge:` のバッジの頭 */
const BADGE_PREFIX = "badge:";

/** 改行の `html_inline`（`<br>`） */
const BREAK_TAG = /^<br\s*\/?>$/i;

/** 文字の中の `<br>`（HTML を描かない設定で文字として残ったもの） */
const BREAK_IN_TEXT = /<br\s*\/?>/i;

/** セルの `inline` のトークンを、改行で分けた行と短い値だけのセルかにする */
const cellLinesOf = (
  inline: Token | undefined,
): { lines: string[]; compact: boolean } => {
  const parts: string[] = [""];
  let onlyCode = true;
  let hasCode = false;
  for (const child of inline?.children ?? []) {
    if (
      child.type === "softbreak" ||
      child.type === "hardbreak" ||
      (child.type === "html_inline" && BREAK_TAG.test(child.content.trim()))
    ) {
      parts.push("");
      continue;
    }
    if (child.type === "code_inline") {
      hasCode = true;
      const text = child.content.startsWith(BADGE_PREFIX)
        ? child.content.slice(BADGE_PREFIX.length)
        : child.content;
      parts[parts.length - 1] += text;
      continue;
    }
    if (child.type === "text" && child.content.trim() === "") {
      parts[parts.length - 1] += child.content;
      continue;
    }
    if (child.content !== "") {
      onlyCode = false;
    }
    parts[parts.length - 1] += child.content;
  }
  const lines = parts
    .flatMap((part) => part.split(BREAK_IN_TEXT))
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    lines,
    compact: (hasCode && onlyCode) || isCompactCellText(lines.join(" ")),
  };
};

/** 表の最下段の見出しと本文のセルを列ごとに集め、改行で分けた行と短い値だけのセルかを返却する */
export function columnLinesOf(
  tokens: Token[],
  tableOpen: number,
): ColumnLines[] {
  const head: string[][] = [];
  const body: Array<Array<{ lines: string[]; compact: boolean }>> = [];
  let section: "head" | "body" | undefined;
  let column = 0;
  for (const index of ownTokenIndexes(tokens, tableOpen)) {
    const token = tokens[index];
    if (token?.type === "thead_open") {
      section = "head";
    } else if (token?.type === "tbody_open") {
      section = "body";
    } else if (token?.type === "tr_open") {
      column = 0;
      if (section === "head") {
        head.length = 0;
      } else {
        body.push([]);
      }
    } else if (token?.type === "th_open" || token?.type === "td_open") {
      const cell = cellLinesOf(tokens[index + 1]);
      if (section === "head") {
        head[column] = cell.lines;
      } else {
        body.at(-1)?.push(cell);
      }
      column += 1;
    }
  }
  const count = Math.max(head.length, ...body.map((row) => row.length));
  return Array.from({ length: count }, (_, index) => ({
    head: head[index] ?? [],
    cells: body.flatMap((row) => {
      const cell = row[index];
      return cell ? [cell] : [];
    }),
  }));
}

/** 表の本文の各行のセルの文字を集める */
export function bodyCellsOf(tokens: Token[], tableOpen: number): string[][] {
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

/** 集計する列に数として読み込めないセルがあるときの警告を、列と計算ごとに作る */
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
    message: `「${headers[item.column] ?? ""}」の列に数として読み込めない値 ${codes(item.values)} があるため、${TOTAL_LABELS[item.calc]}を出していません。数を記載するか、セルを空にしてください。`,
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
        // 本文のセルにコピーした列名は、見出しにしたセルには要らない
        open.attrs = (open.attrs ?? []).filter(
          ([name]) => name !== "data-label",
        );
      }
    }
  }
}

/** 表のマーカーの範囲の表に、多段の見出し・行見出し・セルの結合を当て、本文の行で結合した列と結合できない警告を返却する。見出しの結合したセルのトークンは `dropped` に入れる */
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
    // 本文のセルの列名を、見出しの最下段の文字（上と結合した `^^` は上のセルの文字）に替える
    const labels = headLabelsOf(
      rowCellsOf(tokens, tableOpen)
        .filter((row) => row.head)
        .map((row) =>
          row.cells.map((cell) => {
            const inline = tokens[cell.open + 1];
            return inline?.type === "inline" ? textOf(inline) : "";
          }),
        ),
    );
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
  if (spec.features.includes("reorder") && spec.headRows > 1) {
    // 最下段の見出しのセルに、その列を覆う結合した見出しの位置を写す
    const groups = headerGroupsOf({
      head: texts.slice(0, spec.headRows),
      plan,
    });
    const bottom = rows[spec.headRows - 1];
    for (const [column, group] of groups.entries()) {
      const cell = bottom?.cells[column];
      const open = cell ? tokens[cell.open] : undefined;
      if (open && group !== undefined) {
        open.attrSet("data-group", group);
        open.attrSet("data-mdmark-own", nonce);
      }
    }
  }
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
        // 行見出しの `scope` は開始タグの先頭に配置する
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

/** 見出しの行のセルの文字から、最下段の列ごとの列名を返却する。上と結合した `^^` は上のセルの文字にする */
function headLabelsOf(head: string[][]): string[] {
  const bottom = head.length - 1;
  return (head[bottom] ?? []).map((text, column) => {
    let row = bottom;
    let label = text.trim();
    while (label === MERGE_UP && row > 0) {
      row -= 1;
      label = (head[row]?.[column] ?? "").trim();
    }
    return label;
  });
}

/** 表のマーカーの範囲を集める */
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

/** 表にスクリーンリーダー向けの名前と tabindex を付け、`table` がオンなら、表のマーカーの範囲の表と囲まない表を表の部品の囲みに入れる */
export function decorateTables(state: StateCore): void {
  decorateAttributes(state);
  if (!featureOn(state, "table")) {
    return;
  }
  const tokens = state.tokens;
  const ranges = collectRanges(tokens);
  // 行の ID が重ならないよう、見出しの ID と前の行の ID を文書の頭から記録する
  const taken = new Set(envOf(state).headings.map((heading) => heading.id));
  const out: Token[] = [];
  // 囲みに入れて閉じていない表の `table_open` の位置と、閉じるときに配置する囲みの終わり
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
      // 表のマーカーは、ここで使用し切る
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
    // ビューのマーカーが表の指定を適用した表は、その指定で表の部品にする
    const viewSpec = (token.meta as { tableSpec?: TableSpec } | null)
      ?.tableSpec;
    const rowCount = bodyRowCount(tokens, index) + 1;
    let spec =
      viewSpec ??
      readTableSpec(range?.mark.options, headersOf(tokens, index), rowCount);
    let mergeColumns: number[] = [];
    if (range && !viewSpec) {
      if (spec.headRows > 1) {
        // 列名は見出しの最下段の行から読み込む（上と結合した `^^` は上のセルの文字）
        const head = [
          headersOf(tokens, index),
          ...bodyCellsOf(tokens, index).slice(0, spec.headRows - 1),
        ];
        spec = readTableSpec(range.mark.options, headLabelsOf(head), rowCount);
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
    const long = findLongColumns(columnLinesOf(tokens, index));
    // ビューの表は長文の列の並べ替えを戻す指定を持たないため、並べ替えを外さない
    const noSort =
      spec.features.includes("sort") && !viewSpec
        ? findNoSortColumns({ long, sorts: spec.sorts })
        : [];
    const filters: TableFilter[] = spec.filters.map((filter) => ({
      column: filter.column,
      kind: filter.kind ?? defaultFilterKind(long.includes(filter.column)),
    }));
    const widthRanges = spec.widths.flatMap((width) =>
      width.min === undefined && width.max === undefined
        ? []
        : [
            {
              column: width.column,
              ...(width.min === undefined ? {} : { min: width.min }),
              ...(width.max === undefined ? {} : { max: width.max }),
            },
          ],
    );
    const html = renderTable({
      kind: spec.kind,
      features: spec.features,
      filters: filtering ? filters : [],
      long,
      widthRanges,
      collapse: spec.collapse,
      title: spec.title,
      rowCount: bodyRowCount(tokens, index),
      hide: spec.hide,
      totals: spec.totals,
      mergeColumns,
      pin: spec.pin,
      unpin: spec.unpinned,
      check: spec.check,
      tree: spec.tree,
      noSort,
      body: SLOT_MARKER,
      rawCsv: (token.meta as Partial<CsvTableMeta> | null)?.rawCsv,
    });
    if (spec.features.includes("rowlink")) {
      linkRows(state, tokens, index, taken);
    }
    const colors = readTableColors(
      range?.mark.options,
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
    // 色の指定の警告と集計できない列の警告は、表の囲みの直前に配置する
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
    if (spec.tree !== undefined) {
      // 階層の行は、囲みに移した後に `decorateTreeTable` が作る
      token.meta = {
        ...(token.meta ?? {}),
        treeSpec: spec,
        treeMark: range?.mark.raw,
      };
    }
    // 中のトークンは、対応する `table_close` までこの繰り返しで移す（中の表も囲みに入れる）
    out.push(token);
    openTables.push({ open: index, tail });
  }
  state.tokens = out;
  // 行を差し込むと後ろの位置がずれるため、後ろの表から作る
  for (let index = out.length - 1; index >= 0; index--) {
    const token = out[index];
    const treeSpec = (token?.meta as { treeSpec?: TableSpec } | null)?.treeSpec;
    if (token?.type === "table_open" && treeSpec) {
      decorateTreeTable({
        state,
        start: index,
        end: findNestedClose(out, index),
        spec: treeSpec,
      });
    }
  }
}
