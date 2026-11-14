import { join, resolve } from "node:path";
import type { BuildConfig } from "../config-files.ts";
import { normalizePath } from "../knowledge/paths.ts";
import { type LoadedConfig, requireConfig } from "./config.ts";
import { collectBuildDocuments } from "./documents.ts";
import {
  bundleViewer,
  cacheFetchText,
  createViewerEntry,
  findOutsideLinks,
  type ViewerEmbeds,
} from "./embed.ts";
import { CliError, type CliIo } from "./errors.ts";
import { prepareEmbeds, readDistAssets, writeHtml } from "./export.ts";
import { assembleHtml } from "./html.ts";

/** 最初に開く文書: 無いか、まとめる文書に該当しないときは、まとめる文書の最初の 1 つ（該当しないときは警告を加える） */
function chooseEntry(options: {
  build: BuildConfig;
  first: string;
  included: ReadonlySet<string>;
  warnings: string[];
}): string {
  const { build, first, included, warnings } = options;
  if (build.entry === undefined) {
    return first;
  }
  const wanted = normalizePath(build.entry);
  if (included.has(wanted)) {
    return wanted;
  }
  warnings.push(
    `${build.entry}: build.entry がまとめる文書に該当しません。まとめる文書の最初の 1 つ（${first}）を開きます。`,
  );
  return first;
}

/** まとめる文書に該当しない用語集の表の文書の警告 */
function glossaryWarnings(
  build: BuildConfig,
  included: ReadonlySet<string>,
): string[] {
  return (build.glossary ?? [])
    .filter((glossary) => !included.has(normalizePath(glossary)))
    .map(
      (glossary) =>
        `${glossary}: build.glossary がまとめる文書に該当しません。用語集の表を飛ばします。`,
    );
}

/** 1 枚に含まれない文書へのリンクを持つ文書とリンク先の警告 */
function outsideLinkWarnings(
  docs: Array<{ path: string; markdown: string }>,
  included: ReadonlySet<string>,
): string[] {
  return docs.flatMap((doc) =>
    findOutsideLinks(doc.markdown, doc.path, included).map(
      (href) =>
        `${doc.path}: \`${href}\` へのリンクはまとめた HTML に含まれません。記載したままのリンクで残します。まとめるなら \`build.include\` に追加してください。`,
    ),
  );
}

/** まとめる設定と、まとめる文書（1 つ以上）。無ければ例外を投げる */
async function requireBuild(
  loaded: LoadedConfig,
): Promise<{ build: BuildConfig; paths: string[]; first: string }> {
  const build = loaded.config.build;
  if (!build) {
    throw new CliError(
      "build が無い: 設定に build がありません。build.include と build.out を記載してください。",
    );
  }
  const paths = await collectBuildDocuments(loaded.dir, build);
  const first = paths[0];
  if (first === undefined) {
    throw new CliError(
      "0 件: build.include に該当する文書がありません。build.include を修正してください。",
    );
  }
  return { build, paths, first };
}

/** `build` の対象の文書を `kind: bundle` の中身にして `build.out` に HTML を書き込み、書き込んだ絶対パス・`build.out` のままのパス・文書の数・警告を返却する。標準出力・標準エラーには書き込まない */
export async function buildSite(options: {
  /** 今のフォルダ */
  cwd: string;
  /** 使用する設定ファイルのパス */
  config?: string | undefined;
  /** `dist/` の場所 */
  distDir: string;
  /** 開発のときに mdmark の名前・HTML のコメント・バージョンを残すか */
  keepTraces?: boolean | undefined;
}): Promise<{
  out: string;
  display: string;
  docs: number;
  warnings: string[];
}> {
  const loaded = await requireConfig(options.cwd, options.config);
  const hide = options.keepTraces !== true;
  const { build, paths, first } = await requireBuild(loaded);
  const included = new Set(paths);
  const warnings: string[] = [];
  const entry = chooseEntry({ build, first, included, warnings });
  warnings.push(...glossaryWarnings(build, included));

  const out = resolve(loaded.dir, build.out);
  const fetchText = cacheFetchText();
  const {
    payload,
    embeds,
    themeCss,
    warnings: embedWarnings,
  } = await prepareEmbeds({
    loaded,
    docs: paths.map((path) => ({ path, file: join(loaded.dir, path) })),
    kind: "bundle",
    entry,
    out,
    fetchText,
    hideTraces: hide,
  });
  warnings.unshift(...embedWarnings);
  warnings.push(...outsideLinkWarnings(payload.docs, included));

  const { distCss, viewer, view, map } = await readDistAssets({
    distDir: options.distDir,
    kind: "bundle",
  });
  const script = await bundleViewer({
    entry: createViewerEntry({ viewer, view, map, embeds, hideTraces: hide }),
    baseDir: loaded.dir,
    fetchText,
    ...(hide ? { hideTraces: { keys: htmlScriptKeys(embeds) } } : {}),
  });
  await writeHtml({
    file: out,
    display: build.out,
    html: assembleHtml({
      payload,
      distCss,
      themeCss,
      script,
      hideTraces: hide,
    }),
  });
  return { out, display: build.out, docs: paths.length, warnings };
}

/** 範囲のスクリプトの表の鍵（範囲のコードの文字） */
function htmlScriptKeys(embeds: ViewerEmbeds): string[] {
  return (embeds.htmlScripts ?? []).map(({ source }) => source);
}

/** `build` の対象の文書を `build.out` に HTML として記載し、警告と `書き出した: {build.out}（文書 {件数} 件）` を出す */
export async function runBuild(
  options: {
    /** 使用する設定ファイルのパス */
    config?: string | undefined;
    /** `dist/` の場所 */
    distDir: string;
    /** 開発のときに mdmark の名前・HTML のコメント・バージョンを残すか */
    keepTraces?: boolean | undefined;
  },
  io: CliIo,
): Promise<0> {
  const { display, docs, warnings } = await buildSite({
    cwd: io.cwd,
    ...options,
  });
  for (const warning of warnings) {
    io.stderr(`警告: ${warning}`);
  }
  io.stdout(`書き出した: ${display}（文書 ${docs} 件）`);
  return 0;
}
