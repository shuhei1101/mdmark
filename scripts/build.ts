import { execFile } from "node:child_process";
import {
  chmodSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { build, type Metafile } from "esbuild";
import { findBaselineViolations } from "./baseline.ts";
import {
  buildPlugin,
  listEmbeddedPackages,
  removePluginOutputs,
} from "./build-plugin.ts";
import {
  BROWSER_TARGETS,
  bundleDefines,
  listBundledPackages,
  NODE_BANNER,
  NODE_TARGET,
  postcssStubPlugin,
  readEmbeddedLicenseBlock,
  readLicenseBlock,
} from "./bundle.ts";
import { checkMigrations } from "./migrations.ts";

// 埋めるバージョンが合うべき書式
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/;
// 配布ファイル 1 つの上限（非機能要件の 672KB）
const MAX_DIST_FILE_BYTES = 672 * 1024;
// まとめた依存のライセンスを記載する、`dist/` と移行の手順のフォルダの中のファイル名
const LICENSES_FILE = "THIRD_PARTY_LICENSES.txt";
// サイズを検めない配布ファイル（利用側のページが jsDelivr から読み込まない出力）
const UNSIZED_OUTPUTS = ["dist/cli.js", "dist/viewer.js", "dist/viewer.css"];
// 今の書き方のマーカーを書き換える移行の手順のスクリプトと、そのフォルダにまとめる書き換えの処理のファイル名
const LEGACY_MIGRATION_SCRIPT = "marker-json.mjs";
const LEGACY_MARKS_FILE = "legacy-marks.js";
// 廃止した図の範囲を書き換える移行の手順のスクリプトと、そのフォルダにまとめる書き換えの処理と拡張の読み込みのファイル名
const RETIRED_MIGRATION_SCRIPT = "retired-diagrams.mjs";
const RETIRED_DIAGRAMS_FILE = "retired-diagrams.js";
// 廃止した図の書き換えの処理と拡張の読み込みを re-export する入口
const RETIRED_DIAGRAMS_ENTRY = [
  'export { convertRetiredDiagrams } from "./src/map/convert.ts";',
  'export { loadExtensionDirectives } from "./src/cli/check.ts";',
  'export { loadConfig } from "./src/cli/config.ts";',
].join("\n");
// CLI の実行時の依存: まとめずに `package.json` の `dependencies` から読み込む
const CLI_EXTERNALS = ["yaml", "esbuild"];
// バージョンを指定する引数の名前
const VERSION_OPTION = "--version";
// 型定義を記載する tsc の設定
const DECLARATION_TSCONFIG = "tsconfig.dist.json";

const execFileAsync = promisify(execFile);

/** バージョンの書式が違うときに投げる */
export class VersionFormatError extends Error {}

/** `--version` があればその値、無ければ `version.ini` の先頭行を返却し、書式を検査する */
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
      `バージョンの書式が違う: ${version}（v{MAJOR}.{MINOR}.{PATCH}）`,
    );
  }
  return version;
}

/** まとめたパッケージと、その中に取り込まれたパッケージの名前・バージョン・ライセンス・ライセンスの本文を、名前の順に `outfile` に書き込む。複数の `metafile` で同じパッケージは 1 回だけ記載する */
export async function writeThirdPartyLicenses(options: {
  /** まとめた esbuild の出力 */
  metafiles: Metafile[];
  /** 作業ツリーの場所 */
  root: string;
  /** 書き込むファイルの `root` からのパス */
  outfile: string;
}): Promise<void> {
  const { metafiles, root, outfile } = options;
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
  writeFileSync(join(root, outfile), blocks.join("\n\n"));
}

/** 作業ツリーの `tsc` を実行し、`src/index.ts` から辿れる型定義を `dist/` に書き込む。`tsc` が失敗したら、その出力を含む例外を投げる */
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

/** ビュー・コメント・map の部品のモジュール `src/views/index.ts`・`src/comments/index.ts`・`src/map/index.ts` を `dist/view.js`・`dist/comments.js`・`dist/map.js` にまとめる。使用する関数はそれぞれのファイルにまとめ、`dist/index.js` は読み込まない。ソースが無ければ何も書き込まない */
async function buildParts(
  version: string,
  root: string,
): Promise<Record<string, number>> {
  const entryPoints = [
    { in: "src/views/index.ts", out: "view" },
    { in: "src/comments/index.ts", out: "comments" },
    { in: "src/map/index.ts", out: "map" },
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
    define: bundleDefines(version),
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

/** 書き出した HTML の起動の処理 `src/viewer/index.ts` と `src/viewer/viewer.css` を `dist/viewer.js` と `dist/viewer.css` にまとめる。ソースが無ければ何も書き込まない */
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
    define: bundleDefines(version),
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

/** CLI の `src/cli/main.ts` を Node で動く `dist/cli.js` にまとめる（`yaml` と `esbuild` はまとめない）。出力のパスとバイト数と、ライセンスを記載するための esbuild の出力を返却する。ソースが無ければ何も書き込まず、出力を持たない */
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
    define: bundleDefines(version),
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

/** `src/render/legacy-marks.ts` を、依存を含めて Node で動く 1 つのファイルにまとめ、`migrations/` の中の `marker-json.mjs` を持つフォルダごとに `legacy-marks.js` として書き込み、まとめた依存のライセンスを同じフォルダの `LICENSES_FILE` に書き込み、書き込んだ `legacy-marks.js` のパスを返却する。ソースが無ければ何も書き込まない（今の書き方を読む処理を消した後も、書き込み済みのファイルで移行の手順が動く） */
export async function buildLegacyMarks(
  version: string,
  root: string,
): Promise<string[]> {
  const migrations = join(root, "migrations");
  if (
    !existsSync(join(root, "src", "render", "legacy-marks.ts")) ||
    !existsSync(migrations)
  ) {
    return [];
  }
  const folders = readdirSync(migrations, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(migrations, entry.name, LEGACY_MIGRATION_SCRIPT)),
    )
    .map((entry) => `migrations/${entry.name}`)
    .sort();
  for (const folder of folders) {
    const result = await build({
      absWorkingDir: root,
      entryPoints: ["src/render/legacy-marks.ts"],
      outfile: `${folder}/${LEGACY_MARKS_FILE}`,
      bundle: true,
      minify: true,
      format: "esm",
      platform: "node",
      target: NODE_TARGET,
      plugins: [postcssStubPlugin],
      define: bundleDefines(version),
      metafile: true,
      logLevel: "silent",
    });
    await writeThirdPartyLicenses({
      metafiles: [result.metafile],
      root,
      outfile: `${folder}/${LICENSES_FILE}`,
    });
  }
  return folders.map((folder) => `${folder}/${LEGACY_MARKS_FILE}`);
}

/** `src/map/convert.ts` の `convertRetiredDiagrams` と、拡張の `directive` と設定を読み込む `loadExtensionDirectives`・`loadConfig` を、Node で動く 1 つのファイルにまとめ、`migrations/` の中の `retired-diagrams.mjs` を持つフォルダごとに `retired-diagrams.js` として書き込み、まとめた依存のライセンスを同じフォルダの `LICENSES_FILE` に書き込み、書き込んだ `retired-diagrams.js` のパスを返却する。ソースが無ければ何も書き込まない（廃止の前の定義を読む処理を消した後も、書き込み済みのファイルで移行の手順が動く） */
export async function buildRetiredDiagrams(
  version: string,
  root: string,
): Promise<string[]> {
  const migrations = join(root, "migrations");
  if (
    !existsSync(join(root, "src", "map", "convert.ts")) ||
    !existsSync(migrations)
  ) {
    return [];
  }
  const folders = readdirSync(migrations, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(migrations, entry.name, RETIRED_MIGRATION_SCRIPT)),
    )
    .map((entry) => `migrations/${entry.name}`)
    .sort();
  for (const folder of folders) {
    const result = await build({
      absWorkingDir: root,
      stdin: {
        contents: RETIRED_DIAGRAMS_ENTRY,
        resolveDir: root,
        sourcefile: "retired-diagrams-entry.ts",
        loader: "ts",
      },
      outfile: `${folder}/${RETIRED_DIAGRAMS_FILE}`,
      bundle: true,
      minify: true,
      format: "esm",
      platform: "node",
      target: NODE_TARGET,
      plugins: [postcssStubPlugin],
      define: bundleDefines(version),
      external: CLI_EXTERNALS,
      metafile: true,
      logLevel: "silent",
    });
    // 同じフォルダに今の書き方のマーカーの書き換えの処理もあれば、そのライセンスと合わせて記載する
    const legacy = existsSync(join(root, folder, LEGACY_MIGRATION_SCRIPT))
      ? await build({
          absWorkingDir: root,
          entryPoints: ["src/render/legacy-marks.ts"],
          bundle: true,
          write: false,
          format: "esm",
          platform: "node",
          target: NODE_TARGET,
          plugins: [postcssStubPlugin],
          define: bundleDefines(version),
          metafile: true,
          logLevel: "silent",
        })
      : undefined;
    await writeThirdPartyLicenses({
      metafiles: [result.metafile, ...(legacy ? [legacy.metafile] : [])],
      root,
      outfile: `${folder}/${LICENSES_FILE}`,
    });
  }
  return folders.map((folder) => `${folder}/${RETIRED_DIAGRAMS_FILE}`);
}

/** esbuild で `src/index.ts` と `src/index.css` を、バージョンを埋めた `dist/` にまとめ、型定義を書き込み、配布物と CLI にまとめた依存のライセンスを書き込む */
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
    define: bundleDefines(version),
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
  await buildLegacyMarks(version, root);
  await buildRetiredDiagrams(version, root);
  await writeThirdPartyLicenses({
    metafiles: [result.metafile, ...(cli.metafile ? [cli.metafile] : [])],
    root,
    outfile: `dist/${LICENSES_FILE}`,
  });
  outputs[`dist/${LICENSES_FILE}`] = statSync(
    join(root, "dist", LICENSES_FILE),
  ).size;
  return outputs;
}

/** 出力ファイルのうち `UNSIZED_OUTPUTS` に無く上限を超えたものを返却する */
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

/** 前回の `dist/` とプラグインの生成物を削除してから、バージョンを決めて検査し、移行の手順を点検し、`dist/` を書き込んでサイズと対応ブラウザの下限を検査し、プラグインをビルドし、終了コードを返却する */
export async function main(
  argv: string[],
  options: {
    root: string;
    maxBytes: number;
  } = {
    root: process.cwd(),
    maxBytes: MAX_DIST_FILE_BYTES,
  },
): Promise<0 | 1> {
  const { root, maxBytes } = options;
  const distDir = join(root, "dist");
  // 失敗したときに前回の配布物が残らないよう、最初に削除する
  rmSync(distDir, { recursive: true, force: true });
  removePluginOutputs(root);
  try {
    const version = resolveVersion(argv, root);
    // 移行の手順の配置漏れは、配布物を書き込む前に止める
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
      // 配布ファイルのサイズが上限内のときだけ、下限のブラウザに無い API を確認する
      const violations =
        tooLarge.length === 0
          ? await findBaselineViolations({ root, version })
          : [];
      for (const { file, line, column, message } of violations) {
        console.error(`${file}:${line}:${column} ${message}`);
      }
      if (tooLarge.length === 0 && violations.length === 0) {
        const pluginProblems = await buildPlugin({ version, root });
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

// `node scripts/build.ts` で入口として実行されたときだけ実行する
if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
