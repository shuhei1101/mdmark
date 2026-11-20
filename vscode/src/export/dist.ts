import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

/** 保存して使い回すバージョン（`develop` は内容が更新されるため使い回さない） */
const RELEASE_VERSION = /^v\d+\.\d+\.\d+$/;

/** 誤りの文 */
const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** `v{X}.{Y}.{Z}` の配布物: 保存先の `index.js` が無いときだけ取得して保存する */
const saveRelease = async (context: {
  dir: string;
  url: string;
  fetchText: (url: string) => Promise<string>;
}): Promise<{ file: string } | { reason: string }> => {
  const file = join(context.dir, "index.js");
  try {
    await readFile(file, "utf8");
    return { file };
  } catch {
    // 保存していないので取得する
  }
  try {
    const code = await context.fetchText(context.url);
    await mkdir(context.dir, { recursive: true });
    await writeFile(file, code, "utf8");
    return { file };
  } catch (error) {
    await rm(file, { force: true });
    return { reason: reasonOf(error) };
  }
};

/** `develop` の配布物: 呼ぶたびに取得し、内容ごとのファイルに保存して、同じフォルダのほかの `.js` を削除する（`import()` が前に読み込んだモジュールを返却しないようにする） */
const saveLatest = async (context: {
  dir: string;
  url: string;
  fetchText: (url: string) => Promise<string>;
}): Promise<{ file: string } | { reason: string }> => {
  let code: string;
  try {
    code = await context.fetchText(context.url);
  } catch (error) {
    return { reason: reasonOf(error) };
  }
  const name = `${createHash("sha256").update(code).digest("hex").slice(0, 16)}.js`;
  const file = join(context.dir, name);
  await mkdir(context.dir, { recursive: true });
  await writeFile(file, code, "utf8");
  for (const other of await readdir(context.dir)) {
    if (other !== name && other.endsWith(".js"))
      await rm(join(context.dir, other), { force: true });
  }
  return { file };
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
  const url = distUrl({ base: distBase, version, file: "index.js" });
  const saved = RELEASE_VERSION.test(version)
    ? await saveRelease({
        dir: join(storageDir, "dist", version),
        url,
        fetchText,
      })
    : await saveLatest({
        dir: join(storageDir, "dist", version),
        url,
        fetchText,
      });
  if ("reason" in saved) return { kind: "unavailable", reason: saved.reason };
  const file = saved.file;
  // 拡張機能の本体は CJS のため、指定子を変数にして esbuild が `import()` を `require` に置き換えないようにする
  const specifier = pathToFileURL(file).href;
  const module: Record<string, unknown> = await import(specifier);
  const renderForMount = module.renderForMount;
  if (typeof renderForMount !== "function") return { kind: "unsupported" };
  return { kind: "ok", renderForMount: renderForMount as RenderForMount };
}
