import { DEFAULT_FEATURES } from "../config.ts";
import { type MdmarkIndexDoc, normalizeIndex } from "./index-shape.ts";
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
    | "duplicate_term";
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

/** 索引と文書の本文から、`schema`・`missing_doc`・`orphan_doc`・`broken_ref`・`duplicate_term` のずれをこの順で返す */
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
  }
  return [
    ...schema,
    ...missing,
    ...orphan,
    ...broken,
    ...duplicateTerms(sites),
  ];
}
