import type { Token } from "markdown-it";
import MarkdownIt from "markdown-it";
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

/** 返答のブロック 1 つ。`line` はブロックの本文の先頭の行（1 から） */
export type ReplyBlock = {
  kind: "table" | "callout" | "heading" | "code" | "fold" | "markdown";
  line: number;
  table?: {
    kind: TableKind;
    header: string[];
    rows: string[][];
    align: ("left" | "center" | "right")[];
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
  markdown?: string;
};

/** 部品ごとのオン・オフ */
type Parts = StyleSettings["parts"];

/** 単独の行のマーカー */
type Marker = { name: string; args: string };

/** トークンの最上位の塊（開きから閉じまで、または 1 つのトークン） */
type Chunk = { tokens: Token[]; start: number; end: number };

/** 開いている範囲（details の範囲と、`section: closed` の見出しのセクション） */
type Frame = {
  kind: "details" | "section";
  title: string;
  level: number;
  index: number;
  line: number;
  body: ReplyBlock[];
};

/** 分けている途中の状態 */
type State = {
  lines: string[];
  parts: Parts;
  out: ReplyBlock[];
  frames: Frame[];
  foldCount: { value: number };
  pendingTable?: TableKind;
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

/** 開閉の範囲を閉じる */
const closeFrame = (state: State): void => {
  const frame = state.frames.pop();
  if (frame === undefined) {
    return;
  }
  push(state, {
    kind: "fold",
    line: frame.line,
    fold: { title: frame.title, index: frame.index, body: frame.body },
  });
};

/** 塊の元の行を、行内のマーカーを除いて返却する */
const rawOf = (state: State, chunk: Chunk): string =>
  state.lines
    .slice(chunk.start, chunk.end)
    .map(stripInlineMarkers)
    .join("\n")
    .trim();

/** `markdown` のブロックを追加する（空なら追加しない） */
const pushMarkdown = (state: State, chunk: Chunk): void => {
  const markdown = rawOf(state, chunk);
  if (markdown !== "") {
    push(state, { kind: "markdown", line: chunk.start + 1, markdown });
  }
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

/** 単独の行のマーカーを、次のブロックの属性・開閉の範囲にする */
const applyMarker = (state: State, marker: Marker): void => {
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
  const frame = state.frames.at(-1);
  const list = frame === undefined ? state.out : frame.body;
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
    line: chunk.start + 1,
    heading: { level, text },
  });
};

/** 表の塊 */
const handleTable = (state: State, chunk: Chunk): void => {
  const kind = state.pendingTable ?? "default";
  state.pendingTable = undefined;
  if (!state.parts.table) {
    pushMarkdown(state, chunk);
    return;
  }
  const rows: string[][] = [];
  const align: ("left" | "center" | "right")[] = [];
  let row: string[] = [];
  for (const [index, token] of chunk.tokens.entries()) {
    if (token.type === "tr_open") {
      row = [];
    } else if (token.type === "th_open" || token.type === "td_open") {
      row.push(
        stripInlineMarkers(chunk.tokens[index + 1]?.content ?? "").trim(),
      );
      if (token.type === "th_open") {
        const style = String(token.attrGet("style") ?? "");
        align.push(
          style.includes("center")
            ? "center"
            : style.includes("right")
              ? "right"
              : "left",
        );
      }
    } else if (token.type === "tr_close") {
      rows.push(row);
    }
  }
  const [header = [], ...body] = rows;
  push(state, {
    kind: "table",
    line: chunk.start + 1,
    table: { kind, header, rows: body, align },
  });
};

/** コードブロックの塊 */
const handleFence = (state: State, chunk: Chunk): void => {
  const options = state.pendingCode ?? {
    lineNumbers: false,
    highlight: new Set(),
  };
  state.pendingCode = undefined;
  if (!state.parts.code) {
    pushMarkdown(state, chunk);
    return;
  }
  const token = chunk.tokens[0];
  const lang = (token?.info ?? "").trim().split(/\s+/)[0] ?? "";
  const source = (token?.content ?? "").replace(/\n$/, "");
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
    line: chunk.start + 1,
    code: {
      lang,
      ...(options.title === undefined ? {} : { title: options.title }),
      lineNumbers: options.lineNumbers,
      lines,
    },
  });
};

/** 引用の塊。1 行目が `[!種類]` なら注意書きにする */
const handleQuote = (state: State, chunk: Chunk): void => {
  const lines = state.lines.slice(chunk.start, chunk.end);
  const head = CALLOUT_HEAD.exec(lines[0] ?? "");
  const type = head?.[1]?.toUpperCase();
  if (
    !state.parts.callout ||
    type === undefined ||
    !(CALLOUT_TYPES as readonly string[]).includes(type)
  ) {
    pushMarkdown(state, chunk);
    return;
  }
  const closed = head?.[2] === "-" && state.parts.fold;
  const index = closed ? state.foldCount.value++ : -1;
  const inner = lines
    .slice(1)
    .map((line) => line.replace(/^\s*>\s?/, ""))
    .join("\n");
  const body = splitInto({
    text: inner,
    parts: state.parts,
    foldCount: state.foldCount,
  });
  const title = head?.[3]?.trim();
  push(state, {
    kind: "callout",
    line: chunk.start + 1,
    callout: {
      type,
      ...(title === undefined || title === "" ? {} : { title }),
      closed,
      body,
    },
  });
  if (closed) {
    const added = (state.frames.at(-1)?.body ?? state.out).at(-1);
    if (added?.callout !== undefined) {
      added.fold = { title: title || type, index, body };
    }
  }
};

/** 塊の種類ごとにブロックへ分ける */
const handleChunk = (state: State, chunk: Chunk): void => {
  const type = chunk.tokens[0]?.type;
  if (type === "html_block") {
    handleHtml(state, chunk);
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
}): ReplyBlock[] => {
  const lines = options.text.split("\n");
  const state: State = {
    lines,
    parts: options.parts,
    out: [],
    frames: [],
    foldCount: options.foldCount,
  };
  for (const chunk of chunksOf(MD.parse(options.text, {}))) {
    handleChunk(state, chunk);
  }
  while (state.frames.length > 0) {
    closeFrame(state);
  }
  return state.out;
};

/** 返答の Markdown を `ReplyBlock` の並びにする。`parts` でオフにした種類は `markdown` のブロックにする */
export const splitBlocks = (options: {
  text: string;
  parts: Parts;
}): ReplyBlock[] =>
  splitInto({
    text: options.text,
    parts: options.parts,
    foldCount: { value: 0 },
  });
