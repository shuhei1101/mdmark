import { labelTooLong } from "./check.ts";
import type {
  MdmarkDiagramKind,
  MdmarkDiagramNode,
  MdmarkDiagramWire,
  MdmarkFlowDefinition,
} from "./definition.ts";

/** 座標を省いた判定フローチャートのノードの既定の大きさと配置の間隔（px）。大きさと間隔はモックの `judgement-auto` と同じ値 */
export const FLOWCHART_LAYOUT = {
  sizes: {
    start: { w: 100, h: 100 },
    question: { w: 280, h: 136 },
    action: { w: 200, h: 72 },
    result: { w: 200, h: 60 },
  } as Partial<Record<MdmarkDiagramKind, { w: number; h: number }>>,
  gapY: 40,
  gapX: 120,
  margin: 16,
  lineStep: 20,
};

/** 名前が収まらないときに高さを足す回数の上限 */
const MAX_GROW = 20;

/** 格子の位置（行と列。列は 0 が左、1 が右） */
type Cell = { row: number; col: number };

type Point = [number, number];

/** ノードの既定の大きさに、名前が収まるまで高さを足す */
function sizeOf(node: MdmarkDiagramNode): { w: number; h: number } {
  const base = FLOWCHART_LAYOUT.sizes[node.kind] ?? { w: 200, h: 72 };
  let h = base.h;
  for (
    let count = 0;
    count < MAX_GROW && labelTooLong({ ...node, w: base.w, h });
    count++
  ) {
    h += FLOWCHART_LAYOUT.lineStep;
  }
  return { w: base.w, h };
}

/** 質問から出る線を、下へ出す線と右へ出す線に分ける */
function splitQuestion(
  outgoing: MdmarkDiagramWire[],
  kindOf: (id: string) => MdmarkDiagramKind | undefined,
): { down?: MdmarkDiagramWire | undefined; right: MdmarkDiagramWire[] } {
  const toQuestion = outgoing.find((wire) => kindOf(wire.to) === "question");
  if (toQuestion) {
    return {
      down: toQuestion,
      right: outgoing.filter((wire) => wire !== toQuestion),
    };
  }
  const no =
    outgoing.find((wire) => wire.label?.trim().toUpperCase() === "NO") ??
    outgoing[outgoing.length - 1];
  return { down: no, right: outgoing.filter((wire) => wire !== no) };
}

/** 座標を省いた判定フローチャートの定義に、ノードの座標・線の点・図の大きさを入れた定義を返す */
export function layoutFlowchart(
  definition: MdmarkFlowDefinition,
): MdmarkFlowDefinition {
  const { gapX, gapY, margin } = FLOWCHART_LAYOUT;
  const byId = new Map(definition.nodes.map((node) => [node.id, node]));
  const kindOf = (id: string) => byId.get(id)?.kind;
  const outgoingOf = (id: string) =>
    definition.wires.filter((wire) => wire.from === id);
  const cells = new Map<string, Cell>();
  const taken = (cell: Cell) =>
    [...cells.values()].some(
      (other) => other.row === cell.row && other.col === cell.col,
    );
  const place = (id: string, cell: Cell) => {
    if (!cells.has(id) && byId.has(id)) {
      cells.set(id, cell);
    }
  };

  // 左の列: 開始から質問を上から下へ並べ、右へ出す線の先を控える
  const rightAt: Array<{ id: string; row: number }> = [];
  const start =
    definition.nodes.find((node) => node.kind === "start") ??
    definition.nodes[0];
  let current = start?.id;
  let row = 0;
  if (current !== undefined) {
    place(current, { row, col: 0 });
  }
  while (current !== undefined) {
    const outgoing = outgoingOf(current);
    const kind = kindOf(current);
    let down: MdmarkDiagramWire | undefined;
    if (kind === "question") {
      const split = splitQuestion(outgoing, kindOf);
      down = split.down;
      for (const wire of split.right) {
        rightAt.push({ id: wire.to, row });
      }
    } else if (kind !== "result") {
      down = outgoing[0];
    }
    if (down === undefined || cells.has(down.to)) {
      break;
    }
    row += 1;
    place(down.to, { row, col: 0 });
    current = down.to;
  }

  // 右の列: 質問から右へ出す線の先をその質問と同じ行に置き（複数の線が入るノードはこの位置を優先する）、アクションの先を下へ続ける
  for (const { id, row: at } of rightAt) {
    place(id, { row: at, col: 1 });
  }
  for (const { id } of rightAt) {
    let from = id;
    while (kindOf(from) === "action") {
      const next = outgoingOf(from)[0]?.to;
      const at = cells.get(from);
      if (next === undefined || at === undefined || cells.has(next)) {
        break;
      }
      let nextRow = at.row + 1;
      while (taken({ row: nextRow, col: 1 })) {
        nextRow += 1;
      }
      place(next, { row: nextRow, col: 1 });
      from = next;
    }
  }

  // 開始から届かないノードは、一番下の行の下に定義の順に左の列へ並べる
  let lastRow = Math.max(-1, ...[...cells.values()].map((cell) => cell.row));
  for (const node of definition.nodes) {
    if (!cells.has(node.id)) {
      lastRow += 1;
      place(node.id, { row: lastRow, col: 0 });
    }
  }

  // 列の幅と行の高さを決め、ノードを列と行の中央に置く
  const sizes = new Map(
    definition.nodes.map((node) => [node.id, sizeOf(node)]),
  );
  const colWidth = [0, 0];
  const rowHeight: number[] = [];
  for (const [id, cell] of cells) {
    const size = sizes.get(id) ?? { w: 0, h: 0 };
    colWidth[cell.col] = Math.max(colWidth[cell.col] ?? 0, size.w);
    rowHeight[cell.row] = Math.max(rowHeight[cell.row] ?? 0, size.h);
  }
  const colLeft = [margin, margin + (colWidth[0] ?? 0) + gapX];
  const rowTop: number[] = [];
  let top = margin;
  for (let index = 0; index < rowHeight.length; index++) {
    rowTop[index] = top;
    top += (rowHeight[index] ?? 0) + gapY;
  }
  const nodes = definition.nodes.map((node): MdmarkDiagramNode => {
    const cell = cells.get(node.id) ?? { row: 0, col: 0 };
    const size = sizes.get(node.id) ?? { w: 0, h: 0 };
    return {
      ...node,
      x: (colLeft[cell.col] ?? 0) + ((colWidth[cell.col] ?? 0) - size.w) / 2,
      y: (rowTop[cell.row] ?? 0) + ((rowHeight[cell.row] ?? 0) - size.h) / 2,
      w: size.w,
      h: size.h,
    };
  });

  // 線を縦と横の折れ線で結ぶ
  const laid = new Map(nodes.map((node) => [node.id, node]));
  const rightEdge = Math.max(...nodes.map((node) => node.x + node.w));
  const wires = definition.wires.map((wire): MdmarkDiagramWire => {
    const from = laid.get(wire.from);
    const to = laid.get(wire.to);
    if (from === undefined || to === undefined) {
      return { ...wire, points: [] };
    }
    const points = route(from, to, cells, rightEdge + gapX / 2);
    const [first, second] = points;
    return {
      ...wire,
      points,
      ...(wire.label !== undefined && first && second
        ? {
            labelAt: [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2],
          }
        : {}),
    };
  });
  const xs = [
    ...nodes.map((node) => node.x + node.w),
    ...wires.flatMap((wire) => wire.points.map((point) => point[0])),
  ];
  const ys = [
    ...nodes.map((node) => node.y + node.h),
    ...wires.flatMap((wire) => wire.points.map((point) => point[1])),
  ];
  return {
    ...definition,
    width: Math.max(0, ...xs) + margin,
    height: Math.max(0, ...ys) + margin,
    nodes,
    wires,
  };
}

/** 2 つのノードを結ぶ縦と横の折れ線 */
function route(
  from: MdmarkDiagramNode,
  to: MdmarkDiagramNode,
  cells: Map<string, Cell>,
  detourX: number,
): Point[] {
  const a = cells.get(from.id) ?? { row: 0, col: 0 };
  const b = cells.get(to.id) ?? { row: 0, col: 0 };
  const fromCx = from.x + from.w / 2;
  const fromCy = from.y + from.h / 2;
  const toCx = to.x + to.w / 2;
  const toCy = to.y + to.h / 2;
  if (b.col > a.col) {
    // 右の列へ: 同じ行なら横へ、下の行なら右へ出てから下りる
    if (b.row === a.row) {
      return [
        [from.x + from.w, fromCy],
        [to.x, fromCy],
      ];
    }
    return [
      [from.x + from.w, fromCy],
      [toCx, fromCy],
      [toCx, to.y],
    ];
  }
  if (b.col === a.col && b.row > a.row) {
    // 同じ列の下へ
    return [
      [fromCx, from.y + from.h],
      [toCx, to.y],
    ];
  }
  if (b.col < a.col && b.row > a.row) {
    // 左の列の下へ: 下りてから左へ
    return [
      [fromCx, from.y + from.h],
      [fromCx, toCy],
      [to.x + to.w, toCy],
    ];
  }
  // 上へ戻る線: 右の外側を回る
  return [
    [from.x + from.w, fromCy],
    [detourX, fromCy],
    [detourX, toCy],
    [to.x + to.w, toCy],
  ];
}
