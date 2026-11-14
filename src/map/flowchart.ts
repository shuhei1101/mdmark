import { isAllowedUrl } from "../render/sanitize.ts";
import type { MapProblem } from "./spec.ts";

/** グループとノードを並べる向き */
export type Direction = "TB" | "LR";

/** Mermaid のノードの形状 */
export type FlowShape =
  | "rect"
  | "round"
  | "stadium"
  | "circle"
  | "cylinder"
  | "rhombus"
  | "hexagon"
  | "subroutine"
  | "flag";

/** Mermaid の矢印の種類（設定の map.lines のキー） */
export type FlowArrow = "-->" | "-.->" | "==>" | "---";

export type FlowNode = {
  id: string;
  label: string;
  shape: FlowShape;
  classes: string[];
  /** 親のグループの ID（最上位は undefined） */
  parent: string | undefined;
};

export type FlowGroup = {
  id: string;
  title: string;
  parent: string | undefined;
  direction: Direction | undefined;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  arrow: FlowArrow;
  /** 両向きの矢印（`<-->`）か */
  both: boolean;
  label: string | undefined;
};

/** parseFlowchart の戻り値 */
export type Flowchart = {
  direction: Direction;
  nodes: FlowNode[];
  groups: FlowGroup[];
  edges: FlowEdge[];
  /** `click {ID} "{リンク先}"` のノードの ID からリンク先（記載したまま） */
  links: Record<string, string>;
  problems: MapProblem[];
};

/** 名前で指す文字の参照 */
const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
};

/** Mermaid の文字の参照（`#quot;` などの名前と `#{10 進の番号};`）を文字に戻す。ほかの `#` はそのまま残す */
export const decodeEntities = (text: string): string =>
  text.replace(/#([a-z]+|\d+);/g, (whole, name: string) => {
    if (/^\d+$/.test(name)) {
      const code = Number(name);
      return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[name] ?? whole;
  });

/** 許さないノードのリンク先の書き方の警告の本文 */
const LINK_NOT_ALLOWED =
  "ノードのリンク先に使用できないものがあります。使用できるリンク先は http・https・mailto と相対パスです。このノードはリンクにせずに描いています。";

/** ノードのリンク先を確かめ、許すものの対応と、許さないリンク先の項目を返却する */
export const mapLinkProblems = (
  links: Record<string, string>,
): { allowed: Record<string, string>; problems: MapProblem[] } => {
  const allowed: Record<string, string> = {};
  const problems: MapProblem[] = [];
  for (const [id, href] of Object.entries(links)) {
    if (isAllowedUrl(href)) {
      allowed[id] = href;
      continue;
    }
    problems.push({
      kind: "map_invalid_value",
      message: `${LINK_NOT_ALLOWED} ${id}: ${href}`,
    });
  }
  return { allowed, problems };
};

/** 形状ごとの開きと閉じ。長い開きから順に試す */
const SHAPES: Array<{ open: string; close: string; shape: FlowShape }> = [
  { open: "([", close: "])", shape: "stadium" },
  { open: "((", close: "))", shape: "circle" },
  { open: "[(", close: ")]", shape: "cylinder" },
  { open: "[[", close: "]]", shape: "subroutine" },
  { open: "{{", close: "}}", shape: "hexagon" },
  { open: "[", close: "]", shape: "rect" },
  { open: "(", close: ")", shape: "round" },
  { open: "{", close: "}", shape: "rhombus" },
  { open: ">", close: "]", shape: "flag" },
];

/** 線の書き方。ラベルを矢印の中に記載する書き方を先に試す */
const ARROWS: Array<{ re: RegExp; arrow: FlowArrow; both?: boolean }> = [
  { re: /^<-->/, arrow: "-->", both: true },
  { re: /^<-\.->/, arrow: "-.->", both: true },
  { re: /^<==>/, arrow: "==>", both: true },
  { re: /^--\s+(.+?)\s+-->/, arrow: "-->" },
  { re: /^--\s+(.+?)\s+---/, arrow: "---" },
  { re: /^-\.\s+(.+?)\s+\.->/, arrow: "-.->" },
  { re: /^==\s+(.+?)\s+==>/, arrow: "==>" },
  { re: /^-->/, arrow: "-->" },
  { re: /^---/, arrow: "---" },
  { re: /^-\.->/, arrow: "-.->" },
  { re: /^-\.-/, arrow: "-.->" },
  { re: /^==>/, arrow: "==>" },
  { re: /^===/, arrow: "---" },
];

const ID_RE = /^[A-Za-z0-9_\u0080-￿]+/;
const EDGE_ID_RE = /^([A-Za-z0-9_]+)@(?=[-=<])/;
/** 読んで捨てる行 */
const IGNORED_RE = /^(classDef|style|linkStyle|click|accTitle|accDescr)\b/;
/** `click {ID} "{リンク先}"`・`click {ID} href "{リンク先}"`（後ろのツールチップと `_blank` などは読まない） */
const CLICK_RE = /^click\s+([^\s]+)\s+(?:href\s+)?"([^"]*)"/;

type Cursor = { text: string; pos: number };

const skipSpace = (cursor: Cursor): void => {
  while (
    cursor.pos < cursor.text.length &&
    /\s/.test(cursor.text[cursor.pos] ?? "")
  ) {
    cursor.pos += 1;
  }
};

const rest = (cursor: Cursor): string => cursor.text.slice(cursor.pos);

/** 形状の中の文字を取り出す（引用符で囲んだ文字は閉じの記号を含んでよい） */
const readShape = (
  cursor: Cursor,
): { label: string; shape: FlowShape } | undefined => {
  const tail = rest(cursor);
  for (const { open, close, shape } of SHAPES) {
    if (!tail.startsWith(open)) continue;
    let body = tail.slice(open.length);
    let consumed = open.length;
    let label: string;
    if (body.startsWith('"')) {
      const end = body.indexOf('"', 1);
      if (end < 0) return undefined;
      label = body.slice(1, end);
      body = body.slice(end + 1);
      consumed += end + 1;
      if (!body.startsWith(close)) return undefined;
    } else {
      const end = body.indexOf(close);
      if (end < 0) return undefined;
      label = body.slice(0, end);
      consumed += end;
    }
    cursor.pos += consumed + close.length;
    return {
      label: decodeEntities(label.replace(/<br\s*\/?>/g, "\n")),
      shape,
    };
  }
  return undefined;
};

type NodeRef = {
  id: string;
  label?: string;
  shape?: FlowShape;
  classes: string[];
};

const readNode = (cursor: Cursor): NodeRef | undefined => {
  skipSpace(cursor);
  const match = ID_RE.exec(rest(cursor));
  if (!match || EDGE_ID_RE.test(rest(cursor))) return undefined;
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
    if (!node) return undefined;
    group.push(node);
    skipSpace(cursor);
    if (!rest(cursor).startsWith("&")) return group;
    cursor.pos += 1;
  }
};

type Arrow = {
  id: string | undefined;
  arrow: FlowArrow;
  both: boolean;
  label: string | undefined;
};

const readArrow = (cursor: Cursor): Arrow | undefined => {
  skipSpace(cursor);
  let id: string | undefined;
  const idMatch = EDGE_ID_RE.exec(rest(cursor));
  if (idMatch) {
    id = idMatch[1];
    cursor.pos += idMatch[0].length;
  }
  for (const { re, arrow, both = false } of ARROWS) {
    const match = re.exec(rest(cursor));
    if (!match) continue;
    cursor.pos += match[0].length;
    let label = match[1];
    const pipe = /^\|([^|]*)\|/.exec(rest(cursor));
    if (pipe) {
      label = pipe[1];
      cursor.pos += pipe[0].length;
    }
    return {
      id,
      arrow,
      both,
      label:
        label === undefined
          ? undefined
          : decodeEntities(label.replace(/^"|"$/g, "")),
    };
  }
  return undefined;
};

/** 1 行の文（ノードの定義か、連ねた線）を読む。読めないときは undefined */
const readStatement = (
  text: string,
): { groups: NodeRef[][]; arrows: Arrow[] } | undefined => {
  const cursor: Cursor = { text, pos: 0 };
  const first = readGroup(cursor);
  if (!first) return undefined;
  const groups = [first];
  const arrows: Arrow[] = [];
  for (;;) {
    skipSpace(cursor);
    if (cursor.pos >= text.length) return { groups, arrows };
    const arrow = readArrow(cursor);
    if (!arrow) return undefined;
    const next = readGroup(cursor);
    if (!next) return undefined;
    arrows.push(arrow);
    groups.push(next);
  }
};

const toDirection = (value: string): Direction | undefined => {
  if (value === "TB" || value === "TD" || value === "BT") return "TB";
  if (value === "LR" || value === "RL") return "LR";
  return undefined;
};

/** 読めない行の項目。よくある書き間違いには直し方を添える */
const unreadable = (line: number, raw: string): MapProblem => {
  const text = raw.trim();
  const hint = /(^|[^-<])->(?!>)/.test(text)
    ? "矢印は `-->` で記載してください。"
    : "Mermaid の flowchart の記法で記載してください。";
  return {
    kind: "map_invalid",
    line,
    message: `${line + 1} 行目 \`${text}\` を読めません。${hint}`,
  };
};

/** `flowchart` の Mermaid を、ノード・グループ・線と、読めない行の項目に読む */
export const parseFlowchart = (source: string): Flowchart => {
  const lines = source.split("\n");
  const header = /^\s*(flowchart|graph)\s+(\w+)/.exec(lines[0] ?? "");
  const direction = toDirection(header?.[2] ?? "TB") ?? "TB";
  const nodes = new Map<string, FlowNode>();
  const groups: FlowGroup[] = [];
  const edges: FlowEdge[] = [];
  const links: Record<string, string> = {};
  const problems: MapProblem[] = [];
  const stack: FlowGroup[] = [];
  const groupIds = new Set<string>();
  const edgeIds = new Map<string, number>();

  const touch = (ref: NodeRef): void => {
    if (groupIds.has(ref.id)) return;
    const parent = stack.at(-1)?.id;
    const existing = nodes.get(ref.id);
    if (existing) {
      if (ref.label !== undefined) {
        existing.label = ref.label;
        existing.shape = ref.shape ?? existing.shape;
        existing.parent = parent;
      }
      existing.classes.push(
        ...ref.classes.filter((name) => !existing.classes.includes(name)),
      );
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

  /** ID の無い線は `{from}->{to}`、重なれば末尾に `#{番号}` */
  const edgeId = (id: string | undefined, from: string, to: string): string => {
    if (id !== undefined) return id;
    const base = `${from}->${to}`;
    const count = (edgeIds.get(base) ?? 0) + 1;
    edgeIds.set(base, count);
    return count === 1 ? base : `${base}#${count}`;
  };

  lines.slice(1).forEach((raw, index) => {
    const line = index + 1;
    const text = raw.replace(/%%.*$/, "").trim().replace(/;$/, "");
    if (text === "") return;
    const subgraph =
      /^subgraph\s+([^\s[]+)\s*(?:\[\s*"?([^"\]]*)"?\s*\])?\s*$/.exec(text);
    if (subgraph?.[1]) {
      const group: FlowGroup = {
        id: subgraph[1],
        title: decodeEntities(subgraph[2] ?? subgraph[1]),
        parent: stack.at(-1)?.id,
        direction: undefined,
      };
      groups.push(group);
      groupIds.add(group.id);
      stack.push(group);
      return;
    }
    if (text === "end") {
      if (!stack.pop())
        problems.push({
          kind: "map_invalid",
          line,
          message: `${line + 1} 行目の \`end\` に対応する \`subgraph\` がありません。`,
        });
      return;
    }
    const dir = /^direction\s+(\w+)$/.exec(text);
    if (dir?.[1]) {
      const current = stack.at(-1);
      const value = toDirection(dir[1]);
      if (current && value) current.direction = value;
      else problems.push(unreadable(line, raw));
      return;
    }
    const classLine = /^class\s+([\w,\s]+?)\s+([\w-]+)$/.exec(text);
    if (classLine?.[1] && classLine[2]) {
      for (const id of classLine[1].split(",").map((part) => part.trim()))
        nodes.get(id)?.classes.push(classLine[2]);
      return;
    }
    const click = CLICK_RE.exec(text);
    if (click?.[1] && click[2] !== undefined) {
      links[click[1]] = click[2];
      return;
    }
    if (IGNORED_RE.test(text)) return;
    const statement = readStatement(text);
    if (!statement) {
      problems.push(unreadable(line, raw));
      return;
    }
    for (const group of statement.groups) group.forEach(touch);
    statement.arrows.forEach((arrow, at) => {
      for (const from of statement.groups[at] ?? []) {
        for (const to of statement.groups[at + 1] ?? []) {
          edges.push({
            id: edgeId(arrow.id, from.id, to.id),
            from: from.id,
            to: to.id,
            arrow: arrow.arrow,
            both: arrow.both,
            label: arrow.label,
          });
        }
      }
    });
  });
  for (const group of stack) {
    problems.push({
      kind: "map_invalid",
      message: `\`subgraph ${group.id}\` に閉じの \`end\` がありません。最後の行で閉じたものとして描いています。`,
    });
  }
  return {
    direction,
    nodes: [...nodes.values()],
    groups,
    edges,
    links,
    problems,
  };
};
