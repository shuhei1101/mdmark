import type { CommentsPartModule } from "./comments/index.ts";
import type { ResolvedConfig } from "./config.ts";
import type { ResolveIdLink } from "./render/sanitize.ts";
import type { ViewPartModule } from "./views/index.ts";

/** 部品のモジュールの名前 */
export type PartName = "view" | "comments" | "map";

/** `setPartModuleLoader` で読み込みを差し替えられる名前（部品の名前と `mermaid`） */
export type PartLoaderName = PartName | "mermaid";

/** map の部品のモジュール（`dist/map.js`）の構造 */
export type MapPartModule = {
  attachMap: (
    root: HTMLElement,
    config: ResolvedConfig,
    hooks?: {
      restoreMermaid?: (blocks: HTMLElement[]) => void;
      resolveIdLink?: ResolveIdLink;
    },
  ) => () => void;
};

/** 部品の名前ごとのモジュールの構造 */
type PartModules = {
  view: ViewPartModule;
  comments: CommentsPartModule;
  map: MapPartModule;
};

/** 読み込んだモジュールとその URL */
export type LoadedPart<Name extends PartName> = {
  /** 読み込んだ URL */
  url: string;
  /** モジュール */
  module: PartModules[Name];
};

/** モジュールを読み込む関数 */
export type ImportModule = (url: string) => Promise<Record<string, unknown>>;

/** 部品の名前から、`dist/index.js` の隣に配置する配布ファイルの名前を参照する */
export const PART_MODULE_FILES: Readonly<Record<PartName, string>> = {
  view: "view.js",
  comments: "comments.js",
  map: "map.js",
};

/** `setPartModuleLoader` が受け付ける名前。`PART_MODULE_FILES` のキーと `mermaid` */
export const PART_LOADER_NAMES: readonly PartLoaderName[] = [
  "view",
  "comments",
  "map",
  "mermaid",
];

/** 部品のモジュールが export しているべき関数の名前 */
const PART_EXPORTS: Readonly<Record<PartName, readonly string[]>> = {
  view: ["drawView", "attachView"],
  comments: ["attachComments"],
  map: ["attachMap"],
};

/** `setPartModuleLoader` で、部品と mermaid のモジュールを返却する関数を入れる（書き出した HTML の起動の処理と利用側のページが呼ぶ）。無い部品の名前は `PART_MODULE_FILES` を `import.meta.url` から解決して読み込む。無い `mermaid` は mermaid.ts がまとめた mermaid か `mermaid.url` から読み込む */
export const partModuleLoaders = new Map<
  PartLoaderName,
  () => Promise<Record<string, unknown>>
>();

/** 部品の名前から読み込みの Promise を参照する。ページの中で 1 回だけ読み込む（失敗も記録し、再読み込みしない） */
export const partModules = new Map<PartName, Promise<LoadedPart<PartName>>>();

/** `mermaid` の名前から、`loader` を呼んだ Promise を参照する。ページの中で 1 回だけ呼ぶ（失敗も記録し、呼び直さない）。`mount` ごとに記録する URL の mermaid と分けて持つ */
export const mermaidByLoader = new Map<
  "mermaid",
  Promise<Record<string, unknown>>
>();

/** 動的 `import()` でモジュールを読み込む */
const importByUrl: ImportModule = (url) => import(/* @vite-ignore */ url);

/** エラーに読み込んだ URL を `cause` として持たせる。持っていれば変えない */
function withUrl(error: unknown, url: string): Error {
  if (error instanceof Error) {
    error.cause ??= url;
    return error;
  }
  return new Error(String(error), { cause: url });
}

/** 部品のモジュールを読み込み、export の構造を確認して返却する。`url` はエラーの `cause` と戻り値に持たせる */
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

/** `baseUrl` の隣の配布ファイルを読み込む。URL を作れないときは同期で投げずに reject し、エラーの `cause` に配布ファイルの名前を持たせる */
async function readSiblingPartModule(
  name: PartName,
  importModule: ImportModule,
  baseUrl: string,
): Promise<LoadedPart<PartName>> {
  let url: string;
  try {
    url = new URL(`./${PART_MODULE_FILES[name]}`, baseUrl).href;
  } catch (error) {
    throw withUrl(error, PART_MODULE_FILES[name]);
  }
  return readPartModule(name, url, importModule);
}

/** 部品の配布ファイルをページの中で 1 回だけ読み込み、export の構造を確認して返却する。読み込めない・構造が合わない・隣の URL を作れないときは元のエラーで reject し、エラーの `cause` に URL（作れないときは配布ファイルの名前）を持たせる */
export function loadPartModule<Name extends PartName>(
  name: Name,
  importModule: ImportModule = importByUrl,
  baseUrl: string = import.meta.url,
): Promise<LoadedPart<Name>> {
  const loaded = partModules.get(name);
  if (loaded !== undefined) {
    return loaded as Promise<LoadedPart<Name>>;
  }
  const loader = partModuleLoaders.get(name);
  const loading =
    loader === undefined
      ? readSiblingPartModule(name, importModule, baseUrl)
      : readPartModule(name, PART_MODULE_FILES[name], loader);
  partModules.set(name, loading);
  return loading as Promise<LoadedPart<Name>>;
}

/** `setPartModuleLoader` で `mermaid` に指定した関数をページの中で 1 回だけ呼び、その Promise を返却する。指定が無ければ `undefined` を返却する。関数が拒否するか同期で投げたときは元のエラーで reject する。構造の確認は呼ぶ側（mermaid.ts）がする */
export function loadMermaidByLoader():
  | Promise<Record<string, unknown>>
  | undefined {
  const loaded = mermaidByLoader.get("mermaid");
  if (loaded !== undefined) {
    return loaded;
  }
  const loader = partModuleLoaders.get("mermaid");
  if (loader === undefined) {
    return undefined;
  }
  const loading = (async () => loader())();
  mermaidByLoader.set("mermaid", loading);
  return loading;
}

/** 部品か mermaid のモジュールの読み込みを、モジュールを返却する関数に差し替える。`dist/index.js` の公開関数で、書き出した HTML の起動の処理も呼ぶ。名前か関数が誤っていると `TypeError` を投げ、差し替えを変えない */
export function setPartModuleLoader(
  name: PartLoaderName,
  loader: () => Promise<Record<string, unknown>>,
): void {
  if (!PART_LOADER_NAMES.includes(name)) {
    throw new TypeError(
      `name は ${PART_LOADER_NAMES.join("・")} のどれかを指定してください: ${String(name)}`,
    );
  }
  if (typeof loader !== "function") {
    throw new TypeError("loader はモジュールを返却する関数を指定してください");
  }
  partModuleLoaders.set(name, loader);
}
