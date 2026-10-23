import type { StateCore, Token } from "markdown-it";
import { markOwn } from "../../parts/own.ts";
import { MARK_TOKEN, type Mark } from "../marks.ts";
import type { RenderEnv } from "../parser.ts";

/** 解析の環境を取り出す */
export function envOf(state: StateCore): RenderEnv {
  return state.env as RenderEnv;
}

/** 記法の機能がオンか */
export function featureOn(state: StateCore, name: string): boolean {
  return envOf(state).features[name] === true;
}

/** mdmark が出した要素として印を付けた HTML を、`html_block` のトークンにする。`source` を渡すと、その `map`（元の行）を写す */
export function ownBlock(
  state: StateCore,
  html: string,
  source?: Token,
): Token {
  const token = new state.Token("html_block", "", 0);
  token.block = true;
  if (source?.map) {
    token.map = [...source.map];
  }
  token.content = markOwn(html, envOf(state).nonce);
  return token;
}

/** 印のトークンなら、その印を返す */
export function markOf(token: Token | undefined): Mark | undefined {
  return token?.type === MARK_TOKEN ? (token.meta as Mark) : undefined;
}

/** `openIndex` の印に対する閉じの印の位置を返す。無ければ `-1` */
export function findClose(
  tokens: Token[],
  openIndex: number,
  name: string,
): number {
  const level = tokens[openIndex]?.level;
  for (let index = openIndex + 1; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = markOf(token);
    if (mark?.closing && mark.name === name && token?.level === level) {
      return index;
    }
  }
  return -1;
}

/** `open` に対応する閉じのトークンの位置を、階層で探す */
export function findNestedClose(tokens: Token[], openIndex: number): number {
  const open = tokens[openIndex];
  for (let index = openIndex + 1; index < tokens.length; index++) {
    const token = tokens[index];
    if (
      token?.nesting === -1 &&
      token.level === open?.level &&
      token.type === open?.type.replace("_open", "_close")
    ) {
      return index;
    }
  }
  return -1;
}

/** インライン要素の文字（タグを除いたもの）を集める */
export function textOf(token: Token): string {
  return (token.children ?? [])
    .filter((child) => child.type === "text" || child.type === "code_inline")
    .map((child) => child.content)
    .join("");
}
