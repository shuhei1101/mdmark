import type { Token } from "markdown-it";
import { DEFAULT_FEATURES } from "../config.ts";
import {
  findWords,
  forEachInline,
  matchableChildren,
  normalizeWord,
} from "./dictionary.ts";
import {
  type MdmarkIndex,
  type MdmarkIndexDoc,
  type MdmarkIndexTerm,
  normalizeIndex,
  readRelated,
} from "./index-shape.ts";
import { normalizePath } from "./paths.ts";
import { linkedPaths, parseDocument } from "./references.ts";

/** `checkIndex` が返却するずれ 1 件 */
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
    | "untyped_related"
    | "one_sided_change_together"
    | "related_link_overlap"
    | "missed_change_together"
    | "duplicate_term"
    | "avoided_term";
  /** ずれの内容と修正方法 */
  message: string;
};

/** 点検が確認する用語 1 つ: 単語と別名、ずれに記載する場所 */
type TermSite = {
  /** 単語と別名（単語が先） */
  words: string[];
  /** 単語や別名ごとの、ずれの `where` */
  wheres: string[];
  /** ファイル */
  file: string;
};

/** 索引のずれを点検する既定の索引のファイル名 */
const DEFAULT_INDEX_FILE = "index.yaml";

/** 正規化した単語に該当する、用語の単語か別名の位置 */
function positionOfWord(site: TermSite, word: string): number {
  return site.words.findIndex((candidate) => normalizeWord(candidate) === word);
}

/** ずれに記載する用語の場所を、`{ファイル} の {場所}` の構造にする。`word` は正規化した単語 */
function describeSite(site: TermSite, word: string): string {
  const position = Math.max(positionOfWord(site, word), 0);
  return `\`${site.file}\` の \`${site.wheres[position]}\``;
}

/** 重なった用語のずれを返却する。後に出た用語ごとに、単語か別名が正規化した後に重なる先の用語のうち最初の 1 つとの組を 1 件にする */
function duplicateTerms(sites: TermSite[]): MdmarkIndexIssue[] {
  const issues: MdmarkIndexIssue[] = [];
  sites.forEach((site, position) => {
    for (const [wordPosition, word] of site.words.entries()) {
      const key = normalizeWord(word);
      const earlier = sites
        .slice(0, position)
        .find((candidate) => positionOfWord(candidate, key) !== -1);
      if (!earlier) {
        continue;
      }
      issues.push({
        file: site.file,
        where: site.wheres[wordPosition] ?? "",
        kind: "duplicate_term",
        message: `用語 \`${word}\` が ${describeSite(earlier, key)} と重なっています。どちらかを削除するか、単語を変えてください。`,
      });
      // 1 つの用語につき、重なりは最初の 1 件だけ返却する
      break;
    }
  });
  return issues;
}

/** 行内のトークンごとに、表のセルなど `map` を持たないトークンの行を参照するための、直前の `tr_open` の開始行（0 から）を返却する */
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

/** `findAvoidedTerms` が探す用語: 単語・別名・やめた言い方 */
type AvoidableTerm = Pick<MdmarkIndexTerm, "term" | "aliases" | "avoid">;

/** 1 つの文書のトークンから、用語のやめた言い方が出た行とやめた言い方の組を `avoided_term` のずれにする */
export function findAvoidedTerms(options: {
  /** ずれの `file` に出す文書のパス */
  file: string;
  /** `parseDocument` のトークン */
  tokens: Token[];
  /** 用語（索引の用語の後に、索引の `docs` の順の文書の用語集の表の用語を続けた並び。同じやめた言い方は先の用語を使用する） */
  terms: AvoidableTerm[];
}): MdmarkIndexIssue[] {
  const { file, tokens, terms } = options;
  // 正規化したやめた言い方から、記載した表記と代わりに使用する用語の単語を参照する（同じ言い方は先の用語を使用する）
  const avoidedBy = new Map<string, { written: string; term: string }>();
  for (const term of terms) {
    for (const word of term.avoid ?? []) {
      const key = normalizeWord(word);
      if (key !== "" && !avoidedBy.has(key)) {
        avoidedBy.set(key, { written: word, term: term.term });
      }
    }
  }
  if (avoidedBy.size === 0) {
    return [];
  }
  // 用語の単語・別名を先に指定し、同じ長さならそちらを適用する。やめた言い方の一部に該当する用語の単語を、やめた言い方として数えないため
  const termWords = new Set(
    terms.flatMap((term) =>
      [term.term, ...(term.aliases ?? [])].map(normalizeWord),
    ),
  );
  const words = [...termWords, ...avoidedBy.keys()];
  const rows = rowStarts(tokens);
  const found: Array<{ line: number; word: string }> = [];
  forEachInline(tokens, (inline) => {
    // 解析器の開始行は 0 から数えるため、1 を追加して行番号にする
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
      message: `\`${avoidedBy.get(word)?.written}\` はやめた言い方です。用語 \`${avoidedBy.get(word)?.term}\` に書き換えてください。`,
    }));
}

/** 文書が `change_together` で記載している関連の相手の `id` の並び */
function changeTogetherTargets(doc: MdmarkIndexDoc): string[] {
  return (doc.related ?? [])
    .map(readRelated)
    .filter((related) => related.type === "change_together")
    .map((related) => related.to);
}

/** 索引の関連から `untyped_related`・`one_sided_change_together`・`related_link_overlap` をこの順で返却する。同じ種類の中は索引の `docs` の並び、文書の中は `related` の並び */
export function findRelatedIssues(options: {
  /** 検査で合う要素だけにした索引 */
  index: MdmarkIndex;
  /** 文書の `id` から、本文のリンクが指す文書のパス。本文を持たない文書はキーを持たない */
  links: Record<string, string[]>;
  /** ずれの `file` に出す索引のファイルの名前 */
  indexFile: string;
  /** `where` に出す文書の位置。省くと `index.docs` の位置 */
  positionOf?: (doc: MdmarkIndexDoc) => number;
}): MdmarkIndexIssue[] {
  const { index, links, indexFile } = options;
  const positionOf =
    options.positionOf ?? ((doc: MdmarkIndexDoc) => index.docs.indexOf(doc));
  const byId = new Map(index.docs.map((doc) => [doc.id, doc]));
  const untyped: MdmarkIndexIssue[] = [];
  const oneSided: MdmarkIndexIssue[] = [];
  const overlap: MdmarkIndexIssue[] = [];
  for (const doc of index.docs) {
    const position = positionOf(doc);
    const linked = Object.hasOwn(links, doc.id)
      ? new Set((links[doc.id] ?? []).map(normalizePath))
      : undefined;
    (doc.related ?? []).forEach((item, relatedPosition) => {
      const where = `docs[${position}].related[${relatedPosition}]`;
      if (typeof item === "string") {
        untyped.push({
          file: indexFile,
          where,
          kind: "untyped_related",
          message: `\`${where}\`（\`${item}\`）が文字列です。\`to\`・\`type\`・\`when\` を持つ関連に書き換えてください。`,
        });
      }
      const related = readRelated(item);
      const target = byId.get(related.to);
      if (target === undefined) {
        return;
      }
      if (related.type === "change_together") {
        if (!changeTogetherTargets(target).includes(doc.id)) {
          oneSided.push({
            file: indexFile,
            where,
            kind: "one_sided_change_together",
            message: `\`${doc.id}\` が \`${target.id}\` を \`change_together\` で記載していますが、\`${target.id}\` は \`${doc.id}\` を記載していません。\`${target.id}\` の \`related\` にも \`${doc.id}\` への \`change_together\` を記載してください。`,
          });
        }
        return;
      }
      if (linked?.has(normalizePath(target.path))) {
        overlap.push({
          file: indexFile,
          where,
          kind: "related_link_overlap",
          message: `\`${doc.id}\` の本文が \`${target.id}\`（\`${target.path}\`）をリンクしているため、\`${where}\` と重なります。\`related\` から除外するか、本文のリンクを削除してください。`,
        });
      }
    });
  }
  return [...untyped, ...oneSided, ...overlap];
}

/** `change_together` の組のうち、片方の文書だけが `changedPaths` にある組を `missed_change_together` で返却する。組は向きを問わず 1 回だけ確認し、先に記載した側の文書の索引の並びで返却する */
export function findMissedChangeTogether(options: {
  /** 検査で合う要素だけにした索引 */
  index: MdmarkIndex;
  /** 比べる基準から変わった文書のパス */
  changedPaths: string[];
}): MdmarkIndexIssue[] {
  const { index } = options;
  const changed = new Set(options.changedPaths.map(normalizePath));
  const byId = new Map(index.docs.map((doc) => [doc.id, doc]));
  const checked = new Set<string>();
  const issues: MdmarkIndexIssue[] = [];
  for (const doc of index.docs) {
    for (const id of changeTogetherTargets(doc)) {
      const target = byId.get(id);
      const pair = [doc.id, id].sort().join("\n");
      if (target === undefined || checked.has(pair)) {
        continue;
      }
      checked.add(pair);
      const docChanged = changed.has(normalizePath(doc.path));
      const targetChanged = changed.has(normalizePath(target.path));
      if (docChanged === targetChanged) {
        continue;
      }
      const [changedDoc, unchangedDoc] = docChanged
        ? [doc, target]
        : [target, doc];
      issues.push({
        file: unchangedDoc.path,
        where: "",
        kind: "missed_change_together",
        message: `\`${changedDoc.path}\` が変わっていますが、\`change_together\` の相手の \`${unchangedDoc.path}\` は変わっていません。\`${unchangedDoc.path}\` も修正するか確認してください。`,
      });
    }
  }
  return issues;
}

/** 読み込んだ文書（正規化したパスから、記載したパスと本文） */
type DocumentEntries = Map<string, { path: string; body: string }>;

/** 索引の文書が見つからないずれと、`related` が索引の文書を指さないずれ */
function findDocIssues(options: {
  index: MdmarkIndex;
  documents: DocumentEntries;
  indexFile: string;
  positionOf: (doc: MdmarkIndexDoc) => number;
}): { missing: MdmarkIndexIssue[]; broken: MdmarkIndexIssue[] } {
  const { index, documents, indexFile, positionOf } = options;
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
        message: `\`${doc.path}\` が見つかりません。文書を戻すか、索引の \`docs[${position}]\` を削除してください。`,
      });
    }
    (doc.related ?? []).forEach((item, relatedPosition) => {
      const { to } = readRelated(item);
      if (!ids.has(to)) {
        // オブジェクトの要素は、相手を指す `to` の場所を示す
        const where = `docs[${position}].related[${relatedPosition}]${typeof item === "string" ? "" : ".to"}`;
        broken.push({
          file: indexFile,
          where,
          kind: "broken_ref",
          message: `\`related\` の \`${to}\` が索引の文書にありません。\`${where}\` を修正するか削除してください。`,
        });
      }
    });
  }
  return { missing, broken };
}

/** 索引に無い文書のずれ（パスの順） */
function orphanIssues(
  index: MdmarkIndex,
  documents: DocumentEntries,
): MdmarkIndexIssue[] {
  const indexedPaths = new Set(
    index.docs.map((doc) => normalizePath(doc.path)),
  );
  return [...documents.entries()]
    .filter(([normalized]) => !indexedPaths.has(normalized))
    .map(([, { path }]) => path)
    .sort()
    .map((path) => ({
      file: path,
      where: "",
      kind: "orphan_doc" as const,
      message: `\`${path}\` が索引にありません。索引の \`docs\` に追加してください。`,
    }));
}

/** 読み込んだ索引の文書 */
type ParsedDoc = {
  doc: MdmarkIndexDoc;
  path: string;
  parsed: ReturnType<typeof parseDocument>;
};

/** 索引の文書のうち、見つかった文書を全て読み込む（やめた言い方は、表を持たない文書の本文からも探すため） */
function parseIndexedDocs(
  index: MdmarkIndex,
  documents: DocumentEntries,
): ParsedDoc[] {
  return index.docs.flatMap((doc) => {
    const entry = documents.get(normalizePath(doc.path));
    if (!entry) {
      return [];
    }
    return [
      {
        doc,
        path: entry.path,
        parsed: parseDocument({
          body: entry.body,
          docId: doc.id,
          defaults: { ...DEFAULT_FEATURES },
        }),
      },
    ];
  });
}

/** 索引の `terms` の用語の場所。索引の値の `terms` の並びでの位置で示す */
function indexTermSites(options: {
  index: MdmarkIndex;
  rawTerms: unknown[];
  indexFile: string;
}): TermSite[] {
  const { index, rawTerms, indexFile } = options;
  return (index.terms ?? []).map((term) => {
    const position = rawTerms.indexOf(term);
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
}

/** 文書の用語集の表の用語の場所と、やめた言い方を探す用語、本文のリンクが指す文書のパスを、索引の `docs` の順に集める */
function collectGlossary(
  parsedDocs: ParsedDoc[],
  into: {
    sites: TermSite[];
    avoidable: AvoidableTerm[];
    links: Record<string, string[]>;
  },
): void {
  for (const { doc, path, parsed } of parsedDocs) {
    into.links[doc.id] = [...linkedPaths(doc, parsed.tokens)];
    for (const { entry: term, line } of parsed.glossary) {
      into.sites.push({
        file: path,
        words: [term.term, ...term.aliases],
        wheres: [term.term, ...term.aliases].map(() => `${line} 行目`),
      });
      into.avoidable.push({
        term: term.term,
        aliases: term.aliases,
        avoid: term.avoid ?? [],
      });
    }
  }
}

/** 索引と文書の本文から、`schema`・`missing_doc`・`orphan_doc`・`broken_ref`・`untyped_related`・`one_sided_change_together`・`related_link_overlap`・`missed_change_together`・`duplicate_term`・`avoided_term` のずれをこの順で返却する */
export function checkIndex(input: {
  /** 索引の値（構造を確認する前のもの） */
  index: unknown;
  /** 文書のパスから本文を参照する表 */
  documents: Record<string, string>;
  /** ずれの `file` に出す索引のファイルの名前（既定 `index.yaml`） */
  indexFile?: string;
  /** 比べる基準から変わった文書のパス。指定したときだけ `change_together` の修正漏れを確認する */
  changedPaths?: string[];
}): MdmarkIndexIssue[] {
  const indexFile = input.indexFile ?? DEFAULT_INDEX_FILE;
  const { index, problems } = normalizeIndex(input.index);
  const schema: MdmarkIndexIssue[] = problems.map((problem) => ({
    file: indexFile,
    where: problem.where,
    kind: "schema",
    message: `索引の ${problem.where === "" ? "全体" : `\`${problem.where}\``} が構造に合いません: ${problem.message}。修正してください。`,
  }));
  // 索引がオブジェクトでないときは、ほかのずれを確認しない
  if (problems.some((problem) => problem.where === "")) {
    return schema;
  }

  // 検査で除かれる前の `docs` の並びでの位置を、ずれの場所に使用する
  const raw = input.index as { docs?: unknown; terms?: unknown[] };
  const positionOf = (doc: MdmarkIndexDoc): number =>
    Array.isArray(raw.docs) ? raw.docs.indexOf(doc) : -1;
  const documents: DocumentEntries = new Map(
    Object.entries(input.documents).map(([path, body]) => [
      normalizePath(path),
      { path, body },
    ]),
  );
  const { missing, broken } = findDocIssues({
    index,
    documents,
    indexFile,
    positionOf,
  });
  const parsedDocs = parseIndexedDocs(index, documents);
  // 用語は、索引の `terms`、索引の `docs` の順の文書の用語集の表の順に並べる
  const sites = indexTermSites({
    index,
    rawTerms: raw.terms ?? [],
    indexFile,
  });
  const avoidable: AvoidableTerm[] = [...(index.terms ?? [])];
  // 本文のリンクが指す文書のパス（関連と重なるかの確認に使用する）
  const links: Record<string, string[]> = {};
  collectGlossary(parsedDocs, { sites, avoidable, links });
  // やめた言い方は、索引の `docs` の順に文書ごとに探す
  const avoided = parsedDocs.flatMap(({ path, parsed }) =>
    findAvoidedTerms({ file: path, tokens: parsed.tokens, terms: avoidable }),
  );
  const changed =
    input.changedPaths === undefined
      ? []
      : findMissedChangeTogether({ index, changedPaths: input.changedPaths });
  return [
    ...schema,
    ...missing,
    ...orphanIssues(index, documents),
    ...broken,
    ...findRelatedIssues({ index, links, indexFile, positionOf }),
    ...changed,
    ...duplicateTerms(sites),
    ...avoided,
  ];
}
