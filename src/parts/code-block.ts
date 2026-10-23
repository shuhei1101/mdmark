import { escapeHtml } from "./escape.ts";

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

/** 読み上げの名前: 題があれば題、無ければ言語、どちらも無ければ `コード` */
function labelOf(options: { title: string; language: string }): string {
  const { title, language } = options;
  if (title) {
    return `コード: ${title}`;
  }
  return language ? `コード: ${language}` : "コード";
}

/** コードブロックの HTML を返す。行番号か行の種類を持つときは行ごとの `mdmark-code-line` に分け、題があれば `figure` と `figcaption` で包む。題だけのときは行に分けず `pre` のまま描く */
export function renderCodeBlock(options: {
  /** 情報文字列の言語（無ければ空） */
  language: string;
  /** 題（無ければ空） */
  title: string;
  /** 行番号を出すか */
  lineNumbers: boolean;
  /** コードの行 */
  lines: CodeLine[];
}): string {
  const { language, title, lineNumbers, lines } = options;
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
  const label = escapeHtml(labelOf({ title, language }));
  const codeAttributes = [
    language ? `class="language-${escapeHtml(language)}"` : "",
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
  if (!title) {
    return pre;
  }
  return `<figure class="mdmark-code"><figcaption class="mdmark-code-title">${escapeHtml(title)}</figcaption>${pre}</figure>`;
}
