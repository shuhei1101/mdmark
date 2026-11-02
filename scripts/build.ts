import { execFile } from "node:child_process";
import {
  chmodSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { build, type Metafile } from "esbuild";
import { GUIDE_CONTEXT_LIMIT } from "../src/plugin/guide.ts";
import { findBaselineViolations } from "./baseline.ts";
import {
  buildPlugin,
  listEmbeddedPackages,
  removePluginOutputs,
} from "./build-plugin.ts";
import {
  BROWSER_TARGETS,
  listBundledPackages,
  NODE_BANNER,
  NODE_TARGET,
  postcssStubPlugin,
  readEmbeddedLicenseBlock,
  readLicenseBlock,
} from "./bundle.ts";
import { checkMigrations } from "./migrations.ts";

// 埋める版が合うべき書式
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/;
// 配布ファイル 1 つの上限（非機能要件の 480KB）
const MAX_DIST_FILE_BYTES = 480 * 1024;
// 配布物に束ねた依存のライセンスを書く、`dist/` の中のファイル名
const LICENSES_FILE = "THIRD_PARTY_LICENSES.txt";
// サイズを検めない配布ファイル（使う側のページが jsDelivr から読まない出力）
const UNSIZED_OUTPUTS = ["dist/cli.js", "dist/viewer.js", "dist/viewer.css"];
// CLI の実行時の依存: 束ねずに `package.json` の `dependencies` から読む
const CLI_EXTERNALS = ["yaml", "esbuild"];
// `script` 要素の中のコードに在ってはならない並び
const SCRIPT_CLOSE_PATTERN = /<\/script/i;
// 版を渡す引数の名前
const VERSION_OPTION = "--version";
// 型定義を書く tsc の設定
const DECLARATION_TSCONFIG = "tsconfig.dist.json";

const execFileAsync = promisify(execFile);

/** 版の書式が違うときに投げる */
export class VersionFormatError extends Error {}

/** `--version` があればその値、無ければ `version.ini` の先頭行を返し、書式を検査する */
export function resolveVersion(argv: string[], root: string): string {
  const index = argv.indexOf(VERSION_OPTION);
  const version =
    index >= 0
      ? (argv[index + 1] ?? "")
      : (
          readFileSync(join(root, "version.ini"), "utf8").split("\n")[0] ?? ""
        ).trim();
  if (!VERSION_PATTERN.test(version)) {
    throw new VersionFormatError(
      `版の書式が違う: ${version}（v{MAJOR}.{MINOR}.{PATCH}）`,
    );
  }
  return version;
}

/** コードに `</script` の並び（大文字と小文字を区別しない）があれば、書き出した HTML の `script` 要素が閉じるため例外を投げる */
export function assertNoScriptClose(code: string, file: string): void {
  if (SCRIPT_CLOSE_PATTERN.test(code)) {
    throw new Error(
      `${file} に </script の並びがあり、書き出した HTML の script 要素が閉じる`,
    );
  }
}

/** 束ねたパッケージと、その中に取り込まれたパッケージの名前・版・ライセンス・ライセンスの本文を、名前の順に `dist/` の `LICENSES_FILE` に書く。複数の `metafile` で同じパッケージは 1 回だけ書く */
export async function writeThirdPartyLicenses(options: {
  /** 配布物と CLI の esbuild の出力 */
  metafiles: Metafile[];
  /** 作業ツリーの場所 */
  root: string;
}): Promise<void> {
  const { metafiles, root } = options;
  const bundled = new Set(metafiles.flatMap(listBundledPackages));
  const embedded = new Set(
    metafiles.flatMap((metafile) => listEmbeddedPackages({ metafile, root })),
  );
  const names = [...new Set([...bundled, ...embedded])].sort();
  const blocks = names.map((name) =>
    bundled.has(name)
      ? readLicenseBlock({ root, name })
      : readEmbeddedLicenseBlock({ root, name }),
  );
  writeFileSync(join(root, "dist", LICENSES_FILE), blocks.join("\n\n"));
}

/** 作業ツリーの `tsc` を流し、`src/index.ts` から辿れる型定義を `dist/` に書く。`tsc` が失敗したら、その出力を含む例外を投げる */
export async function emitDeclarations(root: string): Promise<void> {
  try {
    await execFileAsync(
      join(root, "node_modules", ".bin", "tsc"),
      ["--project", DECLARATION_TSCONFIG],
      { cwd: root },
    );
  } catch (error) {
    const { stdout = "", stderr = "" } = error as {
      stdout?: string;
      stderr?: string;
    };
    throw new Error(`tsc が失敗した:\n${stdout}${stderr}`);
  }
}

/** ビューとコメントの部品のモジュール `src/views/index.ts` と `src/comments/index.ts` を `dist/view.js` と `dist/comments.js` に束ねる。使う関数はそれぞれのファイルに束ね、`dist/index.js` は読み込まない。ソースが無ければ何も書かない */
async function buildParts(
  version: string,
  root: string,
): Promise<Record<string, number>> {
  const entryPoints = [
    { in: "src/views/index.ts", out: "view" },
    { in: "src/comments/index.ts", out: "comments" },
  ].filter((entry) => existsSync(join(root, entry.in)));
  if (entryPoints.length === 0) {
    return {};
  }
  const result = await build({
    absWorkingDir: root,
    entryPoints,
    outdir: "dist",
    bundle: true,
    format: "esm",
    minify: true,
    target: BROWSER_TARGETS,
    plugins: [postcssStubPlugin],
    define: { __MDMARK_VERSION__: JSON.stringify(version) },
    metafile: true,
    logLevel: "silent",
  });
  return Object.fromEntries(
    Object.entries(result.metafile.outputs).map(([path, output]) => [
      path,
      output.bytes,
    ]),
  );
}

/** 書き出した HTML の起動の処理 `src/viewer/index.ts` と `src/viewer/viewer.css` を `dist/viewer.js` と `dist/viewer.css` に束ねる。ソースが無ければ何も書かない */
async function buildViewer(
  version: string,
  root: string,
): Promise<Record<string, number>> {
  const entryPoints = [
    { in: "src/viewer/index.ts", out: "viewer" },
    { in: "src/viewer/viewer.css", out: "viewer" },
  ].filter((entry) => existsSync(join(root, entry.in)));
  if (entryPoints.length === 0) {
    return {};
  }
  const result = await build({
    absWorkingDir: root,
    entryPoints,
    outdir: "dist",
    bundle: true,
    format: "esm",
    minify: true,
    target: BROWSER_TARGETS,
    plugins: [postcssStubPlugin],
    define: { __MDMARK_VERSION__: JSON.stringify(version) },
    metafile: true,
    logLevel: "silent",
  });
  const viewerJs = join(root, "dist", "viewer.js");
  if (existsSync(viewerJs)) {
    assertNoScriptClose(readFileSync(viewerJs, "utf8"), "dist/viewer.js");
  }
  return Object.fromEntries(
    Object.entries(result.metafile.outputs).map(([path, output]) => [
      path,
      output.bytes,
    ]),
  );
}

/** CLI の `src/cli/main.ts` を Node で動く `dist/cli.js` に束ねる（`yaml` と `esbuild` は束ねない）。出力のパスとバイト数と、ライセンスを書くための esbuild の出力を返す。ソースが無ければ何も書かず、出力を持たない */
async function buildCli(
  version: string,
  root: string,
): Promise<{ outputs: Record<string, number>; metafile?: Metafile }> {
  if (!existsSync(join(root, "src", "cli", "main.ts"))) {
    return { outputs: {} };
  }
  const result = await build({
    absWorkingDir: root,
    entryPoints: [{ in: "src/cli/main.ts", out: "cli" }],
    outdir: "dist",
    bundle: true,
    format: "esm",
    platform: "node",
    target: NODE_TARGET,
    banner: { js: NODE_BANNER },
    external: CLI_EXTERNALS,
    plugins: [postcssStubPlugin],
    define: { __MDMARK_VERSION__: JSON.stringify(version) },
    metafile: true,
    logLevel: "silent",
  });
  // `npx` や `node_modules/.bin` から入口として実行できるようにする
  chmodSync(join(root, "dist", "cli.js"), 0o755);
  return {
    outputs: Object.fromEntries(
      Object.entries(result.metafile.outputs).map(([path, output]) => [
        path,
        output.bytes,
      ]),
    ),
    metafile: result.metafile,
  };
}

/** esbuild で `src/index.ts` と `src/index.css` を、版を埋めた `dist/` に束ね、型定義を書き、配布物と CLI に束ねた依存のライセンスを書く */
export async function buildDist(
  version: string,
  root: string,
): Promise<Record<string, number>> {
  const result = await build({
    absWorkingDir: root,
    entryPoints: ["src/index.ts", "src/index.css"],
    outdir: "dist",
    bundle: true,
    format: "esm",
    minify: true,
    target: BROWSER_TARGETS,
    plugins: [postcssStubPlugin],
    define: { __MDMARK_VERSION__: JSON.stringify(version) },
    banner: { css: `:root{--mdmark-version:"${version}"}` },
    metafile: true,
    // 失敗の理由は例外として返り、`main` が標準エラーに 1 回だけ出す
    logLevel: "silent",
  });
  await emitDeclarations(root);
  const outputs = Object.fromEntries(
    Object.entries(result.metafile.outputs).map(([path, output]) => [
      path,
      output.bytes,
    ]),
  );
  Object.assign(outputs, await buildParts(version, root));
  Object.assign(outputs, await buildViewer(version, root));
  const cli = await buildCli(version, root);
  Object.assign(outputs, cli.outputs);
  await writeThirdPartyLicenses({
    metafiles: [result.metafile, ...(cli.metafile ? [cli.metafile] : [])],
    root,
  });
  outputs[`dist/${LICENSES_FILE}`] = statSync(
    join(root, "dist", LICENSES_FILE),
  ).size;
  return outputs;
}

/** 出力ファイルのうち `UNSIZED_OUTPUTS` に無く上限を超えたものを返す */
export function findTooLargeOutputs(
  outputs: Record<string, number>,
  maxBytes: number,
): Array<{ path: string; bytes: number }> {
  return Object.entries(outputs)
    .filter(
      ([path, bytes]) => !UNSIZED_OUTPUTS.includes(path) && bytes > maxBytes,
    )
    .map(([path, bytes]) => ({ path, bytes }));
}

/** 前回の `dist/` とプラグインの生成物を消してから、版を決めて検査し、移行の手順を点検し、`dist/` を書いてサイズと対応ブラウザの下限を検査し、プラグインをビルドし、終了コードを返す */
export async function main(
  argv: string[],
  options: {
    root: string;
    maxBytes: number;
    guideContextLimit?: number;
  } = {
    root: process.cwd(),
    maxBytes: MAX_DIST_FILE_BYTES,
  },
): Promise<0 | 1> {
  const { root, maxBytes } = options;
  const guideContextLimit = options.guideContextLimit ?? GUIDE_CONTEXT_LIMIT;
  const distDir = join(root, "dist");
  // 失敗したときに前回の配布物が残らないよう、最初に消す
  rmSync(distDir, { recursive: true, force: true });
  removePluginOutputs(root);
  try {
    const version = resolveVersion(argv, root);
    // 移行の手順の置き忘れは、配布物を書く前に止める
    const migrationProblems = await checkMigrations({ root, version });
    for (const problem of migrationProblems) {
      console.error(problem);
    }
    if (migrationProblems.length === 0) {
      const outputs = await buildDist(version, root);
      const tooLarge = findTooLargeOutputs(outputs, maxBytes);
      for (const { path, bytes } of tooLarge) {
        console.error(
          `配布ファイルが上限 ${maxBytes} バイトを超えた: ${path} ${bytes} バイト`,
        );
      }
      // 配布ファイルのサイズが上限内のときだけ、下限のブラウザに無い API を確かめる
      const violations =
        tooLarge.length === 0
          ? await findBaselineViolations({ root, version })
          : [];
      for (const { file, line, column, message } of violations) {
        console.error(`${file}:${line}:${column} ${message}`);
      }
      if (tooLarge.length === 0 && violations.length === 0) {
        const pluginProblems = await buildPlugin({
          version,
          root,
          contextLimit: guideContextLimit,
        });
        for (const problem of pluginProblems) {
          console.error(problem);
        }
        if (pluginProblems.length === 0) {
          return 0;
        }
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
  rmSync(distDir, { recursive: true, force: true });
  removePluginOutputs(root);
  return 1;
}

// `node scripts/build.ts` で入口として実行されたときだけ流す
if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
