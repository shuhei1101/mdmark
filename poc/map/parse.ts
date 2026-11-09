/** 図の向き */
export type Direction = "TB" | "LR";

/** ノードの形状 */
export type Shape =
  | "rect"
  | "round"
  | "stadium"
  | "cylinder"
  | "subroutine"
  | "circle"
  | "diamond"
  | "hexagon"
  | "flag";

/** 線の種類 */
export type LineKind = "solid" | "dotted" | "thick";

export type FlowNode = {
  id: string;
  label: string;
  shape: Shape;
  classes: string[];
  /** 親の箱の id（最上位は undefined） */
  parent: string | undefined;
};

export type FlowBox = {
  id: string;
  title: string;
  parent: string | undefined;
  direction: Direction | undefined;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  line: LineKind;
  arrow: boolean;
  label: string | undefined;
};

export type ParseWarning = { line: number; text: string };

export type Flowchart = {
  direction: Direction;
  nodes: FlowNode[];
  boxes: FlowBox[];
  edges: FlowEdge[];
  warnings: ParseWarning[];
};

/** 形状ごとの開きと閉じ。長い開きから順に試す */
const SHAPES: Array<{ open: string; close: string; shape: Shape }> = [
  { open: "([", close: "])", shape: "stadium" },
  { open: "((", close: "))", shape: "circle" },
  { open: "[(", close: ")]", shape: "cylinder" },
  { open: "[[", close: "]]", shape: "subroutine" },
  { open: "{{", close: "}}", shape: "hexagon" },
  { open: "[", close: "]", shape: "rect" },
  { open: "(", close: ")", shape: "round" },
  { open: "{", close: "}", shape: "diamond" },
  { open: ">", close: "]", shape: "flag" },
];

/** 線の書き方。ラベルを矢印の中に書く形を先に試す */
const ARROWS: Array<{ re: RegExp; line: LineKind; arrow: boolean }> = [
  { re: /^--\s+(.+?)\s+-->/, line: "solid", arrow: true },
  { re: /^--\s+(.+?)\s+---/, line: "solid", arrow: false },
  { re: /^-\.\s+(.+?)\s+\.->/, line: "dotted", arrow: true },
  { re: /^==\s+(.+?)\s+==>/, line: "thick", arrow: true },
  { re: /^-->/, line: "solid", arrow: true },
  { re: /^---/, line: "solid", arrow: false },
  { re: /^-\.->/, line: "dotted", arrow: true },
  { re: /^-\.-/, line: "dotted", arrow: false },
  { re: /^==>/, line: "thick", arrow: true },
  { re: /^===/, line: "thick", arrow: false },
];

const ID_RE = /^[A-Za-z0-9_\u0080-￿]+/;
const EDGE_ID_RE = /^([A-Za-z0-9_]+)@(?=[-=])/;
/** 読むだけで図に使わない行 */
const IGNORED_RE = /^(classDef|style|linkStyle|click|accTitle|accDescr)\b/;

type Cursor = { text: string; pos: number };

const skipSpace = (cursor: Cursor): void => {
  while (cursor.pos < cursor.text.length && /\s/.test(cursor.text[cursor.pos] ?? "")) {
    cursor.pos += 1;
  }
};

const rest = (cursor: Cursor): string => cursor.text.slice(cursor.pos);

/** 形状の中の文字を取り出す（引用符で囲んだ文字は閉じの記号を含んでよい） */
const readShape = (cursor: Cursor): { label: string; shape: Shape } | undefined => {
  const tail = rest(cursor);
  for (const { open, close, shape } of SHAPES) {
    if (!tail.startsWith(open)) {
      continue;
    }
    let body = tail.slice(open.length);
    let consumed = open.length;
    let label: string;
    if (body.startsWith('"')) {
      const end = body.indexOf('"', 1);
      if (end < 0) {
        return undefined;
      }
      label = body.slice(1, end);
      body = body.slice(end + 1);
      consumed += end + 1;
      if (!body.startsWith(close)) {
        return undefined;
      }
    } else {
      const end = body.indexOf(close);
      if (end < 0) {
        return undefined;
      }
      label = body.slice(0, end);
      consumed += end;
    }
    cursor.pos += consumed + close.length;
    return { label: label.replace(/<br\s*\/?>/g, "\n"), shape };
  }
  return undefined;
};

type NodeRef = { id: string; label?: string; shape?: Shape; classes: string[] };

const readNode = (cursor: Cursor): NodeRef | undefined => {
  skipSpace(cursor);
  const match = ID_RE.exec(rest(cursor));
  if (!match) {
    return undefined;
  }
  // 線の ID（`e1@-->`）はノードではない
  if (EDGE_ID_RE.test(rest(cursor))) {
    return undefined;
  }
  cursor.pos += match[0].length;
  const ref: NodeRef = { id: match[0], classes: [] };
  const shape = readShape(cursor);
  if (shape) {
    ref.label = shape.label;
    ref.shape = shape.shape;
  }
  const cls = /^:::([A-Za-z0-9_-]+)/.exec(rest(cursor));
  if (cls?.[1]) {
    ref.classes.push(cls[1]);
    cursor.pos += cls[0].length;
  }
  return ref;
};

const readGroup = (cursor: Cursor): NodeRef[] | undefined => {
  const group: NodeRef[] = [];
  for (;;) {
    const node = readNode(cursor);
    if (!node) {
      return undefined;
    }
    group.push(node);
    skipSpace(cursor);
    if (!rest(cursor).startsWith("&")) {
      return group;
    }
    cursor.pos += 1;
  }
};

type Arrow = { id: string | undefined; line: LineKind; arrow: boolean; label: string | undefined };

const readArrow = (cursor: Cursor): Arrow | undefined => {
  skipSpace(cursor);
  let id: string | undefined;
  const idMatch = EDGE_ID_RE.exec(rest(cursor));
  if (idMatch) {
    id = idMatch[1];
    cursor.pos += idMatch[0].length;
  }
  for (const { re, line, arrow } of ARROWS) {
    const match = re.exec(rest(cursor));
    if (!match) {
      continue;
    }
    cursor.pos += match[0].length;
    let label = match[1];
    const pipe = /^\|([^|]*)\|/.exec(rest(cursor));
    if (pipe) {
      label = pipe[1];
      cursor.pos += pipe[0].length;
    }
    return { id, line, arrow, label: label?.replace(/^"|"$/g, "") };
  }
  return undefined;
};

/** 1 行の文（ノードの定義か、連ねた線）を読む。読めないときは undefined */
const readStatement = (
  text: string,
): { groups: NodeRef[][]; arrows: Arrow[] } | undefined => {
  const cursor: Cursor = { text, pos: 0 };
  const first = readGroup(cursor);
  if (!first) {
    return undefined;
  }
  const groups = [first];
  const arrows: Arrow[] = [];
  for (;;) {
    skipSpace(cursor);
    if (cursor.pos >= text.length) {
      return { groups, arrows };
    }
    const arrow = readArrow(cursor);
    if (!arrow) {
      return undefined;
    }
    const next = readGroup(cursor);
    if (!next) {
      return undefined;
    }
    arrows.push(arrow);
    groups.push(next);
  }
};

const toDirection = (value: string): Direction | undefined => {
  if (value === "TB" || value === "TD" || value === "BT") {
    return "TB";
  }
  if (value === "LR" || value === "RL") {
    return "LR";
  }
  return undefined;
};

/** `flowchart` の Mermaid を、ノード・箱・線に読む。読めない行は書き方の警告にして飛ばす */
export const parseFlowchart = (source: string): Flowchart => {
  const lines = source.split("\n");
  const header = /^\s*(flowchart|graph)\s+(\w+)/.exec(lines[0] ?? "");
  const direction = toDirection(header?.[2] ?? "TB") ?? "TB";
  const nodes = new Map<string, FlowNode>();
  const boxes: FlowBox[] = [];
  const edges: FlowEdge[] = [];
  const warnings: ParseWarning[] = [];
  const stack: FlowBox[] = [];
  const boxIds = new Set<string>();

  const touch = (ref: NodeRef): void => {
    if (boxIds.has(ref.id)) {
      return;
    }
    const parent = stack.at(-1)?.id;
    const existing = nodes.get(ref.id);
    if (existing) {
      if (ref.label !== undefined) {
        existing.label = ref.label;
        existing.shape = ref.shape ?? existing.shape;
        // 定義した行の箱に置く
        existing.parent = parent;
      }
      existing.classes.push(...ref.classes);
      return;
    }
    nodes.set(ref.id, {
      id: ref.id,
      label: ref.label ?? ref.id,
      shape: ref.shape ?? "rect",
      classes: [...ref.classes],
      parent,
    });
  };

  lines.slice(1).forEach((raw, index) => {
    const lineNo = index + 2;
    const text = raw.replace(/%%.*$/, "").trim().replace(/;$/, "");
    if (text === "") {
      return;
    }
    const subgraph = /^subgraph\s+([^\s[]+)\s*(?:\[\s*"?([^"\]]*)"?\s*\])?\s*$/.exec(text);
    if (subgraph?.[1]) {
      const box: FlowBox = {
        id: subgraph[1],
        title: subgraph[2] ?? subgraph[1],
        parent: stack.at(-1)?.id,
        direction: undefined,
      };
      boxes.push(box);
      boxIds.add(box.id);
      stack.push(box);
      return;
    }
    if (text === "end") {
      if (!stack.pop()) {
        warnings.push({ line: lineNo, text: raw });
      }
      return;
    }
    const dir = /^direction\s+(\w+)$/.exec(text);
    if (dir?.[1]) {
      const current = stack.at(-1);
      const value = toDirection(dir[1]);
      if (current && value) {
        current.direction = value;
      } else {
        warnings.push({ line: lineNo, text: raw });
      }
      return;
    }
    const classLine = /^class\s+([\w,\s]+?)\s+([\w-]+)$/.exec(text);
    if (classLine?.[1] && classLine[2]) {
      for (const id of classLine[1].split(",").map((part) => part.trim())) {
        nodes.get(id)?.classes.push(classLine[2]);
      }
      return;
    }
    if (IGNORED_RE.test(text)) {
      return;
    }
    const statement = readStatement(text);
    if (!statement) {
      warnings.push({ line: lineNo, text: raw });
      return;
    }
    statement.groups.forEach((group) => {
      group.forEach(touch);
    });
    statement.arrows.forEach((arrow, at) => {
      for (const from of statement.groups[at] ?? []) {
        for (const to of statement.groups[at + 1] ?? []) {
          edges.push({
            id: arrow.id ?? `L${edges.length}`,
            from: from.id,
            to: to.id,
            line: arrow.line,
            arrow: arrow.arrow,
            label: arrow.label,
          });
        }
      }
    });
  });
  return { direction, nodes: [...nodes.values()], boxes, edges, warnings };
};

export type SequenceMessage = { from: string; to: string; text: string; reply: boolean; loop: number | undefined };

export type Sequence = {
  participants: Array<{ id: string; label: string; actor: boolean }>;
  messages: SequenceMessage[];
  loops: Array<{ id: number; label: string }>;
  warnings: ParseWarning[];
};

const MESSAGE_RE = /^([\w\u0080-￿]+)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-]?)([\w\u0080-￿]+)\s*:\s*(.*)$/;

/** `sequenceDiagram` の Mermaid を、相手・メッセージ・繰り返しに読む */
export const parseSequence = (source: string): Sequence => {
  const participants = new Map<string, { id: string; label: string; actor: boolean }>();
  const messages: SequenceMessage[] = [];
  const loops: Array<{ id: number; label: string }> = [];
  const warnings: ParseWarning[] = [];
  const blocks: Array<number | undefined> = [];
  const ensure = (id: string): void => {
    if (!participants.has(id)) {
      participants.set(id, { id, label: id, actor: false });
    }
  };
  source
    .split("\n")
    .slice(1)
    .forEach((raw, index) => {
      const text = raw.replace(/%%.*$/, "").trim();
      if (text === "") {
        return;
      }
      const decl = /^(participant|actor)\s+([\w\u0080-￿]+)(?:\s+as\s+(.+))?$/.exec(text);
      if (decl?.[1] && decl[2]) {
        participants.set(decl[2], { id: decl[2], label: decl[3] ?? decl[2], actor: decl[1] === "actor" });
        return;
      }
      const loop = /^loop\s*(.*)$/.exec(text);
      if (loop) {
        const id = loops.length;
        loops.push({ id, label: loop[1] ?? "" });
        blocks.push(id);
        return;
      }
      if (/^(alt|opt|par|critical|break|rect)\b/.test(text)) {
        blocks.push(undefined);
        return;
      }
      if (/^(else|and)\b/.test(text) || /^(autonumber|activate|deactivate|Note)\b/.test(text)) {
        return;
      }
      if (text === "end") {
        if (blocks.length === 0) {
          warnings.push({ line: index + 2, text: raw });
        }
        blocks.pop();
        return;
      }
      const message = MESSAGE_RE.exec(text);
      if (message?.[1] && message[2] && message[4]) {
        ensure(message[1]);
        ensure(message[4]);
        const loopId = [...blocks].reverse().find((block) => block !== undefined);
        messages.push({
          from: message[1],
          to: message[4],
          text: message[5] ?? "",
          reply: message[2].startsWith("--"),
          loop: loopId,
        });
        return;
      }
      warnings.push({ line: index + 2, text: raw });
    });
  return { participants: [...participants.values()], messages, loops, warnings };
};
