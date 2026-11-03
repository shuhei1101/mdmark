import type {
  MdmarkErCardinality,
  MdmarkErRelation,
  MdmarkErTable,
  MdmarkErTableKind,
} from "./definition.ts";

/** ER 図のテーブルの種類ごとの見出しの札の名前と、`color` を省いたときの色の名前 */
export const ER_TABLE_KINDS: Readonly<
  Record<MdmarkErTableKind, { label: string; color: "blue" | "orange" }>
> = {
  master: { label: "マスター", color: "blue" },
  transaction: { label: "トランザクション", color: "orange" },
};

/** ER 図の関係の端の多重度と、凡例に出す名前 */
export const ER_CARDINALITIES: Readonly<Record<MdmarkErCardinality, string>> = {
  "1": "1 つ",
  "0..1": "0 か 1 つ",
  "1..n": "1 つ以上",
  "0..n": "0 以上",
};

/** ER 図の列のマーカーの文字と、`abbr` の `title`・凡例の名前 */
export const ER_COLUMN_KEYS: Readonly<
  Record<"pk" | "fk" | "nn", { text: string; title: string }>
> = {
  pk: { text: "PK", title: "主キー" },
  fk: { text: "FK", title: "外部キー" },
  nn: { text: "NN", title: "NOT NULL" },
};

/** ER 図の寸法（px）。描いた文書の CSS の `.mdmark-diagram-er-*` と同じ値 */
export const ER_METRICS = {
  /** 見出しの高さ */
  head: 44,
  /** 列の行の高さ */
  row: 26,
  /** 畳んだときの `非表示 {数} 列` の行の高さ */
  rest: 24,
  /** 枠と余白 */
  frame: 4,
  /** 図の下の余白 */
  bottom: 32,
} as const;

/** 畳んだときも出す列（主キーか外部キー）か */
export function isKeyColumn(column: { pk?: boolean; fk?: boolean }): boolean {
  return column.pk === true || column.fk === true;
}

/** 今出している列 */
function visibleColumns(
  table: MdmarkErTable,
  folded: boolean,
): MdmarkErTable["columns"] {
  return folded ? table.columns.filter(isKeyColumn) : table.columns;
}

/** ER 図のテーブルの高さ: 見出し・出している列の行・畳んだときの非表示の行・枠と余白を足す */
export function erTableHeight(options: {
  table: MdmarkErTable;
  folded: boolean;
}): number {
  const { table, folded } = options;
  const rows = visibleColumns(table, folded).length;
  return (
    ER_METRICS.head +
    rows * ER_METRICS.row +
    (folded ? ER_METRICS.rest : 0) +
    ER_METRICS.frame
  );
}

/** 列の行の縦の中心。列が畳まれて見えないときは見出しの縦の中ほど */
function columnY(table: MdmarkErTable, name: string, folded: boolean): number {
  const index = visibleColumns(table, folded).findIndex((c) => c.name === name);
  if (index < 0) {
    return table.y + ER_METRICS.head / 2;
  }
  return (
    table.y +
    ER_METRICS.head +
    ER_METRICS.row * (index + 0.5) +
    ER_METRICS.frame / 2
  );
}

/** 関係の線の経路: 元の列の行から先の列の行へ、横・縦・横の直角の線で結ぶ */
export function erRelationRoute(options: {
  relation: MdmarkErRelation;
  from: MdmarkErTable;
  to: MdmarkErTable;
  folded: (id: string) => boolean;
}): {
  d: string;
  start: { x: number; y: number; dir: 1 | -1 };
  end: { x: number; y: number; dir: 1 | -1 };
  label: { x: number; y: number };
} {
  const { relation, from, to, folded } = options;
  // 同じ x のテーブルどうしは、両方の右の辺から出して右の外を回す
  const stacked = from.x === to.x;
  const dir: 1 | -1 = stacked || to.x > from.x ? 1 : -1;
  const x1 = dir > 0 ? from.x + from.w : from.x;
  const x2 = stacked || dir < 0 ? to.x + to.w : to.x;
  const y1 = columnY(from, relation.fromColumn, folded(from.id));
  const y2 = columnY(to, relation.toColumn, folded(to.id));
  const mid = relation.midX ?? (x1 + x2) / 2;
  return {
    d: `M${x1},${y1} H${mid} V${y2} H${x2}`,
    start: { x: x1, y: y1, dir },
    end: { x: x2, y: y2, dir: stacked ? 1 : dir === 1 ? -1 : 1 },
    label: { x: mid, y: (y1 + y2) / 2 },
  };
}
