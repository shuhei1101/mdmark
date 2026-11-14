import type { CommentsPartModule } from "./comments/index.ts";
import type { ResolvedConfig } from "./config.ts";
import type { ViewPartModule } from "./views/index.ts";
/** 部品のモジュールの名前 */
export type PartName = "view" | "comments" | "map";
/** map の部品のモジュール（`dist/map.js`）の構造 */
export type MapPartModule = {
    attachMap: (root: HTMLElement, config: ResolvedConfig) => () => void;
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
/** 書き出した HTML の起動の処理が、同じスクリプトにまとめた部品のモジュールを返却する関数を入れる。無い名前は `PART_MODULE_FILES` を `import.meta.url` から解決して読み込む */
export declare const partModuleLoaders: Map<PartName, () => Promise<Record<string, unknown>>>;
/** 部品の名前から読み込みの Promise を参照する。ページの中で 1 回だけ読み込む（失敗も記録し、再読み込みしない） */
export declare const partModules: Map<PartName, Promise<LoadedPart<PartName>>>;
/** 部品の配布ファイルをページの中で 1 回だけ読み込み、export の構造を確認して返却する。読み込めない・構造が合わないときは元のエラーで reject し、エラーの `cause` に URL を持たせる */
export declare function loadPartModule<Name extends PartName>(name: Name, importModule?: ImportModule): Promise<LoadedPart<Name>>;
/** 部品のモジュールの読み込みを、モジュールを返却する関数に差し替える。書き出した HTML の起動の処理が呼ぶ */
export declare function setPartModuleLoader(name: PartName, loader: () => Promise<Record<string, unknown>>): void;
export {};
