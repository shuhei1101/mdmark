/** 罫線を読んだ 1 項目 */
export type TreeNode = {
    /** 項目の名前 */
    name: string;
    /** 注釈の HTML（区切りの `#` の後ろのインラインを描いたもの） */
    note?: string | undefined;
    /** 子の項目 */
    children?: TreeNode[] | undefined;
};
/** ファイルのアイコンの種類（lucide の名前） */
export type FileIcon = "file-text" | "file-code" | "file-json" | "file-image" | "file-spreadsheet" | "file-archive" | "file-terminal" | "file";
/** コピーのボタンの状態 */
export type TreeCopyState = "idle" | "copied";
/** 「ほかにもある」を表す項目の名前 */
export declare const TREE_MORE_NAME = "...";
/** ファイル名から、アイコンの種類を返す。名前そのものを先に引き、次に最後の `.` の後ろを小文字にした拡張子で引く。どれにも当たらなければ `file` */
export declare function fileIconOf(name: string): FileIcon;
/** ルートを 0 としたフォルダの深さと `data-open` の値から、既定で開くかを返す。`all` は常に開き、数は深さがその数より浅いとき、値が無ければルートだけを開く */
export declare function folderOpenByDefault(depth: number, open: string | undefined): boolean;
/** コピーのボタンの中身（アイコンと文言）の HTML を返す */
export declare function renderTreeCopyContent(state: TreeCopyState): string;
/** ツリーの上に置く帯（種類 `tree`・コピーのボタン・読み上げの知らせ）の HTML を返す */
export declare function renderTreeBar(options: {
    copyState?: TreeCopyState;
}): string;
/** ファイルツリーの HTML を返す。`render` は全てのフォルダを開いて出し、`interactive` のときは `mount` が付けた後の帯と開閉のボタンも描く */
export declare function renderTree(options: {
    /** 項目 */
    nodes: TreeNode[];
    /** コードブロックに書いた罫線のテキスト（コピーするテキスト） */
    source: string;
    /** 既定で開く階層（`open=` の値。`all` か 1 以上の整数の文字） */
    open?: string | undefined;
    /** `mount` が付けた状態にするか（既定 `false`） */
    interactive?: boolean;
    /** コピーのボタンの状態（既定 `idle`） */
    copyState?: TreeCopyState;
    /** クリップボードに書けなかったときのパネルを出すか（既定 `false`） */
    copyFallback?: boolean;
    /** `aria-controls` の id の頭（既定 `mdmark-tree`） */
    id?: string;
}): string;
