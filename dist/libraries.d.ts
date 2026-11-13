import type { LibraryEntry } from "./config.ts";
/** `import()` で読み込んだモジュールが名前付きで export する構造 */
export type LibraryModule = {
    /** マーカーの場所の要素と、マーカーの引数の JSON のオブジェクトを受けて描く */
    draw: (slot: HTMLElement, options: Record<string, unknown>) => void | Promise<void>;
};
/** URL のモジュールを読み込む関数 */
export type ImportModule = (url: string) => Promise<LibraryModule>;
/** `setEmbeddedLibraries` が入れる、マーカーの名前から外部ライブラリのモジュールを返却する関数を参照する表。無ければ対応表の URL から読み込む。ページの中の全ての `mount` に有効になる */
export declare let embeddedLibraries: Record<string, () => Promise<LibraryModule>> | undefined;
/** 埋めた外部ライブラリを置き換える。`undefined` で対応表の URL から読み込む構造に戻す */
export declare function setEmbeddedLibraries(loaders: Record<string, () => Promise<LibraryModule>> | undefined): void;
/** 要素の中のマーカーの場所ごとに、登録した拡張なら引数を検査して `load` で、対応表なら URL でモジュールを読み込んで `draw` を呼ぶ。引数が合わない場所は記載の警告に、読み込めない・描けない・検査が失敗する場所は通知ブロックに替える */
export declare function loadLibraries(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 既定を適用した対応表 */
    libraries: Record<string, LibraryEntry>;
    /** 描いた文書がまだ今のものか */
    isCurrent: () => boolean;
    /** モジュールを読み込む関数（単体テストで差し替える） */
    importModule?: ImportModule;
    /** 範囲で記載した拡張のマーカーから読み込んだ部品の定義。マーカーの場所の `data-mdmark-definition` の番号で参照する */
    definitions?: unknown[];
}): Promise<void>;
