import {
  MAP_STATE,
  type MapStateLoop,
  type MapStateShape,
} from "../parts/map.ts";
import type {
  Direction,
  Flowchart,
  FlowEdge,
  FlowGroup,
  FlowNode,
} from "./flowchart.ts";
import type { MapOverride } from "./layout.ts";
import type { MapProblem } from "./spec.ts";

/** 状態の種類（開始・終了は `[*]`、分岐は `<<choice>>`） */
export type StateKind = "state" | "start" | "end" | "choice";

/** 状態（parent は入れ子の状態の ID） */
export type StateNode = {
  id: string;
  label: string;
  kind: StateKind;
  parent: string | undefined;
};

/** 入れ子の状態 */
export type StateComposite = {
  id: string;
  title: string;
  parent: string | undefined;
  direction: Direction | undefined;
};

/** 遷移（id は記載順の `t{番号}`） */
export type StateTransition = {
  id: string;
  from: string;
  to: string;
  label: string | undefined;
};

/** 注記（id は記載順の `n{番号}`） */
export type StateNote = {
  id: string;
  of: string;
  side: "left" | "right";
  text: string;
};

/** parseStateDiagram の戻り値 */
export type StateDiagram = {
  direction: Direction;
  states: StateNode[];
  composites: StateComposite[];
  transitions: StateTransition[];
  notes: StateNote[];
  problems: MapProblem[];
};

/** 注記のノードの種類の名前（構成図の入力のクラス） */
export const STATE_NOTE_CLASS = "note";

const ID = "[A-Za-z0-9_\\u0080-\\uffff]+";
const DIRECTION_RE = /^direction\s+(TB|TD|BT|LR|RL)$/;
const ALIAS_RE = new RegExp(`^state\\s+"([^"]+)"\\s+as\\s+(${ID})$`);
const CHOICE_RE = new RegExp(`^state\\s+(${ID})\\s+<<choice>>$`);
const OPEN_RE = new RegExp(`^state\\s+(?:"([^"]+)"\\s+as\\s+)?(${ID})\\s*\\{$`);
const NOTE_RE = new RegExp(
  `^note\\s+(left|right)\\s+of\\s+(${ID})\\s*:\\s*(.+)$`,
);
const DECLARE_RE = new RegExp(`^(${ID})$`);
const MOVE_RE = new RegExp(
  `^(\\[\\*\\]|${ID})\\s*-->\\s*(\\[\\*\\]|${ID})(?:\\s*:\\s*(.+))?$`,
);
/** 読んで捨てる行 */
const IGNORED_RE = /^(classDef|class|style|accTitle|accDescr|title)\b/;

const toDirection = (value: string): Direction =>
  value === "LR" || value === "RL" ? "LR" : "TB";

/** 読めない行の項目 */
const unreadable = (line: number, raw: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${raw.trim()}\` を読めません。Mermaid の stateDiagram-v2 の記法（\`{状態} --> {状態} : {ラベル}\` など）で記載してください。`,
});

/** `stateDiagram-v2`・`stateDiagram` の Mermaid を、状態・入れ子の状態・遷移・注記と読めない行の項目に読む */
export const parseStateDiagram = (source: string): StateDiagram => {
  const states = new Map<string, StateNode>();
  const composites: StateComposite[] = [];
  const transitions: StateTransition[] = [];
  const notes: StateNote[] = [];
  const problems: MapProblem[] = [];
  const stack: Array<{ composite: StateComposite; line: number }> = [];
  let direction: Direction = "TB";
  const scope = () => stack.at(-1)?.composite.id;
  const ensure = (id: string): StateNode => {
    const found = states.get(id);
    if (found) return found;
    const state: StateNode = { id, label: id, kind: "state", parent: scope() };
    states.set(id, state);
    return state;
  };
  const endpoint = (token: string, side: "start" | "end"): string => {
    if (token !== "[*]") return ensure(token).id;
    const id = `${side}_${scope() ?? "root"}`;
    if (!states.has(id))
      states.set(id, {
        id,
        label: side === "start" ? "開始" : "終了",
        kind: side,
        parent: scope(),
      });
    return id;
  };
  for (const [line, raw] of source.split("\n").entries()) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (line === 0 || text === "" || IGNORED_RE.test(text)) continue;
    const dir = DIRECTION_RE.exec(text);
    if (dir?.[1]) {
      const current = stack.at(-1)?.composite;
      if (current) current.direction = toDirection(dir[1]);
      else direction = toDirection(dir[1]);
      continue;
    }
    const alias = ALIAS_RE.exec(text);
    if (alias?.[1] && alias[2]) {
      ensure(alias[2]).label = alias[1];
      continue;
    }
    const choice = CHOICE_RE.exec(text);
    if (choice?.[1]) {
      ensure(choice[1]).kind = "choice";
      continue;
    }
    const open = OPEN_RE.exec(text);
    if (open?.[2]) {
      const composite: StateComposite = {
        id: open[2],
        title: open[1] ?? open[2],
        parent: scope(),
        direction: undefined,
      };
      composites.push(composite);
      stack.push({ composite, line });
      continue;
    }
    if (text === "}") {
      if (!stack.pop()) problems.push(unreadable(line, raw));
      continue;
    }
    const note = NOTE_RE.exec(text);
    if (note?.[1] && note[2] && note[3]) {
      notes.push({
        id: `n${notes.length + 1}`,
        of: note[2],
        side: note[1] === "left" ? "left" : "right",
        text: note[3].trim(),
      });
      continue;
    }
    const move = MOVE_RE.exec(text);
    if (move?.[1] && move[2]) {
      const label = move[3]?.trim();
      transitions.push({
        id: `t${transitions.length + 1}`,
        from: endpoint(move[1], "start"),
        to: endpoint(move[2], "end"),
        label: label === "" ? undefined : label,
      });
      continue;
    }
    // 入れ子の中の状態の宣言は、外で先に出た状態もその入れ子の状態の中へ移す
    const declared = DECLARE_RE.exec(text);
    if (declared?.[1]) {
      ensure(declared[1]).parent = scope();
      continue;
    }
    problems.push(unreadable(line, raw));
  }
  for (const open of stack) {
    problems.push({
      kind: "map_invalid",
      line: open.line,
      message: `入れ子の状態 \`${open.composite.id}\` の \`{\` に対応する \`}\` がありません。入れ子の状態の最後の行の後に \`}\` を記載してください。`,
    });
  }
  const compositeIds = new Set(composites.map((item) => item.id));
  return {
    direction,
    states: [...states.values()].filter((item) => !compositeIds.has(item.id)),
    composites,
    transitions,
    notes,
    problems,
  };
};

/** 状態をノード、入れ子の状態をグループ、遷移を線、注記を破線でつないだノードにした構成図の入力と、同じ状態への遷移 */
export const stateToFlowchart = (
  diagram: StateDiagram,
): { chart: Flowchart; loops: StateTransition[] } => {
  const compositeIds = new Set(diagram.composites.map((item) => item.id));
  const states = [...diagram.states];
  /** 入れ子の状態の中の開始・終了。無ければ補う */
  const inner = (composite: string, side: "start" | "end"): string => {
    const id = `${side}_${composite}`;
    if (!states.some((item) => item.id === id))
      states.push({
        id,
        label: side === "start" ? "開始" : "終了",
        kind: side,
        parent: composite,
      });
    return id;
  };
  const loops: StateTransition[] = [];
  const edges: FlowEdge[] = [];
  for (const transition of diagram.transitions) {
    if (transition.from === transition.to) {
      loops.push(transition);
      continue;
    }
    edges.push({
      id: transition.id,
      from: compositeIds.has(transition.from)
        ? inner(transition.from, "end")
        : transition.from,
      to: compositeIds.has(transition.to)
        ? inner(transition.to, "start")
        : transition.to,
      arrow: "-->",
      both: false,
      label: transition.label,
    });
  }
  const parentOf = new Map(states.map((item) => [item.id, item.parent]));
  const nodes: FlowNode[] = states.map((item) => ({
    id: item.id,
    label: item.label,
    shape: item.kind === "choice" ? "rhombus" : "round",
    classes: [item.kind],
    parent: item.parent,
  }));
  for (const note of diagram.notes) {
    nodes.push({
      id: note.id,
      label: note.text,
      shape: "rect",
      classes: [STATE_NOTE_CLASS],
      parent: parentOf.get(note.of),
    });
    edges.push({
      id: note.id,
      from: note.side === "left" ? note.id : note.of,
      to: note.side === "left" ? note.of : note.id,
      arrow: "-.->",
      both: false,
      label: undefined,
    });
  }
  const groups: FlowGroup[] = diagram.composites.map((item) => ({
    id: item.id,
    title: item.title,
    parent: item.parent,
    direction: item.direction,
  }));
  return {
    chart: {
      direction: diagram.direction,
      nodes,
      groups,
      edges,
      problems: diagram.problems,
    },
    loops,
  };
};

/** 部品『mapの状態遷移図』に指定する形状・同じ状態への遷移と、ノードの大きさ・上に空ける高さの上書き */
export const statePartInputs = (
  chart: Flowchart,
  loops: StateTransition[],
): {
  shapes: Record<string, MapStateShape>;
  loops: MapStateLoop[];
  overrides: Record<string, MapOverride>;
} => {
  const shapes: Record<string, MapStateShape> = {};
  const overrides: Record<string, MapOverride> = {};
  for (const node of chart.nodes) {
    const kind = node.classes[0];
    if (kind === "start" || kind === "end") {
      shapes[node.id] = kind;
      overrides[node.id] = {
        size: { w: MAP_STATE.point, h: MAP_STATE.point },
      };
    } else if (kind === "choice") {
      shapes[node.id] = kind;
      overrides[node.id] = {
        size: { w: MAP_STATE.choice, h: MAP_STATE.choice },
      };
    } else if (kind === STATE_NOTE_CLASS) shapes[node.id] = "note";
  }
  for (const loop of loops)
    overrides[loop.from] = {
      ...overrides[loop.from],
      above: MAP_STATE.loopSpace,
    };
  return {
    shapes,
    loops: loops.map((loop) => ({
      wire: loop.id,
      node: loop.from,
      label: loop.label,
    })),
    overrides,
  };
};
