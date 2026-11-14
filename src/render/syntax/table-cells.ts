import type { WarningItem } from "../../extensions.ts";

/** 上のセルと結合するセルの文字 */
export const MERGE_UP = "^^";

/** 左のセルと結合するセルの文字 */
export const MERGE_LEFT = "<<";

/** 結合の計画の 1 つのセル */
export type PlannedCell = {
  /** 覆う行の数（覆わないときは 1） */
  rowspan: number;
  /** 覆う列の数（覆わないときは 1） */
  colspan: number;
  /** 結合したセルの向き */
  merged?: "up" | "left";
  /** 結合したセルの、始まりのセルの位置（行・列） */
  source?: [number, number];
};

/** 表のセルの文字の格子から決めた、セルごとの結合と、結合できない `^^`・`<<` の警告 */
export type CellMergePlan = {
  /** 行と列の位置ごとのセル */
  cells: PlannedCell[][];
  /** 本文の行に `^^` の結合を持つ列の位置（小さい順） */
  mergeColumns: number[];
  /** 結合する相手の無い `^^`・`<<` の項目 */
  warnings: WarningItem[];
};

/** 結合できないセルの警告の項目 */
function mergeWarning(options: {
  label: string;
  row: number;
  column: number;
  reason: string;
}): WarningItem {
  const { label, row, column, reason } = options;
  return {
    label,
    message: `${row + 1} 行目の ${column + 1} 列目は、${reason}。記載した文字のまま描いています。`,
  };
}

/** 結合したセルなら始まりのセルの位置、そうでなければ自分の位置を返却する */
function sourceOf(
  cells: PlannedCell[][],
  row: number,
  column: number,
): [number, number] {
  return cells[row]?.[column]?.source ?? [row, column];
}

/** 表のセルの文字の格子から、`^^`・`<<` の結合を決める */
export function planCellMerges(options: {
  cells: string[][];
  headRows: number;
}): CellMergePlan {
  const { cells: texts, headRows } = options;
  const cells: PlannedCell[][] = texts.map((row) =>
    row.map(() => ({ rowspan: 1, colspan: 1 })),
  );
  const warnings: WarningItem[] = [];
  const mergeColumns = new Set<number>();
  for (const [row, values] of texts.entries()) {
    for (const [column, text] of values.entries()) {
      if (!cells[row]?.[column] || (text !== MERGE_UP && text !== MERGE_LEFT)) {
        continue;
      }
      const reason = planMerge({ cells, row, column, headRows, text });
      if (reason) {
        warnings.push(mergeWarning({ label: text, row, column, reason }));
      } else if (text === MERGE_UP && row >= headRows) {
        mergeColumns.add(column);
      }
    }
  }
  return {
    cells,
    mergeColumns: [...mergeColumns].sort((a, b) => a - b),
    warnings,
  };
}

/** `^^` は上へ、`<<` は左へ結合する。結合できないときは理由を返却する */
function planMerge(options: {
  cells: PlannedCell[][];
  row: number;
  column: number;
  headRows: number;
  text: string;
}): string | undefined {
  const { text, ...place } = options;
  return text === MERGE_UP ? planUp(place) : planLeft(place);
}

/** `^^` のセルを上のセルの始まりのセルに結合する。結合できないときは理由を返却する */
function planUp(options: {
  cells: PlannedCell[][];
  row: number;
  column: number;
  headRows: number;
}): string | undefined {
  const { cells, row, column, headRows } = options;
  if (row === 0) {
    return "上に結合するセルがありません";
  }
  if (row === headRows) {
    return "見出しの行と本文の行をまたいで結合できません";
  }
  const [sourceRow, sourceColumn] = sourceOf(cells, row - 1, column);
  const source = cells[sourceRow]?.[sourceColumn];
  // 始まりのセルが 1 列で、すぐ下の行へ伸ばすときだけ矩形のまま結合できる
  if (
    !source ||
    sourceColumn !== column ||
    source.colspan !== 1 ||
    sourceRow + source.rowspan !== row
  ) {
    return "上のセルと結合すると矩形にならないため結合できません";
  }
  source.rowspan += 1;
  const cell = cells[row]?.[column];
  if (cell) {
    cell.merged = "up";
    cell.source = [sourceRow, sourceColumn];
  }
  return undefined;
}

/** `<<` のセルを左のセルの始まりのセルに結合する。結合できないときは理由を返却する */
function planLeft(options: {
  cells: PlannedCell[][];
  row: number;
  column: number;
}): string | undefined {
  const { cells, row, column } = options;
  if (column === 0) {
    return "左に結合するセルがありません";
  }
  const [sourceRow, sourceColumn] = sourceOf(cells, row, column - 1);
  const source = cells[sourceRow]?.[sourceColumn];
  // 始まりのセルが 1 行で、すぐ右の列へ伸ばすときだけ矩形のまま結合できる
  if (
    !source ||
    sourceRow !== row ||
    source.rowspan !== 1 ||
    sourceColumn + source.colspan !== column
  ) {
    return "左のセルと結合すると矩形にならないため結合できません";
  }
  source.colspan += 1;
  const cell = cells[row]?.[column];
  if (cell) {
    cell.merged = "left";
    cell.source = [sourceRow, sourceColumn];
  }
  return undefined;
}

/** 見出しの結合の計画から、最下段の列ごとに、その列を覆う上の行の `colspan` を持つ見出しの `{行}:{位置}` を返却する（無ければ `undefined`） */
export function headerGroupsOf(options: {
  /** 見出しの行のセルの文字 */
  head: string[][];
  /** `planCellMerges` の結果 */
  plan: CellMergePlan;
}): Array<string | undefined> {
  const { head, plan } = options;
  const bottom = head.length - 1;
  const columns = head[bottom]?.length ?? 0;
  return Array.from({ length: columns }, (_, column) => {
    // 複数の行が覆うときは最も下の行を選ぶ
    for (let row = bottom - 1; row >= 0; row -= 1) {
      const cells = plan.cells[row] ?? [];
      for (const [start, cell] of cells.entries()) {
        const covers =
          cell.merged === undefined &&
          cell.colspan > 1 &&
          start <= column &&
          column < start + cell.colspan &&
          row + cell.rowspan - 1 < bottom;
        if (covers) {
          return `${row}:${start}`;
        }
      }
    }
    return undefined;
  });
}
