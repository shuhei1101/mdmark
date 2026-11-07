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
  type ViewerEmbeds,
} from "./embed.ts";
import { CliError, type CliIo } from "./errors.ts";
import { assembleHtml, type ExportPayload } from "./html.ts";
import { collectIconNodes } from "./icons.ts";
import { collectIncludes, includeProblemMessage } from "./includes.ts";
import { formatCheckIssue } from "./issues.ts";

/** 索引に足す、用語集の文書の `id` の頭 */
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

/** 画像を埋めた文書、束ねた外部ライブラリと拡張、読んだ使う側の CSS を持つ書き出しの中身を用意するための入力 */
type EmbedOptions = {
  /** 読んだ設定 */
  loaded: LoadedConfig;
  /** 埋める文書のパス（設定ファイルのフォルダからの相対パス）と絶対パス */
  docs: Array<{ path: string; file: string }>;
  /** `export` は `document`、`build` は `bundle` */
  kind: "document" | "bundle";
  /** 最初に開く文書のパス */
  entry: string;
  /** 出力の HTML の絶対パス（動画と音声のコピー先を決める） */
  out: string;
  /** URL を読む関数（`bundleViewer` と共有する `cacheFetchText` の関数） */
  fetchText: FetchText;
};

/** URL の先頭 */
const URL_PATTERN = /^https?:\/\//;

/** 束ねる読み先: URL はそのまま、パスは設定ファイルのあるフォルダを基準にした絶対パス */
function moduleSource(path: string, baseDir: string): string {
  return URL_PATTERN.test(path) ? path : resolve(baseDir, path);
}

/** 索引と参照の表を用意する: 索引があれば読み、`bundle` では `build.glossary` の文書を足して参照の表を作る */
async function prepareReferences(
  options: EmbedOptions & { markdowns: Map<string, string> },
): Promise<{
  index: MdmarkIndex | undefined;
  references: MdmarkReferences | undefined;
  docIdOf: (path: string) => string | undefined;
  titleOf: (path: string) => string | undefined;
}> {
  const { loaded, kind, markdowns } = options;
  const info = await readIndexWithDocuments(loaded);
  const index = info ? normalizeIndex(info.raw).index : undefined;
  // 索引の文書のパスは、索引のファイルのあるフォルダからの相対パス
  const baseDir = info ? info.indexDir : loaded.dir;
  const indexPathOf = (path: string): string =>
    toPosix(relative(baseDir, join(loaded.dir, path)));
  const byPath = (path: string) =>
    index?.docs.find((doc) => normalizePath(doc.path) === indexPathOf(path));

  // 参照の表に渡す索引と文書: 索引が無くても `build.glossary` の用語集の表を全ての文書で効かせるため、足す
  const glossaryPaths =
    kind === "bundle" ? (loaded.config.build?.glossary ?? []) : [];
  const referenceDocs = [...(index?.docs ?? [])];
  const documents: Record<string, string> = { ...info?.documents };
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
        id: `${GLOSSARY_ID_PREFIX}${position}`,
        path: key,
        title: documentTitle({ path, markdown }),
      });
    }
  });
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

/** 色分けのライブラリの本体と、文書が使う言語のモジュールを `syntax.url` から束ねられるか確かめ、読み先を返す。使う言語が無い、または本体を束ねられないときは `undefined`（束ねられなければ警告に積む）。言語のモジュールだけ束ねられなければ、その言語を入れずに警告に積む */
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
    const result = await bundleModule(
      `${folder}${path}`,
      loaded.dir,
      fetchText,
      build,
    );
    if ("code" in result) {
      return moduleSource(`${folder}${path}`, loaded.dir);
    }
    warnings.push(
      `${basename(loaded.path)}: 色分けのライブラリ \`${folder}${path}\` を束ねられません（${result.error}）。\`syntax.url\` を直してください。`,
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

/** 設定の `assets.root` を設定ファイルのフォルダから解決する。フォルダが無ければ警告にして `undefined` を返す */
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

/** 文書の画像を埋め、印のある外部ライブラリと設定の拡張と色分けのモジュールが束ねられることを確かめて読み先を集め、`theme` を読み、索引があれば参照の表を作って、書き出しの中身と警告を返す */
export async function prepareEmbeds(options: EmbedOptions): Promise<{
  payload: ExportPayload;
  embeds: ViewerEmbeds;
  themeCss?: string | undefined;
  warnings: string[];
}> {
  const { loaded, docs, kind, entry, out, fetchText } = options;
  const warnings: string[] = [];
  const configName = basename(loaded.path);
  const assetsRoot = await resolveAssetsRoot(loaded, warnings);

  // 文書を読み、動画と音声をコピーしてから画像を埋める（`bundle` は同じ画像を 1 回だけ埋める）
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

  // 文書の include のマーカーの取り込み先を読む（設定ファイルのフォルダの中だけ。同じファイルの本文は 1 回だけ埋める）
  const includeTexts: Record<string, string> = {};
  const includeKeys = new Map<string, Record<string, string>>();
  for (const doc of docs) {
    const result = await collectIncludes({
      docPath: doc.file,
      markdown: originals.get(doc.path) ?? "",
      root: loaded.dir,
    });
    const keys: Record<string, string> = {};
    for (const [key, text] of Object.entries(result.includes)) {
      const path = toPosix(
        relative(loaded.dir, resolve(dirname(doc.file), key)),
      );
      keys[key] = path;
      includeTexts[path] = text;
    }
    includeKeys.set(doc.path, keys);
    for (const problem of result.problems) {
      const file =
        problem.file === ""
          ? doc.path
          : toPosix(
              relative(loaded.dir, resolve(dirname(doc.file), problem.file)),
            );
      warnings.push(
        `${file}:${problem.line}: ${includeProblemMessage(problem)}`,
      );
    }
  }
  // 文書と取り込む文書の束ねていない名前のアイコンの形を、依存の lucide から取り出す
  const iconResult = collectIconNodes([
    ...originals.values(),
    ...Object.values(includeTexts),
  ]);
  for (const name of iconResult.missing) {
    warnings.push(
      `\`icon:${name}\` の \`${name}\` は Lucide に無いアイコンの名前です。https://lucide.dev/icons/ で名前を確かめてください。`,
    );
  }

  // 文書に印のある外部ライブラリを、URL ごとに 1 回だけ束ねてみる
  const libraries = resolveConfig({ config: loaded.config }).libraries;
  const urls = Object.fromEntries(
    Object.entries(libraries).map(([name, library]) => [name, library.url]),
  );
  const marks = usedLibraryMarks([...originals.values()], urls);
  const bundled = new Map<string, ReturnType<typeof bundleModule>>();
  const modules: Record<string, string> = {};
  for (const mark of marks) {
    const url = urls[mark] ?? "";
    let pending = bundled.get(url);
    if (!pending) {
      pending = bundleModule(url, loaded.dir, fetchText, build);
      bundled.set(url, pending);
    }
    const result = await pending;
    if ("code" in result) {
      modules[mark] = moduleSource(url, loaded.dir);
      if (hasDynamicImport(result.code)) {
        warnings.push(
          dynamicImportWarning(configName, `外部ライブラリ \`${mark}\``),
        );
      }
    } else {
      warnings.push(
        `${configName}: 外部ライブラリ \`${mark}\` を束ねられません（${result.error}）。URL かパスを直してください。`,
      );
    }
  }

  // 設定の拡張を 1 つずつ束ねてみる
  const extensions: string[] = [];
  for (const path of loaded.config.extensions ?? []) {
    const result = await bundleModule(path, loaded.dir, fetchText, build);
    if ("code" in result) {
      extensions.push(moduleSource(path, loaded.dir));
      if (hasDynamicImport(result.code)) {
        warnings.push(dynamicImportWarning(configName, `拡張 \`${path}\``));
      }
    } else {
      warnings.push(
        `${configName}: 拡張 \`${path}\` を束ねられません（${result.error}）。パスを直してください。`,
      );
    }
  }

  // 使う側の CSS を読む
  let themeCss: string | undefined;
  const theme = loaded.config.theme;
  if (theme !== undefined) {
    try {
      themeCss = await readFile(resolve(loaded.dir, theme), "utf8");
    } catch (error) {
      warnings.push(
        `${configName}: 使う側の CSS \`${theme}\` を読めません（${reasonOf(error)}）。パスを直してください。`,
      );
    }
  }

  /** 文書のフォルダからのパスをキーにした、文書の取り込む文書の表 */
  const includesOf = (path: string): Record<string, string> =>
    Object.fromEntries(
      Object.entries(includeKeys.get(path) ?? {}).map(([key, file]) => [
        key,
        includeTexts[file] ?? "",
      ]),
    );

  // 文書に色分けの対象があれば、色分けの本体と使う言語のモジュールを束ねてみる
  const syntax = await bundleSyntax({
    languages: usedSyntaxLanguages({
      markdowns: [...originals.values()],
      includes: docs.map((doc) => includesOf(doc.path)),
      config: loaded.config,
    }),
    url: resolveConfig({ config: loaded.config }).syntax.url,
    loaded,
    warnings,
    fetchText,
  });

  // 設定の `aliases` の YAML を読み、使えない行・レコードを警告にする
  const aliasResult = await loadAliases(loaded);
  for (const issue of aliasResult.issues) {
    warnings.push(formatCheckIssue(issue));
  }

  // 知らないテーマの名前は埋める設定にも写し、開いたときに `mount` が既定のテーマで描く
  const colorTheme = loaded.config.colorTheme;
  if (colorTheme !== undefined && !COLOR_THEMES.some((t) => t === colorTheme)) {
    warnings.push(
      `${basename(loaded.path)}: 不明なテーマ名 ${colorTheme} です。既定の ${DEFAULT_COLOR_THEME} で描画します。`,
    );
  }

  const refs = await prepareReferences({ ...options, markdowns: originals });
  const payload: ExportPayload = {
    kind,
    config: {
      ...(loaded.config.features ? { features: loaded.config.features } : {}),
      ...(loaded.config.tooltips ? { tooltips: loaded.config.tooltips } : {}),
      ...(loaded.config["side-toc"]
        ? { "side-toc": loaded.config["side-toc"] }
        : {}),
      ...(colorTheme !== undefined ? { colorTheme } : {}),
      ...(loaded.config.colorScheme !== undefined
        ? { colorScheme: loaded.config.colorScheme }
        : {}),
      ...(loaded.config.labels ? { labels: loaded.config.labels } : {}),
      // 埋めたモジュールは開いたときに束ねたモジュールを渡すため、値は印の名前にする（埋められなかった印が外へ要求しない）
      libraries: Object.fromEntries(
        Object.keys(libraries).map((name) => [name, name]),
      ),
    },
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
        ...(Object.keys(includeKeys.get(doc.path) ?? {}).length > 0
          ? { includes: includeKeys.get(doc.path) }
          : {}),
      };
    }),
    ...(Object.keys(includeTexts).length > 0 ? { includes: includeTexts } : {}),
    ...(Object.keys(iconResult.icons).length > 0
      ? { icons: iconResult.icons }
      : {}),
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
  // `html-scripts` がオンの文書の範囲の `ts`・`js` を、開いたときに変換のライブラリを読まずに動かせるよう変えておく
  const compiled = await compileHtmlScripts({
    documents: [...originals.entries()].map(([path, markdown]) => ({
      path,
      markdown,
    })),
    config: loaded.config,
  });
  warnings.push(...compiled.warnings);
  const embeds: ViewerEmbeds = {
    libraries: modules,
    extensions,
    ...(syntax ? { syntax } : {}),
    view: usedParts({ markdowns: [...originals.values()] }),
    ...(compiled.scripts.length > 0 ? { htmlScripts: compiled.scripts } : {}),
  };
  return { payload, embeds, themeCss, warnings };
}

/** 束ねた後も動的 `import()` が残る外部ライブラリ・拡張の警告 */
function dynamicImportWarning(configName: string, what: string): string {
  return `${configName}: ${what} は束ねた後も動的 import() が残り、blob: と動的 import を許さない環境では読み込めません。読む先をリテラルの文字列にしてください。`;
}

/** 配布物の CSS を読み、起動の処理（`dist/viewer.js`）・ビューの部品のモジュール（`dist/view.js`）があることを確かめて絶対パスを返す。`bundle` では画面の規則（`viewer.css`）を CSS の後ろに足す */
export async function readDistAssets(options: {
  /** `dist/` の場所 */
  distDir: string;
  /** 書き出しの種類 */
  kind: "document" | "bundle";
}): Promise<{ distCss: string; viewer: string; view: string }> {
  const { distDir, kind } = options;
  let distCss: string;
  const viewer = resolve(distDir, "viewer.js");
  const view = resolve(distDir, "view.js");
  try {
    distCss = await readFile(join(distDir, "index.css"), "utf8");
    await stat(viewer);
    await stat(view);
  } catch (error) {
    throw new CliError(
      `配布物を読めません（${reasonOf(error)}）。mdmark を入れ直してください。`,
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
  return { distCss, viewer, view };
}

/** HTML を書く。親のフォルダが無ければ作り、書けなければ書けなかったパスを示す誤りを投げる */
export async function writeHtml(options: {
  /** 書く先の絶対パス */
  file: string;
  /** 利用者に見せる書く先のパス */
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
      `書けない: ${display} に書けません（${reasonOf(error)}）。出力先のフォルダを確かめてください。`,
    );
  }
}

/** 文書 1 つを `kind: document` の中身にして HTML を書き、書いた絶対パス・利用者に見せるパス・警告を返す。標準出力・標準エラーには書かない */
export async function exportDocument(options: {
  /** 今のフォルダ */
  cwd: string;
  /** 書き出す Markdown のパス */
  file: string;
  /** 書き出す HTML のパス */
  out?: string | undefined;
  /** 使う設定ファイルのパス */
  config?: string | undefined;
  /** `dist/` の場所 */
  distDir: string;
}): Promise<{ out: string; display: string; warnings: string[] }> {
  const { cwd } = options;
  const loaded = await requireConfig(cwd, options.config);
  const docFile = resolve(cwd, options.file);
  try {
    await readFile(docFile);
  } catch {
    throw new CliError(
      `文書が無い: ${options.file} が見つかりません。文書のパスを直してください。`,
    );
  }
  const path = normalizePath(toPosix(relative(loaded.dir, docFile)));
  const outFile = options.out
    ? resolve(cwd, options.out)
    : join(dirname(docFile), `${basename(docFile, extname(docFile))}.html`);
  const display = options.out ?? toPosix(relative(cwd, outFile));
  const fetchText = cacheFetchText();
  const { payload, embeds, themeCss, warnings } = await prepareEmbeds({
    loaded,
    docs: [{ path, file: docFile }],
    kind: "document",
    entry: path,
    out: outFile,
    fetchText,
  });
  const { distCss, viewer, view } = await readDistAssets({
    distDir: options.distDir,
    kind: "document",
  });
  const script = await bundleViewer({
    entry: createViewerEntry({ viewer, view, embeds }),
    baseDir: loaded.dir,
    fetchText,
  });
  await writeHtml({
    file: outFile,
    display,
    html: assembleHtml({ payload, distCss, themeCss, script }),
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
    /** 使う設定ファイルのパス */
    config?: string | undefined;
    /** `dist/` の場所 */
    distDir: string;
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
