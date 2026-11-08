import type { MdmarkDiagramNode, MdmarkFlowDefinition } from "./definition.ts";

/** 描いた文書の CSS の `.mdmark-diagram-node` と同じ文字の大きさ（px）・行の高さの倍率・余白（px）。CSS を修正したときは合わせて修正する */
export const LABEL_METRICS = {
  kindSize: 11,
  nameSize: 14,
  subSize: 12,
  lineHeight: 1.4,
  padY: 6,
  padX: 10,
};

/** 半角の文字の幅の、文字の大きさに対する割合 */
const HALF_WIDTH = 0.6;

/** フロー図の配置のずれの種類 */
export type FlowLayoutKind =
  | "diagram_node_overlap"
  | "diagram_node_overflow"
  | "diagram_wire_crosses_node"
  | "diagram_label_too_long";

/** フロー図の配置のずれ 1 件 */
export type FlowLayoutIssue = {
  /** ずれの種類 */
  kind: FlowLayoutKind;
  /** 対象のノードか線の `id` */
  ids: string[];
};

/** 矩形 */
type Rect = { x: number; y: number; w: number; h: number };

/** 文字が全角か（半角の英数字・記号・半角カナ以外） */
function isWide(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return !(code <= 0x7e || (code >= 0xff61 && code <= 0xff9f));
}

/** 全角の文字を文字の大きさ、半角の文字を 0.6 倍の幅とみなし、幅で折り返した行の数を返却する（空の文字は 0） */
export function labelLineCount(options: {
  text: string;
  fontSize: number;
  width: number;
}): number {
  const { text, fontSize, width } = options;
  if (text === "") {
    return 0;
  }
  let lines = 1;
  let used = 0;
  for (const char of text) {
    const advance = isWide(char) ? fontSize : fontSize * HALF_WIDTH;
    // 行に 1 文字も無いときは、幅を超えても同じ行に配置する
    if (used > 0 && used + advance > width) {
      lines += 1;
      used = 0;
    }
    used += advance;
  }
  return lines;
}

/** 2 つの矩形の内側が重なるか（辺が接するだけは重ならない） */
function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/** 矩形が外の矩形の中に収まるか */
function inside(rect: Rect, outer: Rect): boolean {
  return (
    rect.x >= outer.x &&
    rect.y >= outer.y &&
    rect.x + rect.w <= outer.x + outer.w &&
    rect.y + rect.h <= outer.y + outer.h
  );
}

/** 線分が矩形の内側を通るか（辺をなぞる・角に触れるだけは通らない）。Liang–Barsky で矩形に切り取って確認する */
function crosses(
  from: [number, number],
  to: [number, number],
  rect: Rect,
): boolean {
  const [x1, y1] = from;
  const dx = to[0] - x1;
  const dy = to[1] - y1;
  let enter = 0;
  let leave = 1;
  const edges: Array<[number, number]> = [
    [-dx, x1 - rect.x],
    [dx, rect.x + rect.w - x1],
    [-dy, y1 - rect.y],
    [dy, rect.y + rect.h - y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      // 辺と平行な線分は、辺の内側にあるときだけ通る
      if (q <= 0) {
        return false;
      }
      continue;
    }
    const t = q / p;
    if (p < 0) {
      enter = Math.max(enter, t);
    } else {
      leave = Math.min(leave, t);
    }
  }
  return enter < leave;
}

/** 描いたときの文字（`{{単語}}` は単語だけ） */
function drawnText(text: string): string {
  return text.replace(/\{\{(.+?)\}\}/g, "$1");
}

/** ノードの種類・名前・補足を折り返した行の高さの合計が、ノードの高さに収まらないか（上下の余白には文字がはみ出してよい） */
export function labelTooLong(node: MdmarkDiagramNode): boolean {
  const { kindSize, nameSize, subSize, lineHeight, padX } = LABEL_METRICS;
  const width = node.w - padX * 2;
  const nameLines = labelLineCount({
    text: drawnText(node.name),
    fontSize: nameSize,
    width,
  });
  const subLines = labelLineCount({
    text: drawnText(node.sub ?? ""),
    fontSize: subSize,
    width,
  });
  const height =
    (kindSize + nameLines * nameSize + subLines * subSize) * lineHeight;
  return height > node.h;
}

/** フロー図の定義の、ノードの重なり・はみ出し・線のノードの横切り・収まらないラベルを、ずれ 1 つにつき 1 件にして返却する */
export function checkFlowLayout(
  definition: MdmarkFlowDefinition,
): FlowLayoutIssue[] {
  const { nodes, wires, frame } = definition;
  const issues: FlowLayoutIssue[] = [];
  nodes.forEach((node, index) => {
    for (const other of nodes.slice(index + 1)) {
      if (overlaps(node, other)) {
        issues.push({ kind: "diagram_node_overlap", ids: [node.id, other.id] });
      }
    }
  });
  const canvas: Rect = {
    x: 0,
    y: 0,
    w: definition.width,
    h: definition.height,
  };
  for (const node of nodes) {
    // 枠の外のノード（外部のシステム）は許し、枠の縁をまたぐノードだけをはみ出しにする
    const straddles =
      frame !== undefined && overlaps(node, frame) && !inside(node, frame);
    if (!inside(node, canvas) || straddles) {
      issues.push({ kind: "diagram_node_overflow", ids: [node.id] });
    }
  }
  for (const wire of wires) {
    const segments = wire.points
      .slice(1)
      .map((point, index): [[number, number], [number, number]] => [
        wire.points[index] ?? point,
        point,
      ]);
    for (const node of nodes) {
      if (node.id === wire.from || node.id === wire.to) {
        continue;
      }
      if (segments.some(([from, to]) => crosses(from, to, node))) {
        issues.push({
          kind: "diagram_wire_crosses_node",
          ids: [wire.id, node.id],
        });
      }
    }
  }
  for (const node of nodes) {
    if (labelTooLong(node)) {
      issues.push({ kind: "diagram_label_too_long", ids: [node.id] });
    }
  }
  return issues;
}
