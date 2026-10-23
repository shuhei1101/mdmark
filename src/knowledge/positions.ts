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

/** 実体参照の最長の長さ（名前つきの実体参照の最長に余裕を足した値） */
const ENTITY_MAX_LENGTH = 40;

/** 伏せた範囲を埋める文字。どの文字にも当たらない */
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

/** 本文の位置 `cursor` から、照合した文字を 1 文字ずつ本文へ当て、各文字の本文の位置と当て終えた位置を返す */
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
    // 本文の最後まで探しても当たらない文字は、本文の終わりを指す
    if (at >= body.length) {
      offsets.push(body.length);
      position += 1;
      continue;
    }
    const char = text[position] as string;
    // エスケープ（`\*`）は 2 文字で 1 文字
    if (body[at] === "\\" && body[at + 1] === char) {
      offsets.push(at);
      at += 2;
      position += 1;
      continue;
    }
    // 実体参照は、戻した文字の長さぶん同じ位置を指す
    if (body[at] === "&") {
      const entity = ENTITY_PATTERN.exec(
        body.slice(at, at + ENTITY_MAX_LENGTH),
      )?.[0];
      const decoded = entity === undefined ? undefined : unescapeAll(entity);
      if (
        entity !== undefined &&
        decoded !== undefined &&
        decoded !== entity &&
        text.startsWith(decoded, position)
      ) {
        for (let count = 0; count < decoded.length; count++) {
          offsets.push(at);
        }
        at += entity.length;
        position += decoded.length;
        continue;
      }
    }
    if (body[at] === char) {
      offsets.push(at);
      at += 1;
      position += 1;
      continue;
    }
    // どれにも当たらない本文の文字（記法の記号・字下げ・引用の印）は飛ばす
    at += 1;
  }
  offsets.push(at);
  return { offsets, end: at };
}

/** `at` の開き括弧から、入れ子を数えて閉じ括弧の次の位置を返す。閉じが無いときは開き括弧の次の位置 */
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
    } else if (
      open === "(" &&
      (char === '"' || char === "'") &&
      /\s/.test(body[position - 1] ?? "")
    ) {
      // リンクの題の引用符の中の括弧は数えない
      const quoteEnd = body.indexOf(char, position + 1);
      if (quoteEnd >= 0) {
        position = quoteEnd;
      }
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return position + 1;
      }
    }
  }
  return at + 1;
}

/** `from` 以降で行の中身が始まる位置を返す。リストの印・引用の印・字下げを飛ばし、見つからなければ `from` */
function locateLine(body: string, from: number, line: string): number {
  const text = line.trimEnd();
  if (text === "") {
    return from;
  }
  const at = body.indexOf(text, from);
  return at < 0 ? from : at;
}

/** 行内のトークンの子を頭から本文へ当て、照合してよい `text` の子ごとに各文字の本文の位置を返す */
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
  let cursor = first;
  (inline.children ?? []).forEach((child, position) => {
    switch (child.type) {
      case "text": {
        const aligned = alignText({ body, cursor, text: child.content });
        if (keep.has(position)) {
          byChild.set(position, aligned.offsets);
        }
        cursor = aligned.end;
        break;
      }
      case "code_inline": {
        const open = body.indexOf(child.markup, cursor);
        if (open < 0) {
          break;
        }
        // 同じ長さのバッククォートの連なりが閉じ
        let at = open + child.markup.length;
        let closed = false;
        while (at < body.length && !closed) {
          const next = body.indexOf("`", at);
          if (next < 0) {
            break;
          }
          let run = next;
          while (body[run] === "`") {
            run += 1;
          }
          closed = run - next === child.markup.length;
          at = run;
        }
        cursor = closed
          ? at
          : open + child.markup.length * 2 + child.content.length;
        break;
      }
      case "link_open":
        if (child.markup === "autolink") {
          cursor = Math.max(cursor, body.indexOf("<", cursor) + 1);
        } else if (child.markup !== "linkify") {
          cursor = Math.max(cursor, body.indexOf("[", cursor) + 1);
        }
        break;
      case "link_close": {
        if (child.markup === "linkify") {
          break;
        }
        if (body[cursor] === ">") {
          // 自動リンクの閉じ
          cursor += 1;
          break;
        }
        const close = body.indexOf("]", cursor);
        if (close < 0) {
          break;
        }
        cursor = close + 1;
        if (body[cursor] === "(") {
          cursor = skipGroup({ body, at: cursor, open: "(", close: ")" });
        } else if (body[cursor] === "[") {
          cursor = skipGroup({ body, at: cursor, open: "[", close: "]" });
        }
        break;
      }
      case "image": {
        const open = body.indexOf("![", cursor);
        if (open < 0) {
          break;
        }
        cursor = skipGroup({ body, at: open + 1, open: "[", close: "]" });
        if (body[cursor] === "(") {
          cursor = skipGroup({ body, at: cursor, open: "(", close: ")" });
        } else if (body[cursor] === "[") {
          cursor = skipGroup({ body, at: cursor, open: "[", close: "]" });
        }
        break;
      }
      case "softbreak":
      case "hardbreak": {
        const newline = body.indexOf("\n", cursor);
        const next = newline < 0 ? body.length : newline + 1;
        // 次の行の中身から始める（その行の頭の記号を飛ばす）
        const passed = body.slice(first, next).split("\n").length - 1;
        cursor = locateLine(body, next, lines[passed] ?? "");
        break;
      }
      case "html_inline": {
        const at = body.indexOf(child.content, cursor);
        if (at >= 0) {
          cursor = at + child.content.length;
        }
        break;
      }
      default:
        // 強調などの記号
        if (child.markup !== "" && body.startsWith(child.markup, cursor)) {
          cursor += child.markup.length;
        }
    }
  });
  return { byChild, end: cursor };
}

/** `from` の次から、同じ名前の要素の入れ子を数えて閉じタグの次の位置を返す。閉じが無いときは文字列の終わり */
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

/** 埋め込んだ HTML のうち、照合に渡らない範囲を、どの文字にも当たらない文字で伏せた同じ長さの文字列を返す */
export function maskEmbeddedHtml(html: string): string {
  const hidden = new Uint8Array(html.length);
  /** 開いている要素の名前（外側から） */
  const open: string[] = [];
  let at = 0;
  while (at < html.length) {
    if (html[at] === "<") {
      if (html.startsWith("<!--", at)) {
        const close = html.indexOf("-->", at + 4);
        const end = close < 0 ? html.length : close + 3;
        hidden.fill(1, at, end);
        at = end;
        continue;
      }
      // 図の部品の custom element は、定義ごと落ちる
      PART_AT_PATTERN.lastIndex = at;
      const part = PART_AT_PATTERN.exec(html);
      if (part) {
        hidden.fill(1, at, at + part[0].length);
        at += part[0].length;
        continue;
      }
      TAG_PATTERN.lastIndex = at;
      const tag = TAG_PATTERN.exec(html);
      if (tag) {
        const name = (tag[2] as string).toLowerCase();
        const end = at + tag[0].length;
        hidden.fill(1, at, end);
        if (tag[1] === "/") {
          // 閉じタグは、同じ名前の一番内側の開いている要素までを閉じる
          const position = open.lastIndexOf(name);
          if (position >= 0) {
            open.length = position;
          }
          at = end;
        } else if ((tag[3] ?? "").endsWith("/") || VOID_TAGS.has(name)) {
          at = end;
        } else if (DROPPED_TAGS.has(name)) {
          // 中身ごと落ちる要素は、開きから閉じまでを伏せる
          const close = elementEnd(html, end, name);
          hidden.fill(1, at, close);
          at = close;
        } else {
          open.push(name);
          at = end;
        }
        continue;
      }
      DECLARATION_PATTERN.lastIndex = at;
      const declaration = DECLARATION_PATTERN.exec(html);
      if (declaration) {
        hidden.fill(1, at, at + declaration[0].length);
        at += declaration[0].length;
        continue;
      }
    }
    // 照合しない要素が直接持つ文字は伏せる（一番内側の要素で判定する）
    const innermost = open[open.length - 1];
    if (innermost !== undefined && TEXT_FILTER_SKIP_TAGS.has(innermost)) {
      hidden[at] = 1;
    }
    at += 1;
  }
  let masked = "";
  for (let position = 0; position < html.length; position++) {
    masked += hidden[position] ? MASK_CHAR : html[position];
  }
  return masked;
}
