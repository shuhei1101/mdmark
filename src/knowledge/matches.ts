import type { Token } from "markdown-it";
import { type MdmarkConfig, resolveConfig } from "../config.ts";
import { DIAGRAM_DIRECTIVES } from "../diagram/definition.ts";
import { sanitizeEmbedded } from "../render/sanitize.ts";
import { jsonFences } from "../render/syntax/diagrams.ts";
import {
  isHtmlFence,
  PART_PATTERN,
  unescapeHtml,
} from "../render/syntax/html.ts";
import { findClose, markOf } from "../render/syntax/tokens.ts";
import {
  buildDictionary,
  type Dictionary,
  findWords,
  forEachInline,
} from "./dictionary.ts";
import { type MdmarkIndex, normalizeIndex } from "./index-shape.ts";
import { normalizePath } from "./paths.ts";
import { alignText, inlineOffsets, maskEmbeddedHtml } from "./positions.ts";
import { parseDocument } from "./references.ts";

/** `collectMatches` が返す参照先 1 つ */
export type MdmarkMatchTarget = {
  /** 参照先の種類。`term` は索引の用語、`glossary` は用語集の表の用語、`doc` は別名が一致した文書 */
  kind: "term" | "glossary" | "doc";
  /** `term` は `terms[].id`、`glossary` は `glossary:{表を持つ文書の id}:{用語}`、`doc` は `docs[].id` */
  id: string;
  /** `term` は `terms[].term`、`glossary` は用語の列、`doc` は `docs[].title` */
  title: string;
  /** `term` は `terms[].meaning`、`glossary` は意味の列、`doc` は `docs[].description`。無いときはキーを持たない */
  description?: string;
};

/** 本文の 1 つの一致とその参照先 */
export type MdmarkMatch = MdmarkMatchTarget & {
  /** 一致した文字列（照合した辞書の語） */
  text: string;
  /** 本文の Markdown の行（1 から） */
  line: number;
  /** その行の中の始まり（0 から数える UTF-16 の位置） */
  start: number;
  /** その行の中の終わり（含まない）。実体参照やエスケープで書いた文字は、本文に書いたままの範囲を指す */
  end: number;
};

/** `collectMatches` の戻り値 */
export type MdmarkMatches = {
  /** 文書の `id` から、本文の一致を本文の頭からの順に並べたもの。本文のある索引の文書だけをキーに持つ */
  byDocument: Record<string, MdmarkMatch[]>;
  /** 全ての文書の参照先を `kind` と `id` の組で重なりを除いたもの */
  targets: MdmarkMatchTarget[];
};

/** 本文の頭からの位置で表した、一致した語の範囲 */
type Found = {
  word: string;
  offset: number;
  end: number;
  /** 図の部品の `{{語}}` の一致か（用語だけを引き、文書の別名は引かない） */
  termOnly?: boolean;
};

/** 語の終わりの本文の位置。次の文字の位置までに飛ばした改行の `\r` は含めない */
function wordEnd(options: {
  body: string;
  offsets: number[];
  end: number;
}): number {
  const { body, offsets } = options;
  const previous = offsets[options.end - 1] as number;
  let end = offsets[options.end] as number;
  while (end > previous + 1 && body[end - 1] === "\r") {
    end -= 1;
  }
  return end;
}

/** 本文の各行の頭の、本文の頭からの位置 */
function lineStartsOf(body: string): number[] {
  const starts = [0];
  for (let at = body.indexOf("\n"); at >= 0; at = body.indexOf("\n", at + 1)) {
    starts.push(at + 1);
  }
  return starts;
}

/** 本文の頭からの位置が属する行の番号（0 から）。行の頭の位置を二分探索する */
function lineIndexOf(lineStarts: number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((lineStarts[middle] as number) <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

/** 印の範囲ごとに、範囲の中のトークンを返す（範囲の見つけ方は描く処理と同じ） */
function markedRanges(
  tokens: Token[],
  accept: (name: string) => boolean,
): Token[][] {
  const ranges: Token[][] = [];
  for (let index = 0; index < tokens.length; index++) {
    const mark = markOf(tokens[index]);
    if (!mark || mark.closing || !accept(mark.name)) {
      continue;
    }
    const closeIndex = findClose(tokens, index, mark.name);
    const end = closeIndex < 0 ? tokens.length : closeIndex;
    ranges.push(tokens.slice(index + 1, end));
    index = end;
  }
  return ranges;
}

/** コードブロックの中身の、本文の頭からの範囲。閉じの行は含まない */
function fenceRange(options: {
  fence: Token;
  body: string;
  lineStarts: number[];
}): { from: number; to: number } | undefined {
  const { fence, body, lineStarts } = options;
  const [first, last] = fence.map ?? [];
  if (first === undefined || last === undefined) {
    return undefined;
  }
  const lines = body.split("\n");
  const closed =
    last - 1 > first && (lines[last - 1] ?? "").trim().startsWith(fence.markup);
  return {
    from: lineStarts[first + 1] ?? body.length,
    to: (closed ? lineStarts[last - 1] : lineStarts[last]) ?? body.length,
  };
}

/** 範囲に置いたコードブロックが 1 つだけならその範囲と中身を返す */
function singleFenceRange(options: {
  range: Token[];
  isFence: (token: Token) => boolean;
  body: string;
  lineStarts: number[];
}): { from: number; to: number; fence: Token } | undefined {
  const { range, isFence, body, lineStarts } = options;
  const fences = range.filter(isFence);
  const [fence] = fences;
  if (fences.length !== 1 || fence === undefined) {
    return undefined;
  }
  const span = fenceRange({ fence, body, lineStarts });
  return span === undefined ? undefined : { ...span, fence };
}

/** `<!-- html -->` の範囲の `html` のコードブロックの文字を、描くときと同じ範囲で照合し、本文の位置を返す */
export function embeddedHtmlMatches(options: {
  body: string;
  tokens: Token[];
  dictionary: Dictionary;
}): Found[] {
  const { body, tokens, dictionary } = options;
  if (dictionary.words.length === 0) {
    return [];
  }
  const lineStarts = lineStartsOf(body);
  const found: Found[] = [];
  for (const range of markedRanges(tokens, (name) => name === "html")) {
    const block = singleFenceRange({
      range,
      isFence: isHtmlFence,
      body,
      lineStarts,
    });
    if (block === undefined) {
      continue;
    }
    // 図の部品の custom element を除いた HTML を、描くときと同じ関数に通す
    const source = block.fence.content.replace(PART_PATTERN, "");
    const masked = maskEmbeddedHtml(body.slice(block.from, block.to));
    // 受けた文字の代わりに印を返し、出力に残った印の文字だけを照合する（要素ごと落ちる文字は出力に残らない）
    let open = "";
    while (source.includes(open)) {
      open += "";
    }
    const close = "";
    const pieces: string[] = [];
    const sanitized = sanitizeEmbedded(source, (text) => {
      pieces.push(text);
      return `${open}${pieces.length - 1}${close}`;
    });
    const kept = new Set(
      [...sanitized.matchAll(new RegExp(`${open}(\\d+)${close}`, "g"))].map(
        (match) => Number(match[1]),
      ),
    );
    let cursor = 0;
    pieces.forEach((piece, position) => {
      if (!kept.has(position)) {
        return;
      }
      const text = unescapeHtml(piece);
      const aligned = alignText({ body: masked, cursor, text });
      cursor = aligned.end;
      for (const word of findWords(text, dictionary.words)) {
        found.push({
          word: word.word,
          offset: block.from + (aligned.offsets[word.start] as number),
          end:
            block.from +
            wordEnd({ body: masked, offsets: aligned.offsets, end: word.end }),
        });
      }
    });
  }
  return found;
}

/** 定義の JSON の文字列を、戻した文字と各文字の元の位置で返す。位置は `raw` の頭からの位置 */
function jsonStrings(raw: string): Array<{
  text: string;
  starts: number[];
  ends: number[];
}> {
  const strings: Array<{ text: string; starts: number[]; ends: number[] }> = [];
  const simple: Record<string, string> = {
    '"': '"',
    "\\": "\\",
    "/": "/",
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
  };
  let at = 0;
  while (at < raw.length) {
    if (raw[at] !== '"') {
      at += 1;
      continue;
    }
    let text = "";
    const starts: number[] = [];
    const ends: number[] = [];
    let position = at + 1;
    let closed = false;
    while (position < raw.length) {
      const char = raw[position] as string;
      if (char === '"') {
        closed = true;
        break;
      }
      let length = 1;
      let decoded = char;
      if (char === "\\") {
        const next = raw[position + 1] ?? "";
        const hex = raw.slice(position + 2, position + 6);
        if (next === "u" && /^[0-9a-fA-F]{4}$/.test(hex)) {
          decoded = String.fromCharCode(Number.parseInt(hex, 16));
          length = 6;
        } else {
          decoded = simple[next] ?? next;
          length = 2;
        }
      }
      text += decoded;
      for (let count = 0; count < decoded.length; count++) {
        starts.push(position);
        ends.push(position + length);
      }
      position += length;
    }
    if (closed) {
      strings.push({ text, starts, ends });
    }
    at = position + 1;
  }
  return strings;
}

/** 定義の JSON（`raw`。本文の `base` の位置から始まる）の `{{語}}` のうち、意味のある用語の位置を返す */
function definitionTerms(options: {
  raw: string;
  base: number;
  dictionary: Dictionary;
}): Found[] {
  const { raw, base, dictionary } = options;
  const found: Found[] = [];
  for (const string of jsonStrings(raw)) {
    for (const match of string.text.matchAll(/\{\{(.+?)\}\}/g)) {
      const word = match[1] as string;
      const meaning = dictionary.terms.get(word)?.meaning;
      if (meaning === undefined || meaning === "") {
        continue;
      }
      const first = match.index + 2;
      const last = first + word.length - 1;
      found.push({
        word,
        offset: base + (string.starts[first] as number),
        end: base + (string.ends[last] as number),
        termOnly: true,
      });
    }
  }
  return found;
}

/** 図の部品の範囲の定義と、埋め込んだ HTML の中の custom element の定義の `{{語}}` のうち、意味のある用語の位置を返す */
export function diagramTermMatches(options: {
  body: string;
  tokens: Token[];
  dictionary: Dictionary;
  html: boolean;
}): Found[] {
  const { body, tokens, dictionary, html } = options;
  if (dictionary.words.length === 0) {
    return [];
  }
  const lineStarts = lineStartsOf(body);
  const found: Found[] = [];
  // 図の部品の印の範囲の `json` のコードブロック
  const directives = (name: string): boolean =>
    Object.hasOwn(DIAGRAM_DIRECTIVES, name);
  for (const range of markedRanges(tokens, directives)) {
    const block = singleFenceRange({
      range,
      isFence: (token) => jsonFences([token]).length === 1,
      body,
      lineStarts,
    });
    if (block !== undefined) {
      found.push(
        ...definitionTerms({
          raw: body.slice(block.from, block.to),
          base: block.from,
          dictionary,
        }),
      );
    }
  }
  if (!html) {
    return found;
  }
  // 埋め込んだ HTML の中の図の部品の custom element
  for (const range of markedRanges(tokens, (name) => name === "html")) {
    const block = singleFenceRange({
      range,
      isFence: isHtmlFence,
      body,
      lineStarts,
    });
    if (block === undefined) {
      continue;
    }
    const source = body.slice(block.from, block.to);
    for (const part of source.matchAll(new RegExp(PART_PATTERN))) {
      const definition = part[2] as string;
      found.push(
        ...definitionTerms({
          raw: definition,
          base: block.from + part.index + part[0].indexOf(">") + 1,
          dictionary,
        }),
      );
    }
  }
  return found;
}

/** 地の文（コード・リンク・見出し・用語集の表の中を除く）の一致を、本文の位置で返す */
function paragraphMatches(options: {
  body: string;
  tokens: Token[];
  dictionary: Dictionary;
  lineStarts: number[];
}): Found[] {
  const { body, tokens, dictionary, lineStarts } = options;
  const found: Found[] = [];
  let previous: { line: number; end: number } | undefined;
  forEachInline(tokens, (inline) => {
    const line = inline.map?.[0] ?? 0;
    // 同じ行から始まる行内のトークン（表のセル）は、前のセルを当て終えた位置から始める
    const start =
      previous?.line === line ? previous.end : (lineStarts[line] ?? 0);
    const aligned = inlineOffsets({ body, inline, start });
    previous = { line, end: aligned.end };
    for (const [position, offsets] of aligned.byChild) {
      const content = inline.children?.[position]?.content ?? "";
      for (const word of findWords(content, dictionary.words)) {
        found.push({
          word: word.word,
          offset: offsets[word.start] as number,
          end: wordEnd({ body, offsets, end: word.end }),
        });
      }
    }
  });
  return found;
}

/** 索引と文書の本文から、文書ごとの本文の一致と、重なりを除いた参照先を返す */
export function collectMatches(input: {
  /** 索引 */
  index: MdmarkIndex;
  /** 文書のパスから本文を引く表 */
  documents: Record<string, string>;
  /** 設定 */
  config?: MdmarkConfig;
}): MdmarkMatches {
  const { index } = normalizeIndex(input.index);
  const defaults = resolveConfig({ config: input.config }).features;
  const bodies = new Map(
    Object.entries(input.documents).map(([path, body]) => [
      normalizePath(path),
      body,
    ]),
  );
  const scanned = index.docs.flatMap((doc) => {
    const body = bodies.get(normalizePath(doc.path));
    return body === undefined
      ? []
      : [
          {
            doc,
            body,
            parsed: parseDocument({ body, docId: doc.id, defaults }),
          },
        ];
  });
  const glossary = scanned.flatMap((item) =>
    item.parsed.glossary.map((row) => row.entry),
  );
  // 辞書が返す用語の `id` から、参照先の種類・タイトル・説明を引く
  const termTargets = new Map<string, MdmarkMatchTarget>();
  for (const entry of glossary) {
    const id = `glossary:${entry.docId}:${entry.term}`;
    termTargets.set(id, {
      kind: "glossary",
      id,
      title: entry.term,
      description: entry.meaning,
    });
  }
  for (const term of index.terms ?? []) {
    termTargets.set(term.id, {
      kind: "term",
      id: term.id,
      title: term.term,
      description: term.meaning,
    });
  }
  const byDocument: Record<string, MdmarkMatch[]> = {};
  const targets = new Map<string, MdmarkMatchTarget>();
  for (const { doc, body, parsed } of scanned) {
    const dictionary = buildDictionary({
      index,
      docId: doc.id,
      ownGlossary: parsed.glossary.map((row) => row.entry),
      references: { backlinks: {}, glossary },
      features: parsed.features,
    });
    const lineStarts = lineStartsOf(body);
    const found: Found[] = [];
    if (dictionary.words.length > 0) {
      const { tokens } = parsed;
      found.push(...paragraphMatches({ body, tokens, dictionary, lineStarts }));
      if (parsed.features.html === true) {
        found.push(...embeddedHtmlMatches({ body, tokens, dictionary }));
      }
      if (parsed.features.diagrams === true) {
        found.push(
          ...diagramTermMatches({
            body,
            tokens,
            dictionary,
            html: parsed.features.html === true,
          }),
        );
      }
    }
    // 本文の頭からの順に並べる（同じ位置は用語、文書の順）
    found.sort((a, b) => a.offset - b.offset);
    const matches: MdmarkMatch[] = [];
    for (const { word, offset, end, termOnly } of found) {
      const lineIndex = lineIndexOf(lineStarts, offset);
      const position = {
        text: word,
        line: lineIndex + 1,
        start: offset - (lineStarts[lineIndex] as number),
        end: end - (lineStarts[lineIndex] as number),
      };
      const referenced: MdmarkMatchTarget[] = [];
      const term = dictionary.terms.get(word);
      const termTarget =
        term === undefined ? undefined : termTargets.get(term.id);
      if (termTarget !== undefined) {
        referenced.push(termTarget);
      }
      for (const target of termOnly ? [] : (dictionary.docs.get(word) ?? [])) {
        referenced.push({
          kind: "doc",
          id: target.id,
          title: target.title,
          ...(target.description === undefined
            ? {}
            : { description: target.description }),
        });
      }
      for (const target of referenced) {
        matches.push({ ...target, ...position });
        targets.set(`${target.kind}\0${target.id}`, target);
      }
    }
    byDocument[doc.id] = matches;
  }
  return { byDocument, targets: [...targets.values()] };
}
