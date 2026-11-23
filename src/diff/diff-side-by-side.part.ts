import { escapeHtml } from "../shared/escape.logic.ts";
import { renderDiffBlock } from "./diff-blocks.part.ts";

/** 左右に並べる差分の 1 行（向かい合う 1 組のブロック）。`before`・`after` はブロックを描いた HTML */
export type SideBySideRow = {
  kind: "same" | "change" | "add" | "del";
  before?: string;
  after?: string;
};

/** 前の列の変えていないブロックから外す `data-source-line`（前のリビジョンの行番号で、描いた文書の行と対応しない） */
const SOURCE_LINE = /\sdata-source-line="[^"]*"/g;

/** 対の無い向かいの斜線の空き */
const GAP = '<div class="mdmark-diff-pair-gap" aria-hidden="true"></div>';

/** 行の 1 つのセル */
const cell = (html: string): string =>
  `<div class="mdmark-diff-pair-cell">${html}</div>`;

/** 前の列のセルの中身 */
function beforeCell(row: SideBySideRow): string {
  if (row.kind === "add") return GAP;
  if (row.kind === "same") return (row.before ?? "").replace(SOURCE_LINE, "");
  return renderDiffBlock({
    kind: "del",
    unit: "block",
    html: row.before ?? "",
  });
}

/** 後の列のセルの中身 */
function afterCell(row: SideBySideRow): string {
  if (row.kind === "del") return GAP;
  if (row.kind === "same") return row.after ?? "";
  return renderDiffBlock({ kind: "add", unit: "block", html: row.after ?? "" });
}

/** 部品設計『左右に並べる差分』の HTML 文字列を返却する。広い幅の 2 列と狭い幅の 1 列の 2 つの並びを描き、CSS がどちらかを隠す */
export function renderDiffSideBySide(options: {
  before: { label: string };
  after: { label: string };
  rows: SideBySideRow[];
  /** 列の見出しの `id` の頭（差分の場所の `id`） */
  idPrefix: string;
}): string {
  const { rows, idPrefix } = options;
  const beforeName = `前: ${options.before.label}`;
  const afterName = `後: ${options.after.label}`;
  const column = (
    side: "before" | "after",
    name: string,
    content: (row: SideBySideRow) => string,
  ): string => {
    const id = escapeHtml(`${idPrefix}-${side}`);
    return `<section class="mdmark-diff-pair-col" aria-labelledby="${id}" style="--mdmark-diff-pair-rows: ${rows.length + 1}"><div class="mdmark-diff-pair-head" id="${id}">${escapeHtml(name)}</div>${rows.map((row) => cell(content(row))).join("")}</section>`;
  };
  const label = (name: string): string =>
    `<p class="mdmark-diff-pair-label">${escapeHtml(name)}</p>`;
  const stacked = rows
    .map((row) => {
      if (row.kind === "same") return row.after ?? "";
      const parts: string[] = [];
      if (row.kind !== "add") parts.push(label(beforeName), beforeCell(row));
      if (row.kind !== "del") parts.push(label(afterName), afterCell(row));
      return parts.join("");
    })
    .join("");
  return `<div class="mdmark-diff-pair">${column("before", beforeName, beforeCell)}${column("after", afterName, afterCell)}</div><div class="mdmark-diff-pair-stacked">${stacked}</div>`;
}
