/** 文書の先頭のフロントマターを空白にした本文と、フロントマターの中身・閉じる行 */
export type SplitFrontmatter = {
  /** フロントマターの範囲の改行以外の文字を空白にした Markdown（フロントマターが無ければ元のまま） */
  body: string;
  /** フロントマターの中身（開く行と閉じる行を除いた行。行の間は `\n`）。無ければ `undefined` */
  content: string | undefined;
  /** 閉じる行の 0 始まりの行番号。無ければ `undefined` */
  endLine: number | undefined;
};

/** 開く行（行末の空白を許す） */
const OPEN_LINE = /^---[ \t]*$/;

/** 閉じる行（行末の空白を許す） */
const CLOSE_LINE = /^(?:---|\.\.\.)[ \t]*$/;

/** 先頭の BOM */
const BOM = "﻿";

/** 改行以外の文字を空白にする（行番号と文字の位置を変えない） */
const blankOut = (text: string): string => text.replace(/[^\r\n]/g, " ");

/** Markdown の先頭のフロントマターを判定し、その範囲を空白にした本文と、中身・閉じる行を返却する */
export const splitFrontmatter = (markdown: string): SplitFrontmatter => {
  const none: SplitFrontmatter = {
    body: markdown,
    content: undefined,
    endLine: undefined,
  };
  const text = markdown.startsWith(BOM) ? markdown.slice(BOM.length) : markdown;
  // 改行を残して行に分ける（CR は行末に残し、判定の前に除く）
  const lines = text.split("\n");
  const stripCr = (line: string) => line.replace(/\r$/, "");
  if (!OPEN_LINE.test(stripCr(lines[0] ?? ""))) {
    return none;
  }
  const endLine = lines.findIndex(
    (line, index) => index > 0 && CLOSE_LINE.test(stripCr(line)),
  );
  if (endLine < 0) {
    return none;
  }
  const content = lines.slice(1, endLine).map(stripCr).join("\n");
  // フロントマターの範囲（BOM を含む先頭から閉じる行の終わりまで）を空白にする
  const rangeLength =
    markdown.length -
    text.length +
    lines.slice(0, endLine + 1).join("\n").length;
  const body =
    blankOut(markdown.slice(0, rangeLength)) + markdown.slice(rangeLength);
  return { body, content, endLine };
};
