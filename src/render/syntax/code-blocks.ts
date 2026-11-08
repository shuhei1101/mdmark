import type { StateCore, Token } from "markdown-it";
import { foldLinesOf, measureIndents } from "../../code-fold-logic.ts";
import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
import { type CodeLine, renderCodeBlock } from "../../parts/code-block.ts";
import { featureOn, markOf, ownBlock } from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

/** コードの行の印の名前から、行の種類を引く */
const LINE_MARK_KINDS: Readonly<Record<string, NonNullable<CodeLine["kind"]>>> =
  {
    "++": "add",
    "--": "del",
    highlight: "highlight",
    focus: "focus",
    error: "error",
    warning: "warning",
  };

/** 行末の印と、印を閉じるコメントの終わり（`-->` か星とスラッシュ）。打ち消した印（`[\!code`）は当たらない */
const LINE_MARK_PATTERN = /\[!code\s+([^\]]*?)\s*\](?:\s*(?:-->|\*\/))?\s*$/;

/** 打ち消した印の `\` */
const ESCAPED_MARK_PATTERN = /\[\\!code(?=\s)/g;

/** 印だけの行コメントの頭。長いものから照らす */
export const LINE_COMMENT_HEADS: readonly string[] = [
  "<!--",
  "//",
  "/*",
  "--",
  "#",
  ";",
];

/** 前の文字を問わずに外す頭。`--`・`#`・`;` は `i--` や `foo();` の一部と取り違えるため、行頭か空白の後ろだけで外す */
const ANYWHERE_COMMENT_HEADS: readonly string[] = ["<!--", "//", "/*"];

/** コードブロックの印に書ける指定の並び（警告に書く） */
const CODE_SPEC_LIST = "`title=`・`lines`・`highlight=`・`fold=`・`wrap`";

/** 使えるコードの行の印の並び（警告に書く） */
const LINE_MARK_LIST =
  "`[!code ++]`・`[!code --]`・`[!code highlight]`・`[!code focus]`・`[!code error]`・`[!code warning]`";

/** 値を持つ `wrap=` の警告の項目の本文 */
export const WRAP_VALUE_MESSAGE =
  "wrap は値を持ちません。wrap=… ではなく wrap と書いてください。折り返さずに描いています";

/** コードブロックの印に書けるキー */
const CODE_KEYS = ["title", "highlight", "fold"];

/** コードブロックの印に書ける、キーの無い指定 */
const CODE_FLAGS = ["lines", "wrap"];

/** `highlight=` の 1 つ分（`2` か `4-6`）を行の範囲に読む。読めなければ `undefined` */
function readRange(part: string): [number, number] | undefined {
  const single = /^(\d+)$/.exec(part);
  if (single?.[1] !== undefined) {
    const line = Number(single[1]);
    return [line, line];
  }
  const range = /^(\d+)-(\d+)$/.exec(part);
  if (range?.[1] === undefined || range[2] === undefined) {
    return undefined;
  }
  const [from, to] = [Number(range[1]), Number(range[2])];
  return from <= to ? [from, to] : undefined;
}

/** `highlight=`・`fold=` の値（`2,4-6`）を行の番号に読む。読めない番号と、コードブロックの行の数を超える番号は、当てずに警告にする */
function readLineNumbers(options: {
  key: string;
  value: string | undefined;
  lineCount: number;
  warnings: WarningItem[];
}): Set<number> {
  const { key, value, lineCount, warnings } = options;
  const numbers = new Set<number>();
  if (value === undefined) {
    return numbers;
  }
  for (const part of value.split(",")) {
    const range = readRange(part);
    if (range === undefined) {
      warnings.push({
        label: part || `${key}=`,
        message:
          "読めない行の指定です。`2`・`4-6` のように、行の番号と範囲をコンマで並べてください。",
      });
      continue;
    }
    const [from, to] = range;
    if (from < 1 || to > lineCount) {
      warnings.push({
        label: part,
        message: `コードブロックに無い行の番号です。コードブロックは ${lineCount} 行です。行の番号を 1〜${lineCount} で書いてください。`,
      });
    }
    for (
      let line = Math.max(from, 1);
      line <= Math.min(to, lineCount);
      line++
    ) {
      numbers.add(line);
    }
  }
  return numbers;
}

/** `code` の印の引数を、題・行番号の有無・強調する行・最初から畳む行に読む。知らないキー・指定、読めない `highlight=`・`fold=` の番号、コードブロックの行の数を超える行の番号は、当てずに警告にする */
export function readCodeSpec(options: {
  args: MdmarkMarkArgs;
  lineCount: number;
}): {
  title: string;
  lineNumbers: boolean;
  wrap: boolean;
  highlights: Set<number>;
  folds: Set<number>;
  warnings: WarningItem[];
} {
  const { args, lineCount } = options;
  const warnings: WarningItem[] = [];
  for (const [key, value] of Object.entries(args.keys)) {
    if (key === "wrap") {
      warnings.push({ label: `wrap=${value}`, message: WRAP_VALUE_MESSAGE });
    } else if (!CODE_KEYS.includes(key)) {
      warnings.push({
        label: `${key}=`,
        message: `使えないキーです。使える指定は ${CODE_SPEC_LIST} です。`,
      });
    }
  }
  for (const flag of args.args) {
    if (!CODE_FLAGS.includes(flag)) {
      warnings.push({
        label: flag,
        message: `使えない指定です。使える指定は ${CODE_SPEC_LIST} です。印の引数は空白で区切るため、題に空白は書けません。`,
      });
    }
  }
  const title = args.keys.title ?? "";
  if (args.keys.title === "") {
    warnings.push({
      label: "title=",
      message: "題がありません。`title=app.ts` のように書いてください。",
    });
  }
  const highlights = readLineNumbers({
    key: "highlight",
    value: args.keys.highlight,
    lineCount,
    warnings,
  });
  const folds = readLineNumbers({
    key: "fold",
    value: args.keys.fold,
    lineCount,
    warnings,
  });
  return {
    title,
    lineNumbers: args.args.includes("lines"),
    wrap: args.args.includes("wrap"),
    highlights,
    folds,
    warnings,
  };
}

/** `[\!code …]` の `\` を外す */
function unescapeMarks(text: string): string {
  return text.replace(ESCAPED_MARK_PATTERN, "[!code");
}

/** 行末の印の前の文字から、印だけを持っていた行コメントの頭を外す。`//`・`/*`・`<!--` は前の文字を問わず、`#`・`--`・`;` は行頭か空白の後ろにあるときだけ頭として外す（`foo();` の `;` は残す） */
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

/** コードブロックの中身を行に分け、行末の `[!code ++]`・`[!code --]`・`[!code highlight]`・`[!code focus]`・`[!code error]`・`[!code warning]` を行の種類にして印を外す。行コメントが印だけなら印の直前の行コメントの頭も外し、外した後の行末の空白も外す。`[\!code …]` は `\` を外した文字にする。知らない印（`[!code blink]` など）はその行に当てず書いた文字のままにし、警告にする */
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
        message: `コードの行の印 \`[!code ${found[1] ?? ""}]\` は使えません。使える印は ${LINE_MARK_LIST} です。${index + 1} 行目には当てず、書いた文字のまま描いています。`,
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

/** 警告の項目を持つ書き方の警告を差し込む対象にまとめる */
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

/** 情報文字列の最初の語を最初の `:` で分け、前を言語、後ろをファイル名にする。`:` が無ければ語の全てが言語でファイル名は空。`:` の前が空なら言語もファイル名も空にする */
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

/** `fence` のまま描くとき、情報文字列の最初の語を言語だけにする（`ts:app.ts` は `ts`、`:a.txt` は最初の語を外す） */
function keepLanguageOnly(token: Token, language: string): void {
  const rest = token.info.trim().split(/\s+/).slice(1);
  token.info = [language, ...rest].filter(Boolean).join(" ");
}

/** 色分けの言語の対応表: 情報文字列の最初の語（小文字）から、highlight.js の言語のモジュール名を引く。モジュール名は `{url}languages/{モジュール名}.min.js` と npm の `highlight.js/lib/languages/{モジュール名}` の名前に当たる */
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

/** 情報文字列の言語の語を小文字にして `SYNTAX_LANGUAGES` を引き、色分けの言語のモジュール名を返す。表に無ければ `undefined` */
export function syntaxLanguageOf(language: string): string | undefined {
  const name = language.toLowerCase();
  return Object.hasOwn(SYNTAX_LANGUAGES, name)
    ? SYNTAX_LANGUAGES[name]
    : undefined;
}

/** `code` がオフのときのコードブロックの中身を、行の印を読まずに行へ分ける */
function plainLines(source: string): CodeLine[] {
  const body = source.endsWith("\n") ? source.slice(0, -1) : source;
  if (body === "" && source === "") {
    return [];
  }
  return body.split("\n").map((text): CodeLine => ({ text }));
}

/** 残っている `fence` のトークンごとに、情報文字列を `splitInfoString` で言語とファイル名に分けてから次を行う。`code` がオンのときは `readLineMarks` で行を読み、直前のトークンが `code` の印なら `readCodeSpec` で指定を読み、全てのコードブロックを部品『コードブロック』（言語・ファイル名・題・行番号・行と、`syntax` がオンなら言語を `syntaxLanguageOf` で引いた色分けの言語）に置き換える。帯の右端のコピーのボタンは `mount` が付ける。`code` がオフのときは行の印を外さず中身の行をそのまま使い、`syntax` がオンで色分けの言語を持つコードブロックだけを帯を持たない部品に置き換え、それ以外は `fence` のまま情報文字列の最初の語を言語に書き換える。読めない指定は、コードブロックの前に警告を差し込む。後ろが `fence` でない `code` の印の場所にも警告を差し込む（`code` がオンのときだけ）。`mermaid` がオンで情報文字列の最初の語がちょうど `mermaid` のコードブロックは、`code` のオン・オフによらず mermaid の対象の部品に置き換え、色分けしない */
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
            "の直後にコードブロックがありません。印の次の行にコードブロックを書いてください。",
        }),
      );
      continue;
    }
    if (codeOn && mark?.name === "code" && !mark.closing) {
      // 印は読んだ後に取り除く（次の `fence` が使う）
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
      ? readCodeSpec({ args: code.args, lineCount: read.length })
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
      message: "の読めない指定を当てずに描いています。",
      items: [...(options?.warnings ?? []), ...foldWarnings],
    });
    // 知らない印は 1 つにつき 1 つの警告にする
    for (const warning of lineWarnings) {
      out.push(warningBlock(state, { message: warning.message }));
    }
    const title = options?.title ?? "";
    const lineNumbers = options?.lineNumbers ?? false;
    const { language, fileName } = splitInfoString(token.info);
    const mermaid =
      mermaidOn && token.info.trim().split(/\s+/)[0] === "mermaid";
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
