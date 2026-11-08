import type { MarkdownIt, StateCore, StateInline, Token } from "markdown-it";
import { COLOR_NAMES, isColorName } from "../../parts/colors.ts";
import { insertWarningsBeforeBlocks } from "./blocks.ts";
import { envOf, featureOn } from "./tokens.ts";
import type { SyntaxWarning } from "./warnings.ts";

/** `=` の文字コード */
const EQUALS = 0x3d;

/** 閉じの `==` の直後の色の属性 */
const COLOR_PATTERN = /^\{color=([^}]*)\}/;

/** 書き方の警告に並べる色の名前の一覧 */
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

/** 組になった `==` の区切りを `mark_open`・`mark_close` にする */
const pairHighlights = (state: StateInline, delimiters: Delimiter[]): void => {
  const lone: number[] = [];
  for (const start of delimiters) {
    if (start.marker !== EQUALS || start.end === -1) {
      continue;
    }
    const end = delimiters[start.end];
    if (!end) {
      continue;
    }
    const open = state.tokens[start.token];
    const close = state.tokens[end.token];
    if (!open || !close) {
      continue;
    }
    open.type = "mark_open";
    open.tag = "mark";
    open.nesting = 1;
    open.markup = "==";
    open.content = "";
    close.type = "mark_close";
    close.tag = "mark";
    close.nesting = -1;
    close.markup = "==";
    close.content = "";
    const before = state.tokens[end.token - 1];
    if (before?.type === "text" && before.content === "=") {
      lone.push(end.token - 1);
    }
  }
  // 閉じの前に余った `=` は閉じの後ろへ回す（markdown-it の取り消し線と同じ扱い）
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

/** 中身を渡した `text` のトークンを作る */
const textToken = (state: StateCore, content: string): Token => {
  const token = new state.Token("text", "", 0);
  token.content = content;
  return token;
};

/** コアルール: `highlight` がオンなら蛍光ペンに class と色を当て、オフなら `==` を書いた文字に戻す */
const finishHighlights = (state: StateCore): void => {
  const on = featureOn(state, "highlight");
  const nonce = envOf(state).nonce;
  const warnings: Array<{ index: number; warning: SyntaxWarning }> = [];
  for (const [index, token] of state.tokens.entries()) {
    const children = token.children;
    if (token.type !== "inline" || !children) {
      continue;
    }
    const opens: Token[] = [];
    const unknown: string[] = [];
    for (let at = 0; at < children.length; at++) {
      const child = children[at] as Token;
      if (child.type === "mark_open") {
        if (!on) {
          children[at] = textToken(state, "==");
          continue;
        }
        child.attrSet("data-mdmark-own", nonce);
        child.attrSet("class", "mdmark-highlight");
        opens.push(child);
        continue;
      }
      if (child.type !== "mark_close") {
        continue;
      }
      if (!on) {
        children[at] = textToken(state, "==");
        continue;
      }
      const open = opens.pop();
      const next = children[at + 1];
      const color =
        next?.type === "text" ? COLOR_PATTERN.exec(next.content) : null;
      if (!next || !color) {
        continue;
      }
      next.content = next.content.slice(color[0].length);
      const name = color[1] ?? "";
      if (isColorName(name)) {
        open?.attrSet("data-color", name);
      } else {
        unknown.push(name);
      }
    }
    if (unknown.length) {
      const names = unknown.map((name) => `\`${name}\``).join("・");
      warnings.push({
        index,
        warning: {
          message: `${names} は色の名前ではありません。使える色の名前は ${COLOR_LIST} です。既定の色で描いています。`,
        },
      });
    }
  }
  insertWarningsBeforeBlocks(state, warnings);
};

/** markdown-it に、`==` で囲んだ文字を蛍光ペンにする行内のルールと、機能と色を当てるコアルールを足す */
export const useHighlight = (md: MarkdownIt): void => {
  md.inline.ruler.before("emphasis", "mdmark_highlight", tokenizeHighlight);
  md.inline.ruler2.before("emphasis", "mdmark_highlight", postProcessHighlight);
  // 取り込んだ文書の蛍光ペンにも当てるため、取り込みの後に置く
  md.core.ruler.after(
    "mdmark_expand_includes",
    "mdmark_finish_highlights",
    finishHighlights,
  );
};
