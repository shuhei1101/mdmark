import type { StateCore, Token } from "markdown-it";
import { foldLinesOf, measureIndents } from "../../code-fold-logic.ts";
import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
import { type CodeLine, renderCodeBlock } from "../../parts/code-block.ts";
import { titleTailOf } from "./collapse.ts";
import { featureOn, markOf, ownBlock } from "./tokens.ts";
import { type SkippedArg, skippedArgBlocks, warningBlock } from "./warnings.ts";

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

/** コードブロックのマーカーに記載できる指定の並び（警告に記載する） */
const CODE_SPEC_LIST = "`title=`・`lines`・`highlight=`・`fold=`・`wrap`";

/** 使用できるコードの行のマーカーの並び（警告に記載する） */
const LINE_MARK_LIST =
  "`[!code ++]`・`[!code --]`・`[!code highlight]`・`[!code focus]`・`[!code error]`・`[!code warning]`";

/** 値を持つ `wrap=` の警告の項目の本文 */
export const WRAP_VALUE_MESSAGE =
  "wrap は値を持ちません。wrap=… ではなく wrap と記載してください。折り返さずに描いています";

/** コードブロックのマーカーに記載できるキー */
const CODE_KEYS = ["title", "highlight", "fold"];

/** コードブロックのマーカーに記載できる、キーの無い指定 */
const CODE_FLAGS = ["lines", "wrap"];

/** `highlight=` の 1 つ分（`2` か `4-6`）を行の範囲に読み込む。読み込めなければ `undefined` */
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

/** `highlight=`・`fold=` の値（`2,4-6`）を行の番号に読み込む。読み込めない番号と、コードブロックの行の数を超える番号は、当てずに警告にする */
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
          "読み込めない行の指定です。`2`・`4-6` のように、行の番号と範囲をコンマで並べてください。",
      });
      continue;
    }
    const [from, to] = range;
    if (from < 1 || to > lineCount) {
      warnings.push({
        label: part,
        message: `コードブロックに無い行の番号です。コードブロックは ${lineCount} 行です。行の番号を 1〜${lineCount} で記載してください。`,
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

/** `code` のマーカーの引数を、タイトル・行番号の有無・強調する行・最初から畳む行に読み込む。`title=` の値の空白の後ろの単語、読み込めない `highlight=`・`fold=` の番号、コードブロックの行の数を超える行の番号は、当てずに警告にする。それ以外の知らないキー・指定はスキップした引数にする。`text` はマーカーの引数の文字 */
export function readCodeSpec(options: {
  args: MdmarkMarkArgs;
  text: string;
  lineCount: number;
}): {
  title: string;
  lineNumbers: boolean;
  wrap: boolean;
  highlights: Set<number>;
  folds: Set<number>;
  warnings: WarningItem[];
  skipped: SkippedArg[];
} {
  const { args, lineCount } = options;
  const warnings: WarningItem[] = [];
  const skipped: SkippedArg[] = [];
  for (const [key, value] of Object.entries(args.keys)) {
    if (key === "wrap") {
      warnings.push({ label: `wrap=${value}`, message: WRAP_VALUE_MESSAGE });
    } else if (!CODE_KEYS.includes(key)) {
      skipped.push({ arg: `${key}=`, usable: CODE_SPEC_LIST });
    }
  }
  const tail =
    args.keys.title === undefined ? undefined : titleTailOf(options.text);
  for (const flag of args.args) {
    if (CODE_FLAGS.includes(flag)) {
      continue;
    }
    if (flag === tail) {
      warnings.push({
        label: flag,
        message: `使用できない指定です。使用できる指定は ${CODE_SPEC_LIST} です。マーカーの引数は空白で区切るため、タイトルに空白は記載できません。`,
      });
    } else {
      skipped.push({ arg: flag, usable: CODE_SPEC_LIST });
    }
  }
  const title = args.keys.title ?? "";
  if (args.keys.title === "") {
    warnings.push({
      label: "title=",
      message:
        "タイトルがありません。`title=app.ts` のように記載してください。",
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
    skipped,
  };
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
      ? readCodeSpec({
          args: code.args,
          text: code.rest ?? "",
          lineCount: read.length,
        })
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
    if (code && options) {
      out.push(
        ...skippedArgBlocks(
          state,
          { mark: code.raw, skipped: options.skipped },
          tokens[index - 1],
        ),
      );
    }
    // 知らないマーカーは 1 つにつき 1 つの警告にする
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
