import type { StateCore, Token } from "markdown-it";
import type { Mark } from "../render/marks.ts";
import { SLOT_MARKER } from "../shared/own.logic.ts";
import {
  unclosedWarning,
  warningBlock,
} from "../shared/syntax-warning.syntax.ts";
import {
  featureOn,
  findClose,
  markOf,
  ownBlock,
  textOf,
} from "../shared/tokens.syntax.ts";
import { renderRowDetail } from "./row-detail.part.ts";

/** 表の本文の行 1 つ */
type TableRow = {
  /** `tr_close` の位置 */
  close: number;
  /** 先頭のセルの文字 */
  label: string;
};

/** 表の位置と、本文の行 */
type TableInfo = {
  /** 列の数 */
  columns: number;
  /** 本文の行（見出し行を除く） */
  rows: TableRow[];
};

/** 行の範囲の最初のセルの文字 */
function rowLabel(tokens: Token[], rowStart: number, rowEnd: number): string {
  const first = tokens
    .slice(rowStart, rowEnd)
    .find((token) => token.type === "inline");
  return first ? textOf(first) : "";
}

/** `table_open` から `table_close` までを読み込み、列の数と本文の行を集める */
function readTable(
  tokens: Token[],
  openIndex: number,
  closeIndex: number,
): TableInfo {
  let columns = 0;
  const rows: TableRow[] = [];
  let inBody = false;
  let rowStart = -1;
  for (let index = openIndex; index <= closeIndex; index++) {
    const type = tokens[index]?.type;
    if (type === "th_open") {
      columns += 1;
    } else if (type === "tbody_open") {
      inBody = true;
    } else if (inBody && type === "tr_open") {
      rowStart = index;
    } else if (inBody && type === "tr_close") {
      rows.push({ close: index, label: rowLabel(tokens, rowStart, index) });
    }
  }
  return { columns, rows };
}

/** トークンの並びに当てる書き換え */
type RowDetailEdits = {
  /** 取り除く位置（マーカーと、行に移す中身） */
  removed: Set<number>;
  /** 位置の直後に差し込むトークン（行の詳細の行） */
  after: Map<number, Token[]>;
  /** 位置の前に差し込むトークン（警告） */
  before: Map<number, Token[]>;
  /** 文書の中の行の詳細の通し番号 */
  counter: number;
};

/** `table_close` と同じ深さの `table_open` の位置 */
function findTableOpen(tokens: Token[], tableClose: number): number {
  const level = tokens[tableClose]?.level;
  let tableOpen = tableClose;
  while (
    tableOpen > 0 &&
    !(
      tokens[tableOpen]?.type === "table_open" &&
      tokens[tableOpen]?.level === level
    )
  ) {
    tableOpen -= 1;
  }
  return tableOpen;
}

/** 表のマーカーの閉じのマーカーを飛ばした位置（挟んでいても、表の直後として読み込む） */
function skipTableCloses(tokens: Token[], position: number): number {
  let at = position;
  while (markOf(tokens[at])?.name === "table" && markOf(tokens[at])?.closing) {
    at += 1;
  }
  return at;
}

/** 範囲の中身を、行の詳細の行のトークンにする */
function detailTokens(
  state: StateCore,
  range: { position: number; end: number; row: number },
  table: { columns: number; label: string; id: string },
): Token[] {
  const { position, end, row } = range;
  const html = renderRowDetail({
    id: table.id,
    row,
    columns: table.columns,
    label: table.label,
    toggle: false,
    body: SLOT_MARKER,
  }).row;
  const [head = "", tail = ""] = html.split(SLOT_MARKER);
  return [
    ownBlock(state, head, state.tokens[position]),
    ...state.tokens.slice(position + 1, end),
    ownBlock(state, tail),
  ];
}

/** `row-detail` の範囲 1 つを、指した行の直後に移す書き換えにする。表に無い行は警告を差し込み、中身を表の後に残す */
function attachRowDetail(
  state: StateCore,
  edits: RowDetailEdits,
  range: { position: number; mark: Mark; table: TableInfo },
): number {
  const tokens = state.tokens;
  const { position, mark, table } = range;
  const closeIndex = findClose(tokens, position, "row-detail");
  const end = closeIndex < 0 ? tokens.length : closeIndex;
  const row = Number(mark.options.at);
  const target = Number.isInteger(row) ? table.rows[row - 1] : undefined;
  edits.removed.add(position);
  const warnings: Token[] = [];
  if (closeIndex >= 0) {
    edits.removed.add(closeIndex);
  } else {
    warnings.push(warningBlock(state, unclosedWarning(mark), tokens[position]));
  }
  if (target) {
    edits.counter += 1;
    const detail = detailTokens(
      state,
      { position, end, row },
      {
        columns: table.columns,
        label: target.label,
        id: `mdmark-detail-${edits.counter}`,
      },
    );
    for (let index = position + 1; index < end; index++) {
      edits.removed.add(index);
    }
    edits.after.set(target.close, [
      ...(edits.after.get(target.close) ?? []),
      ...detail,
    ]);
  } else {
    warnings.push(
      warningBlock(
        state,
        {
          mark: mark.raw,
          message: `の at の ${String(mark.options.at ?? "")} 行目がありません。表は ${table.rows.length} 行です。行の位置を 1〜${table.rows.length} で記載してください。詳細は表の後の本文として描いています。`,
        },
        tokens[position],
      ),
    );
  }
  if (warnings.length) {
    edits.before.set(position, warnings);
  }
  return end + 1;
}

/** 表の直後に続く `row-detail` の範囲を順に読み込む */
function attachTableDetails(
  state: StateCore,
  edits: RowDetailEdits,
  tableClose: number,
): void {
  const tokens = state.tokens;
  const table = readTable(
    tokens,
    findTableOpen(tokens, tableClose),
    tableClose,
  );
  let position = skipTableCloses(tokens, tableClose + 1);
  let mark = markOf(tokens[position]);
  while (mark?.name === "row-detail" && !mark.closing) {
    position = skipTableCloses(
      tokens,
      attachRowDetail(state, edits, { position, mark, table }),
    );
    mark = markOf(tokens[position]);
  }
}

/** `row-details` がオンなら、表の直後の `row-detail` の範囲の中身を、その行の直後の行の詳細の行に移す。表に無い行は警告を差し込み、中身を表の後に残す */
export function attachRowDetails(state: StateCore): void {
  if (!featureOn(state, "row-details")) {
    return;
  }
  const tokens = state.tokens;
  const edits: RowDetailEdits = {
    removed: new Set(),
    after: new Map(),
    before: new Map(),
    counter: 0,
  };
  tokens.forEach((token, tableClose) => {
    if (token.type === "table_close") {
      attachTableDetails(state, edits, tableClose);
    }
  });
  const out: Token[] = [];
  tokens.forEach((token, index) => {
    out.push(...(edits.before.get(index) ?? []));
    if (!edits.removed.has(index)) {
      out.push(token);
    }
    out.push(...(edits.after.get(index) ?? []));
  });
  state.tokens = out;
}
