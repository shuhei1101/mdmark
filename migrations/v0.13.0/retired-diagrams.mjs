// 文書の廃止した flow・sequence の範囲を map の範囲へ書き換え、使用していた種類を設定の map.kinds・map.lines へ書き足す移行の手順のスクリプト
import { glob, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { argv, exit, stderr, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse, parseDocument } from "yaml";

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

/** 設定の `map.kinds`・`map.lines` に同じ名前の行が無い種類を書き足す。書き足したら `true` */
const addKinds = (document, kinds, lines) => {
  let changed = false;
  for (const [group, values] of [
    ["kinds", kinds],
    ["lines", lines],
  ]) {
    for (const [name, value] of Object.entries(values)) {
      if (document.hasIn(["map", group, name])) {
        continue;
      }
      document.setIn(["map", group, name], document.createNode(value));
      changed = true;
    }
  }
  return changed;
};

/** 設定の文書（`build` の対象と索引の文書）の廃止した図の範囲を `convert` で書き換え、変わった文書だけを書き込み、使用していた種類を設定へ書き足して、移行の報告の行を返却する */
export const migrateRetiredDiagrams = async (options) => {
  const { config, configPath, configDir, directives, convert } = options;
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
    return { changed: [], configChanged: false, report: [], problems };
  }
  const skip = new Set(
    [...directives].filter((name) => name === "flow" || name === "sequence"),
  );
  const changed = [];
  const report = [];
  const kinds = {};
  const lines = {};
  for (const { path, markdown } of documents) {
    const result = convert({ markdown, skip });
    for (const line of result.report) {
      report.push(
        `${path}:${line.line}: ${line.name}: ${line.item}: ${line.reason}`,
      );
    }
    Object.assign(kinds, result.kinds);
    Object.assign(lines, result.lines);
    if (result.markdown !== markdown) {
      await writeFile(resolve(configDir, path), result.markdown);
      changed.push(path);
    }
  }
  const document = parseDocument(await readFile(configPath, "utf8"));
  const configChanged = addKinds(document, kinds, lines);
  if (configChanged) {
    await writeFile(
      configPath,
      document.toString({ flowCollectionPadding: false }),
    );
  }
  return { changed, configChanged, report, problems };
};

/** スクリプトとして呼ばれたとき、`--config` の設定の文書を、同じフォルダにまとめた書き換えの処理で書き換える */
const main = async () => {
  const configPath = resolve(argv[argv.indexOf("--config") + 1]);
  const { convertRetiredDiagrams, loadConfig, loadExtensionDirectives } =
    await import(
      pathToFileURL(
        resolve(dirname(fileURLToPath(import.meta.url)), "retired-diagrams.js"),
      ).href
    );
  const loaded = await loadConfig(configPath);
  const extensions = await loadExtensionDirectives(
    { path: loaded.path, dir: loaded.dir, config: loaded.raw ?? {} },
    configPath,
  );
  const result = await migrateRetiredDiagrams({
    config: loaded.raw,
    configPath,
    configDir: loaded.dir,
    directives: extensions.directives,
    convert: convertRetiredDiagrams,
  });
  if (result.problems.length > 0) {
    stderr.write(`${result.problems.join("\n")}\n`);
    exit(1);
  }
  stdout.write(
    result.report.length > 0
      ? `${result.report.join("\n")}\n`
      : `${result.changed.length} 件の文書の廃止した図を map の範囲へ書き換えました。\n`,
  );
};

if (
  argv[1] !== undefined &&
  resolve(argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
