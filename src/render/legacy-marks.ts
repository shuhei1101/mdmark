import { COLOR_SCHEMES, COLOR_THEMES } from "../config.ts";
import { COLOR_NAMES } from "../parts/colors.ts";
import { FILTER_KINDS, TOTAL_CALCS } from "../table-logic.ts";
import type { MarkOptions } from "./mark-options.ts";
import {
  FEATURES_MARK,
  MARK_PATTERN,
  PAGE_MARK,
  parseMarkArgs,
  SYNTAX_MARKS,
} from "./marks.ts";
import { titleTailOf } from "./syntax/collapse.ts";
import { TABLE_FEATURES, TABLE_KINDS } from "./syntax/tables.ts";

/** 書き出さない今の書き方の記載 1 つ */
export type DroppedLegacyArg = {
  /** 記載した文字（`total=数量:sum`・`filter=名前:range`） */
  text: string;
  /** 書き出さない理由 */
  reason: string;
};

/** 移行の報告の行 1 つ */
export type LegacyReportLine = {
  /** 文書の行（1 から） */
  line: number;
  /** マーカーの名前 */
  name: string;
  /** 記載した文字 */
  text: string;
  /** 書き出さない理由か書き換えない理由 */
  reason: string;
};

/** ページの設定のマーカーのキーごとの選べる値 */
const PAGE_VALUES: Readonly<Record<string, readonly string[]>> = {
  scheme: COLOR_SCHEMES,
  theme: COLOR_THEMES,
  toc: ["hover", "fixed"],
};

/** 移行で書き換えないマーカー（引数を最初から JSON のオブジェクトで持つ） */
const UNCONVERTED_SYNTAX = new Set(["map", "map-data"]);

/** 変換の途中の結果 */
type Converted = { options: MarkOptions; dropped: DroppedLegacyArg[] };

/** `2,4-6` を行の番号と範囲の並びにする。読めない要素は `dropped` に入れる */
const rangesOf = (
  key: string,
  value: string,
  dropped: DroppedLegacyArg[],
): Array<number | { from: number; to: number }> => {
  const out: Array<number | { from: number; to: number }> = [];
  for (const part of value.split(",")) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      out.push({ from: Number(range[1]), to: Number(range[2]) });
    } else if (/^\d+$/.test(part)) {
      out.push(Number(part));
    } else {
      dropped.push({
        text: `${key}=${part}`,
        reason: `読み込めない行の指定です。2・4-6 のように、行の番号と範囲をコンマで並べてください`,
      });
    }
  }
  return out;
};

/** `closed`・`open`・`title=` から共通のオブジェクトの折り畳みを作る（`closed` と `open` の両方は `open` の `false`、値の無い `title=` は `title` を省く） */
const collapseOf = (
  flags: string[],
  title: string | undefined,
): MarkOptions | undefined => {
  if (flags.length === 0) {
    return undefined;
  }
  const collapse: MarkOptions = { open: !flags.includes("closed") };
  if (title) {
    collapse.title = title;
  }
  return collapse;
};

/** `title=` の値の空白の後ろの単語を書き出さない理由 */
const TITLE_SPACE_REASON =
  "今の書き方のマーカーの引数は空白で区切るため、title= の値に空白は記載できません";

/** 名前と機能の名前の記載の誤り */
const unknownWord = (text: string): DroppedLegacyArg => ({
  text,
  reason: "このバージョンの mdmark が知らない指定です",
});

/** 引数の単語を書き出さない理由（`title=` の値の空白の後ろの単語か、知らない指定） */
const droppedArg = (arg: string, tail: string | undefined): DroppedLegacyArg =>
  arg === tail ? { text: arg, reason: TITLE_SPACE_REASON } : unknownWord(arg);

/** `closed`・`open`・`title=` の折り畳みを `options` に入れる。`title=` だけのときは書き出さない */
const collapseInto = (
  converted: Converted,
  context: { flags: string[]; title: string | undefined; scope: string },
): void => {
  const { flags, title, scope } = context;
  const collapse = collapseOf(flags, title);
  if (collapse) {
    converted.options.collapse = collapse;
  } else if (title !== undefined) {
    converted.dropped.push({
      text: `title=${title}`,
      reason: `closed か open と一緒に記載した${scope}でだけ使用できるため、今の実装は適用していません`,
    });
  }
};

/** 表のマーカーを変換するときに集める値 */
type TableConversion = {
  dropped: DroppedLegacyArg[];
  /** 表が持つ機能 */
  enabled: Set<string>;
  columns: Record<string, MarkOptions>;
  header: MarkOptions;
  /** 列の値で色を付ける行 */
  colors: MarkOptions[];
  /** 位置で色を付ける行 */
  atColors: MarkOptions[];
  tree: MarkOptions;
};

/** 機能を足す・外す単語（`+名前`・`-名前`）か */
const isFeatureToggle = (arg: string): boolean =>
  /^[+-]/.test(arg) &&
  (TABLE_FEATURES as readonly string[]).includes(arg.slice(1));

/** 表のマーカーの単語（種類・折り畳み・機能を足す・外す）を読む */
const readTableArgs = (
  args: string[],
  context: { tail: string | undefined; dropped: DroppedLegacyArg[] },
): {
  kind: string;
  flags: string[];
  features: Record<string, MarkOptions>;
} => {
  let kind = "default";
  const flags: string[] = [];
  const features: Record<string, MarkOptions> = {};
  args.forEach((arg, index) => {
    if (index === 0 && (arg === "data" || arg === "plain")) {
      kind = arg;
    } else if (arg === "closed" || arg === "open") {
      flags.push(arg);
    } else if (isFeatureToggle(arg)) {
      features[arg.slice(1)] = arg.startsWith("+") ? {} : { enabled: false };
    } else {
      context.dropped.push(droppedArg(arg, context.tail));
    }
  });
  return { kind, flags, features };
};

/** 種類の機能に、足す・外す機能を当てた表の機能 */
const enabledOf = (
  kind: string,
  features: Record<string, MarkOptions>,
): Set<string> => {
  const enabled = new Set<string>(
    TABLE_KINDS[kind as keyof typeof TABLE_KINDS],
  );
  for (const [name, value] of Object.entries(features)) {
    if (value.enabled === false) {
      enabled.delete(name);
    } else {
      enabled.add(name);
    }
  }
  return enabled;
};

/** 列名の列の設定（無ければ作る） */
const tableColumn = (conv: TableConversion, name: string): MarkOptions => {
  conv.columns[name] ??= {};
  return conv.columns[name] as MarkOptions;
};

/** 表のキーの値 */
type TableEntry = { key: string; value: string };

/** 機能の無い表に記載したキーを書き出さない */
const needsFeature = (
  conv: TableConversion,
  entry: TableEntry & { feature: string },
): boolean => {
  const { key, value, feature } = entry;
  if (conv.enabled.has(feature)) {
    return true;
  }
  conv.dropped.push({
    text: `${key}=${value}`,
    reason: `+${feature} を記載した表でだけ使用できるため、今の実装は適用していません`,
  });
  return false;
};

/** 名前の並びの列ごとに、列の設定のキーに値を入れる */
const setColumns = (
  conv: TableConversion,
  entry: { value: string; key: string; setting: unknown },
): void => {
  for (const name of entry.value.split(",")) {
    tableColumn(conv, name)[entry.key] = entry.setting;
  }
};

/** `filter=名前:種類` を列の絞り込みにする */
const readFilterKey = (conv: TableConversion, entry: TableEntry): void => {
  if (!needsFeature(conv, { ...entry, feature: "filter" })) return;
  for (const item of entry.value.split(",")) {
    const [name = "", type] = item.split(":");
    if (
      type !== undefined &&
      !(FILTER_KINDS as readonly string[]).includes(type)
    ) {
      conv.dropped.push({
        text: `filter=${item}`,
        reason: `絞り込みの種類 ${type} は使用できません。使用できる種類は select・text・date です`,
      });
      continue;
    }
    tableColumn(conv, name).filter = type === undefined ? {} : { type };
  }
};

/** `total=名前:計算` を列の集計にする */
const readTotalKey = (conv: TableConversion, entry: TableEntry): void => {
  if (!needsFeature(conv, { ...entry, feature: "total" })) return;
  for (const item of entry.value.split(",")) {
    const [name = "", calc = ""] = item.split(":");
    if (!(TOTAL_CALCS as readonly string[]).includes(calc)) {
      conv.dropped.push({
        text: `total=${item}`,
        reason: `計算 ${calc} は使用できません。使用できる計算は sum・avg・count です`,
      });
      continue;
    }
    const settings = tableColumn(conv, name);
    settings.total = [...((settings.total as MarkOptions[]) ?? []), { calc }];
  }
};

/** 色の名前か */
const isColorName = (color: string): boolean =>
  (COLOR_NAMES as readonly string[]).includes(color);

/** `highlight=名前:色` を列の強調にする */
const readHighlightKey = (conv: TableConversion, entry: TableEntry): void => {
  for (const item of entry.value.split(",")) {
    const [name = "", color] = item.split(":");
    if (color !== undefined && !isColorName(color)) {
      conv.dropped.push({
        text: `highlight=${item}`,
        reason: `色の名前 ${color} は使用できません`,
      });
      continue;
    }
    tableColumn(conv, name).highlight = color === undefined ? {} : { color };
  }
};

/** `row-color=名前:値=色,…` を列の値で色を付ける行にする */
const readRowColorKey = (conv: TableConversion, entry: TableEntry): void => {
  const [name = "", pairs = ""] = entry.value.split(/:(.*)/s);
  for (const pair of pairs.split(",")) {
    const [cell = "", color = ""] = pair.split("=");
    if (!isColorName(color)) {
      conv.dropped.push({
        text: `row-color=${name}:${pair}`,
        reason: `色の名前 ${color} は使用できません`,
      });
      continue;
    }
    conv.colors.push({ column: name, value: cell, color });
  }
};

/** 行の位置（`2`・`4-6`。読めなければ `undefined`） */
const rowAtOf = (
  position: string,
): number | { from: number; to: number } | undefined => {
  const range = /^(\d+)-(\d+)$/.exec(position);
  if (range) {
    return { from: Number(range[1]), to: Number(range[2]) };
  }
  return /^\d+$/.test(position) ? Number(position) : undefined;
};

/** `row-at=位置=色,…` を位置で色を付ける行にする */
const readRowAtKey = (conv: TableConversion, entry: TableEntry): void => {
  for (const pair of entry.value.split(",")) {
    const [position = "", color = ""] = pair.split("=");
    const at = rowAtOf(position);
    if (at === undefined || !isColorName(color)) {
      conv.dropped.push({
        text: `row-at=${pair}`,
        reason: "行の位置か色の名前を読み込めません",
      });
      continue;
    }
    conv.atColors.push({ at, color });
  }
};

/** `header-rows=`・`row-header=` を見出しの行と列の数にする */
const readHeaderKey = (conv: TableConversion, entry: TableEntry): void => {
  const { key, value } = entry;
  const rows = key === "header-rows";
  const count = Number(value);
  if (!/^\d+$/.test(value) || count < (rows ? 1 : 0)) {
    conv.dropped.push({
      text: `${key}=${value}`,
      reason: "数として読み込めません",
    });
    return;
  }
  conv.header[rows ? "rows" : "columns"] = count;
};

/** `tree=`・`type=`・`required=`・`default=` を階層の列にする */
const readTreeKey = (conv: TableConversion, entry: TableEntry): void => {
  conv.tree[entry.key === "tree" ? "key" : entry.key] = { column: entry.value };
};

/** 表のマーカーのキーごとの読み方 */
const TABLE_KEY_READERS: Readonly<
  Record<string, (conv: TableConversion, entry: TableEntry) => void>
> = {
  filter: readFilterKey,
  hide: (conv, entry) => {
    if (!needsFeature(conv, { ...entry, feature: "columns" })) return;
    setColumns(conv, { value: entry.value, key: "hidden", setting: true });
  },
  total: readTotalKey,
  pin: (conv, entry) => {
    if (!needsFeature(conv, { ...entry, feature: "pin" })) return;
    setColumns(conv, { value: entry.value, key: "pinned", setting: true });
  },
  wide: (conv, entry) =>
    setColumns(conv, {
      value: entry.value,
      key: "width",
      setting: { mode: "nowrap" },
    }),
  check: (conv, entry) =>
    setColumns(conv, {
      value: entry.value,
      key: "format",
      setting: { type: "check" },
    }),
  highlight: readHighlightKey,
  "row-color": readRowColorKey,
  "row-at": readRowAtKey,
  "header-rows": readHeaderKey,
  "row-header": readHeaderKey,
  tree: readTreeKey,
  type: readTreeKey,
  required: readTreeKey,
  default: readTreeKey,
  example: (conv, entry) => {
    conv.tree.example = { heading: entry.value };
  },
  title: () => {},
};

/** `tree=` の無い表の階層の列のキーを書き出さない */
const dropOrphanTree = (conv: TableConversion): void => {
  if (Object.keys(conv.tree).length === 0 || conv.tree.key !== undefined) {
    return;
  }
  for (const key of Object.keys(conv.tree)) {
    conv.dropped.push({
      text: `${key === "key" ? "tree" : key}=`,
      reason:
        "tree= と一緒に記載した表でだけ使用できるため、今の実装は適用していません",
    });
    delete conv.tree[key];
  }
};

/** 列の設定に移した機能は features に記載しない */
const dropColumnFeatures = (
  features: Record<string, MarkOptions>,
  columns: Record<string, MarkOptions>,
): void => {
  const fromColumns = new Set<string>();
  for (const settings of Object.values(columns)) {
    if (settings.filter !== undefined) fromColumns.add("filter");
    if (settings.hidden !== undefined) fromColumns.add("columns");
    if (settings.pinned !== undefined) fromColumns.add("pin");
    if (settings.total !== undefined) fromColumns.add("total");
  }
  for (const name of fromColumns) {
    if (features[name] !== undefined && features[name].enabled !== false) {
      delete features[name];
    }
  }
};

/** 集めた値の空でないものを、設計書の順に `options` に入れる */
const assembleTable = (
  options: MarkOptions,
  context: { conv: TableConversion; features: Record<string, MarkOptions> },
): void => {
  const { conv, features } = context;
  if (Object.keys(features).length > 0) options.features = features;
  if (Object.keys(conv.columns).length > 0) options.columns = conv.columns;
  if (Object.keys(conv.header).length > 0) options.header = conv.header;
  if (conv.colors.length + conv.atColors.length > 0)
    options.rows = { colors: [...conv.colors, ...conv.atColors] };
  if (Object.keys(conv.tree).length > 0) options.tree = conv.tree;
};

/** 表のマーカーの今の書き方を変換する */
const convertTable = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const dropped: DroppedLegacyArg[] = [];
  const tail = keys.title === undefined ? undefined : titleTailOf(text);
  const { kind, flags, features } = readTableArgs(args, { tail, dropped });
  const options: MarkOptions = kind === "default" ? {} : { kind };
  const conv: TableConversion = {
    dropped,
    enabled: enabledOf(kind, features),
    columns: {},
    header: {},
    colors: [],
    atColors: [],
    tree: {},
  };
  for (const [key, value] of Object.entries(keys)) {
    if (Object.hasOwn(TABLE_KEY_READERS, key)) {
      TABLE_KEY_READERS[key]?.(conv, { key, value });
    } else {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  dropOrphanTree(conv);
  dropColumnFeatures(features, conv.columns);
  assembleTable(options, { conv, features });
  const converted = { options, dropped };
  collapseInto(converted, { flags, title: keys.title, scope: "表" });
  return converted;
};

/** タブ・ステップのマーカーの今の書き方を変換する */
const convertCollapseRange = (text: string, withGroup: boolean): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const dropped: DroppedLegacyArg[] = [];
  const options: MarkOptions = {};
  const flags = args.filter((arg) => arg === "closed" || arg === "open");
  const tail = keys.title === undefined ? undefined : titleTailOf(text);
  for (const arg of args.filter((arg) => arg !== "closed" && arg !== "open")) {
    dropped.push(droppedArg(arg, tail));
  }
  for (const [key, value] of Object.entries(keys)) {
    if (withGroup && key === "group") {
      readGroupKey({ options, dropped }, value);
    } else if (key !== "title") {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  const converted = { options, dropped };
  collapseInto(converted, { flags, title: keys.title, scope: "範囲" });
  return converted;
};

/** `group=` をタブの組の名前にする（名前が無ければ書き出さない） */
const readGroupKey = (converted: Converted, value: string): void => {
  if (value === "") {
    converted.dropped.push({ text: "group=", reason: "組の名前がありません" });
  } else {
    converted.options.group = value;
  }
};

/** コードブロックの飾りのマーカーの単語（`lines`・`wrap`）を読む */
const readCodeArg = (
  converted: Converted,
  context: { arg: string; tail: string | undefined },
): void => {
  const { arg, tail } = context;
  if (arg === "lines") converted.options.lines = {};
  else if (arg === "wrap") converted.options.wrap = true;
  else converted.dropped.push(droppedArg(arg, tail));
};

/** コードブロックの飾りのマーカーのキー（`highlight=`・`fold=`）を読む */
const readCodeKey = (converted: Converted, entry: TableEntry): void => {
  const { key, value } = entry;
  if (key === "highlight" || key === "fold") {
    const ranges = rangesOf(key, value, converted.dropped);
    if (ranges.length > 0) converted.options[key] = ranges;
  } else if (key === "wrap") {
    converted.dropped.push({
      text: `wrap=${value}`,
      reason: "wrap は値を持ちません",
    });
  } else if (key !== "title") {
    converted.dropped.push(unknownWord(`${key}=`));
  }
};

/** コードブロックの飾りのマーカーの今の書き方を変換する */
const convertCode = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const converted: Converted = { options: {}, dropped: [] };
  const tail = keys.title === undefined ? undefined : titleTailOf(text);
  if (keys.title === "") {
    converted.dropped.push({ text: "title=", reason: "タイトルがありません" });
  } else if (keys.title !== undefined) {
    converted.options.title = keys.title;
  }
  for (const arg of args) readCodeArg(converted, { arg, tail });
  for (const [key, value] of Object.entries(keys))
    readCodeKey(converted, { key, value });
  // JSON のキーの並びは設計書の順にそろえる
  const ordered: MarkOptions = {};
  for (const key of ["title", "lines", "highlight", "fold", "wrap"]) {
    if (converted.options[key] !== undefined)
      ordered[key] = converted.options[key];
  }
  return { options: ordered, dropped: converted.dropped };
};

/** ファイルツリーのマーカーのキー（`open=`）を読む */
const readTreeOpenKey = (converted: Converted, entry: TableEntry): void => {
  const { key, value } = entry;
  if (key === "open" && (value === "all" || /^[1-9]\d*$/.test(value))) {
    converted.options.depth = value === "all" ? "all" : Number(value);
  } else if (key === "open") {
    converted.dropped.push({
      text: `open=${value}`,
      reason: "記載できる値は all と階層の数です",
    });
  } else if (key === "wrap") {
    converted.dropped.push({
      text: `wrap=${value}`,
      reason: "wrap は値を持ちません",
    });
  } else {
    converted.dropped.push(unknownWord(`${key}=`));
  }
};

/** ファイルツリーのマーカーの今の書き方を変換する */
const convertTree = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const converted: Converted = { options: {}, dropped: [] };
  for (const [key, value] of Object.entries(keys))
    readTreeOpenKey(converted, { key, value });
  for (const arg of args) {
    if (arg === "wrap") converted.options.wrap = true;
    else converted.dropped.push(unknownWord(arg));
  }
  return converted;
};

/** ビューのマーカーを変換するときに集める値 */
type ViewConversion = Converted & {
  board: MarkOptions;
  columns: Record<string, MarkOptions>;
};

/** `filter=名前:種類` を表形式の列の絞り込みにする */
const readViewFilterKey = (conv: ViewConversion, value: string): void => {
  for (const item of value.split(",")) {
    const [name = "", type] = item.split(":");
    if (
      type !== undefined &&
      !(FILTER_KINDS as readonly string[]).includes(type)
    ) {
      conv.dropped.push({
        text: `filter=${item}`,
        reason: `絞り込みの種類 ${type} は使用できません`,
      });
      continue;
    }
    conv.columns[name] = { filter: type === undefined ? {} : { type } };
  }
};

/** ビューのマーカーのキーごとの読み方 */
const VIEW_KEY_READERS: Readonly<
  Record<string, (conv: ViewConversion, value: string) => void>
> = {
  group: (conv, value) => {
    conv.board.group = { column: value };
  },
  default: (conv, value) => {
    if (value === "board" || value === "table") conv.options.initial = value;
    else
      conv.dropped.push({
        text: `default=${value}`,
        reason: "記載できる値は board と table です",
      });
  },
  filter: readViewFilterKey,
  icons: (conv, value) => {
    const values: Record<string, MarkOptions> = {};
    for (const item of value.split(",")) {
      const [cell = "", icon = ""] = item.split(":");
      values[cell] = { icon };
    }
    conv.board.values = values;
  },
};

/** ビューのマーカーの今の書き方を変換する */
const convertView = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const conv: ViewConversion = {
    options: {},
    dropped: args.map(unknownWord),
    board: {},
    columns: {},
  };
  for (const [key, value] of Object.entries(keys)) {
    if (Object.hasOwn(VIEW_KEY_READERS, key)) {
      VIEW_KEY_READERS[key]?.(conv, value);
    } else {
      conv.dropped.push(unknownWord(`${key}=`));
    }
  }
  const { board, columns, options } = conv;
  const ordered: MarkOptions = {};
  if (Object.keys(board).length > 0) {
    ordered.board = {
      ...(board.group === undefined ? {} : { group: board.group }),
      ...(board.values === undefined ? {} : { values: board.values }),
    };
  }
  if (options.initial !== undefined) ordered.initial = options.initial;
  if (Object.keys(columns).length > 0) ordered.columns = columns;
  return { options: ordered, dropped: conv.dropped };
};

/** 取り込みのマーカーの今の書き方（`パス#見出しの ID`・`パス#L開始-L終了`）を変換する */
const convertInclude = (text: string): Converted => {
  const [target = "", ...extra] = text.split(/\s+/).filter(Boolean);
  const dropped = extra.map(unknownWord);
  const [path = "", anchor] = target.split("#");
  const options: MarkOptions = { path };
  if (anchor !== undefined && anchor !== "") {
    const lines = /^L(\d+)-L(\d+)$/.exec(anchor);
    if (lines && !/\.md$/i.test(path)) {
      options.lines = { from: Number(lines[1]), to: Number(lines[2]) };
    } else {
      options.heading = anchor;
    }
  }
  return { options, dropped };
};

/** マーカーの名前ごとの対応で、今の書き方の引数の文字を JSON のオブジェクトにし、書き出さない記載を分ける */
export const convertLegacyArgs = (options: {
  name: string;
  text: string;
}): Converted => {
  const converted = convertByName(options);
  // 書き出さない記載は、記載した順に並べる
  const at = (item: DroppedLegacyArg): number => {
    const index = options.text.indexOf(item.text.replace(/=$/, "="));
    return index < 0 ? options.text.length : index;
  };
  return {
    options: converted.options,
    dropped: [...converted.dropped].sort((x, y) => at(x) - at(y)),
  };
};

/** 節のマーカーの今の書き方（`closed`・`open`）を変換する */
const convertSection = (text: string): Converted => {
  const [first] = parseMarkArgs(text).args;
  if (first === "closed" || first === "open") {
    return { options: { open: first === "open" }, dropped: [] };
  }
  return {
    options: {},
    dropped: first === undefined ? [] : [unknownWord(first)],
  };
};

/** 幅を広げるマーカーの今の書き方（`closed`）を変換する */
const convertWide = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  return {
    options: args.includes("closed") ? { open: false } : {},
    dropped: [
      ...args.filter((arg) => arg !== "closed").map(unknownWord),
      ...Object.keys(keys).map((key) => unknownWord(`${key}=`)),
    ],
  };
};

/** 開閉のマーカーの今の書き方（見出しの文字と末尾の `open`）を変換する */
const convertDetails = (text: string): Converted => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const open = words.at(-1) === "open";
  const title = (open ? words.slice(0, -1) : words).join(" ");
  return {
    options: {
      ...(title === "" ? {} : { title }),
      ...(open ? { open: true } : {}),
    },
    dropped: [],
  };
};

/** 図の番号のマーカーの今の書き方（図の ID）を変換する */
const convertFig = (text: string): Converted => {
  const { args } = parseMarkArgs(text);
  return {
    options: args[0] === undefined ? {} : { id: args[0] },
    dropped: args.slice(1).map(unknownWord),
  };
};

/** 行の詳細のマーカーの今の書き方（行の位置）を変換する */
const convertRowDetail = (text: string): Converted => {
  const { args } = parseMarkArgs(text);
  const at = Number(args[0]);
  if (Number.isInteger(at) && at >= 1) {
    return { options: { at }, dropped: [] };
  }
  return {
    options: {},
    dropped: [
      { text: args[0] ?? "", reason: "行の位置を数として読み込めません" },
    ],
  };
};

/** ギャラリーのマーカーの今の書き方（`cols=`）を変換する */
const convertGallery = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const dropped: DroppedLegacyArg[] = args.map(unknownWord);
  const options: MarkOptions = {};
  for (const [key, value] of Object.entries(keys)) {
    const count = Number(value);
    if (key !== "cols") {
      dropped.push(unknownWord(`${key}=`));
    } else if (Number.isInteger(count) && count >= 1 && count <= 6) {
      options.columns = count;
    } else {
      dropped.push({
        text: `cols=${value}`,
        reason: "列の数は 1〜6 の整数です",
      });
    }
  }
  return { options, dropped };
};

/** 機能のマーカーの今の書き方（`+名前`・`-名前`）を変換する */
const convertFeatures = (text: string): Converted => {
  const options: MarkOptions = {};
  const dropped: DroppedLegacyArg[] = [];
  for (const arg of parseMarkArgs(text).args) {
    if (/^[+-][a-z]/.test(arg)) options[arg.slice(1)] = arg.startsWith("+");
    else dropped.push(unknownWord(arg));
  }
  return { options, dropped };
};

/** ページのマーカーの今の書き方（`scheme=`・`theme=`・`toc=`）を変換する */
const convertPage = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const options: MarkOptions = {};
  const dropped: DroppedLegacyArg[] = args.map(unknownWord);
  for (const [key, value] of Object.entries(keys)) {
    const values = PAGE_VALUES[key];
    if (values === undefined) {
      dropped.push(unknownWord(`${key}=`));
    } else if (!values.includes(value)) {
      dropped.push({
        text: `${key}=${value}`,
        reason: `記載できる値は ${values.join("・")} です`,
      });
    } else {
      options[key] = key === "toc" ? { mode: value } : value;
    }
  }
  return { options, dropped };
};

/** 用語集のマーカーの今の書き方（列名のキー）を変換する */
const convertGlossary = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const options: MarkOptions = {};
  const dropped: DroppedLegacyArg[] = args.map(unknownWord);
  for (const [key, value] of Object.entries(keys)) {
    if (["term", "meaning", "aliases", "avoid"].includes(key)) {
      options[key] = { column: value };
    } else {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  return { options, dropped };
};

/** マーカーの名前ごとの変換 */
const CONVERTERS: Readonly<Record<string, (text: string) => Converted>> = {
  table: convertTable,
  tabs: (text) => convertCollapseRange(text, true),
  steps: (text) => convertCollapseRange(text, false),
  code: convertCode,
  tree: convertTree,
  view: convertView,
  include: convertInclude,
  section: convertSection,
  wide: convertWide,
  details: convertDetails,
  fig: convertFig,
  "row-detail": convertRowDetail,
  gallery: convertGallery,
  [FEATURES_MARK]: convertFeatures,
  [PAGE_MARK]: convertPage,
  glossary: convertGlossary,
};

/** マーカーの名前ごとに変換する */
const convertByName = (options: { name: string; text: string }): Converted => {
  const { name, text } = options;
  const convert = Object.hasOwn(CONVERTERS, name)
    ? CONVERTERS[name]
    : undefined;
  return convert ? convert(text) : { options: {}, dropped: [] };
};

/** JSON の値を、`, `・`: ` で区切った 1 行の文字にする */
const dumpJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(dumpJson).join(", ")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${dumpJson(item)}`)
      .join(", ")}}`;
  }
  return JSON.stringify(value);
};

/** 移行で書き換える記法のマーカーか */
const isConvertible = (name: string): boolean =>
  name === FEATURES_MARK ||
  name === PAGE_MARK ||
  (Object.hasOwn(SYNTAX_MARKS, name) && !UNCONVERTED_SYNTAX.has(name));

/** 行の中の行内のコードの範囲（`` ` `` で囲んだ範囲）の並び */
const codeSpansOf = (line: string): Array<[number, number]> => {
  const spans: Array<[number, number]> = [];
  const pattern = /(`+)[\s\S]*?\1/g;
  for (const match of line.matchAll(pattern)) {
    spans.push([match.index ?? 0, (match.index ?? 0) + match[0].length]);
  }
  return spans;
};

/** 今の書き方のマーカー 1 つを JSON のオブジェクトに書き換える。閉じのマーカー・引数の無い・JSON の・行内のコードの中のマーカーは書き換えない */
const rewriteMark = (
  raw: string,
  context: {
    /** 正規表現の各部分（閉じの `/`・名前・引数）と、マッチの位置 */
    groups: unknown[];
    spans: Array<[number, number]>;
    line: number;
    report: LegacyReportLine[];
  },
): string => {
  const { spans, line, report } = context;
  const [closing, name, rest, offset] = context.groups as [
    string | undefined,
    string,
    string | undefined,
    number,
  ];
  const text = (rest ?? "").trim();
  if (
    closing === "/" ||
    text === "" ||
    text.startsWith("{") ||
    spans.some(([start, end]) => offset >= start && offset < end)
  ) {
    return raw;
  }
  if (!isConvertible(name)) {
    report.push({
      line,
      name,
      text,
      reason:
        "拡張と libraries のマーカーは、引数をキーへ移す対応を持たないため書き換えていません。引数を JSON のオブジェクトで記載し直してください",
    });
    return raw;
  }
  const converted = convertLegacyArgs({ name, text });
  for (const item of converted.dropped) {
    report.push({ line, name, text: item.text, reason: item.reason });
  }
  return Object.keys(converted.options).length === 0
    ? `<!-- ${name} -->`
    : `<!-- ${name}: ${dumpJson(converted.options)} -->`;
};

/** 文書の今の書き方のマーカーを JSON のオブジェクトに書き換え、書き出さない記載と書き換えないマーカーを報告の行にする */
export const rewriteLegacyMarks = (options: {
  markdown: string;
}): { markdown: string; report: LegacyReportLine[] } => {
  const report: LegacyReportLine[] = [];
  const lines = options.markdown.split("\n");
  let fence: string | undefined;
  const out = lines.map((line, index) => {
    const opener = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence !== undefined) {
      if (
        opener !== undefined &&
        opener[0] === fence[0] &&
        opener.length >= fence.length &&
        line.trim() === opener
      ) {
        fence = undefined;
      }
      return line;
    }
    if (opener !== undefined) {
      fence = opener;
      return line;
    }
    const spans = codeSpansOf(line);
    return line.replace(
      new RegExp(MARK_PATTERN.source, "g"),
      (raw: string, ...groups: unknown[]) =>
        rewriteMark(raw, {
          groups,
          spans,
          line: index + 1,
          report,
        }),
    );
  });
  return { markdown: out.join("\n"), report };
};
