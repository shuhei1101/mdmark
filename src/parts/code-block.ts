import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 色分けの対象の `code` に付ける属性。値は色分けの言語のモジュール名。mdmark が出した要素だけが sanitize を通って持ち続けるため、文書に書いた生の HTML の `code` は色分けの対象にならない */
export const SYNTAX_ATTRIBUTE = "data-mdmark-syntax";

/** コードの行 1 つ */
export type CodeLine = {
  /** コードの行の印を外した行の文字（エスケープ前） */
  text: string;
  /** 行の種類。無ければ飾らない行 */
  kind?: "add" | "del" | "highlight" | undefined;
};

/** 行を `mdmark-code-line` にする。`data-line` は行番号を出すときだけ、`data-kind` は種類を持つ行だけ付ける */
function renderLine(options: {
  line: CodeLine;
  number: number | undefined;
}): string {
  const { line, number } = options;
  const lineAttribute = number === undefined ? "" : ` data-line="${number}"`;
  const kindAttribute =
    line.kind === undefined ? "" : ` data-kind="${line.kind}"`;
  return `<span class="mdmark-code-line"${lineAttribute}${kindAttribute}><span class="mdmark-code-text">${escapeHtml(line.text)}</span></span>`;
}

/** コピーのボタンの状態 */
export type CodeCopyState = "idle" | "copied" | "failed";

/** コピーのボタンの状態ごとの文言とアイコン */
const COPY_LABELS = {
  idle: { text: "コピー", icon: "copy" },
  copied: { text: "コピーしました", icon: "check" },
  failed: { text: "コピーできませんでした", icon: "circle-alert" },
} as const;

/** コードブロックの帯の右端に置く、コピーのボタンと読み上げの要素を返す。`copied`・`failed` のときは読み上げの要素に `コードを{文言}` を入れる */
export function renderCodeCopy(options: { state: CodeCopyState }): string {
  const { state } = options;
  const { text, icon } = COPY_LABELS[state];
  const status = state === "idle" ? "" : `コードを${text}`;
  return `<span class="mdmark-code-meta"><button class="mdmark-code-copy" type="button" data-state="${state}">${iconSvg(icon)}${text}</button><span class="mdmark-visually-hidden mdmark-code-status" role="status">${status}</span></span>`;
}

/** 読み上げの名前: 題があれば題、無ければファイル名、無ければ言語、どれも無ければ `コード` */
function labelOf(options: {
  title: string;
  fileName: string;
  language: string;
}): string {
  const { title, fileName, language } = options;
  const name = title || fileName || language;
  return name ? `コード: ${name}` : "コード";
}

/** 帯の左端の言語のラベル。言語が無ければ空 */
function renderLanguageLabel(options: {
  language: string;
  fileName: string;
}): string {
  const { language, fileName } = options;
  if (!language) {
    return "";
  }
  const file = fileName
    ? `<span class="mdmark-code-file">${escapeHtml(fileName)}</span>`
    : "";
  return `<span class="mdmark-code-lang"><span class="mdmark-code-lang-name" aria-hidden="true">${escapeHtml(language)}</span>${file}</span>`;
}

/** コードブロックの HTML を返す。行番号か行の種類を持つときは行ごとの `mdmark-code-line` に分ける。`bar` が `true`（既定）のときは、言語のラベル・題・コピーのボタンを持つ帯を `pre` の前に置いて包み、`false` のときは `pre` だけを返す */
export function renderCodeBlock(options: {
  /** 情報文字列の言語（無ければ空） */
  language: string;
  /** 情報文字列のファイル名（無ければ省く） */
  fileName?: string | undefined;
  /** 題（無ければ空） */
  title: string;
  /** 行番号を出すか */
  lineNumbers: boolean;
  /** コードの行 */
  lines: CodeLine[];
  /** 色分けする言語のモジュール名。渡すと `code` に `SYNTAX_ATTRIBUTE` を付ける */
  syntax?: string | undefined;
  /** 帯を付けるか（既定 `true`） */
  bar?: boolean | undefined;
  /** 渡すと帯の右端にコピーのボタンを置く */
  copyState?: CodeCopyState | undefined;
}): string {
  const { language, title, lineNumbers, lines, syntax } = options;
  const { fileName = "", bar = true, copyState } = options;
  const split = lineNumbers || lines.some((line) => line.kind !== undefined);
  const classes = split
    ? [
        "mdmark-code-lines",
        ...(lineNumbers ? ["mdmark-code-numbered"] : []),
        ...(lines.some((line) => line.kind === "add" || line.kind === "del")
          ? ["mdmark-code-signs"]
          : []),
      ]
    : [];
  const preClass = classes.length ? ` class="${classes.join(" ")}"` : "";
  const label = escapeHtml(labelOf({ title, fileName, language }));
  const codeAttributes = [
    language ? `class="language-${escapeHtml(language)}"` : "",
    syntax ? `${SYNTAX_ATTRIBUTE}="${escapeHtml(syntax)}"` : "",
    lineNumbers
      ? `style="--mdmark-code-digits: ${String(lines.length).length}"`
      : "",
  ]
    .filter(Boolean)
    .map((attribute) => ` ${attribute}`)
    .join("");
  const body = split
    ? lines
        .map((line, index) =>
          renderLine({ line, number: lineNumbers ? index + 1 : undefined }),
        )
        .join("\n")
    : escapeHtml(lines.map((line) => line.text).join("\n")) +
      (lines.length > 0 ? "\n" : "");
  const pre = `<pre${preClass} tabindex="0" aria-label="${label}"><code${codeAttributes}>${body}</code></pre>`;
  if (!bar) {
    return pre;
  }
  const barContent =
    renderLanguageLabel({ language, fileName }) +
    (title ? escapeHtml(title) : "") +
    (copyState === undefined ? "" : renderCodeCopy({ state: copyState }));
  if (title) {
    return `<figure class="mdmark-code"><figcaption class="mdmark-code-title mdmark-code-bar">${barContent}</figcaption>${pre}</figure>`;
  }
  return `<div class="mdmark-code"><div class="mdmark-code-bar">${barContent}</div>${pre}</div>`;
}
