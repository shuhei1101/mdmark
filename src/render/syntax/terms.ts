import type { StateCore, Token } from "markdown-it";
import {
  buildDictionary,
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
  let seenTerms = new Set<string>();
  let seenDocs = new Set<string>();
  let tipNumber = 0;

  forEachInline(state.tokens, (inline, section) => {
    if (section !== seenSection) {
      seenSection = section;
      seenTerms = new Set();
      seenDocs = new Set();
    }
    const children = inline.children ?? [];
    const matchable = new Set(matchableChildren(inline));
    const rebuilt: Token[] = [];
    children.forEach((child, position) => {
      if (!matchable.has(position)) {
        rebuilt.push(child);
        return;
      }
      let cursor = 0;
      for (const found of findWords(child.content, dictionary.words)) {
        const term = dictionary.terms.get(found.word);
        const activeTerm =
          term !== undefined && !seenTerms.has(term.id) ? term : undefined;
        const docs = (dictionary.docs.get(found.word) ?? []).filter(
          (doc) => !seenDocs.has(doc.id),
        );
        if (activeTerm === undefined && docs.length === 0) {
          continue;
        }
        if (activeTerm) {
          seenTerms.add(activeTerm.id);
        }
        for (const doc of docs) {
          seenDocs.add(doc.id);
        }
        tipNumber += 1;
        if (found.start > cursor) {
          rebuilt.push(
            textToken(state, child.content.slice(cursor, found.start)),
          );
        }
        const tip = new state.Token("html_inline", "", 0);
        tip.content = markOwn(
          renderTermTip({
            text: found.word,
            id: `${TIP_ID_PREFIX}${tipNumber}`,
            meaning: activeTerm?.meaning ?? "",
            docs: docs.map((doc) => ({
              title: doc.title,
              href: relativeHref(ownPath, doc.path),
              ...(doc.description === undefined
                ? {}
                : { description: doc.description }),
            })),
          }),
          env.nonce,
        );
        rebuilt.push(tip);
        cursor = found.end;
      }
      if (cursor === 0) {
        rebuilt.push(child);
      } else if (cursor < child.content.length) {
        rebuilt.push(textToken(state, child.content.slice(cursor)));
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
