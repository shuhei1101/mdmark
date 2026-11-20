import type {
  Direction,
  Flowchart,
  FlowEdge,
  FlowGroup,
  FlowNode,
} from "./flowchart.ts";
import type { MapOverride } from "./layout.ts";
import {
  MAP_STATE,
  type MapStateLoop,
  type MapStateShape,
} from "./map.part.ts";
import { type MermaidStyles, readMermaidStyles } from "./mermaid-style.ts";
import type { MapProblem } from "./spec.ts";

/** 状態の種類（開始・終了は `[*]`、分岐は `<<choice>>`、並行の分岐と合流は `<<fork>>`・`<<join>>`） */
export type StateKind = "state" | "start" | "end" | "choice" | "fork";

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
  /** `readMermaidStyles` が読み取った状態の色 */
  styles: MermaidStyles;
  problems: MapProblem[];
};

/** 注記のノードの種類の名前（構成図の入力のクラス） */
export const STATE_NOTE_CLASS = "note";

const ID = "[A-Za-z0-9_\\u0080-\\uffff]+";
const DIRECTION_RE = /^direction\s+(TB|TD|BT|LR|RL)$/;
const ALIAS_RE = new RegExp(`^state\\s+"([^"]+)"\\s+as\\s+(${ID})$`);
const CHOICE_RE = new RegExp(`^state\\s+(${ID})\\s+<<(choice|fork|join)>>$`);
const OPEN_RE = new RegExp(`^state\\s+(?:"([^"]+)"\\s+as\\s+)?(${ID})\\s*\\{$`);
const NOTE_RE = new RegExp(
  `^note\\s+(left|right)\\s+of\\s+(${ID})\\s*:\\s*(.+)$`,
);
/** 状態の後ろの `:::{クラス}`（色は `readMermaidStyles` が読む） */
const CLASS_SUFFIX = "(?::::[\\w-]+)?";
const DECLARE_RE = new RegExp(`^(${ID})${CLASS_SUFFIX}$`);
const MOVE_RE = new RegExp(
  `^(\\[\\*\\]|${ID})${CLASS_SUFFIX}\\s*-->\\s*(\\[\\*\\]|${ID})${CLASS_SUFFIX}(?:\\s*:\\s*(.+))?$`,
);
/** 状態の説明（`{ID} : {説明}`） */
const DESCRIPTION_RE = new RegExp(`^(${ID})${CLASS_SUFFIX}\\s*:\\s*(.+)$`);
/** 複数行のノートの開き（`note left of {ID}`） */
const NOTE_OPEN_RE = new RegExp(`^note\\s+(left|right)\\s+of\\s+(${ID})$`);
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

/** 複数行のノートの 1 行を足す。`end note` なら閉じて `undefined` を返却する */
const continueNote = (note: StateNote, raw: string): StateNote | undefined => {
  const text = raw.trim();
  if (text === "end note") return undefined;
  note.text = note.text === "" ? text : `${note.text}\n${text}`;
  return note;
};

/** 閉じの無い入れ子の状態の項目 */
const unclosedComposite = (open: {
  composite: StateComposite;
  line: number;
}): MapProblem => ({
  kind: "map_invalid",
  line: open.line,
  message: `入れ子の状態 \`${open.composite.id}\` の \`{\` に対応する \`}\` がありません。入れ子の状態の最後の行の後に \`}\` を記載してください。`,
});

/** 状態の説明を、状態の名前と入れ子の状態のタイトルにする */
const applyDescriptions = (
  descriptions: Map<string, string>,
  target: { states: Map<string, StateNode>; composites: StateComposite[] },
): void => {
  for (const [id, description] of descriptions) {
    const state = target.states.get(id);
    if (state) state.label = description;
    const composite = target.composites.find((item) => item.id === id);
    if (composite) composite.title = description;
  }
};

/** `stateDiagram-v2`・`stateDiagram` の Mermaid を、状態・入れ子の状態・遷移・注記と読めない行の項目に読む */
export const parseStateDiagram = (source: string): StateDiagram => {
  const states = new Map<string, StateNode>();
  const composites: StateComposite[] = [];
  const transitions: StateTransition[] = [];
  const notes: StateNote[] = [];
  const problems: MapProblem[] = [];
  const stack: Array<{
    composite: StateComposite;
    line: number;
    /** 並行の区切り `--` で作った、今のまとまり */
    region: StateComposite | undefined;
    regions: number;
  }> = [];
  const descriptions = new Map<string, string>();
  /** 読んでいる途中の複数行のノート */
  let openNote: StateNote | undefined;
  let direction: Direction = "TB";
  const scope = () => {
    const top = stack.at(-1);
    return top?.region?.id ?? top?.composite.id;
  };
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
  /** `direction` の行なら、開いた入れ子の状態か図の向きにする */
  const readDirection = (text: string): boolean => {
    const dir = DIRECTION_RE.exec(text);
    if (!dir?.[1]) return false;
    const current = stack.at(-1)?.composite;
    if (current) current.direction = toDirection(dir[1]);
    else direction = toDirection(dir[1]);
    return true;
  };
  /** 状態の名前の行なら、名前を付ける */
  const readAlias = (text: string): boolean => {
    const alias = ALIAS_RE.exec(text);
    if (!alias?.[1] || !alias[2]) return false;
    ensure(alias[2]).label = alias[1];
    return true;
  };
  /** 分岐の行なら、状態を分岐にする */
  const readChoice = (text: string): boolean => {
    const choice = CHOICE_RE.exec(text);
    if (!choice?.[1]) return false;
    ensure(choice[1]).kind = choice[2] === "choice" ? "choice" : "fork";
    return true;
  };
  /** 入れ子の状態を開く行なら、入れ子の状態を足す */
  const readOpen = (text: string, line: number): boolean => {
    const open = OPEN_RE.exec(text);
    if (!open?.[2]) return false;
    const composite: StateComposite = {
      id: open[2],
      title: open[1] ?? open[2],
      parent: scope(),
      direction: undefined,
    };
    composites.push(composite);
    stack.push({ composite, line, region: undefined, regions: 0 });
    return true;
  };
  /** 並行の区切り `--` なら、入れ子の状態の中を名前の無いまとまりに分ける */
  const readRegion = (text: string): boolean => {
    const top = stack.at(-1);
    if (text !== "--" || !top) return false;
    const parent = top.composite.id;
    const addRegion = (): StateComposite => {
      top.regions += 1;
      const region: StateComposite = {
        id: `${parent}__region${top.regions}`,
        title: "",
        parent,
        direction: undefined,
      };
      composites.push(region);
      return region;
    };
    if (top.region === undefined) {
      // 区切りの前の状態と入れ子の状態を、1 つ目のまとまりへ移す
      const first = addRegion();
      for (const state of states.values())
        if (state.parent === parent) state.parent = first.id;
      for (const composite of composites)
        if (composite.parent === parent && composite !== first)
          composite.parent = first.id;
    }
    top.region = addRegion();
    return true;
  };
  /** 状態の説明の行なら、説明を状態の名前にする */
  const readDescription = (text: string): boolean => {
    const found = DESCRIPTION_RE.exec(text);
    if (!found?.[1] || !found[2]) return false;
    ensure(found[1]);
    const before = descriptions.get(found[1]);
    const description = found[2].trim();
    descriptions.set(
      found[1],
      before === undefined ? description : `${before}\n${description}`,
    );
    return true;
  };
  /** 複数行のノートを開く */
  const readNoteOpen = (text: string): boolean => {
    const found = NOTE_OPEN_RE.exec(text);
    if (!found?.[1] || !found[2]) return false;
    openNote = {
      id: `n${notes.length + 1}`,
      of: found[2],
      side: found[1] === "left" ? "left" : "right",
      text: "",
    };
    notes.push(openNote);
    return true;
  };
  /** 注記の行なら、注記を足す */
  const readNote = (text: string): boolean => {
    const note = NOTE_RE.exec(text);
    if (!note?.[1] || !note[2] || !note[3]) return false;
    notes.push({
      id: `n${notes.length + 1}`,
      of: note[2],
      side: note[1] === "left" ? "left" : "right",
      text: note[3].trim(),
    });
    return true;
  };
  /** 遷移の行なら、遷移を足す */
  const readMove = (text: string): boolean => {
    const move = MOVE_RE.exec(text);
    if (!move?.[1] || !move[2]) return false;
    const label = move[3]?.trim();
    transitions.push({
      id: `t${transitions.length + 1}`,
      from: endpoint(move[1], "start"),
      to: endpoint(move[2], "end"),
      label: label === "" ? undefined : label,
    });
    return true;
  };
  /** 状態の宣言の行なら、入れ子の中の状態の宣言は、外で先に出た状態もその入れ子の状態の中へ移す */
  const readDeclare = (text: string): boolean => {
    const declared = DECLARE_RE.exec(text);
    if (!declared?.[1]) return false;
    ensure(declared[1]).parent = scope();
    return true;
  };
  /** 行の読み方（先に当たった読み方で読む。`}` は入れ子の状態を閉じる） */
  const readers: Array<(text: string, line: number, raw: string) => boolean> = [
    readDirection,
    readAlias,
    readChoice,
    readOpen,
    readRegion,
    readNoteOpen,
    (text, line, raw) => {
      if (text !== "}") return false;
      if (!stack.pop()) problems.push(unreadable(line, raw));
      return true;
    },
    readNote,
    readMove,
    readDescription,
    readDeclare,
  ];
  for (const [line, raw] of source.split("\n").entries()) {
    if (openNote) {
      openNote = continueNote(openNote, raw);
      continue;
    }
    const text = raw.replace(/%%.*$/, "").trim();
    if (line === 0 || text === "" || IGNORED_RE.test(text)) continue;
    if (!readers.some((read) => read(text, line, raw)))
      problems.push(unreadable(line, raw));
  }
  problems.push(...stack.map(unclosedComposite));
  const compositeIds = new Set(composites.map((item) => item.id));
  applyDescriptions(descriptions, { states, composites });
  return {
    direction,
    states: [...states.values()].filter((item) => !compositeIds.has(item.id)),
    composites,
    transitions,
    notes,
    styles: readMermaidStyles({
      lines: source.split("\n").slice(1),
      classTarget: "class",
    }),
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
      links: {},
      linkLines: {},
      styles: diagram.styles,
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
    } else if (kind === "fork") {
      shapes[node.id] = kind;
      overrides[node.id] = {
        size: { w: MAP_STATE.forkWidth, h: MAP_STATE.forkHeight },
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
