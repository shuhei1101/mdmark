import { join, resolve } from "node:path";
import { normalizePath } from "../knowledge/paths.ts";
import { requireConfig } from "./config.ts";
import { collectBuildDocuments } from "./documents.ts";
import {
  bundleViewer,
  cacheFetchText,
  createViewerEntry,
  findOutsideLinks,
} from "./embed.ts";
import { CliError, type CliIo } from "./errors.ts";
import { prepareEmbeds, readDistAssets, writeHtml } from "./export.ts";
import { assembleHtml } from "./html.ts";

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
  const included = new Set(paths);
  const warnings: string[] = [];

  // 最初に開く文書: 無いか、まとめる文書に該当しないときは、まとめる文書の最初の 1 つ
  const wantedEntry =
    build.entry === undefined ? undefined : normalizePath(build.entry);
  let entry = first;
  if (wantedEntry !== undefined) {
    if (included.has(wantedEntry)) {
      entry = wantedEntry;
    } else {
      warnings.push(
        `${build.entry}: build.entry がまとめる文書に該当しません。まとめる文書の最初の 1 つ（${first}）を開きます。`,
      );
    }
  }
  for (const glossary of build.glossary ?? []) {
    if (!included.has(normalizePath(glossary))) {
      warnings.push(
        `${glossary}: build.glossary がまとめる文書に該当しません。用語集の表を飛ばします。`,
      );
    }
  }

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
  // 1 枚に含まれない文書へのリンクを持つ文書とリンク先
  for (const doc of payload.docs) {
    for (const href of findOutsideLinks(doc.markdown, doc.path, included)) {
      warnings.push(
        `${doc.path}: \`${href}\` へのリンクはまとめた HTML に含まれません。記載したままのリンクで残します。まとめるなら \`build.include\` に追加してください。`,
      );
    }
  }

  const { distCss, viewer, view, map } = await readDistAssets({
    distDir: options.distDir,
    kind: "bundle",
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
