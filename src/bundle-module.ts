import { readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import type { BuildOptions, Plugin } from "esbuild";

/** URL を読む関数 */
export type FetchText = (url: string) => Promise<string>;

/** esbuild の `build`。CLI はネイティブの esbuild の、VS Code 拡張機能は esbuild-wasm の `build` を渡す */
export type BuildFunction = (
  options: BuildOptions,
) => Promise<{ outputFiles?: Array<{ text: string }> | undefined }>;

/** 束ねたモジュールの target に渡すブラウザの版（対応ブラウザの下限） */
export const BROWSER_TARGETS = ["chrome99", "firefox98", "safari16.4"];

/** esbuild が URL の import を読む名前空間 */
const URL_NAMESPACE = "http-url";

/** esbuild がファイルを読む名前空間（esbuild-wasm はファイルシステムを持たず、`file` の名前空間は Windows のパスを拒む） */
const LOCAL_NAMESPACE = "local";

/** `http:`・`https:` の URL か */
const HTTP_PATTERN = /^https?:\/\//i;

/** ファイルのパスを指す import か（相対パス・絶対パス） */
const PATH_PATTERN = /^(?:\.{1,2}[\\/]|[\\/]|[A-Za-z]:[\\/])/;

/** TypeScript として読む拡張子 */
const TS_LOADERS: Readonly<Record<string, "ts" | "tsx">> = {
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".tsx": "tsx",
};

/** `fetch` で URL の本文を読む。読めなければ例外を投げる */
const fetchByUrl: FetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} は ${response.status} を返しました`);
  }
  return response.text();
};

/** URL の import を `fetchText` で読んで束ねる esbuild のプラグイン。取得したモジュールの中の import は、そのモジュールの URL を基準に解く */
export function urlPlugin(fetchText: FetchText): Plugin {
  return {
    name: URL_NAMESPACE,
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: HTTP_PATTERN }, (args) => ({
        path: args.path,
        namespace: URL_NAMESPACE,
      }));
      pluginBuild.onResolve(
        { filter: /.*/, namespace: URL_NAMESPACE },
        (args) => ({
          path: new URL(args.path, args.importer).href,
          namespace: URL_NAMESPACE,
        }),
      );
      pluginBuild.onLoad(
        { filter: /.*/, namespace: URL_NAMESPACE },
        async (args) => ({
          contents: await fetchText(args.path),
          loader: "js",
        }),
      );
    },
  };
}

/** 入口とファイルのパスの import を `node:fs/promises` で読む esbuild のプラグイン */
const localPlugin: Plugin = {
  name: LOCAL_NAMESPACE,
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: PATH_PATTERN }, (args) => ({
      path:
        args.kind === "entry-point" || isAbsolute(args.path)
          ? args.path
          : resolve(args.resolveDir, args.path),
      namespace: LOCAL_NAMESPACE,
    }));
    pluginBuild.onLoad(
      { filter: /.*/, namespace: LOCAL_NAMESPACE },
      async (args) => ({
        contents: await readFile(args.path, "utf8"),
        loader: TS_LOADERS[extname(args.path)] ?? "js",
        resolveDir: dirname(args.path),
      }),
    );
  },
};

/** URL かファイルのモジュールを、import する先も含めて渡した esbuild の `build` で 1 つの ES モジュールのコードに束ねる。届かない・束ねられないときは例外を投げずに理由を返す */
export async function bundleModule(
  entry: string,
  baseDir: string,
  fetchText: FetchText | undefined,
  build: BuildFunction,
): Promise<{ code: string } | { error: string }> {
  try {
    const result = await build({
      absWorkingDir: baseDir,
      entryPoints: [HTTP_PATTERN.test(entry) ? entry : resolve(baseDir, entry)],
      bundle: true,
      format: "esm",
      platform: "browser",
      target: BROWSER_TARGETS,
      minify: true,
      write: false,
      outfile: "bundle.js",
      plugins: [urlPlugin(fetchText ?? fetchByUrl), localPlugin],
      logLevel: "silent",
    });
    const code = result.outputFiles?.[0]?.text;
    if (code === undefined) {
      return { error: `${entry}: 束ねた結果がありません` };
    }
    return { code };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { error: `${entry}: ${reason}` };
  }
}

/** 同じ URL を 1 回だけ読む `FetchText` を返す。拒否した読み込みも控え、読み直さない */
export function cacheFetchText(fetchText: FetchText = fetchByUrl): FetchText {
  const cache = new Map<string, Promise<string>>();
  return (url) => {
    let pending = cache.get(url);
    if (!pending) {
      pending = fetchText(url);
      cache.set(url, pending);
    }
    return pending;
  };
}
