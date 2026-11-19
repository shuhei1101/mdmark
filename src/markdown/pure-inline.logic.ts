import { splitBadgeColor } from "../inline/badge.syntax.ts";

/** 行内のコード（同じ数の逆引用符で囲んだ範囲） */
const CODE_SPAN_PATTERN = /(`+)([\s\S]*?[^`])\1(?!`)/g;

/** HTML のコメント */
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/** 閉じのタグを持つ行内の HTML の要素（中の文字ごと） */
const PAIRED_TAG_PATTERN =
  /<([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1\s*>/g;

/** 残った開きのタグ・閉じのタグ・空の要素のタグ（`<https://…>` の自動リンクは名前の後ろが `:` なので含めない） */
const SINGLE_TAG_PATTERN = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:[\s/][^>]*)?>/g;

/** 行頭の注記の定義 `※[ID]:` */
const ANNOTATION_DEFINITION_PATTERN = /^(\s*)※\[([^\]\s]+)\]:/;

/** 注記の参照 `※[ID]` */
const ANNOTATION_REF_PATTERN = /※\[([^\]\s]+)\]/g;

/** 行内の脚注 `^[中身]` */
const INLINE_FOOTNOTE_PATTERN = /\^\[([^\]]*)\]/g;

/** 画像の直後の属性 `{…}` */
const IMAGE_ATTRIBUTE_PATTERN = /(!\[[^\]]*\]\([^)]*\))\{[^{}]*\}/g;

/** 本文の文字の色 `[文字]{color=名前}` */
const TEXT_COLOR_PATTERN = /\[([^\]]*)\]\{color=[^}]*\}/g;

/** 蛍光ペン `==文字==`（色の指定を含む） */
const HIGHLIGHT_PATTERN = /==([^=]+)==(?:\{color=[^}]*\})?/g;

/** 図と表の番号を出すリンク `[…](#fig-ID)` */
const FIGURE_LINK_PATTERN = /\[[^\]]*\]\(#(fig-[^)\s]+)\)/g;

/** タイトルを付けた注意書きの 1 行目 */
const CALLOUT_TITLE_PATTERN = /^(\s*>\s*)\[!([A-Za-z]+)\][-+]?\s+(\S.*)$/;

/** 行内のコードの頭と、その記法の機能の名前 */
const CODE_PREFIXES = {
  "badge:": "badge",
  "kbd:": "kbd",
  "icon:": "icon",
} as const satisfies Record<string, string>;

/** 機能がオフでなければ真（`features` に無い機能はオン） */
function featureOn(features: Record<string, boolean>, name: string): boolean {
  return features[name] !== false;
}

/** 行内のコードの中身を、記法を除いた行内のコードにする。アイコンは空にする */
function convertCode(
  ticks: string,
  content: string,
  features: Record<string, boolean>,
): string {
  for (const [prefix, feature] of Object.entries(CODE_PREFIXES)) {
    const escaped = `${prefix.slice(0, -1)}\\:`;
    if (content.startsWith(escaped) && featureOn(features, feature)) {
      return `${ticks}${prefix}${content.slice(escaped.length)}${ticks}`;
    }
    if (!content.startsWith(prefix) || !featureOn(features, feature)) {
      continue;
    }
    const rest = content.slice(prefix.length);
    if (feature === "icon") {
      return "";
    }
    const label = feature === "badge" ? splitBadgeColor(rest).label : rest;
    return `${ticks}${label}${ticks}`;
  }
  return `${ticks}${content}${ticks}`;
}

/** 行内のコードの外の文字を変換する */
function convertText(options: {
  text: string;
  numbers: Map<string, string>;
  features: Record<string, boolean>;
  lineHead: boolean;
}): string {
  const { numbers, features, lineHead } = options;
  let text = options.text
    .replace(COMMENT_PATTERN, "")
    .replace(PAIRED_TAG_PATTERN, "")
    .replace(SINGLE_TAG_PATTERN, "");
  if (featureOn(features, "annotations")) {
    if (lineHead) {
      text = text.replace(ANNOTATION_DEFINITION_PATTERN, "$1[^note-$2]:");
    }
    text = text.replace(ANNOTATION_REF_PATTERN, "[^note-$1]");
  }
  if (featureOn(features, "footnotes")) {
    text = text.replace(INLINE_FOOTNOTE_PATTERN, "（$1）");
  }
  if (featureOn(features, "images")) {
    text = text.replace(IMAGE_ATTRIBUTE_PATTERN, "$1");
  }
  if (featureOn(features, "text-color")) {
    text = text.replace(TEXT_COLOR_PATTERN, "$1");
  }
  if (featureOn(features, "highlight")) {
    text = text.replace(HIGHLIGHT_PATTERN, "$1");
  }
  return text.replace(FIGURE_LINK_PATTERN, (whole, id: string) => {
    const label = numbers.get(id);
    return label === undefined ? whole : `[${label}](#${id})`;
  });
}

/** 1 行の中の mdmark だけの行内の書き方と生の HTML を、mdmark の無い表示で読める文字にする */
export function convertPureInline(options: {
  /** 1 行 */
  line: string;
  /** 番号を振った図・表の ID（`fig-` を含む）から、表示する番号（`図 1`・`表 1`）の表 */
  numbers: Map<string, string>;
  /** 機能のオン・オフ */
  features: Record<string, boolean>;
}): string {
  const { line, numbers, features } = options;
  let converted = "";
  let last = 0;
  for (const match of line.matchAll(CODE_SPAN_PATTERN)) {
    const at = match.index;
    converted += convertText({
      text: line.slice(last, at),
      numbers,
      features,
      lineHead: last === 0,
    });
    converted += convertCode(match[1] ?? "", match[2] ?? "", features);
    last = at + match[0].length;
  }
  converted += convertText({
    text: line.slice(last),
    numbers,
    features,
    lineHead: last === 0,
  });
  const callout = featureOn(features, "callout")
    ? CALLOUT_TITLE_PATTERN.exec(converted)
    : null;
  if (callout) {
    const [, quote = "> ", kind = "NOTE", title = ""] = callout;
    return `${quote}[!${kind}]\n${quote.trimEnd()} **${title}**`;
  }
  return converted;
}
