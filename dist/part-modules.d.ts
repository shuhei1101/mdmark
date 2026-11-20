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
    attachMap: (root: HTMLElement, config: ResolvedConfig, hooks?: {
        resolveIdLink?: ResolveIdLink;
    }) => () => void;
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
export declare const PART_MODULE_FILES: Readonly<Record<PartName, string>>;
/** `setPartModuleLoader` が受け付ける名前。`PART_MODULE_FILES` のキーと `mermaid` */
export declare const PART_LOADER_NAMES: readonly PartLoaderName[];
/** `setPartModuleLoader` で、部品と mermaid のモジュールを返却する関数を入れる（書き出した HTML の起動の処理と利用側のページが呼ぶ）。無い部品の名前は `PART_MODULE_FILES` を `import.meta.url` から解決して読み込む。無い `mermaid` は mermaid.ts がまとめた mermaid か `mermaid.url` から読み込む */
export declare const partModuleLoaders: Map<PartLoaderName, () => Promise<Record<string, unknown>>>;
/** 部品の名前から読み込みの Promise を参照する。ページの中で 1 回だけ読み込む（失敗も記録し、再読み込みしない） */
export declare const partModules: Map<PartName, Promise<LoadedPart<PartName>>>;
/** `mermaid` の名前から、`loader` を呼んだ Promise を参照する。ページの中で 1 回だけ呼ぶ（失敗も記録し、呼び直さない）。`mount` ごとに記録する URL の mermaid と分けて持つ */
export declare const mermaidByLoader: Map<"mermaid", Promise<Record<string, unknown>>>;
/** 部品の配布ファイルをページの中で 1 回だけ読み込み、export の構造を確認して返却する。読み込めない・構造が合わない・隣の URL を作れないときは元のエラーで reject し、エラーの `cause` に URL（作れないときは配布ファイルの名前）を持たせる */
export declare function loadPartModule<Name extends PartName>(name: Name, importModule?: ImportModule, baseUrl?: string): Promise<LoadedPart<Name>>;
/** `setPartModuleLoader` で `mermaid` に指定した関数をページの中で 1 回だけ呼び、その Promise を返却する。指定が無ければ `undefined` を返却する。関数が拒否するか同期で投げたときは元のエラーで reject する。構造の確認は呼ぶ側（mermaid.ts）がする */
export declare function loadMermaidByLoader(): Promise<Record<string, unknown>> | undefined;
/** 部品か mermaid のモジュールの読み込みを、モジュールを返却する関数に差し替える。`dist/index.js` の公開関数で、書き出した HTML の起動の処理も呼ぶ。名前か関数が誤っていると `TypeError` を投げ、差し替えを変えない */
export declare function setPartModuleLoader(name: PartLoaderName, loader: () => Promise<Record<string, unknown>>): void;
export {};
