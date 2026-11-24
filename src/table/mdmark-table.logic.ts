import { escapeHtml } from "../shared/escape.logic.ts";
import {
  type ColumnLines,
  defaultFilterKind,
  type FilterKind,
  findLongColumns,
  findNoSortColumns,
} from "./table.logic.ts";
import type { TableFilter, TableOptions } from "./table.part.ts";

/** 行の値の型 */
export type MdmarkTableValue = string | number | null;

/** 列の定義（`<mdmark-table>` の `columns` の要素） */
export type MdmarkTableColumn = {
  /** 列のキー */
  key: string;
  /** 列名 */
  title: string;
  /** 描いた直後にピン止めする */
  pinned?: boolean;
  /** 描いた直後に隠す */
  hidden?: boolean;
  /** 絞り込み */
  filter?: { type?: FilterKind };
  /** 列の幅。意味は表のマーカーの設定の `columns.{列名}.width` */
  width?: { mode?: "auto" | "wrap" | "nowrap"; min?: number; max?: number };
  /** 編集できる列 */
  editable?: boolean;
  /** セルの中身の描き方 */
  render?: (value: MdmarkTableValue, row: MdmarkTableRow) => Node | string;
};

/** 行のデータ（`<mdmark-table>` の `rows` の要素） */
export type MdmarkTableRow = {
  /** 行のキー */
  key: string;
  /** 列のキーごとの値 */
  values: Record<string, MdmarkTableValue>;
};

/** 受け付ける機能 */
export const TABLE_ELEMENT_FEATURES = [
  "sort",
  "pin",
  "filter",
  "resize",
  "count",
  "columns",
  "reorder",
  "add",
] as const;

/** 機能の名前 */
export type MdmarkTableFeatureName = (typeof TABLE_ELEMENT_FEATURES)[number];

/** 表の機能（`<mdmark-table>` の `features`） */
export type MdmarkTableFeatures = Partial<
  Record<MdmarkTableFeatureName, { enabled?: boolean }>
>;

/** 指定の誤り */
export type TableSpecIssue = {
  /** 誤った指定の名前 */
  path: string;
  /** 誤りの内容と修正方法 */
  reason: string;
};

/** 確認済みの指定 */
export type TableSpec = {
  columns: MdmarkTableColumn[];
  rows: MdmarkTableRow[];
  features: MdmarkTableFeatures | undefined;
};

/** 種類 `data` の既定の機能 */
const DATA_FEATURES = ["sort", "pin", "filter", "resize"];

/** 絞り込みの種類 */
const FILTER_KINDS: readonly string[] = ["select", "text", "date"];

/** オブジェクト（配列と null を除く）か */
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 空でない文字列か */
const isFilledText = (value: unknown): value is string =>
  typeof value === "string" && value !== "";

/** 省いたか真偽値か */
const isOptionalBoolean = (value: unknown): boolean =>
  value === undefined || typeof value === "boolean";

/** 行の値に指定できる値か */
const isTableValue = (value: unknown): boolean =>
  value === null ||
  typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value));

/** 誤りを作る */
const issueOf = (path: string, reason: string): TableSpecIssue => ({
  path,
  reason,
});

/** 列の幅の指定の誤り */
const widthIssue = (
  width: unknown,
  path: string,
): TableSpecIssue | undefined => {
  if (width === undefined) {
    return undefined;
  }
  if (!isObject(width)) {
    return issueOf(
      path,
      " にオブジェクトでない値が指定されています。`{ min, max }` のオブジェクトで指定してください。",
    );
  }
  for (const side of ["min", "max"] as const) {
    const value = width[side];
    if (value !== undefined && !(typeof value === "number" && value > 0)) {
      return issueOf(
        `${path}.${side}`,
        " に正の数でない値が指定されています。em の数を正の数で指定してください。",
      );
    }
  }
  return undefined;
};

/** 列のキーと列名の誤り（重なりを `seen` に記録する） */
const identityIssue = (
  column: Record<string, unknown>,
  path: string,
  seen: { keys: Set<string>; titles: Set<string> },
): TableSpecIssue | undefined => {
  for (const name of ["key", "title"] as const) {
    const value = column[name];
    const set = name === "key" ? seen.keys : seen.titles;
    if (!isFilledText(value)) {
      return issueOf(
        `${path}.${name}`,
        " に空でない文字列を指定してください。",
      );
    }
    if (set.has(value)) {
      return issueOf(
        `${path}.${name}`,
        " がほかの列と重なっています。列の定義の中で重ならない値を指定してください。",
      );
    }
    set.add(value);
  }
  return undefined;
};

/** 真偽値の指定（ピン止め・最初から隠す・編集できる列）の誤り */
const flagsIssue = (
  column: Record<string, unknown>,
  path: string,
  index: number,
): TableSpecIssue | undefined => {
  const name = (["pinned", "hidden", "editable"] as const).find(
    (flag) => !isOptionalBoolean(column[flag]),
  );
  if (name) {
    return issueOf(`${path}.${name}`, " に真偽値を指定してください。");
  }
  return index === 0 && column.hidden === true
    ? issueOf(
        `${path}.hidden`,
        " は先頭の列に指定できません。先頭の列は隠せません。",
      )
    : undefined;
};

/** 絞り込みの指定の誤り */
const filterIssue = (
  filter: unknown,
  path: string,
): TableSpecIssue | undefined => {
  if (filter === undefined) {
    return undefined;
  }
  if (!isObject(filter)) {
    return issueOf(
      path,
      " にオブジェクトでない値が指定されています。`{}` か `{ type }` で指定してください。",
    );
  }
  return filter.type !== undefined &&
    !FILTER_KINDS.includes(String(filter.type))
    ? issueOf(
        `${path}.type`,
        " に `select`・`text`・`date` のどれかを指定してください。",
      )
    : undefined;
};

/** 列の定義 1 つの誤り */
const columnIssue = (
  column: unknown,
  index: number,
  seen: { keys: Set<string>; titles: Set<string> },
): TableSpecIssue | undefined => {
  const path = `columns[${index}]`;
  if (!isObject(column)) {
    return issueOf(
      path,
      " にオブジェクトでない値が指定されています。列の定義をオブジェクトで指定してください。",
    );
  }
  const renderIssue =
    column.render !== undefined && typeof column.render !== "function"
      ? issueOf(`${path}.render`, " に関数を指定してください。")
      : undefined;
  return (
    identityIssue(column, path, seen) ??
    flagsIssue(column, path, index) ??
    filterIssue(column.filter, `${path}.filter`) ??
    renderIssue ??
    widthIssue(column.width, `${path}.width`)
  );
};

/** 列の定義の誤り */
const columnsIssue = (columns: unknown): TableSpecIssue | undefined => {
  if (!Array.isArray(columns) || columns.length === 0) {
    return issueOf(
      "columns",
      " に列の定義の配列（1 つ以上）を指定してください。",
    );
  }
  const seen = { keys: new Set<string>(), titles: new Set<string>() };
  for (const [index, column] of columns.entries()) {
    const issue = columnIssue(column, index, seen);
    if (issue) {
      return issue;
    }
  }
  return undefined;
};

/** 行のデータの誤り */
const rowsIssue = (rows: unknown): TableSpecIssue | undefined => {
  if (!Array.isArray(rows)) {
    return issueOf(
      "rows",
      " に配列でない値が指定されています。行のデータを、行ごとのオブジェクトの配列で指定してください。",
    );
  }
  const keys = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const path = `rows[${index}]`;
    if (!isObject(row)) {
      return issueOf(
        path,
        " にオブジェクトでない値が指定されています。`{ key, values }` で指定してください。",
      );
    }
    if (typeof row.key !== "string") {
      return issueOf(`${path}.key`, " に文字列を指定してください。");
    }
    if (keys.has(row.key)) {
      return issueOf(
        `${path}.key`,
        " がほかの行と重なっています。行のデータの中で重ならない値を指定してください。",
      );
    }
    keys.add(row.key);
    if (!isObject(row.values)) {
      return issueOf(
        `${path}.values`,
        " に列のキーごとの値のオブジェクトを指定してください。",
      );
    }
    for (const [key, value] of Object.entries(row.values)) {
      if (!isTableValue(value)) {
        return issueOf(
          `${path}.values.${key}`,
          " に文字列・有限の数値・`null` のどれかを指定してください。",
        );
      }
    }
  }
  return undefined;
};

/** 表の機能の誤り */
const featuresIssue = (features: unknown): TableSpecIssue | undefined => {
  if (features === undefined) {
    return undefined;
  }
  if (!isObject(features)) {
    return issueOf(
      "features",
      " にオブジェクトでない値が指定されています。機能の名前をキーにしたオブジェクトで指定してください。",
    );
  }
  const names: readonly string[] = TABLE_ELEMENT_FEATURES;
  for (const [name, value] of Object.entries(features)) {
    if (!names.includes(name)) {
      return issueOf(
        `features.${name}`,
        ` は受け付けない機能です。${TABLE_ELEMENT_FEATURES.join("・")} のどれかを指定してください。`,
      );
    }
    if (!isObject(value)) {
      return issueOf(
        `features.${name}`,
        " に `{}` か `{ enabled }` を指定してください。",
      );
    }
    if (!isOptionalBoolean(value.enabled)) {
      return issueOf(
        `features.${name}.enabled`,
        " に真偽値を指定してください。",
      );
    }
  }
  return undefined;
};

/** `columns`・`rows`・`features` を確認し、最初に見つけた誤りを返却する（誤りが無ければ `undefined`） */
export const checkTableSpec = (spec: {
  columns: unknown;
  rows: unknown;
  features: unknown;
}): TableSpecIssue | undefined =>
  columnsIssue(spec.columns) ??
  rowsIssue(spec.rows) ??
  featuresIssue(spec.features);

/** 行の値をセルに出す文字にする */
export const cellText = (value: MdmarkTableValue | undefined): string =>
  value === null || value === undefined ? "" : String(value);

/** 条件に合う列の位置 */
const positionsOf = (
  columns: MdmarkTableColumn[],
  match: (column: MdmarkTableColumn) => boolean,
): number[] =>
  columns.flatMap((column, index) => (match(column) ? [index] : []));

/** 付ける機能の並び */
const featuresOf = (spec: TableSpec): string[] => {
  const { columns } = spec;
  const requested = Object.entries(spec.features ?? {});
  const removed = new Set(
    requested
      .filter(([, value]) => value?.enabled === false)
      .map(([name]) => name),
  );
  const added = requested
    .filter(([name, value]) => name !== "add" && value?.enabled !== false)
    .map(([name]) => name);
  const implied = [
    ...(columns.some((column) => column.pinned) ? ["pin"] : []),
    ...(columns.some((column) => column.filter) ? ["filter"] : []),
    ...(columns.some((column) => column.hidden) ? ["columns"] : []),
  ];
  return [...new Set([...DATA_FEATURES, ...added, ...implied])].filter(
    (name) => !removed.has(name),
  );
};

/** 長文の列を決める列ごとの行 */
const columnLinesOf = (spec: TableSpec): ColumnLines[] =>
  spec.columns.map((column) => ({
    head: column.title.split("\n"),
    cells: spec.rows.map((row) => ({
      lines: cellText(row.values[column.key]).split("\n"),
      compact: false,
    })),
  }));

/** 確認済みの指定を `renderTable` の引数にする */
export const toTableOptions = (spec: TableSpec): TableOptions => {
  const { columns, rows } = spec;
  const features = featuresOf(spec);
  const long = findLongColumns(columnLinesOf(spec));
  const filters: TableFilter[] = columns.flatMap((column, index) =>
    column.filter
      ? [
          {
            column: index,
            kind: column.filter.type ?? defaultFilterKind(long.includes(index)),
          },
        ]
      : [],
  );
  const pin = positionsOf(columns, (column) => column.pinned === true);
  return {
    kind: "data",
    features,
    columns: columns.map((column) => escapeHtml(column.title)),
    columnKeys: columns.map((column) => column.key),
    rows: rows.map((row) =>
      columns.map((column) => escapeHtml(cellText(row.values[column.key]))),
    ),
    rowKeys: rows.map((row) => row.key),
    filters,
    long,
    noSort: features.includes("sort")
      ? findNoSortColumns({ long, sorts: [] })
      : [],
    ...(pin.length > 0 ? { pin } : {}),
    hide: positionsOf(columns, (column) => column.hidden === true),
    widthRanges: columns.flatMap((column, index) =>
      column.width &&
      (column.width.min !== undefined || column.width.max !== undefined)
        ? [
            {
              column: index,
              ...(column.width.min === undefined
                ? {}
                : { min: column.width.min }),
              ...(column.width.max === undefined
                ? {}
                : { max: column.width.max }),
            },
          ]
        : [],
    ),
    wide: positionsOf(columns, (column) => column.width?.mode === "nowrap"),
    editable: positionsOf(columns, (column) => column.editable === true),
    pressable: true,
    addRow:
      spec.features?.add !== undefined && spec.features.add.enabled !== false,
  };
};
