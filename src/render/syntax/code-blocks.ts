import type { StateCore, Token } from "markdown-it";
import { foldLinesOf, measureIndents } from "../../code-fold-logic.ts";
import type { WarningItem } from "../../extensions.ts";
import { type CodeLine, renderCodeBlock } from "../../parts/code-block.ts";
import type { MarkOptions } from "../mark-options.ts";
import { MAP_SOURCE_META } from "./map.ts";
import { featureOn, markOf, ownBlock } from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

/** コードの行のマーカーの名前から、行の種類を参照する */
const LINE_MARK_KINDS: Readonly<Record<string, NonNullable<CodeLine["kind"]>>> =
  {
    "++": "add",
    "--": "del",
    highlight: "highlight",
    focus: "focus",
    error: "error",
    warning: "warning",
  };

/** 行末のマーカーと、マーカーを閉じるコメントの終わり（`-->` か星とスラッシュ）。打ち消したマーカー（`[\!code`）は該当しない */
const LINE_MARK_PATTERN = /\[!code\s+([^\]]*?)\s*\](?:\s*(?:-->|\*\/))?\s*$/;

/** 罫線でフォルダ構成を記載した行。行頭の空白（`tree` コマンドが縦線の後ろに出す NBSP を含む）と縦線の後に、罫線の枝が続く */
export const TREE_LINE_PATTERN = /^[\t \u00A0│|]*(?:├── |└── |\|-- |`-- )/u;

/** この数以上の罫線の行を持つ言語が `tree` でないコードブロックに、罫線のフォルダ構成の記載の警告を出す */
export const TREE_WARNING_MIN_LINES = 2;

/** 打ち消したマーカーの `\` */
const ESCAPED_MARK_PATTERN = /\[\\!code(?=\s)/g;

/** マーカーだけの行コメントの頭。長いものから照らす */
export const LINE_COMMENT_HEADS: readonly string[] = [
  "<!--",
  "//",
  "/*",
  "--",
  "#",
  ";",
];

/** 前の文字を問わずに削除する頭。`--`・`#`・`;` は `i--` や `foo();` の一部と取り違えるため、行頭か空白の後ろだけで削除する */
const ANYWHERE_COMMENT_HEADS: readonly string[] = ["<!--", "//", "/*"];

/** 使用できるコードの行のマーカーの並び（警告に記載する） */
const LINE_MARK_LIST =
  "`[!code ++]`・`[!code --]`・`[!code highlight]`・`[!code focus]`・`[!code error]`・`[!code warning]`";

/** 行の指定の要素（行の番号か行の範囲） */
type LineEntry = number | { from?: unknown; to?: unknown };

/** `highlight`・`fold` の要素を、`lineStart` から数えた行の番号として位置（1 から）に読み込む。コードブロックに無い番号と、`from` より小さい `to` は当てずに警告にする */
function readLineNumbers(options: {
  key: string;
  entries: unknown;
  lineStart: number;
  lineCount: number;
  warnings: WarningItem[];
}): Set<number> {
  const { key, entries, lineStart, lineCount, warnings } = options;
  const numbers = new Set<number>();
  if (!Array.isArray(entries)) {
    return numbers;
  }
  const last = lineStart + lineCount - 1;
  entries.forEach((entry: LineEntry, index) => {
    const label = `${key}[${index}]`;
    const from = typeof entry === "number" ? entry : Number(entry.from);
    const to =
      typeof entry === "number"
        ? entry
        : entry.to === undefined
          ? from
          : Number(entry.to);
    if (to < from) {
      warnings.push({
        label: `${label}.to`,
        message: `to が from より小さい範囲です（from ${from}、to ${to}）。{"from": 2, "to": 4} のように記載してください。`,
      });
      return;
    }
    if (from < lineStart || to > last) {
      warnings.push({
        label,
        message: `コードブロックに無い行の番号 ${from === to ? from : `${from}〜${to}`} です。コードブロックは ${lineStart}〜${last} 行目です。`,
      });
      return;
    }
    for (let line = from; line <= to; line++) {
      numbers.add(line - lineStart + 1);
    }
  });
  return numbers;
}

/** `code` のマーカーの設定を、タイトル・行番号の有無と最初の行の番号・強調する行・最初から畳む行・折り返すかに読み込む */
export function readCodeSpec(options: {
  options: MarkOptions;
  lineCount: number;
}): {
  title: string;
  lineNumbers: boolean;
  lineStart: number;
  wrap: boolean;
  treeWarning: boolean;
  highlights: Set<number>;
  folds: Set<number>;
  warnings: WarningItem[];
} {
  const { options: spec, lineCount } = options;
  const warnings: WarningItem[] = [];
  const lines = spec.lines as { start?: unknown } | undefined;
  const lineStart = typeof lines?.start === "number" ? lines.start : 1;
  const highlights = readLineNumbers({
    key: "highlight",
    entries: spec.highlight,
    lineStart,
    lineCount,
    warnings,
  });
  const folds = readLineNumbers({
    key: "fold",
    entries: spec.fold,
    lineStart,
    lineCount,
    warnings,
  });
  return {
    title: typeof spec.title === "string" ? spec.title : "",
    lineNumbers: lines !== undefined,
    lineStart,
    wrap: spec.wrap === true,
    treeWarning: spec.tree_warning !== false,
    highlights,
    folds,
    warnings,
  };
}

/** コードブロックの中身の、罫線でフォルダ構成を記載した行の数を返却する */
export function countTreeLines(source: string): number {
  return source.split("\n").filter((line) => TREE_LINE_PATTERN.test(line))
    .length;
}

/** 罫線のフォルダ構成の記載の警告の本文（言語が空なら言語の無いコードブロックとして書く） */
function treeLinesMessage(language: string): string {
  const block = language
    ? `言語 \`${language}\` のコードブロックに`
    : "言語の無いコードブロックに";
  return `${block}、罫線のフォルダ構成があります。言語を \`tree\` にすると、アイコン・開閉・注釈・コピーを付けたファイルツリーで描きます。罫線のまま見せるときは、直前に \`<!-- code: {"tree_warning": false} -->\` を記載してください。コードブロックのまま描いています。`;
}

/** `[\!code …]` の `\` を削除する */
function unescapeMarks(text: string): string {
  return text.replace(ESCAPED_MARK_PATTERN, "[!code");
}

/** 行末のマーカーの前の文字から、マーカーだけを持っていた行コメントの頭を削除する。`//`・`/*`・`<!--` は前の文字を問わず、`#`・`--`・`;` は行頭か空白の後ろにあるときだけ頭として削除する（`foo();` の `;` は残す） */
function dropCommentHead(text: string): string {
  const trimmed = text.trimEnd();
  for (const head of LINE_COMMENT_HEADS) {
    if (!trimmed.endsWith(head)) {
      continue;
    }
    const before = trimmed.slice(0, -head.length);
    if (
      ANYWHERE_COMMENT_HEADS.includes(head) ||
      before === "" ||
      /\s$/.test(before)
    ) {
      return before.trimEnd();
    }
  }
  return trimmed;
}

/** 行の文字から `measureIndents` でインデントのレベルを、`foldLinesOf` で畳む行の数を決めて行に付け、`folds` の行のうち畳める行に `folded` を付ける。畳めない行は当てずに警告にする */
export function readFolds(options: { lines: CodeLine[]; folds: Set<number> }): {
  lines: CodeLine[];
  warnings: WarningItem[];
} {
  const { lines, folds } = options;
  const indents = measureIndents(lines.map((line) => line.text));
  const foldLines = foldLinesOf(indents);
  const warnings: WarningItem[] = [];
  for (const number of [...folds].sort((a, b) => a - b)) {
    if (foldLines[number - 1] === undefined) {
      warnings.push({
        label: String(number),
        message: `${number} 行目は、次の行がより深いインデントでないため畳めません。`,
      });
    }
  }
  return {
    lines: lines.map((line, index): CodeLine => {
      const indent = indents[index];
      const count = foldLines[index];
      return {
        ...line,
        ...(indent ? { indent } : {}),
        ...(count === undefined ? {} : { foldLines: count }),
        ...(count !== undefined && folds.has(index + 1)
          ? { folded: true }
          : {}),
      };
    }),
    warnings,
  };
}

/** コードブロックの中身を行に分け、行末の `[!code ++]`・`[!code --]`・`[!code highlight]`・`[!code focus]`・`[!code error]`・`[!code warning]` を行の種類にしてマーカーを削除する。行コメントがマーカーだけならマーカーの直前の行コメントの頭も削除し、削除した後の行末の空白も削除する。`[\!code …]` は `\` を削除した文字にする。知らないマーカー（`[!code blink]` など）はその行に当てず記載した文字のままにし、警告にする */
export function readLineMarks(source: string): {
  lines: CodeLine[];
  warnings: WarningItem[];
} {
  const warnings: WarningItem[] = [];
  const body = source.endsWith("\n") ? source.slice(0, -1) : source;
  if (body === "" && source === "") {
    return { lines: [], warnings };
  }
  const lines = body.split("\n").map((line, index): CodeLine => {
    const found = LINE_MARK_PATTERN.exec(line);
    if (found?.index === undefined) {
      return { text: unescapeMarks(line) };
    }
    const kind = LINE_MARK_KINDS[found[1] ?? ""];
    if (kind === undefined) {
      warnings.push({
        label: "",
        message: `コードの行のマーカー \`[!code ${found[1] ?? ""}]\` は使用できません。使用できるマーカーは ${LINE_MARK_LIST} です。${index + 1} 行目には当てず、記載した文字のまま描いています。`,
      });
      return { text: unescapeMarks(line) };
    }
    return {
      text: dropCommentHead(unescapeMarks(line.slice(0, found.index))),
      kind,
    };
  });
  return { lines, warnings };
}

/** 警告の項目を持つ記載の警告を差し込む対象にまとめる */
function pushWarnings(
  out: Token[],
  state: StateCore,
  options: {
    mark?: string;
    line?: number | undefined;
    message: string;
    items: WarningItem[];
  },
): void {
  if (options.items.length === 0) {
    return;
  }
  out.push(
    warningBlock(state, {
      ...(options.mark === undefined ? {} : { mark: options.mark }),
      ...(options.line === undefined ? {} : { line: options.line }),
      message: options.message,
      items: options.items,
    }),
  );
}

/** 情報文字列の最初の単語を最初の `:` で分け、前を言語、後ろをファイル名にする。`:` が無ければ単語の全てが言語でファイル名は空。`:` の前が空なら言語もファイル名も空にする */
export function splitInfoString(info: string): {
  language: string;
  fileName: string;
} {
  const word = info.trim().split(/\s+/)[0] ?? "";
  const colon = word.indexOf(":");
  if (colon < 0) {
    return { language: word, fileName: "" };
  }
  if (colon === 0) {
    return { language: "", fileName: "" };
  }
  return { language: word.slice(0, colon), fileName: word.slice(colon + 1) };
}

/** `fence` のまま描くとき、情報文字列の最初の単語を言語だけにする（`ts:app.ts` は `ts`、`:a.txt` は最初の単語を削除する） */
function keepLanguageOnly(token: Token, language: string): void {
  const rest = token.info.trim().split(/\s+/).slice(1);
  token.info = [language, ...rest].filter(Boolean).join(" ");
}

/** 色分けの言語の対応表: 情報文字列の最初の単語（小文字）から、highlight.js の言語のモジュール名を参照する。モジュール名は `{url}languages/{モジュール名}.min.js` と npm の `highlight.js/lib/languages/{モジュール名}` の名前に該当する */
export const SYNTAX_LANGUAGES: Readonly<Record<string, string>> = {
  typescript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  javascript: "javascript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  python: "python",
  py: "python",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  html: "xml",
  xml: "xml",
  css: "css",
  markdown: "markdown",
  md: "markdown",
  sql: "sql",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  diff: "diff",
  patch: "diff",
};

/** 情報文字列の言語の単語を小文字にして `SYNTAX_LANGUAGES` を引き、色分けの言語のモジュール名を返却する。表に無ければ `undefined` */
export function syntaxLanguageOf(language: string): string | undefined {
  const name = language.toLowerCase();
  return Object.hasOwn(SYNTAX_LANGUAGES, name)
    ? SYNTAX_LANGUAGES[name]
    : undefined;
}

/** `code` がオフのときのコードブロックの中身を、行のマーカーを読み込まずに行へ分ける */
function plainLines(source: string): CodeLine[] {
  const body = source.endsWith("\n") ? source.slice(0, -1) : source;
  if (body === "" && source === "") {
    return [];
  }
  return body.split("\n").map((text): CodeLine => ({ text }));
}

/** 残っている `fence` のトークンごとに、情報文字列を `splitInfoString` で言語とファイル名に分けてから次の処理をする。`code` がオンのときは `readLineMarks` で行を読み込み、直前のトークンが `code` のマーカーなら `readCodeSpec` で指定を読み込み、全てのコードブロックを部品『コードブロック』（言語・ファイル名・タイトル・行番号・行と、`syntax` がオンなら言語を `syntaxLanguageOf` で参照した色分けの言語）に置き換える。帯の右端のコピーのボタンは `mount` が付ける。`code` がオフのときは行のマーカーを削除せず中身の行をそのまま使用し、`syntax` がオンで色分けの言語を持つコードブロックだけを帯を持たない部品に置き換え、それ以外は `fence` のまま情報文字列の最初の単語を言語に書き換える。読み込めない指定は、コードブロックの前に警告を差し込む。後ろが `fence` でない `code` のマーカーの場所にも警告を差し込む（`code` がオンのときだけ）。`mermaid` がオンで情報文字列の最初の単語がちょうど `mermaid` のコードブロックは、`code` のオン・オフによらず mermaid の対象の部品に置き換え、色分けしない */
export function buildCodeBlocks(state: StateCore): void {
  const codeOn = featureOn(state, "code");
  const syntaxOn = featureOn(state, "syntax");
  const mermaidOn = featureOn(state, "mermaid");
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    const mark = markOf(token);
    const next = tokens[index + 1];
    if (
      codeOn &&
      mark?.name === "code" &&
      !mark.closing &&
      next?.type !== "fence"
    ) {
      out.push(
        warningBlock(state, {
          mark: mark.raw,
          ...(token.map ? { line: token.map[0] } : {}),
          message:
            "の直後にコードブロックがありません。マーカーの次の行にコードブロックを記載してください。",
        }),
      );
      continue;
    }
    if (codeOn && mark?.name === "code" && !mark.closing) {
      // マーカーは読み込んだ後に取り除く（次の `fence` が使用する）
      continue;
    }
    if (token.type !== "fence") {
      out.push(token);
      continue;
    }
    const spec = markOf(tokens[index - 1]);
    const code =
      codeOn && spec?.name === "code" && !spec.closing ? spec : undefined;
    const { lines: read, warnings: lineWarnings } = codeOn
      ? readLineMarks(token.content)
      : { lines: plainLines(token.content), warnings: [] };
    const options = code
      ? readCodeSpec({ options: code.options, lineCount: read.length })
      : undefined;
    const marked = read.map(
      (line, position): CodeLine =>
        line.kind === undefined && options?.highlights.has(position + 1)
          ? { ...line, kind: "highlight" }
          : line,
    );
    const { lines, warnings: foldWarnings } = codeOn
      ? readFolds({ lines: marked, folds: options?.folds ?? new Set() })
      : { lines: marked, warnings: [] };
    pushWarnings(out, state, {
      mark: code?.raw,
      line: code ? tokens[index - 1]?.map?.[0] : undefined,
      message: "の読み込めない指定を当てずに描いています。",
      items: [...(options?.warnings ?? []), ...foldWarnings],
    });
    // 知らないマーカーは 1 つにつき 1 つの警告にする
    for (const warning of lineWarnings) {
      out.push(warningBlock(state, { message: warning.message }));
    }
    const title = options?.title ?? "";
    const lineNumbers = options?.lineNumbers ?? false;
    const { language, fileName } = splitInfoString(token.info);
    const firstWord = token.info.trim().split(/\s+/)[0];
    const mermaid =
      mermaidOn &&
      firstWord === "mermaid" &&
      token.meta?.[MAP_SOURCE_META] !== true;
    if (
      codeOn &&
      firstWord !== "mermaid" &&
      token.meta?.[MAP_SOURCE_META] !== true &&
      (options?.treeWarning ?? true) &&
      countTreeLines(token.content) >= TREE_WARNING_MIN_LINES
    ) {
      out.push(
        warningBlock(state, {
          message: treeLinesMessage(language),
          ...(token.map ? { line: token.map[0] } : {}),
        }),
      );
    }
    const syntax =
      syntaxOn && !mermaid ? syntaxLanguageOf(language) : undefined;
    if (codeOn || syntax !== undefined || mermaid) {
      out.push(
        ownBlock(
          state,
          renderCodeBlock({
            language,
            fileName,
            title,
            lineNumbers,
            lineStart: options?.lineStart ?? 1,
            wrap: options?.wrap ?? false,
            lines,
            syntax,
            mermaid,
            bar: codeOn,
          }),
          token,
        ),
      );
      continue;
    }
    keepLanguageOnly(token, language);
    out.push(token);
  }
  state.tokens = out;
}
