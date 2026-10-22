import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { escapeHtml } from "../../parts/escape.ts";
import {
  isViewIconName,
  VIEW_ICON_NAMES,
  type ViewIconName,
  type ViewSpec,
} from "../../views/spec.ts";
import type { Mark } from "../marks.ts";
import {
  codes,
  headersOf,
  readFilters,
  type TableSpec,
  warningsOf,
} from "./tables.ts";
import { envOf, featureOn, findClose, markOf, ownBlock } from "./tokens.ts";
import {
  pushWarning,
  type SyntaxWarning,
  unclosedWarning,
} from "./warnings.ts";

/** ビューの印に書けるキー */
const VIEW_KEYS = ["group", "default", "filter", "icons"];

/** `default=` に書ける値 */
const VIEW_MODES = ["board", "table"];

/** ビューの印を読んだ結果 */
type ViewReading = {
  /** 表の部品の指定 */
  tableSpec: TableSpec;
  /** `data-view` に書く指定 */
  viewSpec: ViewSpec;
  /** 読めなかった指定の警告（範囲の前に差し込む） */
  warnings: SyntaxWarning[];
};

/** `icons=` の値を `値:アイコンの名前` の組に分け、使えるアイコンだけを対応にする。使えない名前は警告にする */
function readIcons(
  value: string,
  warnings: WarningItem[],
): Record<string, ViewIconName> {
  const icons: Record<string, ViewIconName> = {};
  for (const pair of value.split(",").map((part) => part.trim())) {
    const colon = pair.lastIndexOf(":");
    if (pair === "" || colon <= 0) {
      if (pair !== "") {
        warnings.push({
          label: pair,
          message: `の \`icons=\` の \`${pair}\` は読めません。\`値:アイコンの名前\` で書いてください。`,
        });
      }
      continue;
    }
    const target = pair.slice(0, colon);
    const name = pair.slice(colon + 1);
    if (isViewIconName(name)) {
      icons[target] = name;
    } else {
      warnings.push({
        label: name,
        message: `のアイコン \`${name}\` は使えません。使えるアイコンは ${codes(VIEW_ICON_NAMES)} です。\`${target}\` の列には既定のアイコンを付けています。`,
      });
    }
  }
  return icons;
}

/** ビューの印の引数と表の見出しから、表の指定・`data-view` の指定・警告を作る */
function readView(options: {
  state: StateCore;
  mark: Mark;
  headers: string[];
}): ViewReading {
  const { state, mark, headers } = options;
  const env = envOf(state);
  const sentences: WarningItem[] = [];
  const warnings: SyntaxWarning[] = [];
  let group: number | null = null;
  let boardDisabled = "";
  const { keys } = mark.args;
  const groupName = keys.group;
  if (groupName !== undefined) {
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
  const items: WarningItem[] = [];
  for (const key of Object.keys(keys)) {
    if (!VIEW_KEYS.includes(key)) {
      items.push({
        label: `${key}=`,
        message: `使えないキーです。使えるキーは ${codes(VIEW_KEYS.map((name) => `${name}=`))} です`,
      });
    }
  }
  const requested = keys.default;
  if (requested !== undefined && !VIEW_MODES.includes(requested)) {
    items.push({
      label: "default=",
      message: `使えない値です。使える値は ${codes(VIEW_MODES)} です`,
    });
  }
  const filters = readFilters(keys.filter ?? "", headers, sentences);
  const icons = readIcons(keys.icons ?? "", sentences);
  const mode =
    group !== null && (requested === undefined || requested !== "table")
      ? "board"
      : "table";
  warnings.push(...warningsOf(mark.raw, [...sentences, ...items]));
  return {
    tableSpec: {
      kind: "data",
      features: filters.length > 0 ? ["sort", "filter"] : ["sort"],
      filters,
      collapse: "none",
      warnings: [],
    },
    viewSpec: { group, mode, boardDisabled, icons },
    warnings,
  };
}

/** 範囲の中の最初の表の位置を返す。無ければ `-1` */
function firstTable(tokens: Token[], from: number, to: number): number {
  for (let index = from; index < to; index++) {
    if (tokens[index]?.type === "table_open") {
      return index;
    }
  }
  return -1;
}

/** `views` がオンのとき、`<!-- view: 引数 -->` の範囲を `div.mdmark-view` の囲みにし、範囲の最初の表に表の部品の指定を当て、書き方の誤りを警告にする */
export function buildViews(state: StateCore): void {
  if (!featureOn(state, "views")) {
    return;
  }
  const tokens = state.tokens;
  // 差し込みで位置がずれないよう、後ろの印から処理する
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
          "の範囲に、項目にする表がありません。範囲の中に Markdown の表を書いてください。範囲の中身はそのまま描いています。",
      });
    } else {
      const reading = readView({
        state,
        mark,
        headers: headersOf(tokens, table),
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
    // 警告は、範囲の前（印の位置）に差し込む。閉じの印が無い警告は、読めない指定の警告の後に並べる
    for (const [offset, warning] of warnings.entries()) {
      pushWarning(state, open + offset, warning);
    }
  }
}
