import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { build } from "esbuild";
import { bundleModule } from "../bundle-module.ts";
import { COLOR_THEMES, DEFAULT_COLOR_THEME, resolveConfig } from "../config.ts";
import { type MdmarkIndex, normalizeIndex } from "../knowledge/index-shape.ts";
import { normalizePath } from "../knowledge/paths.ts";
import {
  collectReferences,
  type MdmarkReferences,
} from "../knowledge/references.ts";
import { usedLibraryMarks } from "../render/used.ts";
import { loadAliases } from "./aliases.ts";
import { copyMedia } from "./assets.ts";
import { collectMarkNames } from "./check.ts";
import { type LoadedConfig, requireConfig } from "./config.ts";
import { documentTitle, readIndexWithDocuments } from "./documents.ts";
import {
  bundleViewer,
  cacheFetchText,
  compileHtmlScripts,
  createViewerEntry,
  type FetchText,
  hasDynamicImport,
  inlineImages,
  usedParts,
  usedSyntaxLanguages,
  usesMap,
  usesMermaid,
  type ViewerEmbeds,
} from "./embed.ts";
import { CliError, type CliIo } from "./errors.ts";
import { assembleHtml, type ExportPayload } from "./html.ts";
import { collectIconNodes } from "./icons.ts";
import { collectIncludes, includeProblemMessage } from "./includes.ts";
import { formatCheckIssue } from "./issues.ts";
import { hideMarkdown, hideNames } from "./traces.ts";

/** 索引に追加する、用語集の文書の `id` の頭 */
const GLOSSARY_ID_PREFIX = "mdmark-glossary-";

/** OS の区切りを `/` にそろえる */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** 失敗の理由を 1 行の文字にする */
function reasonOf(error: unknown): string {
  return (
    (error instanceof Error ? error.message : String(error)).split("\n")[0] ??
    ""
  );
}

/** 画像を埋めた文書、まとめた外部ライブラリと拡張、読み込んだ利用側の CSS を持つ書き出しの中身を用意するための入力 */
type EmbedOptions = {
  /** 読み込んだ設定 */
  loaded: LoadedConfig;
  /** 埋める文書のパス（設定ファイルのフォルダからの相対パス）と絶対パス */
  docs: Array<{ path: string; file: string }>;
  /** `export` は `document`、`build` は `bundle` */
  kind: "document" | "bundle";
  /** 最初に開く文書のパス */
  entry: string;
  /** 出力の HTML の絶対パス（動画と音声のコピー先を決める） */
  out: string;
  /** URL を読み込む関数（`bundleViewer` と共有する `cacheFetchText` の関数） */
  fetchText: FetchText;
  /** 埋め込みの Markdown の mdmark の名前とマーカーでないコメントを隠すか */
  hideTraces?: boolean | undefined;
};

/** URL の先頭 */
const URL_PATTERN = /^https?:\/\//;

/** まとめる読み込み先: URL はそのまま、パスは設定ファイルのあるフォルダを基準にした絶対パス */
function moduleSource(path: string, baseDir: string): string {
  return URL_PATTERN.test(path) ? path : resolve(baseDir, path);
}

/** `build.glossary` の文書を、参照の表に指定する文書に追加する（索引に無い文書は、索引の文書として追加する） */
function addGlossaryDocs(
  options: EmbedOptions & { markdowns: Map<string, string> },
  target: {
    referenceDocs: MdmarkIndex["docs"];
    documents: Record<string, string>;
    indexPathOf: (path: string) => string;
  },
): void {
  const { loaded, kind, markdowns } = options;
  const { referenceDocs, documents, indexPathOf } = target;
  const glossaryPaths =
    kind === "bundle" ? (loaded.config.build?.glossary ?? []) : [];
  const prefix = options.hideTraces
    ? hideNames(GLOSSARY_ID_PREFIX)
    : GLOSSARY_ID_PREFIX;
  glossaryPaths.forEach((glossaryPath, position) => {
    const path = normalizePath(glossaryPath);
    const markdown = markdowns.get(path);
    if (markdown === undefined) {
      return;
    }
    const key = indexPathOf(path);
    documents[key] = markdown;
    if (!referenceDocs.some((doc) => normalizePath(doc.path) === key)) {
      referenceDocs.push({
        id: `${prefix}${position}`,
        path: key,
        title: documentTitle({ path, markdown }),
      });
    }
  });
}

/** 索引と参照の表を用意する: 索引があれば読み込み、`bundle` では `build.glossary` の文書を追加して参照の表を作る */
async function prepareReferences(
  options: EmbedOptions & { markdowns: Map<string, string> },
): Promise<{
  index: MdmarkIndex | undefined;
  references: MdmarkReferences | undefined;
  docIdOf: (path: string) => string | undefined;
  titleOf: (path: string) => string | undefined;
}> {
  const { loaded } = options;
  const info = await readIndexWithDocuments(loaded);
  const index = info ? normalizeIndex(info.raw).index : undefined;
  // 索引の文書のパスは、索引のファイルのあるフォルダからの相対パス
  const baseDir = info ? info.indexDir : loaded.dir;
  const indexPathOf = (path: string): string =>
    toPosix(relative(baseDir, join(loaded.dir, path)));
  const byPath = (path: string) =>
    index?.docs.find((doc) => normalizePath(doc.path) === indexPathOf(path));

  // 参照の表に指定する索引と文書: 索引が無くても `build.glossary` の用語集の表を全ての文書で有効にしるため、追加する
  const referenceDocs = [...(index?.docs ?? [])];
  const documents: Record<string, string> = { ...info?.documents };
  addGlossaryDocs(options, { referenceDocs, documents, indexPathOf });
  const references =
    referenceDocs.length === 0
      ? undefined
      : collectReferences({
          index: { schema: 2, docs: referenceDocs, terms: index?.terms ?? [] },
          documents,
          config: { features: loaded.config.features ?? {} },
        });
  return {
    index,
    references,
    docIdOf: (path) => byPath(path)?.id,
    titleOf: (path) => byPath(path)?.title,
  };
}

/** 色分けのライブラリの本体と、文書が使用する言語のモジュールを `syntax.url` からまとめられるか確認し、読み込み先を返却する。使用する言語が無い、または本体をまとめられないときは `undefined`（まとめられなければ警告に追加する）。言語のモジュールだけまとめられなければ、その言語を入れずに警告に追加する */
async function bundleSyntax(options: {
  languages: string[];
  url: string;
  loaded: LoadedConfig;
  warnings: string[];
  fetchText: FetchText;
}): Promise<ViewerEmbeds["syntax"]> {
  const { languages, url, loaded, warnings, fetchText } = options;
  if (languages.length === 0) {
    return undefined;
  }
  const folder = url.endsWith("/") ? url : `${url}/`;
  const bundle = async (path: string): Promise<string | undefined> => {
    const result = await bundleModule(`${folder}${path}`, loaded.dir, {
      fetchText,
      build,
    });
    if ("code" in result) {
      return moduleSource(`${folder}${path}`, loaded.dir);
    }
    warnings.push(
      `${basename(loaded.path)}: 色分けのライブラリ \`${folder}${path}\` をまとめられません（${result.error}）。\`syntax.url\` を修正してください。`,
    );
    return undefined;
  };
  const core = await bundle("core.min.js");
  if (core === undefined) {
    return undefined;
  }
  const bundled: Record<string, string> = {};
  for (const language of languages) {
    const source = await bundle(`languages/${language}.min.js`);
    if (source !== undefined) {
      bundled[language] = source;
    }
  }
  return { core, languages: bundled };
}

/** 設定の `assets.root` を設定ファイルのフォルダから解決する。フォルダが無ければ警告にして `undefined` を返却する */
async function resolveAssetsRoot(
  loaded: LoadedConfig,
  warnings: string[],
): Promise<string | undefined> {
  const root = loaded.config.assets?.root;
  if (root === undefined) {
    return undefined;
  }
  const dir = resolve(loaded.dir, root);
  try {
    if ((await stat(dir)).isDirectory()) {
      return dir;
    }
  } catch {
    // 無いときは警告にする
  }
  warnings.push(
    `${basename(loaded.path)}: \`assets.root\` のフォルダ \`${root}\` がありません。文書のフォルダだけで探します。`,
  );
  return undefined;
}

/** 文書を読み込み、動画と音声をコピーしてから画像を埋める（`bundle` は同じ画像を 1 回だけ埋める） */
async function readDocuments(
  options: EmbedOptions & {
    assetsRoot: string | undefined;
    warnings: string[];
  },
): Promise<{
  originals: Map<string, string>;
  inlined: Map<string, string>;
  assets: Map<string, { key: string; url: string }> | undefined;
}> {
  const { loaded, docs, kind, out, assetsRoot, warnings } = options;
  const originals = new Map<string, string>();
  const inlined = new Map<string, string>();
  const copied = new Map<string, string>();
  const assets =
    kind === "bundle"
      ? new Map<string, { key: string; url: string }>()
      : undefined;
  for (const doc of docs) {
    const original = await readFile(doc.file, "utf8");
    const media = await copyMedia({
      markdown: original,
      docFile: doc.file,
      assetsRoot,
      baseDir: loaded.dir,
      out,
      copied,
    });
    const result = await inlineImages(media.markdown, doc.file, {
      assetsRoot,
      ...(assets ? { assets } : {}),
    });
    originals.set(doc.path, original);
    inlined.set(doc.path, result.markdown);
    warnings.push(
      ...[...media.warnings, ...result.warnings].map(
        (text) => `${doc.path}: ${text}`,
      ),
    );
  }
  return { originals, inlined, assets };
}

/** 文書の include のマーカーの取り込み先を読み込む（設定ファイルのフォルダの中だけ。同じファイルの本文は 1 回だけ埋める） */
async function readIncludes(options: {
  loaded: LoadedConfig;
  docs: EmbedOptions["docs"];
  originals: Map<string, string>;
  warnings: string[];
}): Promise<{
  includeTexts: Record<string, string>;
  includeKeys: Map<string, Record<string, string>>;
}> {
  const { loaded, docs, originals, warnings } = options;
  const includeTexts: Record<string, string> = {};
  const includeKeys = new Map<string, Record<string, string>>();
  /** 文書のフォルダからのパスを、設定ファイルのフォルダからのパスにする */
  const fromConfig = (docFile: string, path: string): string =>
    toPosix(relative(loaded.dir, resolve(dirname(docFile), path)));
  for (const doc of docs) {
    const result = await collectIncludes({
      docPath: doc.file,
      markdown: originals.get(doc.path) ?? "",
      root: loaded.dir,
    });
    const keys: Record<string, string> = {};
    for (const [key, text] of Object.entries(result.includes)) {
      const path = fromConfig(doc.file, key);
      keys[key] = path;
      includeTexts[path] = text;
    }
    includeKeys.set(doc.path, keys);
    for (const problem of result.problems) {
      const file =
        problem.file === "" ? doc.path : fromConfig(doc.file, problem.file);
      warnings.push(
        `${file}:${problem.line}: ${includeProblemMessage(problem)}`,
      );
    }
  }
  return { includeTexts, includeKeys };
}

/** 文書にマーカーのある外部ライブラリを、URL ごとに 1 回だけまとめてみて、まとめられたマーカーの読み込み先を返却する */
async function bundleLibraries(options: {
  loaded: LoadedConfig;
  urls: Record<string, string>;
  markdowns: string[];
  fetchText: FetchText;
  warnings: string[];
}): Promise<Record<string, string>> {
  const { loaded, urls, markdowns, fetchText, warnings } = options;
  const configName = basename(loaded.path);
  const bundled = new Map<string, ReturnType<typeof bundleModule>>();
  const modules: Record<string, string> = {};
  for (const mark of usedLibraryMarks(markdowns, urls)) {
    const url = urls[mark] ?? "";
    let pending = bundled.get(url);
    if (!pending) {
      pending = bundleModule(url, loaded.dir, { fetchText, build });
      bundled.set(url, pending);
    }
    const result = await pending;
    if (!("code" in result)) {
      warnings.push(
        `${configName}: 外部ライブラリ \`${mark}\` をまとめられません（${result.error}）。URL かパスを修正してください。`,
      );
      continue;
    }
    modules[mark] = moduleSource(url, loaded.dir);
    if (hasDynamicImport(result.code)) {
      warnings.push(
        dynamicImportWarning(configName, `外部ライブラリ \`${mark}\``),
      );
    }
  }
  return modules;
}

/** 設定の拡張を 1 つずつまとめてみて、まとめられた拡張の読み込み先を返却する */
async function bundleExtensions(options: {
  loaded: LoadedConfig;
  fetchText: FetchText;
  warnings: string[];
}): Promise<string[]> {
  const { loaded, fetchText, warnings } = options;
  const configName = basename(loaded.path);
  const extensions: string[] = [];
  for (const path of loaded.config.extensions ?? []) {
    const result = await bundleModule(path, loaded.dir, { fetchText, build });
    if (!("code" in result)) {
      warnings.push(
        `${configName}: 拡張 \`${path}\` をまとめられません（${result.error}）。パスを修正してください。`,
      );
      continue;
    }
    extensions.push(moduleSource(path, loaded.dir));
    if (hasDynamicImport(result.code)) {
      warnings.push(dynamicImportWarning(configName, `拡張 \`${path}\``));
    }
  }
  return extensions;
}

/** 利用側の CSS を読み込む（設定に無ければ `undefined`。読み込めなければ警告にして `undefined`） */
async function readThemeCss(
  loaded: LoadedConfig,
  warnings: string[],
): Promise<string | undefined> {
  const theme = loaded.config.theme;
  if (theme === undefined) {
    return undefined;
  }
  try {
    return await readFile(resolve(loaded.dir, theme), "utf8");
  } catch (error) {
    warnings.push(
      `${basename(loaded.path)}: 利用側の CSS \`${theme}\` を読み込めません（${reasonOf(error)}）。パスを修正してください。`,
    );
    return undefined;
  }
}

/** 文書に mermaid のコードブロックがあれば、mermaid をまとめてみて読み込み先を返却する（まとめられなければ警告にして `undefined`） */
async function bundleMermaid(options: {
  loaded: LoadedConfig;
  used: boolean;
  fetchText: FetchText;
  warnings: string[];
}): Promise<string | undefined> {
  const { loaded, used, fetchText, warnings } = options;
  if (!used) {
    return undefined;
  }
  const { url } = resolveConfig({ config: loaded.config }).mermaid;
  const result = await bundleModule(url, loaded.dir, { fetchText, build });
  if ("code" in result) {
    return moduleSource(url, loaded.dir);
  }
  warnings.push(
    `${basename(loaded.path)}: mermaid \`${url}\` をまとめられません（${result.error}）。\`mermaid.url\` を修正してください。`,
  );
  return undefined;
}

/** 知らないテーマの名前の警告。知らない名前は埋める設定にもコピーし、開いたときに `mount` が既定のテーマで描く */
function colorThemeWarnings(loaded: LoadedConfig): string[] {
  const colorTheme = loaded.config.colorTheme;
  return colorTheme === undefined || COLOR_THEMES.some((t) => t === colorTheme)
    ? []
    : [
        `${basename(loaded.path)}: 不明なテーマ名 ${colorTheme} です。既定の ${DEFAULT_COLOR_THEME} で描画します。`,
      ];
}

/** 埋める設定。mermaid の url は除いて写し（開いたときに外へ要求しない）、外部ライブラリの値はマーカーの名前にする（埋めたモジュールは開いたときにまとめたモジュールを指定するため、埋められなかったマーカーが外へ要求しない） */
function payloadConfig(
  config: LoadedConfig["config"],
  libraryNames: string[],
): ExportPayload["config"] {
  const { url: _mermaidUrl, ...mermaid } = config.mermaid ?? {};
  const picked = {
    features: config.features,
    tooltips: config.tooltips,
    "side-toc": config["side-toc"],
    table: config.table,
    colorTheme: config.colorTheme,
    colorScheme: config.colorScheme,
    labels: config.labels,
    map: config.map,
    mermaid: Object.keys(mermaid).length > 0 ? mermaid : undefined,
  };
  return {
    ...Object.fromEntries(
      Object.entries(picked).filter(([, value]) => value !== undefined),
    ),
    libraries: Object.fromEntries(libraryNames.map((name) => [name, name])),
  } as ExportPayload["config"];
}

/** 値を持つときだけ、キーと値の組（空のオブジェクトは持たないものとする） */
function whenFilled<K extends string, V extends object>(
  key: K,
  value: V | undefined,
): Partial<Record<K, V>> {
  return value !== undefined && Object.keys(value).length > 0
    ? ({ [key]: value } as Record<K, V>)
    : {};
}

/** 隠すときは埋め込みの Markdown を隠す関数（隠さないときは何もしない関数） */
async function markdownHider(
  options: EmbedOptions,
): Promise<((markdown: string) => string) | undefined> {
  if (!options.hideTraces) {
    return undefined;
  }
  const markNames = await collectMarkNames(options.loaded);
  return (markdown) => hideMarkdown({ markdown, markNames });
}

/** 埋める中身の文書と取り込む文書の Markdown を隠す */
function hidePayloadText(
  shown: ExportPayload,
  hideText: (markdown: string) => string,
): ExportPayload {
  return {
    ...shown,
    docs: shown.docs.map((doc) => ({
      ...doc,
      markdown: hideText(doc.markdown),
    })),
    ...whenFilled(
      "includes",
      shown.includes &&
        Object.fromEntries(
          Object.entries(shown.includes).map(([key, text]) => [
            key,
            hideText(text),
          ]),
        ),
    ),
  };
}

/** 文書の画像を埋め、マーカーのある外部ライブラリと設定の拡張と色分けのモジュールがまとめられることを確認して読み込み先を集め、`theme` を読み込み、索引があれば参照の表を作って、書き出しの中身と警告を返却する */
export async function prepareEmbeds(options: EmbedOptions): Promise<{
  payload: ExportPayload;
  embeds: ViewerEmbeds;
  themeCss?: string | undefined;
  warnings: string[];
}> {
  const { loaded, docs, kind, entry, fetchText } = options;
  const warnings: string[] = [];
  const assetsRoot = await resolveAssetsRoot(loaded, warnings);
  const { originals, inlined, assets } = await readDocuments({
    ...options,
    assetsRoot,
    warnings,
  });
  const markdowns = [...originals.values()];
  const { includeTexts, includeKeys } = await readIncludes({
    loaded,
    docs,
    originals,
    warnings,
  });
  // 文書と取り込む文書のまとめていない名前のアイコンの形状を、依存の lucide から取り出す
  const iconResult = collectIconNodes([
    ...markdowns,
    ...Object.values(includeTexts),
  ]);
  for (const name of iconResult.missing) {
    warnings.push(
      `\`icon:${name}\` の \`${name}\` は Lucide に無いアイコンの名前です。https://lucide.dev/icons/ で名前を確認してください。`,
    );
  }
  const resolved = resolveConfig({ config: loaded.config });
  const libraries = Object.fromEntries(
    Object.entries(resolved.libraries).map(([name, library]) => [
      name,
      library.url,
    ]),
  );
  const modules = await bundleLibraries({
    loaded,
    urls: libraries,
    markdowns,
    fetchText,
    warnings,
  });
  const extensions = await bundleExtensions({ loaded, fetchText, warnings });
  const themeCss = await readThemeCss(loaded, warnings);

  /** 文書のフォルダからのパスをキーにした、文書の取り込む文書の表 */
  const includesOf = (path: string): Record<string, string> =>
    Object.fromEntries(
      Object.entries(includeKeys.get(path) ?? {}).map(([key, file]) => [
        key,
        includeTexts[file] ?? "",
      ]),
    );
  const used = {
    markdowns,
    includes: docs.map((doc) => includesOf(doc.path)),
    config: loaded.config,
  };
  // 文書に色分けの対象があれば、色分けの本体と使用する言語のモジュールをまとめてみる
  const syntax = await bundleSyntax({
    languages: usedSyntaxLanguages(used),
    url: resolved.syntax.url,
    loaded,
    warnings,
    fetchText,
  });
  const mermaid = await bundleMermaid({
    loaded,
    used: usesMermaid(used),
    fetchText,
    warnings,
  });

  // 設定の `aliases` の YAML を読み込み、使用できない行・レコードを警告にする
  const aliasResult = await loadAliases(loaded);
  warnings.push(...aliasResult.issues.map(formatCheckIssue));

  warnings.push(...colorThemeWarnings(loaded));

  const refs = await prepareReferences({ ...options, markdowns: originals });
  const shown: ExportPayload = {
    kind,
    config: payloadConfig(loaded.config, Object.keys(libraries)),
    index: refs.index,
    references: refs.references,
    docs: docs.map((doc) => {
      const markdown = inlined.get(doc.path) ?? "";
      return {
        path: doc.path,
        title: documentTitle({
          path: doc.path,
          markdown,
          indexTitle: refs.titleOf(doc.path),
        }),
        markdown,
        docId: refs.docIdOf(doc.path),
        ...whenFilled("includes", includeKeys.get(doc.path)),
      };
    }),
    ...whenFilled("includes", includeTexts),
    ...whenFilled("icons", iconResult.icons),
    entry,
    ...(aliasResult.aliases ? { aliases: aliasResult.aliases } : {}),
    ...(assets
      ? {
          assets: Object.fromEntries(
            [...assets.values()].map((asset) => [asset.key, asset.url]),
          ),
        }
      : {}),
  };
  // 隠すときは埋め込みの Markdown を隠し、範囲のスクリプトの鍵も隠した Markdown から取り出す
  const hider = await markdownHider(options);
  const hideText = hider ?? ((markdown: string): string => markdown);
  const payload = hider ? hidePayloadText(shown, hider) : shown;
  // `html-scripts` がオンの文書の範囲の `ts`・`js` を、開いたときに変換のライブラリを読み込まずに動かせるよう変えておく
  const compiled = await compileHtmlScripts({
    documents: [...originals.entries()].map(([path, markdown]) => ({
      path,
      markdown: hideText(markdown),
    })),
    config: loaded.config,
  });
  warnings.push(...compiled.warnings);
  const embeds: ViewerEmbeds = {
    libraries: modules,
    extensions,
    ...(syntax ? { syntax } : {}),
    ...(mermaid ? { mermaid } : {}),
    view: usedParts({ markdowns }),
    map: usesMap({ markdowns, config: loaded.config }),
    ...(compiled.scripts.length > 0 ? { htmlScripts: compiled.scripts } : {}),
  };
  return { payload, embeds, themeCss, warnings };
}

/** まとめた後も動的 `import()` が残る外部ライブラリ・拡張の警告 */
function dynamicImportWarning(configName: string, what: string): string {
  return `${configName}: ${what} はまとめた後も動的 import() が残り、blob: と動的 import を許さない環境では読み込めません。読み込む先をリテラルの文字列にしてください。`;
}

/** 配布物の CSS を読み込み、起動の処理（`dist/viewer.js`）・ビューの部品のモジュール（`dist/view.js`）があることを確認して絶対パスを返却する。`bundle` では画面の規則（`viewer.css`）を CSS の後ろに追加する */
export async function readDistAssets(options: {
  /** `dist/` の場所 */
  distDir: string;
  /** 書き出しの種類 */
  kind: "document" | "bundle";
}): Promise<{ distCss: string; viewer: string; view: string; map: string }> {
  const { distDir, kind } = options;
  let distCss: string;
  const viewer = resolve(distDir, "viewer.js");
  const view = resolve(distDir, "view.js");
  const map = resolve(distDir, "map.js");
  try {
    distCss = await readFile(join(distDir, "index.css"), "utf8");
    await stat(viewer);
    await stat(view);
  } catch (error) {
    throw new CliError(
      `配布物を読み込めません（${reasonOf(error)}）。mdmark をもう一度入れてください。`,
    );
  }
  if (kind === "bundle") {
    try {
      distCss += `\n${await readFile(join(distDir, "viewer.css"), "utf8")}`;
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        throw error;
      }
    }
  }
  return { distCss, viewer, view, map };
}

/** HTML を書き込む。親のフォルダが無ければ作り、書き込めなければ書き込めなかったパスを示す誤りを投げる */
export async function writeHtml(options: {
  /** 記載する先の絶対パス */
  file: string;
  /** 利用者に見せる記載する先のパス */
  display: string;
  /** HTML */
  html: string;
}): Promise<void> {
  const { file, display, html } = options;
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
  } catch (error) {
    throw new CliError(
      `書き込めない: ${display} に書き込めません（${reasonOf(error)}）。出力先のフォルダを確認してください。`,
    );
  }
}

/** 文書 1 つを `kind: document` の中身にして HTML を書き込み、書き込んだ絶対パス・利用者に見せるパス・警告を返却する。標準出力・標準エラーには書き込まない */
export async function exportDocument(options: {
  /** 今のフォルダ */
  cwd: string;
  /** 書き出す Markdown のパス */
  file: string;
  /** 書き出す HTML のパス */
  out?: string | undefined;
  /** 使用する設定ファイルのパス */
  config?: string | undefined;
  /** `dist/` の場所 */
  distDir: string;
  /** 開発のときに mdmark の名前・HTML のコメント・バージョンを残すか */
  keepTraces?: boolean | undefined;
}): Promise<{ out: string; display: string; warnings: string[] }> {
  const { cwd } = options;
  const loaded = await requireConfig(cwd, options.config);
  const docFile = resolve(cwd, options.file);
  try {
    await readFile(docFile);
  } catch {
    throw new CliError(
      `文書が無い: ${options.file} が見つかりません。文書のパスを修正してください。`,
    );
  }
  const path = normalizePath(toPosix(relative(loaded.dir, docFile)));
  const outFile = options.out
    ? resolve(cwd, options.out)
    : join(dirname(docFile), `${basename(docFile, extname(docFile))}.html`);
  const display = options.out ?? toPosix(relative(cwd, outFile));
  const fetchText = cacheFetchText();
  const hide = options.keepTraces !== true;
  const { payload, embeds, themeCss, warnings } = await prepareEmbeds({
    loaded,
    docs: [{ path, file: docFile }],
    kind: "document",
    entry: path,
    out: outFile,
    fetchText,
    hideTraces: hide,
  });
  const { distCss, viewer, view, map } = await readDistAssets({
    distDir: options.distDir,
    kind: "document",
  });
  const script = await bundleViewer({
    entry: createViewerEntry({ viewer, view, map, embeds, hideTraces: hide }),
    baseDir: loaded.dir,
    fetchText,
    ...(hide
      ? {
          hideTraces: {
            keys: (embeds.htmlScripts ?? []).map(({ source }) => source),
          },
        }
      : {}),
  });
  await writeHtml({
    file: outFile,
    display,
    html: assembleHtml({
      payload,
      distCss,
      themeCss,
      script,
      hideTraces: hide,
    }),
  });
  return { out: outFile, display, warnings };
}

/** 文書 1 つを HTML に書き出し、警告と `書き出した: {出力}` を出す */
export async function runExport(
  options: {
    /** 書き出す Markdown のパス */
    file: string;
    /** 書き出す HTML のパス */
    out?: string | undefined;
    /** 使用する設定ファイルのパス */
    config?: string | undefined;
    /** `dist/` の場所 */
    distDir: string;
    /** 開発のときに mdmark の名前・HTML のコメント・バージョンを残すか */
    keepTraces?: boolean | undefined;
  },
  io: CliIo,
): Promise<0> {
  const { display, warnings } = await exportDocument({
    cwd: io.cwd,
    ...options,
  });
  for (const warning of warnings) {
    io.stderr(`警告: ${warning}`);
  }
  io.stdout(`書き出した: ${display}`);
  return 0;
}
