import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { resolveConfig } from "../config.ts";
import { type MdmarkIndex, normalizeIndex } from "../knowledge/index-shape.ts";
import { normalizePath } from "../knowledge/paths.ts";
import {
  collectReferences,
  type MdmarkReferences,
} from "../knowledge/references.ts";
import { loadAliases } from "./aliases.ts";
import { type LoadedConfig, requireConfig } from "./config.ts";
import { documentTitle, readIndexWithDocuments } from "./documents.ts";
import {
  bundleModule,
  inlineImages,
  usedLibraryMarks,
  usedParts,
  usedSyntaxLanguages,
} from "./embed.ts";
import { CliError, type CliIo } from "./errors.ts";
import { assembleHtml, type ExportPayload } from "./html.ts";

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
};

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
          index: { schema: 1, docs: referenceDocs, terms: index?.terms ?? [] },
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

/** 色分けのライブラリの本体と、文書が使う言語のモジュールを `syntax.url` から束ねる。使う言語が無い、または本体を束ねられないときは `undefined`（束ねられなければ警告に積む）。言語のモジュールだけ束ねられなければ、その言語を入れずに警告に積む */
async function bundleSyntax(options: {
  languages: string[];
  url: string;
  loaded: LoadedConfig;
  warnings: string[];
}): Promise<ExportPayload["syntax"]> {
  const { languages, url, loaded, warnings } = options;
  if (languages.length === 0) {
    return undefined;
  }
  const folder = url.endsWith("/") ? url : `${url}/`;
  const bundle = async (path: string): Promise<string | undefined> => {
    const result = await bundleModule(`${folder}${path}`, loaded.dir);
    if ("code" in result) {
      return result.code;
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
    const code = await bundle(`languages/${language}.min.js`);
    if (code !== undefined) {
      bundled[language] = code;
    }
  }
  return { core, languages: bundled };
}

/** 文書の画像を埋め、印のある外部ライブラリと設定の拡張を束ね、`theme` を読み、索引があれば参照の表を作って、書き出しの中身と警告を返す */
export async function prepareEmbeds(options: EmbedOptions): Promise<{
  payload: ExportPayload;
  themeCss?: string | undefined;
  warnings: string[];
}> {
  const { loaded, docs, kind, entry } = options;
  const warnings: string[] = [];
  const configName = basename(loaded.path);

  // 文書を読み、画像を埋める
  const originals = new Map<string, string>();
  const inlined = new Map<string, string>();
  for (const doc of docs) {
    const original = await readFile(doc.file, "utf8");
    const result = await inlineImages(original, doc.file);
    originals.set(doc.path, original);
    inlined.set(doc.path, result.markdown);
    warnings.push(...result.warnings.map((text) => `${doc.path}: ${text}`));
  }

  // 文書に印のある外部ライブラリを、URL ごとに 1 回だけ束ねる
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
      pending = bundleModule(url, loaded.dir);
      bundled.set(url, pending);
    }
    const result = await pending;
    if ("code" in result) {
      modules[mark] = result.code;
    } else {
      warnings.push(
        `${configName}: 外部ライブラリ \`${mark}\` を束ねられません（${result.error}）。URL かパスを直してください。`,
      );
    }
  }

  // 設定の拡張を 1 つずつ束ねる
  const extensions: string[] = [];
  for (const path of loaded.config.extensions ?? []) {
    const result = await bundleModule(path, loaded.dir);
    if ("code" in result) {
      extensions.push(result.code);
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

  // 文書に色分けの対象があれば、色分けの本体と使う言語のモジュールを束ねる
  const syntax = await bundleSyntax({
    languages: usedSyntaxLanguages({
      markdowns: [...originals.values()],
      config: loaded.config,
    }),
    url: resolveConfig({ config: loaded.config }).syntax.url,
    loaded,
    warnings,
  });

  // 設定の `aliases` の YAML を読み、使えない行・レコードを警告にする
  const aliasResult = await loadAliases(loaded);
  for (const issue of aliasResult.issues) {
    const where = issue.where === "" ? "" : `:${issue.where}`;
    warnings.push(`${issue.file}${where}: ${issue.kind}: ${issue.message}`);
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
      // 埋めたモジュールは開いたときに URL に替えるため、値は印の名前にする（埋められなかった印が外へ要求しない）
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
      };
    }),
    entry,
    modules,
    extensions,
    ...(syntax ? { syntax } : {}),
    ...(aliasResult.aliases ? { aliases: aliasResult.aliases } : {}),
  };
  return { payload, themeCss, warnings };
}

/** 配布物の CSS・起動の処理・ビューの部品のモジュールを読む。`bundle` では画面の規則（`viewer.css`）を CSS の後ろに足す */
export async function readDistAssets(options: {
  /** `dist/` の場所 */
  distDir: string;
  /** 書き出しの種類 */
  kind: "document" | "bundle";
}): Promise<{ distCss: string; viewer: string; view: string }> {
  const { distDir, kind } = options;
  let distCss: string;
  let viewer: string;
  let view: string;
  try {
    distCss = await readFile(join(distDir, "index.css"), "utf8");
    viewer = await readFile(join(distDir, "viewer.js"), "utf8");
    view = await readFile(join(distDir, "view.js"), "utf8");
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
  const { payload, themeCss, warnings } = await prepareEmbeds({
    loaded,
    docs: [{ path, file: docFile }],
    kind: "document",
    entry: path,
  });
  const { distCss, viewer, view } = await readDistAssets({
    distDir: options.distDir,
    kind: "document",
  });
  payload.parts = usedParts({
    markdowns: payload.docs.map((doc) => doc.markdown),
    view,
  });
  await writeHtml({
    file: outFile,
    display,
    html: assembleHtml({ payload, distCss, themeCss, viewer }),
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
