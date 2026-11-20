import type { MarkdownIt as MarkdownItParser, Token } from "markdown-it";
import MarkdownIt from "markdown-it";
import { type MdmarkConfig, resolveConfig } from "../config.ts";
import { splitFrontmatter } from "../frontmatter/frontmatter.logic.ts";
import { resolveDocumentFeatures, takeMarks } from "../render/marks.ts";
import type { RenderEnv } from "../render/parser.ts";
import {
  findWords,
  forEachInline,
  matchableChildren,
  normalizeWord,
} from "./dictionary.ts";
import { glossaryRule } from "./glossary.syntax.ts";
import {
  type MdmarkIndex,
  type MdmarkIndexDoc,
  type MdmarkIndexDocTag,
  normalizeIndex,
  readRelated,
} from "./index-shape.ts";
import { fileTitle, normalizePath, resolveLink } from "./paths.ts";

/** 用語集の表の 1 行から入れた用語 */
export type MdmarkGlossaryEntry = {
  /** 用語の列の文字 */
  term: string;
  /** 別名の列を「、」「,」で区切ったもの。別名の列が無いときは空 */
  aliases: string[];
  /** 意味の列の文字 */
  meaning: string;
  /** 表を持つ文書の `id` */
  docId: string;
  /** やめた言い方の列を「、」「,」で区切ったもの。やめた言い方の列が無いときは空。利用側が組み立てた参照の表で無いときは、やめた言い方を持たない用語として扱う */
  avoid?: string[] | undefined;
};

/** `collectReferences` が返却し、`mount`・`render` の `opts.references` が受け取る参照の表 */
export type MdmarkReferences = {
  /** 文書の `id` から、その文書を参照している文書の `id` の並び */
  backlinks: Record<string, string[]>;
  /** 各文書の用語集の表から入れた用語 */
  glossary: MdmarkGlossaryEntry[];
  /** 索引の文書をフロントマターの値で補い、索引に無い文書を加えた並び（どの文書も `title` を持つ）。`collectReferences` は常に入れる。利用側が組み立てた参照の表で無いときは、`opts.index` の `docs` を使用する */
  docs?: MdmarkIndexDoc[] | undefined;
};

/** 1 つの文書のフロントマターから取り出した、使用できる値だけのメタデータ */
export type FrontmatterMetadata = {
  /** 空でない文字列の `title` */
  title?: string;
  /** 空でない文字列の `description` */
  description?: string;
  /** 空でない文字列の並びの `aliases` */
  aliases?: string[];
  /** 索引の `docs[].tags` と同じ要素の並びの `tags` */
  tags?: (string | MdmarkIndexDocTag)[];
};

/** フロントマターで補うキー（補う順） */
const FRONTMATTER_KEYS = ["title", "description", "aliases", "tags"] as const;

/** 空でない文字列か */
function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/** 呼ぶ側が解析したフロントマターの値から、`title`・`description`・`aliases`・`tags` のうち型の合うキーだけを取り出す */
export function readFrontmatterMetadata(value: unknown): FrontmatterMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const metadata: FrontmatterMetadata = {};
  if (isFilledString(record.title)) {
    metadata.title = record.title;
  }
  if (isFilledString(record.description)) {
    metadata.description = record.description;
  }
  const { aliases, tags } = record;
  if (Array.isArray(aliases) && aliases.every(isFilledString)) {
    metadata.aliases = aliases;
  }
  // タグの要素は、索引の `docs[].tags` と同じ検査で確かめる
  if (
    Array.isArray(tags) &&
    normalizeIndex({ schema: 2, docs: [{ id: "_", path: "_", tags }] }).problems
      .length === 0
  ) {
    metadata.tags = tags as (string | MdmarkIndexDocTag)[];
  }
  return metadata;
}

/** 本文の最初の h1 の文字（フロントマターとコードブロックの中は読み込まない）。無ければ `undefined` */
function firstHeading(markdown: string): string | undefined {
  let fence: string | undefined;
  for (const line of splitFrontmatter(markdown).body.split("\n")) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1].charAt(0);
      fence =
        fence === undefined ? marker : fence === marker ? undefined : fence;
      continue;
    }
    if (fence !== undefined) {
      continue;
    }
    const heading = /^ {0,3}#\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (heading?.[1]) {
      return heading[1];
    }
  }
  return undefined;
}

/** 文書のタイトルを決める: 索引の `title`、無ければフロントマターの `title`、無ければ本文の最初の h1 の文字、無ければ拡張子を落としたファイル名 */
export function resolveDocTitle(doc: {
  path: string;
  markdown: string;
  indexTitle?: string | undefined;
  frontmatterTitle?: string | undefined;
}): string {
  return (
    doc.indexTitle ??
    doc.frontmatterTitle ??
    firstHeading(doc.markdown) ??
    fileTitle(doc.path)
  );
}

/** 索引の文書に無いキーをフロントマターの値で補い、索引に無く `title` を持つ文書を加えた文書の並びを返却する。引数を書き換えない */
export function supplementIndexDocs(input: {
  /** `normalizeIndex` で検査した索引 */
  index: MdmarkIndex;
  /** 文書のパスから本文を参照する表 */
  documents: Record<string, string>;
  /** 文書のパスから、解析したフロントマターの値を参照する表 */
  frontmatter?: Record<string, unknown> | undefined;
}): {
  docs: MdmarkIndexDoc[];
  added: Set<string>;
  metadata: Map<string, FrontmatterMetadata>;
} {
  const bodies = new Map(
    Object.entries(input.documents).map(([path, body]) => [
      normalizePath(path),
      body,
    ]),
  );
  const metadata = new Map(
    Object.entries(input.frontmatter ?? {}).map(([path, value]) => [
      normalizePath(path),
      readFrontmatterMetadata(value),
    ]),
  );
  const docs = input.index.docs.map((doc) => {
    const path = normalizePath(doc.path);
    const found = metadata.get(path) ?? {};
    const filled: MdmarkIndexDoc = { ...doc };
    for (const key of FRONTMATTER_KEYS) {
      if (filled[key] === undefined && found[key] !== undefined) {
        Object.assign(filled, { [key]: found[key] });
      }
    }
    filled.title ??= resolveDocTitle({
      path: doc.path,
      markdown: bodies.get(path) ?? "",
    });
    return filled;
  });
  const indexedPaths = new Set(docs.map((doc) => normalizePath(doc.path)));
  const ids = new Set(docs.map((doc) => doc.id));
  const added = new Set<string>();
  for (const path of bodies.keys()) {
    const found = metadata.get(path);
    if (found?.title === undefined || indexedPaths.has(path) || ids.has(path)) {
      continue;
    }
    docs.push({ id: path, path, ...found, title: found.title });
    added.add(path);
  }
  return { docs, added, metadata };
}

/** 文書の本文を読み込んだ結果 */
export type ParsedDocument = {
  /** 解析器のトークン */
  tokens: Token[];
  /** 文書のマーカーを重ねて決まった機能のオン・オフ */
  features: Record<string, boolean>;
  /** 用語集の表の 1 行ごとの用語と、その行の行番号（1 から） */
  glossary: Array<{
    entry: MdmarkGlossaryEntry;
    line: number;
  }>;
};

/** 参照の表と点検が本文を読み込む解析器: マーカーを取得し、機能を決め、用語集の表を読み込むところまでのコアルールだけを持つ */
let parser: MarkdownItParser | undefined;

/** 文書の本文を、マーカー・機能・用語集の表を読み込んだトークンにする */
export function parseDocument(options: {
  /** 本文の Markdown */
  body: string;
  /** 文書の `id` */
  docId: string;
  /** 設定の `features` */
  defaults: Record<string, boolean>;
}): ParsedDocument {
  if (!parser) {
    parser = new MarkdownIt({ html: true });
    parser.core.ruler.push("mdmark_take_marks", takeMarks);
    parser.core.ruler.push("mdmark_resolve_features", resolveDocumentFeatures);
    parser.core.ruler.push("mdmark_glossary", glossaryRule);
  }
  const env: RenderEnv = {
    libraries: {},
    defaults: options.defaults,
    featureOptions: [],
    markNotes: [],
    features: {},
    headings: [],
    nonce: "",
    docId: options.docId,
    ownGlossary: [],
    glossaryLines: [],
  };
  // 本文の先頭のフロントマターは空白にして、リンク・別名・用語の照合に数えない
  const tokens = parser.parse(splitFrontmatter(options.body).body, env);
  const glossary = env.ownGlossary.map((entry, position) => ({
    entry,
    line: env.glossaryLines?.[position] ?? 0,
  }));
  return { tokens, features: env.features, glossary };
}

/** 文書の本文を読み込んだ結果と、索引の文書 */
type ScannedDocument = {
  doc: MdmarkIndexDoc;
  parsed: ParsedDocument | undefined;
};

/** 本文のリンクが指す、索引のパスの集まり */
export function linkedPaths(doc: MdmarkIndexDoc, tokens: Token[]): Set<string> {
  const paths = new Set<string>();
  for (const token of tokens) {
    for (const child of token.children ?? []) {
      const href = child.type === "link_open" ? child.attrGet("href") : null;
      const path =
        typeof href === "string" ? resolveLink(doc.path, href) : undefined;
      if (path !== undefined) {
        paths.add(path);
      }
    }
  }
  return paths;
}

/** 本文の中の、文書の別名に該当する単語の集まり（コード・リンク・見出し・用語集の表の中は除く） */
function matchedAliases(tokens: Token[], aliases: string[]): Set<string> {
  const matched = new Set<string>();
  if (aliases.length === 0) {
    return matched;
  }
  forEachInline(tokens, (inline) => {
    for (const position of matchableChildren(inline)) {
      const content = inline.children?.[position]?.content ?? "";
      for (const found of findWords(content, aliases)) {
        matched.add(found.word);
      }
    }
  });
  return matched;
}

/** 正規化した文書の別名から、その別名を持つ文書を参照する表 */
function aliasOwnersOf(
  scanned: ScannedDocument[],
): Map<string, MdmarkIndexDoc[]> {
  const aliasOwners = new Map<string, MdmarkIndexDoc[]>();
  for (const { doc } of scanned) {
    for (const alias of doc.aliases ?? []) {
      const key = normalizeWord(alias);
      aliasOwners.set(key, [...(aliasOwners.get(key) ?? []), doc]);
    }
  }
  return aliasOwners;
}

/** 文書を探す表: パス・`id`・別名から */
type DocLookup = {
  byPath: Map<string, MdmarkIndexDoc>;
  byId: Map<string, MdmarkIndexDoc>;
  aliasOwners: Map<string, MdmarkIndexDoc[]>;
};

/** 文書が参照する文書: `related` の相手・本文のリンクが指す文書・本文に出る別名を持つ文書 */
function targetsOf(
  source: ScannedDocument,
  lookup: DocLookup,
): Set<MdmarkIndexDoc> {
  const { byPath, byId, aliasOwners } = lookup;
  const tokens = source.parsed?.tokens ?? [];
  const found = [
    ...(source.doc.related ?? []).map((item) => byId.get(readRelated(item).to)),
    ...[...linkedPaths(source.doc, tokens)].map((path) => byPath.get(path)),
    ...[...matchedAliases(tokens, [...aliasOwners.keys()])].flatMap(
      (word) => aliasOwners.get(word) ?? [],
    ),
  ];
  return new Set(
    found.filter((target): target is MdmarkIndexDoc => target !== undefined),
  );
}

/** 索引と全ての文書の本文から、文書ごとの被参照と、各文書の用語集の表から入れた用語を返却する */
export function collectReferences(input: {
  /** 索引 */
  index: MdmarkIndex;
  /** 文書のパスから本文を参照する表 */
  documents: Record<string, string>;
  /** 設定 */
  config?: MdmarkConfig;
  /** 文書のパスから、解析したフロントマターの値を参照する表 */
  frontmatter?: Record<string, unknown> | undefined;
}): MdmarkReferences {
  const normalized = normalizeIndex(input.index).index;
  const { docs } = supplementIndexDocs({
    index: normalized,
    documents: input.documents,
    frontmatter: input.frontmatter,
  });
  const index: MdmarkIndex = { ...normalized, docs };
  const defaults = resolveConfig({ config: input.config }).features;
  const bodies = new Map(
    Object.entries(input.documents).map(([path, body]) => [
      normalizePath(path),
      body,
    ]),
  );
  const scanned: ScannedDocument[] = index.docs.map((doc) => {
    const body = bodies.get(normalizePath(doc.path));
    return {
      doc,
      parsed:
        body === undefined
          ? undefined
          : parseDocument({ body, docId: doc.id, defaults }),
    };
  });
  /** 文書の機能がオンか。本文が無い文書は設定のまま */
  const featureOn = (item: ScannedDocument, name: string): boolean =>
    (item.parsed?.features ?? defaults)[name] !== false;
  const lookup: DocLookup = {
    byPath: new Map(index.docs.map((doc) => [normalizePath(doc.path), doc])),
    byId: new Map(index.docs.map((doc) => [doc.id, doc])),
    aliasOwners: aliasOwnersOf(scanned),
  };
  /** 被参照を出す文書か（描く文書の被参照の機能がオン） */
  const receives = (target: MdmarkIndexDoc): boolean => {
    const targetItem = scanned.find((item) => item.doc === target);
    return targetItem !== undefined && featureOn(targetItem, "backlinks");
  };

  const referenced = new Map<string, Set<string>>(
    index.docs.map((doc) => [doc.id, new Set()]),
  );
  for (const source of scanned.filter((item) => featureOn(item, "backlinks"))) {
    for (const target of targetsOf(source, lookup)) {
      if (target !== source.doc && receives(target)) {
        referenced.get(target.id)?.add(source.doc.id);
      }
    }
  }
  const backlinks: Record<string, string[]> = {};
  for (const [id, sources] of referenced) {
    backlinks[id] = [...sources];
  }
  const glossary = scanned.flatMap((item) =>
    (item.parsed?.glossary ?? []).map((row) => row.entry),
  );
  return { backlinks, glossary, docs };
}
