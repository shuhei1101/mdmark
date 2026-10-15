import type { StateCore, Token } from "markdown-it";
import {
  CALLOUT_KINDS,
  type CalloutKind,
  renderCallout,
} from "../../parts/callout.ts";
import { SLOT_MARKER } from "../../parts/own.ts";
import { featureOn, findNestedClose, ownBlock } from "./tokens.ts";

/** 引用の 1 行目に書く `[!種類]`（末尾に `-` を許す） */
const CALLOUT_PATTERN = /^\[!([A-Za-z]+)\](-?)$/;

/** 引用の最初の段落の 1 行目から、注意書きの種類を読む。注意書きでなければ `undefined` */
function readCallout(
  tokens: Token[],
  openIndex: number,
): { kind: CalloutKind; collapsed: boolean } | undefined {
  const paragraph = tokens[openIndex + 1];
  const inline = tokens[openIndex + 2];
  const first = inline?.children?.[0];
  if (paragraph?.type !== "paragraph_open" || inline?.type !== "inline") {
    return undefined;
  }
  const second = inline.children?.[1];
  const match =
    first?.type === "text" ? CALLOUT_PATTERN.exec(first.content) : null;
  if (!match || (second && second.type !== "softbreak")) {
    return undefined;
  }
  const name = (match[1] ?? "").toLowerCase();
  const kind = CALLOUT_KINDS.find((candidate) => candidate === name) ?? "note";
  return { kind, collapsed: match[2] === "-" };
}

/** 種類の文字の 1 行を、引用の最初の段落から外す。段落が空になれば段落ごと外す */
function removeTitleLine(tokens: Token[], openIndex: number): Token[] {
  const inline = tokens[openIndex + 2] as Token;
  // 種類の文字と、その後の改行を外す
  inline.children = (inline.children ?? []).slice(2);
  inline.content = inline.content.replace(/^[^\n]*\n?/, "");
  if (inline.children.length > 0) {
    return [];
  }
  return tokens.slice(openIndex + 1, openIndex + 4);
}

/** `callout` がオンなら、1 行目が `[!種類]` の引用を注意書きの部品にし、種類の文字を本文から外す。知らない種類は `note` */
export function buildCallouts(state: StateCore): void {
  if (!featureOn(state, "callout")) {
    return;
  }
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const callout =
      token?.type === "blockquote_open"
        ? readCallout(tokens, index)
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
    out.push(ownBlock(state, head));
    for (let position = index + 1; position < closeIndex; position++) {
      const inner = tokens[position] as Token;
      if (!emptied.includes(inner)) {
        out.push(inner);
      }
    }
    out.push(ownBlock(state, tail));
    index = closeIndex;
  }
  state.tokens = out;
}
