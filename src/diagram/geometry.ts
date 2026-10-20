import type { MdmarkDiagramWire } from "./definition.ts";

/** line jump の弧の半径（px） */
export const JUMP_RADIUS = 6;

/** 同じ向きで重なる線をずらす幅（px） */
export const OVERLAP_OFFSET = 4;

/** 拡大・縮小と移動の量: 1 回の倍率・上限・1 回の移動量（px） */
export const ZOOM = { step: 1.25, max: 3, pan: 80 };

/** 折れ線の点 */
type Point = [number, number];

/** 点をつないだ svg のパス（飛び越えもずらしもしない） */
export function polylinePath(points: Point[]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
}

/** 折れ線の 1 区間 */
type Segment = {
  /** 横の区間か（点が同じ y で並ぶ） */
  horizontal: boolean;
  /** 区間が通る y（横）か x（縦） */
  fixed: number;
  /** 区間の小さい側の端（横なら x、縦なら y） */
  low: number;
  /** 区間の大きい側の端 */
  high: number;
  /** 進む向き（1 か -1。長さ 0 は 0） */
  direction: number;
};

/** 図の全体が表示する枠に収まる倍率。100% を超えない */
export function fitScale(
  content: { width: number; height: number },
  box: { width: number; height: number },
): number {
  return Math.min(1, box.width / content.width, box.height / content.height);
}

/** 点 `from` から `to` への区間を読む */
function segmentOf(from: Point, to: Point): Segment {
  const horizontal = from[1] === to[1];
  const start = horizontal ? from[0] : from[1];
  const end = horizontal ? to[0] : to[1];
  return {
    horizontal,
    fixed: horizontal ? from[1] : from[0],
    low: Math.min(start, end),
    high: Math.max(start, end),
    direction: Math.sign(end - start),
  };
}

/** 2 つの区間が同じ向きで、同じ線の上で重なるか */
function overlaps(a: Segment, b: Segment): boolean {
  return (
    a.horizontal === b.horizontal &&
    a.direction === b.direction &&
    a.fixed === b.fixed &&
    Math.min(a.high, b.high) > Math.max(a.low, b.low)
  );
}

/** 先に置いた線と同じ向きで重なる区間を、重なる数 × `OVERLAP_OFFSET` だけ線に直角にずらした点を返す */
function offsetOverlaps(wires: MdmarkDiagramWire[]): Map<string, Point[]> {
  const placed: Segment[] = [];
  const result = new Map<string, Point[]>();
  for (const wire of wires) {
    const points = wire.points.map((point): Point => [point[0], point[1]]);
    for (let index = 0; index < points.length - 1; index++) {
      const from = points[index];
      const to = points[index + 1];
      if (!from || !to) {
        continue;
      }
      let segment = segmentOf(from, to);
      const count = placed.filter((other) => overlaps(segment, other)).length;
      if (count > 0) {
        // 横の区間は y を、縦の区間は x をずらす。区間の両端の点が動くので、つながる区間は伸び縮みする
        const axis = segment.horizontal ? 1 : 0;
        from[axis] += count * OVERLAP_OFFSET;
        to[axis] += count * OVERLAP_OFFSET;
        segment = segmentOf(from, to);
      }
      placed.push(segment);
    }
    result.set(wire.id, points);
  }
  return result;
}

/** 横の区間 `segment` が、ほかの線の縦の区間と交わる x を集める。端の点どうしが接するものは交差にしない */
function crossings(
  segment: Segment,
  owner: string,
  all: Map<string, Point[]>,
): number[] {
  const xs: number[] = [];
  for (const [id, points] of all) {
    if (id === owner) {
      continue;
    }
    for (let index = 0; index < points.length - 1; index++) {
      const from = points[index];
      const to = points[index + 1];
      if (!from || !to) {
        continue;
      }
      const vertical = segmentOf(from, to);
      if (vertical.horizontal) {
        continue;
      }
      const x = vertical.fixed;
      if (
        x > segment.low + JUMP_RADIUS &&
        x < segment.high - JUMP_RADIUS &&
        segment.fixed > vertical.low &&
        segment.fixed < vertical.high
      ) {
        xs.push(x);
      }
    }
  }
  return xs;
}

/** 全ての線の横の区間が、ほかの線の縦の区間と交わる点に半円の弧を入れた svg のパスを、線の `id` から引ける形で返す。同じ向きで重なる区間はずらす */
export function jumpPaths(wires: MdmarkDiagramWire[]): Map<string, string> {
  const shifted = offsetOverlaps(wires);
  const paths = new Map<string, string>();
  for (const [id, points] of shifted) {
    const first = points[0];
    if (!first) {
      continue;
    }
    let path = `M${first[0]},${first[1]}`;
    for (let index = 0; index < points.length - 1; index++) {
      const from = points[index];
      const to = points[index + 1];
      if (!from || !to) {
        continue;
      }
      const segment = segmentOf(from, to);
      if (segment.horizontal && segment.direction !== 0) {
        const direction = segment.direction;
        // 進む向きの順に飛び越える。右へも左へも上へふくらませる
        const xs = crossings(segment, id, shifted).sort(
          (a, b) => (a - b) * direction,
        );
        for (const x of xs) {
          const sweep = direction > 0 ? 1 : 0;
          path += ` L${x - JUMP_RADIUS * direction},${from[1]} A${JUMP_RADIUS},${JUMP_RADIUS} 0 0 ${sweep} ${x + JUMP_RADIUS * direction},${from[1]}`;
        }
      }
      path += ` L${to[0]},${to[1]}`;
    }
    paths.set(id, path);
  }
  return paths;
}
