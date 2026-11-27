// 文書の map のマーカーから廃止した play・interval を削除する移行の手順のスクリプト
import { glob, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { argv, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

/** 値がオブジェクト（配列を除く）か */
const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** パスの区切りを `/` にする */
const toPosix = (path) => path.split(sep).join("/");

/** 値を文字の並びにする（文字 1 つは並び 1 つ） */
const listOf = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];

/** 設定の `build` の対象（`include` に該当し `exclude` に該当しない文書）を、設定ファイルのフォルダからの相対パスで集める */
const buildDocuments = async (config, configDir) => {
  const build = isRecord(config.build) ? config.build : {};
  const excluded = new Set();
  for (const pattern of listOf(build.exclude)) {
    for await (const path of glob(pattern, { cwd: configDir })) {
      excluded.add(toPosix(path));
    }
  }
  const found = [];
  for (const pattern of listOf(build.include)) {
    for await (const path of glob(pattern, { cwd: configDir })) {
      const posix = toPosix(path);
      if (!excluded.has(posix)) {
        found.push(posix);
      }
    }
  }
  return found;
};

/** 設定の `index` が指す索引の文書の `path` を、設定ファイルのフォルダからの相対パスで集める。読み込めない索引は `problems` に入れる */
const indexDocuments = async (config, configDir, problems) => {
  if (typeof config.index !== "string") {
    return [];
  }
  const indexFile = resolve(configDir, config.index);
  let index;
  try {
    index = parse(await readFile(indexFile, "utf8"));
  } catch {
    problems.push(
      `${config.index} を YAML として読み込めません。字下げと記載方法を修正してください。`,
    );
    return [];
  }
  const docs = isRecord(index) && Array.isArray(index.docs) ? index.docs : [];
  return docs
    .map((doc) => (isRecord(doc) ? doc.path : undefined))
    .filter((path) => typeof path === "string")
    .map((path) =>
      toPosix(relative(configDir, resolve(dirname(indexFile), path))),
    );
};

/** map のマーカーから削除するキー */
export const RETIRED_KEYS = ["play", "interval"];

// map のマーカー（引数を持つもの）
const MAP_MARK_RE = /<!--\s*map:\s*(\{[\s\S]*?\})\s*-->/g;
// コードブロックの開き・閉じの行
const FENCE_RE = /^\s*(`{3,}|~{3,})/;

/** `:` と `,` の後ろに空白を 1 つ置いた 1 行の JSON */
const spacedJson = (value) =>
  JSON.stringify(value).replace(
    /("(?:[^"\\]|\\.)*")|([:,])/g,
    (_match, text, mark) => text ?? `${mark} `,
  );

/** マーカー 1 つの引数から廃止したキーを削除した書き方（書き換えないときは `undefined`） */
const rewriteMark = (json) => {
  let value;
  try {
    value = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (
    !isRecord(value) ||
    !RETIRED_KEYS.some((key) => Object.hasOwn(value, key))
  ) {
    return undefined;
  }
  const kept = Object.fromEntries(
    Object.entries(value).filter(([key]) => !RETIRED_KEYS.includes(key)),
  );
  return Object.keys(kept).length === 0
    ? "<!-- map -->"
    : `<!-- map: ${spacedJson(kept)} -->`;
};

/** 行内のコードの外の部分だけを書き換える */
const rewriteOutsideInlineCode = (line) =>
  line
    .split(/(`+[^`]*`+)/)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(MAP_MARK_RE, (mark, json) => rewriteMark(json) ?? mark),
    )
    .join("");

/** 文書の本文の map のマーカーから `RETIRED_KEYS` のキーを削除した本文を返却する */
export const removeRetiredMapOptions = (markdown) => {
  const lines = markdown.split("\n");
  let fence;
  const rewritten = lines.map((line) => {
    const opened = FENCE_RE.exec(line);
    if (fence !== undefined) {
      if (
        opened &&
        opened[1][0] === fence[0] &&
        opened[1].length >= fence.length
      ) {
        fence = undefined;
      }
      return line;
    }
    if (opened) {
      fence = opened[1];
      return line;
    }
    return rewriteOutsideInlineCode(line);
  });
  const result = rewritten.join("\n");
  return { markdown: result, changed: result !== markdown };
};

/** 設定の文書（`build` の対象と索引の文書）の map のマーカーから廃止した引数を削除し、変わった文書だけを書き込む */
export const migrateRetiredMapOptions = async (options) => {
  const { config, configDir } = options;
  const settings = isRecord(config) ? config : {};
  const problems = [];
  const paths = [
    ...new Set([
      ...(await buildDocuments(settings, configDir)),
      ...(await indexDocuments(settings, configDir, problems)),
    ]),
  ].sort();
  const documents = [];
  for (const path of paths) {
    try {
      documents.push({
        path,
        markdown: await readFile(resolve(configDir, path), "utf8"),
      });
    } catch {
      problems.push(
        `${path} を読み込めません。ファイルがあるか確かめてください。`,
      );
    }
  }
  if (problems.length > 0) {
    return { changed: [], problems };
  }
  const changed = [];
  for (const { path, markdown } of documents) {
    const result = removeRetiredMapOptions(markdown);
    if (result.changed) {
      await writeFile(resolve(configDir, path), result.markdown);
      changed.push(path);
    }
  }
  return { changed, problems };
};

/** スクリプトとして呼ばれたとき、`--config` の設定の文書の map のマーカーから廃止した引数を削除する */
const main = async () => {
  const configPath = resolve(argv[argv.indexOf("--config") + 1]);
  const result = await migrateRetiredMapOptions({
    config: parse(await readFile(configPath, "utf8")),
    configPath,
    configDir: dirname(configPath),
  });
  if (result.problems.length > 0) {
    stderr.write(`${result.problems.join("\n")}\n`);
    exit(1);
  }
  stdout.write(
    `${result.changed.length} 件の文書の map のマーカーから play・interval を削除しました。\n`,
  );
};

if (
  argv[1] !== undefined &&
  resolve(argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
