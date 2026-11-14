import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { escapeHtml } from "../../parts/escape.ts";
import type { TableFilter } from "../../parts/table.ts";
import type { FilterKind } from "../../table-logic.ts";
import type { ViewIconName, ViewSpec } from "../../views/spec.ts";
import type { Mark } from "../marks.ts";
import {
  bodyCellsOf,
  codes,
  headersOf,
  type TableSpec,
  warningsOf,
} from "./tables.ts";
import { envOf, featureOn, findClose, markOf, ownBlock } from "./tokens.ts";
import {
  pushWarning,
  type SyntaxWarning,
  unclosedWarning,
} from "./warnings.ts";

/** 値がオブジェクト（配列を除く）か */
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** ビューのマーカーを読み込んだ結果 */
type ViewReading = {
  /** 表の部品の指定 */
  tableSpec: TableSpec;
  /** `data-view` に記載する指定 */
  viewSpec: ViewSpec;
  /** 表に照らして読み込めなかった設定の警告（範囲の前に差し込む） */
  warnings: SyntaxWarning[];
};

/** ビューのマーカーの設定（マーカーの JSON Schema に通した後のもの）と表の見出しとセルから、表の指定・`data-view` の指定・警告を作る */
function readView(options: {
  state: StateCore;
  mark: Mark;
  headers: string[];
  cells: string[][];
}): ViewReading {
  const { state, mark, headers, cells } = options;
  const env = envOf(state);
  const items: WarningItem[] = [];
  const warnings: SyntaxWarning[] = [];
  const board = isObject(mark.options.board) ? mark.options.board : undefined;
  const groupName = (board?.group as { column?: unknown } | undefined)?.column;
  let group: number | null = null;
  let boardDisabled = "";
  if (typeof groupName === "string") {
    group = headers.indexOf(groupName);
    if (group < 0) {
      group = null;
      env.viewCount = (env.viewCount ?? 0) + 1;
      boardDisabled = `mdmark-view-warning-${env.nonce.slice(0, 8)}-${env.viewCount}`;
      warnings.push({
        mark: mark.raw,
        message: `の列 \`${groupName}\` は表にありません。表の列は ${codes(headers)} です。ボードにせず、表で描いています。`,
        id: boardDisabled,
      });
    }
  }
  const icons: Record<string, ViewIconName> = {};
  const values = isObject(board?.values) ? board.values : {};
  if (group !== null) {
    const column = group;
    const present = [
      ...new Set(cells.map((row) => (row[column] ?? "").trim())),
    ];
    for (const [value, settings] of Object.entries(values)) {
      const icon = isObject(settings) ? settings.icon : undefined;
      if (!present.includes(value)) {
        items.push({
          label: `board.values.${value}`,
          message: `\`${value}\` は \`${String(groupName)}\` の列にありません。列の値は ${codes(present)} です。当てずに描いています。`,
        });
      } else if (typeof icon === "string") {
        icons[value] = icon as ViewIconName;
      }
    }
  }
  const filters: TableFilter[] = [];
  const columns = isObject(mark.options.columns) ? mark.options.columns : {};
  for (const [name, settings] of Object.entries(columns)) {
    const filter = isObject(settings) ? settings.filter : undefined;
    if (!isObject(filter)) {
      continue;
    }
    const column = headers.indexOf(name);
    if (column < 0) {
      items.push({
        label: `columns.${name}`,
        message: `の列 \`${name}\` は表にありません。表の列は ${codes(headers)} です。列名を修正してください。当てずに描いています。`,
      });
      continue;
    }
    filters.push({
      column,
      kind:
        typeof filter.type === "string"
          ? (filter.type as FilterKind)
          : "select",
    });
  }
  const requested = mark.options.initial;
  const mode = group !== null && requested !== "table" ? "board" : "table";
  warnings.push(...warningsOf(mark.raw, items));
  return {
    tableSpec: {
      kind: "data",
      features: filters.length > 0 ? ["sort", "filter"] : ["sort"],
      filters,
      // ビューの表には件数・列の表示の切り替え・集計を付けない
      hide: [],
      totals: [],
      unpinned: [],
      widths: [],
      check: [],
      sorts: [],
      collapse: "none",
      warnings: [],
      headRows: 1,
      rowHeader: 0,
    },
    viewSpec: { group, mode, boardDisabled, icons },
    warnings,
  };
}

/** 範囲の中の最初の表の位置を返却する。無ければ `-1` */
function firstTable(tokens: Token[], from: number, to: number): number {
  for (let index = from; index < to; index++) {
    if (tokens[index]?.type === "table_open") {
      return index;
    }
  }
  return -1;
}

/** `views` がオンのとき、`<!-- view: {…} -->` の範囲を `div.mdmark-view` の囲みにし、範囲の最初の表に表の部品の指定を当て、記載方法の誤りを警告にする */
export function buildViews(state: StateCore): void {
  if (!featureOn(state, "views")) {
    return;
  }
  const tokens = state.tokens;
  // 差し込みで位置がずれないよう、後ろのマーカーから処理する
  for (let open = tokens.length - 1; open >= 0; open--) {
    const mark = markOf(tokens[open]);
    if (mark?.name !== "view" || mark.closing) {
      continue;
    }
    const close = findClose(tokens, open, "view");
    const end = close < 0 ? tokens.length : close;
    const warnings: SyntaxWarning[] = [];
    if (close < 0) {
      warnings.push(unclosedWarning(mark));
    }
    const table = firstTable(tokens, open + 1, end);
    const tableOpen = tokens[table];
    if (tableOpen === undefined) {
      warnings.push({
        mark: mark.raw,
        message:
          "の範囲に、項目にする表がありません。範囲の中に Markdown の表を記載してください。範囲の中身はそのまま描いています。",
      });
    } else {
      const reading = readView({
        state,
        mark,
        headers: headersOf(tokens, table),
        cells: bodyCellsOf(tokens, table),
      });
      warnings.unshift(...reading.warnings);
      tableOpen.meta = {
        ...(tableOpen.meta ?? {}),
        tableSpec: reading.tableSpec,
      };
      const wrapper = `<div class="mdmark-view" data-view="${escapeHtml(JSON.stringify(reading.viewSpec))}">`;
      tokens.splice(end, 0, ownBlock(state, "</div>"));
      tokens.splice(open + 1, 0, ownBlock(state, wrapper));
    }
    // 警告は、範囲の前（マーカーの位置）に差し込む。閉じのマーカーが無い警告は、読み込めない指定の警告の後に並べる
    const source = tokens[open];
    for (const [offset, warning] of warnings.entries()) {
      pushWarning(state, open + offset, warning, source);
    }
  }
}
