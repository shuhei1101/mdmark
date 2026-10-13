import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

// 埋める版が合うべき書式
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/;
// jsDelivr が配る 1 ファイルの上限（20MB）
const MAX_DIST_FILE_BYTES = 20 * 1024 * 1024;
// esbuild の target に渡すブラウザの版
const BROWSER_TARGETS = ["chrome94", "firefox93", "safari16.4"];
// 版を渡す引数の名前
const VERSION_OPTION = "--version";

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

/** esbuild で `src/index.ts` と `src/index.css` を、版を埋めた `dist/` に束ねる */
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
    target: BROWSER_TARGETS,
    define: { __MDMARK_VERSION__: JSON.stringify(version) },
    banner: { css: `:root{--mdmark-version:"${version}"}` },
    metafile: true,
  });
  return Object.fromEntries(
    Object.entries(result.metafile.outputs).map(([path, output]) => [
      path,
      output.bytes,
    ]),
  );
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
