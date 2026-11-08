import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isMap, isScalar, isSeq, parse, parseDocument } from "yaml";

/** 値が連想配列（`null`・配列を除くオブジェクト）か */
const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 語彙の並びで、名前と別名から語彙の `name` を参照する表と、やめたタグの `name` から振り替え先を参照する表を作る。
 * 同じ単語は語彙の並びで先のタグに適用する
 */
const buildReplacements = (vocabulary) => {
  const byWord = new Map();
  const replacedBy = new Map();
  if (!Array.isArray(vocabulary)) {
    return { byWord, replacedBy };
  }
  for (const tag of vocabulary) {
    if (!isRecord(tag) || typeof tag.name !== "string") {
      continue;
    }
    const words = [
      tag.name,
      ...(Array.isArray(tag.aliases) ? tag.aliases : []),
    ];
    for (const word of words) {
      if (typeof word === "string" && !byWord.has(word)) {
        byWord.set(word, tag.name);
      }
    }
    if (typeof tag.deprecated === "string" && !replacedBy.has(tag.name)) {
      replacedBy.set(tag.name, tag.deprecated);
    }
  }
  return { byWord, replacedBy };
};

/** 文書のタグの要素のセクションから、タグの名前と主題のタグかを読み込む。読み込めない要素は `undefined` */
const readTagNode = (node) => {
  if (isScalar(node) && typeof node.value === "string") {
    return { name: node.value, main: false };
  }
  if (isMap(node)) {
    const name = node.get("name");
    if (typeof name === "string") {
      return { name, main: node.get("main") === true };
    }
  }
  return undefined;
};

/** 文書のタグの並びを書き換える。変えたら `true` */
const rewriteDocTags = ({ doc, tags, byWord, replacedBy }) => {
  const kept = [];
  let changed = false;
  for (const node of tags.items) {
    const tag = readTagNode(node);
    if (tag === undefined) {
      kept.push({ node });
      continue;
    }
    const named = byWord.get(tag.name) ?? tag.name;
    const name = replacedBy.get(named) ?? named;
    const same = kept.find((entry) => entry.name === name);
    if (same !== undefined) {
      // 書き換えで重なった名前は先の 1 つにまとめ、主題のタグを引き継ぐ
      same.main = same.main || tag.main;
      changed = true;
      continue;
    }
    if (name !== tag.name) {
      changed = true;
    }
    kept.push({ node, name, main: tag.main, original: tag });
  }
  if (!changed) {
    return false;
  }
  tags.items = kept.map((entry) => {
    if (
      entry.original === undefined ||
      (entry.original.name === entry.name && entry.original.main === entry.main)
    ) {
      return entry.node;
    }
    return doc.createNode(
      entry.main ? { name: entry.name, main: true } : entry.name,
    );
  });
  return true;
};

/**
 * v0.9.0 までの索引の YAML から、文書のタグの別名・やめたタグを語彙の `name`・振り替え先に書き換え、
 * 最上位の `tags` を削除して `schema` を `2` にした YAML を返却する。変えるものが無ければ `undefined`
 */
export const dropTagVocabulary = (source) => {
  const doc = parseDocument(source);
  const { byWord, replacedBy } = buildReplacements(doc.toJS()?.tags);
  let changed = false;
  const docs = doc.get("docs");
  if (isSeq(docs)) {
    for (const item of docs.items) {
      const tags = isMap(item) ? item.get("tags") : undefined;
      if (isSeq(tags) && rewriteDocTags({ doc, tags, byWord, replacedBy })) {
        changed = true;
      }
    }
  }
  if (doc.has("tags")) {
    doc.delete("tags");
    changed = true;
  }
  if (doc.get("schema") === 1) {
    doc.set("schema", 2);
    changed = true;
  }
  return changed ? doc.toString({ flowCollectionPadding: false }) : undefined;
};

/** `--config` の設定ファイルの `index` が指す索引を `dropTagVocabulary` で書き換えて書き込んで戻す。`index` が無い設定では何もしない */
export const runDropTagVocabulary = async (argv) => {
  const position = argv.indexOf("--config");
  const configFile = position === -1 ? undefined : argv[position + 1];
  if (configFile === undefined) {
    throw new Error("--config {設定ファイル} を指定してください");
  }
  const config = parse(await readFile(configFile, "utf8"));
  if (!isRecord(config) || typeof config.index !== "string") {
    return;
  }
  const indexFile = resolve(dirname(configFile), config.index);
  const result = dropTagVocabulary(await readFile(indexFile, "utf8"));
  if (result !== undefined) {
    await writeFile(indexFile, result);
  }
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runDropTagVocabulary(process.argv.slice(2));
}
