import type { StateCore, Token } from "markdown-it";
import { COLOR_NAMES, isColorName } from "../../parts/colors.ts";
import { markOwn, SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import { renderTextColor } from "../../parts/text-color.ts";
import { envOf, featureOn } from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

/** 角括弧の開きと、閉じの直後の色の属性を探す正規表現 */
const BRACKET_PATTERN = /\[|\]\{color=([^}]*)\}/g;

/** 書き方の警告に並べる色の名前の一覧 */
const COLOR_LIST = COLOR_NAMES.map((name) => `\`${name}\``).join("・");

/** 子のトークンを分けた後の 1 つ。角括弧の開き・閉じは位置を覚えて後で置き換える */
type Piece =
  | { kind: "token"; token: Token }
  | { kind: "open"; level: number }
  | { kind: "close"; level: number; color: string; raw: string };

/** 子のトークンを、リンクの外の `text` にある `[` と `]{color=…}` の位置で分ける */
function splitPieces(state: StateCore, children: Token[]): Piece[] {
  const pieces: Piece[] = [];
  let level = 0;
  let linkDepth = 0;
  for (const child of children) {
    if (child.type === "link_open") {
      linkDepth += 1;
    } else if (child.type === "link_close") {
      linkDepth -= 1;
    }
    if (child.type !== "text" || linkDepth > 0) {
      pieces.push({ kind: "token", token: child });
      level += child.nesting;
      continue;
    }
    let last = 0;
    for (const found of child.content.matchAll(BRACKET_PATTERN)) {
      const at = found.index ?? 0;
      if (at > last) {
        pieces.push({
          kind: "token",
          token: textToken(state, child.content.slice(last, at)),
        });
      }
      pieces.push(
        found[1] === undefined
          ? { kind: "open", level }
          : { kind: "close", level, color: found[1], raw: found[0] },
      );
      last = at + found[0].length;
    }
    if (last === 0) {
      pieces.push({ kind: "token", token: child });
    } else if (last < child.content.length) {
      pieces.push({
        kind: "token",
        token: textToken(state, child.content.slice(last)),
      });
    }
  }
  return pieces;
}

/** 開きと閉じを、同じ入れ子の深さで近いものどうし組にし、開きの位置から閉じの位置を引く表を返す */
function pairBrackets(pieces: Piece[]): Map<number, number> {
  const pairs = new Map<number, number>();
  const opens: number[] = [];
  for (const [index, piece] of pieces.entries()) {
    if (piece.kind === "open") {
      opens.push(index);
    } else if (piece.kind === "close") {
      let found = opens.length - 1;
      while (
        found >= 0 &&
        (pieces[opens[found] as number] as { level: number }).level !==
          piece.level
      ) {
        found -= 1;
      }
      if (found >= 0) {
        const [openAt] = opens.splice(found);
        pairs.set(openAt as number, index);
      }
    }
  }
  return pairs;
}

/** `text-color` がオンなら、角括弧の文字の直後の `{color=色}` を本文の文字の色の部品にし、知らない色は角括弧と属性だけを外して段落の前に警告を置く */
export function buildTextColors(state: StateCore): void {
  if (!featureOn(state, "text-color")) {
    return;
  }
  const nonce = envOf(state).nonce;
  const warnings: Array<{ index: number; unknown: string[] }> = [];
  for (const [index, token] of state.tokens.entries()) {
    if (token.type !== "inline" || !token.children?.length) {
      continue;
    }
    const pieces = splitPieces(state, token.children);
    const pairs = pairBrackets(pieces);
    if (pairs.size === 0) {
      continue;
    }
    const closes = new Map([...pairs].map(([open, close]) => [close, open]));
    const unknown: string[] = [];
    const children: Token[] = [];
    for (const [at, piece] of pieces.entries()) {
      if (piece.kind === "token") {
        children.push(piece.token);
        continue;
      }
      const openAt = piece.kind === "open" ? at : closes.get(at);
      const closeAt = piece.kind === "close" ? at : pairs.get(at);
      const close = closeAt === undefined ? undefined : pieces[closeAt];
      if (openAt === undefined || close?.kind !== "close") {
        // 組にならない開き・閉じは書いた文字のまま残す
        children.push(
          textToken(state, piece.kind === "open" ? "[" : piece.raw),
        );
        continue;
      }
      if (!isColorName(close.color)) {
        if (piece.kind === "open") {
          unknown.push(close.color);
        }
        continue;
      }
      const [before, after] = splitSlots(
        markOwn(
          renderTextColor({ color: close.color, text: SLOT_MARKER }),
          nonce,
        ),
      );
      const html = new state.Token("html_inline", "", 0);
      html.content = (piece.kind === "open" ? before : after) ?? "";
      children.push(html);
    }
    token.children = children;
    if (unknown.length) {
      warnings.push({ index, unknown });
    }
  }
  for (const { index, unknown } of warnings.reverse()) {
    const names = unknown.map((name) => `\`${name}\``).join("・");
    state.tokens.splice(
      blockStartOf(state.tokens, index),
      0,
      warningBlock(state, {
        message: `${names} は色の名前ではありません。使える色の名前は ${COLOR_LIST} です。色を付けずに描いています。`,
      }),
    );
  }
}

/** `index` のトークンを含む、入れ子の深さ 0 のブロックの開きの位置を返す */
function blockStartOf(tokens: Token[], index: number): number {
  let at = index;
  while (at > 0 && (tokens[at]?.level ?? 0) > 0) {
    at -= 1;
  }
  return at;
}

/** 中身を渡した `text` のトークンを作る */
function textToken(state: StateCore, content: string): Token {
  const token = new state.Token("text", "", 0);
  token.content = content;
  return token;
}
