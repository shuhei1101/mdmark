import type { Token } from "markdown-it";
import MarkdownIt from "markdown-it";
import { extensionFor, RESERVED_DIRECTIVES } from "../extensions.ts";
import { readMarkArgs } from "../render/mark-options.ts";
import { MARK_PATTERN, SYNTAX_MARKS } from "../render/marks.ts";
import { slugify } from "../section/heading.syntax.ts";

/** マーカーの名前と引数 */
export type PureMark = {
  /** マーカーの名前 */
  name: string;
  /** 引数の JSON のオブジェクト（引数が無い・読めないときは `{}`） */
  options: Record<string, unknown>;
  /** 範囲の最初の `json` のコードブロックを読み込んだ値 */
  definition?: unknown;
};

/** ブロックの種類 */
export type PureBlockKind =
  | "text"
  | "fence"
  | "html"
  | "mark"
  | "figure"
  | "extension";

/** 文書を分けた 1 つの範囲 */
export type PureBlock = {
  /** ブロックの種類 */
  kind: PureBlockKind;
  /** 範囲の元の行 */
  lines: string[];
  /** 範囲の最初の行の元の行番号（1 から） */
  line: number;
  /** `mark`・`figure`・`extension` のマーカーの名前と引数 */
  mark?: PureMark;
  /** `mark` のマーカーの機能がオフか */
  off: boolean;
};

/** 図の範囲のマーカーの名前から、その機能の名前 */
const FIGURE_MARKS: Readonly<Record<string, string>> = {
  chart: "diagrams",
  param: "diagrams",
  html: "html",
};

/** 中身を残さないマーカーの名前 */
const EMPTY_MARKS = new Set([
  "features",
  "page",
  "map-data",
  "fig",
  "pagebreak",
]);

/** 目次に並べる見出しのレベル */
const TOC_LEVELS = { min: 2, max: 3 } as const;

/** 行末の `[!code …]`（前のコメントの記号と、後ろのコメントの閉じを含む） */
const CODE_NOTATION_PATTERN =
  /\s*(?:\/\/|#|--|;|<!--|\/\*)?\s*\[!code(?:\s[^\]]*)?\](?:\s*(?:-->|\*\/))?\s*$/;

/** コードブロックの開きの行（字下げ・記号・情報の文字） */
const FENCE_OPEN_PATTERN = /^(\s*)(`{3,}|~{3,})(.*)$/;

/** ブロックの構造だけを参照する解析器 */
let parser: MarkdownIt | undefined;

/** 文書をトークンにする */
function parse(markdown: string): Token[] {
  parser ??= new MarkdownIt({ html: true });
  return parser.parse(markdown, {});
}

/** 1 つ目のトークンの範囲 */
type Range = { token: Token; start: number; end: number };

/** 一番外側のブロックの範囲を、文書の順に返却する */
function topRanges(tokens: Token[]): Range[] {
  return tokens
    .filter((token) => token.level === 0 && token.nesting !== -1 && token.map)
    .map((token) => {
      const [start = 0, end = 0] = token.map ?? [];
      return { token, start, end };
    });
}

/** 生の HTML のブロックの頭のマーカー。頭がマーカーでなければ `undefined` */
function leadingMark(
  range: Range | undefined,
): { name: string; closing: boolean; args: string } | undefined {
  if (range?.token.type !== "html_block") {
    return undefined;
  }
  const content = range.token.content.trim();
  const match = new RegExp(MARK_PATTERN.source, "s").exec(content);
  if (!match || match.index !== 0) {
    return undefined;
  }
  return {
    name: match[2] ?? "",
    closing: match[1] === "/",
    args: match[3] ?? "",
  };
}

/** `from` の開きのマーカーに対応する閉じのマーカーの範囲の位置。無ければ -1 */
function closingIndex(ranges: Range[], from: number, name: string): number {
  let depth = 0;
  for (let index = from; index < ranges.length; index++) {
    const mark = leadingMark(ranges[index]);
    if (mark?.name !== name) {
      continue;
    }
    depth += mark.closing ? -1 : 1;
    if (depth === 0) {
      return index;
    }
  }
  return -1;
}

/** マーカーの引数の JSON のオブジェクト */
function optionsOf(args: string): Record<string, unknown> {
  const read = readMarkArgs(args);
  return read.kind === "json" ? read.options : {};
}

/** 範囲の最初の `json` のコードブロックを読み込む。無い・読めないときは `undefined` */
function definitionOf(ranges: Range[]): unknown {
  const fence = ranges.find(
    ({ token }) => token.type === "fence" && token.info.trim() === "json",
  );
  if (!fence) {
    return undefined;
  }
  try {
    return JSON.parse(fence.token.content) as unknown;
  } catch {
    return undefined;
  }
}

/** マーカーの名前と機能から、ブロックの種類とオフかを決める */
function classify(
  name: string,
  features: Record<string, boolean>,
): { kind: PureBlockKind; off: boolean } {
  const figure = FIGURE_MARKS[name];
  if (figure !== undefined) {
    return features[figure] === false
      ? { kind: "mark", off: true }
      : { kind: "figure", off: false };
  }
  const syntax = SYNTAX_MARKS[name];
  if (syntax !== undefined) {
    return { kind: "mark", off: features[syntax] === false };
  }
  if (!RESERVED_DIRECTIVES.has(name) && extensionFor(name)) {
    return { kind: "extension", off: false };
  }
  return { kind: "mark", off: false };
}

/** `index` の範囲から始まるマーカーのブロックと、次に参照する範囲の位置 */
function markBlock(options: {
  ranges: Range[];
  index: number;
  lines: string[];
  features: Record<string, boolean>;
}): { block: PureBlock; next: number } {
  const { ranges, index, lines, features } = options;
  const first = ranges[index] as Range;
  const head = leadingMark(first) ?? { name: "", closing: true, args: "" };
  let last = head.closing ? index : closingIndex(ranges, index, head.name);
  // 範囲を持たない code のマーカーは、直後のコードブロックに付く
  if (last < 0) {
    last =
      head.name === "code" && ranges[index + 1]?.token.type === "fence"
        ? index + 1
        : index;
  }
  const end = ranges[last]?.end ?? first.end;
  const { kind, off } = classify(head.name, features);
  const definition = definitionOf(ranges.slice(index + 1, last));
  return {
    block: {
      kind,
      lines: lines.slice(first.start, end),
      line: first.start + 1,
      mark: {
        name: head.name,
        options: optionsOf(head.args),
        ...(definition === undefined ? {} : { definition }),
      },
      off,
    },
    next: last + 1,
  };
}

/** マーカーでない範囲の種類 */
function plainKind(range: Range): PureBlockKind {
  const { type } = range.token;
  if (type === "html_block") {
    return "html";
  }
  return type === "fence" || type === "code_block" ? "fence" : "text";
}

/** 文書を、マーカー・コードブロック・生の HTML・普通の行のブロックに分ける */
export function splitPureBlocks(options: {
  /** 文書 */
  markdown: string;
  /** 機能のオン・オフ（無い機能はオン） */
  features: Record<string, boolean>;
}): PureBlock[] {
  const { markdown, features } = options;
  const lines = markdown.split("\n");
  const ranges = topRanges(parse(markdown));
  const blocks: PureBlock[] = [];
  let index = 0;
  while (index < ranges.length) {
    const range = ranges[index] as Range;
    if (leadingMark(range)) {
      const { block, next } = markBlock({ ranges, index, lines, features });
      blocks.push(block);
      index = next;
      continue;
    }
    const kind = plainKind(range);
    const previous = blocks[blocks.length - 1];
    // 続く普通の行は、間の空行を含めて 1 つのブロックにする
    if (kind === "text" && previous?.kind === "text") {
      previous.lines = lines.slice(previous.line - 1, range.end);
    } else {
      blocks.push({
        kind,
        lines: lines.slice(range.start, range.end),
        line: range.start + 1,
        off: false,
      });
    }
    index += 1;
  }
  return blocks;
}

/** 行の並びから、一番外側のマーカーだけの生の HTML のブロックの行を除く */
function dropMarkerLines(lines: string[]): string[] {
  const dropped = new Set<number>();
  for (const { token, start, end } of topRanges(parse(lines.join("\n")))) {
    const onlyMarks =
      token.type === "html_block" &&
      token.content.replace(MARK_PATTERN, "").trim() === "";
    for (let line = start; onlyMarks && line < end; line++) {
      dropped.add(line);
    }
  }
  return lines.filter((_, index) => !dropped.has(index));
}

/** コードブロックの行から、飾りの引数と行末の `[!code …]` を除き、言語 `tree` を除外する */
function convertFence(lines: string[]): string[] {
  const [open = "", ...rest] = lines;
  const match = FENCE_OPEN_PATTERN.exec(open);
  if (!match) {
    return lines;
  }
  const [, indent = "", fence = "", info = ""] = match;
  const language = info.trim().split(/\s+/)[0] ?? "";
  const head = `${indent}${fence}${language === "tree" ? "" : language}`;
  return [head, ...rest.map((line) => line.replace(CODE_NOTATION_PATTERN, ""))];
}

/** 行の並びの一番外側のコードブロックを変換する */
function convertFences(lines: string[]): string[] {
  const ranges = topRanges(parse(lines.join("\n")));
  const converted = [...lines];
  for (const { token, start, end } of ranges) {
    if (token.type === "fence") {
      converted.splice(
        start,
        end - start,
        ...convertFence(lines.slice(start, end)),
      );
    }
  }
  return converted;
}

/** map の範囲から Mermaid のコードブロックだけを返却する */
function mermaidOnly(lines: string[]): string[] {
  return topRanges(parse(lines.join("\n")))
    .filter(
      ({ token }) =>
        token.type === "fence" &&
        token.info.trim().split(/\s+/)[0] === "mermaid",
    )
    .flatMap(({ start, end }) => ["", ...lines.slice(start, end)])
    .slice(1);
}

/** 機能がオンの記法のマーカーのブロックを変換する */
function convertMark(
  block: PureBlock & { mark: PureMark },
  headings: Array<{ level: number; text: string }>,
): string[] {
  const { name, options } = block.mark;
  if (EMPTY_MARKS.has(name)) {
    return [];
  }
  if (name === "toc") {
    return tocList(headings);
  }
  if (name === "map") {
    return mermaidOnly(block.lines);
  }
  const inner = dropMarkerLines(block.lines);
  if (name !== "code") {
    return inner;
  }
  const title = typeof options.title === "string" ? options.title : "";
  const fences = convertFences(inner);
  return title === "" ? fences : [`**${title}**`, "", ...fences];
}

/** `text`・`fence`・`html`・`mark` のブロックを、純粋な Markdown の行にする（行内は呼ぶ側が変換する） */
export function convertPureBlock(options: {
  /** ブロック */
  block: PureBlock;
  /** 目次に使用する文書の見出し */
  headings: Array<{ level: number; text: string }>;
}): string[] {
  const { block, headings } = options;
  switch (block.kind) {
    case "text":
      return block.lines;
    case "fence":
      return convertFence(block.lines);
    case "html":
      return [];
    case "mark":
      if (block.mark === undefined || block.off) {
        return dropMarkerLines(block.lines);
      }
      return convertMark({ ...block, mark: block.mark }, headings);
    case "figure":
    case "extension":
      return [];
    default: {
      const never: never = block.kind;
      return never;
    }
  }
}

/** h2〜h3 の見出しを、見出しのアンカーへのリンクの入れ子の箇条書きにする */
export function tocList(
  headings: Array<{ level: number; text: string }>,
): string[] {
  const used = new Map<string, number>();
  const lines: string[] = [];
  for (const { level, text } of headings) {
    // アンカーは目次に並べない見出しも含めて文書の順に付ける
    const anchor = slugify(text, used);
    if (level < TOC_LEVELS.min || level > TOC_LEVELS.max) {
      continue;
    }
    const indent = "  ".repeat(level - TOC_LEVELS.min);
    lines.push(`${indent}- [${text}](#${anchor})`);
  }
  return lines;
}
