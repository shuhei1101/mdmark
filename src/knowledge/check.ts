import type { Token } from "markdown-it";
import { DEFAULT_FEATURES } from "../config.ts";
import { findWords, forEachInline, matchableChildren } from "./dictionary.ts";
import {
  type MdmarkIndexDoc,
  type MdmarkIndexTerm,
  normalizeIndex,
} from "./index-shape.ts";
import { normalizePath } from "./paths.ts";
import { parseDocument } from "./references.ts";

/** `checkIndex` が返すずれ 1 件 */
export type MdmarkIndexIssue = {
  /** ずれのあるファイル */
  file: string;
  /** 索引のキーのパスか文書の行。ファイル全体は空文字 */
  where: string;
  /** ずれの種類 */
  kind:
    | "schema"
    | "missing_doc"
    | "orphan_doc"
    | "broken_ref"
    | "duplicate_term"
    | "avoided_term";
  /** ずれの内容と直し方 */
  message: string;
};

/** 点検が見る用語 1 つ: 語と別名、ずれに書く場所 */
type TermSite = {
  /** 語と別名（語が先） */
  words: string[];
  /** 語や別名ごとの、ずれの `where` */
  wheres: string[];
  /** ファイル */
  file: string;
};

/** 索引のずれを点検する既定の索引のファイル名 */
const DEFAULT_INDEX_FILE = "index.yaml";

/** ずれに書く用語の場所を、`{ファイル} の {場所}` の形にする */
function describeSite(site: TermSite, word: string): string {
  const position = Math.max(site.words.indexOf(word), 0);
  return `\`${site.file}\` の \`${site.wheres[position]}\``;
}

/** 重なった用語のずれを返す。後に出た用語ごとに、語か別名が重なる先の用語のうち最初の 1 つとの組を 1 件にする */
function duplicateTerms(sites: TermSite[]): MdmarkIndexIssue[] {
  const issues: MdmarkIndexIssue[] = [];
  sites.forEach((site, position) => {
    for (const word of site.words) {
      const earlier = sites
        .slice(0, position)
        .find((candidate) => candidate.words.includes(word));
      if (!earlier) {
        continue;
      }
      const where = site.wheres[site.words.indexOf(word)] ?? "";
      issues.push({
        file: site.file,
        where,
        kind: "duplicate_term",
        message: `用語 \`${word}\` が ${describeSite(earlier, word)} と重なっています。どちらかを消すか、語を変えてください。`,
      });
      // 1 つの用語につき、重なりは最初の 1 件だけ返す
      break;
    }
  });
  return issues;
}

/** 行内のトークンごとに、表のセルなど `map` を持たないトークンの行を引くための、直前の `tr_open` の開始行（0 から）を返す */
function rowStarts(tokens: Token[]): Map<Token, number | undefined> {
  const starts = new Map<Token, number | undefined>();
  let row: number | undefined;
  for (const token of tokens) {
    if (token.type === "tr_open") {
      row = token.map?.[0];
    } else if (token.type === "inline") {
      starts.set(token, row);
    }
  }
  return starts;
}

/** 1 つの文書のトークンから、用語のやめた言い方が出た行とやめた言い方の組を `avoided_term` のずれにする */
export function findAvoidedTerms(options: {
  /** ずれの `file` に出す文書のパス */
  file: string;
  /** `parseDocument` のトークン */
  tokens: Token[];
  /** 索引の用語 */
  terms: MdmarkIndexTerm[];
}): MdmarkIndexIssue[] {
  const { file, tokens, terms } = options;
  // やめた言い方から、代わりに使う用語の語を引く（同じ言い方は先の用語を使う）
  const avoidedBy = new Map<string, string>();
  for (const term of terms) {
    for (const word of term.avoid ?? []) {
      if (!avoidedBy.has(word)) {
        avoidedBy.set(word, term.term);
      }
    }
  }
  if (avoidedBy.size === 0) {
    return [];
  }
  // 用語の語・別名を先に渡し、同じ長さならそちらを当てる。やめた言い方の一部に当たる用語の語を、やめた言い方として数えないため
  const termWords = new Set(
    terms.flatMap((term) => [term.term, ...(term.aliases ?? [])]),
  );
  const words = [...termWords, ...avoidedBy.keys()];
  const rows = rowStarts(tokens);
  const found: Array<{ line: number; word: string }> = [];
  forEachInline(tokens, (inline) => {
    // 解析器の開始行は 0 から数えるため、1 を足して行番号にする
    const start = (inline.map?.[0] ?? rows.get(inline) ?? 0) + 1;
    const children = inline.children ?? [];
    for (const position of matchableChildren(inline)) {
      // その子より前の改行（softbreak・hardbreak）の数だけ、行が進む
      const breaks = children
        .slice(0, position)
        .filter(
          (child) => child.type === "softbreak" || child.type === "hardbreak",
        ).length;
      for (const match of findWords(children[position]?.content ?? "", words)) {
        if (!termWords.has(match.word)) {
          found.push({ line: start + breaks, word: match.word });
        }
      }
    }
  });
  // 行の順に並べ、同じ行とやめた言い方の組は 1 件にまとめる
  const seen = new Set<string>();
  return found
    .map((item, order) => ({ ...item, order }))
    .sort((a, b) => a.line - b.line || a.order - b.order)
    .filter(({ line, word }) => {
      const key = `${line}\u0000${word}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map(({ line, word }) => ({
      file,
      where: `${line} 行目`,
      kind: "avoided_term" as const,
      message: `\`${word}\` はやめた言い方です。用語 \`${avoidedBy.get(word)}\` に書き換えてください。`,
    }));
}

/** 索引と文書の本文から、`schema`・`missing_doc`・`orphan_doc`・`broken_ref`・`duplicate_term`・`avoided_term` のずれをこの順で返す */
export function checkIndex(input: {
  /** 索引の値（形を確かめる前のもの） */
  index: unknown;
  /** 文書のパスから本文を引く表 */
  documents: Record<string, string>;
  /** ずれの `file` に出す索引のファイルの名前（既定 `index.yaml`） */
  indexFile?: string;
}): MdmarkIndexIssue[] {
  const indexFile = input.indexFile ?? DEFAULT_INDEX_FILE;
  const { index, problems } = normalizeIndex(input.index);
  const schema: MdmarkIndexIssue[] = problems.map((problem) => ({
    file: indexFile,
    where: problem.where,
    kind: "schema",
    message: `索引の ${problem.where === "" ? "全体" : `\`${problem.where}\``} が形に合いません: ${problem.message}。直してください。`,
  }));
  // 索引がオブジェクトでないときは、ほかのずれを確かめない
  if (problems.some((problem) => problem.where === "")) {
    return schema;
  }

  // 検査で除かれる前の `docs` の並びでの位置を、ずれの場所に使う
  const rawDocs = (input.index as { docs?: unknown }).docs;
  const positionOf = (doc: MdmarkIndexDoc): number =>
    Array.isArray(rawDocs) ? rawDocs.indexOf(doc) : -1;
  const documents = new Map(
    Object.entries(input.documents).map(([path, body]) => [
      normalizePath(path),
      { path, body },
    ]),
  );
  const indexedPaths = new Set(
    index.docs.map((doc) => normalizePath(doc.path)),
  );
  const ids = new Set(index.docs.map((doc) => doc.id));

  const missing: MdmarkIndexIssue[] = [];
  const broken: MdmarkIndexIssue[] = [];
  for (const doc of index.docs) {
    const position = positionOf(doc);
    if (!documents.has(normalizePath(doc.path))) {
      missing.push({
        file: indexFile,
        where: `docs[${position}].path`,
        kind: "missing_doc",
        message: `\`${doc.path}\` が見つかりません。文書を戻すか、索引の \`docs[${position}]\` を消してください。`,
      });
    }
    (doc.related ?? []).forEach((id, relatedPosition) => {
      if (!ids.has(id)) {
        broken.push({
          file: indexFile,
          where: `docs[${position}].related[${relatedPosition}]`,
          kind: "broken_ref",
          message: `\`related\` の \`${id}\` が索引の文書にありません。\`docs[${position}].related[${relatedPosition}]\` を直すか消してください。`,
        });
      }
    });
  }
  const orphan: MdmarkIndexIssue[] = [...documents.entries()]
    .filter(([normalized]) => !indexedPaths.has(normalized))
    .map(([, { path }]) => path)
    .sort()
    .map((path) => ({
      file: path,
      where: "",
      kind: "orphan_doc" as const,
      message: `\`${path}\` が索引にありません。索引の \`docs\` に足してください。`,
    }));

  // 用語は、索引の `terms`、索引の `docs` の順の文書の用語集の表の順に並べる
  const sites: TermSite[] = (index.terms ?? []).map((term) => {
    const position = (
      (input.index as { terms?: unknown[] }).terms ?? []
    ).indexOf(term);
    const aliases = term.aliases ?? [];
    return {
      file: indexFile,
      words: [term.term, ...aliases],
      wheres: [
        `terms[${position}].term`,
        ...aliases.map((_, alias) => `terms[${position}].aliases[${alias}]`),
      ],
    };
  });
  const avoided: MdmarkIndexIssue[] = [];
  for (const doc of index.docs) {
    const entry = documents.get(normalizePath(doc.path));
    if (!entry) {
      continue;
    }
    const parsed = parseDocument({
      body: entry.body,
      docId: doc.id,
      defaults: { ...DEFAULT_FEATURES },
    });
    for (const { entry: term, line } of parsed.glossary) {
      sites.push({
        file: entry.path,
        words: [term.term, ...term.aliases],
        wheres: [term.term, ...term.aliases].map(() => `${line} 行目`),
      });
    }
    // やめた言い方は、索引の `docs` の順に文書ごとに探す
    avoided.push(
      ...findAvoidedTerms({
        file: entry.path,
        tokens: parsed.tokens,
        terms: index.terms ?? [],
      }),
    );
  }
  return [
    ...schema,
    ...missing,
    ...orphan,
    ...broken,
    ...duplicateTerms(sites),
    ...avoided,
  ];
}
