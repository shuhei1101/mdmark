import { splitBadgeColor } from "../inline/badge.syntax.ts";
import { splitKeys } from "../inline/kbd.syntax.ts";
import { type ColorName, isColorName } from "../shared/colors.logic.ts";

/** 1 行を描き方ごとに分けた 1 つ */
export type InlineSegment = {
  kind: "text" | "badge" | "color" | "highlight" | "kbd";
  /** `text` は元の文字、`badge` はラベル、`color`・`highlight` は囲んだ文字、`kbd` は空 */
  text: string;
  /** `badge`・`color`・`highlight` の色の名前 */
  color?: ColorName | undefined;
  /** `kbd` のとき、`+` で区切ったキー */
  keys?: string[] | undefined;
  /** 行の中の、区切りの記法の頭の文字の位置 */
  start: number;
};

/** 行内のコード（同じ数の逆引用符で囲んだ範囲） */
const CODE_SPAN = /(`+)([\s\S]*?[^`])\1(?!`)/g;

/** 本文の文字の色 `[文字]{color=名前}` と、蛍光ペン `==文字==`（色の指定を含む） */
const TEXT_MARK =
  /\[([^\]]*)\]\{color=([^}]*)\}|==([^=]+)==(?:\{color=([^}]*)\})?/g;

/** 蛍光ペンの色を省いたときの色 */
const HIGHLIGHT_COLOR: ColorName = "yellow";

/** 区切りを追加する。続けて `text` を追加するときは前の `text` につなぐ */
const append = (segments: InlineSegment[], segment: InlineSegment): void => {
  const last = segments.at(-1);
  if (segment.kind === "text" && last?.kind === "text") {
    last.text += segment.text;
    return;
  }
  if (segment.kind !== "text" || segment.text !== "") {
    segments.push(segment);
  }
};

/** 行内のコードの中身を、バッジ・キー・元の文字のどれかの区切りにする */
const codeSegment = (options: {
  raw: string;
  content: string;
  start: number;
}): InlineSegment => {
  const { raw, content, start } = options;
  if (content.startsWith("badge:")) {
    const { color, label } = splitBadgeColor(content.slice("badge:".length));
    if (label.trim() !== "") {
      return { kind: "badge", text: label, color, start };
    }
  }
  if (content.startsWith("kbd:")) {
    const keys = splitKeys(content.slice("kbd:".length));
    if (keys.length > 0) {
      return { kind: "kbd", text: "", keys, start };
    }
  }
  return { kind: "text", text: raw, start };
};

/** 行内のコードではない文字を、文字の色・蛍光ペン・元の文字の区切りにする */
const textSegments = (
  segments: InlineSegment[],
  text: string,
  offset: number,
): void => {
  let from = 0;
  for (const match of text.matchAll(TEXT_MARK)) {
    append(segments, {
      kind: "text",
      text: text.slice(from, match.index),
      start: offset + from,
    });
    const start = offset + match.index;
    const [, colored, colorName, highlighted, highlightName] = match;
    if (colored !== undefined) {
      append(
        segments,
        colorName !== undefined && isColorName(colorName)
          ? { kind: "color", text: colored, color: colorName, start }
          : { kind: "text", text: colored, start },
      );
    } else {
      const name = highlightName ?? HIGHLIGHT_COLOR;
      append(
        segments,
        isColorName(name)
          ? { kind: "highlight", text: highlighted ?? "", color: name, start }
          : { kind: "text", text: highlighted ?? "", start },
      );
    }
    from = match.index + match[0].length;
  }
  append(segments, {
    kind: "text",
    text: text.slice(from),
    start: offset + from,
  });
};

/** 1 行の文字列を `InlineSegment` の並びにする。記法が無い行は `text` の 1 つだけを返却する */
export const splitInlineMarks = (line: string): InlineSegment[] => {
  const segments: InlineSegment[] = [];
  let from = 0;
  for (const match of line.matchAll(CODE_SPAN)) {
    textSegments(segments, line.slice(from, match.index), from);
    append(
      segments,
      codeSegment({
        raw: match[0],
        content: match[2] ?? "",
        start: match.index,
      }),
    );
    from = match.index + match[0].length;
  }
  textSegments(segments, line.slice(from), from);
  return segments.length === 0
    ? [{ kind: "text", text: "", start: 0 }]
    : segments;
};

/** 区切り 1 つの、画面に描かれる文字 */
const segmentText = (segment: InlineSegment): string => {
  if (segment.kind === "badge") {
    return ` ${segment.text} `;
  }
  if (segment.kind === "kbd") {
    return (segment.keys ?? []).map((key) => `[${key}]`).join("+");
  }
  return segment.text;
};

/** `InlineSegment` の並びを、画面に描かれる文字の列にする */
export const inlinePlainText = (segments: InlineSegment[]): string =>
  segments.map(segmentText).join("");
