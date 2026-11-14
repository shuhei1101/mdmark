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

/** 機能の設定から、表の機能と、削除した機能・機能を足す関数 */
function featureSetOf(
  spec: MarkOptions,
  kind: TableKind,
): {
  features: TableFeature[];
  disabled: Set<string>;
  add: (name: TableFeature) => void;
} {
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
  return { features, disabled, add };
}

/** 列の設定を読み込んだ結果（`pinned` は `pinned` が `true` の列） */
type ColumnSpecs = Pick<
  TableSpec,
  "filters" | "hide" | "totals" | "unpinned" | "widths" | "check" | "sorts"
> & { pinned: number[]; warnings: WarningItem[] };

/** 列 1 つの設定を読み込むときに引く値 */
type ColumnContext = {
  /** 列の位置 */
  column: number;
  /** 列名 */
  name: string;
  settings: Record<string, unknown>;
  /** 設定のキーの機能を削除していないか */
  on: (key: string) => boolean;
  add: (name: TableFeature) => void;
  disabled: Set<string>;
};

/** `filter` の列を絞り込む列にする（`type` を省いた列は種類を持たない） */
function readFilterSetting(specs: ColumnSpecs, context: ColumnContext): void {
  const { column, settings, on } = context;
  if (!isObject(settings.filter) || !on("filter")) {
    return;
  }
  const type = settings.filter.type;
  specs.filters.push(
    typeof type === "string"
      ? { column, kind: type as FilterKind }
      : { column },
  );
}

/** `hidden` の列を既定で隠す（先頭の列は隠さずに警告にする） */
function readHiddenSetting(specs: ColumnSpecs, context: ColumnContext): void {
  const { column, name, settings, on } = context;
  if (settings.hidden !== true || !on("hidden")) {
    return;
  }
  if (column === 0) {
    specs.warnings.push({
      label: `columns.${name}.hidden`,
      message: `の列 \`${name}\` は先頭の列のため隠せません。先頭の列は行の識別子と行へのリンクの配置場所なので、隠さずに描いています。`,
    });
  } else {
    specs.hide.push(column);
  }
}

/** `total` の計算を集計に足す（同じ列の同じ計算は 1 つ） */
function readTotalSetting(specs: ColumnSpecs, context: ColumnContext): void {
  const { column, settings, on } = context;
  if (!Array.isArray(settings.total) || !on("total")) {
    return;
  }
  for (const item of settings.total) {
    const calc = isObject(item) ? item.calc : undefined;
    const duplicated = specs.totals.some(
      (total) => total.column === column && total.calc === calc,
    );
    if (typeof calc === "string" && !duplicated) {
      specs.totals.push({ column, calc: calc as TotalCalc });
    }
  }
}

/** `pinned` の列を留める列か、既定で留める列から除く列にする */
function readPinnedSetting(specs: ColumnSpecs, context: ColumnContext): void {
  const { column, settings, on, add } = context;
  if (settings.pinned === true && on("pinned")) {
    add("pin");
    specs.pinned.push(column);
  } else if (settings.pinned === false) {
    specs.unpinned.push(column);
  }
}

/** `width` の列の幅を読み込む */
function readWidthSetting(specs: ColumnSpecs, context: ColumnContext): void {
  const { column, settings } = context;
  if (!isObject(settings.width)) {
    return;
  }
  const { mode, min, max } = settings.width;
  specs.widths.push({
    column,
    mode: mode === "nowrap" ? "nowrap" : "auto",
    ...(typeof min === "number" ? { min } : {}),
    ...(typeof max === "number" ? { max } : {}),
  });
}

/** `format.type` が `check` の列を真偽値の列にする */
function readCheckSetting(specs: ColumnSpecs, context: ColumnContext): void {
  const { column, settings } = context;
  if (isObject(settings.format) && settings.format.type === "check") {
    specs.check.push(column);
  }
}

/** `sort` の列の並べ替えの指定を読み込む（`true` なら並べ替えの機能を足す） */
function readSortSetting(specs: ColumnSpecs, context: ColumnContext): void {
  const { column, settings, add, disabled } = context;
  if (typeof settings.sort !== "boolean" || disabled.has("sort")) {
    return;
  }
  if (settings.sort) {
    add("sort");
  }
  specs.sorts.push({ column, sort: settings.sort });
}

/** 列の設定の読み方 */
const COLUMN_SETTING_READERS = [
  readFilterSetting,
  readHiddenSetting,
  readTotalSetting,
  readPinnedSetting,
  readWidthSetting,
  readCheckSetting,
  readSortSetting,
];

/** `columns` の列の設定を、表の見出しと照らして読み込む */
function readColumns(
  specs: ColumnSpecs,
  context: {
    spec: MarkOptions;
    headers: string[];
    disabled: Set<string>;
    add: (name: TableFeature) => void;
  },
): void {
  const { spec, headers, disabled, add } = context;
  const columns = isObject(spec.columns) ? spec.columns : {};
  for (const [name, settings] of Object.entries(columns)) {
    if (!isObject(settings)) {
      continue;
    }
    const column = headers.indexOf(name);
    if (column < 0) {
      specs.warnings.push(unknownColumn(`columns.${name}`, name, headers));
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
    const columnContext = { column, name, settings, on, add, disabled };
    for (const read of COLUMN_SETTING_READERS) read(specs, columnContext);
  }
}

/** `header.rows` の `thead` にする行の数（読めなければ警告にして 1） */
function readHeadRows(
  header: Record<string, unknown>,
  context: { rowCount: number; warnings: WarningItem[] },
): number {
  if (typeof header.rows !== "number") {
    return 1;
  }
  if (header.rows < context.rowCount) {
    return header.rows;
  }
  context.warnings.push({
    label: "header.rows",
    message: `\`${header.rows}\` は使用できません。1 以上で表の行の数（${context.rowCount}）より小さい整数を指定してください。既定の 1 で描いています`,
  });
  return 1;
}

/** `header.columns` の行の見出しにする列の数（読めなければ警告にして 0） */
function readRowHeader(
  header: Record<string, unknown>,
  context: { columnCount: number; warnings: WarningItem[] },
): number {
  if (typeof header.columns !== "number") {
    return 0;
  }
  if (header.columns < context.columnCount) {
    return header.columns;
  }
  context.warnings.push({
    label: "header.columns",
    message: `\`${header.columns}\` は使用できません。0 以上で表の列の数（${context.columnCount}）より小さい整数を指定してください。既定の 0 で描いています`,
  });
  return 0;
}

/** 表の種類（`data`・`plain` のほかは `default`） */
const tableKindOf = (spec: MarkOptions): TableKind =>
  spec.kind === "data" || spec.kind === "plain" ? spec.kind : "default";

/** 表のマーカーの設定と表の見出しから `TableSpec` を作る。マーカーが無い表は `default` */
export function readTableSpec(
  options: MarkOptions | undefined,
  headers: string[],
  rowCount: number,
): TableSpec {
  const spec = options ?? {};
  const warnings: WarningItem[] = [];
  const kind = tableKindOf(spec);
  const { features, disabled, add } = featureSetOf(spec, kind);
  const specs: ColumnSpecs = {
    filters: [],
    hide: [],
    totals: [],
    pinned: [],
    unpinned: [],
    widths: [],
    check: [],
    sorts: [],
    warnings,
  };
  readColumns(specs, { spec, headers, disabled, add });
  const header = isObject(spec.header) ? spec.header : {};
  const headRows = readHeadRows(header, { rowCount, warnings });
  const rowHeader = readRowHeader(header, {
    columnCount: headers.length,
    warnings,
  });
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
  const { pinned, sorts, ...columnSpecs } = specs;
  return {
    ...tree,
    ...columnSpecs,
    kind,
    features,
    collapse,
    title,
    headRows,
    rowHeader,
    pin:
      features.includes("pin") && pinned.length > 0
        ? [...pinned].sort((a, b) => a - b)
        : undefined,
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

/** `columns.{列名}.highlight` の強調する列と色（表に無い列名は警告にする） */
function readHighlights(
  spec: MarkOptions,
  context: { headers: string[]; warnings: WarningItem[] },
): TableColors["highlight"] {
  const { headers, warnings } = context;
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
  return highlight;
}

/** 行の色の指定 1 つ（色・照らす列の位置・照らす値・行の範囲） */
type RowColorRule = {
  color: ColorName;
  position: number | undefined;
  value: unknown;
  range: [number, number] | undefined;
};

/** `rows.colors` の要素の照らす列の位置（列を指定しなければ `undefined`、表に無い列名は警告にして `null`） */
function rowColorColumn(
  item: Record<string, unknown>,
  context: { headers: string[]; warnings: WarningItem[] },
): number | undefined | null {
  if (typeof item.column !== "string") {
    return undefined;
  }
  const position = context.headers.indexOf(item.column);
  if (position >= 0) {
    return position;
  }
  context.warnings.push({
    ...unknownColumn("rows.colors", item.column, context.headers),
    label: item.column,
  });
  return null;
}

/** `rows.colors` の要素の行の範囲（`at` を省けば `undefined`、表に無い位置は警告にして `null`） */
function rowColorRange(
  item: Record<string, unknown>,
  context: { rowCount: number; warnings: WarningItem[] },
): [number, number] | undefined | null {
  if (item.at === undefined) {
    return undefined;
  }
  const { rowCount } = context;
  const at = item.at as number | { from: number; to?: number };
  const [from, to] =
    typeof at === "number" ? [at, at] : [at.from, at.to ?? at.from];
  if (from >= 1 && to >= from && to <= rowCount) {
    return [from, to];
  }
  const label = String(typeof at === "number" ? at : `${from}-${to}`);
  context.warnings.push({
    label,
    message: `の行の位置 \`${label}\` は表にありません。表の本文は ${rowCount} 行です。行の位置を 1〜${rowCount} で記載してください。`,
  });
  return null;
}

/** `rows.colors` の要素 1 つを読む（当てない要素は `undefined`） */
function readRowColor(
  item: unknown,
  context: { headers: string[]; rowCount: number; warnings: WarningItem[] },
): RowColorRule | undefined {
  if (!isObject(item) || typeof item.color !== "string") {
    return undefined;
  }
  // `column` と `value` の片方だけの要素は当てない（注記は `takeMarks` が記録する）
  if ((typeof item.column === "string") !== (typeof item.value === "string")) {
    return undefined;
  }
  const position = rowColorColumn(item, context);
  if (position === null) {
    return undefined;
  }
  const range = rowColorRange(item, context);
  if (range === null || (range === undefined && position === undefined)) {
    return undefined;
  }
  return { color: item.color as ColorName, position, value: item.value, range };
}

/** 行の色の指定を、本文の行のセルの文字で照らして行ごとの色にする */
function applyRowColor(
  rows: TableColors["rows"],
  context: { rule: RowColorRule; cells: string[][] },
): void {
  const { rule, cells } = context;
  const { range, position } = rule;
  cells.forEach((row, index) => {
    const inRange =
      range === undefined || (index + 1 >= range[0] && index + 1 <= range[1]);
    const matches =
      position === undefined || (row[position] ?? "").trim() === rule.value;
    if (inRange && matches) {
      rows[index] = rule.color;
    }
  });
}

/** 表のマーカーの `columns.{列名}.highlight` と `rows.colors` を、表の見出しと本文の行のセルの文字で照らして読み込む */
export function readTableColors(
  options: MarkOptions | undefined,
  headers: string[],
  cells: string[][],
): TableColors {
  const spec = options ?? {};
  const warnings: WarningItem[] = [];
  const highlight = readHighlights(spec, { headers, warnings });
  const rows: TableColors["rows"] = cells.map(() => null);
  const rowSpec = isObject(spec.rows) ? spec.rows : {};
  const colors = Array.isArray(rowSpec.colors) ? rowSpec.colors : [];
  for (const item of colors) {
    const rule = readRowColor(item, {
      headers,
      rowCount: rows.length,
      warnings,
    });
    if (rule) applyRowColor(rows, { rule, cells });
  }
  return { highlight, rows, warnings };
}

/** セルの開きのトークンか */
const isCellOpen = (token: Token): boolean =>
  token.type === "th_open" || token.type === "td_open";

/** 本文の行と列の位置を数えながら、表の直下の行とセルの開きのトークンごとに `visit` を呼ぶ */
function visitCells(
  tokens: Token[],
  tableOpen: number,
  visit: (
    token: Token,
    place: { index: number; row: number; column: number; inBody: boolean },
  ) => void,
): void {
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
      visit(token, { index, row, column: -1, inBody });
    } else if (isCellOpen(token)) {
      visit(token, { index, row, column, inBody });
      column += 1;
    }
  }
}

/** 強調する列の `th`・`td` と、色を付ける本文の行の `tr` に色の属性を付ける */
function applyTableColors(
  state: StateCore,
  tableOpen: number,
  colors: TableColors,
): void {
  const nonce = envOf(state).nonce;
  const colorOf = new Map(
    colors.highlight.map((item) => [item.column, item.color]),
  );
  visitCells(state.tokens, tableOpen, (token, { row, column, inBody }) => {
    if (token.type === "tr_open") {
      const color = inBody ? colors.rows[row] : null;
      if (color) {
        token.attrSet("data-color", color);
        token.attrSet("data-mdmark-own", nonce);
      }
      return;
    }
    const color = colorOf.get(column);
    if (color) {
      token.attrJoin("class", "mdmark-col-highlight");
      token.attrSet("data-color", color);
      token.attrSet("data-mdmark-own", nonce);
    }
  });
}

/** 真偽値の列の本文の `true`・`false` のセルの中身を ✓ と空欄にする */
function renderCheckValue(
  state: StateCore,
  cell: { token: Token; inline: Token | undefined; nonce: string },
): void {
  const { token, inline, nonce } = cell;
  const text = inline?.type === "inline" ? textOf(inline).trim() : "";
  if (!inline || !isCheckValue(text)) {
    return;
  }
  token.attrSet("data-value", text);
  const html = new state.Token("html_inline", "", 0);
  html.content = markOwn(renderCheckCell(text), nonce);
  inline.children = [html];
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
  visitCells(tokens, tableOpen, (token, { index, column, inBody }) => {
    if (token.type === "tr_open") {
      return;
    }
    const checking = spec.check.includes(column);
    if (wide.includes(column)) {
      token.attrJoin("class", "mdmark-wide");
      token.attrSet("data-mdmark-own", nonce);
    }
    if (checking) {
      token.attrJoin("class", "mdmark-align-center");
      token.attrSet("data-mdmark-own", nonce);
    }
    if (checking && inBody) {
      renderCheckValue(state, { token, inline: tokens[index + 1], nonce });
    }
  });
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
  table: { tokens: Token[]; tableOpen: number; taken: Set<string> },
): void {
  const { tokens, tableOpen, taken } = table;
  const nonce = envOf(state).nonce;
  /** マーカーを付けた HTML の `html_inline` を作る */
  const inlineHtml = (html: string): Token => {
    const token = new state.Token("html_inline", "", 0);
    token.content = markOwn(html, nonce);
    return token;
  };
  visitCells(tokens, tableOpen, (token, { index, inBody }) => {
    if (!inBody || token.type !== "tr_open") {
      return;
    }
    const inline = tokens.slice(index + 1).find((t) => t.type === "inline");
    if (!inline) {
      return;
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
  });
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

/** 表に名前を付け、セルに列の見出しを写すときの、見出しと列の位置 */
type AttributeWalk = {
  /** 直前の見出しの文字 */
  heading: string;
  /** 読み込んでいる表の見出しの文字 */
  headers: string[];
  column: number;
  /** 中の表を読み込む間の、外の表の見出しと列の位置 */
  outers: Array<{ headers: string[]; column: number }>;
};

/** トークンの種類ごとの、名前を付け・見出しを写す手順 */
const ATTRIBUTE_STEPS: Record<
  string,
  (walk: AttributeWalk, at: { token: Token; next: Token | undefined }) => void
> = {
  heading_open: (walk, { next }) => {
    walk.heading = next ? textOf(next) : "";
  },
  table_open: (walk, { token }) => {
    token.attrSet("tabindex", "0");
    token.attrSet("aria-label", walk.heading ? `表: ${walk.heading}` : "表");
    walk.outers.push({ headers: walk.headers, column: walk.column });
    walk.headers = [];
  },
  table_close: (walk) => {
    const outer = walk.outers.pop() ?? { headers: [], column: 0 };
    walk.headers = outer.headers;
    walk.column = outer.column;
  },
  tr_open: (walk) => {
    walk.column = 0;
  },
  th_open: (walk, { next }) => {
    walk.headers.push(next ? textOf(next) : "");
  },
  td_open: (walk, { token }) => {
    token.attrSet("data-label", walk.headers[walk.column] ?? "");
    walk.column += 1;
  },
};

/** 表にスクリーンリーダー向けの名前と tabindex を付け、セルに同じ列の見出しの文字を写す */
function decorateAttributes(state: StateCore): void {
  const tokens = state.tokens;
  const walk: AttributeWalk = {
    heading: "",
    headers: [],
    column: 0,
    outers: [],
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token || !Object.hasOwn(ATTRIBUTE_STEPS, token.type)) {
      continue;
    }
    ATTRIBUTE_STEPS[token.type]?.(walk, { token, next: tokens[index + 1] });
  }
}

/** `badge:` のバッジの頭 */
const BADGE_PREFIX = "badge:";

/** 改行の `html_inline`（`<br>`） */
const BREAK_TAG = /^<br\s*\/?>$/i;

/** 文字の中の `<br>`（HTML を描かない設定で文字として残ったもの） */
const BREAK_IN_TEXT = /<br\s*\/?>/i;

/** セルの中の改行（改行と `<br>`）か */
const isBreakToken = (child: Token): boolean =>
  child.type === "softbreak" ||
  child.type === "hardbreak" ||
  (child.type === "html_inline" && BREAK_TAG.test(child.content.trim()));

/** セルの中身の文字（バッジの `badge:` は除く）と、行内のコードか・空白か */
const cellPartOf = (
  child: Token,
): { text: string; code: boolean; blank: boolean } => {
  if (child.type === "code_inline") {
    const text = child.content.startsWith(BADGE_PREFIX)
      ? child.content.slice(BADGE_PREFIX.length)
      : child.content;
    return { text, code: true, blank: false };
  }
  return {
    text: child.content,
    code: false,
    blank:
      child.content === "" ||
      (child.type === "text" && child.content.trim() === ""),
  };
};

/** セルの `inline` のトークンを、改行で分けた行と短い値だけのセルかにする */
const cellLinesOf = (
  inline: Token | undefined,
): { lines: string[]; compact: boolean } => {
  const parts: string[] = [""];
  let onlyCode = true;
  let hasCode = false;
  for (const child of inline?.children ?? []) {
    if (isBreakToken(child)) {
      parts.push("");
      continue;
    }
    const part = cellPartOf(child);
    hasCode ||= part.code;
    if (!part.code && !part.blank) {
      onlyCode = false;
    }
    parts[parts.length - 1] += part.text;
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
  visitCells(tokens, tableOpen, (token, { index, column, inBody }) => {
    if (token.type === "tr_open") {
      if (inBody) body.push([]);
      else head.length = 0;
      return;
    }
    const cell = cellLinesOf(tokens[index + 1]);
    if (inBody) body.at(-1)?.push(cell);
    else head[column] = cell.lines;
  });
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
  visitCells(tokens, tableOpen, (token, { index, inBody }) => {
    if (!inBody) {
      return;
    }
    if (token.type === "tr_open") {
      rows.push([]);
      return;
    }
    const inline = tokens[index + 1];
    rows.at(-1)?.push(inline ? textOf(inline) : "");
  });
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

/** セルの開きの位置を足すか、最後のセルの閉じの位置を記録する */
function addCellIndex(
  rows: RowCells[],
  token: { type: string | undefined; index: number },
): void {
  const { type, index } = token;
  if (type === "th_open" || type === "td_open") {
    rows.at(-1)?.cells.push({ open: index, close: index });
    return;
  }
  if (type !== "th_close" && type !== "td_close") {
    return;
  }
  const cell = rows.at(-1)?.cells.at(-1);
  if (cell) {
    cell.close = index;
  }
}

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
    } else {
      addCellIndex(rows, { type, index });
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

/** 行ごとのセルの文字 */
function rowTextsOf(tokens: Token[], rows: RowCells[]): string[][] {
  return rows.map((row) =>
    row.cells.map((cell) => {
      const inline = tokens[cell.open + 1];
      return inline?.type === "inline" ? textOf(inline) : "";
    }),
  );
}

/** 本文のセルの列名を、見出しの最下段の文字（上と結合した `^^` は上のセルの文字）に替える */
function relabelBodyCells(
  tokens: Token[],
  context: { tableOpen: number; rows: RowCells[] },
): void {
  const head = rowCellsOf(tokens, context.tableOpen).filter((row) => row.head);
  const labels = headLabelsOf(rowTextsOf(tokens, head));
  for (const row of context.rows.filter((r) => !r.head)) {
    for (const [column, cell] of row.cells.entries()) {
      tokens[cell.open]?.attrSet("data-label", labels[column] ?? "");
    }
  }
}

/** 最下段の見出しのセルに、その列を覆う結合した見出しの位置を写す */
function markHeaderGroups(
  tokens: Token[],
  context: {
    rows: RowCells[];
    texts: string[][];
    plan: ReturnType<typeof planCellMerges>;
    headRows: number;
    nonce: string;
  },
): void {
  const { rows, texts, plan, headRows, nonce } = context;
  const groups = headerGroupsOf({ head: texts.slice(0, headRows), plan });
  const bottom = rows[headRows - 1];
  for (const [column, group] of groups.entries()) {
    const cell = bottom?.cells[column];
    const open = cell ? tokens[cell.open] : undefined;
    if (open && group !== undefined) {
      open.attrSet("data-group", group);
      open.attrSet("data-mdmark-own", nonce);
    }
  }
}

/** セルの結合を当てるときに引く値 */
type MergeContext = {
  tokens: Token[];
  rows: RowCells[];
  spec: TableSpec;
  dropped: Set<Token>;
  nonce: string;
};

/** 結合の計画のセル 1 つ */
type PlannedCell = NonNullable<
  ReturnType<typeof planCellMerges>["cells"][number][number]
>;

/** 開きのトークンに、mdmark が付けた属性として値を付ける */
function setOwn(
  token: Token,
  attribute: { name: string; value: string; nonce: string },
): void {
  token.attrSet(attribute.name, attribute.value);
  token.attrSet("data-mdmark-own", attribute.nonce);
}

/** 結合元のセルの中身を写し、結合したセルを隠す */
function hideMergedCell(
  context: MergeContext,
  cell: { open: Token; inline: Token | undefined; planned: PlannedCell },
): void {
  const { tokens, rows, nonce } = context;
  const { open, inline, planned } = cell;
  const [sourceRow, sourceColumn] = planned.source as [number, number];
  const source = rows[sourceRow]?.cells[sourceColumn];
  const from = source ? tokens[source.open + 1] : undefined;
  if (from?.type === "inline" && inline?.type === "inline") {
    inline.content = from.content;
    inline.children = [...(from.children ?? [])];
  }
  setOwn(open, { name: "data-merge", value: planned.merged as string, nonce });
  // 値の無い属性は落とされるため、属性の名前を値にする
  setOwn(open, { name: "hidden", value: "hidden", nonce });
}

/** 結合するセルに `rowspan`・`colspan` と、見出しのセルに `scope` を付ける */
function setSpans(
  context: MergeContext,
  cell: { open: Token; head: boolean; planned: PlannedCell },
): void {
  const { spec, nonce } = context;
  const { open, head, planned } = cell;
  if (planned.rowspan > 1) {
    setOwn(open, { name: "rowspan", value: String(planned.rowspan), nonce });
  }
  if (planned.colspan > 1) {
    setOwn(open, { name: "colspan", value: String(planned.colspan), nonce });
  }
  if (
    head &&
    (spec.headRows > 1 || planned.rowspan > 1 || planned.colspan > 1)
  ) {
    setOwn(open, {
      name: "scope",
      value: planned.colspan > 1 ? "colgroup" : "col",
      nonce,
    });
  }
}

/** セル 1 つに結合の計画を当てる。見出しの結合したセルのトークンは `dropped` に入れる */
function applyPlannedCell(
  context: MergeContext,
  place: {
    row: RowCells;
    column: number;
    cell: { open: number; close: number };
    planned: PlannedCell;
  },
): void {
  const { tokens, spec, dropped, nonce } = context;
  const { row, column, cell, planned } = place;
  const open = tokens[cell.open] as Token;
  if (row.head && planned.merged) {
    for (let index = cell.open; index <= cell.close; index++) {
      const token = tokens[index];
      if (token) {
        dropped.add(token);
      }
    }
    return;
  }
  if (!row.head && column < spec.rowHeader) {
    toHeadCell(open, tokens[cell.close]);
    // 行見出しの `scope` は開始タグの先頭に配置する
    open.attrs = [["scope", "row"], ...(open.attrs ?? [])];
    open.attrSet("data-mdmark-own", nonce);
  }
  if (planned.merged && planned.source) {
    hideMergedCell(context, {
      open,
      inline: tokens[cell.open + 1],
      planned,
    });
    return;
  }
  setSpans(context, { open, head: row.head, planned });
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
    relabelBodyCells(tokens, { tableOpen, rows });
  }
  const texts = rowTextsOf(tokens, rows);
  const plan = planCellMerges({ cells: texts, headRows: spec.headRows });
  if (spec.features.includes("reorder") && spec.headRows > 1) {
    markHeaderGroups(tokens, {
      rows,
      texts,
      plan,
      headRows: spec.headRows,
      nonce,
    });
  }
  const context: MergeContext = { tokens, rows, spec, dropped, nonce };
  for (const [r, row] of rows.entries()) {
    for (const [column, cell] of row.cells.entries()) {
      const planned = plan.cells[r]?.[column];
      if (tokens[cell.open] && planned) {
        applyPlannedCell(context, { row, column, cell, planned });
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

/** 表を表の部品の囲みに入れるときに引く値 */
type DecorateContext = {
  state: StateCore;
  tokens: Token[];
  ranges: TableRange[];
  /** 文書の頭からの見出しの ID と前の行の ID（行の ID が重ならないよう記録する） */
  taken: Set<string>;
  out: Token[];
  /** 囲みに入れて閉じていない表の `table_open` の位置と、閉じるときに配置する囲みの終わり */
  openTables: Array<{ open: number; tail: string }>;
  /** 見出しの結合したセルのトークン（囲みに移さない） */
  dropped: Set<Token>;
};

/** 表を囲む表のマーカーの範囲（外の表より内側で、表を含む最も内側の範囲） */
function rangeOf(
  ranges: TableRange[],
  place: { index: number; outer: { open: number } | undefined },
): TableRange | undefined {
  const { index, outer } = place;
  return ranges
    .filter(
      (candidate) =>
        candidate.open < index &&
        candidate.open > (outer?.open ?? -1) &&
        (candidate.close < 0 || index < candidate.close),
    )
    .pop();
}

/** 表の指定と、本文の行で結合した列。ビューのマーカーが表の指定を適用した表は、その指定で表の部品にする */
function tableSpecOf(
  context: DecorateContext,
  table: { token: Token; index: number; range: TableRange | undefined },
): { spec: TableSpec; mergeColumns: number[]; fromView: boolean } {
  const { state, tokens, dropped } = context;
  const { token, index, range } = table;
  const viewSpec = (token.meta as { tableSpec?: TableSpec } | null)?.tableSpec;
  if (viewSpec) {
    return { spec: viewSpec, mergeColumns: [], fromView: true };
  }
  const rowCount = bodyRowCount(tokens, index) + 1;
  let spec = readTableSpec(
    range?.mark.options,
    headersOf(tokens, index),
    rowCount,
  );
  if (!range) {
    return { spec, mergeColumns: [], fromView: false };
  }
  if (spec.headRows > 1) {
    // 列名は見出しの最下段の行から読み込む（上と結合した `^^` は上のセルの文字）
    const head = [
      headersOf(tokens, index),
      ...bodyCellsOf(tokens, index).slice(0, spec.headRows - 1),
    ];
    spec = readTableSpec(range.mark.options, headLabelsOf(head), rowCount);
  }
  const merged = mergeTableCells({ state, tableOpen: index, spec, dropped });
  spec.warnings.push(...merged.warnings);
  return { spec, mergeColumns: merged.mergeColumns, fromView: false };
}

/** 幅の範囲を指定した列の、下限と上限 */
function widthRangesOf(
  widths: TableSpec["widths"],
): Array<{ column: number; min?: number; max?: number }> {
  return widths.flatMap((width) =>
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
}

/** 表の部品の囲みの引数 */
function tableOptionsOf(
  tokens: Token[],
  table: {
    token: Token;
    index: number;
    spec: TableSpec;
    mergeColumns: number[];
    fromView: boolean;
  },
): Parameters<typeof renderTable>[0] {
  const { token, index, spec, mergeColumns, fromView } = table;
  const long = findLongColumns(columnLinesOf(tokens, index));
  // ビューの表は長文の列の並べ替えを戻す指定を持たないため、並べ替えを外さない
  const noSort =
    spec.features.includes("sort") && !fromView
      ? findNoSortColumns({ long, sorts: spec.sorts })
      : [];
  const filters: TableFilter[] = spec.filters.map((filter) => ({
    column: filter.column,
    kind: filter.kind ?? defaultFilterKind(long.includes(filter.column)),
  }));
  return {
    kind: spec.kind,
    features: spec.features,
    filters: spec.features.includes("filter") ? filters : [],
    long,
    widthRanges: widthRangesOf(spec.widths),
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
  };
}

/** 囲みの頭（折り畳みの外）に差し込む警告（表の指定の警告と、閉じのマーカーが無い警告） */
function headWarningsOf(
  range: TableRange | undefined,
  spec: TableSpec,
): SyntaxWarning[] {
  if (!range) {
    return [];
  }
  const warnings = warningsOf(range.mark.raw, spec.warnings);
  if (range.close < 0 && !range.warned) {
    range.warned = true;
    warnings.push(unclosedWarning(range.mark));
  }
  return warnings;
}

/** 色の指定の警告と集計できない列の警告を、表の囲みの直前に配置する */
function pushLeadingWarnings(
  context: DecorateContext,
  table: {
    index: number;
    range: TableRange | undefined;
    spec: TableSpec;
    colors: TableColors;
  },
): void {
  const { state, tokens, out } = context;
  const { index, range, spec, colors } = table;
  const owner = range ? tokens[range.open] : undefined;
  if (range) {
    for (const warning of warningsOf(range.mark.raw, colors.warnings)) {
      out.push(warningBlock(state, warning, owner));
    }
  }
  if (!spec.features.includes("total")) {
    return;
  }
  for (const warning of unreadableTotalWarnings({
    tokens,
    tableOpen: index,
    totals: spec.totals,
  })) {
    out.push(warningBlock(state, warning, owner));
  }
}

/** 階層の表は、囲みに移した後に `decorateTreeTable` が行を作るため、表の指定を記録する */
function markTreeSpec(
  token: Token,
  table: { spec: TableSpec; range: TableRange | undefined },
): void {
  if (table.spec.tree === undefined) {
    return;
  }
  token.meta = {
    ...(token.meta ?? {}),
    treeSpec: table.spec,
    treeMark: table.range?.mark.raw,
  };
}

/** 表を表の部品の囲みの頭に入れ、閉じるときに配置する囲みの終わりを記録する */
function openTable(
  context: DecorateContext,
  table: { token: Token; index: number; outer: { open: number } | undefined },
): void {
  const { state, tokens, out } = context;
  const { token, index } = table;
  const range = rangeOf(context.ranges, table);
  const { spec, mergeColumns, fromView } = tableSpecOf(context, {
    token,
    index,
    range,
  });
  const html = renderTable(
    tableOptionsOf(tokens, { token, index, spec, mergeColumns, fromView }),
  );
  if (spec.features.includes("rowlink")) {
    linkRows(state, { tokens, tableOpen: index, taken: context.taken });
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
  const warnings = headWarningsOf(range, spec);
  pushLeadingWarnings(context, { index, range, spec, colors });
  const owner = range ? tokens[range.open] : undefined;
  const open = ownBlock(state, head.slice(0, divEnd), owner ?? token);
  open.meta = { role: "table-open" };
  out.push(open);
  for (const warning of warnings) {
    out.push(warningBlock(state, warning, owner));
  }
  out.push(ownBlock(state, head.slice(divEnd)));
  markTreeSpec(token, { spec, range });
  // 中のトークンは、対応する `table_close` までこの繰り返しで移す（中の表も囲みに入れる）
  out.push(token);
  context.openTables.push({ open: index, tail });
}

/** トークン 1 つを囲みに移す（表のマーカーは使用し切り、表は囲みに入れる） */
function moveTableToken(context: DecorateContext, index: number): void {
  const { state, tokens, out, openTables } = context;
  const token = tokens[index];
  if (!token || context.dropped.has(token)) {
    return;
  }
  if (markOf(token)?.name === "table") {
    return;
  }
  const outer = openTables.at(-1);
  if (token.type === "table_close" && outer) {
    openTables.pop();
    out.push(token);
    const close = ownBlock(state, outer.tail);
    close.meta = { role: "table-close" };
    out.push(close);
    return;
  }
  if (token.type !== "table_open") {
    out.push(token);
    return;
  }
  openTable(context, { token, index, outer });
}

/** 階層の表の行を作る。行を差し込むと後ろの位置がずれるため、後ろの表から作る */
function decorateTreeTables(state: StateCore, tokens: Token[]): void {
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index];
    const treeSpec = (token?.meta as { treeSpec?: TableSpec } | null)?.treeSpec;
    if (token?.type === "table_open" && treeSpec) {
      decorateTreeTable({
        state,
        start: index,
        end: findNestedClose(tokens, index),
        spec: treeSpec,
      });
    }
  }
}

/** 表にスクリーンリーダー向けの名前と tabindex を付け、`table` がオンなら、表のマーカーの範囲の表と囲まない表を表の部品の囲みに入れる */
export function decorateTables(state: StateCore): void {
  decorateAttributes(state);
  if (!featureOn(state, "table")) {
    return;
  }
  const tokens = state.tokens;
  const context: DecorateContext = {
    state,
    tokens,
    ranges: collectRanges(tokens),
    taken: new Set(envOf(state).headings.map((heading) => heading.id)),
    out: [],
    openTables: [],
    dropped: new Set(),
  };
  for (let index = 0; index < tokens.length; index++) {
    moveTableToken(context, index);
  }
  state.tokens = context.out;
  decorateTreeTables(state, context.out);
}
