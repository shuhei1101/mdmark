import type { Token } from "markdown-it";
import type { MdmarkIndex, MdmarkIndexDoc } from "./index-shape.ts";
import type { MdmarkGlossaryEntry, MdmarkReferences } from "./references.ts";

/** 語の区切り（`Intl.Segmenter` の `ja`・`word`）。初めて使うときに作り、以降は使い回す */
let segmenter: Intl.Segmenter | undefined;

/** `Intl.Segmenter` を持たない環境で、英数字の連なりを 1 語、それ以外を 1 文字（コードポイント）に区切る */
const FALLBACK_WORD = /[A-Za-z0-9]+|[\s\S]/gu;

/** 照合の辞書: 索引の用語・用語集の表の用語・文書の別名を、照合する語から引ける形にまとめたもの */
export type Dictionary = {
  /** 照合する語。長い語から並べる */
  words: string[];
  /** 語から、優先の順（索引の `terms` → 描く文書の表 → ほかの文書の表）で選んだ用語 */
  terms: Map<string, { id: string; meaning: string }>;
  /** 語から、その語を `aliases` に持つ文書（索引の `docs` の順） */
  docs: Map<string, MdmarkIndexDoc[]>;
  /** やめた言い方から代わりの用語（`glossary` がオンのとき、索引の `terms[].avoid` と用語集の表の用語の `avoid` から。同じ言い方は索引の `terms`、索引の `docs` の順の文書の表の順で先の用語）。用語の語・別名と同じ語は入れない。`words` には入れず、照合でやめた言い方を使う側だけが `words` に足す */
  avoided: Map<string, { id: string; term: string; meaning: string }>;
};

/** 索引の用語・描く文書の表の用語・参照の表の用語・文書の別名から辞書を作る */
export function buildDictionary(options: {
  /** 索引 */
  index?: MdmarkIndex | undefined;
  /** 描く文書の索引の `id` */
  docId?: string | undefined;
  /** 描く文書の用語集の表から読んだ用語 */
  ownGlossary: MdmarkGlossaryEntry[];
  /** 参照の表 */
  references?: MdmarkReferences | undefined;
  /** 文書で決まった機能のオン・オフ */
  features: Record<string, boolean>;
}): Dictionary {
  const { index, docId, ownGlossary, references, features } = options;
  const terms = new Map<string, { id: string; meaning: string }>();
  const docs = new Map<string, MdmarkIndexDoc[]>();
  const avoided = new Map<
    string,
    { id: string; term: string; meaning: string }
  >();
  /** 先に入れた用語を優先して、語に用語を入れる */
  const addTerm = (words: string[], id: string, meaning: string): void => {
    for (const word of words) {
      if (!terms.has(word)) {
        terms.set(word, { id, meaning });
      }
    }
  };
  if (features.glossary !== false) {
    for (const term of index?.terms ?? []) {
      addTerm([term.term, ...(term.aliases ?? [])], term.id, term.meaning);
    }
    for (const entry of ownGlossary) {
      addTerm(
        [entry.term, ...entry.aliases],
        `glossary:${entry.docId}:${entry.term}`,
        entry.meaning,
      );
    }
    // ほかの文書の表は、索引の `docs` で先に並ぶ文書の用語を先にする
    const order = (id: string): number => {
      const position = index?.docs.findIndex((doc) => doc.id === id) ?? -1;
      return position === -1 ? Number.MAX_SAFE_INTEGER : position;
    };
    const others = (references?.glossary ?? [])
      .filter((entry) => docId === undefined || entry.docId !== docId)
      .sort((a, b) => order(a.docId) - order(b.docId));
    for (const entry of others) {
      addTerm(
        [entry.term, ...entry.aliases],
        `glossary:${entry.docId}:${entry.term}`,
        entry.meaning,
      );
    }
    // 用語の語・別名と同じ語は用語にし、同じやめた言い方は先の用語を代わりにする（索引の `terms`、索引の `docs` の順の文書の表の順。描く文書が索引の `docs` に無いときは描く文書の表を先にする）
    const addAvoided = (
      words: string[],
      value: { id: string; term: string; meaning: string },
    ): void => {
      for (const word of words) {
        if (!terms.has(word) && !avoided.has(word)) {
          avoided.set(word, value);
        }
      }
    };
    for (const term of index?.terms ?? []) {
      addAvoided(term.avoid ?? [], {
        id: term.id,
        term: term.term,
        meaning: term.meaning,
      });
    }
    const ownPosition =
      docId !== undefined && order(docId) !== Number.MAX_SAFE_INTEGER
        ? order(docId)
        : -1;
    const tableEntries = [
      ...ownGlossary.map((entry) => ({ entry, position: ownPosition })),
      ...others.map((entry) => ({ entry, position: order(entry.docId) })),
    ].sort((a, b) => a.position - b.position);
    for (const { entry } of tableEntries) {
      addAvoided(entry.avoid ?? [], {
        id: `glossary:${entry.docId}:${entry.term}`,
        term: entry.term,
        meaning: entry.meaning,
      });
    }
  }
  if (features.backlinks !== false) {
    for (const doc of index?.docs ?? []) {
      if (doc.id === docId) {
        continue;
      }
      for (const alias of doc.aliases ?? []) {
        docs.set(alias, [...(docs.get(alias) ?? []), doc]);
      }
    }
  }
  const words = [...new Set([...terms.keys(), ...docs.keys()])].sort(
    (a, b) => b.length - a.length,
  );
  return { words, terms, docs, avoided };
}

/** 文字列を語に区切り、各語の始まりの位置（UTF-16 の位置）を頭から順に返す。区切り方は実行環境の辞書に依る */
export function wordStarts(text: string): number[] {
  if (typeof Intl.Segmenter !== "undefined") {
    segmenter ??= new Intl.Segmenter("ja", { granularity: "word" });
    return [...segmenter.segment(text)].map((segment) => segment.index);
  }
  return [...text.matchAll(FALLBACK_WORD)].map((match) => match.index);
}

/** 文字列の中で、始まりと終わりが語の区切りに揃う辞書の語の位置を、重ならないよう長い語を先に、頭から順に返す */
export function findWords(
  text: string,
  words: string[],
): Array<{ start: number; end: number; word: string }> {
  const longestFirst = [...words].sort((a, b) => b.length - a.length);
  const starts = wordStarts(text);
  const boundaries = new Set([...starts, text.length]);
  const found: Array<{ start: number; end: number; word: string }> = [];
  let skipTo = 0;
  for (const start of starts) {
    if (start < skipTo) {
      continue;
    }
    const word = longestFirst.find(
      (candidate) =>
        text.startsWith(candidate, start) &&
        boundaries.has(start + candidate.length),
    );
    if (word !== undefined) {
      found.push({ start, end: start + word.length, word });
      skipTo = start + word.length;
    }
  }
  return found;
}

/** 見出しを除く行内のトークンを、文書の頭から順に渡す。`section` は見出し（h2〜h4）ごとに進む節の番号 */
export function forEachInline(
  tokens: Token[],
  callback: (inline: Token, section: number) => void,
): void {
  let section = 0;
  let inHeading = false;
  for (const token of tokens) {
    if (token.type === "heading_open") {
      inHeading = true;
      if (/^h[234]$/.test(token.tag)) {
        section += 1;
      }
    } else if (token.type === "heading_close") {
      inHeading = false;
    } else if (token.type === "inline" && !inHeading) {
      callback(token, section);
    }
  }
}

/** 行内のトークンの子のうち、照合してよい文字の位置を返す（リンクの中・コード・用語集の表の中は除く） */
export function matchableChildren(inline: Token): number[] {
  const positions: number[] = [];
  let linkDepth = 0;
  (inline.children ?? []).forEach((child, position) => {
    if (child.type === "link_open") {
      linkDepth += 1;
    } else if (child.type === "link_close") {
      linkDepth -= 1;
    } else if (
      child.type === "text" &&
      linkDepth === 0 &&
      child.meta?.mdmarkNoTerms !== true
    ) {
      positions.push(position);
    }
  });
  return positions;
}
