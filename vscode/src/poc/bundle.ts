import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import * as esbuild from "esbuild-wasm/lib/browser.js";

/** PoC: 拡張機能ホストの中で esbuild-wasm を初期化し、拡張のモジュールを 1 つの ES モジュールに束ねる */

const HTTP_PATTERN = /^https?:\/\//i;
const TS_PATTERN = /^\.(?:c|m)?tsx?$/;

let ready: Promise<void> | undefined;

/** `dist/esbuild.wasm` をコンパイルして初期化する。2 回目以降は同じ初期化を返す */
export const ensureEsbuild = (extensionPath: string): Promise<void> => {
  ready ??= readFile(join(extensionPath, "dist", "esbuild.wasm"))
    .then((bytes) => WebAssembly.compile(bytes))
    .then((wasmModule) => esbuild.initialize({ wasmModule, worker: false }));
  return ready;
};

/** 初期化を捨てる（#4560 の回避策の確かめ） */
export const stopEsbuild = async (): Promise<void> => {
  await esbuild.stop();
  ready = undefined;
};

/** https の URL は fetch で、ローカルのファイルは fs で読むプラグイン */
const sourcesPlugin: esbuild.Plugin = {
  name: "poc-sources",
  setup(build) {
    build.onResolve({ filter: HTTP_PATTERN }, (args) => ({
      path: args.path,
      namespace: "http-url",
    }));
    build.onResolve({ filter: /.*/, namespace: "http-url" }, (args) => ({
      path: new URL(args.path, args.importer).href,
      namespace: "http-url",
    }));
    build.onLoad({ filter: /.*/, namespace: "http-url" }, async (args) => {
      const response = await fetch(args.path);
      if (!response.ok) {
        throw new Error(`${args.path} は ${response.status} を返しました`);
      }
      return { contents: await response.text(), loader: "js" };
    });
    build.onResolve({ filter: /.*/ }, (args) => ({
      path:
        args.kind === "entry-point"
          ? args.path
          : resolve(dirname(args.importer), args.path),
      namespace: "local",
    }));
    build.onLoad({ filter: /.*/, namespace: "local" }, async (args) => ({
      contents: await readFile(args.path, "utf8"),
      loader: TS_PATTERN.test(extname(args.path)) ? "ts" : "js",
    }));
  },
};

/** 1 つの拡張のモジュールを、import 先も含めて 1 つの ES モジュールのコードに束ねる */
export const bundleWithWasm = async (options: {
  extensionPath: string;
  entry: string;
}): Promise<string> => {
  await ensureEsbuild(options.extensionPath);
  const result = await esbuild.build({
    entryPoints: [options.entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["chrome120", "firefox121", "safari17"],
    minify: true,
    write: false,
    outfile: "bundle.js",
    plugins: [sourcesPlugin],
    logLevel: "silent",
  });
  const code = result.outputFiles[0]?.text;
  if (code === undefined) {
    throw new Error(`${options.entry}: 束ねた結果がありません`);
  }
  return code;
};
