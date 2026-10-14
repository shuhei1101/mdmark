import {
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { build, type Metafile, type Plugin } from "esbuild";

// 埋める版が合うべき書式
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/;
// 配布ファイル 1 つの上限（非機能要件の 256KB）
const MAX_DIST_FILE_BYTES = 256 * 1024;
// 配布物に束ねた依存のライセンスを書く、`dist/` の中のファイル名
const LICENSES_FILE = "THIRD_PARTY_LICENSES.txt";
// esbuild の target に渡すブラウザの版
const BROWSER_TARGETS = ["chrome99", "firefox97", "safari16.4"];
// 版を渡す引数の名前
const VERSION_OPTION = "--version";
// 束ねたパッケージの入力のパスにある、依存の置き場所
const NODE_MODULES_SEGMENT = "node_modules/";
// パッケージの直下にあるライセンスのファイル名
const LICENSE_FILE_PATTERN = /^licen[sc]e/i;
// 差し替えた postcss を置く esbuild の名前空間
const STUB_NAMESPACE = "stub";

/** 版の書式が違うときに投げる */
export class VersionFormatError extends Error {}

/** `postcss` の import を、`parse` を呼ぶと例外を投げる空の部品に差し替える esbuild のプラグイン */
const postcssStubPlugin: Plugin = {
  name: "stub-postcss",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^postcss$/ }, () => ({
      path: "postcss",
      namespace: STUB_NAMESPACE,
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: STUB_NAMESPACE }, () => ({
      contents:
        'module.exports = { parse() { throw new Error("postcss は配布物に含めない") } }',
      loader: "js",
    }));
  },
};

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

/** esbuild の `metafile` の入力から束ねたパッケージの名前を、名前の順に返す */
function listBundledPackages(metafile: Metafile): string[] {
  const names = new Set<string>();
  for (const path of Object.keys(metafile.inputs)) {
    const index = path.lastIndexOf(NODE_MODULES_SEGMENT);
    if (index < 0) {
      continue;
    }
    // `@scope/name` か `name` の部分を取り出す
    const [first, second] = path
      .slice(index + NODE_MODULES_SEGMENT.length)
      .split("/");
    names.add(first?.startsWith("@") ? `${first}/${second}` : (first ?? ""));
  }
  return [...names].sort();
}

/** 束ねたパッケージごとに名前・版・ライセンス・ライセンスの本文を、`dist/` の `LICENSES_FILE` に書く */
export async function writeThirdPartyLicenses(options: {
  /** esbuild の出力 */
  metafile: Metafile;
  /** 作業ツリーの場所 */
  root: string;
}): Promise<void> {
  const { metafile, root } = options;
  const blocks = listBundledPackages(metafile).map((name) => {
    const dir = join(root, "node_modules", name);
    const pkg: { version: string; license: string } = JSON.parse(
      readFileSync(join(dir, "package.json"), "utf8"),
    );
    const licenseFile = readdirSync(dir).find((file) =>
      LICENSE_FILE_PATTERN.test(file),
    );
    if (!licenseFile) {
      throw new Error(`ライセンスの本文が無い: ${name}`);
    }
    const text = readFileSync(join(dir, licenseFile), "utf8");
    return `${name} ${pkg.version} (${pkg.license})\n\n${text}`;
  });
  writeFileSync(join(root, "dist", LICENSES_FILE), blocks.join("\n\n"));
}

/** esbuild で `src/index.ts` と `src/index.css` を、版を埋めた `dist/` に束ね、束ねた依存のライセンスを書く */
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
  await writeThirdPartyLicenses({ metafile: result.metafile, root });
  const outputs = Object.fromEntries(
    Object.entries(result.metafile.outputs).map(([path, output]) => [
      path,
      output.bytes,
    ]),
  );
  outputs[`dist/${LICENSES_FILE}`] = statSync(
    join(root, "dist", LICENSES_FILE),
  ).size;
  return outputs;
}

/** 出力ファイルのうち上限を超えたものを返す */
export function findTooLargeOutputs(
  outputs: Record<string, number>,
  maxBytes: number,
): Array<{ path: string; bytes: number }> {
  return Object.entries(outputs)
    .filter(([, bytes]) => bytes > maxBytes)
    .map(([path, bytes]) => ({ path, bytes }));
}

/** 前回の `dist/` を消してから、版を決めて検査し、`dist/` を書いてサイズを検査し、終了コードを返す */
export async function main(
  argv: string[],
  options: { root: string; maxBytes: number } = {
    root: process.cwd(),
    maxBytes: MAX_DIST_FILE_BYTES,
  },
): Promise<0 | 1> {
  const { root, maxBytes } = options;
  const distDir = join(root, "dist");
  // 失敗したときに前回の配布物が残らないよう、最初に消す
  rmSync(distDir, { recursive: true, force: true });
  try {
    const version = resolveVersion(argv, root);
    const outputs = await buildDist(version, root);
    const tooLarge = findTooLargeOutputs(outputs, maxBytes);
    if (tooLarge.length === 0) {
      return 0;
    }
    for (const { path, bytes } of tooLarge) {
      console.error(
        `配布ファイルが上限 ${maxBytes} バイトを超えた: ${path} ${bytes} バイト`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
  rmSync(distDir, { recursive: true, force: true });
  return 1;
}

// `node scripts/build.ts` で入口として実行されたときだけ流す
if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
