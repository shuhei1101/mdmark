import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild-wasm/lib/browser.js";
import {
  type BuildFunction,
  bundleModule,
  cacheFetchText,
  type FetchText,
} from "../../src/bundle-module.ts";

/** esbuild-wasm の初期化。1 つのプロセスで 1 回だけ */
let ready: Promise<void> | undefined;

/** `{extensionPath}/dist/esbuild.wasm` をコンパイルして esbuild-wasm を初期化する。2 回目以降は同じ初期化を返却する */
const ensureEsbuild = (extensionPath: string): Promise<void> => {
  ready ??= readFile(join(extensionPath, "dist", "esbuild.wasm"))
    .then((bytes) => WebAssembly.compile(bytes))
    .then((wasmModule) => esbuild.initialize({ wasmModule, worker: false }));
  return ready;
};

/** 重ねた設定の `extensions` を esbuild-wasm で 1 つずつ ES モジュールにまとめる（`.ts` も読み込み、URL の import はまとめに取り込む） */
export async function bundleExtensions(options: {
  /** `extensions` の絶対パス */
  paths: string[];
  /** 拡張機能のフォルダ（`dist/esbuild.wasm` を読み込む） */
  extensionPath: string;
  /** URL を読み込む関数 */
  fetchText?: FetchText | undefined;
}): Promise<
  Array<{ path: string; code: string } | { path: string; error: string }>
> {
  if (options.paths.length === 0) {
    return [];
  }
  await ensureEsbuild(options.extensionPath);
  const fetchText = cacheFetchText(options.fetchText);
  const results: Array<
    { path: string; code: string } | { path: string; error: string }
  > = [];
  for (const path of options.paths) {
    const result = await bundleModule(path, dirname(path), {
      fetchText,
      build: esbuild.build as BuildFunction,
    });
    results.push({ path, ...result });
  }
  return results;
}
