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

/** 表のマーカーの今の書き方を変換する */
const convertTable = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const dropped: DroppedLegacyArg[] = [];
  const options: MarkOptions = {};
  const flags: string[] = [];
  let kind = "default";
  const features: Record<string, MarkOptions> = {};
  const tail = keys.title === undefined ? undefined : titleTailOf(text);
  args.forEach((arg, index) => {
    if (index === 0 && (arg === "data" || arg === "plain")) {
      kind = arg;
      options.kind = arg;
    } else if (arg === "closed" || arg === "open") {
      flags.push(arg);
    } else if (
      /^[+-]/.test(arg) &&
      (TABLE_FEATURES as readonly string[]).includes(arg.slice(1))
    ) {
      features[arg.slice(1)] = arg.startsWith("+") ? {} : { enabled: false };
    } else if (arg === tail) {
      dropped.push({
        text: arg,
        reason: TITLE_SPACE_REASON,
      });
    } else {
      dropped.push(unknownWord(arg));
    }
  });
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
  const columns: Record<string, MarkOptions> = {};
  const column = (name: string): MarkOptions => {
    columns[name] ??= {};
    return columns[name] as MarkOptions;
  };
  /** 機能の無い表に記載したキーを書き出さない */
  const needs = (key: string, value: string, feature: string): boolean => {
    if (enabled.has(feature)) {
      return true;
    }
    dropped.push({
      text: `${key}=${value}`,
      reason: `+${feature} を記載した表でだけ使用できるため、今の実装は適用していません`,
    });
    return false;
  };
  const header: MarkOptions = {};
  const colors: MarkOptions[] = [];
  const atColors: MarkOptions[] = [];
  const tree: MarkOptions = {};
  for (const [key, value] of Object.entries(keys)) {
    switch (key) {
      case "filter":
        if (!needs(key, value, "filter")) break;
        for (const item of value.split(",")) {
          const [name = "", type] = item.split(":");
          if (
            type !== undefined &&
            !(FILTER_KINDS as readonly string[]).includes(type)
          ) {
            dropped.push({
              text: `filter=${item}`,
              reason: `絞り込みの種類 ${type} は使用できません。使用できる種類は select・text・date です`,
            });
            continue;
          }
          column(name).filter = type === undefined ? {} : { type };
        }
        break;
      case "hide":
        if (!needs(key, value, "columns")) break;
        for (const name of value.split(",")) column(name).hidden = true;
        break;
      case "total":
        if (!needs(key, value, "total")) break;
        for (const item of value.split(",")) {
          const [name = "", calc = ""] = item.split(":");
          if (!(TOTAL_CALCS as readonly string[]).includes(calc)) {
            dropped.push({
              text: `total=${item}`,
              reason: `計算 ${calc} は使用できません。使用できる計算は sum・avg・count です`,
            });
            continue;
          }
          const settings = column(name);
          settings.total = [
            ...((settings.total as MarkOptions[]) ?? []),
            { calc },
          ];
        }
        break;
      case "pin":
        if (!needs(key, value, "pin")) break;
        for (const name of value.split(",")) column(name).pinned = true;
        break;
      case "wide":
        for (const name of value.split(","))
          column(name).width = { mode: "nowrap" };
        break;
      case "check":
        for (const name of value.split(","))
          column(name).format = { type: "check" };
        break;
      case "highlight":
        for (const item of value.split(",")) {
          const [name = "", color] = item.split(":");
          if (
            color !== undefined &&
            !(COLOR_NAMES as readonly string[]).includes(color)
          ) {
            dropped.push({
              text: `highlight=${item}`,
              reason: `色の名前 ${color} は使用できません`,
            });
            continue;
          }
          column(name).highlight = color === undefined ? {} : { color };
        }
        break;
      case "row-color": {
        const [name = "", pairs = ""] = value.split(/:(.*)/s);
        for (const pair of pairs.split(",")) {
          const [cell = "", color = ""] = pair.split("=");
          if (!(COLOR_NAMES as readonly string[]).includes(color)) {
            dropped.push({
              text: `row-color=${name}:${pair}`,
              reason: `色の名前 ${color} は使用できません`,
            });
            continue;
          }
          colors.push({ column: name, value: cell, color });
        }
        break;
      }
      case "row-at":
        for (const pair of value.split(",")) {
          const [position = "", color = ""] = pair.split("=");
          const range = /^(\d+)-(\d+)$/.exec(position);
          const at = range
            ? { from: Number(range[1]), to: Number(range[2]) }
            : /^\d+$/.test(position)
              ? Number(position)
              : undefined;
          if (
            at === undefined ||
            !(COLOR_NAMES as readonly string[]).includes(color)
          ) {
            dropped.push({
              text: `row-at=${pair}`,
              reason: "行の位置か色の名前を読み込めません",
            });
            continue;
          }
          atColors.push({ at, color });
        }
        break;
      case "header-rows":
      case "row-header": {
        const count = Number(value);
        if (!/^\d+$/.test(value) || count < (key === "header-rows" ? 1 : 0)) {
          dropped.push({
            text: `${key}=${value}`,
            reason: "数として読み込めません",
          });
          break;
        }
        header[key === "header-rows" ? "rows" : "columns"] = count;
        break;
      }
      case "tree":
      case "type":
      case "required":
      case "default":
        tree[key === "tree" ? "key" : key] = { column: value };
        break;
      case "example":
        tree.example = { heading: value };
        break;
      case "title":
        break;
      default:
        dropped.push(unknownWord(`${key}=`));
    }
  }
  if (Object.keys(tree).length > 0 && tree.key === undefined) {
    for (const key of Object.keys(tree)) {
      dropped.push({
        text: `${key === "key" ? "tree" : key}=`,
        reason:
          "tree= と一緒に記載した表でだけ使用できるため、今の実装は適用していません",
      });
      delete tree[key];
    }
  }
  // 列の設定に移した機能は features に記載しない
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
  if (Object.keys(features).length > 0) options.features = features;
  if (Object.keys(columns).length > 0) options.columns = columns;
  if (Object.keys(header).length > 0) options.header = header;
  if (colors.length + atColors.length > 0)
    options.rows = { colors: [...colors, ...atColors] };
  if (Object.keys(tree).length > 0) options.tree = tree;
  const collapse = collapseOf(flags, keys.title);
  if (collapse) {
    options.collapse = collapse;
  } else if (keys.title !== undefined) {
    dropped.push({
      text: `title=${keys.title}`,
      reason:
        "closed か open と一緒に記載した表でだけ使用できるため、今の実装は適用していません",
    });
  }
  return { options, dropped };
};

/** タブ・ステップのマーカーの今の書き方を変換する */
const convertCollapseRange = (text: string, withGroup: boolean): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const dropped: DroppedLegacyArg[] = [];
  const options: MarkOptions = {};
  const flags = args.filter((arg) => arg === "closed" || arg === "open");
  const tail = keys.title === undefined ? undefined : titleTailOf(text);
  for (const arg of args.filter((arg) => arg !== "closed" && arg !== "open")) {
    dropped.push(
      arg === tail
        ? {
            text: arg,
            reason: TITLE_SPACE_REASON,
          }
        : unknownWord(arg),
    );
  }
  for (const [key, value] of Object.entries(keys)) {
    if (withGroup && key === "group") {
      if (value === "") {
        dropped.push({ text: "group=", reason: "組の名前がありません" });
      } else {
        options.group = value;
      }
    } else if (key !== "title") {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  const collapse = collapseOf(flags, keys.title);
  if (collapse) {
    options.collapse = collapse;
  } else if (keys.title !== undefined) {
    dropped.push({
      text: `title=${keys.title}`,
      reason:
        "closed か open と一緒に記載した範囲でだけ使用できるため、今の実装は適用していません",
    });
  }
  return { options, dropped };
};

/** コードブロックの飾りのマーカーの今の書き方を変換する */
const convertCode = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const dropped: DroppedLegacyArg[] = [];
  const options: MarkOptions = {};
  const tail = keys.title === undefined ? undefined : titleTailOf(text);
  if (keys.title !== undefined) {
    if (keys.title === "") {
      dropped.push({ text: "title=", reason: "タイトルがありません" });
    } else {
      options.title = keys.title;
    }
  }
  for (const arg of args) {
    if (arg === "lines") options.lines = {};
    else if (arg === "wrap") options.wrap = true;
    else if (arg === tail)
      dropped.push({
        text: arg,
        reason: TITLE_SPACE_REASON,
      });
    else dropped.push(unknownWord(arg));
  }
  for (const [key, value] of Object.entries(keys)) {
    if (key === "highlight" || key === "fold") {
      const ranges = rangesOf(key, value, dropped);
      if (ranges.length > 0) options[key] = ranges;
    } else if (key === "wrap") {
      dropped.push({ text: `wrap=${value}`, reason: "wrap は値を持ちません" });
    } else if (key !== "title") {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  // JSON のキーの並びは設計書の順にそろえる
  const ordered: MarkOptions = {};
  for (const key of ["title", "lines", "highlight", "fold", "wrap"]) {
    if (options[key] !== undefined) ordered[key] = options[key];
  }
  return { options: ordered, dropped };
};

/** ファイルツリーのマーカーの今の書き方を変換する */
const convertTree = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const dropped: DroppedLegacyArg[] = [];
  const options: MarkOptions = {};
  for (const [key, value] of Object.entries(keys)) {
    if (key === "open" && (value === "all" || /^[1-9]\d*$/.test(value))) {
      options.depth = value === "all" ? "all" : Number(value);
    } else if (key === "open") {
      dropped.push({
        text: `open=${value}`,
        reason: "記載できる値は all と階層の数です",
      });
    } else if (key === "wrap") {
      dropped.push({ text: `wrap=${value}`, reason: "wrap は値を持ちません" });
    } else {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  for (const arg of args) {
    if (arg === "wrap") options.wrap = true;
    else dropped.push(unknownWord(arg));
  }
  return { options, dropped };
};

/** ビューのマーカーの今の書き方を変換する */
const convertView = (text: string): Converted => {
  const { args, keys } = parseMarkArgs(text);
  const dropped: DroppedLegacyArg[] = args.map(unknownWord);
  const options: MarkOptions = {};
  const board: MarkOptions = {};
  const columns: Record<string, MarkOptions> = {};
  for (const [key, value] of Object.entries(keys)) {
    if (key === "group") {
      board.group = { column: value };
    } else if (key === "default") {
      if (value === "board" || value === "table") options.initial = value;
      else
        dropped.push({
          text: `default=${value}`,
          reason: "記載できる値は board と table です",
        });
    } else if (key === "filter") {
      for (const item of value.split(",")) {
        const [name = "", type] = item.split(":");
        if (
          type !== undefined &&
          !(FILTER_KINDS as readonly string[]).includes(type)
        ) {
          dropped.push({
            text: `filter=${item}`,
            reason: `絞り込みの種類 ${type} は使用できません`,
          });
          continue;
        }
        columns[name] = { filter: type === undefined ? {} : { type } };
      }
    } else if (key === "icons") {
      const values: Record<string, MarkOptions> = {};
      for (const item of value.split(",")) {
        const [cell = "", icon = ""] = item.split(":");
        values[cell] = { icon };
      }
      board.values = values;
    } else {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  const ordered: MarkOptions = {};
  if (Object.keys(board).length > 0) {
    ordered.board = {
      ...(board.group === undefined ? {} : { group: board.group }),
      ...(board.values === undefined ? {} : { values: board.values }),
    };
  }
  if (options.initial !== undefined) ordered.initial = options.initial;
  if (Object.keys(columns).length > 0) ordered.columns = columns;
  return { options: ordered, dropped };
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

/** マーカーの名前ごとに変換する */
const convertByName = (options: { name: string; text: string }): Converted => {
  const { name, text } = options;
  const { args, keys } = parseMarkArgs(text);
  switch (name) {
    case "table":
      return convertTable(text);
    case "tabs":
      return convertCollapseRange(text, true);
    case "steps":
      return convertCollapseRange(text, false);
    case "code":
      return convertCode(text);
    case "tree":
      return convertTree(text);
    case "view":
      return convertView(text);
    case "include":
      return convertInclude(text);
    case "section": {
      const [first] = args;
      return first === "closed" || first === "open"
        ? { options: { open: first === "open" }, dropped: [] }
        : {
            options: {},
            dropped: first === undefined ? [] : [unknownWord(first)],
          };
    }
    case "wide":
      return {
        options: args.includes("closed") ? { open: false } : {},
        dropped: [
          ...args.filter((arg) => arg !== "closed").map(unknownWord),
          ...Object.keys(keys).map((key) => unknownWord(`${key}=`)),
        ],
      };
    case "details": {
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
    }
    case "fig":
      return {
        options: args[0] === undefined ? {} : { id: args[0] },
        dropped: args.slice(1).map(unknownWord),
      };
    case "row-detail": {
      const at = Number(args[0]);
      return Number.isInteger(at) && at >= 1
        ? { options: { at }, dropped: [] }
        : {
            options: {},
            dropped: [
              {
                text: args[0] ?? "",
                reason: "行の位置を数として読み込めません",
              },
            ],
          };
    }
    case "gallery": {
      const dropped: DroppedLegacyArg[] = args.map(unknownWord);
      const options: MarkOptions = {};
      for (const [key, value] of Object.entries(keys)) {
        const count = Number(value);
        if (
          key === "cols" &&
          Number.isInteger(count) &&
          count >= 1 &&
          count <= 6
        ) {
          options.columns = count;
        } else {
          dropped.push(
            key === "cols"
              ? { text: `cols=${value}`, reason: "列の数は 1〜6 の整数です" }
              : unknownWord(`${key}=`),
          );
        }
      }
      return { options, dropped };
    }
    case FEATURES_MARK: {
      const options: MarkOptions = {};
      const dropped: DroppedLegacyArg[] = [];
      for (const arg of args) {
        if (/^[+-][a-z]/.test(arg)) options[arg.slice(1)] = arg.startsWith("+");
        else dropped.push(unknownWord(arg));
      }
      return { options, dropped };
    }
    case PAGE_MARK: {
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
    }
    case "glossary": {
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
    }
    default:
      return { options: {}, dropped: [] };
  }
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
      (
        raw: string,
        closing: string | undefined,
        name: string,
        rest: string | undefined,
        offset: number,
      ) => {
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
            line: index + 1,
            name,
            text,
            reason:
              "拡張と libraries のマーカーは、引数をキーへ移す対応を持たないため書き換えていません。引数を JSON のオブジェクトで記載し直してください",
          });
          return raw;
        }
        const converted = convertLegacyArgs({ name, text });
        for (const item of converted.dropped) {
          report.push({
            line: index + 1,
            name,
            text: item.text,
            reason: item.reason,
          });
        }
        return Object.keys(converted.options).length === 0
          ? `<!-- ${name} -->`
          : `<!-- ${name}: ${dumpJson(converted.options)} -->`;
      },
    );
  });
  return { markdown: out.join("\n"), report };
};
