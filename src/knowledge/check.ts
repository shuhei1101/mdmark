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
} from "./index-shape.ts";
import { normalizePath } from "./paths.ts";
import { parseDocument } from "./references.ts";
import {
  buildTagVocabulary,
  nearestTag,
  readDocTag,
  resolveTag,
} from "./tags.ts";

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
    | "avoided_term"
    | "duplicate_tag"
    | "tag_alias_conflict"
    | "broken_tag_replacement"
    | "unregistered_tag"
    | "deprecated_tag";
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

/** 正規化した語に当たる、用語の語か別名の位置 */
function positionOfWord(site: TermSite, word: string): number {
  return site.words.findIndex((candidate) => normalizeWord(candidate) === word);
}

/** ずれに書く用語の場所を、`{ファイル} の {場所}` の形にする。`word` は正規化した語 */
function describeSite(site: TermSite, word: string): string {
  const position = Math.max(positionOfWord(site, word), 0);
  return `\`${site.file}\` の \`${site.wheres[position]}\``;
}

/** 重なった用語のずれを返す。後に出た用語ごとに、語か別名が正規化した後に重なる先の用語のうち最初の 1 つとの組を 1 件にする */
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
        message: `用語 \`${word}\` が ${describeSite(earlier, key)} と重なっています。どちらかを消すか、語を変えてください。`,
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

/** `findAvoidedTerms` が探す用語: 語・別名・やめた言い方 */
type AvoidableTerm = Pick<MdmarkIndexTerm, "term" | "aliases" | "avoid">;

/** 1 つの文書のトークンから、用語のやめた言い方が出た行とやめた言い方の組を `avoided_term` のずれにする */
export function findAvoidedTerms(options: {
  /** ずれの `file` に出す文書のパス */
  file: string;
  /** `parseDocument` のトークン */
  tokens: Token[];
  /** 用語（索引の用語の後に、索引の `docs` の順の文書の用語集の表の用語を続けた並び。同じやめた言い方は先の用語を使う） */
  terms: AvoidableTerm[];
}): MdmarkIndexIssue[] {
  const { file, tokens, terms } = options;
  // 正規化したやめた言い方から、記載した表記と代わりに使う用語の語を引く（同じ言い方は先の用語を使う）
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
  // 用語の語・別名を先に渡し、同じ長さならそちらを当てる。やめた言い方の一部に当たる用語の語を、やめた言い方として数えないため
  const termWords = new Set(
    terms.flatMap((term) =>
      [term.term, ...(term.aliases ?? [])].map(normalizeWord),
    ),
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
      message: `\`${avoidedBy.get(word)?.written}\` はやめた言い方です。用語 \`${avoidedBy.get(word)?.term}\` に書き換えてください。`,
    }));
}

/** 索引のタグの語彙と文書のタグから、`duplicate_tag`・`tag_alias_conflict`・`broken_tag_replacement`・`unregistered_tag`・`deprecated_tag` のずれをこの順で返す。語彙が無い索引では空 */
export function findTagIssues(input: {
  /** 形に合う要素だけの索引 */
  index: MdmarkIndex;
  /** 索引の YAML を読んだ値。ずれの場所は、この値の `tags`・`docs` の並びで数える */
  raw: unknown;
  /** ずれの `file` に出す索引のファイルの名前 */
  indexFile: string;
}): MdmarkIndexIssue[] {
  const { index, raw, indexFile } = input;
  const vocabulary = buildTagVocabulary(index.tags);
  if (vocabulary === undefined) {
    return [];
  }
  const tags = index.tags ?? [];
  const rawTags = (raw as { tags?: unknown }).tags;
  const rawDocs = (raw as { docs?: unknown }).docs;
  const tagPosition = (tag: object): number =>
    Array.isArray(rawTags) ? rawTags.indexOf(tag) : -1;
  const issue = (
    where: string,
    kind: MdmarkIndexIssue["kind"],
    message: string,
  ): MdmarkIndexIssue => ({ file: indexFile, where, kind, message });

  // 先に出た同じ `name` と重なる 2 つ目以降のタグ
  const duplicates: MdmarkIndexIssue[] = [];
  const firstOf = new Map<string, number>();
  for (const tag of tags) {
    const position = tagPosition(tag);
    const first = firstOf.get(tag.name);
    if (first === undefined) {
      firstOf.set(tag.name, position);
      continue;
    }
    duplicates.push(
      issue(
        `tags[${position}].name`,
        "duplicate_tag",
        `タグ \`${tag.name}\` が \`tags[${first}]\` と重なっています。どちらかを消すか、名前を変えてください。`,
      ),
    );
  }

  // 別名が、ほかのタグの `name` か、先のほかのタグの別名と重なる
  const conflicts: MdmarkIndexIssue[] = [];
  tags.forEach((tag, position) => {
    (tag.aliases ?? []).forEach((alias, aliasPosition) => {
      const target =
        tags.find((other) => other.name !== tag.name && other.name === alias) ??
        tags
          .slice(0, position)
          .find(
            (other) =>
              other.name !== tag.name && (other.aliases ?? []).includes(alias),
          );
      if (target) {
        conflicts.push(
          issue(
            `tags[${tagPosition(tag)}].aliases[${aliasPosition}]`,
            "tag_alias_conflict",
            `別名 \`${alias}\` がタグ \`${target.name}\` と重なっています。どちらかの別名を消すか、変えてください。`,
          ),
        );
      }
    });
  });

  // 振り替え先が語彙の `name` に無い
  const broken: MdmarkIndexIssue[] = [];
  for (const tag of tags) {
    if (tag.deprecated !== undefined && !vocabulary.order.has(tag.deprecated)) {
      broken.push(
        issue(
          `tags[${tagPosition(tag)}].deprecated`,
          "broken_tag_replacement",
          `振り替え先 \`${tag.deprecated}\` が語彙にありません。語彙にあるタグの名前に直すか、語彙に \`${tag.deprecated}\` を追加してください。`,
        ),
      );
    }
  }

  // 文書のタグが語彙に無い・やめたタグ
  const used: MdmarkIndexIssue[] = [];
  for (const doc of index.docs) {
    const docPosition = Array.isArray(rawDocs) ? rawDocs.indexOf(doc) : -1;
    (doc.tags ?? []).forEach((docTag, tagPos) => {
      const { name } = readDocTag(docTag);
      const where = `docs[${docPosition}].tags[${tagPos}]`;
      const found = resolveTag({ vocabulary, name });
      if (found === undefined) {
        const near = nearestTag({ vocabulary, tag: name });
        used.push(
          issue(
            where,
            "unregistered_tag",
            near === undefined
              ? `タグ \`${name}\` が語彙になく、近いタグもありません。語彙に \`${name}\` を追加するか、語彙にあるタグに直してください。`
              : `タグ \`${name}\` が語彙にありません。近いタグは \`${near}\` です。\`${near}\` に直すか、語彙に \`${name}\` を追加してください。`,
          ),
        );
      } else if (found.deprecated !== undefined) {
        used.push(
          issue(
            where,
            "deprecated_tag",
            `タグ \`${name}\` はやめたタグです。\`${found.deprecated}\` に直してください。`,
          ),
        );
      }
    });
  }
  return [...duplicates, ...conflicts, ...broken, ...used];
}

/** 索引と文書の本文から、`schema`・`missing_doc`・`orphan_doc`・`broken_ref`・`duplicate_term`・`avoided_term`・`duplicate_tag`・`tag_alias_conflict`・`broken_tag_replacement`・`unregistered_tag`・`deprecated_tag` のずれをこの順で返す */
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

  // 文書は先に全て読む（やめた言い方は、表を持たない文書の本文からも探すため）
  const parsedDocs: Array<{
    path: string;
    parsed: ReturnType<typeof parseDocument>;
  }> = [];
  for (const doc of index.docs) {
    const entry = documents.get(normalizePath(doc.path));
    if (entry) {
      parsedDocs.push({
        path: entry.path,
        parsed: parseDocument({
          body: entry.body,
          docId: doc.id,
          defaults: { ...DEFAULT_FEATURES },
        }),
      });
    }
  }
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
  const avoidable: AvoidableTerm[] = [...(index.terms ?? [])];
  for (const { path, parsed } of parsedDocs) {
    for (const { entry: term, line } of parsed.glossary) {
      sites.push({
        file: path,
        words: [term.term, ...term.aliases],
        wheres: [term.term, ...term.aliases].map(() => `${line} 行目`),
      });
      avoidable.push({
        term: term.term,
        aliases: term.aliases,
        avoid: term.avoid ?? [],
      });
    }
  }
  // やめた言い方は、索引の `docs` の順に文書ごとに探す
  const avoided = parsedDocs.flatMap(({ path, parsed }) =>
    findAvoidedTerms({ file: path, tokens: parsed.tokens, terms: avoidable }),
  );
  return [
    ...schema,
    ...missing,
    ...orphan,
    ...broken,
    ...duplicateTerms(sites),
    ...avoided,
    ...findTagIssues({ index, raw: input.index, indexFile }),
  ];
}
