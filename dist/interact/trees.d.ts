/** フォルダを開く・閉じる。閉じた入れ子の `ul` は `hidden="until-found"` にして、ページ内検索が中を見つけられるようにする */
export declare function setFolderOpen(toggle: Element, open: boolean): void;
/** `render` が出したファイルツリーの注釈の列の位置を測って入れる（Storybook が帯と開閉のボタンを描いたツリーに使う） */
export declare function alignFileTreeNotes(tree: HTMLElement): void;
/** 描いた要素の中のファイルツリーに、帯とコピーのボタン・フォルダの開閉・注釈の列の位置を付け、まとめて外して `render` の出した状態に戻す関数を返す */
export declare function attachFileTrees(root: HTMLElement): () => void;
