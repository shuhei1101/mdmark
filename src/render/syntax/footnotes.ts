import type {
  MarkdownIt,
  StateBlock,
  StateCore,
  StateInline,
  Token,
} from "markdown-it";
import { escapeHtml } from "../../parts/escape.ts";
import {
  FOOTNOTE_BODY_OPEN,
  renderFootnoteRef,
  renderFootnotes,
} from "../../parts/footnote.ts";
import { markOwn, SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import type { RenderEnv } from "../parser.ts";
import { envOf, featureOn, ownBlock } from "./tokens.ts";

/** 脚注の定義の囲みの開きと閉じ、本文の参照のトークンの種類 */
const DEF_OPEN = "mdmark_footnote_def_open";
const DEF_CLOSE = "mdmark_footnote_def_close";
const REF = "mdmark_footnote_ref";

/** 定義の 2 段落目以降に要る字下げの幅 */
const CONTINUATION_INDENT = 4;

/** タブを字下げの幅に数えるときの、タブの位置の間隔 */
const TAB_WIDTH = 4;

/** 文字の符号: `[`・`]`・`^`・`:`・空白・タブ・改行 */
const OPEN_BRACKET = 0x5b;
const CLOSE_BRACKET = 0x5d;
const CARET = 0x5e;
const COLON = 0x3a;
const SPACE = 0x20;
const TAB = 0x09;
const NEWLINE = 0x0a;

/** 参照した順の脚注 1 つ。`key` が `null` なら行内の脚注で、`inline` に中身のトークンを持つ */
export type FootnoteNote = {
  key: string | null;
  inline: Token[] | null;
  refCount: number;
};

/** 1 回の解析で読んだ脚注の定義と参照 */
export type FootnoteState = {
  /** 正規化したラベルごとの定義のブロックのトークン（block の工程では `null`） */
  definitions: Map<string, Token[] | null>;
  /** 参照した順の脚注（位置 + 1 が番号） */
  notes: FootnoteNote[];
  /** ラベルごとの `notes` の位置 */
  numbers: Map<string, number>;
};

/** 定義の囲みの開きの `meta` */
type DefinitionMeta = { key: string; first: boolean; source: string };

/** 本文の参照の `meta` */
type ReferenceMeta = { id: number; refIndex: number; source: string };

/** 解析の環境の脚注の状態を返す。無ければ作る */
function footnoteStateOf(env: RenderEnv): FootnoteState {
  env.mdmarkFootnotes ??= {
    definitions: new Map(),
    notes: [],
    numbers: new Map(),
  };
  return env.mdmarkFootnotes;
}

/** 空白・タブ・改行か */
function isWhitespace(code: number): boolean {
  return code === SPACE || code === TAB || code === NEWLINE;
}

/** `pos` の `[^` から始まるラベルの閉じの `]` の位置を返す。空・空白を含む・閉じが無いときは `-1` */
function labelEnd(src: string, pos: number, max: number): number {
  for (let at = pos + 2; at < max; at++) {
    const code = src.charCodeAt(at);
    if (isWhitespace(code)) {
      return -1;
    }
    if (code === CLOSE_BRACKET) {
      return at === pos + 2 ? -1 : at;
    }
  }
  return -1;
}

/** 行頭の `[^ラベル]:` を脚注の定義として読み、字下げ 4 で続く行までを中身として囲む */
export function readFootnoteDefinition(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const src = state.src;
  const start = (state.bMarks[startLine] ?? 0) + (state.tShift[startLine] ?? 0);
  const max = state.eMarks[startLine] ?? 0;
  // 字下げ 4 以上はコードブロック
  if ((state.sCount[startLine] ?? 0) - state.blkIndent >= CONTINUATION_INDENT) {
    return false;
  }
  if (
    src.charCodeAt(start) !== OPEN_BRACKET ||
    src.charCodeAt(start + 1) !== CARET
  ) {
    return false;
  }
  const close = labelEnd(src, start, max);
  if (close < 0 || src.charCodeAt(close + 1) !== COLON) {
    return false;
  }
  if (silent) {
    return true;
  }
  const afterColon = close + 2;
  const key = state.md.utils.normalizeReference(src.slice(start + 2, close));
  const footnotes = footnoteStateOf(state.env as RenderEnv);
  const first = !footnotes.definitions.has(key);
  if (first) {
    footnotes.definitions.set(key, null);
  }
  const open = state.push(DEF_OPEN, "", 1);
  open.meta = {
    key,
    first,
    source: `${src.slice(start, afterColon)} `,
  } satisfies DefinitionMeta;
  open.map = [startLine, startLine];

  // `:` の後ろの空白を飛ばし、その後ろを字下げ 4 の中身の 1 行目として解析する
  const oldBMark = state.bMarks[startLine] ?? 0;
  const oldTShift = state.tShift[startLine] ?? 0;
  const oldSCount = state.sCount[startLine] ?? 0;
  const oldParentType = state.parentType;
  const initial = oldSCount + afterColon - start;
  let offset = initial;
  let pos = afterColon;
  while (pos < max) {
    const code = src.charCodeAt(pos);
    if (code === TAB) {
      offset += TAB_WIDTH - (offset % TAB_WIDTH);
    } else if (code === SPACE) {
      offset += 1;
    } else {
      break;
    }
    pos += 1;
  }
  state.tShift[startLine] = pos - afterColon;
  state.sCount[startLine] = offset - initial;
  state.bMarks[startLine] = afterColon;
  state.blkIndent += CONTINUATION_INDENT;
  state.parentType = "footnote" as typeof state.parentType;
  if ((state.sCount[startLine] ?? 0) < state.blkIndent) {
    state.sCount[startLine] = (state.sCount[startLine] ?? 0) + state.blkIndent;
  }
  state.md.block.tokenize(state, startLine, endLine);
  state.parentType = oldParentType;
  state.blkIndent -= CONTINUATION_INDENT;
  state.tShift[startLine] = oldTShift;
  state.sCount[startLine] = oldSCount;
  state.bMarks[startLine] = oldBMark;

  open.map = [startLine, state.line];
  state.push(DEF_CLOSE, "", -1);
  return true;
}

/** 本文の参照のトークンを足し、脚注の参照の数を増やす */
function pushReference(
  state: StateInline,
  id: number,
  source: string,
): void {
  const footnotes = footnoteStateOf(state.env as RenderEnv);
  const note = footnotes.notes[id];
  if (note === undefined) {
    throw new Error(`脚注の番号が無い: ${id}`);
  }
  const token = state.push(REF, "", 0);
  token.meta = {
    id,
    refIndex: note.refCount,
    source,
  } satisfies ReferenceMeta;
  note.refCount += 1;
}

/** `[^ラベル]` を、定義のあるラベルのときだけ本文の参照として読む */
export function readFootnoteReference(
  state: StateInline,
  silent: boolean,
): boolean {
  const { src, pos: start, posMax: max } = state;
  if (
    src.charCodeAt(start) !== OPEN_BRACKET ||
    src.charCodeAt(start + 1) !== CARET
  ) {
    return false;
  }
  const close = labelEnd(src, start, max);
  if (close < 0) {
    return false;
  }
  const key = state.md.utils.normalizeReference(src.slice(start + 2, close));
  const footnotes = (state.env as RenderEnv).mdmarkFootnotes;
  if (!footnotes?.definitions.has(key)) {
    return false;
  }
  if (!silent) {
    let id = footnotes.numbers.get(key);
    // 初めて参照したラベルに、次の番号を振る
    if (id === undefined) {
      id = footnotes.notes.length;
      footnotes.notes.push({ key, inline: null, refCount: 0 });
      footnotes.numbers.set(key, id);
    }
    pushReference(state, id, src.slice(start, close + 1));
  }
  state.pos = close + 1;
  return true;
}

/** `^[中身]` を行内の脚注として読み、中身を行内の Markdown として解析する */
export function readInlineFootnote(
  state: StateInline,
  silent: boolean,
): boolean {
  const { src, pos: start } = state;
  if (
    src.charCodeAt(start) !== CARET ||
    src.charCodeAt(start + 1) !== OPEN_BRACKET
  ) {
    return false;
  }
  const close = state.md.helpers.parseLinkLabel(state, start + 1);
  if (close < 0) {
    return false;
  }
  if (!silent) {
    const footnotes = footnoteStateOf(state.env as RenderEnv);
    const inline: Token[] = [];
    state.md.inline.parse(
      src.slice(start + 2, close),
      state.md,
      state.env,
      inline,
    );
    const id = footnotes.notes.length;
    footnotes.notes.push({ key: null, inline, refCount: 0 });
    pushReference(state, id, src.slice(start, close + 1));
  }
  state.pos = close + 1;
  return true;
}

/** `openIndex` の定義の囲みの開きに対する閉じの位置を返す */
function findDefinitionClose(tokens: Token[], openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index++) {
    const type = tokens[index]?.type;
    if (type === DEF_OPEN) {
      depth += 1;
    } else if (type === DEF_CLOSE) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new Error("脚注の定義の閉じが無い");
}

/** 機能がオフのとき、定義の中身の最初の段落の頭に `[^ラベル]: ` の文字を戻す（段落が無ければ文字だけの段落を作る） */
function restoreDefinition(
  state: StateCore,
  source: string,
  inner: Token[],
): Token[] {
  const [first, second] = inner;
  if (first?.type === "paragraph_open" && second?.type === "inline") {
    const text = new state.Token("text", "", 0);
    text.content = source;
    second.children = [text, ...(second.children ?? [])];
    second.content = `${source}${second.content}`;
    return inner;
  }
  const open = new state.Token("paragraph_open", "p", 1);
  const inline = new state.Token("inline", "", 0);
  const text = new state.Token("text", "", 0);
  text.content = source.trimEnd();
  inline.content = text.content;
  inline.children = [text];
  const close = new state.Token("paragraph_close", "p", -1);
  return [open, inline, close, ...inner];
}

/** 機能がオフのとき、本文の参照を書いた文字に戻す */
function restoreReferences(state: StateCore, tokens: Token[]): void {
  for (const token of tokens) {
    if (token.type !== "inline" || !token.children) {
      continue;
    }
    token.children = token.children.map((child) => {
      if (child.type !== REF) {
        return child;
      }
      const text = new state.Token("text", "", 0);
      text.content = (child.meta as ReferenceMeta).source;
      return text;
    });
  }
}

/** 脚注の機能がオンなら定義を本文から取り除いて控え、オフなら参照と定義を書いた文字のまま書いた位置に戻す */
export function collectFootnotes(state: StateCore): void {
  const env = envOf(state);
  const footnotes = env.mdmarkFootnotes;
  if (footnotes === undefined) {
    return;
  }
  const on = featureOn(state, "footnotes");
  const out: Token[] = [];
  for (let index = 0; index < state.tokens.length; index++) {
    const token = state.tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token.type !== DEF_OPEN) {
      out.push(token);
      continue;
    }
    const close = findDefinitionClose(state.tokens, index);
    const inner = state.tokens.slice(index + 1, close);
    const meta = token.meta as DefinitionMeta;
    if (!on) {
      out.push(...restoreDefinition(state, meta.source, inner));
    } else if (meta.first) {
      footnotes.definitions.set(meta.key, inner);
    }
    index = close;
  }
  state.tokens = out;
  if (!on) {
    restoreReferences(state, out);
    delete env.mdmarkFootnotes;
  }
}

/** 段落でないブロックの文字を、ツールチップの 1 段落の文字にする */
function blockText(tokens: Token[]): string {
  return tokens
    .map((token) => token.content.trim())
    .filter((text) => text !== "")
    .join(" ");
}

/** 脚注 1 つの中身を、ツールチップの段落ごとの行内の HTML と、一覧のブロックの HTML にする */
export function footnoteBodies(options: {
  md: MarkdownIt;
  env: RenderEnv;
  note: FootnoteNote;
}): { bodies: string[]; html: string } {
  const { md, env, note } = options;
  if (note.inline !== null) {
    const body = md.renderer.renderInline(note.inline, md.options, env);
    return { bodies: [body], html: `<p>${body}</p>` };
  }
  const tokens =
    (note.key === null ? null : env.mdmarkFootnotes?.definitions.get(note.key)) ??
    [];
  const bodies: string[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    // 段落は p を外した行内の HTML、それ以外のブロックは閉じまでの文字を 1 段落にする
    if (token.type === "paragraph_open") {
      const inline = tokens[index + 1];
      bodies.push(
        md.renderer.renderInline(inline?.children ?? [], md.options, env),
      );
      index += 2;
      continue;
    }
    let end = index;
    for (let depth = token.nesting; depth > 0; ) {
      end += 1;
      depth += tokens[end]?.nesting ?? -depth;
    }
    const text = blockText(tokens.slice(index, end + 1));
    if (text !== "") {
      bodies.push(escapeHtml(text));
    }
    index = end;
  }
  return { bodies, html: md.renderer.render(tokens, md.options, env) };
}

/** 部品の HTML のうち、`fills` の中身（文書から描いた HTML）を除いた部分にだけ mdmark が出した要素の印を付ける。`fills` は `FOOTNOTE_BODY_OPEN` の直後に順に並ぶ */
function markOwnAroundBodies(
  html: string,
  fills: string[],
  nonce: string,
): string {
  let cursor = 0;
  let out = "";
  for (const fill of fills) {
    const at = html.indexOf(FOOTNOTE_BODY_OPEN, cursor) + FOOTNOTE_BODY_OPEN.length;
    out += markOwn(html.slice(cursor, at), nonce) + fill;
    cursor = at + fill.length;
  }
  return out + markOwn(html.slice(cursor), nonce);
}

/** 本文の参照のトークンを、番号とツールチップの HTML にする */
function renderReference(md: MarkdownIt, token: Token, env: RenderEnv): string {
  const { id, refIndex } = token.meta as ReferenceMeta;
  const note = env.mdmarkFootnotes?.notes[id];
  if (note === undefined) {
    throw new Error(`脚注の番号が無い: ${id}`);
  }
  const { bodies } = footnoteBodies({ md, env, note });
  const html = renderFootnoteRef({ number: id + 1, refIndex, bodies });
  return markOwnAroundBodies(html, bodies, env.nonce);
}

/** 脚注が 1 つ以上あれば、文書の末尾に閉じた脚注の一覧を足す */
export function buildFootnoteList(state: StateCore): void {
  const env = envOf(state);
  const notes = env.mdmarkFootnotes?.notes ?? [];
  if (notes.length === 0) {
    return;
  }
  const fills: string[] = [];
  const items = notes.map((note, index) => {
    const { html } = footnoteBodies({ md: state.md, env, note });
    // 戻るリンクを最後の段落の閉じの前に置かせるため、中身を閉じの前後の差し込み口に分ける
    const at = html.lastIndexOf("</p>");
    if (at < 0) {
      fills.push(html);
      return { number: index + 1, html: SLOT_MARKER, refCount: note.refCount };
    }
    fills.push(html.slice(0, at), html.slice(at + "</p>".length));
    return {
      number: index + 1,
      html: `${SLOT_MARKER}</p>${SLOT_MARKER}`,
      refCount: note.refCount,
    };
  });
  const token = ownBlock(state, renderFootnotes({ items }));
  const parts = splitSlots(token.content);
  token.content = parts
    .map((part, index) => `${part}${fills[index] ?? ""}`)
    .join("");
  state.tokens.push(token);
}

/** 解析器に、脚注の定義・参照・行内の脚注のルールと、参照の描き方を登録する */
export function useFootnotes(parser: MarkdownIt): void {
  parser.block.ruler.before("reference", "mdmark_footnote_def", readFootnoteDefinition, {
    alt: ["paragraph", "reference"],
  });
  parser.inline.ruler.after("image", "mdmark_footnote_inline", readInlineFootnote);
  parser.inline.ruler.after(
    "mdmark_footnote_inline",
    "mdmark_footnote_ref",
    readFootnoteReference,
  );
  parser.renderer.rules[REF] = (tokens, index, _options, env) => {
    const token = tokens[index];
    if (token === undefined) {
      throw new Error("脚注の参照のトークンが無い");
    }
    return renderReference(parser, token, env as RenderEnv);
  };
}
