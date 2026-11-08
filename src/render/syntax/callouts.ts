import type { StateCore, Token } from "markdown-it";
import {
  CALLOUT_KINDS,
  type CalloutKind,
  renderCallout,
} from "../../parts/callout.ts";
import { SLOT_MARKER } from "../../parts/own.ts";
import { featureOn, findNestedClose, ownBlock } from "./tokens.ts";

/** 引用の 1 行目の頭に記載する `[!種類]`（末尾に `-`・`+` を許し、後ろに空白とタイトルを続けられる） */
const CALLOUT_PATTERN = /^\[!([A-Za-z]+)\]([-+]?)(?:\s+|$)/;

/** 引用の最初の段落の 1 行目（最初の `softbreak` の手前まで）から、注意書きの種類・開閉・タイトルの HTML を読み込む。注意書きでなければ `undefined` */
export function readCallout(options: {
  state: StateCore;
  tokens: Token[];
  openIndex: number;
}):
  | { kind: CalloutKind; collapsed: boolean; open: boolean; title?: string }
  | undefined {
  const { state, tokens, openIndex } = options;
  const paragraph = tokens[openIndex + 1];
  const inline = tokens[openIndex + 2];
  if (paragraph?.type !== "paragraph_open" || inline?.type !== "inline") {
    return undefined;
  }
  const children = inline.children ?? [];
  const lineEnd = children.findIndex((child) => child.type === "softbreak");
  const line = children.slice(0, lineEnd < 0 ? children.length : lineEnd);
  const [first, ...others] = line;
  const match =
    first?.type === "text" ? CALLOUT_PATTERN.exec(first.content) : null;
  if (!first || !match) {
    return undefined;
  }
  const name = (match[1] ?? "").toLowerCase();
  const kind = CALLOUT_KINDS.find((candidate) => candidate === name) ?? "note";
  const sign = match[2] ?? "";
  // 種類の後ろの文字と、1 行目の残りの行内のトークンをタイトルにする
  const rest = new state.Token("text", "", 0);
  rest.content = first.content.slice(match[0].length);
  const title = state.md.renderer
    .renderInline([rest, ...others], state.md.options, state.env)
    .trim();
  return {
    kind,
    collapsed: sign !== "",
    open: sign === "+",
    ...(title ? { title } : {}),
  };
}

/** 種類とタイトルの 1 行を、引用の最初の段落から除外する。段落が空になれば段落ごと削除する */
function removeTitleLine(tokens: Token[], openIndex: number): Token[] {
  const inline = tokens[openIndex + 2] as Token;
  const children = inline.children ?? [];
  const lineEnd = children.findIndex((child) => child.type === "softbreak");
  // 1 行目と、その後の改行を削除する
  inline.children = lineEnd < 0 ? [] : children.slice(lineEnd + 1);
  inline.content = inline.content.replace(/^[^\n]*\n?/, "");
  if (inline.children.length > 0) {
    return [];
  }
  return tokens.slice(openIndex + 1, openIndex + 4);
}

/** `callout` がオンなら、1 行目が `[!種類]` の引用を注意書きの部品にし、1 行目を本文から除外する。知らない種類は `note`。注意書きの本文の中の引用も注意書きにする */
export function buildCallouts(state: StateCore): void {
  if (!featureOn(state, "callout")) {
    return;
  }
  state.tokens = buildCalloutsIn(state, state.tokens);
}

/** トークンの並びの中の注意書きの引用を部品にした並びを返却する */
function buildCalloutsIn(state: StateCore, tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const callout =
      token?.type === "blockquote_open"
        ? readCallout({ state, tokens, openIndex: index })
        : undefined;
    const closeIndex = callout ? findNestedClose(tokens, index) : -1;
    if (!token || !callout || closeIndex < 0) {
      if (token) {
        out.push(token);
      }
      continue;
    }
    const emptied = removeTitleLine(tokens, index);
    const html = renderCallout({ ...callout, body: SLOT_MARKER });
    const [head = "", tail = ""] = html.split(SLOT_MARKER);
    out.push(ownBlock(state, head, token));
    const body = tokens
      .slice(index + 1, closeIndex)
      .filter((inner) => !emptied.includes(inner));
    out.push(...buildCalloutsIn(state, body));
    out.push(ownBlock(state, tail));
    index = closeIndex;
  }
  return out;
}
