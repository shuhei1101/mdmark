import type { Token } from "markdown-it";
import MarkdownIt from "markdown-it";
import {
  DIAGRAM_ONLY_TAGS,
  EMBEDDED_NON_TEXT_TAGS,
  TEXT_FILTER_SKIP_TAGS,
} from "../render/sanitize.ts";
import { PART_PATTERN } from "../render/syntax/html.ts";
import { matchableChildren } from "./dictionary.ts";

/** 実体参照（`&amp;`・`&#x30EF;`・`&#12527;`）を戻す markdown-it の関数 */
const { unescapeAll } = new MarkdownIt().utils;

/** 本文の頭の実体参照 */
const ENTITY_PATTERN = /^&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i;

/** 実体参照の最長の長さ（名前つきの実体参照の最長に余裕を追加した値） */
const ENTITY_MAX_LENGTH = 40;

/** 伏せた範囲を埋める文字。どの文字にも該当しない */
const MASK_CHAR = "\u0000";

/** 完結した開きタグ・閉じタグ（属性の値の引用符の中の `>` を含む） */
const TAG_PATTERN =
  /<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/y;

/** 宣言・処理命令（`<!DOCTYPE …>`・`<?…?>`） */
const DECLARATION_PATTERN = /<[!?][^>]*>/y;

/** 図の部品の custom element の範囲（その位置から始まるもの） */
const PART_AT_PATTERN = new RegExp(PART_PATTERN.source, "iy");

/** 中身を持たない要素 */
const VOID_TAGS = new Set(["img", "br", "hr", "input", "wbr"]);

/** 中身ごと落ちる要素: 許可していない文字を持たない要素と、図の部品だけが持つ要素（`button` を除く） */
const DROPPED_TAGS = new Set([
  ...EMBEDDED_NON_TEXT_TAGS,
  ...[...DIAGRAM_ONLY_TAGS].filter((tag) => tag !== "button"),
]);

/** 本文の位置の実体参照が、照合した文字の位置から始まる文字に戻るなら、実体参照とその戻した文字 */
function entityAt(options: {
  body: string;
  at: number;
  text: string;
  position: number;
}): { entity: string; decoded: string } | undefined {
  const { body, at, text, position } = options;
  if (body[at] !== "&") {
    return undefined;
  }
  const entity = ENTITY_PATTERN.exec(
    body.slice(at, at + ENTITY_MAX_LENGTH),
  )?.[0];
  if (entity === undefined) {
    return undefined;
  }
  const decoded = unescapeAll(entity);
  return decoded !== entity && text.startsWith(decoded, position)
    ? { entity, decoded }
    : undefined;
}

/** 照合した文字を本文へ当てる 1 歩: 当てた文字ごとの本文の位置と、次の本文の位置と照合した文字の位置 */
function alignStep(options: {
  body: string;
  text: string;
  at: number;
  position: number;
}): { offsets: number[]; at: number; position: number } {
  const { body, text, at, position } = options;
  // 本文の最後まで探しても該当しない文字は、本文の終わりを指す
  if (at >= body.length) {
    return { offsets: [body.length], at, position: position + 1 };
  }
  const char = text[position] as string;
  // エスケープ（`\*`）は 2 文字で 1 文字
  if (body[at] === "\\" && body[at + 1] === char) {
    return { offsets: [at], at: at + 2, position: position + 1 };
  }
  // 実体参照は、戻した文字の長さぶん同じ位置を指す
  const found = entityAt(options);
  if (found) {
    return {
      offsets: Array.from({ length: found.decoded.length }, () => at),
      at: at + found.entity.length,
      position: position + found.decoded.length,
    };
  }
  if (body[at] === char) {
    return { offsets: [at], at: at + 1, position: position + 1 };
  }
  // どれにも該当しない本文の文字（記法の記号・字下げ・引用のマーカー）は飛ばす
  return { offsets: [], at: at + 1, position };
}

/** 本文の位置 `cursor` から、照合した文字を 1 文字ずつ本文へ当て、各文字の本文の位置と当て終えた位置を返却する */
export function alignText(options: {
  body: string;
  cursor: number;
  text: string;
}): { offsets: number[]; end: number } {
  const { body, text } = options;
  const offsets: number[] = [];
  let at = options.cursor;
  let position = 0;
  while (position < text.length) {
    const step = alignStep({ body, text, at, position });
    offsets.push(...step.offsets);
    at = step.at;
    position = step.position;
  }
  offsets.push(at);
  return { offsets, end: at };
}

/** リンクのタイトルの引用符なら、閉じの引用符の位置（引用符でないか閉じが無ければ `position`）。引用符の中の括弧は数えない */
function skipTitleQuote(options: {
  body: string;
  position: number;
  open: string;
}): number {
  const { body, position, open } = options;
  const char = body[position] ?? "";
  const quote =
    open === "(" &&
    (char === '"' || char === "'") &&
    /\s/.test(body[position - 1] ?? "");
  if (!quote) {
    return position;
  }
  const quoteEnd = body.indexOf(char, position + 1);
  return quoteEnd >= 0 ? quoteEnd : position;
}

/** `at` の開き括弧から、入れ子を数えて閉じ括弧の次の位置を返却する。閉じが無いときは開き括弧の次の位置 */
function skipGroup(options: {
  body: string;
  at: number;
  open: string;
  close: string;
}): number {
  const { body, at, open, close } = options;
  let depth = 0;
  for (let position = at; position < body.length; position++) {
    const char = body[position];
    if (char === "\\") {
      position += 1;
      continue;
    }
    position = skipTitleQuote({ body, position, open });
    if (char === open) {
      depth += 1;
    } else if (char === close && depth === 1) {
      return position + 1;
    } else if (char === close) {
      depth -= 1;
    }
  }
  return at + 1;
}

/** `from` 以降で行の中身が始まる位置を返却する。リストのマーカー・引用のマーカー・字下げを飛ばし、見つからなければ `from` */
function locateLine(body: string, from: number, line: string): number {
  const text = line.trimEnd();
  if (text === "") {
    return from;
  }
  const at = body.indexOf(text, from);
  return at < 0 ? from : at;
}

/** 行内のトークンの子を本文へ当てる間に参照する、本文と行内のトークンの行 */
type InlineContext = {
  body: string;
  /** 行内のトークンの最初の行の中身が始まる本文の位置 */
  first: number;
  /** 行内のトークンの中身の行 */
  lines: string[];
};

/** 子 1 つを本文へ当て、当て終えた位置を返却する */
type Advance = (child: Token, cursor: number, context: InlineContext) => number;

/** `[`・`(` で始まるリンク先・参照の名前を飛ばした位置 */
function skipDestination(body: string, cursor: number): number {
  if (body[cursor] === "(") {
    return skipGroup({ body, at: cursor, open: "(", close: ")" });
  }
  if (body[cursor] === "[") {
    return skipGroup({ body, at: cursor, open: "[", close: "]" });
  }
  return cursor;
}

/** 開きと同じ長さのバッククォートの連なりの閉じの次の位置（無ければ `undefined`） */
function codeClose(
  body: string,
  from: number,
  length: number,
): number | undefined {
  let at = from;
  while (at < body.length) {
    const next = body.indexOf("`", at);
    if (next < 0) {
      return undefined;
    }
    let run = next;
    while (body[run] === "`") {
      run += 1;
    }
    if (run - next === length) {
      return run;
    }
    at = run;
  }
  return undefined;
}

/** 行内のコード: 同じ長さのバッククォートの連なりが閉じ */
const advanceCode: Advance = (child, cursor, { body }) => {
  const open = body.indexOf(child.markup, cursor);
  if (open < 0) {
    return cursor;
  }
  const from = open + child.markup.length;
  return (
    codeClose(body, from, child.markup.length) ??
    open + child.markup.length * 2 + child.content.length
  );
};

/** リンクの開き: 自動リンクは `<`、リンクは `[` の次へ（自動で付けたリンクは本文に記号が無い） */
const advanceLinkOpen: Advance = (child, cursor, { body }) => {
  if (child.markup === "autolink") {
    return Math.max(cursor, body.indexOf("<", cursor) + 1);
  }
  if (child.markup === "linkify") {
    return cursor;
  }
  return Math.max(cursor, body.indexOf("[", cursor) + 1);
};

/** リンクの閉じ: 自動リンクの `>`、リンクの `]` とリンク先・参照の名前の次へ */
const advanceLinkClose: Advance = (child, cursor, { body }) => {
  if (child.markup === "linkify") {
    return cursor;
  }
  if (body[cursor] === ">") {
    return cursor + 1;
  }
  const close = body.indexOf("]", cursor);
  return close < 0 ? cursor : skipDestination(body, close + 1);
};

/** 画像: `![…]` とリンク先・参照の名前の次へ */
const advanceImage: Advance = (_, cursor, { body }) => {
  const open = body.indexOf("![", cursor);
  if (open < 0) {
    return cursor;
  }
  return skipDestination(
    body,
    skipGroup({ body, at: open + 1, open: "[", close: "]" }),
  );
};

/** 改行: 次の行の中身から始める（その行の頭の記号を飛ばす） */
const advanceBreak: Advance = (_, cursor, { body, first, lines }) => {
  const newline = body.indexOf("\n", cursor);
  const next = newline < 0 ? body.length : newline + 1;
  const passed = body.slice(first, next).split("\n").length - 1;
  return locateLine(body, next, lines[passed] ?? "");
};

/** 行内の HTML: 同じ文字の次へ */
const advanceHtml: Advance = (child, cursor, { body }) => {
  const at = body.indexOf(child.content, cursor);
  return at >= 0 ? at + child.content.length : cursor;
};

/** 強調などの記号: 本文の位置から記号が始まれば、その次へ */
const advanceMarkup: Advance = (child, cursor, { body }) =>
  child.markup !== "" && body.startsWith(child.markup, cursor)
    ? cursor + child.markup.length
    : cursor;

/** 子のトークンの種類ごとの当て方（`text` を除く。無い種類は記号として当てる） */
const ADVANCES = new Map<string, Advance>([
  ["code_inline", advanceCode],
  ["link_open", advanceLinkOpen],
  ["link_close", advanceLinkClose],
  ["image", advanceImage],
  ["softbreak", advanceBreak],
  ["hardbreak", advanceBreak],
  ["html_inline", advanceHtml],
]);

/** 行内のトークンの子を頭から本文へ当て、照合してよい `text` の子ごとに各文字の本文の位置を返却する */
export function inlineOffsets(options: {
  body: string;
  inline: Token;
  start: number;
}): { byChild: Map<number, number[]>; end: number } {
  const { body, inline } = options;
  const keep = new Set(matchableChildren(inline));
  const byChild = new Map<number, number[]>();
  const lines = inline.content.split("\n");
  const first = locateLine(body, options.start, lines[0] ?? "");
  const context: InlineContext = { body, first, lines };
  let cursor = first;
  (inline.children ?? []).forEach((child, position) => {
    if (child.type !== "text") {
      cursor = (ADVANCES.get(child.type) ?? advanceMarkup)(
        child,
        cursor,
        context,
      );
      return;
    }
    const aligned = alignText({ body, cursor, text: child.content });
    if (keep.has(position)) {
      byChild.set(position, aligned.offsets);
    }
    cursor = aligned.end;
  });
  return { byChild, end: cursor };
}

/** `from` の次から、同じ名前の要素の入れ子を数えて閉じタグの次の位置を返却する。閉じが無いときは文字列の終わり */
function elementEnd(html: string, from: number, name: string): number {
  const pattern = new RegExp(
    `<(/?)${name}(?![A-Za-z0-9-])((?:"[^"]*"|'[^']*'|[^'">])*)>`,
    "gi",
  );
  pattern.lastIndex = from;
  let depth = 1;
  for (let found = pattern.exec(html); found; found = pattern.exec(html)) {
    if (found[1] === "/") {
      depth -= 1;
      if (depth === 0) {
        return pattern.lastIndex;
      }
    } else if (!found[2]?.endsWith("/")) {
      depth += 1;
    }
  }
  return html.length;
}

/** 伏せる範囲と、開いている要素の名前（外側から） */
type MaskState = { hidden: Uint8Array; open: string[] };

/** 位置から始まる範囲を伏せ、伏せた次の位置を返却する。範囲が始まらなければ `undefined` */
type Masker = (
  html: string,
  at: number,
  state: MaskState,
) => number | undefined;

/** コメントを伏せる */
const maskComment: Masker = (html, at, { hidden }) => {
  if (!html.startsWith("<!--", at)) {
    return undefined;
  }
  const close = html.indexOf("-->", at + 4);
  const end = close < 0 ? html.length : close + 3;
  hidden.fill(1, at, end);
  return end;
};

/** 正規表現が位置から一致する範囲を伏せる */
const maskPattern =
  (pattern: RegExp): Masker =>
  (html, at, { hidden }) => {
    pattern.lastIndex = at;
    const found = pattern.exec(html);
    if (!found) {
      return undefined;
    }
    hidden.fill(1, at, at + found[0].length);
    return at + found[0].length;
  };

/** タグを伏せる。閉じタグは同じ名前の一番内側の開いている要素までを閉じ、中身ごと落ちる要素は開きから閉じまでを伏せる */
const maskTag: Masker = (html, at, { hidden, open }) => {
  TAG_PATTERN.lastIndex = at;
  const tag = TAG_PATTERN.exec(html);
  if (!tag) {
    return undefined;
  }
  const name = (tag[2] as string).toLowerCase();
  const end = at + tag[0].length;
  hidden.fill(1, at, end);
  if (tag[1] === "/") {
    const position = open.lastIndexOf(name);
    if (position >= 0) {
      open.length = position;
    }
    return end;
  }
  if ((tag[3] ?? "").endsWith("/") || VOID_TAGS.has(name)) {
    return end;
  }
  if (DROPPED_TAGS.has(name)) {
    const close = elementEnd(html, end, name);
    hidden.fill(1, at, close);
    return close;
  }
  open.push(name);
  return end;
};

/** `<` から始まる範囲の伏せ方を、試す順に並べたもの。図の部品の custom element は、定義ごと落ちる */
const MASKERS: Masker[] = [
  maskComment,
  maskPattern(PART_AT_PATTERN),
  maskTag,
  maskPattern(DECLARATION_PATTERN),
];

/** 位置から始まる `<` の範囲を伏せ、伏せた次の位置を返却する（どれも始まらなければ `undefined`） */
function maskMarkup(
  html: string,
  at: number,
  state: MaskState,
): number | undefined {
  for (const mask of MASKERS) {
    const next = mask(html, at, state);
    if (next !== undefined) {
      return next;
    }
  }
  return undefined;
}

/** 埋め込んだ HTML のうち、照合に渡らない範囲を、どの文字にも該当しない文字で伏せた同じ長さの文字列を返却する */
export function maskEmbeddedHtml(html: string): string {
  const state: MaskState = { hidden: new Uint8Array(html.length), open: [] };
  let at = 0;
  while (at < html.length) {
    const next = html[at] === "<" ? maskMarkup(html, at, state) : undefined;
    if (next !== undefined) {
      at = next;
      continue;
    }
    // 照合しない要素が直接持つ文字は伏せる（一番内側の要素で判定する）
    const innermost = state.open.at(-1);
    if (innermost !== undefined && TEXT_FILTER_SKIP_TAGS.has(innermost)) {
      state.hidden[at] = 1;
    }
    at += 1;
  }
  let masked = "";
  for (let position = 0; position < html.length; position++) {
    masked += state.hidden[position] ? MASK_CHAR : html[position];
  }
  return masked;
}
