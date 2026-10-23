import type { StateCore, Token } from "markdown-it";
import { SLOT_MARKER } from "../../parts/own.ts";
import { renderRowDetail } from "../../parts/row-detail.ts";
import { featureOn, findClose, markOf, ownBlock, textOf } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

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

/** `table_open` から `table_close` までを読み、列の数と本文の行を集める */
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
    const token = tokens[index];
    if (token?.type === "th_open") {
      columns += 1;
    } else if (token?.type === "tbody_open") {
      inBody = true;
    } else if (inBody && token?.type === "tr_open") {
      rowStart = index;
    } else if (inBody && token?.type === "tr_close") {
      const first = tokens
        .slice(rowStart, index)
        .find((t) => t.type === "inline");
      rows.push({ close: index, label: first ? textOf(first) : "" });
    }
  }
  return { columns, rows };
}

/** `row-details` がオンなら、表の直後の `row-detail` の範囲の中身を、その行の直後の行の詳細の行に移す。表に無い行は警告を差し込み、中身を表の後に残す */
export function attachRowDetails(state: StateCore): void {
  if (!featureOn(state, "row-details")) {
    return;
  }
  const tokens = state.tokens;
  // 取り除く位置（印と、行に移す中身）
  const removed = new Set<number>();
  // 位置の直後に差し込むトークン（行の詳細の行）
  const after = new Map<number, Token[]>();
  // 位置の前に差し込むトークン（警告）
  const before = new Map<number, Token[]>();
  let counter = 0;
  tokens.forEach((token, tableClose) => {
    if (token.type !== "table_close") {
      return;
    }
    let tableOpen = tableClose;
    while (
      tableOpen > 0 &&
      !(
        tokens[tableOpen]?.type === "table_open" &&
        tokens[tableOpen]?.level === token.level
      )
    ) {
      tableOpen -= 1;
    }
    const table = readTable(tokens, tableOpen, tableClose);
    // 表の直後に続く `row-detail` の範囲を順に読む
    let position = tableClose + 1;
    for (;;) {
      // 表の印の閉じの印を挟んでいても、表の直後として読む
      while (
        markOf(tokens[position])?.name === "table" &&
        markOf(tokens[position])?.closing
      ) {
        position += 1;
      }
      const mark = markOf(tokens[position]);
      if (mark?.name !== "row-detail" || mark.closing) {
        break;
      }
      const closeIndex = findClose(tokens, position, "row-detail");
      const end = closeIndex < 0 ? tokens.length : closeIndex;
      const row = Number(mark.args.args[0]);
      const target = Number.isInteger(row) ? table.rows[row - 1] : undefined;
      removed.add(position);
      if (closeIndex >= 0) {
        removed.add(closeIndex);
      }
      const warnings: Token[] = [];
      if (closeIndex < 0) {
        warnings.push(warningBlock(state, unclosedWarning(mark)));
      }
      if (!target) {
        warnings.push(
          warningBlock(state, {
            mark: mark.raw,
            message: `の ${mark.args.args[0] ?? ""} 行目がありません。表は ${table.rows.length} 行です。行の位置を 1〜${table.rows.length} で書いてください。詳細は表の後の本文として描いています。`,
          }),
        );
      } else {
        counter += 1;
        const html = renderRowDetail({
          id: `mdmark-detail-${counter}`,
          row,
          columns: table.columns,
          label: target.label,
          toggle: false,
          body: SLOT_MARKER,
        }).row;
        const [head = "", tail = ""] = html.split(SLOT_MARKER);
        const content = tokens.slice(position + 1, end);
        for (let index = position + 1; index < end; index++) {
          removed.add(index);
        }
        const detail = [
          ownBlock(state, head, tokens[position]),
          ...content,
          ownBlock(state, tail),
        ];
        after.set(target.close, [
          ...(after.get(target.close) ?? []),
          ...detail,
        ]);
      }
      if (warnings.length) {
        before.set(position, warnings);
      }
      position = end + 1;
    }
  });
  const out: Token[] = [];
  tokens.forEach((token, index) => {
    out.push(...(before.get(index) ?? []));
    if (!removed.has(index)) {
      out.push(token);
    }
    out.push(...(after.get(index) ?? []));
  });
  state.tokens = out;
}
