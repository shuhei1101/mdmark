import type { Token } from "markdown-it";
import { type MdmarkAlias, usableAliases } from "./aliases.ts";
import type { MdmarkIndex, MdmarkIndexDoc } from "./index-shape.ts";
import type { MdmarkGlossaryEntry, MdmarkReferences } from "./references.ts";

/** 単語の区切り（`Intl.Segmenter` の `ja`・`word`）。初めて使用するときに作り、以降は使い回す */
let segmenter: Intl.Segmenter | undefined;

/** `Intl.Segmenter` を持たない環境で、英数字（全角を含む）の連なりを 1 単語、それ以外を 1 文字（コードポイント）に区切る */
const FALLBACK_WORD = /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]+|[\s\S]/gu;

/** 照合・点検・検索の前に、単語に NFKC・英字の小文字化・前後の空白の除去をかける */
export function normalizeWord(word: string): string {
  return word.normalize("NFKC").toLowerCase().trim();
}

/** 照合の辞書: 索引の用語・用語集の表の用語・文書の別名を、照合する単語から参照できる構造にまとめたもの */
export type Dictionary = {
  /** 照合する単語。`normalizeWord` で正規化した単語を、長い単語から並べる */
  words: string[];
  /** 正規化した単語から、優先の順（索引の `terms` → エイリアス（指定した並び） → 描く文書の表 → ほかの文書の表）で選んだ用語。エイリアスは `id` を `alias:{エイリアスの id}`、`meaning` を `description`（無ければ空文字）にし、`alias` にそのエイリアスを持つ */
  terms: Map<string, { id: string; meaning: string; alias?: MdmarkAlias }>;
  /** 正規化した単語から、その単語を `aliases` に持つ文書（索引の `docs` の順） */
  docs: Map<string, MdmarkIndexDoc[]>;
  /** 正規化したやめた言い方から代わりの用語（`glossary` がオンのとき、索引の `terms[].avoid`、エイリアスの `avoid` の種類の `name`・`aliases` と `term` の種類の `avoid`、用語集の表の用語の `avoid` から。同じ言い方は索引の `terms`、エイリアスの並び、索引の `docs` の順の文書の表の順で先の用語）。`avoid` の種類は `term` を `replacement` にして `meaning` を持たず、`term` の種類は `term` を名前、`meaning` を `description` にする。エイリアスの代わりの用語は `id` を `alias:{エイリアスの id}` にし、`alias` にそのエイリアスを持つ。用語の単語・別名と同じ単語は入れない。`words` には入れず、照合でやめた言い方を利用側だけが `words` に追加する */
  avoided: Map<
    string,
    { id: string; term: string; meaning?: string; alias?: MdmarkAlias }
  >;
  /** 正規化した単語から、索引・用語集の表・文書の `aliases` に記載した表記。`words` と `avoided` の単語を持ち、同じ正規化の単語は `terms`・`avoided` と同じ優先の順で先の表記 */
  written: Map<string, string>;
  /** 単語を `normalizeWord` で正規化してから、エイリアスを除いた用語を参照する。`findWords` を通らずに記載した単語で用語を参照する箇所（図のノード・埋め込んだ HTML のチャートの `{{単語}}`）が使用する。エイリアスの単語は参照しない */
  term: (word: string) => { id: string; meaning: string } | undefined;
};

/** 辞書の用語の値 */
type TermValue = Dictionary["terms"] extends Map<string, infer V> ? V : never;

/** 辞書のやめた言い方の値 */
type AvoidedValue =
  Dictionary["avoided"] extends Map<string, infer V> ? V : never;

/** 作っている辞書の表 */
type DictionaryMaps = Pick<
  Dictionary,
  "terms" | "docs" | "avoided" | "written"
> & {
  /** エイリアスを除いた用語（`term` が参照する） */
  plainTerms: Map<string, { id: string; meaning: string }>;
};

/** 先に入れた用語を優先して、正規化した単語に用語と記載した表記を入れる */
function addTerm(
  maps: DictionaryMaps,
  words: string[],
  value: TermValue,
): void {
  const { id, meaning, alias } = value;
  for (const word of words) {
    const key = normalizeWord(word);
    if (key === "") {
      continue;
    }
    if (alias === undefined && !maps.plainTerms.has(key)) {
      maps.plainTerms.set(key, { id, meaning });
    }
    if (!maps.terms.has(key)) {
      maps.terms.set(key, value);
      maps.written.set(key, word);
    }
  }
}

/** 用語の単語・別名と同じ単語は入れず、同じやめた言い方は先の用語を代わりにする */
function addAvoided(
  maps: DictionaryMaps,
  words: string[],
  value: AvoidedValue,
): void {
  for (const word of words) {
    const key = normalizeWord(word);
    if (key !== "" && !maps.terms.has(key) && !maps.avoided.has(key)) {
      maps.avoided.set(key, value);
      maps.written.set(key, word);
    }
  }
}

/** 用語集の表の用語の `id` */
const glossaryId = (entry: MdmarkGlossaryEntry): string =>
  `glossary:${entry.docId}:${entry.term}`;

/** 索引の `docs` の文書の位置（無い文書は最後） */
function docOrder(index: MdmarkIndex | undefined): (id: string) => number {
  return (id) => {
    const position = index?.docs.findIndex((doc) => doc.id === id) ?? -1;
    return position === -1 ? Number.MAX_SAFE_INTEGER : position;
  };
}

/** 用語を、索引の `terms`・エイリアス（指定した並び）・描く文書の表・ほかの文書の表（索引の `docs` で先に並ぶ文書から）の順に入れる */
function addAllTerms(
  maps: DictionaryMaps,
  sources: {
    index: MdmarkIndex | undefined;
    usable: MdmarkAlias[];
    ownGlossary: MdmarkGlossaryEntry[];
    others: MdmarkGlossaryEntry[];
  },
): void {
  const { index, usable, ownGlossary, others } = sources;
  for (const term of index?.terms ?? []) {
    addTerm(maps, [term.term, ...(term.aliases ?? [])], {
      id: term.id,
      meaning: term.meaning,
    });
  }
  for (const alias of usable) {
    if (alias.alias_type !== "avoid") {
      addTerm(maps, [alias.name, ...alias.aliases], {
        id: `alias:${alias.id}`,
        meaning: alias.description ?? "",
        alias,
      });
    }
  }
  for (const entry of [...ownGlossary, ...others]) {
    addTerm(maps, [entry.term, ...entry.aliases], {
      id: glossaryId(entry),
      meaning: entry.meaning,
    });
  }
}

/** エイリアスのやめた言い方を入れる。`avoid` の種類は `name`・`aliases` を、`term` の種類は `avoid` を入れる */
function addAliasAvoided(maps: DictionaryMaps, usable: MdmarkAlias[]): void {
  for (const alias of usable) {
    if (alias.alias_type === "avoid") {
      addAvoided(maps, [alias.name, ...alias.aliases], {
        id: `alias:${alias.id}`,
        term: alias.replacement ?? "",
        alias,
      });
    } else if (alias.alias_type === "term") {
      addAvoided(maps, alias.avoid ?? [], {
        id: `alias:${alias.id}`,
        term: alias.name,
        meaning: alias.description ?? "",
        alias,
      });
    }
  }
}

/** やめた言い方を、索引の `terms`、エイリアスの並び、索引の `docs` の順の文書の表の順に入れる。描く文書が索引の `docs` に無いときは描く文書の表を先にする */
function addAllAvoided(
  maps: DictionaryMaps,
  sources: {
    index: MdmarkIndex | undefined;
    usable: MdmarkAlias[];
    tables: Array<{ entry: MdmarkGlossaryEntry; position: number }>;
  },
): void {
  const { index, usable, tables } = sources;
  for (const term of index?.terms ?? []) {
    addAvoided(maps, term.avoid ?? [], {
      id: term.id,
      term: term.term,
      meaning: term.meaning,
    });
  }
  addAliasAvoided(maps, usable);
  const sorted = [...tables].sort((a, b) => a.position - b.position);
  for (const { entry } of sorted) {
    addAvoided(maps, entry.avoid ?? [], {
      id: glossaryId(entry),
      term: entry.term,
      meaning: entry.meaning,
    });
  }
}

/** 描く文書を除く文書の別名を、その別名を持つ文書（索引の `docs` の順）に入れる */
function addDocAliases(
  maps: DictionaryMaps,
  index: MdmarkIndex | undefined,
  docId: string | undefined,
): void {
  for (const doc of index?.docs ?? []) {
    if (doc.id === docId) {
      continue;
    }
    for (const alias of doc.aliases ?? []) {
      const key = normalizeWord(alias);
      if (key === "") {
        continue;
      }
      maps.docs.set(key, [...(maps.docs.get(key) ?? []), doc]);
      if (!maps.written.has(key)) {
        maps.written.set(key, alias);
      }
    }
  }
}

/** 用語集の表の用語を辞書に入れる */
function addGlossary(
  maps: DictionaryMaps,
  sources: {
    index: MdmarkIndex | undefined;
    docId: string | undefined;
    ownGlossary: MdmarkGlossaryEntry[];
    references: MdmarkReferences | undefined;
    usable: MdmarkAlias[];
  },
): void {
  const { index, docId, ownGlossary, references, usable } = sources;
  const order = docOrder(index);
  // ほかの文書の表は、索引の `docs` で先に並ぶ文書の用語を先にする
  const others = (references?.glossary ?? [])
    .filter((entry) => docId === undefined || entry.docId !== docId)
    .sort((a, b) => order(a.docId) - order(b.docId));
  addAllTerms(maps, { index, usable, ownGlossary, others });
  const ownPosition =
    docId !== undefined && order(docId) !== Number.MAX_SAFE_INTEGER
      ? order(docId)
      : -1;
  addAllAvoided(maps, {
    index,
    usable,
    tables: [
      ...ownGlossary.map((entry) => ({ entry, position: ownPosition })),
      ...others.map((entry) => ({ entry, position: order(entry.docId) })),
    ],
  });
}

/** 索引の用語・描く文書の表の用語・参照の表の用語・文書の別名から辞書を作る */
export function buildDictionary(options: {
  /** 索引 */
  index?: MdmarkIndex | undefined;
  /** 描く文書の索引の `id` */
  docId?: string | undefined;
  /** 描く文書の用語集の表から読み込んだ用語 */
  ownGlossary: MdmarkGlossaryEntry[];
  /** 参照の表 */
  references?: MdmarkReferences | undefined;
  /** 利用側が指定したエイリアス。使用できるものだけを照合する */
  aliases?: readonly unknown[] | undefined;
  /** 文書で決まった機能のオン・オフ */
  features: Record<string, boolean>;
}): Dictionary {
  const { index, docId, ownGlossary, references, features } = options;
  const usable = usableAliases(options.aliases ?? []);
  const maps: DictionaryMaps = {
    terms: new Map(),
    plainTerms: new Map(),
    docs: new Map(),
    avoided: new Map(),
    written: new Map(),
  };
  if (features.glossary !== false) {
    addGlossary(maps, { index, docId, ownGlossary, references, usable });
  }
  if (features.backlinks !== false) {
    addDocAliases(maps, index, docId);
  }
  const words = [...new Set([...maps.terms.keys(), ...maps.docs.keys()])].sort(
    (a, b) => b.length - a.length,
  );
  const { terms, docs, avoided, written, plainTerms } = maps;
  return {
    words,
    terms,
    docs,
    avoided,
    written,
    term: (word) => plainTerms.get(normalizeWord(word)),
  };
}

/** 文字列を単語に区切り、各語の始まりの位置（UTF-16 の位置）を頭から順に返却する。区切り方は実行環境の辞書に依る */
export function wordStarts(text: string): number[] {
  if (typeof Intl.Segmenter !== "undefined") {
    segmenter ??= new Intl.Segmenter("ja", { granularity: "word" });
    return [...segmenter.segment(text)].map((segment) => segment.index);
  }
  return [...text.matchAll(FALLBACK_WORD)].map((match) => match.index);
}

/** 文字列の中で、元の文字列を単語の区切りごとに NFKC と英字の小文字化をかけてつなぎ、始まりと終わりが区切りに一致する辞書の単語（`normalizeWord` で正規化した単語）の位置を、元の文字列の位置で、重ならないよう長い単語を先に、頭から順に返却する。`word` は `words` に指定したままの単語で、正規化した後に同じになる単語は `words` で先の単語 */
export function findWords(
  text: string,
  words: string[],
): Array<{ start: number; end: number; word: string }> {
  // 正規化した単語から、指定したままの単語を参照する（同じ単語は先の単語）
  const passed = new Map<string, string>();
  for (const word of words) {
    const key = normalizeWord(word);
    if (key !== "" && !passed.has(key)) {
      passed.set(key, word);
    }
  }
  const longestFirst = [...passed.keys()].sort((a, b) => b.length - a.length);
  const starts = wordStarts(text);
  // 区切りごとに正規化するため、NFKC で長さが変わる文字があっても、正規化した文字の境目は元の区切りに一致する
  const folded = starts.map((start, position) =>
    text
      .slice(start, starts[position + 1] ?? text.length)
      .normalize("NFKC")
      .toLowerCase(),
  );
  const normalized = folded.join("");
  // 区切りの境目の、正規化した文字列の中の位置から元の文字列の位置を参照する
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

/** 見出しを除く行内のトークンを、文書の頭から順に指定する。`section` は見出し（h2〜h4）ごとに進むセクションの番号 */
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

/** 行内のトークンの子のうち、照合してよい文字の位置を返却する（リンクの中・コード・用語集の表の中は除く） */
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
