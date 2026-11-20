import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { MdmarkRendered } from "../../../src/mount.ts";
import { distUrl } from "../preview/html.ts";

/** 配布物の公開関数 `renderForMount`（インターフェース定義『書き出す文書を描く』） */
export type RenderForMount = (
  markdown: string,
  opts?: Record<string, unknown>,
) => Promise<{ rendered: MdmarkRendered; pureMarkdown: string }>;

/** 配布物の描く処理を読み込んだ結果 */
export type DistRenderer =
  | { kind: "ok"; renderForMount: RenderForMount }
  | { kind: "unavailable"; reason: string }
  | { kind: "unsupported" };

/** 取得した文字列を返却する。応答が成功でなければ誤りを投げる */
const fetchTextByDefault = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }
  return response.text();
};

/** 決めたバージョンの jsDelivr の `dist/index.js` を拡張機能の保存先に保存して読み込み、`renderForMount` を返却する */
export async function loadDistRenderer(options: {
  /** 読み込む mdmark のバージョン */
  version: string;
  /** 保存先のフォルダ（`ExtensionContext.globalStorageUri` の `fsPath`） */
  storageDir: string;
  /** 配布物の配信元（`ExtensionDeps.distBase`） */
  distBase: string;
  /** 取得する関数。省くと `fetch` で取得する */
  fetchText?: (url: string) => Promise<string>;
}): Promise<DistRenderer> {
  const { version, storageDir, distBase } = options;
  const fetchText = options.fetchText ?? fetchTextByDefault;
  const file = join(storageDir, "dist", version, "index.js");
  let saved: string | undefined;
  try {
    saved = await readFile(file, "utf8");
  } catch {
    saved = undefined;
  }
  if (saved === undefined) {
    try {
      const code = await fetchText(
        distUrl({ base: distBase, version, file: "index.js" }),
      );
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, code, "utf8");
    } catch (error) {
      await rm(file, { force: true });
      return {
        kind: "unavailable",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
  // 拡張機能の本体は CJS のため、指定子を変数にして esbuild が `import()` を `require` に置き換えないようにする
  const specifier = pathToFileURL(file).href;
  const module: Record<string, unknown> = await import(specifier);
  const renderForMount = module.renderForMount;
  if (typeof renderForMount !== "function") return { kind: "unsupported" };
  return { kind: "ok", renderForMount: renderForMount as RenderForMount };
}
