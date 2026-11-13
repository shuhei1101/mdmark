import { hiddenLinesOf } from "../code-fold-logic.ts";
import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 色分けの対象の `code` に付ける属性。値は色分けの言語のモジュール名。mdmark が出した要素だけが sanitize を通って持ち続けるため、文書に記載した生の HTML の `code` は色分けの対象にならない */
export const SYNTAX_ATTRIBUTE = "data-mdmark-syntax";

/** mermaid のコードブロックの一番外の要素に付ける属性。`mount` が図にする対象を見つけるのに使用する */
export const MERMAID_ATTRIBUTE = "data-mdmark-mermaid";

/** コードの行 1 つ */
export type CodeLine = {
  /** コードの行のマーカーを削除した行の文字（エスケープ前） */
  text: string;
  /** 行の種類。無ければ飾らない行 */
  kind?:
    | "add"
    | "del"
    | "highlight"
    | "focus"
    | "error"
    | "warning"
    | undefined;
  /** インデントのレベル。無ければインデントの無い行か空行 */
  indent?: number | undefined;
  /** 畳める行の後ろの畳む行の数。無ければ畳めない行 */
  foldLines?: number | undefined;
  /** 最初から畳んだ状態か */
  folded?: boolean | undefined;
};

/** 行の開閉のボタンの HTML を返却する */
export function renderCodeFoldToggle(options: {
  /** 開いているか */
  expanded: boolean;
  /** 畳む範囲の最初の行番号（1 から） */
  from: number;
  /** 畳む範囲の最後の行番号（1 から） */
  to: number;
  /** 畳む行の `id` を空白で並べたもの */
  controls: string;
}): string {
  const { expanded, from, to, controls } = options;
  const icon = expanded ? "chevron-down" : "chevron-right";
  return `<button class="mdmark-code-fold" type="button" aria-expanded="${expanded}" aria-controls="${escapeHtml(controls)}" aria-label="${from} 行目から ${to} 行目"><span class="mdmark-code-fold-icon" data-icon="${icon}">${iconSvg(icon)}</span></button>`;
}

/** 畳んだ行の末尾に配置する `⋯` のボタンの HTML を返却する */
export function renderCodeFoldMore(options: {
  /** 畳んだ範囲の最初の行番号（1 から） */
  from: number;
  /** 畳んだ範囲の最後の行番号（1 から） */
  to: number;
}): string {
  const { from, to } = options;
  return `<button class="mdmark-code-fold-more" type="button" aria-label="${from} 行目から ${to} 行目を展開">⋯</button>`;
}

/** 行の `id`（開閉のボタンの `aria-controls` が指す） */
export function codeLineId(base: string, index: number): string {
  return `${base}-line-${index + 1}`;
}

/** 行を `mdmark-code-line` にする。`data-line` は行番号を出すときだけ、`data-kind` は種類を持つ行だけ、`data-indent`・`data-fold-lines`・`data-folded` は持つ行だけ付ける。`fold` を指定すると開閉のボタンと `⋯` を配置する */
function renderLine(options: {
  line: CodeLine;
  number: number | undefined;
  fold?: { id: string; hidden: boolean; toggle: string; more: string };
}): string {
  const { line, number, fold } = options;
  const attributes = [
    fold ? ` id="${escapeHtml(fold.id)}"` : "",
    number === undefined ? "" : ` data-line="${number}"`,
    line.kind === undefined ? "" : ` data-kind="${line.kind}"`,
    line.indent ? ` data-indent="${line.indent}"` : "",
    line.foldLines === undefined ? "" : ` data-fold-lines="${line.foldLines}"`,
    line.folded ? ' data-folded="true"' : "",
    fold?.hidden ? " hidden" : "",
  ].join("");
  return `<span class="mdmark-code-line"${attributes}>${fold?.toggle ?? ""}<span class="mdmark-code-text">${escapeHtml(line.text)}</span>${fold?.more ?? ""}</span>`;
}

/** コピーのボタンの状態 */
export type CodeCopyState = "idle" | "copied" | "failed";

/** コピーのボタンの状態ごとの文言とアイコン */
const COPY_LABELS = {
  idle: { text: "コピー", icon: "copy" },
  copied: { text: "コピーしました", icon: "check" },
  failed: { text: "コピーできませんでした", icon: "circle-alert" },
} as const;

/** コードブロックの帯の右端に配置する、コピーのボタンとスクリーンリーダー向けの要素を返却する。`copied`・`failed` のときはスクリーンリーダー向けの要素に `コードを{文言}` を入れる */
export function renderCodeCopy(options: { state: CodeCopyState }): string {
  const { state } = options;
  const { text, icon } = COPY_LABELS[state];
  const status = state === "idle" ? "" : `コードを${text}`;
  return `<span class="mdmark-code-meta"><button class="mdmark-code-copy" type="button" data-state="${state}">${iconSvg(icon)}${text}</button><span class="mdmark-visually-hidden mdmark-code-status" role="status">${status}</span></span>`;
}

/** スクリーンリーダー向けの名前: タイトルがあればタイトル、無ければファイル名、無ければ言語、どれも無ければ `コード` */
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

/** コードブロックの HTML を返却する。行番号か行の種類を持つときは行ごとの `mdmark-code-line` に分ける。`bar` が `true`（既定）のときは、言語のラベル・タイトル・コピーのボタンを持つ帯を `pre` の前に配置して包み、`false` のときは `pre` だけを返却する */
export function renderCodeBlock(options: {
  /** 情報文字列の言語（無ければ空） */
  language: string;
  /** 情報文字列のファイル名（無ければ省く） */
  fileName?: string | undefined;
  /** タイトル（無ければ空） */
  title: string;
  /** 行番号を出すか */
  lineNumbers: boolean;
  /** 最初の行の番号（既定 1） */
  lineStart?: number | undefined;
  /** 長い行を折り返すか（既定 `false`。折り返すときは行に分ける） */
  wrap?: boolean | undefined;
  /** コードの行 */
  lines: CodeLine[];
  /** 色分けする言語のモジュール名。指定すると `code` に `SYNTAX_ATTRIBUTE` を付ける */
  syntax?: string | undefined;
  /** mermaid の対象か。`true` なら一番外の要素に `MERMAID_ATTRIBUTE` を付ける */
  mermaid?: boolean | undefined;
  /** 帯を付けるか（既定 `true`） */
  bar?: boolean | undefined;
  /** 指定すると帯の右端にコピーのボタンを配置する */
  copyState?: CodeCopyState | undefined;
  /** 行の開閉のボタンを配置するか（既定 `false`） */
  foldButtons?: boolean | undefined;
  /** ポインターが開閉のボタンの列に乗っているか。`true` なら `pre` に `data-fold-hover` を付ける（既定 `false`） */
  foldColumnHovered?: boolean | undefined;
}): string {
  const { language, title, lineNumbers, lines, syntax } = options;
  const { fileName = "", bar = true, copyState, foldButtons } = options;
  const wrap = options.wrap === true;
  const lineStart = options.lineStart ?? 1;
  const mermaidAttribute =
    options.mermaid === true ? ` ${MERMAID_ATTRIBUTE}` : "";
  const split =
    lineNumbers ||
    wrap ||
    lines.some(
      (line) =>
        line.kind !== undefined ||
        Boolean(line.indent) ||
        line.foldLines !== undefined,
    );
  const classes = split
    ? [
        "mdmark-code-lines",
        ...(lineNumbers ? ["mdmark-code-numbered"] : []),
        ...(lines.some((line) => line.kind === "add" || line.kind === "del")
          ? ["mdmark-code-signs"]
          : []),
        ...(lines.some((line) => line.kind === "focus")
          ? ["mdmark-code-has-focus"]
          : []),
        // 開閉のボタンを配置するときは、`mount` と同じく開閉のボタンの列の幅を取る
        ...(foldButtons && lines.some((line) => line.foldLines !== undefined)
          ? ["mdmark-code-foldable"]
          : []),
        ...(wrap ? ["mdmark-code-wrap"] : []),
      ]
    : [];
  const preClass = classes.length ? ` class="${classes.join(" ")}"` : "";
  const label = escapeHtml(labelOf({ title, fileName, language }));
  const codeAttributes = [
    language ? `class="language-${escapeHtml(language)}"` : "",
    syntax ? `${SYNTAX_ATTRIBUTE}="${escapeHtml(syntax)}"` : "",
    lineNumbers
      ? `style="--mdmark-code-digits: ${String(lineStart + lines.length - 1).length}"`
      : "",
  ]
    .filter(Boolean)
    .map((attribute) => ` ${attribute}`)
    .join("");
  const hidden = foldButtons
    ? hiddenLinesOf({
        foldLines: lines.map((line) => line.foldLines),
        folded: lines.map((line) => line.folded === true),
      })
    : new Set<number>();
  /** 開閉のボタンを配置するときの、行の `id`・隠すか・ボタン・`⋯` */
  const foldOf = (line: CodeLine, index: number) => {
    if (!foldButtons) {
      return undefined;
    }
    const count = line.foldLines ?? 0;
    const range = { from: index + 2, to: index + 1 + count };
    const controls = Array.from({ length: count }, (_, offset) =>
      codeLineId("mdmark-code", index + 1 + offset),
    ).join(" ");
    return {
      id: codeLineId("mdmark-code", index),
      hidden: hidden.has(index),
      toggle:
        count > 0
          ? renderCodeFoldToggle({
              expanded: !line.folded,
              ...range,
              controls,
            })
          : "",
      more: count > 0 && line.folded ? renderCodeFoldMore(range) : "",
    };
  };
  const body = split
    ? lines
        .map((line, index) =>
          renderLine({
            line,
            number: lineNumbers ? lineStart + index : undefined,
            fold: foldOf(line, index),
          }),
        )
        .join("\n")
    : escapeHtml(lines.map((line) => line.text).join("\n")) +
      (lines.length > 0 ? "\n" : "");
  const hoverAttribute =
    options.foldColumnHovered === true ? " data-fold-hover" : "";
  const pre = `<pre${preClass}${hoverAttribute} tabindex="0" aria-label="${label}"><code${codeAttributes}>${body}</code></pre>`;
  if (!bar) {
    return `<pre${mermaidAttribute}${pre.slice("<pre".length)}`;
  }
  const barContent =
    renderLanguageLabel({ language, fileName }) +
    (title ? escapeHtml(title) : "") +
    (copyState === undefined ? "" : renderCodeCopy({ state: copyState }));
  if (title) {
    return `<figure class="mdmark-code"${mermaidAttribute}><figcaption class="mdmark-code-title mdmark-code-bar">${barContent}</figcaption>${pre}</figure>`;
  }
  return `<div class="mdmark-code"${mermaidAttribute}><div class="mdmark-code-bar">${barContent}</div>${pre}</div>`;
}
