import type { Token } from "markdown-it";
import MarkdownIt from "markdown-it";
import { parseCsv } from "../table/csv.syntax.ts";
import { parseTree, type TreeNode } from "../tree/tree.syntax.ts";
import type { StyleSettings } from "./settings.ts";

/** 引用の 1 行目の `[!種類]` として扱う値 */
export const CALLOUT_TYPES = [
  "NOTE",
  "TIP",
  "IMPORTANT",
  "WARNING",
  "CAUTION",
] as const;

/** 行末の `[!code …]` として扱う値 */
export const CODE_LINE_MARKS = [
  "++",
  "--",
  "highlight",
  "focus",
  "error",
  "warning",
] as const;

/** コードの行の印 */
export type CodeLineMark = (typeof CODE_LINE_MARKS)[number];

/** 表の種類 */
export type TableKind = "default" | "data" | "plain";

/** `stack` のブロックにする範囲のマーカーの名前 */
export const STACK_MARKERS = [
  "tabs",
  "columns",
  "cards",
  "wide",
  "view",
] as const;

/** 縦に並べる範囲の種類 */
export type StackKind = (typeof STACK_MARKERS)[number];

/** 返答のブロック 1 つ。`line` は返答の本文の頭からの、ブロックの先頭の行（1 から。注意書きの中のブロックも返答の本文の頭から数える） */
export type ReplyBlock = {
  kind:
    | "table"
    | "callout"
    | "heading"
    | "code"
    | "fold"
    | "steps"
    | "tree"
    | "stack"
    | "markdown";
  line: number;
  table?: {
    kind: TableKind;
    header: string[];
    rows: string[][];
    align: ("left" | "center" | "right")[];
    /** 直前の `fig` のマーカーの通し番号 */
    figure?: number;
    /** 直後の `row-detail` の範囲（`row` は見出しの行を除いて 0 から数えた行） */
    details?: { row: number; body: ReplyBlock[] }[];
  };
  callout?: {
    type: string;
    title?: string;
    closed: boolean;
    body: ReplyBlock[];
  };
  heading?: { level: 1 | 2 | 3 | 4 | 5 | 6; text: string };
  code?: {
    lang: string;
    title?: string;
    lineNumbers: boolean;
    lines: { text: string; mark?: CodeLineMark }[];
  };
  fold?: { title: string; index: number; body: ReplyBlock[] };
  /** 項目ごとの中身のブロック */
  steps?: { items: ReplyBlock[][] };
  /** 行ごとの罫線・名前・`#` を除いた注釈 */
  tree?: { lines: { rule: string; name: string; note?: string }[] };
  /** 区切りごとの中身。`title` はタブ名（タブだけ） */
  stack?: {
    kind: StackKind;
    sections: { title?: string; body: ReplyBlock[] }[];
  };
  markdown?: string;
  /** `markdown` の行ごとの、各文字の返答の本文の行での位置（行内のマーカーと注意書きの `> ` を除いた分のずれを戻す） */
  columns?: number[][];
};

/** 部品ごとのオン・オフ */
type Parts = StyleSettings["parts"];

/** 単独の行のマーカー */
type Marker = { name: string; args: string };

/** トークンの最上位の塊（開きから閉じまで、または 1 つのトークン） */
type Chunk = { tokens: Token[]; start: number; end: number };

/** 開いている範囲（details の範囲・`section: closed` の見出しのセクション・行の詳細・縦に並べる範囲） */
type Frame = {
  kind: "details" | "section" | "row-detail" | "stack";
  title: string;
  level: number;
  index: number;
  line: number;
  body: ReplyBlock[];
  /** `row-detail` の `at` */
  at?: number;
  /** `row-detail` を付ける直前の表のブロック */
  table?: ReplyBlock;
  /** 縦に並べる範囲の種類 */
  stack?: StackKind;
  /** 段組みの `column` のマーカーの位置（`body` のブロックの数） */
  cuts?: number[];
};

/** 図と表の番号の数え方（返答の本文の頭から通しで数える） */
type Figures = { count: number; ids: Map<string, number> };

/** 分けている途中の状態 */
type State = {
  lines: string[];
  /** 本文の 1 行目の、返答の本文の頭からの行のずれ */
  lineBase: number;
  /** 行ごとの、返答の本文の行の頭から除いた文字数 */
  prefixes: number[];
  parts: Parts;
  out: ReplyBlock[];
  frames: Frame[];
  foldCount: { value: number };
  figures: Figures;
  pendingTable?: TableKind;
  /** 直前の `fig` のマーカーの `id`（`parts.figure` が真のとき） */
  pendingFigure?: string;
  /** `steps` の範囲の中で、最初の番号付きリストを待っている */
  inSteps?: boolean;
  pendingCode?: {
    title?: string;
    lineNumbers: boolean;
    highlight: Set<number>;
  };
};

const MD = new MarkdownIt({ html: true });

const MARKER_LINE = /^<!--\s*(\/?[\w-]+)\s*(?::\s*([\s\S]*?))?\s*-->$/;

const INLINE_MARKER = /[ \t]*<!--.*?-->[ \t]*/g;

const CALLOUT_HEAD = /^\s*>\s*\[!(\w+)\]([-+]?)\s*(.*)$/;

const CODE_MARK =
  /\s*(?:\/\/|#|--|;|<!--|\/\*)?\s*\[!code (\+\+|--|highlight|focus|error|warning)\]\s*(?:-->|\*\/)?\s*$/;

/** 行内のマーカーを除き、前後の文字を 1 つの空白でつなぐ */
const stripInlineMarkers = (line: string): string =>
  line
    .replace(INLINE_MARKER, (_match, offset: number) =>
      offset === 0 ? "" : " ",
    )
    .trimEnd();

/** 文字列と、各文字の元の行での位置 */
type MappedLine = { text: string; columns: number[] };

/** `stripInlineMarkers` と同じく行内のマーカーを除き、残した文字ごとに元の行での位置を添える */
const stripWithColumns = (line: string, shift: number): MappedLine => {
  let text = "";
  const columns: number[] = [];
  let from = 0;
  const keep = (end: number) => {
    for (let at = from; at < end; at += 1) {
      text += line[at];
      columns.push(at + shift);
    }
  };
  for (const match of line.matchAll(INLINE_MARKER)) {
    keep(match.index);
    if (match.index !== 0) {
      text += " ";
      columns.push(match.index + shift);
    }
    from = match.index + match[0].length;
  }
  keep(line.length);
  const end = text.trimEnd().length;
  return { text: text.slice(0, end), columns: columns.slice(0, end) };
};

/** 行が単独の行のマーカーだけなら、名前と引数を返却する */
const readMarker = (text: string): Marker | undefined => {
  const match = MARKER_LINE.exec(text.trim());
  return match?.[1] === undefined
    ? undefined
    : { name: match[1], args: (match[2] ?? "").trim() };
};

/** トークンの並びを最上位の塊に分ける */
const chunksOf = (tokens: Token[]): Chunk[] => {
  const chunks: Chunk[] = [];
  let current: Token[] = [];
  let depth = 0;
  for (const token of tokens) {
    current.push(token);
    depth += token.nesting;
    if (depth === 0) {
      const first = current[0];
      const map = first?.map ?? current.find((item) => item.map)?.map;
      chunks.push({
        tokens: current,
        start: map?.[0] ?? 0,
        end: map?.[1] ?? 0,
      });
      current = [];
    }
  }
  return chunks;
};

/** ブロックを今開いている範囲か、最上位に追加する */
const push = (state: State, block: ReplyBlock): void => {
  const frame = state.frames.at(-1);
  (frame === undefined ? state.out : frame.body).push(block);
};

/** 今開いている範囲か最上位の、ブロックの並び */
const currentList = (state: State): ReplyBlock[] =>
  state.frames.at(-1)?.body ?? state.out;

/** 行の詳細を直前の表に付ける。付けられなければ中身をその位置に並べる */
const closeRowDetail = (state: State, frame: Frame): void => {
  const table = frame.table?.table;
  const at = frame.at;
  if (
    table !== undefined &&
    at !== undefined &&
    Number.isInteger(at) &&
    at >= 1 &&
    at <= table.rows.length
  ) {
    table.details = [...(table.details ?? []), { row: at - 1, body: frame.body }];
    return;
  }
  for (const block of frame.body) {
    push(state, block);
  }
};

/** タブの範囲を、範囲の中で最初に出る見出しの階層で区切る */
const tabSections = (
  body: ReplyBlock[],
): { title?: string; body: ReplyBlock[] }[] => {
  const level = body.find((block) => block.kind === "heading")?.heading?.level;
  const sections: { title?: string; body: ReplyBlock[] }[] = [{ body: [] }];
  for (const block of body) {
    if (block.heading !== undefined && block.heading.level === level) {
      sections.push({ title: block.heading.text, body: [] });
    } else {
      sections.at(-1)?.body.push(block);
    }
  }
  return sections.filter(
    (section) => section.title !== undefined || section.body.length > 0,
  );
};

/** 段組みの範囲を、`column` のマーカーの位置で区切る */
const columnSections = (
  body: ReplyBlock[],
  cuts: number[],
): { body: ReplyBlock[] }[] =>
  [0, ...cuts].map((from, index) => ({
    body: body.slice(from, cuts[index] ?? body.length),
  }));

/** カードの箇条書きの 1 項目を `タイトル — 説明` にする */
const cardLine = (item: string): string => {
  const text = item.replace(/`icon:[^`]*`\s*/g, "").trim();
  const link = /\[([^\]]*)\]\([^)]*\)/.exec(text);
  if (link === null) {
    return text;
  }
  const description = `${text.slice(0, link.index)} ${text.slice(link.index + link[0].length)}`
    .replace(/\s+/g, " ")
    .trim();
  const title = link[1] ?? "";
  return description === "" ? title : `${title} — ${description}`;
};

/** カードの範囲の箇条書きを、項目ごとに `- タイトル — 説明` の箇条書きにする */
const cardBlock = (block: ReplyBlock): ReplyBlock => {
  if (block.kind !== "markdown" || block.markdown === undefined) {
    return block;
  }
  const items: string[] = [];
  for (const line of block.markdown.split("\n")) {
    const head = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (head !== null) {
      items.push(head[1] ?? "");
    } else if (items.length > 0) {
      items[items.length - 1] = `${items.at(-1)} ${line.trim()}`;
    }
  }
  if (items.length === 0) {
    return block;
  }
  return {
    kind: "markdown",
    line: block.line,
    markdown: items.map((item) => `- ${cardLine(item)}`).join("\n"),
  };
};

/** 縦に並べる範囲を、区切りごとのブロックの並びを持つ `stack` にする */
const closeStack = (state: State, frame: Frame): void => {
  const kind = frame.stack ?? "wide";
  const sections =
    kind === "tabs"
      ? tabSections(frame.body)
      : kind === "columns"
        ? columnSections(frame.body, frame.cuts ?? [])
        : [{ body: kind === "cards" ? frame.body.map(cardBlock) : frame.body }];
  push(state, {
    kind: "stack",
    line: frame.body[0]?.line ?? 0,
    stack: { kind, sections },
  });
};

/** 開いている範囲を閉じる */
const closeFrame = (state: State): void => {
  const frame = state.frames.pop();
  if (frame === undefined) {
    return;
  }
  if (frame.kind === "row-detail") {
    closeRowDetail(state, frame);
    return;
  }
  if (frame.kind === "stack") {
    closeStack(state, frame);
    return;
  }
  push(state, {
    kind: "fold",
    line: frame.line,
    fold: { title: frame.title, index: frame.index, body: frame.body },
  });
};

/** 塊の先頭の、返答の本文の頭からの行 */
const lineOf = (state: State, chunk: Chunk): number =>
  state.lineBase + chunk.start + 1;

/** 塊の元の行を、行内のマーカーと前後の空の行・空白を除き、各文字の返答の本文の行での位置を添えて返却する */
const rawOf = (
  state: State,
  chunk: Chunk,
): { line: number; lines: MappedLine[] } => {
  const lines = state.lines
    .slice(chunk.start, chunk.end)
    .map((line, offset) =>
      stripWithColumns(line, state.prefixes[chunk.start + offset] ?? 0),
    );
  let line = lineOf(state, chunk);
  while (lines[0] !== undefined && lines[0].text.trim() === "") {
    lines.shift();
    line += 1;
  }
  while (lines.at(-1) !== undefined && lines.at(-1)?.text.trim() === "") {
    lines.pop();
  }
  const first = lines[0];
  if (first !== undefined) {
    const lead = first.text.length - first.text.trimStart().length;
    lines[0] = {
      text: first.text.slice(lead),
      columns: first.columns.slice(lead),
    };
  }
  return { line, lines };
};

/** `markdown` のブロックを追加する（空なら追加しない） */
const pushMarkdown = (state: State, chunk: Chunk): void => {
  const { line, lines } = rawOf(state, chunk);
  if (lines.length === 0) {
    return;
  }
  push(state, {
    kind: "markdown",
    line,
    markdown: lines.map((item) => item.text).join("\n"),
    columns: lines.map((item) => item.columns),
  });
};

/** `table` のマーカーの JSON の引数から種類を読む。読めなければ既定 */
const tableKindOf = (args: string): TableKind => {
  try {
    const kind: unknown = JSON.parse(args)?.kind;
    return kind === "data" || kind === "plain" ? kind : "default";
  } catch {
    return "default";
  }
};

/** `highlight=2,4-5` の行の番号の集合 */
const highlightLines = (value: string): Set<number> => {
  const lines = new Set<number>();
  for (const part of value.split(",")) {
    const [from, to] = part.split("-").map((item) => Number(item.trim()));
    if (from === undefined || !Number.isInteger(from)) {
      continue;
    }
    const last = to !== undefined && Number.isInteger(to) ? to : from;
    for (let line = from; line <= last; line += 1) {
      lines.add(line);
    }
  }
  return lines;
};

/** `code` のマーカーの `key=value` と単独の名前の引数を読む */
const codeOptionsOf = (args: string): NonNullable<State["pendingCode"]> => {
  const options: NonNullable<State["pendingCode"]> = {
    lineNumbers: false,
    highlight: new Set(),
  };
  for (const match of args.matchAll(/(\w+)(?:=("[^"]*"|\S+))?/g)) {
    const [, key, raw] = match;
    const value = raw?.replace(/^"|"$/g, "");
    if (key === "title" && value !== undefined) {
      options.title = value;
    } else if (key === "lines") {
      options.lineNumbers = true;
    } else if (key === "highlight" && value !== undefined) {
      options.highlight = highlightLines(value);
    }
  }
  return options;
};

/** マーカーの JSON の引数のキーの値。読めなければ返却しない */
const argOf = (args: string, key: string): unknown => {
  try {
    const value: unknown = JSON.parse(args);
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)[key]
      : undefined;
  } catch {
    return undefined;
  }
};

/** 新しい範囲を開く */
const openFrame = (state: State, frame: Partial<Frame> & Pick<Frame, "kind">) =>
  state.frames.push({
    title: "",
    level: 0,
    index: -1,
    line: 0,
    body: [],
    ...frame,
  });

/** 行の詳細・ステップ・縦に並べる範囲・図と表の番号のマーカーを読み込む。読み込んだら真 */
const applyPartMarker = (state: State, marker: Marker): boolean => {
  const { name } = marker;
  const top = state.frames.at(-1);
  if (name === "fig" && state.parts.figure) {
    const id = argOf(marker.args, "id");
    state.pendingFigure = typeof id === "string" ? id : "";
  } else if (name === "row-detail") {
    const last = currentList(state).at(-1);
    const at = argOf(marker.args, "at");
    openFrame(state, {
      kind: "row-detail",
      ...(typeof at === "number" ? { at } : {}),
      ...(state.parts.row_detail && last?.kind === "table"
        ? { table: last }
        : {}),
    });
  } else if (name === "/row-detail" && top?.kind === "row-detail") {
    closeFrame(state);
  } else if (name === "steps" && state.parts.steps) {
    state.inSteps = true;
  } else if (name === "/steps") {
    state.inSteps = false;
  } else if (
    state.parts.stack &&
    (STACK_MARKERS as readonly string[]).includes(name)
  ) {
    openFrame(state, { kind: "stack", stack: name as StackKind, cuts: [] });
  } else if (top?.kind === "stack" && name === `/${top.stack}`) {
    closeFrame(state);
  } else if (name === "column" && top?.stack === "columns") {
    top.cuts?.push(top.body.length);
  } else {
    return false;
  }
  return true;
};

/** 単独の行のマーカーを、次のブロックの属性・開閉の範囲にする */
const applyMarker = (state: State, marker: Marker): void => {
  if (applyPartMarker(state, marker)) {
    return;
  }
  if (marker.name === "table") {
    state.pendingTable = tableKindOf(marker.args);
  } else if (marker.name === "code") {
    state.pendingCode = codeOptionsOf(marker.args);
  } else if (marker.name === "details" && state.parts.fold) {
    state.frames.push({
      kind: "details",
      title: marker.args,
      level: 0,
      index: state.foldCount.value++,
      line: 0,
      body: [],
    });
  } else if (
    marker.name === "/details" &&
    state.frames.at(-1)?.kind === "details"
  ) {
    closeFrame(state);
  } else if (marker.name === "section" && state.parts.fold) {
    openSection(state, marker.args);
  }
};

/** `section: closed` の付いた直前の見出しから、閉じたセクションを開く */
const openSection = (state: State, args: string): void => {
  const closed = args === "closed" || /"open"\s*:\s*false/.test(args);
  const list = currentList(state);
  const heading = list.at(-1);
  if (!closed || heading?.kind !== "heading" || heading.heading === undefined) {
    return;
  }
  list.pop();
  state.frames.push({
    kind: "section",
    title: heading.heading.text,
    level: heading.heading.level,
    index: state.foldCount.value++,
    line: heading.line,
    body: [],
  });
};

/** 見出しの前に、同じか上の階層の見出しで終わるセクションを閉じる */
const closeSections = (state: State, level: number): void => {
  while (true) {
    const frame = state.frames.at(-1);
    if (frame?.kind !== "section" || frame.level < level) {
      return;
    }
    closeFrame(state);
  }
};

/** html_block の塊を、マーカーか markdown として扱う */
const handleHtml = (state: State, chunk: Chunk): void => {
  const text = chunk.tokens[0]?.content ?? "";
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const markers = lines.map(readMarker);
  if (markers.every((marker) => marker !== undefined)) {
    for (const marker of markers) {
      applyMarker(state, marker as Marker);
    }
    return;
  }
  pushMarkdown(state, chunk);
};

/** 見出しの塊 */
const handleHeading = (state: State, chunk: Chunk): void => {
  const level = Number(chunk.tokens[0]?.tag.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
  closeSections(state, level);
  if (!state.parts.heading) {
    pushMarkdown(state, chunk);
    return;
  }
  const text = stripInlineMarkers(chunk.tokens[1]?.content ?? "").trim();
  push(state, {
    kind: "heading",
    line: lineOf(state, chunk),
    heading: { level, text },
  });
};

/** 見出しのセルの `style` から文字揃え */
const alignOf = (token: Token): "left" | "center" | "right" => {
  const style = String(token.attrGet("style") ?? "");
  if (style.includes("center")) {
    return "center";
  }
  return style.includes("right") ? "right" : "left";
};

/** 表のトークンから、行ごとのセルの文字と見出しの文字揃えを読み込む */
const readTable = (tokens: Token[]) => {
  const rows: string[][] = [];
  const align: ("left" | "center" | "right")[] = [];
  for (const [index, token] of tokens.entries()) {
    if (token.type === "tr_open") {
      rows.push([]);
    } else if (token.type === "th_open" || token.type === "td_open") {
      const cell = stripInlineMarkers(tokens[index + 1]?.content ?? "").trim();
      rows.at(-1)?.push(cell);
    }
    if (token.type === "th_open") {
      align.push(alignOf(token));
    }
  }
  return { rows, align };
};

/** 表の塊 */
const handleTable = (state: State, chunk: Chunk): void => {
  const kind = state.pendingTable ?? "default";
  state.pendingTable = undefined;
  if (!state.parts.table) {
    pushMarkdown(state, chunk);
    return;
  }
  const { rows, align } = readTable(chunk.tokens);
  const [header = [], ...body] = rows;
  const id = state.pendingFigure;
  state.pendingFigure = undefined;
  let figure: number | undefined;
  if (id !== undefined) {
    state.figures.count += 1;
    figure = state.figures.count;
    if (id !== "") {
      state.figures.ids.set(id, figure);
    }
  }
  push(state, {
    kind: "table",
    line: lineOf(state, chunk),
    table: {
      kind,
      header,
      rows: body,
      align,
      ...(figure === undefined ? {} : { figure }),
    },
  });
};

/** ツリーの 1 階層分の字下げ（`│   `・`|   ` か空白 4 つ） */
const TREE_INDENTS = ["│   ", "|   ", "    "];

/** ツリーの罫線の項目の頭（`├── `・`└── `・`|-- `・`` `-- ``） */
const TREE_CONNECTORS = ["├── ", "└── ", "|-- ", "`-- "];

/** 字下げの後ろに罫線が無い行があれば真 */
const hasBareIndent = (source: string): boolean =>
  source
    .split("\n")
    .filter((line) => line.trim() !== "")
    .some((line) => {
      let at = 0;
      while (TREE_INDENTS.some((unit) => line.startsWith(unit, at))) {
        at += 4;
      }
      return (
        at > 0 &&
        !TREE_CONNECTORS.some((connector) => line.startsWith(connector, at))
      );
    });

/** 入れ子の項目を行の順にたどり、罫線を階層と兄弟の有無から作り直す */
const treeLines = (
  nodes: TreeNode[],
  prefix: string,
  depth: number,
): { rule: string; name: string; note?: string }[] =>
  nodes.flatMap((node, index) => {
    const last = index === nodes.length - 1;
    const rule = depth === 0 ? "" : `${prefix}${last ? "└── " : "├── "}`;
    const childPrefix = depth === 0 ? "" : `${prefix}${last ? "    " : "│   "}`;
    return [
      {
        rule,
        name: node.name,
        ...(node.note === undefined ? {} : { note: node.note }),
      },
      ...treeLines(node.children ?? [], childPrefix, depth + 1),
    ];
  });

/** 言語 `tree` のコードブロックを `tree` のブロックにする。罫線を解釈できなければ返却しない */
const treeBlockOf = (
  source: string,
  line: number,
): ReplyBlock | undefined => {
  if (hasBareIndent(source)) {
    return undefined;
  }
  const result = parseTree(source, (note) => note);
  if (!("nodes" in result)) {
    return undefined;
  }
  return { kind: "tree", line, tree: { lines: treeLines(result.nodes, "", 0) } };
};

/** 言語 `csv` のコードブロックを、1 行目を見出しにした表にする */
const csvBlockOf = (source: string, line: number): ReplyBlock => {
  const [header = [], ...rows] = parseCsv(source);
  return {
    kind: "table",
    line,
    table: {
      kind: "default",
      header,
      rows,
      align: header.map(() => "left" as const),
    },
  };
};

/** コードブロックの塊 */
const handleFence = (state: State, chunk: Chunk): void => {
  const options = state.pendingCode ?? {
    lineNumbers: false,
    highlight: new Set(),
  };
  state.pendingCode = undefined;
  const token = chunk.tokens[0];
  const lang = (token?.info ?? "").trim().split(/\s+/)[0] ?? "";
  const source = (token?.content ?? "").replace(/\n$/, "");
  const part =
    lang === "tree" && state.parts.tree
      ? treeBlockOf(source, lineOf(state, chunk))
      : lang === "csv" && state.parts.stack
        ? csvBlockOf(source, lineOf(state, chunk))
        : undefined;
  if (part !== undefined) {
    push(state, part);
    return;
  }
  if (!state.parts.code) {
    pushMarkdown(state, chunk);
    return;
  }
  const lines = source.split("\n").map((text, index) => {
    const match = CODE_MARK.exec(text);
    const mark = match?.[1] as CodeLineMark | undefined;
    const line = { text: match === null ? text : text.slice(0, match.index) };
    if (mark !== undefined) {
      return { ...line, mark };
    }
    return options.highlight.has(index + 1)
      ? { ...line, mark: "highlight" as const }
      : line;
  });
  push(state, {
    kind: "code",
    line: lineOf(state, chunk),
    code: {
      lang,
      ...(options.title === undefined ? {} : { title: options.title }),
      lineNumbers: options.lineNumbers,
      lines,
    },
  });
};

/** 引用の 1 行目が `[!種類]` の注意書きなら、種類・閉じるか・タイトルを返却する */
const calloutHeadOf = (
  line: string,
  parts: Parts,
): { type: string; closed: boolean; title: string } | undefined => {
  const [, rawType = "", sign = "", rawTitle = ""] =
    CALLOUT_HEAD.exec(line) ?? [];
  const type = rawType.toUpperCase();
  if (!parts.callout || !(CALLOUT_TYPES as readonly string[]).includes(type)) {
    return undefined;
  }
  return { type, closed: sign === "-" && parts.fold, title: rawTitle.trim() };
};

/** 引用の塊。1 行目が `[!種類]` なら注意書きにする */
const handleQuote = (state: State, chunk: Chunk): void => {
  const lines = state.lines.slice(chunk.start, chunk.end);
  const head = calloutHeadOf(lines[0] ?? "", state.parts);
  if (head === undefined) {
    pushMarkdown(state, chunk);
    return;
  }
  const { type, closed, title } = head;
  const index = closed ? state.foldCount.value++ : -1;
  const inner = lines.slice(1).map((line, offset) => {
    const prefix = /^\s*>\s?/.exec(line)?.[0].length ?? 0;
    return {
      text: line.slice(prefix),
      prefix: prefix + (state.prefixes[chunk.start + 1 + offset] ?? 0),
    };
  });
  const body = splitInto({
    text: inner.map((line) => line.text).join("\n"),
    parts: state.parts,
    foldCount: state.foldCount,
    figures: state.figures,
    lineBase: lineOf(state, chunk),
    prefixes: inner.map((line) => line.prefix),
  });
  push(state, {
    kind: "callout",
    line: lineOf(state, chunk),
    callout: { type, ...(title === "" ? {} : { title }), closed, body },
    ...(closed ? { fold: { title: title || type, index, body } } : {}),
  });
};

/** 番号付きリストの項目の行から、番号と字下げを除いた中身と、除いた文字数 */
const itemLines = (
  state: State,
  from: number,
  to: number,
): { text: string; prefix: number }[] => {
  const lines = state.lines.slice(from, to);
  const width = /^\s*\d+[.)]\s*/.exec(lines[0] ?? "")?.[0].length ?? 0;
  return lines.map((line, offset) => {
    const removed =
      offset === 0
        ? width
        : Math.min(width, line.length - line.trimStart().length);
    return {
      text: line.slice(removed),
      prefix: removed + (state.prefixes[from + offset] ?? 0),
    };
  });
};

/** `steps` の範囲の最初の番号付きリストを、項目ごとのブロックの並びを持つ `steps` にする */
const handleSteps = (state: State, chunk: Chunk): void => {
  state.inSteps = false;
  const level = (chunk.tokens[0]?.level ?? 0) + 1;
  const items = chunk.tokens
    .filter((token) => token.type === "list_item_open" && token.level === level)
    .map((token) => {
      const [from = 0, to = from] = token.map ?? [];
      const inner = itemLines(state, from, to);
      return splitInto({
        text: inner.map((line) => line.text).join("\n"),
        parts: state.parts,
        foldCount: state.foldCount,
        figures: state.figures,
        lineBase: state.lineBase + from,
        prefixes: inner.map((line) => line.prefix),
      });
    });
  push(state, { kind: "steps", line: lineOf(state, chunk), steps: { items } });
};

/** 塊の種類ごとにブロックへ分ける */
const handleChunk = (state: State, chunk: Chunk): void => {
  const type = chunk.tokens[0]?.type;
  if (type !== "html_block" && type !== "table_open") {
    state.pendingFigure = undefined;
  }
  if (type === "html_block") {
    handleHtml(state, chunk);
  } else if (type === "ordered_list_open" && state.inSteps === true) {
    handleSteps(state, chunk);
  } else if (type === "heading_open") {
    handleHeading(state, chunk);
  } else if (type === "table_open") {
    handleTable(state, chunk);
  } else if (type === "fence" || type === "code_block") {
    handleFence(state, chunk);
  } else if (type === "blockquote_open") {
    handleQuote(state, chunk);
  } else {
    pushMarkdown(state, chunk);
  }
};

/** 開閉の範囲の数え方を共有して、本文をブロックに分ける */
const splitInto = (options: {
  text: string;
  parts: Parts;
  foldCount: { value: number };
  figures: Figures;
  lineBase: number;
  prefixes: number[];
}): ReplyBlock[] => {
  const lines = options.text.split("\n");
  const state: State = {
    lines,
    lineBase: options.lineBase,
    prefixes: options.prefixes,
    parts: options.parts,
    out: [],
    frames: [],
    foldCount: options.foldCount,
    figures: options.figures,
  };
  for (const chunk of chunksOf(MD.parse(options.text, {}))) {
    handleChunk(state, chunk);
  }
  while (state.frames.length > 0) {
    closeFrame(state);
  }
  return state.out;
};

/** 図と表を指すリンク `[文字](#fig-ID)` */
const FIGURE_LINK = /\[([^\]]*)\]\(#fig-([^)\s]+)\)/g;

/** 文字のリンクの文字を `表 {番号}` に替え、替えた文字の位置は元のリンクの文字の頭の位置にする */
const replaceFigureLinks = (
  text: string,
  columns: number[] | undefined,
  ids: Map<string, number>,
): { text: string; columns: number[] | undefined } => {
  let out = "";
  const mapped: number[] = [];
  let from = 0;
  const keep = (end: number) => {
    out += text.slice(from, end);
    for (let at = from; at < end; at += 1) {
      mapped.push(columns?.[at] ?? at);
    }
  };
  for (const match of text.matchAll(FIGURE_LINK)) {
    const figure = ids.get(match[2] ?? "");
    if (figure === undefined) {
      continue;
    }
    const labelAt = match.index + 1;
    keep(labelAt);
    const label = `表 ${figure}`;
    out += label;
    for (let at = 0; at < label.length; at += 1) {
      mapped.push(columns?.[labelAt] ?? labelAt);
    }
    from = labelAt + (match[1] ?? "").length;
  }
  if (from === 0) {
    return { text, columns };
  }
  keep(text.length);
  return { text: out, columns: columns === undefined ? undefined : mapped };
};

/** ブロックの中の `markdown` と表のセルの、図と表を指すリンクの文字を番号にする */
const numberFigureLinks = (
  blocks: ReplyBlock[],
  ids: Map<string, number>,
): void => {
  for (const block of blocks) {
    if (block.markdown !== undefined) {
      const lines = block.markdown.split("\n").map((line, index) =>
        replaceFigureLinks(line, block.columns?.[index], ids),
      );
      block.markdown = lines.map((line) => line.text).join("\n");
      if (block.columns !== undefined) {
        block.columns = lines.map((line) => line.columns ?? []);
      }
    }
    if (block.table !== undefined) {
      const cell = (text: string) => replaceFigureLinks(text, undefined, ids).text;
      block.table.header = block.table.header.map(cell);
      block.table.rows = block.table.rows.map((row) => row.map(cell));
    }
    const inner = [
      ...(block.callout?.body ?? []),
      ...(block.callout === undefined ? (block.fold?.body ?? []) : []),
      ...(block.steps?.items.flat() ?? []),
      ...(block.stack?.sections.flatMap((section) => section.body) ?? []),
      ...(block.table?.details?.flatMap((detail) => detail.body) ?? []),
    ];
    numberFigureLinks(inner, ids);
  }
};

/** 返答の Markdown を `ReplyBlock` の並びにする。`parts` でオフにした種類は、その部品の飾りだけを除外したブロックにする */
export const splitBlocks = (options: {
  text: string;
  parts: Parts;
}): ReplyBlock[] => {
  const figures: Figures = { count: 0, ids: new Map() };
  const blocks = splitInto({
    text: options.text,
    parts: options.parts,
    foldCount: { value: 0 },
    figures,
    lineBase: 0,
    prefixes: [],
  });
  if (options.parts.figure && figures.ids.size > 0) {
    numberFigureLinks(blocks, figures.ids);
  }
  return blocks;
};
