import type {
  MarkdownIt,
  StateBlock,
  StateCore,
  StateInline,
  Token,
} from "markdown-it";
import {
  FOOTNOTE_BODY_OPEN,
  type FootnoteBackRef,
  type FootnoteKind,
  renderFootnoteRef,
  renderFootnotes,
} from "../../parts/footnote.ts";
import { markOwn, SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import type { RenderEnv } from "../parser.ts";
import { envOf, featureOn } from "./tokens.ts";

/** 脚注の定義の囲みの開きと閉じ、本文の参照のトークンの種類 */
export const DEF_OPEN = "mdmark_footnote_def_open";
export const DEF_CLOSE = "mdmark_footnote_def_close";

/** 注記の定義の囲みの開きと閉じのトークンの種類（本文の外に置く定義として、脚注の定義と同じく扱う） */
export const ANNOTATION_DEF_OPEN = "mdmark_annotation_def_open";
export const ANNOTATION_DEF_CLOSE = "mdmark_annotation_def_close";

/** 定義の囲みの開きの種類から、閉じの種類 */
const DEFINITION_CLOSES: Record<string, string> = {
  [DEF_OPEN]: DEF_CLOSE,
  [ANNOTATION_DEF_OPEN]: ANNOTATION_DEF_CLOSE,
};
const REF = "mdmark_footnote_ref";

/** 文書の末尾の脚注の一覧のトークンの種類 */
const LIST = "mdmark_footnote_list";

/** 行内の脚注の定義のキーの頭（ラベルの正規化の結果に現れない制御文字で始める） */
const INLINE_KEY_PREFIX = "\u0000inline:";

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

/** 参照した順の脚注 1 つ。行内の脚注は `collectFootnotes` が定義の囲みにするまで `key` が `null` で、`inline` に中身のトークンを持つ */
export type FootnoteNote = {
  key: string | null;
  inline: Token[] | null;
  refCount: number;
};

/** 1 回の解析で読み込んだ脚注の定義と参照 */
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

/** 解析の環境の脚注の状態を返却する。無ければ作る */
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

/** `pos` の `[^` から始まるラベルの閉じの `]` の位置を返却する。空・空白を含む・閉じが無いときは `-1` */
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

/** 行頭の `[^ラベル]:` を脚注の定義として読み込み、字下げ 4 で続く行までを中身として囲む */
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

/** 本文の参照のトークンを追加し、脚注の参照の数を増やす */
function pushReference(state: StateInline, id: number, source: string): void {
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

/** `[^ラベル]` を、定義のあるラベルのときだけ本文の参照として読み込む */
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

/** `^[中身]` を行内の脚注として読み込み、中身を行内の Markdown として解析する */
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

/** `openIndex` の定義の囲み（脚注か注記）の開きに対する閉じの位置を返却する */
export function findDefinitionClose(
  tokens: Token[],
  openIndex: number,
): number {
  const open = tokens[openIndex]?.type ?? "";
  const close = DEFINITION_CLOSES[open];
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index++) {
    const type = tokens[index]?.type;
    if (type === open) {
      depth += 1;
    } else if (type === close) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new Error("脚注の定義の閉じが無い");
}

/** 機能がオフのとき、定義の中身の最初の段落の頭に定義の頭の文字（`[^ラベル]: ` など）を戻す（段落が無ければ文字だけの段落を作る） */
export function restoreDefinition(
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

/** 機能がオフのとき、本文の参照を記載した文字に戻す */
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

/** 脚注の機能がオンなら行内の脚注の中身を定義の囲みにして文書の末尾に追加し（後のコアルールを本文と同じく経由するため）、オフなら参照と定義を記載した文字のまま記載した位置に戻す */
export function collectFootnotes(state: StateCore): void {
  const env = envOf(state);
  const footnotes = env.mdmarkFootnotes;
  if (footnotes === undefined) {
    return;
  }
  if (featureOn(state, "footnotes")) {
    footnotes.notes.forEach((note, id) => {
      if (note.inline !== null) {
        state.tokens.push(...inlineDefinition(state, note, id));
      }
    });
    return;
  }
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
    const meta = token.meta as DefinitionMeta;
    out.push(
      ...restoreDefinition(
        state,
        meta.source,
        state.tokens.slice(index + 1, close),
      ),
    );
    index = close;
  }
  state.tokens = out;
  restoreReferences(state, out);
  delete env.mdmarkFootnotes;
}

/** 行内の脚注の中身を 1 段落の定義の囲みにし、脚注に定義のキーを適用する */
function inlineDefinition(
  state: StateCore,
  note: FootnoteNote,
  id: number,
): Token[] {
  const key = `${INLINE_KEY_PREFIX}${id}`;
  envOf(state).mdmarkFootnotes?.definitions.set(key, null);
  const open = new state.Token(DEF_OPEN, "", 1);
  open.meta = { key, first: true, source: "" } satisfies DefinitionMeta;
  const paragraphOpen = new state.Token("paragraph_open", "p", 1);
  paragraphOpen.block = true;
  const inline = new state.Token("inline", "", 0);
  inline.children = note.inline;
  inline.content = (note.inline ?? []).map((child) => child.content).join("");
  const paragraphClose = new state.Token("paragraph_close", "p", -1);
  paragraphClose.block = true;
  const close = new state.Token(DEF_CLOSE, "", -1);
  note.key = key;
  note.inline = null;
  return [open, paragraphOpen, inline, paragraphClose, close];
}

/** 脚注と注記の定義の囲みの外のトークンだけを返却する（用語の下線を脚注と注記の中身に付けないため） */
export function outsideFootnoteDefinitions(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token !== undefined && token.type in DEFINITION_CLOSES) {
      index = findDefinitionClose(tokens, index);
    } else if (token !== undefined) {
      out.push(token);
    }
  }
  return out;
}

/** 全てのコアルールを経由した定義の囲みを本文から取り除き、ラベルごとの最初の定義を記録する */
export function takeFootnoteDefinitions(state: StateCore): void {
  const footnotes = envOf(state).mdmarkFootnotes;
  if (footnotes === undefined) {
    return;
  }
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
    const meta = token.meta as DefinitionMeta;
    if (meta.first) {
      footnotes.definitions.set(meta.key, state.tokens.slice(index + 1, close));
    }
    index = close;
  }
  state.tokens = out;
}

/** 段落でないブロックを描いた HTML から要素を除き、ツールチップの 1 段落の文字にする（描いた文字はエスケープ済み） */
function blockText(md: MarkdownIt, env: RenderEnv, tokens: Token[]): string {
  return md.renderer
    .render(tokens, md.options, env)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 脚注 1 つの中身を、ツールチップの段落ごとの行内の HTML と、一覧のブロックの HTML にする */
export function footnoteBodies(options: {
  md: MarkdownIt;
  env: RenderEnv;
  note: FootnoteNote;
}): { bodies: string[]; html: string } {
  const { md, env, note } = options;
  const tokens =
    (note.key === null
      ? null
      : env.mdmarkFootnotes?.definitions.get(note.key)) ?? [];
  return definitionBodies({ md, env, tokens });
}

/** 定義の中身のトークンを、ツールチップの段落ごとの行内の HTML と、一覧のブロックの HTML にする */
export function definitionBodies(options: {
  md: MarkdownIt;
  env: RenderEnv;
  tokens: Token[];
}): { bodies: string[]; html: string } {
  const { md, env, tokens } = options;
  const bodies: string[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    // 段落は p を削除した行内の HTML、それ以外のブロックは閉じまでの文字を 1 段落にする
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
    const text = blockText(md, env, tokens.slice(index, end + 1));
    if (text !== "") {
      bodies.push(text);
    }
    index = end;
  }
  return { bodies, html: md.renderer.render(tokens, md.options, env) };
}

/** 部品の HTML のうち、`fills` の中身（文書から描いた HTML）を除いた部分にだけ mdmark が出した要素のマーカーを付ける。`fills` は `FOOTNOTE_BODY_OPEN` の直後に順に並ぶ */
export function markOwnAroundBodies(
  html: string,
  fills: string[],
  nonce: string,
): string {
  let cursor = 0;
  let out = "";
  for (const fill of fills) {
    const at =
      html.indexOf(FOOTNOTE_BODY_OPEN, cursor) + FOOTNOTE_BODY_OPEN.length;
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

/** 脚注の一覧の HTML にする */
function renderList(md: MarkdownIt, env: RenderEnv): string {
  return renderDefinitionList({
    md,
    env,
    kind: "footnote",
    items: (env.mdmarkFootnotes?.notes ?? []).map((note, index) => ({
      number: index + 1,
      tokens:
        (note.key === null
          ? null
          : env.mdmarkFootnotes?.definitions.get(note.key)) ?? [],
      refCount: note.refCount,
    })),
  });
}

/** 脚注か注記の一覧の HTML にする。戻るリンクを最後の段落の閉じの前に配置させるため、中身を閉じの前後の差し込みインターフェースに分けて部品に指定し、中身の外にだけマーカーを付ける */
export function renderDefinitionList(options: {
  md: MarkdownIt;
  env: RenderEnv;
  kind: FootnoteKind;
  items: Array<{
    number: number;
    tokens: Token[];
    refCount: number;
    refs?: FootnoteBackRef[];
  }>;
}): string {
  const { md, env, kind } = options;
  const fills: string[] = [];
  const items = options.items.map(({ number, tokens, refCount, refs }) => {
    const { html } = definitionBodies({ md, env, tokens });
    const at = html.lastIndexOf("</p>");
    const back = refs === undefined ? {} : { refs };
    if (at < 0) {
      fills.push(html);
      return { number, html: SLOT_MARKER, refCount, ...back };
    }
    fills.push(html.slice(0, at), html.slice(at + "</p>".length));
    return {
      number,
      html: `${SLOT_MARKER}</p>${SLOT_MARKER}`,
      refCount,
      ...back,
    };
  });
  return splitSlots(markOwn(renderFootnotes({ items, kind }), env.nonce))
    .map((part, index) => `${part}${fills[index] ?? ""}`)
    .join("");
}

/** 脚注が 1 つ以上あれば、文書の末尾に脚注の一覧のトークンを追加する（中身は全てのコアルールの後に描く） */
export function buildFootnoteList(state: StateCore): void {
  if ((envOf(state).mdmarkFootnotes?.notes.length ?? 0) === 0) {
    return;
  }
  const token = new state.Token(LIST, "", 0);
  token.block = true;
  state.tokens.push(token);
}

/** 解析器に、脚注の定義・参照・行内の脚注のルールと、参照の描き方を登録する */
export function useFootnotes(parser: MarkdownIt): void {
  parser.block.ruler.before(
    "reference",
    "mdmark_footnote_def",
    readFootnoteDefinition,
    {
      alt: ["paragraph", "reference"],
    },
  );
  parser.inline.ruler.after(
    "image",
    "mdmark_footnote_inline",
    readInlineFootnote,
  );
  parser.inline.ruler.after(
    "mdmark_footnote_inline",
    "mdmark_footnote_ref",
    readFootnoteReference,
  );
  parser.renderer.rules[LIST] = (_tokens, _index, _options, env) =>
    renderList(parser, env as RenderEnv);
  parser.renderer.rules[REF] = (tokens, index, _options, env) => {
    const token = tokens[index];
    if (token === undefined) {
      throw new Error("脚注の参照のトークンが無い");
    }
    return renderReference(parser, token, env as RenderEnv);
  };
}
