import type { Token } from "markdown-it";
import { type MdmarkConfig, resolveConfig } from "../config.ts";
import { DIAGRAM_DIRECTIVES } from "../diagram/definition.ts";
import { sanitizeEmbedded } from "../render/sanitize.ts";
import { isRetiredDiagram, jsonFences } from "../render/syntax/diagrams.ts";
import {
  isHtmlFence,
  PART_PATTERN,
  unescapeHtml,
} from "../render/syntax/html.ts";
import { findClose, markOf } from "../render/syntax/tokens.ts";
import type { MdmarkAlias, MdmarkAliasType } from "./aliases.ts";
import {
  buildDictionary,
  type Dictionary,
  findWords,
  forEachInline,
  normalizeWord,
} from "./dictionary.ts";
import { type MdmarkIndex, normalizeIndex } from "./index-shape.ts";
import { normalizePath } from "./paths.ts";
import { alignText, inlineOffsets, maskEmbeddedHtml } from "./positions.ts";
import { type MdmarkGlossaryEntry, parseDocument } from "./references.ts";

/** `collectMatches` が返却する参照先 1 つ */
export type MdmarkMatchTarget = {
  /** 参照先の種類。`term` は索引の用語、`glossary` は用語集の表の用語、`doc` は別名が一致した文書、`alias` は指定したエイリアス */
  kind: "term" | "glossary" | "doc" | "alias";
  /** `term` は `terms[].id`、`glossary` は `glossary:{表を持つ文書の id}:{用語}`、`doc` は `docs[].id`、`alias` はエイリアスの `id` */
  id: string;
  /** `term` は `terms[].term`、`glossary` は用語の列、`doc` は `docs[].title`、`alias` はエイリアスの `name` */
  title: string;
  /** `term` は `terms[].meaning`、`glossary` は意味の列、`doc` は `docs[].description`、`alias` はエイリアスの `description`。無いときはキーを持たない */
  description?: string;
  /** エイリアスの `alias_type`。`kind` が `alias` のときだけ持つ */
  aliasType?: Exclude<MdmarkAliasType, "avoid">;
};

/** 本文の 1 つの一致とその参照先 */
export type MdmarkMatch = MdmarkMatchTarget & {
  /** 一致した文字列（照合した辞書の単語） */
  text: string;
  /** 本文の Markdown の行（1 から） */
  line: number;
  /** その行の中の始まり（0 から数える UTF-16 の位置） */
  start: number;
  /** その行の中の終わり（含まない）。実体参照やエスケープで記載した文字は、本文に記載したままの範囲を指す */
  end: number;
};

/** 本文に出たやめた言い方 1 つと、代わりの用語 */
export type MdmarkAvoidedMatch = Omit<MdmarkMatch, "kind" | "aliasType"> & {
  /** 代わりの用語の種類。`MdmarkMatchTarget` の `term`・`glossary` と同じ。`alias` は `term` の種類のエイリアスの `avoid` か `avoid` の種類のエイリアスで、`avoid` の種類は `title` を `replacement` にし `description` を持たない */
  kind: "term" | "glossary" | "alias";
  /** エイリアスの `alias_type`。`kind` が `alias` のときだけ持つ */
  aliasType?: "term" | "avoid";
};

/** `collectMatches` の戻り値 */
export type MdmarkMatches = {
  /** 文書の `id` から、本文の一致を本文の頭からの順に並べたもの。本文のある索引の文書だけをキーに持つ */
  byDocument: Record<string, MdmarkMatch[]>;
  /** 文書の `id` から、本文に出たやめた言い方を本文の頭からの順に並べたもの。キーは `byDocument` と同じで、やめた言い方が無い文書と `glossary` がオフの文書は空の並び */
  avoided: Record<string, MdmarkAvoidedMatch[]>;
  /** 全ての文書の参照先を `kind` と `id` の組で重なりを除いたもの */
  targets: MdmarkMatchTarget[];
};

/** 本文の頭からの位置で表した、一致した単語の範囲 */
type Found = {
  /** 辞書に記載した表記（本文の表記とは限らない） */
  word: string;
  /** 辞書を参照する正規化した単語 */
  key: string;
  offset: number;
  end: number;
  /** 図の部品の `{{単語}}` の一致か（用語だけを引き、文書の別名は参照しない） */
  termOnly?: boolean;
};

/** 単語の終わりの本文の位置。次の文字の位置までに飛ばした改行の `\r` は含めない */
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

/** マーカーの範囲ごとに、範囲の中のトークンを返却する（範囲の見つけ方は描く処理と同じ） */
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

/** 範囲に配置したコードブロックが 1 つだけならその範囲と中身を返却する */
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

/** `<!-- html -->` の範囲の `html` のコードブロックの文字を、描くときと同じ範囲で照合し、本文の位置を返却する */
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
    // 図の部品の custom element を除いた HTML を、描くときと同じ関数に経由する
    const source = block.fence.content.replace(PART_PATTERN, "");
    const masked = maskEmbeddedHtml(body.slice(block.from, block.to));
    // 受けた文字の代わりにマーカーを返却し、出力に残ったマーカーの文字だけを照合する（要素ごと落ちる文字は出力に残らない）
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
          word: dictionary.written.get(word.word) ?? word.word,
          key: word.word,
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

/** JSON の文字列の 1 文字だけのエスケープの読み */
const JSON_SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

/** 文字列の中の位置の 1 文字（エスケープはその読み）と、元の文字列での長さ */
function decodeJsonChar(
  raw: string,
  position: number,
): { decoded: string; length: number } {
  const char = raw[position] as string;
  if (char !== "\\") {
    return { decoded: char, length: 1 };
  }
  const next = raw[position + 1] ?? "";
  const hex = raw.slice(position + 2, position + 6);
  if (next === "u" && /^[0-9a-fA-F]{4}$/.test(hex)) {
    return {
      decoded: String.fromCharCode(Number.parseInt(hex, 16)),
      length: 6,
    };
  }
  return { decoded: JSON_SIMPLE_ESCAPES[next] ?? next, length: 2 };
}

/** `"` の次の位置から閉じる `"` までの文字列を読み、読んだ文字列と文字ごとの元の位置、閉じる `"` の位置を返却する（閉じなければ `closed` が偽） */
function readJsonString(
  raw: string,
  from: number,
): {
  string: { text: string; starts: number[]; ends: number[] };
  closed: boolean;
  end: number;
} {
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let position = from;
  while (position < raw.length && raw[position] !== '"') {
    const { decoded, length } = decodeJsonChar(raw, position);
    text += decoded;
    for (let count = 0; count < decoded.length; count++) {
      starts.push(position);
      ends.push(position + length);
    }
    position += length;
  }
  return {
    string: { text, starts, ends },
    closed: position < raw.length,
    end: position,
  };
}

/** 定義の JSON の文字列を、戻した文字と各文字の元の位置で返却する。位置は `raw` の頭からの位置 */
function jsonStrings(raw: string): Array<{
  text: string;
  starts: number[];
  ends: number[];
}> {
  const strings: Array<{ text: string; starts: number[]; ends: number[] }> = [];
  let at = 0;
  while (at < raw.length) {
    if (raw[at] !== '"') {
      at += 1;
      continue;
    }
    const read = readJsonString(raw, at + 1);
    if (read.closed) {
      strings.push(read.string);
    }
    at = read.end + 1;
  }
  return strings;
}

/** 定義の JSON（`raw`。本文の `base` の位置から始まる）の `{{単語}}` のうち、意味のある用語の位置を返却する */
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
      const meaning = dictionary.term(word)?.meaning;
      if (meaning === undefined || meaning === "") {
        continue;
      }
      const first = match.index + 2;
      const last = first + word.length - 1;
      found.push({
        word: dictionary.written.get(normalizeWord(word)) ?? word,
        key: normalizeWord(word),
        offset: base + (string.starts[first] as number),
        end: base + (string.ends[last] as number),
        termOnly: true,
      });
    }
  }
  return found;
}

/** 図の部品の範囲の定義と、埋め込んだ HTML の中の custom element の定義の `{{単語}}` のうち、意味のある用語の位置を返却する */
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
  // 図の部品のマーカーの範囲の `json` のコードブロック
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
      // 廃止した図の要素は描かないため、照合しない
      if (isRetiredDiagram((part[1] as string).toLowerCase())) {
        continue;
      }
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

/** flowchart の行の中の、角括弧・丸括弧・波括弧・`|` で囲んだラベルの文字（開きの記号の後ろの位置と文字） */
const FLOW_LABEL =
  /\(\[([^\]]*)\]\)|\[\(([^)]*)\)\]|\[\[([^\]]*)\]\]|\(\(([^)]*)\)\)|\{\{([^}]*)\}\}|\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\|([^|]*)\|/g;

/** flowchart の照合しない行（線の飾り・リンク・注記） */
const FLOW_SKIPPED =
  /^\s*(classDef|class|style|linkStyle|click|accTitle|accDescr|%%)\b/;

/** sequenceDiagram の名前とメッセージを持たない行の頭の単語 */
const SEQUENCE_KEYWORDS =
  /^\s*(loop|alt|else|opt|par|and|critical|option|break|rect|end|autonumber|activate|deactivate|box|%%)\b/;

/** Mermaid の 1 行の、照合する文字（行の中の始まりの位置と文字）を返却する */
function mermaidTexts(
  line: string,
  kind: "flowchart" | "sequence",
): Array<{ start: number; text: string }> {
  if (kind === "flowchart") {
    if (FLOW_SKIPPED.test(line)) {
      return [];
    }
    return [...line.matchAll(FLOW_LABEL)].flatMap((match) => {
      const index = match.slice(1).findIndex((group) => group !== undefined);
      const text = match[index + 1] as string;
      const open = match[0].indexOf(text);
      return [{ start: match.index + open, text }];
    });
  }
  const declared = /^(\s*(?:participant|actor)\s+\S+\s+as\s+)(.*)$/.exec(line);
  if (declared) {
    return [
      { start: (declared[1] as string).length, text: declared[2] as string },
    ];
  }
  if (SEQUENCE_KEYWORDS.test(line)) {
    return [];
  }
  const colon = line.indexOf(":");
  return colon < 0 ? [] : [{ start: colon + 1, text: line.slice(colon + 1) }];
}

/** マップの mermaid の最初の行から、図の種類（流れ図か順番の図。それ以外は `undefined`） */
function mapDiagramKind(lines: string[]): "flowchart" | "sequence" | undefined {
  const head = lines.find((line) => line.trim() !== "")?.trim() ?? "";
  if (/^(flowchart|graph)\b/.test(head)) {
    return "flowchart";
  }
  return /^sequenceDiagram\b/.test(head) ? "sequence" : undefined;
}

/** 図の文字の中の、意味を持つ用語（エイリアスを除く）の一致を、本文の位置で返却する */
function termOnlyMatches(options: {
  text: string;
  /** 文字の頭の本文の位置 */
  offset: number;
  dictionary: Dictionary;
}): Found[] {
  const { text, offset, dictionary } = options;
  return findWords(text, dictionary.words).flatMap((word) => {
    const meaning = dictionary.term(word.word)?.meaning;
    if (meaning === undefined || meaning === "") {
      return [];
    }
    const key = normalizeWord(word.word);
    return [
      {
        word: dictionary.written.get(key) ?? word.word,
        key,
        offset: offset + word.start,
        end: offset + word.end,
        termOnly: true,
      },
    ];
  });
}

/** マップの mermaid のコードブロックの行ごとの、ノードとメッセージの文字の中の用語の一致 */
function mapBlockMatches(options: {
  source: string;
  /** コードブロックの頭の本文の位置 */
  from: number;
  dictionary: Dictionary;
}): Found[] {
  const { source, from, dictionary } = options;
  const lines = source.split("\n");
  const kind = mapDiagramKind(lines);
  if (kind === undefined) {
    return [];
  }
  const found: Found[] = [];
  let lineStart = from;
  for (const line of lines) {
    for (const { start, text } of mermaidTexts(line, kind)) {
      found.push(
        ...termOnlyMatches({ text, offset: lineStart + start, dictionary }),
      );
    }
    lineStart += line.length + 1;
  }
  return found;
}

/** map の範囲の `mermaid` のブロックの、ノード・参加者の名前とメッセージ・注記の文のうち、意味のある用語の位置を返却する */
export function mapTermMatches(options: {
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
  for (const range of markedRanges(tokens, (name) => name === "map")) {
    const block = singleFenceRange({
      range,
      isFence: (token) =>
        token.type === "fence" &&
        token.info.trim().split(/\s+/)[0] === "mermaid",
      body,
      lineStarts,
    });
    if (block !== undefined) {
      found.push(
        ...mapBlockMatches({
          source: body.slice(block.from, block.to),
          from: block.from,
          dictionary,
        }),
      );
    }
  }
  return found;
}

/** 行内のトークンの子の文字の一致を、子の文字ごとの本文の位置で返却する */
function wordMatches(options: {
  content: string;
  offsets: number[];
  body: string;
  dictionary: Dictionary;
}): Found[] {
  const { content, offsets, body, dictionary } = options;
  return findWords(content, dictionary.words).map((word) => ({
    word: dictionary.written.get(word.word) ?? word.word,
    key: word.word,
    offset: offsets[word.start] as number,
    end: wordEnd({ body, offsets, end: word.end }),
  }));
}

/** 地の文（コード・リンク・見出し・用語集の表の中を除く）の一致を、本文の位置で返却する */
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
      found.push(...wordMatches({ content, offsets, body, dictionary }));
    }
  });
  return found;
}

/** 本文の頭からの位置で表した一致を、行（1 から）と行の中の位置（0 から）に修正する */
function locate(options: { found: Found; lineStarts: number[] }): {
  text: string;
  line: number;
  start: number;
  end: number;
} {
  const { found, lineStarts } = options;
  const lineIndex = lineIndexOf(lineStarts, found.offset);
  const lineStart = lineStarts[lineIndex] as number;
  return {
    text: found.word,
    line: lineIndex + 1,
    start: found.offset - lineStart,
    end: found.end - lineStart,
  };
}

/** 地の文と（`html` がオンなら）埋め込んだ HTML の中の、やめた言い方の一致を本文の位置で返却する。用語・文書の別名にやめた言い方の単語を加えた辞書で照合し、やめた言い方の単語の一致だけを残す */
function avoidedFound(options: {
  body: string;
  tokens: Token[];
  dictionary: Dictionary;
  lineStarts: number[];
  html: boolean;
}): Found[] {
  const { body, tokens, dictionary, lineStarts, html } = options;
  // 描いた文書の `matchWords` と同じ単語の集まり
  const withAvoided: Dictionary = {
    ...dictionary,
    words: [...new Set([...dictionary.words, ...dictionary.avoided.keys()])],
  };
  const found = paragraphMatches({
    body,
    tokens,
    dictionary: withAvoided,
    lineStarts,
  });
  if (html) {
    found.push(
      ...embeddedHtmlMatches({ body, tokens, dictionary: withAvoided }),
    );
  }
  return found.filter(({ key }) => dictionary.avoided.has(key));
}

/** エイリアスの参照先（`avoid` の種類は代わりの用語の側で作るため、ここへは来ない） */
function aliasTarget(alias: MdmarkAlias): MdmarkMatchTarget {
  return {
    kind: "alias",
    aliasType: alias.alias_type as Exclude<MdmarkAliasType, "avoid">,
    id: alias.id,
    title: alias.name,
    ...(alias.description === undefined
      ? {}
      : { description: alias.description }),
  };
}

/** 用語の参照先（文書・エイリアスを除く） */
type TermTarget = Omit<MdmarkMatchTarget, "kind" | "aliasType"> & {
  kind: MdmarkAvoidedMatch["kind"];
};

/** 辞書が返却する用語の `id` から、参照先の種類・タイトル・説明を参照する表 */
function termTargetsOf(
  glossary: MdmarkGlossaryEntry[],
  terms: MdmarkIndex["terms"],
): Map<string, TermTarget> {
  const targets = new Map<string, TermTarget>();
  for (const entry of glossary) {
    const id = `glossary:${entry.docId}:${entry.term}`;
    targets.set(id, {
      kind: "glossary",
      id,
      title: entry.term,
      description: entry.meaning,
    });
  }
  for (const term of terms ?? []) {
    targets.set(term.id, {
      kind: "term",
      id: term.id,
      title: term.term,
      description: term.meaning,
    });
  }
  return targets;
}

/** 文書の地の文・埋め込んだ HTML・図・マップの、機能がオンの場所の一致（本文の頭からの順。同じ位置は用語、文書の順） */
function documentFound(options: {
  body: string;
  parsed: ReturnType<typeof parseDocument>;
  dictionary: Dictionary;
  lineStarts: number[];
}): Found[] {
  const { body, parsed, dictionary, lineStarts } = options;
  if (dictionary.words.length === 0) {
    return [];
  }
  const { tokens, features } = parsed;
  const html = features.html === true;
  const found = [
    ...paragraphMatches({ body, tokens, dictionary, lineStarts }),
    ...(html ? embeddedHtmlMatches({ body, tokens, dictionary }) : []),
    ...(features.diagrams === true
      ? diagramTermMatches({ body, tokens, dictionary, html })
      : []),
    ...(features.map === true
      ? mapTermMatches({ body, tokens, dictionary })
      : []),
  ];
  return found.sort((a, b) => a.offset - b.offset);
}

/** 一致した単語の参照先: 用語（エイリアスを含む）と、図の部品の一致でなければ別名を持つ文書 */
function referencedOf(options: {
  item: Found;
  dictionary: Dictionary;
  termTargets: Map<string, TermTarget>;
}): MdmarkMatchTarget[] {
  const { item, dictionary, termTargets } = options;
  const term = dictionary.terms.get(item.key);
  const termTarget =
    term?.alias === undefined
      ? term && termTargets.get(term.id)
      : aliasTarget(term.alias);
  const docs = item.termOnly ? [] : (dictionary.docs.get(item.key) ?? []);
  return [
    ...(termTarget === undefined ? [] : [termTarget]),
    ...docs.map(
      (target): MdmarkMatchTarget => ({
        kind: "doc",
        id: target.id,
        title: target.title,
        ...(target.description === undefined
          ? {}
          : { description: target.description }),
      }),
    ),
  ];
}

/** やめた言い方の代わりの用語 */
type Replacement =
  Dictionary["avoided"] extends Map<string, infer V> ? V : never;

/** やめた言い方の一致の、位置を除いた参照先 */
type AvoidedTarget = Omit<
  MdmarkAvoidedMatch,
  "text" | "line" | "start" | "end"
>;

/** やめた言い方の代わりの用語の参照先 */
function avoidedTargetOf(
  replacement: Replacement | undefined,
  termTargets: Map<string, TermTarget>,
): AvoidedTarget | undefined {
  if (replacement === undefined) {
    return undefined;
  }
  if (replacement.alias === undefined) {
    return termTargets.get(replacement.id);
  }
  return {
    kind: "alias",
    aliasType: replacement.alias.alias_type as "term" | "avoid",
    id: replacement.alias.id,
    title: replacement.term,
    ...(replacement.meaning === undefined
      ? {}
      : { description: replacement.meaning }),
  };
}

/** やめた言い方の一致を、代わりの用語を参照する一致にする（本文の頭からの順） */
function avoidedMatchesOf(options: {
  body: string;
  parsed: ReturnType<typeof parseDocument>;
  dictionary: Dictionary;
  lineStarts: number[];
  termTargets: Map<string, TermTarget>;
}): MdmarkAvoidedMatch[] {
  const { body, parsed, dictionary, lineStarts, termTargets } = options;
  if (dictionary.avoided.size === 0) {
    return [];
  }
  const foundAvoided = avoidedFound({
    body,
    tokens: parsed.tokens,
    dictionary,
    lineStarts,
    html: parsed.features.html === true,
  }).sort((a, b) => a.offset - b.offset);
  return foundAvoided.flatMap((item) => {
    const target = avoidedTargetOf(
      dictionary.avoided.get(item.key),
      termTargets,
    );
    return target === undefined
      ? []
      : [{ ...target, ...locate({ found: item, lineStarts }) }];
  });
}

/** 索引と文書の本文から、文書ごとの本文の一致と、重なりを除いた参照先を返却する */
export function collectMatches(input: {
  /** 索引 */
  index: MdmarkIndex;
  /** 文書のパスから本文を参照する表 */
  documents: Record<string, string>;
  /** 設定 */
  config?: MdmarkConfig;
  /** エイリアス。使用できないもの（`env` を含む）は除いて照合する */
  aliases?: MdmarkAlias[];
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
  const termTargets = termTargetsOf(glossary, index.terms);
  const byDocument: Record<string, MdmarkMatch[]> = {};
  const avoided: Record<string, MdmarkAvoidedMatch[]> = {};
  const targets = new Map<string, MdmarkMatchTarget>();
  for (const { doc, body, parsed } of scanned) {
    const dictionary = buildDictionary({
      index,
      docId: doc.id,
      ownGlossary: parsed.glossary.map((row) => row.entry),
      references: { backlinks: {}, glossary },
      aliases: input.aliases,
      features: parsed.features,
    });
    const lineStarts = lineStartsOf(body);
    const matches: MdmarkMatch[] = [];
    for (const item of documentFound({
      body,
      parsed,
      dictionary,
      lineStarts,
    })) {
      const position = locate({ found: item, lineStarts });
      for (const target of referencedOf({ item, dictionary, termTargets })) {
        matches.push({ ...target, ...position });
        targets.set(`${target.kind}\0${target.id}`, target);
      }
    }
    byDocument[doc.id] = matches;
    // やめた言い方は参照先に混ぜず、代わりの用語を参照して `avoided` にだけ入れる
    avoided[doc.id] = avoidedMatchesOf({
      body,
      parsed,
      dictionary,
      lineStarts,
      termTargets,
    });
  }
  return { byDocument, avoided, targets: [...targets.values()] };
}
