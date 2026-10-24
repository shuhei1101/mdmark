import type { CommentsPartModule } from "./comments/index.ts";
import type { ViewPartModule } from "./views/index.ts";

/** 部品のモジュールの名前 */
export type PartName = "view" | "comments";

/** 部品の名前ごとのモジュールの形 */
type PartModules = { view: ViewPartModule; comments: CommentsPartModule };

/** 読んだモジュールとその URL */
export type LoadedPart<Name extends PartName> = {
  /** 読んだ URL */
  url: string;
  /** モジュール */
  module: PartModules[Name];
};

/** モジュールを読む関数 */
export type ImportModule = (url: string) => Promise<Record<string, unknown>>;

/** 部品の名前から、`dist/index.js` の隣に置く配布ファイルの名前を引く */
export const PART_MODULE_FILES: Readonly<Record<PartName, string>> = {
  view: "view.js",
  comments: "comments.js",
};

/** 部品のモジュールが export しているべき関数の名前 */
const PART_EXPORTS: Readonly<Record<PartName, readonly string[]>> = {
  view: ["drawView", "attachView"],
  comments: ["attachComments"],
};

/** 書き出した HTML の起動の処理が、埋めたコードの `blob:` URL を入れる。無い名前は `PART_MODULE_FILES` を `import.meta.url` から解決する */
export const partModuleUrls = new Map<PartName, string>();

/** 部品の名前から読み込みの Promise を引く。ページの中で 1 回だけ読む（失敗も控え、読み直さない） */
export const partModules = new Map<PartName, Promise<LoadedPart<PartName>>>();

/** 動的 `import()` でモジュールを読む */
const importByUrl: ImportModule = (url) => import(/* @vite-ignore */ url);

/** エラーに読んだ URL を `cause` として持たせる。持っていれば変えない */
function withUrl(error: unknown, url: string): Error {
  if (error instanceof Error) {
    error.cause ??= url;
    return error;
  }
  return new Error(String(error), { cause: url });
}

/** 部品のモジュールを URL から読み、export の形を確かめて返す */
async function readPartModule(
  name: PartName,
  url: string,
  importModule: ImportModule,
): Promise<LoadedPart<PartName>> {
  let module: Record<string, unknown>;
  try {
    module = await importModule(url);
  } catch (error) {
    throw withUrl(error, url);
  }
  for (const exported of PART_EXPORTS[name]) {
    if (typeof module[exported] !== "function") {
      throw new Error(
        `モジュールが ${exported} を export していません: ${name}`,
        {
          cause: url,
        },
      );
    }
  }
  return { url, module: module as unknown as PartModules[PartName] };
}

/** 部品の配布ファイルをページの中で 1 回だけ読み、export の形を確かめて返す。読めない・形が合わないときは元のエラーで reject し、エラーの `cause` に URL を持たせる */
export function loadPartModule<Name extends PartName>(
  name: Name,
  importModule: ImportModule = importByUrl,
): Promise<LoadedPart<Name>> {
  const loaded = partModules.get(name);
  if (loaded !== undefined) {
    return loaded as Promise<LoadedPart<Name>>;
  }
  const url =
    partModuleUrls.get(name) ??
    new URL(`./${PART_MODULE_FILES[name]}`, import.meta.url).href;
  const loading = readPartModule(name, url, importModule);
  partModules.set(name, loading);
  return loading as Promise<LoadedPart<Name>>;
}

/** 部品のモジュールの URL を差し替える。書き出した HTML の起動の処理が呼ぶ */
export function setPartModuleUrl(name: PartName, url: string): void {
  partModuleUrls.set(name, url);
}
