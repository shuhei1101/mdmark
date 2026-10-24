import type { StateCore, Token } from "markdown-it";
import {
  buildDictionary,
  type Dictionary,
  findWords,
  forEachInline,
  matchableChildren,
} from "../../knowledge/dictionary.ts";
import { relativeHref } from "../../knowledge/paths.ts";
import { markOwn } from "../../parts/own.ts";
import { renderTermTip } from "../../parts/term-tip.ts";
import { envOf } from "./tokens.ts";

/** 用語のツールチップの `id` の頭 */
const TIP_ID_PREFIX = "mdmark-term-";

/** 本文の文字を辞書の語で区切った 1 つ分: 文字のままの部分と、語に下線を引いてツールチップを置いた HTML */
export type TermSegment =
  | { kind: "text"; content: string }
  | { kind: "tip"; html: string };

/** 用語・文書の別名に下線を、やめた言い方にマーカーを付けた場所（付けたら、同じ範囲の同じ語には付けない）。やめた言い方は用語の下線とは別に、言い方ごとに数える */
export type SeenTerms = {
  terms: Set<string>;
  docs: Set<string>;
  avoided: Set<string>;
};

/** 用語・文書の別名の語の後ろに、やめた言い方の語を足した並びを返す。同じ長さなら先の語が当たる */
function matchWords(dictionary: Dictionary): string[] {
  return dictionary.avoided.size === 0
    ? dictionary.words
    : [...new Set([...dictionary.words, ...dictionary.avoided.keys()])];
}

/** 文字を辞書の語で区切る。同じ用語・文書は `seen` にあれば付けず、付けたら `seen` に足す。ツールチップの `id` は `nextTipId` が決める。語が 1 つも当たらなければ文字 1 つだけを返す */
export function termSegments(options: {
  /** 照合する文字 */
  text: string;
  /** 辞書 */
  dictionary: Dictionary;
  /** 描く文書の索引のパス（関連文書のリンクの基準） */
  ownPath: string | undefined;
  /** すでに下線を付けた用語・文書 */
  seen: SeenTerms;
  /** 次のツールチップの `id` */
  nextTipId: () => string;
  /** mdmark が出した要素の印の値 */
  nonce: string;
}): TermSegment[] {
  const { text, dictionary, ownPath, seen, nextTipId, nonce } = options;
  const segments: TermSegment[] = [];
  let cursor = 0;
  for (const found of findWords(text, matchWords(dictionary))) {
    const term = dictionary.terms.get(found.word);
    // 用語 → やめた言い方 → 文書の別名の順に引く。文書の別名と同じやめた言い方は、関連文書を出さずにやめた言い方にする
    const replacement =
      term === undefined ? dictionary.avoided.get(found.word) : undefined;
    let html: string;
    if (replacement !== undefined) {
      if (seen.avoided.has(found.word)) {
        continue;
      }
      seen.avoided.add(found.word);
      html = renderTermTip({
        text: text.slice(found.start, found.end),
        id: nextTipId(),
        replacement,
      });
    } else {
      const activeTerm =
        term !== undefined && !seen.terms.has(term.id) ? term : undefined;
      const docs = (dictionary.docs.get(found.word) ?? []).filter(
        (doc) => !seen.docs.has(doc.id),
      );
      if (activeTerm === undefined && docs.length === 0) {
        continue;
      }
      if (activeTerm) {
        seen.terms.add(activeTerm.id);
      }
      for (const doc of docs) {
        seen.docs.add(doc.id);
      }
      html = renderTermTip({
        text: text.slice(found.start, found.end),
        id: nextTipId(),
        meaning: activeTerm?.meaning ?? "",
        docs: docs.map((doc) => ({
          title: doc.title,
          href: relativeHref(ownPath, doc.path),
          ...(doc.description === undefined
            ? {}
            : { description: doc.description }),
        })),
      });
    }
    if (found.start > cursor) {
      segments.push({ kind: "text", content: text.slice(cursor, found.start) });
    }
    segments.push({ kind: "tip", html: markOwn(html, nonce) });
    cursor = found.end;
  }
  if (cursor < text.length || segments.length === 0) {
    segments.push({ kind: "text", content: text.slice(cursor) });
  }
  return segments;
}

/** `glossary` か `backlinks` がオンなら、本文の文字を辞書の語と照合し、当たった語を語とツールチップの組に置き換える */
export function termsRule(state: StateCore): void {
  const env = envOf(state);
  if (env.features.glossary !== true && env.features.backlinks !== true) {
    return;
  }
  const dictionary = buildDictionary({
    index: env.index,
    docId: env.docId,
    ownGlossary: env.ownGlossary,
    references: env.mdmarkReferences,
    features: env.features,
  });
  if (dictionary.words.length === 0) {
    return;
  }
  const ownPath = env.index?.docs.find((doc) => doc.id === env.docId)?.path;
  // 同じ用語・文書は、節ごとに最初に出たところだけに下線を付ける
  let seenSection = -1;
  let seen: SeenTerms = {
    terms: new Set(),
    docs: new Set(),
    avoided: new Set(),
  };
  // 埋め込んだ HTML が先に使った番号の続きから振る
  let tipNumber = env.termTipCount ?? 0;
  const nextTipId = (): string => {
    tipNumber += 1;
    env.termTipCount = tipNumber;
    return `${TIP_ID_PREFIX}${tipNumber}`;
  };

  forEachInline(state.tokens, (inline, section) => {
    if (section !== seenSection) {
      seenSection = section;
      seen = { terms: new Set(), docs: new Set(), avoided: new Set() };
    }
    const children = inline.children ?? [];
    const matchable = new Set(matchableChildren(inline));
    const rebuilt: Token[] = [];
    children.forEach((child, position) => {
      if (!matchable.has(position)) {
        rebuilt.push(child);
        return;
      }
      const segments = termSegments({
        text: child.content,
        dictionary,
        ownPath,
        seen,
        nextTipId,
        nonce: env.nonce,
      });
      if (segments.every((segment) => segment.kind === "text")) {
        rebuilt.push(child);
        return;
      }
      for (const segment of segments) {
        if (segment.kind === "text") {
          rebuilt.push(textToken(state, segment.content));
        } else {
          const tip = new state.Token("html_inline", "", 0);
          tip.content = segment.html;
          rebuilt.push(tip);
        }
      }
    });
    inline.children = rebuilt;
  });
}

/** 文字だけのトークンを作る */
function textToken(state: StateCore, content: string): Token {
  const token = new state.Token("text", "", 0);
  token.content = content;
  return token;
}
