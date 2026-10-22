import { join, resolve } from "node:path";
import { normalizePath } from "../knowledge/paths.ts";
import { requireConfig } from "./config.ts";
import { collectBuildDocuments } from "./documents.ts";
import { findOutsideLinks, usedParts } from "./embed.ts";
import { prepareEmbeds, readDistAssets, writeHtml } from "./export.ts";
import { assembleHtml } from "./html.ts";
import { CliError, type CliIo } from "./main.ts";

/** `build` の対象の文書を `kind: bundle` の中身にして `build.out` に HTML を書き、警告と `書き出した: {build.out}（文書 {件数} 件）` を出す */
export async function runBuild(
  options: {
    /** 使う設定ファイルのパス */
    config?: string | undefined;
    /** `dist/` の場所 */
    distDir: string;
  },
  io: CliIo,
): Promise<0> {
  const loaded = await requireConfig(io.cwd, options.config);
  const build = loaded.config.build;
  if (!build) {
    throw new CliError(
      "build が無い: 設定に build がありません。build.include と build.out を書いてください。",
    );
  }
  const paths = await collectBuildDocuments(loaded.dir, build);
  const first = paths[0];
  if (first === undefined) {
    throw new CliError(
      "0 件: build.include に当たる文書がありません。build.include を直してください。",
    );
  }
  const included = new Set(paths);
  const warnings: string[] = [];

  // 最初に開く文書: 無いか、まとめる文書に当たらないときは、まとめる文書の最初の 1 つ
  const wantedEntry =
    build.entry === undefined ? undefined : normalizePath(build.entry);
  let entry = first;
  if (wantedEntry !== undefined) {
    if (included.has(wantedEntry)) {
      entry = wantedEntry;
    } else {
      warnings.push(
        `${build.entry}: build.entry がまとめる文書に当たりません。まとめる文書の最初の 1 つ（${first}）を開きます。`,
      );
    }
  }
  for (const glossary of build.glossary ?? []) {
    if (!included.has(normalizePath(glossary))) {
      warnings.push(
        `${glossary}: build.glossary がまとめる文書に当たりません。用語集の表を飛ばします。`,
      );
    }
  }

  const {
    payload,
    themeCss,
    warnings: embedWarnings,
  } = await prepareEmbeds({
    loaded,
    docs: paths.map((path) => ({ path, file: join(loaded.dir, path) })),
    kind: "bundle",
    entry,
  });
  warnings.unshift(...embedWarnings);
  // 1 枚に含まれない文書へのリンクを持つ文書とリンク先
  for (const doc of payload.docs) {
    for (const href of findOutsideLinks(doc.markdown, doc.path, included)) {
      warnings.push(
        `${doc.path}: \`${href}\` へのリンクはまとめた HTML に含まれません。書いたままのリンクで残します。まとめるなら \`build.include\` に足してください。`,
      );
    }
  }

  const { distCss, viewer, view } = await readDistAssets({
    distDir: options.distDir,
    kind: "bundle",
  });
  payload.parts = usedParts({
    markdowns: payload.docs.map((doc) => doc.markdown),
    view,
  });
  await writeHtml({
    file: resolve(loaded.dir, build.out),
    display: build.out,
    html: assembleHtml({ payload, distCss, themeCss, viewer }),
  });
  for (const warning of warnings) {
    io.stderr(`警告: ${warning}`);
  }
  io.stdout(`書き出した: ${build.out}（文書 ${paths.length} 件）`);
  return 0;
}
