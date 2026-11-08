import type { LibraryEntry } from "./config.ts";
/** `import()` で読んだモジュールが名前付きで export する形 */
export type LibraryModule = {
    /** 印の場所の要素と、印の引数を受けて描く */
    draw: (slot: HTMLElement, args: string[]) => void | Promise<void>;
};
/** URL のモジュールを読む関数 */
export type ImportModule = (url: string) => Promise<LibraryModule>;
/** `setEmbeddedLibraries` が入れる、印の名前から外部ライブラリのモジュールを返す関数を引く表。無ければ対応表の URL から読む。ページの中の全ての `mount` に効く */
export declare let embeddedLibraries: Record<string, () => Promise<LibraryModule>> | undefined;
/** 埋めた外部ライブラリを置き換える。`undefined` で対応表の URL から読む形に戻す */
export declare function setEmbeddedLibraries(loaders: Record<string, () => Promise<LibraryModule>> | undefined): void;
/** 要素の中の印の場所ごとに、登録した拡張なら引数を検査して `load` で、対応表なら URL でモジュールを読んで `draw` を呼ぶ。引数が合わない場所は書き方の警告に、読めない・描けない・検査が失敗する場所は知らせの枠に替える */
export declare function loadLibraries(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 既定を当てた対応表 */
    libraries: Record<string, LibraryEntry>;
    /** 描いた文書がまだ今のものか */
    isCurrent: () => boolean;
    /** モジュールを読む関数（単体テストで差し替える） */
    importModule?: ImportModule;
    /** 範囲で書いた拡張の印から読んだ部品の定義。印の場所の `data-mdmark-definition` の番号で引く */
    definitions?: unknown[];
}): Promise<void>;
