import type { Token } from "markdown-it";
import MarkdownIt from "markdown-it";
import { type MdmarkConfig, resolveConfig } from "../config.ts";
import { extensionFor } from "../extensions.ts";
import { splitFrontmatter } from "../frontmatter/frontmatter.logic.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import {
  isMarkdownPath,
  resolveIncludePath,
  selectLines,
  writtenOf,
} from "../render/includes.ts";
import { render } from "../render/index.ts";
import { readMarkArgs } from "../render/mark-options.ts";
import { findMarkTexts } from "../render/parser.ts";
import { slugBase } from "../section/heading.syntax.ts";
import {
  convertPureBlock,
  type PureBlock,
  type PureMark,
  splitPureBlocks,
} from "./pure-blocks.logic.ts";
import { convertPureInline } from "./pure-inline.logic.ts";

/** `opts.figure` が受ける `chart`・`param`・埋め込んだ HTML 1 つ */
export type MdmarkFigure = {
  /** 図の種類 */
  kind: "chart" | "param" | "html";
  /** 文書の中で何番目の図か（1 から） */
  index: number;
  /** `render` がその図の範囲に返却する HTML。埋め込んだ HTML は範囲のスクリプトを除いた HTML */
  html: string;
  /** `chart`・`param` のタイトル */
  title: string | undefined;
  /** `chart`・`param` の凡例の系列の名前。埋め込んだ HTML は空 */
  legend: string[];
};

/** 図を Markdown にする関数。`undefined` を返却した図は取り除く */
export type FigureToMarkdown = (
  figure: MdmarkFigure,
) => string | undefined | Promise<string | undefined>;

/** `toPureMarkdown` の `opts` */
export type PureMarkdownOptions = {
  /** 設定。`features` だけを使用する */
  config?: MdmarkConfig | undefined;
  /** 索引 */
  index?: MdmarkIndex | undefined;
  /** 文書の ID */
  docId?: string | undefined;
  /** 取り込む文書の表。キーは文書のフォルダからのパス */
  includes?: Record<string, string> | undefined;
  /** 図を Markdown にする関数 */
  figure?: FigureToMarkdown | undefined;
};

/** `toPureMarkdown` の戻り値 */
export type PureMarkdownResult = {
  /** 純粋な Markdown */
  markdown: string;
  /** 取り除いた中身と元の行番号の文 */
  warnings: string[];
};

/** 図の範囲のブロック */
type PureFigureBlock = PureBlock & { mark: PureMark };

/** 埋め込んだ HTML から除く範囲のスクリプトの言語 */
const SCRIPT_LANGUAGES = new Set(["ts", "js", "typescript", "javascript"]);

/** 1 回の変換で持ち回る値 */
type Context = {
  opts: PureMarkdownOptions;
  features: Record<string, boolean>;
  /** 図・表の ID（`fig-` を含む）から表示する番号 */
  numbers: Map<string, string>;
  /** 文書の見出し */
  headings: Array<{ level: number; text: string }>;
  warnings: string[];
  /** 振った図の数 */
  figures: number;
  /** 取り込みの途中のファイル（警告の場所と循環の判定に使用する） */
  chain: string[];
};

/** 見出しと番号を集める解析器 */
let parser: MarkdownIt | undefined;

/** 文書をトークンにする */
function parse(markdown: string): Token[] {
  parser ??= new MarkdownIt({ html: true });
  return parser.parse(markdown, {});
}

/** 警告の文を、場所（取り込んだファイルと行番号）付きで記録する */
function warn(context: Context, line: number, message: string): void {
  const file = context.chain[context.chain.length - 1];
  const where = file === undefined ? "" : `${file} の `;
  context.warnings.push(`${where}${line} 行目: ${message}`);
}

/** 設定の `features` に、文書の `features` のマーカーを重ねる */
function featuresOf(
  markdown: string,
  config: MdmarkConfig | undefined,
): Record<string, boolean> {
  const features = { ...resolveConfig({ config }).features };
  for (const mark of findMarkTexts(markdown)) {
    const read = mark.name === "features" ? readMarkArgs(mark.args) : undefined;
    if (read?.kind !== "json") {
      continue;
    }
    for (const [name, value] of Object.entries(read.options)) {
      if (typeof value === "boolean" && Object.hasOwn(features, name)) {
        features[name] = value;
      }
    }
  }
  return features;
}

/** 文書の見出しを、行内を変換した文字にして文書の順に返却する */
function headingsOf(
  markdown: string,
  features: Record<string, boolean>,
): Array<{ level: number; text: string }> {
  const tokens = parse(markdown);
  return tokens.flatMap((token, index) => {
    const inline = tokens[index + 1];
    if (token.type !== "heading_open" || inline?.type !== "inline") {
      return [];
    }
    const text = convertPureInline({
      line: inline.content,
      numbers: new Map(),
      features,
    }).trim();
    return [{ level: Number(token.tag.slice(1)), text }];
  });
}

/** `fig` のマーカーの ID に、直後のブロックの種類ごとの番号を振る */
function numbersOf(blocks: PureBlock[]): Map<string, string> {
  const numbers = new Map<string, string>();
  const counts = { 図: 0, 表: 0 };
  blocks.forEach((block, index) => {
    const id = block.mark?.options.id;
    if (block.kind !== "mark" || block.off || block.mark?.name !== "fig") {
      return;
    }
    if (typeof id !== "string" || id === "") {
      return;
    }
    const next = blocks[index + 1];
    const kind =
      next?.kind === "text" && next.lines[0]?.trimStart().startsWith("|")
        ? "表"
        : "図";
    counts[kind] += 1;
    if (!numbers.has(`fig-${id}`)) {
      numbers.set(`fig-${id}`, `${kind} ${counts[kind]}`);
    }
  });
  return numbers;
}

/** 行の並びの行内を変換する。コードブロックの中の行は変えない */
function convertLines(lines: string[], context: Context): string[] {
  let fence: string | undefined;
  return lines.map((line) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker !== undefined) {
      if (fence === undefined) {
        fence = marker;
      } else if (marker.startsWith(fence)) {
        fence = undefined;
      }
      return line;
    }
    if (fence !== undefined) {
      return line;
    }
    return convertPureInline({
      line,
      numbers: context.numbers,
      features: context.features,
    });
  });
}

/** 埋め込んだ HTML の範囲から、`ts`・`js` のコードブロックを除く */
function withoutScripts(lines: string[]): {
  lines: string[];
  removed: boolean;
} {
  const dropped = new Set<number>();
  for (const token of parse(lines.join("\n"))) {
    const language = token.info.trim().split(/\s+/)[0] ?? "";
    if (token.type !== "fence" || !SCRIPT_LANGUAGES.has(language)) {
      continue;
    }
    const [start = 0, end = 0] = token.map ?? [];
    for (let line = start; line < end; line++) {
      dropped.add(line);
    }
  }
  return {
    lines: lines.filter((_, index) => !dropped.has(index)),
    removed: dropped.size > 0,
  };
}

/** 定義のオブジェクトの文字の項目 */
function textOf(value: unknown, key: string): string | undefined {
  const field = (value as Record<string, unknown> | null | undefined)?.[key];
  return typeof field === "string" ? field : undefined;
}

/** 定義の配列の項目の `name` を並べる */
function namesOf(value: unknown, key: string): string[] {
  const items = (value as Record<string, unknown> | null | undefined)?.[key];
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    const name = textOf(item, "name");
    return name === undefined ? [] : [name];
  });
}

/** `chart`・`param` の定義から凡例の系列の名前を取り出す */
function legendOf(kind: MdmarkFigure["kind"], definition: unknown): string[] {
  if (kind === "chart") {
    const series = namesOf(definition, "series");
    return series.length > 0 ? series : namesOf(definition, "items");
  }
  if (kind === "param") {
    const knob = (definition as { knob?: unknown } | null | undefined)?.knob;
    const label = textOf(knob, "label") ?? "";
    const value = (knob as { value?: unknown } | undefined)?.value;
    const text = `${label} ${String(value ?? "")}`.trim();
    return [`今の値（${text}）`, `既定の値（${text}）`];
  }
  return [];
}

/** 図の範囲の Markdown を `render` で HTML にし、`chart`・`param` は定義からタイトルと凡例を取り出す */
export function figureOf(options: {
  /** 図の範囲 */
  block: PureFigureBlock;
  /** 文書の中で何番目の図か（1 から） */
  index: number;
  /** 設定 */
  config?: MdmarkConfig | undefined;
}): { figure: MdmarkFigure; warnings: string[] } {
  const { block, index, config } = options;
  const kind = block.mark.name as MdmarkFigure["kind"];
  const warnings: string[] = [];
  let lines = block.lines;
  if (kind === "html") {
    const stripped = withoutScripts(lines);
    lines = stripped.lines;
    if (stripped.removed) {
      warnings.push(
        `${block.line} 行目: 埋め込んだ HTML の範囲のスクリプト（ts・js のコードブロック）を除いて書き出しました`,
      );
    }
  }
  const html = render(lines.join("\n"), config === undefined ? {} : { config });
  const definition = block.mark.definition;
  return {
    figure: {
      kind,
      index,
      html,
      title: kind === "html" ? undefined : textOf(definition, "title"),
      legend: legendOf(kind, definition),
    },
    warnings,
  };
}

/** 図のブロックを、`opts.figure` の戻り値（無ければ空）にする */
async function convertFigure(
  block: PureFigureBlock,
  context: Context,
): Promise<string[]> {
  context.figures += 1;
  const { figure, warnings } = figureOf({
    block,
    index: context.figures,
    config: context.opts.config,
  });
  for (const warning of warnings) {
    warn(context, block.line, warning.replace(/^\d+ 行目: /, ""));
  }
  const converted = await context.opts.figure?.(figure);
  return typeof converted === "string" ? [converted] : [];
}

/** 拡張のマーカーを、書き出しのフックの戻り値にする。フックが無い・失敗したら取り除いて警告にする */
async function convertExtension(
  block: PureFigureBlock,
  context: Context,
): Promise<string[]> {
  const { name: directive, options, definition } = block.mark;
  const extension = extensionFor(directive);
  const name = extension?.name ?? directive;
  if (extension?.toMarkdown === undefined) {
    warn(
      context,
      block.line,
      `拡張「${name}」の ${directive} のマーカーは、書き出しのフック（toMarkdown）が無いため取り除きました`,
    );
    return [];
  }
  try {
    const converted = await extension.toMarkdown({
      options,
      ...(definition === undefined ? {} : { definition }),
    });
    if (typeof converted === "string") {
      return [converted];
    }
    warn(
      context,
      block.line,
      `拡張「${name}」の toMarkdown が文字列を返却しなかったため、${directive} のマーカーを取り除きました`,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    warn(
      context,
      block.line,
      `拡張「${name}」の toMarkdown が失敗したため、${directive} のマーカーを取り除きました（${reason}）`,
    );
  }
  return [];
}

/** 見出しの ID が `id` の見出しから、次の同じか上のレベルの見出しの前までの行 */
function headingSection(text: string, id: string): string | undefined {
  const tokens = parse(text);
  const lines = text.split("\n");
  const headings = tokens.flatMap((token, index) =>
    token.type === "heading_open" && token.map
      ? [
          {
            level: Number(token.tag.slice(1)),
            start: token.map[0],
            id: slugBase(tokens[index + 1]?.content ?? ""),
          },
        ]
      : [],
  );
  const position = headings.findIndex((heading) => heading.id === id);
  const found = headings[position];
  if (found === undefined) {
    return undefined;
  }
  const next = headings
    .slice(position + 1)
    .find((heading) => heading.level <= found.level);
  return lines.slice(found.start, next?.start ?? lines.length).join("\n");
}

/** 取り込みのマーカーを、取り込む文書を純粋な Markdown にした行にする */
async function convertInclude(
  block: PureFigureBlock,
  context: Context,
): Promise<string[]> {
  const written = writtenOf(block.mark.options);
  const { key, target } = resolveIncludePath(
    context.chain[context.chain.length - 1] ?? "",
    written,
  );
  const text = context.opts.includes?.[key];
  if (text === undefined || context.chain.includes(key)) {
    warn(
      context,
      block.line,
      `取り込み先 ${written} を取り込めないため、取り除きました`,
    );
    return [];
  }
  if (!isMarkdownPath(key)) {
    const selected =
      target.kind === "lines"
        ? selectLines(text, target.from, target.to)
        : { text };
    if (!("text" in selected)) {
      warn(
        context,
        block.line,
        `取り込み先 ${written} の行の範囲が無いため、取り除きました`,
      );
      return [];
    }
    const language = /\.([^./]+)$/.exec(key)?.[1] ?? "";
    return [
      "```" + language,
      ...selected.text.replace(/\n$/, "").split("\n"),
      "```",
    ];
  }
  const section =
    target.kind === "heading" ? headingSection(text, target.id) : text;
  if (section === undefined) {
    warn(
      context,
      block.line,
      `取り込み先 ${written} の見出しが無いため、取り除きました`,
    );
    return [];
  }
  const included = { ...context, chain: [...context.chain, key] };
  const converted = await convertDocument(
    splitFrontmatter(section).body,
    included,
  );
  context.figures = included.figures;
  return [converted];
}

/** 記法のマーカーのブロックを変換する */
async function convertMarkBlock(
  block: PureFigureBlock,
  context: Context,
): Promise<string[]> {
  const { name, options } = block.mark;
  if (block.off) {
    return convertLines(convertPureBlock({ block, headings: [] }), context);
  }
  if (name === "include") {
    return convertInclude(block, context);
  }
  if (name === "fig") {
    const id = typeof options.id === "string" ? `fig-${options.id}` : "";
    const label = context.numbers.get(id);
    return label === undefined ? [] : [`**${label}**`];
  }
  const lines = convertPureBlock({ block, headings: context.headings });
  if (name === "toc" || name === "map") {
    return lines;
  }
  // 範囲の中の記法と図も変換する
  return [await convertDocument(lines.join("\n"), context)];
}

/** 1 つのブロックを純粋な Markdown の行にする */
async function convertBlock(
  block: PureBlock,
  context: Context,
): Promise<string[]> {
  const { mark } = block;
  if (block.kind === "text") {
    return convertLines(block.lines, context);
  }
  if (mark === undefined) {
    return convertPureBlock({ block, headings: context.headings });
  }
  const marked = { ...block, mark };
  if (block.kind === "figure") {
    return convertFigure(marked, context);
  }
  if (block.kind === "extension") {
    return convertExtension(marked, context);
  }
  return convertMarkBlock(marked, context);
}

/** 前後の空行を除く */
function trimBlankLines(text: string): string {
  return text.replace(/^(?:[ \t]*\n)+/, "").replace(/(?:\n[ \t]*)+$/, "");
}

/** 文書をブロックに分けて変換し、ブロックの間を空行 1 行でつなぐ */
async function convertDocument(
  markdown: string,
  context: Context,
): Promise<string> {
  const parts: string[] = [];
  for (const block of splitPureBlocks({
    markdown,
    features: context.features,
  })) {
    const text = trimBlankLines(
      (await convertBlock(block, context)).join("\n"),
    );
    if (text.trim() !== "") {
      parts.push(text);
    }
  }
  return parts.join("\n\n");
}

/** 引数を検査し、文書をブロックに分けて変換し、図と拡張のフックの戻り値を入れた純粋な Markdown と警告を返却する */
export async function toPureMarkdown(
  markdown: string,
  opts: PureMarkdownOptions = {},
): Promise<PureMarkdownResult> {
  if (typeof markdown !== "string") {
    throw new TypeError(
      "toPureMarkdown: markdown は文字列で指定してください。",
    );
  }
  if (opts.figure !== undefined && typeof opts.figure !== "function") {
    throw new TypeError(
      "toPureMarkdown: opts.figure は関数で指定してください。",
    );
  }
  const { body, content } = splitFrontmatter(markdown);
  const features = featuresOf(body, opts.config);
  const context: Context = {
    opts,
    features,
    numbers: numbersOf(splitPureBlocks({ markdown: body, features })),
    headings: headingsOf(body, features),
    warnings: [],
    figures: 0,
    chain: [],
  };
  const converted = await convertDocument(body, context);
  const front = content === undefined ? "" : `---\n${content}\n---\n\n`;
  return {
    markdown: `${front}${converted}\n`,
    warnings: context.warnings,
  };
}
