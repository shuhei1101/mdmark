import type { CommentsPartModule } from "./comments/index.ts";
import type { ViewPartModule } from "./views/index.ts";
/** 部品のモジュールの名前 */
export type PartName = "view" | "comments";
/** 部品の名前ごとのモジュールの形 */
type PartModules = {
    view: ViewPartModule;
    comments: CommentsPartModule;
};
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
export declare const PART_MODULE_FILES: Readonly<Record<PartName, string>>;
/** 書き出した HTML の起動の処理が、埋めたコードの `blob:` URL を入れる。無い名前は `PART_MODULE_FILES` を `import.meta.url` から解決する */
export declare const partModuleUrls: Map<PartName, string>;
/** 部品の名前から読み込みの Promise を引く。ページの中で 1 回だけ読む（失敗も控え、読み直さない） */
export declare const partModules: Map<PartName, Promise<LoadedPart<PartName>>>;
/** 部品の配布ファイルをページの中で 1 回だけ読み、export の形を確かめて返す。読めない・形が合わないときは元のエラーで reject し、エラーの `cause` に URL を持たせる */
export declare function loadPartModule<Name extends PartName>(name: Name, importModule?: ImportModule): Promise<LoadedPart<Name>>;
/** 部品のモジュールの URL を差し替える。書き出した HTML の起動の処理が呼ぶ */
export declare function setPartModuleUrl(name: PartName, url: string): void;
export {};
