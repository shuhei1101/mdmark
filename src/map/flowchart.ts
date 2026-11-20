import {
  isAllowedUrl,
  type ResolveIdLink,
  resolveIdHref,
} from "../render/sanitize.ts";
import { type MermaidStyles, readMermaidStyles } from "./mermaid-style.ts";
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
  | "flag"
  | "lean-right"
  | "lean-left"
  | "trapezoid"
  | "trapezoid-alt"
  | "double-circle"
  | "doc";

/** 線の端に付ける印 */
export type FlowEnd = "circle" | "cross";

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
  /** 端に付ける丸・×（`--o`・`x--x` など。無い端は持たない） */
  ends?: { from?: FlowEnd; to?: FlowEnd };
  /** 見えない線（`~~~`）。段と並びを決めるのに使用し、描かない */
  invisible?: true;
  /** 記号の数で指定した線の長さ（2 以上のときだけ持つ） */
  length?: number;
};

/** parseFlowchart の戻り値 */
export type Flowchart = {
  direction: Direction;
  nodes: FlowNode[];
  groups: FlowGroup[];
  edges: FlowEdge[];
  /** `click {ID} "{リンク先}"` のノードの ID からリンク先（記載したまま） */
  links: Record<string, string>;
  /** `click` の行のノードの ID から、ソースの行（0 から） */
  linkLines: Record<string, number>;
  /** `readMermaidStyles` が読み取ったノードと線の色（flowchart の読み取りだけが持つ） */
  styles?: MermaidStyles;
  /** `{ID}@{ view: collapsed }` で閉じて始めるグループの ID（flowchart の読み取りだけが持つ） */
  collapsed?: string[];
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

/** 点検の許可しないリンク先の項目の文（点検は `id:` のリンク先もずれにしない） */
const LINK_NOT_ALLOWED_CHECK =
  "ノードのリンク先に使用できないものがあります。使用できるリンク先は http・https・mailto・相対パスと `id:` です。このノードはリンクにせずに描いています。";

/** `id:` で始まるノードのリンク先の扱い（描くときは利用側の関数で URL に変え、点検は確かめない） */
export type MapIdLinks =
  | { mode: "resolve"; resolveIdLink: ResolveIdLink | undefined }
  | { mode: "skip" };

/** ノードのリンク先を確かめ、許可するものの対応と、許可しないリンク先の項目を返却する */
export const mapLinkProblems = (options: {
  links: Record<string, string>;
  idLinks: MapIdLinks;
  /** `click` の行のノードの ID から、ソースの行（指定すれば項目に行を持たせる） */
  lines?: Record<string, number> | undefined;
}): { allowed: Record<string, string>; problems: MapProblem[] } => {
  const { links, idLinks, lines } = options;
  const notAllowed =
    idLinks.mode === "skip" ? LINK_NOT_ALLOWED_CHECK : LINK_NOT_ALLOWED;
  const allowed: Record<string, string> = {};
  const problems: MapProblem[] = [];
  for (const [id, href] of Object.entries(links)) {
    let url: string | undefined;
    if (!href.startsWith("id:")) url = isAllowedUrl(href) ? href : undefined;
    else if (idLinks.mode === "skip") continue;
    else url = resolveIdHref({ href, resolveIdLink: idLinks.resolveIdLink });
    if (url !== undefined) {
      allowed[id] = url;
      continue;
    }
    problems.push({
      kind: "map_invalid_value",
      line: lines?.[id],
      message: `${notAllowed} ${id}: ${href}`,
    });
  }
  return { allowed, problems };
};

/** 形状ごとの開きと閉じ。長い開きから順に試す */
const SHAPES: Array<{ open: string; close: string; shape: FlowShape }> = [
  { open: "(((", close: ")))", shape: "double-circle" },
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

/** `{ID}@{ shape: … }` の形状の名前と別名（mermaid の名前）から形状 */
const FLOW_SHAPE_NAMES: Record<string, FlowShape> = {
  rect: "rect",
  rectangle: "rect",
  proc: "rect",
  process: "rect",
  rounded: "round",
  event: "round",
  stadium: "stadium",
  pill: "stadium",
  terminal: "stadium",
  subroutine: "subroutine",
  subproc: "subroutine",
  "fr-rect": "subroutine",
  framed: "subroutine",
  cyl: "cylinder",
  cylinder: "cylinder",
  database: "cylinder",
  db: "cylinder",
  circle: "circle",
  circ: "circle",
  odd: "flag",
  diamond: "rhombus",
  diam: "rhombus",
  decision: "rhombus",
  question: "rhombus",
  hex: "hexagon",
  hexagon: "hexagon",
  prepare: "hexagon",
  "lean-r": "lean-right",
  "lean-right": "lean-right",
  "in-out": "lean-right",
  "lean-l": "lean-left",
  "lean-left": "lean-left",
  "out-in": "lean-left",
  "trap-b": "trapezoid",
  trapezoid: "trapezoid",
  priority: "trapezoid",
  "trap-t": "trapezoid-alt",
  "inv-trapezoid": "trapezoid-alt",
  manual: "trapezoid-alt",
  "dbl-circ": "double-circle",
  "double-circle": "double-circle",
  doc: "doc",
  document: "doc",
};

/** 線の属性の行（`{ID}@{ animate: … }` など）だけが持つキー */
const EDGE_ATTRIBUTE_KEYS = ["animate", "animation", "curve"];

/** `@{ key: value, … }` の中身をキーと値にする（引用符の中の `,` は区切りにしない） */
const readAttributes = (body: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const part of body.match(/(?:[^,"]|"[^"]*")+/g) ?? []) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const key = part.slice(0, at).trim();
    const value = part
      .slice(at + 1)
      .trim()
      .replace(/^"(.*)"$/s, "$1");
    if (key !== "") out[key] = value;
  }
  return out;
};

/** Markdown の文字（`"`…`"` の中身）から、強調の記号と囲みのバッククォートを除いた文字 */
export const plainMarkdownLabel = (label: string): string => {
  const inner = /^`([\s\S]*)`$/.exec(label);
  if (!inner) return label;
  return (inner[1] ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/(^|\s)_(.+?)_(?=\s|$)/g, "$1$2");
};

/** 次の行へ続く Markdown の文字（`"` の後に開き、閉じの `` `" `` が同じ行に無い）を、閉じの行までつないだ 1 行にする。つないだ後の行は空にし、行の番号を保つ */
export const joinMarkdownStrings = (lines: string[]): string[] => {
  const out = [...lines];
  for (let index = 0; index < out.length; index++) {
    let text = out[index] ?? "";
    let next = index + 1;
    while (isMarkdownStringOpen(text) && next < out.length) {
      text = `${text}\n${out[next] ?? ""}`;
      out[next] = "";
      next += 1;
    }
    out[index] = text;
    index = next - 1;
  }
  return out;
};

/** 行の最後の Markdown の文字の開き（`"` とバッククォート）が閉じていないか */
const isMarkdownStringOpen = (text: string): boolean => {
  const open = text.lastIndexOf('"`');
  return open >= 0 && text.indexOf('`"', open + 2) < 0;
};

const ID_RE = /^[A-Za-z0-9_\u0080-￿]+/;
const EDGE_ID_RE = /^([A-Za-z0-9_]+)@(?=[-=<ox~])/;
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

/** 名前の `<br>` を改行にし、Markdown の記号と文字の参照を戻す */
const nodeLabel = (label: string): string =>
  decodeEntities(plainMarkdownLabel(label).replace(/<br\s*\/?>/g, "\n"));

/** `{ID}@{ shape: …, label: … }` の形状と名前 */
const readAttributeShape = (
  body: string,
): { label: string; shape: FlowShape } => {
  const values = readAttributes(body);
  const pictured = values.icon !== undefined || values.img !== undefined;
  return {
    label: nodeLabel(values.label ?? ""),
    shape: pictured ? "rect" : (FLOW_SHAPE_NAMES[values.shape ?? ""] ?? "rect"),
  };
};

/** 開きの後ろの名前と、閉じまでの文字数（引用符で囲んだ名前は閉じの記号を含んでよい） */
const bracketLabel = (
  body: string,
  close: string,
): { label: string; length: number } | undefined => {
  if (body.startsWith('"')) {
    const end = body.indexOf('"', 1);
    if (end < 0 || !body.startsWith(close, end + 1)) return undefined;
    return { label: body.slice(1, end), length: end + 1 + close.length };
  }
  const end = body.indexOf(close);
  return end < 0
    ? undefined
    : { label: body.slice(0, end), length: end + close.length };
};

/** 形状の中の文字を取り出す（引用符で囲んだ文字は閉じの記号を含んでよい） */
const readShape = (
  cursor: Cursor,
): { label: string; shape: FlowShape } | undefined => {
  const tail = rest(cursor);
  const slanted = readSlanted(tail);
  if (slanted) {
    cursor.pos += slanted.consumed;
    return { label: slanted.label, shape: slanted.shape };
  }
  const attributes = /^@\{([^}]*)\}/.exec(tail);
  if (attributes) {
    cursor.pos += attributes[0].length;
    return readAttributeShape(attributes[1] ?? "");
  }
  const found = SHAPES.find(({ open }) => tail.startsWith(open));
  if (!found) return undefined;
  const label = bracketLabel(tail.slice(found.open.length), found.close);
  if (!label) return undefined;
  cursor.pos += found.open.length + label.length;
  return { label: nodeLabel(label.label), shape: found.shape };
};

/** `[/ /]`・`[\ \]`・`[/ \]`・`[\ /]` の斜めの辺を持つ形状 */
const readSlanted = (
  tail: string,
): { label: string; shape: FlowShape; consumed: number } | undefined => {
  const match = /^\[([/\\])([^\]]*?)([/\\])\]/.exec(tail);
  if (!match?.[1] || !match[3]) return undefined;
  const key = `${match[1]}${match[3]}`;
  const shape: FlowShape =
    key === "//"
      ? "lean-right"
      : key === "\\\\"
        ? "lean-left"
        : key === "/\\"
          ? "trapezoid"
          : "trapezoid-alt";
  const label = (match[2] ?? "").replace(/^"(.*)"$/s, "$1");
  return {
    label: decodeEntities(label.replace(/<br\s*\/?>/g, "\n")),
    shape,
    consumed: match[0].length,
  };
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
  ends: { from?: FlowEnd; to?: FlowEnd };
  invisible: boolean;
  length: number;
};

/** 線の記号（端の印・線・頭）。`~~~` は見えない線 */
const LINK_RE = /^([<ox])?(-{2,}|={2,}|-\.+-?|~{3,})([>ox])?/;
/** ラベルを線の中に記載する書き方（`-- 文 -->`・`-. 文 .->`・`== 文 ==>`） */
const LABELED_LINK_RE =
  /^([<ox])?(--|==|-\.)\s+(.+?)\s+(-{2,}|={2,}|\.+-)([>ox])?(?=\s|$|[A-Za-z0-9_\u0080-￿])/;
const END_OF: Record<string, FlowEnd> = { o: "circle", x: "cross" };

/** 線の端の丸・× */
const endsOf = (
  start: string | undefined,
  head: string | undefined,
): { from?: FlowEnd; to?: FlowEnd } => {
  const from = start ? END_OF[start] : undefined;
  const to = head ? END_OF[head] : undefined;
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
};

/** 実線と太線の、線の種類と記号の数から数えた長さ */
const solidLink = (
  body: string,
  head: string | undefined,
): { arrow: FlowArrow; length: number } => {
  const headed = head !== undefined;
  const length = Math.max(1, body.length - (headed ? 1 : 2));
  if (body.startsWith("=")) return { arrow: headed ? "==>" : "---", length };
  return { arrow: head === ">" ? "-->" : "---", length };
};

/** 線の記号から、線の種類・長さ・端を求める */
const linkOf = (options: {
  start: string | undefined;
  body: string;
  head: string | undefined;
}): Omit<Arrow, "id" | "label"> => {
  const { start, body, head } = options;
  if (body.startsWith("~"))
    return {
      arrow: "---",
      both: false,
      ends: {},
      invisible: true,
      length: Math.max(1, body.length - 2),
    };
  const common = {
    both: start === "<" && head === ">",
    ends: endsOf(start, head),
    invisible: false,
  };
  if (body.includes("."))
    return {
      ...common,
      arrow: "-.->",
      length: Math.max(1, body.split(".").length - 1),
    };
  return { ...common, ...solidLink(body, head) };
};

/** 線の記号（ラベルを中に記載する書き方を先に試す）を読み、線と線の中のラベルを返却する */
const readLink = (
  cursor: Cursor,
):
  | { link: Omit<Arrow, "id" | "label">; label: string | undefined }
  | undefined => {
  const labeled = LABELED_LINK_RE.exec(rest(cursor));
  if (labeled) {
    cursor.pos += labeled[0].length;
    const close = labeled[4] ?? "";
    return {
      label: labeled[3],
      link: linkOf({
        start: labeled[1],
        body: labeled[2] === "-." ? `-${close}` : close,
        head: labeled[5],
      }),
    };
  }
  const plain = LINK_RE.exec(rest(cursor));
  if (!plain) return undefined;
  cursor.pos += plain[0].length;
  return {
    label: undefined,
    link: linkOf({ start: plain[1], body: plain[2] ?? "", head: plain[3] }),
  };
};

const readArrow = (cursor: Cursor): Arrow | undefined => {
  skipSpace(cursor);
  const idMatch = EDGE_ID_RE.exec(rest(cursor));
  if (idMatch) cursor.pos += idMatch[0].length;
  const read = readLink(cursor);
  if (!read) return undefined;
  const pipe = /^\|([^|]*)\|/.exec(rest(cursor));
  if (pipe) cursor.pos += pipe[0].length;
  const label = pipe ? pipe[1] : read.label;
  return {
    id: idMatch?.[1],
    ...read.link,
    label:
      label === undefined
        ? undefined
        : decodeEntities(plainMarkdownLabel(label.replace(/^"|"$/g, ""))),
  };
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

/** parseFlowchart の戻り値（Mermaid の色と閉じて始めるグループを必ず持つ） */
export type ParsedFlowchart = Flowchart & {
  styles: MermaidStyles;
  collapsed: string[];
};

/** `flowchart` の Mermaid を、ノード・グループ・線と、読めない行の項目に読む */
export const parseFlowchart = (source: string): ParsedFlowchart => {
  const lines = joinMarkdownStrings(source.split("\n"));
  const header = /^\s*(flowchart|graph)\s+(\w+)/.exec(lines[0] ?? "");
  const direction = toDirection(header?.[2] ?? "TB") ?? "TB";
  const nodes = new Map<string, FlowNode>();
  const groups: FlowGroup[] = [];
  const edges: FlowEdge[] = [];
  const links: Record<string, string> = {};
  const linkLines: Record<string, number> = {};
  const problems: MapProblem[] = [];
  const stack: FlowGroup[] = [];
  const groupIds = new Set<string>();
  const edgeIds = new Map<string, number>();
  const collapsed: string[] = [];

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

  /** `subgraph` の行なら、グループを開く */
  const readSubgraph = (text: string): boolean => {
    const subgraph =
      /^subgraph\s+([^\s[]+)\s*(?:\[\s*"?([^"\]]*)"?\s*\])?\s*$/.exec(text);
    if (!subgraph?.[1]) return false;
    const group: FlowGroup = {
      id: subgraph[1],
      title: decodeEntities(subgraph[2] ?? subgraph[1]),
      parent: stack.at(-1)?.id,
      direction: undefined,
    };
    groups.push(group);
    groupIds.add(group.id);
    stack.push(group);
    return true;
  };
  /** `end` の行なら、グループを閉じる（開いたグループが無ければ項目を足す） */
  const readEnd = (text: string, line: number): boolean => {
    if (text !== "end") return false;
    if (!stack.pop())
      problems.push({
        kind: "map_invalid",
        line,
        message: `${line + 1} 行目の \`end\` に対応する \`subgraph\` がありません。`,
      });
    return true;
  };
  /** `direction` の行なら、開いたグループの向きにする */
  const readDirection = (
    text: string,
    at: { line: number; raw: string },
  ): boolean => {
    const dir = /^direction\s+(\w+)$/.exec(text);
    if (!dir?.[1]) return false;
    const current = stack.at(-1);
    const value = toDirection(dir[1]);
    if (current && value) current.direction = value;
    else problems.push(unreadable(at.line, at.raw));
    return true;
  };
  /** `class` の行ならノードにクラスを足し、`click` の行ならリンク先にする */
  const readClassOrClick = (text: string, line: number): boolean => {
    const classLine = /^class\s+([\w,\s]+?)\s+([\w-]+)$/.exec(text);
    if (classLine?.[1] && classLine[2]) {
      for (const id of classLine[1].split(",").map((part) => part.trim()))
        nodes.get(id)?.classes.push(classLine[2]);
      return true;
    }
    const click = CLICK_RE.exec(text);
    if (click?.[1] && click[2] !== undefined) {
      links[click[1]] = click[2];
      linkLines[click[1]] = line;
      return true;
    }
    return false;
  };
  /** ノードと線の文のノードを足し、隣り合うノードの組ごとに線を足す */
  const addStatement = (
    statement: NonNullable<ReturnType<typeof readStatement>>,
  ): void => {
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
            ...(Object.keys(arrow.ends).length > 0
              ? { ends: { ...arrow.ends } }
              : {}),
            ...(arrow.invisible ? { invisible: true as const } : {}),
            ...(arrow.length >= 2 ? { length: arrow.length } : {}),
          });
        }
      }
    });
  };

  /** `{ID}@{ … }` だけの行のうち、線の属性と `view: collapsed` の行を読む（ノードの定義の行は false） */
  const readAttributeLine = (text: string): boolean => {
    const match = /^([A-Za-z0-9_\u0080-￿]+)@\{([^}]*)\}$/.exec(text);
    if (!match?.[1]) return false;
    const values = readAttributes(match[2] ?? "");
    const keys = Object.keys(values);
    if (values.view === "collapsed" && groupIds.has(match[1])) {
      collapsed.push(match[1]);
      return true;
    }
    return (
      keys.length > 0 && keys.every((key) => EDGE_ATTRIBUTE_KEYS.includes(key))
    );
  };

  lines.slice(1).forEach((raw, index) => {
    const line = index + 1;
    const text = raw.replace(/%%.*$/, "").trim().replace(/;$/, "");
    if (text === "") return;
    if (
      readAttributeLine(text) ||
      readSubgraph(text) ||
      readEnd(text, line) ||
      readDirection(text, { line, raw }) ||
      readClassOrClick(text, line) ||
      IGNORED_RE.test(text)
    )
      return;
    const statement = readStatement(text);
    if (!statement) {
      problems.push(unreadable(line, raw));
      return;
    }
    addStatement(statement);
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
    linkLines,
    styles: readMermaidStyles({ lines: lines.slice(1), classTarget: "class" }),
    collapsed,
    problems,
  };
};
