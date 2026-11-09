import { checkFlowLayout, crosses, inside, overlaps } from "../../src/diagram/check.ts";
import type { MapLayout, Rect } from "./layout.ts";

export type MapIssue = { kind: string; ids: string[] };

const segmentsOf = (points: Array<[number, number]>): Array<[[number, number], [number, number]]> =>
  points.slice(1).map((point, index) => [points[index] ?? point, point]);

const strictlyInside = (p: [number, number], rect: Rect): boolean =>
  p[0] > rect.x && p[0] < rect.x + rect.w && p[1] > rect.y && p[1] < rect.y + rect.h;

/**
 * 入れ子の箱を持つ配置を点検する。葉どうしは今の checkFlowLayout に渡し、
 * 箱は checkFlowLayout が持たないため、重なり・はみ出し・横切り・祖先の枠の出入りをここで数える
 */
export const checkMapLayout = (layout: MapLayout): MapIssue[] => {
  const flowIssues = checkFlowLayout({
    title: "",
    scope: "",
    updated: "",
    width: layout.width,
    height: layout.height,
    nodes: layout.leaves.map((leaf) => ({ id: leaf.id, kind: "action", x: leaf.x, y: leaf.y, w: leaf.w, h: leaf.h, name: leaf.lines.join("") })),
    wires: layout.edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, line: "flow", points: edge.points })),
  } as unknown as Parameters<typeof checkFlowLayout>[0]);
  const issues: MapIssue[] = flowIssues.map((issue) => ({ kind: issue.kind, ids: issue.ids }));
  const boxById = new Map(layout.boxes.map((box) => [box.id, box]));
  const ancestorsOf = new Map<string, string[]>([
    ...layout.leaves.map((leaf): [string, string[]] => [leaf.id, leaf.ancestors]),
    ...layout.boxes.map((box): [string, string[]] => [box.id, box.ancestors]),
  ]);
  const items = [...layout.leaves, ...layout.boxes];
  // 箱と、その子孫でない要素の重なり
  for (const box of layout.boxes) {
    for (const item of items) {
      if (item.id === box.id || (ancestorsOf.get(item.id) ?? []).includes(box.id) || (ancestorsOf.get(box.id) ?? []).includes(item.id)) {
        continue;
      }
      if (overlaps(box, item)) {
        issues.push({ kind: "box_overlap", ids: [box.id, item.id] });
      }
    }
  }
  // 子が親の箱からはみ出す
  for (const item of items) {
    const parent = (ancestorsOf.get(item.id) ?? [])[0];
    const box = parent === undefined ? undefined : boxById.get(parent);
    if (box && !inside(item, box)) {
      issues.push({ kind: "box_child_overflow", ids: [item.id, box.id] });
    }
  }
  for (const edge of layout.edges) {
    const fromAnc = ancestorsOf.get(edge.from) ?? [];
    const toAnc = ancestorsOf.get(edge.to) ?? [];
    const segments = segmentsOf(edge.points);
    for (const box of layout.boxes) {
      const isAncestor = fromAnc.includes(box.id) || toAnc.includes(box.id);
      if (!isAncestor) {
        if (segments.some(([a, b]) => crosses(a, b, box))) {
          issues.push({ kind: "wire_crosses_box", ids: [edge.id, box.id] });
        }
        continue;
      }
      // 祖先の箱の枠の出入りの数: 共通の祖先は 0 回、片方だけの祖先は 1 回
      const expected = fromAnc.includes(box.id) && toAnc.includes(box.id) ? 0 : 1;
      let count = 0;
      for (const [a, b] of segments) {
        if (strictlyInside(a, box) !== strictlyInside(b, box)) {
          count += 1;
        }
      }
      if (count !== expected) {
        issues.push({ kind: "wire_frame_crossings", ids: [edge.id, box.id, String(count)] });
      }
    }
  }
  return issues;
};
