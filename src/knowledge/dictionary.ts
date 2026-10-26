import type { Token } from "markdown-it";
import type { MdmarkIndex, MdmarkIndexDoc } from "./index-shape.ts";
import type { MdmarkGlossaryEntry, MdmarkReferences } from "./references.ts";

/** 語の区切り（`Intl.Segmenter` の `ja`・`word`）。初めて使うときに作り、以降は使い回す */
let segmenter: Intl.Segmenter | undefined;

/** `Intl.Segmenter` を持たない環境で、英数字（全角を含む）の連なりを 1 語、それ以外を 1 文字（コードポイント）に区切る */
const FALLBACK_WORD = /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]+|[\s\S]/gu;

/** 照合・点検・検索の前に、語に NFKC・英字の小文字化・前後の空白の除去をかける */
export function normalizeWord(word: string): string {
  return word.normalize("NFKC").toLowerCase().trim();
}

/** 照合の辞書: 索引の用語・用語集の表の用語・文書の別名を、照合する語から引ける形にまとめたもの */
export type Dictionary = {
  /** 照合する語。`normalizeWord` で正規化した語を、長い語から並べる */
  words: string[];
  /** 正規化した語から、優先の順（索引の `terms` → 描く文書の表 → ほかの文書の表）で選んだ用語 */
  terms: Map<string, { id: string; meaning: string }>;
  /** 正規化した語から、その語を `aliases` に持つ文書（索引の `docs` の順） */
  docs: Map<string, MdmarkIndexDoc[]>;
  /** 正規化したやめた言い方から代わりの用語（`glossary` がオンのとき、索引の `terms[].avoid` と用語集の表の用語の `avoid` から。同じ言い方は索引の `terms`、索引の `docs` の順の文書の表の順で先の用語）。用語の語・別名と同じ語は入れない。`words` には入れず、照合でやめた言い方を使う側だけが `words` に足す */
  avoided: Map<string, { id: string; term: string; meaning: string }>;
  /** 正規化した語から、索引・用語集の表・文書の `aliases` に記載した表記。`words` と `avoided` の語を持ち、同じ正規化の語は `terms`・`avoided` と同じ優先の順で先の表記 */
  written: Map<string, string>;
  /** 語を `normalizeWord` で正規化してから `terms` を引く。`findWords` を通らずに書いた語で用語を引く箇所が使う */
  term: (word: string) => { id: string; meaning: string } | undefined;
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
  const written = new Map<string, string>();
  /** 先に入れた用語を優先して、正規化した語に用語と記載した表記を入れる */
  const addTerm = (words: string[], id: string, meaning: string): void => {
    for (const word of words) {
      const key = normalizeWord(word);
      if (key !== "" && !terms.has(key)) {
        terms.set(key, { id, meaning });
        written.set(key, word);
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
        const key = normalizeWord(word);
        if (key !== "" && !terms.has(key) && !avoided.has(key)) {
          avoided.set(key, value);
          written.set(key, word);
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
        const key = normalizeWord(alias);
        if (key === "") {
          continue;
        }
        docs.set(key, [...(docs.get(key) ?? []), doc]);
        if (!written.has(key)) {
          written.set(key, alias);
        }
      }
    }
  }
  const words = [...new Set([...terms.keys(), ...docs.keys()])].sort(
    (a, b) => b.length - a.length,
  );
  return {
    words,
    terms,
    docs,
    avoided,
    written,
    term: (word) => terms.get(normalizeWord(word)),
  };
}

/** 文字列を語に区切り、各語の始まりの位置（UTF-16 の位置）を頭から順に返す。区切り方は実行環境の辞書に依る */
export function wordStarts(text: string): number[] {
  if (typeof Intl.Segmenter !== "undefined") {
    segmenter ??= new Intl.Segmenter("ja", { granularity: "word" });
    return [...segmenter.segment(text)].map((segment) => segment.index);
  }
  return [...text.matchAll(FALLBACK_WORD)].map((match) => match.index);
}

/** 文字列の中で、元の文字列を語の区切りごとに NFKC と英字の小文字化をかけてつなぎ、始まりと終わりが区切りに揃う辞書の語（`normalizeWord` で正規化した語）の位置を、元の文字列の位置で、重ならないよう長い語を先に、頭から順に返す。`word` は `words` に渡したままの語で、正規化した後に同じになる語は `words` で先の語 */
export function findWords(
  text: string,
  words: string[],
): Array<{ start: number; end: number; word: string }> {
  // 正規化した語から、渡したままの語を引く（同じ語は先の語）
  const passed = new Map<string, string>();
  for (const word of words) {
    const key = normalizeWord(word);
    if (key !== "" && !passed.has(key)) {
      passed.set(key, word);
    }
  }
  const longestFirst = [...passed.keys()].sort((a, b) => b.length - a.length);
  const starts = wordStarts(text);
  // 区切りごとに正規化するため、NFKC で長さが変わる文字があっても、正規化した文字の境目は元の区切りに揃う
  const folded = starts.map((start, position) =>
    text
      .slice(start, starts[position + 1] ?? text.length)
      .normalize("NFKC")
      .toLowerCase(),
  );
  const normalized = folded.join("");
  // 区切りの境目の、正規化した文字列の中の位置から元の文字列の位置を引く
  const originals = new Map<number, number>([[normalized.length, text.length]]);
  const heads: number[] = [];
  let head = 0;
  starts.forEach((start, position) => {
    heads.push(head);
    originals.set(head, start);
    head += (folded[position] as string).length;
  });
  const found: Array<{ start: number; end: number; word: string }> = [];
  let skipTo = 0;
  starts.forEach((start, position) => {
    if (start < skipTo) {
      return;
    }
    const from = heads[position] as number;
    const key = longestFirst.find(
      (candidate) =>
        normalized.startsWith(candidate, from) &&
        originals.has(from + candidate.length),
    );
    if (key !== undefined) {
      const end = originals.get(from + key.length) as number;
      found.push({ start, end, word: passed.get(key) as string });
      skipTo = end;
    }
  });
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
