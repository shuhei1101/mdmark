import type { MarkdownIt, StateCore, StateInline, Token } from "markdown-it";
import { COLOR_NAMES, isColorName } from "../../parts/colors.ts";
import { insertWarningsBeforeBlocks } from "./blocks.ts";
import { envOf, featureOn } from "./tokens.ts";
import type { SyntaxWarning } from "./warnings.ts";

/** `=` の文字コード */
const EQUALS = 0x3d;

/** 閉じの `==` の直後の色の属性 */
const COLOR_PATTERN = /^\{color=([^}]*)\}/;

/** 記載の警告に並べる色の名前の一覧 */
const COLOR_LIST = COLOR_NAMES.map((name) => `\`${name}\``).join("・");

/** markdown-it の区切りの記録 1 つ（`state.delimiters` の要素） */
type Delimiter = StateInline["delimiters"][number];

/** 行内のルール: `==` の並びを区切りとして記録する（2 つずつ組にし、余りの 1 つは文字にする） */
const tokenizeHighlight = (state: StateInline, silent: boolean): boolean => {
  const start = state.pos;
  if (silent || state.src.charCodeAt(start) !== EQUALS) {
    return false;
  }
  const scanned = state.scanDelims(state.pos, true);
  let length = scanned.length;
  if (length < 2) {
    return false;
  }
  if (length % 2 === 1) {
    const token = state.push("text", "", 0);
    token.content = "=";
    length -= 1;
  }
  for (let at = 0; at < length; at += 2) {
    const token = state.push("text", "", 0);
    token.content = "==";
    state.delimiters.push({
      marker: EQUALS,
      length: 0,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close,
    } as Delimiter);
  }
  state.pos += scanned.length;
  return true;
};

/** トークンを蛍光ペンの開きか閉じにする */
const toMarkToken = (token: Token, nesting: 1 | -1): void => {
  token.type = nesting === 1 ? "mark_open" : "mark_close";
  token.tag = "mark";
  token.nesting = nesting;
  token.markup = "==";
  token.content = "";
};

/** 組になった `==` の区切り 1 つを `mark_open`・`mark_close` にし、閉じの前に余った `=` があればその位置を返却する */
const pairHighlight = (
  state: StateInline,
  start: Delimiter,
  delimiters: Delimiter[],
): number | undefined => {
  const end = start.end === -1 ? undefined : delimiters[start.end];
  const open = state.tokens[start.token];
  const close = end ? state.tokens[end.token] : undefined;
  if (start.marker !== EQUALS || !end || !open || !close) {
    return undefined;
  }
  toMarkToken(open, 1);
  toMarkToken(close, -1);
  const before = state.tokens[end.token - 1];
  return before?.type === "text" && before.content === "="
    ? end.token - 1
    : undefined;
};

/** 閉じの前に余った `=` を閉じの後ろへ回す（markdown-it の取り消し線と同じ扱い） */
const moveLoneEquals = (state: StateInline, lone: number[]): void => {
  for (const at of lone.reverse()) {
    let swap = at;
    while (
      state.tokens[swap + 1]?.type === "mark_close" &&
      swap + 1 < state.tokens.length
    ) {
      const current = state.tokens[swap] as Token;
      state.tokens[swap] = state.tokens[swap + 1] as Token;
      state.tokens[swap + 1] = current;
      swap += 1;
    }
  }
};

/** 組になった `==` の区切りを `mark_open`・`mark_close` にする */
const pairHighlights = (state: StateInline, delimiters: Delimiter[]): void => {
  const lone = delimiters
    .map((start) => pairHighlight(state, start, delimiters))
    .filter((at) => at !== undefined);
  moveLoneEquals(state, lone);
};

/** 行内の後処理: 入れ子の区切りの並びも含めて `==` を組にする */
const postProcessHighlight = (state: StateInline): boolean => {
  pairHighlights(state, state.delimiters);
  for (const meta of state.tokens_meta) {
    if (meta?.delimiters) {
      pairHighlights(state, meta.delimiters);
    }
  }
  return true;
};

/** 中身を指定した `text` のトークンを作る */
const textToken = (state: StateCore, content: string): Token => {
  const token = new state.Token("text", "", 0);
  token.content = content;
  return token;
};

/** 蛍光ペンの開きと閉じを、記載した `==` の文字に戻す */
const restoreHighlights = (state: StateCore, children: Token[]): void => {
  for (const [at, child] of children.entries()) {
    if (child.type === "mark_open" || child.type === "mark_close") {
      children[at] = textToken(state, "==");
    }
  }
};

/** 閉じの直後の `{color=…}` を取り除き、色の名前なら開きに色を当てる。色の名前でなければその名前を返却する */
const applyColor = (
  next: Token | undefined,
  open: Token | undefined,
): string | undefined => {
  const color = next?.type === "text" ? COLOR_PATTERN.exec(next.content) : null;
  if (!next || !color) {
    return undefined;
  }
  next.content = next.content.slice(color[0].length);
  const name = color[1] ?? "";
  if (!isColorName(name)) {
    return name;
  }
  open?.attrSet("data-color", name);
  return undefined;
};

/** 蛍光ペンに class と色を当て、色の名前でない名前を返却する */
const applyHighlights = (children: Token[], nonce: string): string[] => {
  const opens: Token[] = [];
  const unknown: string[] = [];
  for (const [at, child] of children.entries()) {
    if (child.type === "mark_open") {
      child.attrSet("data-mdmark-own", nonce);
      child.attrSet("class", "mdmark-highlight");
      opens.push(child);
    } else if (child.type === "mark_close") {
      const name = applyColor(children[at + 1], opens.pop());
      if (name !== undefined) {
        unknown.push(name);
      }
    }
  }
  return unknown;
};

/** コアルール: `highlight` がオンなら蛍光ペンに class と色を当て、オフなら `==` を記載した文字に戻す */
const finishHighlights = (state: StateCore): void => {
  const on = featureOn(state, "highlight");
  const nonce = envOf(state).nonce;
  const warnings: Array<{ index: number; warning: SyntaxWarning }> = [];
  for (const [index, token] of state.tokens.entries()) {
    const children = token.children;
    if (token.type !== "inline" || !children) {
      continue;
    }
    if (!on) {
      restoreHighlights(state, children);
      continue;
    }
    const unknown = applyHighlights(children, nonce);
    if (unknown.length) {
      const names = unknown.map((name) => `\`${name}\``).join("・");
      warnings.push({
        index,
        warning: {
          message: `${names} は色の名前ではありません。使用できる色の名前は ${COLOR_LIST} です。既定の色で描いています。`,
        },
      });
    }
  }
  insertWarningsBeforeBlocks(state, warnings);
};

/** markdown-it に、`==` で囲んだ文字を蛍光ペンにする行内のルールと、機能と色を適用するコアルールを追加する */
export const useHighlight = (md: MarkdownIt): void => {
  md.inline.ruler.before("emphasis", "mdmark_highlight", tokenizeHighlight);
  md.inline.ruler2.before("emphasis", "mdmark_highlight", postProcessHighlight);
  // 取り込んだ文書の蛍光ペンにも適用するため、取り込みの後に配置する
  md.core.ruler.after(
    "mdmark_expand_includes",
    "mdmark_finish_highlights",
    finishHighlights,
  );
};
