import type {
  MdmarkErCardinality,
  MdmarkErTable,
} from "../diagram/definition.ts";
import { ER_COLUMN_KEYS, ER_TABLE_KINDS, isKeyColumn } from "../diagram/er.ts";
import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 多重度の記号の位置（線の端からの距離。px） */
const END = {
  /** 内側の縦線 */
  bar: 6,
  /** 外側の縦線 */
  outerBar: 11,
  /** 鳥の足の付け根 */
  crow: 10,
  /** 鳥の足の開き（縦の半分） */
  crowSpread: 7,
  /** 縦線の高さの半分 */
  barHalf: 6,
  /** 丸の半径 */
  ring: 4,
} as const;

/** テーブルの色（`color`、無ければ種類の既定の色。どちらも無ければ `undefined`） */
export function erTableColor(table: MdmarkErTable): string | undefined {
  return (
    table.color ?? (table.kind ? ER_TABLE_KINDS[table.kind].color : undefined)
  );
}

/** 列の開閉のボタンのアイコン（畳んでいるときは開く、開いているときは畳む） */
export function erFoldIcon(folded: boolean): string {
  return iconSvg(folded ? "chevrons-up-down" : "chevrons-down-up");
}

/** 畳んだときの `非表示 {数} 列` の行の文字 */
export function erRestText(hidden: number): string {
  return `非表示 ${hidden} 列`;
}

/** ER 図のテーブル（見出しと列の行）の HTML。全ての列の行を出し、畳んだテーブルは主キーでも外部キーでもない列の行を隠す */
export function renderErTable(options: {
  table: MdmarkErTable;
  tipId: string | undefined;
}): string {
  const { table, tipId } = options;
  const folded = table.folded === true;
  const color = erTableColor(table);
  const label = escapeHtml(table.label);
  const others = table.columns.filter((c) => !isKeyColumn(c)).length;
  const fold =
    others > 0
      ? `<button class="mdmark-diagram-er-fold" type="button" aria-expanded="${folded ? "false" : "true"}" aria-label="「${label}」の主キーと外部キー以外の列" data-er-fold="${escapeHtml(table.id)}">${erFoldIcon(folded)}</button>`
      : "";
  const info =
    tipId === undefined
      ? ""
      : `<button class="mdmark-diagram-info" type="button" aria-label="「${label}」の説明" aria-describedby="${escapeHtml(tipId)}" data-tip-owner="${escapeHtml(`table:${table.id}`)}">${iconSvg("info")}</button>`;
  const kind = table.kind
    ? `<span class="mdmark-diagram-er-kind">${ER_TABLE_KINDS[table.kind].label}</span>`
    : "";
  const rows = table.columns
    .map((column) => {
      const keys = (["pk", "fk", "nn"] as const)
        .filter((key) => column[key])
        .map(
          (key) =>
            `<abbr class="mdmark-diagram-er-key" data-key="${key}" title="${ER_COLUMN_KEYS[key].title}">${ER_COLUMN_KEYS[key].text}</abbr>`,
        )
        .join("");
      const hidden = folded && !isKeyColumn(column) ? ' hidden="hidden"' : "";
      return `<li class="mdmark-diagram-er-column" data-column="${escapeHtml(column.name)}"${column.pk ? ' data-pk=""' : ""}${hidden}><span class="mdmark-diagram-er-keys">${keys}</span><span class="mdmark-diagram-er-name">${escapeHtml(column.name)}</span><span class="mdmark-diagram-er-type">${escapeHtml(column.type)}</span></li>`;
    })
    .join("");
  const rest =
    others > 0
      ? `<li class="mdmark-diagram-er-rest"${folded ? "" : ' hidden="hidden"'}>${erRestText(others)}</li>`
      : "";
  return `<div class="mdmark-diagram-er-table${info ? " has-tip" : ""}" data-node="${escapeHtml(table.id)}"${color ? ` data-color="${color}"` : ""} style="left:${table.x}px;top:${table.y}px;width:${table.w}px"><div class="mdmark-diagram-er-head">${fold}<span class="mdmark-diagram-er-title">${iconSvg("table")}<span class="mdmark-diagram-er-physical">${escapeHtml(table.name)}</span></span><span class="mdmark-diagram-er-sub"><span class="mdmark-diagram-er-logical">${label}</span>${kind}</span><span class="mdmark-diagram-er-actions">${info}</span></div><ul class="mdmark-diagram-er-columns" aria-label="「${label}」の列">${rows}${rest}</ul></div>`;
}

/** 関係の線の端の多重度の記号（`1` は縦線 2 本、`0..1` は縦線と丸、`1..n` は鳥の足と縦線、`0..n` は鳥の足と丸）。`dir` は線がテーブルから出る向き */
export function erEndSvg(options: {
  x: number;
  y: number;
  dir: 1 | -1;
  card: MdmarkErCardinality;
}): string {
  const { x, y, dir, card } = options;
  const at = (d: number) => x + dir * d;
  const bar = (d: number) =>
    `<line class="mdmark-diagram-er-end" x1="${at(d)}" y1="${y - END.barHalf}" x2="${at(d)}" y2="${y + END.barHalf}"></line>`;
  const ring = (d: number) =>
    `<circle class="mdmark-diagram-er-end" data-ring="" cx="${at(d)}" cy="${y}" r="${END.ring}"></circle>`;
  const crow = `<path class="mdmark-diagram-er-end" d="M${at(END.crow)},${y} L${at(0)},${y - END.crowSpread} M${at(END.crow)},${y} L${at(0)},${y} M${at(END.crow)},${y} L${at(0)},${y + END.crowSpread}"></path>`;
  const ringAt = END.outerBar + END.ring - 1;
  const shapes: Record<MdmarkErCardinality, string[]> = {
    "1": [bar(END.bar), bar(END.outerBar)],
    "0..1": [bar(END.bar), ring(ringAt)],
    "1..n": [crow, bar(ringAt)],
    "0..n": [crow, ring(ringAt + 1)],
  };
  return shapes[card].join("");
}
