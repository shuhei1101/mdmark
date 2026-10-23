import type { StateCore, Token } from "markdown-it";
import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
import { type CodeLine, renderCodeBlock } from "../../parts/code-block.ts";
import { featureOn, markOf, ownBlock } from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

/** コードの行の印の名前から、行の種類を引く */
const LINE_MARK_KINDS: Readonly<Record<string, NonNullable<CodeLine["kind"]>>> =
  { "++": "add", "--": "del", highlight: "highlight" };

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
const CODE_SPEC_LIST = "`title=`・`lines`・`highlight=`";

/** 使えるコードの行の印の並び（警告に書く） */
const LINE_MARK_LIST = "`[!code ++]`・`[!code --]`・`[!code highlight]`";

/** コードブロックの印に書けるキー */
const CODE_KEYS = ["title", "highlight"];

/** コードブロックの印に書ける、キーの無い指定 */
const CODE_FLAGS = ["lines"];

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

/** `code` の印の引数を、題・行番号の有無・強調する行に読む。知らないキー・指定、読めない `highlight=` の番号、コードブロックの行の数を超える行の番号は、当てずに警告にする */
export function readCodeSpec(options: {
  args: MdmarkMarkArgs;
  lineCount: number;
}): {
  title: string;
  lineNumbers: boolean;
  highlights: Set<number>;
  warnings: WarningItem[];
} {
  const { args, lineCount } = options;
  const warnings: WarningItem[] = [];
  for (const key of Object.keys(args.keys)) {
    if (!CODE_KEYS.includes(key)) {
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
  const highlights = new Set<number>();
  const highlight = args.keys.highlight;
  if (highlight !== undefined) {
    for (const part of highlight.split(",")) {
      const range = readRange(part);
      if (range === undefined) {
        warnings.push({
          label: part || "highlight=",
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
        highlights.add(line);
      }
    }
  }
  return {
    title,
    lineNumbers: args.args.includes("lines"),
    highlights,
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

/** コードブロックの中身を行に分け、行末の `[!code ++]`・`[!code --]`・`[!code highlight]` を行の種類にして印を外す。行コメントが印だけなら印の直前の行コメントの頭も外し、外した後の行末の空白も外す。`[\!code …]` は `\` を外した文字にする。知らない印（`[!code focus]` など）はその行に当てず書いた文字のままにし、警告にする */
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
  options: { mark?: string; message: string; items: WarningItem[] },
): void {
  if (options.items.length === 0) {
    return;
  }
  out.push(
    warningBlock(state, {
      ...(options.mark === undefined ? {} : { mark: options.mark }),
      message: options.message,
      items: options.items,
    }),
  );
}

/** 情報文字列の言語 */
function languageOf(token: Token): string {
  return token.info.trim().split(/\s+/)[0] ?? "";
}

/** `code` がオンなら、残っている `fence` のトークンごとに `readLineMarks` で行を読み、直前のトークンが `code` の印なら `readCodeSpec` で指定を読む。題・行番号・行の種類のどれかを持つコードブロックを部品『コードブロック』に置き換える。置き換えないコードブロックも、`fence` の `content` を行の文字でつなぎ直す（打ち消した印の `\` が外れる）。読めない指定は、コードブロックの前に警告を差し込む。後ろが `fence` でない `code` の印の場所にも警告を差し込む */
export function buildCodeBlocks(state: StateCore): void {
  if (!featureOn(state, "code")) {
    return;
  }
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    const mark = markOf(token);
    const next = tokens[index + 1];
    if (mark?.name === "code" && !mark.closing && next?.type !== "fence") {
      out.push(
        warningBlock(state, {
          mark: mark.raw,
          message:
            "の直後にコードブロックがありません。印の次の行にコードブロックを書いてください。",
        }),
      );
      continue;
    }
    if (mark?.name === "code" && !mark.closing) {
      // 印は読んだ後に取り除く（次の `fence` が使う）
      continue;
    }
    if (token.type !== "fence") {
      out.push(token);
      continue;
    }
    const spec = markOf(tokens[index - 1]);
    const code = spec?.name === "code" && !spec.closing ? spec : undefined;
    const { lines: read, warnings: lineWarnings } = readLineMarks(
      token.content,
    );
    const options = code
      ? readCodeSpec({ args: code.args, lineCount: read.length })
      : undefined;
    const lines = read.map(
      (line, position): CodeLine =>
        line.kind === undefined && options?.highlights.has(position + 1)
          ? { ...line, kind: "highlight" }
          : line,
    );
    pushWarnings(out, state, {
      mark: code?.raw,
      message: "の読めない指定を当てずに描いています。",
      items: options?.warnings ?? [],
    });
    // 知らない印は 1 つにつき 1 つの警告にする
    for (const warning of lineWarnings) {
      out.push(warningBlock(state, { message: warning.message }));
    }
    const title = options?.title ?? "";
    const lineNumbers = options?.lineNumbers ?? false;
    if (title || lineNumbers || lines.some((line) => line.kind !== undefined)) {
      out.push(
        ownBlock(
          state,
          renderCodeBlock({
            language: languageOf(token),
            title,
            lineNumbers,
            lines,
          }),
        ),
      );
      continue;
    }
    token.content =
      lines.length > 0 ? `${lines.map((line) => line.text).join("\n")}\n` : "";
    out.push(token);
  }
  state.tokens = out;
}
